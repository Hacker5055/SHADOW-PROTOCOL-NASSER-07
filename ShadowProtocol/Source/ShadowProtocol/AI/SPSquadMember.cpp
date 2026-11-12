// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "AI/SPSquadMember.h"
#include "AI/SPEnemyCharacter.h"
#include "AI/SPAIController.h"
#include "Character/SPCharacter.h"
#include "Weapons/SPWeaponData.h"
#include "Core/SPGameMode.h"
#include "Core/SPProgressSubsystem.h"

#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Kismet/GameplayStatics.h"
#include "NiagaraFunctionLibrary.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPSquadMember::ASPSquadMember(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryActorTick.bCanEverTick = true;

	AIControllerClass = AAIController::StaticClass();
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;

	GetCapsuleComponent()->InitCapsuleSize(34.f, 88.f);

	Health = MaxHealth;
	Callsign = NSLOCTEXT("ShadowSquad", "Fang", "FANG");
}

void ASPSquadMember::BeginPlay()
{
	Super::BeginPlay();
	Health = MaxHealth;
	bDowned = false;
	bKilled = false;
}

void ASPSquadMember::ConfigureIdentity(ESPCharacterId InCharacter, ESPEra InEra, const FText& InCallsign)
{
	CharacterId = InCharacter;
	Era = InEra;
	Callsign = InCallsign;
}

void ASPSquadMember::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	TimeSinceChatter += DeltaSeconds;
	FireCooldown = FMath::Max(0.f, FireCooldown - DeltaSeconds);

	if (bKilled)
	{
		return;
	}

	if (bDowned)
	{
		UpdateDowned(DeltaSeconds);
		return;
	}

	UpdateFollow(DeltaSeconds);
	UpdateCombat(DeltaSeconds);
}

void ASPSquadMember::IssueOrder(ESPSquadOrder NewOrder, const FVector& Destination)
{
	CurrentOrder = NewOrder;
	OrderDestination = Destination;

	switch (NewOrder)
	{
	case ESPSquadOrder::Hold:
		Say(NSLOCTEXT("ShadowSquad", "Holding", "Holding this position."));
		break;
	case ESPSquadOrder::MoveTo:
		Say(NSLOCTEXT("ShadowSquad", "Moving", "Moving."));
		break;
	case ESPSquadOrder::Breach:
		Say(NSLOCTEXT("ShadowSquad", "Breaching", "Stacking on the door. Breaching."));
		break;
	case ESPSquadOrder::Recon:
		Say(NSLOCTEXT("ShadowSquad", "Recon", "Going for a look. Cover me."));
		break;
	default:
		break;
	}
}

void ASPSquadMember::SetFormationSlot(int32 SlotIndex, const FVector& Offset)
{
	FormationOffset = Offset;
	(void)SlotIndex;
}

// -------------------------------------------------------------------- movement
void ASPSquadMember::UpdateFollow(float DeltaSeconds)
{
	const ASPCharacter* Player = Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!Player)
	{
		return;
	}

	FVector Target;

	if (CurrentOrder == ESPSquadOrder::Hold)
	{
		Target = OrderDestination;
	}
	else if (CurrentOrder == ESPSquadOrder::MoveTo
		|| CurrentOrder == ESPSquadOrder::Breach
		|| CurrentOrder == ESPSquadOrder::Recon)
	{
		Target = OrderDestination;
		if (FVector::Dist2D(GetActorLocation(), Target) < 240.f)
		{
			CurrentOrder = ESPSquadOrder::Hold;
		}
	}
	else
	{
		// Formation slot: behind and beside the player, rotated with their facing.
		const FRotator PlayerYaw(0.f, Player->GetActorRotation().Yaw, 0.f);
		Target = Player->GetActorLocation() + PlayerYaw.RotateVector(FormationOffset);
	}

	const float Distance = FVector::Dist2D(GetActorLocation(), Target);
	if (Distance > (CurrentOrder == ESPSquadOrder::Hold ? 80.f : 140.f))
	{
		const float Speed = Distance > FormationCatchUpDistance ? FollowSpeed * 1.35f : FollowSpeed;
		MoveTowards(Target, Speed, DeltaSeconds);
	}
}

