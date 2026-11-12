// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "AI/SPAIController.h"
#include "AI/SPEnemyCharacter.h"
#include "AI/SPSquadMember.h"
#include "Character/SPCharacter.h"
#include "Core/SPGameMode.h"

#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Sight.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "Perception/AISense_Sight.h"
#include "Perception/AISense_Hearing.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "Navigation/PathFollowingComponent.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "ShadowProtocol.h"

ASPAIController::ASPAIController(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryActorTick.bCanEverTick = true;

	AIPerception = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("AIPerception"));
	SetPerceptionComponent(*AIPerception);

	SightConfig = CreateDefaultSubobject<UAISenseConfig_Sight>(TEXT("SightConfig"));
	HearingConfig = CreateDefaultSubobject<UAISenseConfig_Hearing>(TEXT("HearingConfig"));

	AIPerception->OnTargetPerceptionUpdated.AddDynamic(this, &ASPAIController::OnTargetPerceptionUpdated);
	AIPerception->OnTargetPerceptionForgotten.AddDynamic(this, &ASPAIController::OnPerceptionForgotten);
}

void ASPAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);

	ControlledEnemy = Cast<ASPEnemyCharacter>(InPawn);
	ConfigurePerception();

	AIPerception->Activate();
	SetGenericTeamId(FGenericTeamId(1)); // 0 = player team, 1 = hostiles

	UE_LOG(LogShadowProtocol, Verbose, TEXT("%s possessed by hostiles controller"), *GetNameSafe(InPawn));
}

void ASPAIController::OnUnPossess()
{
	if (AIPerception)
	{
		AIPerception->Deactivate();
	}
	ControlledEnemy = nullptr;
	Super::OnUnPossess();
}

void ASPAIController::ConfigurePerception()
{
	if (!AIPerception || !SightConfig || !HearingConfig)
	{
		return;
	}

	SightConfig->SightRadius = Perception.SightRadius;
	SightConfig->LoseSightRadius = Perception.LoseSightRadius;
	SightConfig->PeripheralVisionAngleDegrees = Perception.PeripheralVisionAngle;
	SightConfig->SetMaxAge(8.f);
	SightConfig->DetectionByAffiliation.bDetectEnemies = true;
	SightConfig->DetectionByAffiliation.bDetectNeutrals = true;
	SightConfig->DetectionByAffiliation.bDetectFriendlies = false;

	HearingConfig->HearingRange = Perception.HearingRange;
	HearingConfig->SetMaxAge(6.f);
	HearingConfig->DetectionByAffiliation.bDetectEnemies = true;
	HearingConfig->DetectionByAffiliation.bDetectNeutrals = true;
	HearingConfig->DetectionByAffiliation.bDetectFriendlies = false;

	AIPerception->ConfigureSense(*SightConfig);
	AIPerception->ConfigureSense(*HearingConfig);
	AIPerception->SetDominantSense(SightConfig->GetSenseImplementation());
}

void ASPAIController::ApplyDifficulty(ESPDifficulty Difficulty)
{
	switch (Difficulty)
	{
	case ESPDifficulty::Recruit:
		Perception.SightRadius = 3400.f;
		Perception.LoseSightRadius = 4600.f;
		Perception.PeripheralVisionAngle = 55.f;
		Perception.ReactionTimeSeconds = 0.85f;
		Perception.AimErrorDegrees = 5.5f;
		Perception.HearingRange = 2600.f;
		break;

	case ESPDifficulty::Veteran:
		Perception.SightRadius = 6600.f;
		Perception.LoseSightRadius = 8200.f;
		Perception.PeripheralVisionAngle = 76.f;
		Perception.ReactionTimeSeconds = 0.32f;
		Perception.AimErrorDegrees = 2.4f;
		Perception.HearingRange = 4400.f;
		break;

	case ESPDifficulty::Realism:
		Perception.SightRadius = 7800.f;
		Perception.LoseSightRadius = 9600.f;
		Perception.PeripheralVisionAngle = 84.f;
		Perception.ReactionTimeSeconds = 0.22f;
		Perception.AimErrorDegrees = 1.7f;
		Perception.HearingRange = 5500.f;
		break;

	case ESPDifficulty::Soldier:
	default:
		break;
	}

	ConfigurePerception();
}

void ASPAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	TimeSinceShout += DeltaSeconds;
	FireCooldown = FMath::Max(0.f, FireCooldown - DeltaSeconds);

	UpdatePerception(DeltaSeconds);
	UpdateSuppression(DeltaSeconds);
	TickStateMachine(DeltaSeconds);
}

