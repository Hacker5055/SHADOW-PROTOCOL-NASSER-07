// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Character/SPCharacterMovementComponent.h"
#include "GameFramework/Character.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

namespace
{
	constexpr float KStanceTransitionSpeed = 7.5f;
	constexpr float KMantleDuration = 0.62f;
}

USPCharacterMovementComponent::USPCharacterMovementComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PrePhysics;

	// Ground movement defaults tuned for a grounded military shooter.
	MaxWalkSpeed = WalkSpeed;
	MaxAcceleration = 2048.f;
	BrakingDecelerationWalking = 2400.f;
	GroundFriction = 8.f;
	JumpZVelocity = 580.f;
	AirControl = 0.22f;
	bOrientRotationToMovement = false;
	bUseControllerDesiredRotation = false;
	NavAgentProps.bCanCrouch = true;
	NavAgentProps.bCanSwim = false;
	SetCrouchedHalfHeight(CrouchCapsuleHalfHeight);
	MaxWalkSpeedCrouched = CrouchSpeed;
	GetNavAgentPropertiesRef().bCanCrouch = true;
}

void USPCharacterMovementComponent::BeginPlay()
{
	Super::BeginPlay();

	if (ACharacter* OwnerCharacter = CharacterOwner)
	{
		if (UCapsuleComponent* Capsule = OwnerCharacter->GetCapsuleComponent())
		{
			StandCapsuleHalfHeight = Capsule->GetScaledCapsuleHalfHeight();
		}
		OwnerCharacter->OnMovementModeChangedDelegate.AddDynamic(this, &USPCharacterMovementComponent::HandleMovementModeChanged);
	}

	Stamina = StaminaMax;
}

void USPCharacterMovementComponent::HandleMovementModeChanged(ACharacter* Character, EMovementMode PrevMode, uint8 PrevCustomMode)
{
	// Leaving the ground cancels a slide (a slide is a grounded state).
	if (CurrentStance == ESPStance::Slide && PrevMode == MOVE_Walking && Character && !Character->GetCharacterMovement()->IsMovingOnGround())
	{
		SetStance(ESPStance::Stand);
		SlideTimeRemaining = 0.f;
	}
}

float USPCharacterMovementComponent::GetMaxSpeed() const
{
	if (bMantling)
	{
		return 0.f;
	}

	switch (CurrentStance)
	{
	case ESPStance::Slide:
		return SlideSpeed;

	case ESPStance::Prone:
		return ProneSpeed;

	case ESPStance::Crouch:
		return bWantsToAim ? CrouchSpeed * AimingSpeedMultiplier : CrouchSpeed;

	default:
		break;
	}

	float Speed = WalkSpeed;
	if (bTacticalSprinting)
	{
		Speed = TacticalSprintSpeed;
	}
	else if (bSprintIntent && !bWantsToAim)
	{
		Speed = SprintSpeed;
	}

	if (bWantsToAim)
	{
		Speed *= AimingSpeedMultiplier;
	}

	return Speed;
}

void USPCharacterMovementComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (!CharacterOwner || CharacterOwner->GetLocalRole() != ROLE_Authority)
	{
		// Cosmetic interpolation still runs on simulated proxies so leaning and
		// stance read correctly for other players / cinematic cameras.
		UpdateLean(DeltaTime);
		return;
	}

	UpdateTacticalSprint(DeltaTime);
	UpdateSlide(DeltaTime);
	UpdateMantle(DeltaTime);
	UpdateStamina(DeltaTime);
	UpdateStance(DeltaTime);
	UpdateLean(DeltaTime);
}

void USPCharacterMovementComponent::SetSprintIntent(bool bPressed)
{
	if (bSprintIsToggle && bPressed)
	{
		bSprintIntent = !bSprintIntent;
	}
	else
	{
		bSprintIntent = bPressed;
	}

	if (!bSprintIntent)
	{
		SprintHeldTime = 0.f;
		bTacticalSprinting = false;
	}
}

void USPCharacterMovementComponent::SetCrouchIntent(bool bPressed)
{
	if (!bPressed)
	{
		return;
	}

	if (CurrentStance == ESPStance::Prone)
	{
		SetStance(ESPStance::Crouch);
		return;
	}

	if (CurrentStance == ESPStance::Slide)
	{
		return; // the slide owns the crouch key until it finishes
	}

	if (bCrouchIsToggle)
	{
		SetStance(CurrentStance == ESPStance::Crouch ? ESPStance::Stand : ESPStance::Crouch);
	}
	else
	{
		SetStance(ESPStance::Crouch);
	}
}

