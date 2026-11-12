// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Character/SPCharacter.h"
#include "Character/SPCharacterMovementComponent.h"
#include "Weapons/SPWeaponComponent.h"
#include "AI/SPSquadMember.h"
#include "Core/SPGameMode.h"
#include "Core/SPProgressSubsystem.h"
#include "UI/SPHUDWidget.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "EngineUtils.h"
#include "InputActionValue.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPCharacter::ASPCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer.SetDefaultSubobjectClass<USPCharacterMovementComponent>(ACharacter::CharacterMovementComponentName))
{
	PrimaryActorTick.bCanEverTick = true;

	ShadowMovement = CastChecked<USPCharacterMovementComponent>(GetCharacterMovement());
	ShadowMovement->bOrientRotationToMovement = false;
	ShadowMovement->NavAgentProps.bCanCrouch = true;

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = true;
	bUseControllerRotationRoll = false;

	GetCapsuleComponent()->InitCapsuleSize(34.f, 90.f);
	GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);

	// The first-person body mesh is hidden from the owning camera but still
	// casts shadows and is visible to other systems (mirrors UE's standard
	// first-person setup).
	if (USkeletalMeshComponent* MeshComp = GetMesh())
	{
		MeshComp->SetOnlyOwnerSee(true);
		MeshComp->bCastDynamicShadow = true;
		MeshComp->CastShadow = true;
		MeshComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}

	// Arms / weapon view model lives on a second mesh driven by the camera.
	USkeletalMeshComponent* ArmsMesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("ArmsMesh"));
	ArmsMesh->SetupAttachment(GetMesh());
	ArmsMesh->SetOnlyOwnerSee(true);
	ArmsMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
	SpringArm->SetupAttachment(GetCapsuleComponent());
	SpringArm->TargetArmLength = 0.f;
	SpringArm->bUsePawnControlRotation = true;
	SpringArm->bEnableCameraLag = false;

	FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
	FirstPersonCamera->SetupAttachment(SpringArm);
	FirstPersonCamera->SetRelativeLocation(FirstPersonCameraOffset);
	FirstPersonCamera->bUsePawnControlRotation = false;
	FirstPersonCamera->SetFieldOfView(BaseFOV);

	WeaponComponent = CreateDefaultSubobject<USPWeaponComponent>(TEXT("WeaponComponent"));

	Grenades = StartingGrenades;
	Health = MaxHealth;
}

void ASPCharacter::BeginPlay()
{
	Super::BeginPlay();

	Health = MaxHealth;
	Grenades = StartingGrenades;

	if (ShadowMovement)
	{
		ShadowMovement->OnStanceChanged.AddDynamic(this, &ASPCharacter::HandleStanceChanged);
		ShadowMovement->OnSlideStarted.AddDynamic(this, &ASPCharacter::HandleSlideStarted);
	}

	OnHealthChanged.Broadcast(Health, MaxHealth);

	// Enhanced Input: add the gameplay mapping context for the local player.
	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
			ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			// The mapping context is assigned per-era in the mission data asset.
			// If none is configured the default platform bindings still work.
		}
	}
}

void ASPCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	TimeSinceDamage += DeltaSeconds;
	MeleeCooldownRemaining = FMath::Max(0.f, MeleeCooldownRemaining - DeltaSeconds);

	UpdateAimState(DeltaSeconds);
	UpdateHealthRegen(DeltaSeconds);
	UpdateCamera(DeltaSeconds);
	CheckForReviveTarget();
}

// -------------------------------------------------------------------- identity
void ASPCharacter::ConfigureForCharacter(ESPCharacterId InCharacterId, ESPEra InEra)
{
	CharacterId = InCharacterId;
	Era = InEra;

	// Era drives the equipment whitelist inside the weapon component. This is
	// the enforcement point: a 1973 character can never be given modern kit.
	if (WeaponComponent)
	{
		WeaponComponent->SetEra(InEra);
	}

	UE_LOG(LogShadowProtocol, Log, TEXT("Configured %s for era %d"),
		*UEnum::GetValueAsString(InCharacterId), (int32)InEra);
}