void ASPSquadMember::MoveTowards(const FVector& Target, float Speed, float DeltaSeconds)
{
	const FVector Delta = FVector(Target.X - GetActorLocation().X, Target.Y - GetActorLocation().Y, 0.f);
	if (Delta.SizeSquared() < 100.f)
	{
		return;
	}

	const FVector Direction = Delta.GetSafeNormal();
	const FVector NewLocation = GetActorLocation() + Direction * Speed * DeltaSeconds;

	// Use the navigation system when a navmesh exists, otherwise fall back to
	// straight-line movement with a sweep so members never tunnel through walls.
	if (AAIController* AI = Cast<AAIController>(GetController()))
	{
		// Re-issuing a path request every frame would stall the nav system, so
		// only ask again when the destination has actually moved.
		if (FVector::DistSquared(CachedMoveGoal, Target) > FMath::Square(120.f))
		{
			CachedMoveGoal = Target;
			AI->MoveToLocation(Target, 80.f, true, true, false, true, nullptr, true);
		}
	}
	else
	{
		// No navmesh (or not possessed yet): move directly with a sweep so a
		// squad member can never tunnel through geometry.
		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(SPSquadMove), false, this);
		if (!GetWorld()->SweepSingleByChannel(Hit, GetActorLocation(), NewLocation, FQuat::Identity,
			ECC_Pawn, FCollisionShape::MakeCapsule(34.f, 88.f), Params))
		{
			SetActorLocation(NewLocation);
		}
	}

	// Face the direction of travel. The AI controller normally drives rotation,
	// but the fallback path needs it explicitly, and it costs nothing either way.
	const FRotator Desired(0.f, Direction.Rotation().Yaw, 0.f);
	SetActorRotation(FMath::RInterpTo(GetActorRotation(), Desired, DeltaSeconds, 6.f));
}

// -------------------------------------------------------------------- combat
AActor* ASPSquadMember::FindBestTarget() const
{
	AActor* Best = nullptr;
	float BestScore = TNumericLimits<float>::Max();

	for (TActorIterator<ASPEnemyCharacter> It(GetWorld()); It; ++It)
	{
		ASPEnemyCharacter* Enemy = *It;
		if (!Enemy || Enemy->IsDead())
		{
			continue;
		}

		const float Distance = FVector::Dist(GetActorLocation(), Enemy->GetActorLocation());
		if (Distance > EngagementRange)
		{
			continue;
		}

		FCollisionQueryParams Params(SCENE_QUERY_STAT(SPSquadLOS), false, this);
		FHitResult Hit;
		if (GetWorld()->LineTraceSingleByChannel(Hit, GetEyeLocation(), Enemy->GetEyeLocation(), ECC_Visibility, Params))
		{
			if (Hit.GetActor() != Enemy)
			{
				continue;
			}
		}

		// Prefer the closest enemy, but weight threats aiming at the player.
		const float Score = Distance;
		if (Score < BestScore)
		{
			BestScore = Score;
			Best = Enemy;
		}
	}

	(void)BestScore;
	return Best;
}

void ASPSquadMember::UpdateCombat(float DeltaSeconds)
{
	AActor* Target = FindBestTarget();
	if (!Target)
	{
		// Fall back to formation if nothing to shoot.
		return;
	}

	// Face and shoot.
	const FVector ToTarget = (Target->GetActorLocation() - GetActorLocation()).GetSafeNormal2D();
	SetActorRotation(FMath::RInterpTo(GetActorRotation(), ToTarget.Rotation(), DeltaSeconds, 8.f));

	if (FireCooldown <= 0.f)
	{
		FireAt(Target);
		FireCooldown = 0.15f + FMath::FRandRange(0.f, 0.18f);
	}

	// Keep moving toward the player's formation slot while shooting, so the
	// squad never turns into a static turret line.
	if (CurrentOrder == ESPSquadOrder::Follow)
	{
		UpdateFollow(DeltaSeconds);
	}
}