void USPCharacterMovementComponent::ToggleProne()
{
	if (CurrentStance == ESPStance::Prone)
	{
		if (CanStandUp())
		{
			SetStance(ESPStance::Stand);
		}
		else
		{
			SetStance(ESPStance::Crouch);
		}
		return;
	}

	SetStance(ESPStance::Prone);
}

void USPCharacterMovementComponent::SetLeanIntent(float InLean)
{
	LeanTarget = FMath::Clamp(InLean, -1.f, 1.f);

	// A character cannot lean while prone or sliding.
	if (CurrentStance == ESPStance::Prone || CurrentStance == ESPStance::Slide)
	{
		LeanTarget = 0.f;
	}
}

void USPCharacterMovementComponent::TryStartSlide()
{
	if (CurrentStance == ESPStance::Prone || CurrentStance == ESPStance::Crouch)
	{
		return;
	}
	if (!IsMovingOnGround() || SlideCooldownRemaining > 0.f || bMantling)
	{
		return;
	}
	if (Stamina < 15.f)
	{
		return;
	}

	const float Velocity = GetLastInputVector().Size();
	if (Velocity < 0.1f && !bSprintIntent)
	{
		return;
	}

	Stamina = FMath::Max(0.f, Stamina - 18.f);
	TimeSinceStaminaSpend = 0.f;
	SlideTimeRemaining = SlideDuration;

	// Kick the character forward along its facing so the slide has weight.
	if (ACharacter* OwnerCharacter = CharacterOwner)
	{
		const FVector Impulse = OwnerCharacter->GetActorForwardVector() * 420.f + FVector(0.f, 0.f, 60.f);
		OwnerCharacter->LaunchCharacter(Impulse, false, false);
	}

	SetStance(ESPStance::Slide);
	OnSlideStarted.Broadcast(GetMaxSpeed());
}

bool USPCharacterMovementComponent::TryMantle()
{
	if (bMantling || !IsMovingOnGround() || CurrentStance == ESPStance::Prone)
	{
		return false;
	}

	ACharacter* OwnerCharacter = CharacterOwner;
	UWorld* World = GetWorld();
	if (!OwnerCharacter || !World)
	{
		return false;
	}

	const FVector Forward = OwnerCharacter->GetActorForwardVector();
	const FVector Origin = OwnerCharacter->GetActorLocation();

	// Two-stage probe: chest blocked, knee clear -> there is a ledge at knee height.
	FCollisionQueryParams Params(SCENE_QUERY_STAT(SPMantle), false, OwnerCharacter);

	const FVector ChestFrom = Origin + FVector(0.f, 0.f, MantleCheckHeight * 0.5f);
	const FVector ChestTo = ChestFrom + Forward * MantleTraceDistance;
	FHitResult ChestHit;
	const bool bChestBlocked = World->LineTraceSingleByChannel(ChestHit, ChestFrom, ChestTo, ECC_Visibility, Params);

	const FVector KneeFrom = Origin + FVector(0.f, 0.f, 25.f);
	const FVector KneeTo = KneeFrom + Forward * MantleTraceDistance;
	FHitResult KneeHit;
	const bool bKneeBlocked = World->LineTraceSingleByChannel(KneeHit, KneeFrom, KneeTo, ECC_Visibility, Params);

	if (!bChestBlocked || bKneeBlocked)
	{
		return false;
	}

	// Find the top of the ledge: trace downward from above the chest hit.
	const float LedgeTopGuess = ChestHit.ImpactPoint.Z + StandCapsuleHalfHeight;
	FHitResult TopHit;
	const FVector TopFrom = FVector(ChestHit.ImpactPoint.X, ChestHit.ImpactPoint.Y, Origin.Z + MantleMaxHeight + 40.f);
	const FVector TopTo = FVector(ChestHit.ImpactPoint.X, ChestHit.ImpactPoint.Y, Origin.Z);
	if (!World->LineTraceSingleByChannel(TopHit, TopFrom, TopTo, ECC_Visibility, Params))
	{
		return false;
	}

	const float LedgeZ = TopHit.ImpactPoint.Z;
	const float DeltaZ = LedgeZ - Origin.Z;
	if (DeltaZ < 55.f || DeltaZ > MantleMaxHeight)
	{
		return false;
	}

	// Destination must have room for the capsule.
	const FVector Destination = FVector(
		Origin.X + Forward.X * (MantleTraceDistance + 55.f),
		Origin.Y + Forward.Y * (MantleTraceDistance + 55.f),
		LedgeZ + StandCapsuleHalfHeight + 2.f);

	FCollisionShape Capsule = FCollisionShape::MakeCapsule(34.f, StandCapsuleHalfHeight * 0.9f);
	if (World->OverlapBlockingTestByChannel(Destination, FQuat::Identity, ECC_Pawn, Capsule, Params))
	{
		return false;
	}

	MantleStart = Origin;
	MantleEnd = Destination;
	MantleAlpha = 0.f;
	bMantling = true;
	SetStance(ESPStance::Mantle);
	SetMovementMode(MOVE_Flying);
	OnMantleStarted.Broadcast();
	return true;
}