// -------------------------------------------------------------------- perception
void ASPAIController::UpdatePerception(float DeltaSeconds)
{
	ASPCharacter* Player = Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!Player || !Player->IsAlive())
	{
		bCanSeePlayer = false;
		Awareness = FMath::Max(0.f, Awareness - AwarenessDecayRate * DeltaSeconds);
		return;
	}

	// LOS + cone + distance is authoritative; the perception component supplies
	// the stimulus but we re-validate so that a stale stimulus cannot make an
	// enemy omniscient.
	bCanSeePlayer = false;

	if (ControlledEnemy)
	{
		const FVector EyeLocation = ControlledEnemy->GetEyeLocation();
		const FVector TargetLocation = Player->GetActorLocation() + FVector(0.f, 0.f, Player->BaseEyeHeight * 0.8f);
		const float Distance = FVector::Dist(EyeLocation, TargetLocation);

		float EffectiveSight = Perception.SightRadius;
		if (Player->ShadowMovement)
		{
			// A prone or crouched player presents less of a silhouette.
			EffectiveSight *= Player->ShadowMovement->GetStance() == ESPStance::Prone ? 0.55f
				: Player->ShadowMovement->GetStance() == ESPStance::Crouch ? 0.82f : 1.f;
		}
		if (Player->IsNightVisionEnabled())
		{
			// NVG use makes the wearer easier to spot from a distance.
			EffectiveSight *= 0.9f;
		}

		if (Distance <= EffectiveSight)
		{
			const FVector ToTarget = (TargetLocation - EyeLocation).GetSafeNormal();
			const float Dot = FVector::DotProduct(ControlledEnemy->GetActorForwardVector(), ToTarget);
			const float CosLimit = FMath::Cos(FMath::DegreesToRadians(Perception.PeripheralVisionAngle));

			if (Dot >= CosLimit || Awareness > 0.75f)
			{
				FCollisionQueryParams Params(SCENE_QUERY_STAT(SPAIVision), false, ControlledEnemy);
				FHitResult Hit;
				const bool bBlocked = GetWorld()->LineTraceSingleByChannel(
					Hit, EyeLocation, TargetLocation, ECC_Visibility, Params);
				bCanSeePlayer = !bBlocked || Hit.GetActor() == Player;
			}
		}
	}

	if (bCanSeePlayer)
	{
		const float GainScale = ControlledEnemy && ControlledEnemy->GetHealthPercent() < 0.3f ? 1.25f : 1.f;
		Awareness = FMath::Clamp(Awareness + (AwarenessGainRate / FMath::Max(Perception.ReactionTimeSeconds, 0.05f)) * DeltaSeconds * 0.55f * GainScale, 0.f, 1.f);
		LastKnownEnemyLocation = Player->GetActorLocation();

		if (Awareness > 0.35f && State != ESPAIState::Combat && State != ESPAIState::TakeCover && State != ESPAIState::Flank)
		{
			SetAIState(ESPAIState::Combat);
			ReactionTimer = Perception.ReactionTimeSeconds;
			Shout(NSLOCTEXT("ShadowAI", "Contact", "CONTACT!"), true);

			// Propagate contact to nearby allies.
			if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
			{
				GM->PropagateAlert(LastKnownEnemyLocation, AlertPropagationRadius, this);
			}
		}
	}
	else
	{
		Awareness = FMath::Max(0.f, Awareness - AwarenessDecayRate * DeltaSeconds);
	}

	ReactionTimer = FMath::Max(0.f, ReactionTimer - DeltaSeconds);
}

void ASPAIController::OnTargetPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus)
{
	if (const ASPCharacter* Player = Cast<ASPCharacter>(Actor))
	{
		if (Stimulus.WasSuccessfullySensed())
		{
			LastKnownEnemyLocation = Player->GetActorLocation();
		}
	}
}

void ASPAIController::OnPerceptionForgotten(AActor* Actor)
{
	if (Cast<ASPCharacter>(Actor))
	{
		// Do not instantly reset: the awareness decay path handles the fade so
		// enemies search in a believable way.
	}
}

void ASPAIController::NotifyHeardNoise(const FVector& Location, float Strength)
{
	if (State == ESPAIState::Dead || State == ESPAIState::Downed)
	{
		return;
	}

	if (Strength <= 0.f)
	{
		return;
	}

	Awareness = FMath::Clamp(Awareness + 0.35f * FMath::Clamp(Strength, 0.f, 1.f), 0.f, 1.f);
	LastKnownEnemyLocation = Location;

	if (State == ESPAIState::Idle || State == ESPAIState::Patrol)
	{
		SetAIState(ESPAIState::Suspicious);
		SearchTimer = 3.5f;
	}
}

void ASPAIController::ReceiveAlert(const FVector& EnemyLocation, AActor* AlertSource)
{
	if (State == ESPAIState::Dead || State == ESPAIState::Downed)
	{
		return;
	}

	LastKnownEnemyLocation = EnemyLocation;
	Awareness = FMath::Max(Awareness, 0.8f);

	if (State == ESPAIState::Idle || State == ESPAIState::Patrol)
	{
		SetAIState(ESPAIState::Search);
		SearchTimer = SearchDurationSeconds;
	}
	(void)AlertSource;
}

