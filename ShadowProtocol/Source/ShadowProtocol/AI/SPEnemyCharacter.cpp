// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "AI/SPEnemyCharacter.h"
#include "AI/SPAIController.h"
#include "Weapons/SPWeaponData.h"
#include "Character/SPCharacter.h"
#include "Character/SPCharacterMovementComponent.h"
#include "Core/SPGameMode.h"

#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "Kismet/GameplayStatics.h"
#include "NiagaraFunctionLibrary.h"
#include "Perception/AISense_Hearing.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPEnemyCharacter::ASPEnemyCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryActorTick.bCanEverTick = true;

	AIControllerClass = ASPAIController::StaticClass();
	AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;

	GetCapsuleComponent()->InitCapsuleSize(36.f, 88.f);

	if (USkeletalMeshComponent* MeshComp = GetMesh())
	{
		MeshComp->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
		MeshComp->SetCollisionResponseToChannel(ECC_Pawn, ECR_Block);
		MeshComp->bCastDynamicShadow = true;
	}

	Health = MaxHealth;
}

void ASPEnemyCharacter::BeginPlay()
{
	Super::BeginPlay();
	Health = MaxHealth;

	if (ASPAIController* AI = Cast<ASPAIController>(GetController()))
	{
		if (BehaviorTreeAsset)
		{
			// Run the optional behaviour tree; the C++ state machine keeps
			// working underneath as the fallback and for perception bookkeeping.
			AI->RunBehaviorTree(BehaviorTreeAsset);
		}
	}
}

void ASPEnemyCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	FireCooldown = FMath::Max(0.f, FireCooldown - DeltaSeconds);
}

FVector ASPEnemyCharacter::GetEyeLocation() const
{
	return GetActorLocation() + FVector(0.f, 0.f, BaseEyeHeight);
}

void ASPEnemyCharacter::ConfigureForEra(ESPEra InEra)
{
	Era = InEra;

	// 1973 hostiles use period weapons; the asset swap is data-driven.
	UE_LOG(LogShadowProtocol, Verbose, TEXT("Enemy configured for era %d"), (int32)InEra);
}

float ASPEnemyCharacter::TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent,
	AController* EventInstigator, AActor* DamageCauser)
{
	if (bDead || DamageAmount <= 0.f)
	{
		return 0.f;
	}

	// Armour reduces body damage but never head damage (handled by the caller
	// already multiplying head damage before it reaches here).
	const float Absorbed = FMath::Min(ArmourValue, DamageAmount * 0.5f);
	const float Applied = DamageAmount - Absorbed;

	Health -= Applied;
	Super::TakeDamage(Applied, DamageEvent, EventInstigator, DamageCauser);

	if (ASPAIController* AI = Cast<ASPAIController>(GetController()))
	{
		AI->ApplySuppression(0.6f);

		// Instant retaliation: being shot is information, not stealth.
		AActor* Attacker = EventInstigator ? EventInstigator->GetPawn() : DamageCauser;
		if (Attacker)
		{
			AI->ReceiveAlert(Attacker->GetActorLocation(), Attacker);
		}
	}

	if (Health <= 0.f)
	{
		HandleDeath(DamageCauser, false);
	}

	return Applied;
}

void ASPEnemyCharacter::FireAtTarget(AActor* Target, bool bWillHit, float AimErrorDegrees)
{
	if (bDead || !Target || FireCooldown > 0.f)
	{
		return;
	}

	if (FVector::Dist(GetActorLocation(), Target->GetActorLocation()) > MaxEngagementRange)
	{
		return;
	}

	FireCooldown = 0.11f; // ~550 rpm burst cadence

	const FVector MuzzleLocation = GetMesh() ? GetMesh()->GetSocketLocation(MuzzleSocketName) : GetActorLocation();
	const FVector TargetPoint = Target->GetActorLocation() + FVector(0.f, 0.f, 40.f);

	// Suppressive near-miss even on a "miss" sample, so the player always feels
	// the fire without being cheated by it.
	FVector ShotDirection = (TargetPoint - MuzzleLocation).GetSafeNormal();
	if (!bWillHit)
	{
		const FRotator Scatter(0.f, FMath::FRandRange(-AimErrorDegrees, AimErrorDegrees) * 2.2f,
			FMath::FRandRange(-AimErrorDegrees, AimErrorDegrees) * 2.2f);
		ShotDirection = Scatter.RotateVector(ShotDirection);
	}

	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(SPEnemyFire), false, this);
	GetWorld()->LineTraceSingleByChannel(Hit, MuzzleLocation, MuzzleLocation + ShotDirection * MaxEngagementRange, ECC_Pawn, Params);

	if (MuzzleFX && GetMesh())
	{
		UNiagaraFunctionLibrary::SpawnSystemAttached(MuzzleFX, GetMesh(), MuzzleSocketName,
			FVector::ZeroVector, FRotator::ZeroRotator, EAttachLocation::SnapToTarget, true);
	}

	if (Hit.GetActor())
	{
		// Only apply damage to the player team.
		if (ASPCharacter* Player = Cast<ASPCharacter>(Hit.GetActor()))
		{
			if (bWillHit)
			{
				FDamageEvent DamageEvent;
				Player->TakeDamage(BaseDamage, DamageEvent, GetController(), this);

				if (Player->WeaponComponent)
				{
					Player->WeaponComponent->AddSuppression(0.25f);
				}
			}
			else
			{
				Player->WeaponComponent->AddSuppression(0.18f);
			}
		}
	}
	else if (ASPCharacter* Player = Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
	{
		// Check how close the miss passed to drive suppression.
		const FVector Closest = FMath::ClosestPointOnSegment(
			MuzzleLocation, MuzzleLocation + ShotDirection * MaxEngagementRange, Player->GetActorLocation());
		if (FVector::Dist(Closest, Player->GetActorLocation()) < 350.f)
		{
			Player->WeaponComponent->AddSuppression(0.12f);
		}
	}

	// Gunfire is loud: report it so allies converge.
	UAISense_Hearing::ReportNoiseEvent(GetWorld(), MuzzleLocation, 1.f, this, 4500.f, TEXT("EnemyGunshot"));
	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->NotifySoundEvent(MuzzleLocation, 4500.f, TEXT("EnemyGunshot"));
	}
}

void ASPEnemyCharacter::HandleDeath(AActor* Killer, bool bHeadshot)
{
	if (bDead)
	{
		return;
	}

	bDead = true;
	Health = 0.f;

	PlayDeath(bHeadshot);

	if (ASPAIController* AI = Cast<ASPAIController>(GetController()))
	{
		AI->SetAIState(ESPAIState::Dead);
		AI->UnPossess();
	}

	GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	SetLifeSpan(30.f);

	OnEnemyKilled.Broadcast(this, bHeadshot, Killer);

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->NotifyEnemyKilled(this, bHeadshot, Killer);
	}
}

void ASPEnemyCharacter::PlayDeath(bool bHeadshot)
{
	if (USkeletalMeshComponent* MeshComp = GetMesh())
	{
		MeshComp->SetCollisionEnabled(ECollisionEnabled::PhysicsOnly);
		MeshComp->SetSimulatePhysics(true);
		if (bHeadshot)
		{
			MeshComp->AddImpulse(FVector(0.f, 0.f, -400.f) + GetActorForwardVector() * 200.f, NAME_None, true);
		}
	}
}