void USPCharacterMovementComponent::UpdateMantle(float DeltaTime)
{
	if (!bMantling)
	{
		return;
	}

	MantleAlpha = FMath::Clamp(MantleAlpha + DeltaTime / KMantleDuration, 0.f, 1.f);
	const float Smoothed = FMath::InterpEaseInOut(0.f, 1.f, MantleAlpha, 2.2f);

	if (ACharacter* OwnerCharacter = CharacterOwner)
	{
		// Arc over the ledge: rise first, then translate forward.
		const FVector Horizontal = FMath::Lerp(
			FVector(MantleStart.X, MantleStart.Y, 0.f),
			FVector(MantleEnd.X, MantleEnd.Y, 0.f), Smoothed);
		const float VerticalLift = FMath::InterpEaseOut(MantleStart.Z, MantleEnd.Z, FMath::Clamp(MantleAlpha * 1.8f, 0.f, 1.f), 1.6f);
		OwnerCharacter->SetActorLocation(FVector(Horizontal.X, Horizontal.Y, VerticalLift), false, nullptr, ETeleportType::TeleportPhysics);
		Velocity = FVector::ZeroVector;
	}

	if (MantleAlpha >= 1.f)
	{
		bMantling = false;
		SetMovementMode(MOVE_Walking);
		SetStance(ESPStance::Stand);
	}
}

void USPCharacterMovementComponent::UpdateTacticalSprint(float DeltaTime)
{
	const bool bMoving = GetLastInputVector().SizeSquared() > 0.09f;
	const bool bCanSprint = CurrentStance == ESPStance::Stand && !bWantsToAim && bMoving && IsMovingOnGround();

	if (bSprintIntent && bCanSprint && Stamina > 4.f)
	{
		SprintHeldTime += DeltaTime;
		bTacticalSprinting = SprintHeldTime >= SprintTacticalDelay;
	}
	else
	{
		SprintHeldTime = 0.f;
		bTacticalSprinting = false;
	}
}

void USPCharacterMovementComponent::UpdateSlide(float DeltaTime)
{
	SlideCooldownRemaining = FMath::Max(0.f, SlideCooldownRemaining - DeltaTime);

	// Pressing crouch while sprinting starts a slide.
	// (ASPCharacter forwards the crouch press to SetCrouchIntent; the slide
	//  check lives here so both input paths share one implementation.)
	if (CurrentStance == ESPStance::Slide)
	{
		SlideTimeRemaining -= DeltaTime;
		if (SlideTimeRemaining <= 0.f || !IsMovingOnGround())
		{
			SlideCooldownRemaining = SlideCooldown;
			SetStance(ESPStance::Crouch);
		}
	}
}

void USPCharacterMovementComponent::UpdateStamina(float DeltaTime)
{
	const bool bSpending = bTacticalSprinting || (bSprintIntent && CurrentStance == ESPStance::Stand);

	if (bSpending)
	{
		const float Drain = bTacticalSprinting ? TacticalSprintStaminaDrain : SprintStaminaDrain;
		Stamina = FMath::Max(0.f, Stamina - Drain * DeltaTime);
		TimeSinceStaminaSpend = 0.f;

		if (Stamina <= 0.f)
		{
			bTacticalSprinting = false;
			bSprintIntent = false;
			OnStaminaDepleted.Broadcast();
		}
	}
	else
	{
		TimeSinceStaminaSpend += DeltaTime;
		if (TimeSinceStaminaSpend >= StaminaRecoveryDelay)
		{
			Stamina = FMath::Min(StaminaMax, Stamina + StaminaRecovery * DeltaTime);
		}
	}
}

void USPCharacterMovementComponent::UpdateStance(float DeltaTime)
{
	float TargetHalfHeight = StandCapsuleHalfHeight;

	switch (CurrentStance)
	{
	case ESPStance::Crouch:
		TargetHalfHeight = CrouchCapsuleHalfHeight;
		break;
	case ESPStance::Prone:
		TargetHalfHeight = ProneCapsuleHalfHeight;
		break;
	case ESPStance::Slide:
		TargetHalfHeight = CrouchCapsuleHalfHeight * 0.9f;
		break;
	default:
		break;
	}

	ApplyCapsuleHeight(TargetHalfHeight);

	MaxWalkSpeed = GetMaxSpeed();
	MaxWalkSpeedCrouched = CrouchSpeed;
}