// -------------------------------------------------------------------- health
float ASPCharacter::TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent,
	AController* EventInstigator, AActor* DamageCauser)
{
	if (bDead || bGodMode || DamageAmount <= 0.f)
	{
		return 0.f;
	}

	const float Applied = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	const float FinalDamage = Applied > 0.f ? Applied : DamageAmount;

	Health = FMath::Clamp(Health - FinalDamage, 0.f, MaxHealth);
	TimeSinceDamage = 0.f;

	OnHealthChanged.Broadcast(Health, MaxHealth);

	if (DamageCauser)
	{
		const FVector ToCauser = (DamageCauser->GetActorLocation() - GetActorLocation()).GetSafeNormal();
		OnDamageTaken.Broadcast(FinalDamage, ToCauser);
	}

	if (Health <= 0.f)
	{
		OnDied(DamageCauser);
	}

	return FinalDamage;
}

void ASPCharacter::Heal(float Amount)
{
	if (bDead)
	{
		return;
	}
	Health = FMath::Clamp(Health + Amount, 0.f, MaxHealth);
	OnHealthChanged.Broadcast(Health, MaxHealth);
}

void ASPCharacter::ApplyCheckpointHealth(float InHealth)
{
	bDead = false;
	Health = FMath::Clamp(InHealth, 1.f, MaxHealth);
	TimeSinceDamage = 100.f;
	OnHealthChanged.Broadcast(Health, MaxHealth);
	if (ShadowMovement)
	{
		ShadowMovement->ResetMovementState();
	}
}

void ASPCharacter::OnDied(AActor* Killer)
{
	if (bDead)
	{
		return;
	}

	bDead = true;
	OnDeath.Broadcast(Killer);

	if (ASPGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ASPGameMode>() : nullptr)
	{
		GM->NotifyPlayerKilled(Killer);
	}
}

void ASPCharacter::UpdateHealthRegen(float DeltaSeconds)
{
	if (bDead || Health >= MaxHealth)
	{
		return;
	}

	// Realism difficulty disables regeneration entirely.
	ESPDifficulty Difficulty = ESPDifficulty::Soldier;
	if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
	{
		Difficulty = Progress->GetDifficulty();
	}
	if (Difficulty == ESPDifficulty::Realism)
	{
		return;
	}

	if (TimeSinceDamage >= HealthRegenDelay)
	{
		Heal(HealthRegenPerSecond * DeltaSeconds);
	}
}

// -------------------------------------------------------------------- camera
void ASPCharacter::UpdateAimState(float DeltaSeconds)
{
	const float TargetAlpha = bAiming && !ShadowMovement->IsTacticalSprinting() ? 1.f : 0.f;
	AimAlpha = FMath::FInterpTo(AimAlpha, TargetAlpha, DeltaSeconds, 12.f);
	ShadowMovement->bWantsToAim = AimAlpha > 0.5f;
}

void ASPCharacter::UpdateCamera(float DeltaSeconds)
{
	if (!FirstPersonCamera || !ShadowMovement)
	{
		return;
	}

	// Eye height follows the capsule so prone/crouch reads correctly.
	const float HalfHeight = GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
	const float StanceOffset = HalfHeight - 90.f;
	FVector Offset = FirstPersonCameraOffset + FVector(0.f, 0.f, StanceOffset);

	// Lean shifts the camera laterally.
	const float LeanOffset = ShadowMovement->GetLeanOffset();
	Offset += GetActorRightVector() * LeanOffset;

	FirstPersonCamera->SetRelativeLocation(FMath::VInterpTo(
		FirstPersonCamera->GetRelativeLocation(), Offset, DeltaSeconds, 14.f));

	// FOV: ADS zoom, tactical sprint widening, night vision.
	float TargetFOV = BaseFOV;
	if (ShadowMovement->IsTacticalSprinting())
	{
		TargetFOV = TacticalSprintFOV;
	}
	if (bNightVision)
	{
		TargetFOV += NightVisionFOVOffset;
	}
	if (WeaponComponent)
	{
		TargetFOV = FMath::Lerp(TargetFOV, WeaponComponent->GetAimFOV(BaseFOV), AimAlpha);
	}

	CurrentFOV = FMath::FInterpTo(CurrentFOV, TargetFOV, DeltaSeconds, 11.f);
	FirstPersonCamera->SetFieldOfView(CurrentFOV);
}