void ASPAIController::ApplySuppression(float Amount)
{
	Suppression = FMath::Clamp(Suppression + Amount, 0.f, 1.f);

	// Heavy suppression makes an enemy break contact toward cover.
	if (Suppression > 0.7f && State == ESPAIState::Combat && FMath::FRand() < 0.35f)
	{
		SetAIState(ESPAIState::TakeCover);
	}
}

void ASPAIController::UpdateSuppression(float DeltaSeconds)
{
	Suppression = FMath::Max(0.f, Suppression - 0.55f * DeltaSeconds);
}

// -------------------------------------------------------------------- states
void ASPAIController::SetAIState(ESPAIState NewState)
{
	if (State == NewState)
	{
		return;
	}

	const ESPAIState OldState = State;
	State = NewState;

	OnAIStateChanged.Broadcast(OldState, NewState);

	// Mirror into the blackboard so a behaviour tree can take over if one is
	// assigned; the C++ state machine remains the fallback.
	if (UBlackboardComponent* BB = GetBlackboardComponent())
	{
		BB->SetValueAsEnum(TEXT("AIState"), static_cast<uint8>(NewState));
		BB->SetValueAsVector(TEXT("LastKnownLocation"), LastKnownEnemyLocation);
	}
}

void ASPAIController::TickStateMachine(float DeltaSeconds)
{
	switch (State)
	{
	case ESPAIState::Idle:
		if (Awareness > 0.45f)
		{
			SetAIState(ESPAIState::Suspicious);
			SearchTimer = 4.f;
			Shout(NSLOCTEXT("ShadowAI", "WhoGoes", "WHO GOES THERE?"), false);
		}
		break;

	case ESPAIState::Suspicious:
		SearchTimer -= DeltaSeconds;
		if (Awareness > 0.75f)
		{
			SetAIState(ESPAIState::Search);
			SearchTimer = SearchDurationSeconds;
		}
		else if (SearchTimer <= 0.f)
		{
			SetAIState(ESPAIState::Idle);
		}
		break;

	case ESPAIState::Search:
		SearchTimer -= DeltaSeconds;
		if (bCanSeePlayer)
		{
			SetAIState(ESPAIState::Combat);
		}
		else if (SearchTimer <= 0.f)
		{
			Awareness = 0.15f;
			SetAIState(ESPAIState::Idle);
		}
		break;

	case ESPAIState::Combat:
		UpdateCombat(DeltaSeconds);
		if (!bCanSeePlayer && Awareness < 0.35f)
		{
			SearchTimer = SearchDurationSeconds;
			SetAIState(ESPAIState::Search);
		}
		if (ControlledEnemy && ControlledEnemy->GetHealthPercent() < 0.25f && FMath::FRand() < DeltaSeconds * 0.6f)
		{
			SetAIState(ESPAIState::Retreat);
			Shout(NSLOCTEXT("ShadowAI", "FallingBack", "I'M HIT — FALLING BACK!"), true);
		}
		break;

	case ESPAIState::TakeCover:
		if (Suppression < 0.25f)
		{
			SetAIState(ESPAIState::Combat);
		}
		break;

	case ESPAIState::Flank:
		bFlankRequested = false;
		if (bCanSeePlayer)
		{
			SetAIState(ESPAIState::Combat);
		}
		break;

	case ESPAIState::Retreat:
		SearchTimer -= DeltaSeconds;
		if (SearchTimer <= 0.f)
		{
			SetAIState(ESPAIState::Combat);
		}
		break;

	default:
		break;
	}
}

void ASPAIController::UpdateCombat(float DeltaSeconds)
{
	if (ReactionTimer > 0.f || FireCooldown > 0.f || !bCanSeePlayer)
	{
		return;
	}

	ASPCharacter* Player = Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!Player || !ControlledEnemy)
	{
		return;
	}

	// Aim error is bounded and difficulty-scaled: never a perfect shot.
	const float Distance = FVector::Dist(ControlledEnemy->GetActorLocation(), Player->GetActorLocation());
	float AimError = Perception.AimErrorDegrees;
	AimError *= FMath::Clamp(1.f + (Distance / 6000.f), 1.f, 2.2f);
	if (Suppression > 0.3f)
	{
		AimError *= 1.8f;
	}

	const float Roll = FMath::FRandRange(-AimError, AimError);
	const bool bHit = FMath::Abs(Roll) < Perception.AimErrorDegrees * 0.55f;

	// Fire a burst, then wait out the trigger discipline pause.
	ControlledEnemy->FireAtTarget(Player, bHit, Roll);
	FireCooldown = Perception.TriggerDisciplineSeconds * FMath::FRandRange(0.7f, 1.4f);
}

void ASPAIController::TryFlank()
{
	if (bFlankRequested || !ControlledEnemy)
	{
		return;
	}
	bFlankRequested = true;
	SetAIState(ESPAIState::Flank);
}

void ASPAIController::Shout(const FText& Text, bool bUrgent)
{
	if (TimeSinceShout < 1.6f)
	{
		return;
	}
	TimeSinceShout = 0.f;
	OnAIShout.Broadcast(Text, bUrgent);
}