void USPCharacterMovementComponent::ApplyCapsuleHeight(float TargetHalfHeight)
{
	ACharacter* OwnerCharacter = CharacterOwner;
	if (!OwnerCharacter)
	{
		return;
	}

	UCapsuleComponent* Capsule = OwnerCharacter->GetCapsuleComponent();
	if (!Capsule)
	{
		return;
	}

	const float Current = Capsule->GetUnscaledCapsuleHalfHeight();
	if (FMath::IsNearlyEqual(Current, TargetHalfHeight, 0.5f))
	{
		return;
	}

	const float Smoothed = FMath::FInterpTo(Current, TargetHalfHeight, GetWorld()->GetDeltaSeconds(), KStanceTransitionSpeed);

	// Keep the feet planted: shift the actor by the delta in half-height.
	const float Delta = Smoothed - Current;
	Capsule->SetCapsuleHalfHeight(Smoothed, true);
	OwnerCharacter->AddActorWorldOffset(FVector(0.f, 0.f, Delta), true);
}

bool USPCharacterMovementComponent::CanStandUp() const
{
	const ACharacter* OwnerCharacter = CharacterOwner;
	const UWorld* World = GetWorld();
	if (!OwnerCharacter || !World)
	{
		return false;
	}

	const FVector Location = OwnerCharacter->GetActorLocation();
	const float NeededHalfHeight = StandCapsuleHalfHeight + 2.f;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(SPCanStand), false, OwnerCharacter);
	const FVector Start = Location + FVector(0.f, 0.f, CrouchCapsuleHalfHeight);
	const FVector End = Location + FVector(0.f, 0.f, NeededHalfHeight);
	return !World->SweepTestByChannel(Start, End, FQuat::Identity, ECC_Pawn,
		FCollisionShape::MakeCapsule(OwnerCharacter->GetCapsuleComponent()->GetScaledCapsuleRadius(), 1.f), Params);
}

void USPCharacterMovementComponent::UpdateLean(float DeltaTime)
{
	const float TargetAlpha = FMath::IsNearlyZero(LeanTarget) ? 0.f : FMath::Sign(LeanTarget);
	const float InterpSpeed = FMath::IsNearlyZero(LeanTarget) ? LeanTransitionSpeed * 1.4f : LeanTransitionSpeed;
	LeanAlpha = FMath::FInterpTo(LeanAlpha, TargetAlpha, DeltaTime, InterpSpeed);

	// Reject a lean into geometry: trace sideways from the head.
	if (bWantsToAim || LeanAlpha < 0.35f || !CharacterOwner)
	{
		return;
	}

	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	const FVector Right = CharacterOwner->GetActorRightVector();
	const FVector Head = CharacterOwner->GetActorLocation() + FVector(0.f, 0.f, StandCapsuleHalfHeight * 0.85f);
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(SPLean), false, CharacterOwner);
	if (World->LineTraceSingleByChannel(Hit, Head, Head + Right * (LeanDistance * LeanAlpha), ECC_Visibility, Params))
	{
		LeanAlpha = FMath::Clamp(Hit.Distance / FMath::Max(LeanDistance, 1.f), 0.f, LeanAlpha);
	}
}

void USPCharacterMovementComponent::SetStance(ESPStance NewStance)
{
	if (CurrentStance == NewStance)
	{
		return;
	}

	const ESPStance OldStance = CurrentStance;
	CurrentStance = NewStance;

	if (bCrouchIsToggle)
	{
		// Keep the engine crouch flag in sync for animation and nav.
		if (ACharacter* OwnerCharacter = CharacterOwner)
		{
			const bool bShouldCrouch = NewStance == ESPStance::Crouch
				|| NewStance == ESPStance::Prone
				|| NewStance == ESPStance::Slide;
			if (bShouldCrouch && !OwnerCharacter->bIsCrouched)
			{
				OwnerCharacter->Crouch();
			}
			else if (!bShouldCrouch && OwnerCharacter->bIsCrouched)
			{
				OwnerCharacter->UnCrouch();
			}
		}
	}

	OnStanceChanged.Broadcast(OldStance, NewStance);
	UE_LOG(LogShadowProtocol, Verbose, TEXT("Stance: %d -> %d"), (int32)OldStance, (int32)NewStance);
}

void USPCharacterMovementComponent::ResetMovementState()
{
	CurrentStance = ESPStance::Stand;
	Stamina = StaminaMax;
	bTacticalSprinting = false;
	bSprintIntent = false;
	SprintHeldTime = 0.f;
	LeanTarget = 0.f;
	LeanAlpha = 0.f;
	SlideTimeRemaining = 0.f;
	SlideCooldownRemaining = 0.f;
	bMantling = false;
	MantleAlpha = 0.f;
	Velocity = FVector::ZeroVector;
	ApplyCapsuleHeight(StandCapsuleHalfHeight);
}