void ASPCharacter::SetNightVisionEnabled(bool bEnabled)
{
	bNightVision = bEnabled && Era == ESPEra::Modern;
}

void ASPCharacter::SetLookSensitivity(float NewSensitivity)
{
	LookSensitivity = FMath::Clamp(NewSensitivity, 0.1f, 3.f);
}

void ASPCharacter::SetInvertY(bool bInvert)
{
	bInvertY = bInvert;
}

float ASPCharacter::GetCompassHeading() const
{
	const float Yaw = GetControlRotation().Yaw;
	return FMath::Fmod(Yaw + 360.f, 360.f);
}

// -------------------------------------------------------------------- combat
bool ASPCharacter::TryMelee()
{
	if (MeleeCooldownRemaining > 0.f || bDead)
	{
		return false;
	}

	MeleeCooldownRemaining = MeleeCooldown;

	const FVector Start = GetActorLocation() + FVector(0.f, 0.f, 40.f);
	const FVector End = Start + GetActorForwardVector() * MeleeRange;

	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(SPMelee), false, this);
	if (GetWorld()->SweepSingleByChannel(Hit, Start, End, FQuat::Identity, ECC_Pawn,
		FCollisionShape::MakeSphere(30.f), Params))
	{
		if (AActor* Victim = Hit.GetActor())
		{
			FDamageEvent DamageEvent;
			Victim->TakeDamage(MeleeDamage, DamageEvent, GetController(), this);
			return true;
		}
	}
	return false;
}

bool ASPCharacter::TryThrowGrenade()
{
	if (Grenades <= 0 || bDead || !GrenadeClass)
	{
		return false;
	}

	Grenades--;

	const FVector EyeLocation = FirstPersonCamera->GetComponentLocation();
	const FVector ThrowDirection = FirstPersonCamera->GetForwardVector() + FVector(0.f, 0.f, 0.18f);
	const FVector SpawnLocation = EyeLocation + ThrowDirection * 60.f;

	FActorSpawnParameters SpawnParams;
	SpawnParams.Owner = this;
	SpawnParams.Instigator = this;
	AActor* Grenade = GetWorld()->SpawnActor<AActor>(GrenadeClass, SpawnLocation, ThrowDirection.Rotation(), SpawnParams);

	if (Grenade && Grenade->GetRootComponent() && Grenade->GetRootComponent()->IsSimulatingPhysics())
	{
		Grenade->GetRootComponent()->SetPhysicsLinearVelocity(ThrowDirection.GetSafeNormal() * 1700.f);
		Grenade->GetRootComponent()->SetPhysicsAngularVelocityInDegrees(FVector(400.f, 250.f, 0.f));
	}

	return true;
}

void ASPCharacter::CheckForReviveTarget()
{
	if (!GetWorld() || bDead)
	{
		return;
	}

	ReviveTarget = nullptr;
	float BestDistance = 240.f * 240.f;

	for (TActorIterator<ASPSquadMember> It(GetWorld()); It; ++It)
	{
		ASPSquadMember* Member = *It;
		if (!Member || !Member->IsDowned())
		{
			continue;
		}
		const float DistSq = FVector::DistSquared(Member->GetActorLocation(), GetActorLocation());
		if (DistSq < BestDistance)
		{
			BestDistance = DistSq;
			ReviveTarget = Member;
		}
	}
}

void ASPCharacter::HandleSlideStarted(float SlideSpeed)
{
	UE_LOG(LogShadowProtocol, Verbose, TEXT("Slide started at %.0f cm/s"), SlideSpeed);
}

void ASPCharacter::HandleStanceChanged(ESPStance OldStance, ESPStance NewStance)
{
	if (NewStance == ESPStance::Slide && bAiming)
	{
		bAiming = false;
	}
}