void ASPSquadMember::FireAt(AActor* Target)
{
	if (!Target)
	{
		return;
	}

	const float Roll = FMath::FRand();
	const bool bHit = Roll < Accuracy;

	const FVector Muzzle = GetMesh() ? GetMesh()->GetSocketLocation(MuzzleSocketName) : GetActorLocation();
	const FVector AimPoint = Target->GetActorLocation() + FVector(0.f, 0.f, 30.f);

	FVector Direction = (AimPoint - Muzzle).GetSafeNormal();
	if (!bHit)
	{
		const FRotator Scatter(0.f, FMath::FRandRange(-2.4f, 2.4f), FMath::FRandRange(-2.4f, 2.4f));
		Direction = Scatter.RotateVector(Direction);
	}

	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(SPSquadFire), false, this);
	GetWorld()->LineTraceSingleByChannel(Hit, Muzzle, Muzzle + Direction * EngagementRange, ECC_Pawn, Params);

	if (MuzzleFX && GetMesh())
	{
		UNiagaraFunctionLibrary::SpawnSystemAttached(MuzzleFX, GetMesh(), MuzzleSocketName,
			FVector::ZeroVector, FRotator::ZeroRotator, EAttachLocation::SnapToTarget, true);
	}

	if (bHit && Hit.GetActor() == Target)
	{
		FDamageEvent DamageEvent;
		Target->TakeDamage(DamagePerShot + FMath::FRandRange(-4.f, 12.f), DamageEvent, GetController(), this);
	}
	else if (ASPEnemyCharacter* Enemy = Cast<ASPEnemyCharacter>(Hit.GetActor()))
	{
		// Even a miss that strikes nearby suppresses the target.
		if (ASPAIController* AI = Cast<ASPAIController>(Enemy->GetController()))
		{
			AI->ApplySuppression(0.22f);
		}
	}
}

// -------------------------------------------------------------------- damage
float ASPSquadMember::TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent,
	AController* EventInstigator, AActor* DamageCauser)
{
	if (bKilled || bDowned || DamageAmount <= 0.f)
	{
		return 0.f;
	}

	Health = FMath::Max(0.f, Health - DamageAmount);
	Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);

	if (Health <= 0.f)
	{
		HandleDowned();
	}

	return DamageAmount;
}

void ASPSquadMember::HandleDowned()
{
	if (bDowned || bKilled)
	{
		return;
	}

	bDowned = true;
	bKilled = false;
	ReviveProgress = 0.f;
	DownedTime = 0.f;

	Say(NSLOCTEXT("ShadowSquad", "ManDown", "I'm hit! I'm down — I need a hand!"), true);
	OnSquadMemberStateChanged.Broadcast(this);

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->NotifySquadMemberDowned(this);
	}
}

void ASPSquadMember::UpdateDowned(float DeltaSeconds)
{
	DownedTime += DeltaSeconds;

	// Bleed-out timer. Revive progress decays when nobody is helping.
	ReviveProgress = FMath::Max(0.f, ReviveProgress - DeltaSeconds * 0.2f);

	const ASPCharacter* Player = Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	const bool bPlayerHelping = Player && FVector::Dist2D(Player->GetActorLocation(), GetActorLocation()) < 260.f;

	ESPDifficulty Difficulty = ESPDifficulty::Soldier;
	if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
	{
		Difficulty = Progress->GetDifficulty();
	}

	const float Limit = Difficulty == ESPDifficulty::Realism ? DownedDeathSecondsRealism : BleedOutSeconds;

	if (DownedTime >= Limit && !bPlayerHelping)
	{
		HandleKilled();
	}
}

void ASPSquadMember::AddReviveProgress(float Amount)
{
	if (!bDowned || bKilled)
	{
		return;
	}

	ReviveProgress = FMath::Clamp(ReviveProgress + Amount, 0.f, 1.f);
	if (ReviveProgress >= 1.f)
	{
		bDowned = false;
		Health = MaxHealth * 0.45f;
		DownedTime = 0.f;
		Say(NSLOCTEXT("ShadowSquad", "BackUp", "I'm up. Thanks, boss."));
		OnSquadMemberStateChanged.Broadcast(this);

		if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
		{
			GM->NotifySquadMemberRevived(this);
		}
	}
}

void ASPSquadMember::HandleKilled()
{
	if (bKilled)
	{
		return;
	}

	bKilled = true;
	bDowned = false;
	Health = 0.f;

	GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	if (USkeletalMeshComponent* MeshComp = GetMesh())
	{
		MeshComp->SetCollisionEnabled(ECollisionEnabled::PhysicsOnly);
		MeshComp->SetSimulatePhysics(true);
	}

	OnSquadMemberStateChanged.Broadcast(this);

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->NotifySquadMemberKilled(this);
	}

	UE_LOG(LogShadowProtocol, Warning, TEXT("Squad member %s KIA — permanent loss recorded."), *Callsign.ToString());
}

void ASPSquadMember::Say(const FText& Text, bool bRadio)
{
	if (TimeSinceChatter < 1.4f && bRadio)
	{
		return;
	}
	TimeSinceChatter = 0.f;
	OnSquadChatter.Broadcast(this, Text);

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->PushSubtitle(Callsign, Text, bRadio);
	}
}

FVector ASPSquadMember::GetEyeLocation() const
{
	return GetActorLocation() + FVector(0.f, 0.f, BaseEyeHeight);
}