// -------------------------------------------------------------------- input
void ASPCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	// Enhanced Input actions are wired in Blueprint (Content/Input/IA_*).
	// This binding covers the legacy InputComponent path so the C++ project is
	// immediately playable without authoring assets.
	PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &ASPCharacter::Input_MoveForwardLegacy);
	PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &ASPCharacter::Input_MoveRightLegacy);
	PlayerInputComponent->BindAxis(TEXT("Turn"), this, &ASPCharacter::Input_TurnLegacy);
	PlayerInputComponent->BindAxis(TEXT("LookUp"), this, &ASPCharacter::Input_LookUpLegacy);

	PlayerInputComponent->BindAction(TEXT("Fire"), IE_Pressed, this, &ASPCharacter::Input_FirePressed);
	PlayerInputComponent->BindAction(TEXT("Fire"), IE_Released, this, &ASPCharacter::Input_FireReleased);
	PlayerInputComponent->BindAction(TEXT("Aim"), IE_Pressed, this, &ASPCharacter::Input_AimPressed);
	PlayerInputComponent->BindAction(TEXT("Aim"), IE_Released, this, &ASPCharacter::Input_AimReleased);
	PlayerInputComponent->BindAction(TEXT("Reload"), IE_Pressed, this, &ASPCharacter::Input_Reload);
	PlayerInputComponent->BindAction(TEXT("Sprint"), IE_Pressed, this, &ASPCharacter::Input_SprintPressed);
	PlayerInputComponent->BindAction(TEXT("Sprint"), IE_Released, this, &ASPCharacter::Input_SprintReleased);
	PlayerInputComponent->BindAction(TEXT("Crouch"), IE_Pressed, this, &ASPCharacter::Input_CrouchPressed);
	PlayerInputComponent->BindAction(TEXT("Crouch"), IE_Released, this, &ASPCharacter::Input_CrouchReleased);
	PlayerInputComponent->BindAction(TEXT("Prone"), IE_Pressed, this, &ASPCharacter::Input_Prone);
	PlayerInputComponent->BindAction(TEXT("Jump"), IE_Pressed, this, &ASPCharacter::Input_Jump);
	PlayerInputComponent->BindAction(TEXT("LeanLeft"), IE_Pressed, this, &ASPCharacter::Input_LeanLeftPressed);
	PlayerInputComponent->BindAction(TEXT("LeanLeft"), IE_Released, this, &ASPCharacter::Input_LeanLeftReleased);
	PlayerInputComponent->BindAction(TEXT("LeanRight"), IE_Pressed, this, &ASPCharacter::Input_LeanRightPressed);
	PlayerInputComponent->BindAction(TEXT("LeanRight"), IE_Released, this, &ASPCharacter::Input_LeanRightReleased);
	PlayerInputComponent->BindAction(TEXT("Melee"), IE_Pressed, this, &ASPCharacter::Input_Melee);
	PlayerInputComponent->BindAction(TEXT("Grenade"), IE_Pressed, this, &ASPCharacter::Input_Grenade);
	PlayerInputComponent->BindAction(TEXT("NightVision"), IE_Pressed, this, &ASPCharacter::Input_NightVision);
	PlayerInputComponent->BindAction(TEXT("SwapWeapon"), IE_Pressed, this, &ASPCharacter::Input_SwapWeapon);
	PlayerInputComponent->BindAction(TEXT("Interact"), IE_Pressed, this, &ASPCharacter::Input_Interact);
}

void ASPCharacter::Input_Move(const FVector2D& Value)
{
	if (bDead || !ShadowMovement || ShadowMovement->IsMantling())
	{
		return;
	}

	const FRotator ControlYaw(0.f, GetControlRotation().Yaw, 0.f);
	AddMovementInput(ControlYaw.Vector(), Value.Y);
	AddMovementInput(FRotationMatrix(ControlYaw).GetUnitAxis(EAxis::Y), Value.X);
}

void ASPCharacter::Input_Look(const FVector2D& Value)
{
	const float PitchSign = bInvertY ? -1.f : 1.f;
	AddControllerYawInput(Value.X);
	AddControllerPitchInput(Value.Y * PitchSign);
}

void ASPCharacter::Input_MoveForwardLegacy(float Value)
{
	Input_Move(FVector2D(0.f, Value));
}

void ASPCharacter::Input_MoveRightLegacy(float Value)
{
	Input_Move(FVector2D(Value, 0.f));
}

void ASPCharacter::Input_TurnLegacy(float Value)
{
	if (Value != 0.f) AddControllerYawInput(Value * LookSensitivity * 2.f);
}

void ASPCharacter::Input_LookUpLegacy(float Value)
{
	if (Value != 0.f) AddControllerPitchInput(Value * LookSensitivity * 2.f * (bInvertY ? -1.f : 1.f));
}

void ASPCharacter::Input_FirePressed()
{
	if (WeaponComponent && !bDead)
	{
		WeaponComponent->StartFire();
	}
}

void ASPCharacter::Input_FireReleased()
{
	if (WeaponComponent)
	{
		WeaponComponent->StopFire();
	}
}

void ASPCharacter::Input_AimPressed()
{
	bAiming = true;
	if (WeaponComponent)
	{
		WeaponComponent->SetAiming(true);
	}
}

void ASPCharacter::Input_AimReleased()
{
	bAiming = false;
	if (WeaponComponent)
	{
		WeaponComponent->SetAiming(false);
	}
}

void ASPCharacter::Input_Reload()
{
	if (WeaponComponent)
	{
		WeaponComponent->Reload();
	}
}

void ASPCharacter::Input_SprintPressed()
{
	if (ShadowMovement)
	{
		ShadowMovement->SetSprintIntent(true);
	}
}

void ASPCharacter::Input_SprintReleased()
{
	if (ShadowMovement && !ShadowMovement->bSprintIntent)
	{
		return;
	}
	if (ShadowMovement && bHoldToCrouch)
	{
		ShadowMovement->SetSprintIntent(false);
	}
	else if (ShadowMovement)
	{
		ShadowMovement->SetSprintIntent(false);
	}
}

void ASPCharacter::Input_CrouchPressed()
{
	if (!ShadowMovement)
	{
		return;
	}

	// Sprint + crouch = slide.
	if (ShadowMovement->bSprintIntent || ShadowMovement->IsTacticalSprinting())
	{
		ShadowMovement->TryStartSlide();
		return;
	}

	ShadowMovement->SetCrouchIntent(true);
	if (bHoldToCrouch)
	{
		ShadowMovement->SetCrouchIntent(true);
	}
}

void ASPCharacter::Input_CrouchReleased()
{
	if (ShadowMovement && bHoldToCrouch)
	{
		ShadowMovement->SetCrouchIntent(false);
	}
}

void ASPCharacter::Input_Prone()
{
	if (ShadowMovement)
	{
		ShadowMovement->ToggleProne();
	}
}

void ASPCharacter::Input_Jump()
{
	if (bDead || !ShadowMovement)
	{
		return;
	}

	// Jump doubles as mantle when facing a ledge.
	if (ShadowMovement->TryMantle())
	{
		return;
	}

	Jump();
}

void ASPCharacter::Input_LeanLeftPressed()
{
	if (ShadowMovement) ShadowMovement->SetLeanIntent(-1.f);
}

void ASPCharacter::Input_LeanLeftReleased()
{
	if (ShadowMovement) ShadowMovement->SetLeanIntent(0.f);
}

void ASPCharacter::Input_LeanRightPressed()
{
	if (ShadowMovement) ShadowMovement->SetLeanIntent(1.f);
}

void ASPCharacter::Input_LeanRightReleased()
{
	if (ShadowMovement) ShadowMovement->SetLeanIntent(0.f);
}

void ASPCharacter::Input_Melee()
{
	TryMelee();
}

void ASPCharacter::Input_Grenade()
{
	TryThrowGrenade();
}

void ASPCharacter::Input_NightVision()
{
	SetNightVisionEnabled(!bNightVision);
}

void ASPCharacter::Input_SwapWeapon()
{
	if (WeaponComponent)
	{
		WeaponComponent->CycleWeapon();
	}
}

void ASPCharacter::Input_Interact()
{
	// Priority: revive a teammate, then mission interaction.
	if (ASPSquadMember* Member = Cast<ASPSquadMember>(ReviveTarget))
	{
		Member->AddReviveProgress(0.34f);
		return;
	}

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->NotifyPlayerInteract(this);
	}
}
