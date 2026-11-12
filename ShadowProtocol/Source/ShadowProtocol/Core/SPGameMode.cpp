// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPGameMode.h"
#include "Core/SPSaveGame.h"
#include "Core/SPProgressSubsystem.h"
#include "Mission/SPMissionManager.h"
#include "Mission/SPMissionData.h"
#include "Character/SPCharacter.h"
#include "Character/SPCharacterMovementComponent.h"
#include "AI/SPSquadMember.h"
#include "AI/SPEnemyCharacter.h"
#include "AI/SPAIController.h"
#include "World/SPIntelPickup.h"

#include "Kismet/GameplayStatics.h"
#include "GameFramework/PlayerController.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerStart.h"
#include "Engine/World.h"
#include "TimerManager.h"
#include "ShadowProtocol.h"

ASPGameMode::ASPGameMode()
{
	PrimaryActorTick.bCanEverTick = true;
	DefaultPawnClass = ASPCharacter::StaticClass();
}

void ASPGameMode::BeginPlay()
{
	Super::BeginPlay();

	// Campaign progress first, so difficulty is authoritative before any AI
	// controller is configured.
	if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
	{
		Progress->LoadProgress(CampaignSaveSlot);
	}

	LoadGameFromSlotIfPresent();
	CacheMissionManager();
	CacheSquad();
	ApplyDifficultyToWorld();

	UE_LOG(LogShadowProtocol, Log, TEXT("GameMode online. Mission manager: %s, squad: %d"),
		MissionManager ? TEXT("found") : TEXT("none"), SquadMembers.Num());
}

void ASPGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Periodically refresh the squad list (members can die).
	CacheSquad();
}

void ASPGameMode::LoadGameFromSlotIfPresent()
{
	if (UGameplayStatics::DoesSaveGameExist(CampaignSaveSlot, 0))
	{
		SaveGameObject = Cast<USPSaveGame>(UGameplayStatics::LoadGameFromSlot(CampaignSaveSlot, 0));
		if (SaveGameObject)
		{
			LastCheckpoint = SaveGameObject->ActiveCheckpoint;
		}
	}
	if (!SaveGameObject)
	{
		SaveGameObject = Cast<USPSaveGame>(UGameplayStatics::CreateSaveGameObject(USPSaveGame::StaticClass()));
	}
}

AActor* ASPGameMode::ChoosePlayerStart_Implementation(AController* Player)
{
	// A level's PlayerStart that carries the "SP_MissionStart" tag wins, so
	// designers can place several starts and let the mission pick one without
	// shipping throwaway actors.
	AActor* Fallback = nullptr;
	for (TActorIterator<APlayerStart> It(GetWorld()); It; ++It)
	{
		APlayerStart* Start = *It;
		if (!Start)
		{
			continue;
		}
		if (Start->PlayerStartTag == TEXT("SP_MissionStart"))
		{
			return Start;
		}
		if (!Fallback)
		{
			Fallback = Start;
		}
	}

	if (Fallback)
	{
		return Fallback;
	}
	return Super::ChoosePlayerStart_Implementation(Player);
}

void ASPGameMode::HandleDeathReload()
{
	RestoreLastCheckpoint();
	bCheckpointPending = false;
}

void ASPGameMode::CacheMissionManager()
{
	if (MissionManager)
	{
		return;
	}
	for (TActorIterator<ASPMissionManager> It(GetWorld()); It; ++It)
	{
		MissionManager = *It;
		break;
	}
}

void ASPGameMode::CacheSquad()
{
	SquadMembers.Reset();
	for (TActorIterator<ASPSquadMember> It(GetWorld()); It; ++It)
	{
		ASPSquadMember* Member = *It;
		if (Member && !Member->IsKIA())
		{
			SquadMembers.Add(Member);
		}
	}
}

void ASPGameMode::ApplyDifficultyToWorld()
{
	ESPDifficulty Difficulty = ESPDifficulty::Soldier;
	if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
	{
		Difficulty = Progress->GetDifficulty();
	}

	for (TActorIterator<ASPAIController> It(GetWorld()); It; ++It)
	{
		if (ASPAIController* AI = *It)
		{
			AI->ApplyDifficulty(Difficulty);
		}
	}
}

ASPCharacter* ASPGameMode::GetPlayerCharacter() const
{
	return Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
}

int32 ASPGameMode::GetAliveSquadCount() const
{
	int32 Count = 0;
	for (const ASPSquadMember* Member : SquadMembers)
	{
		if (Member && !Member->IsKIA())
		{
			++Count;
		}
	}
	return Count;
}

USPSaveGame* ASPGameMode::GetSaveGame() const
{
	return SaveGameObject;
}

// -------------------------------------------------------------------- orders
bool ASPGameMode::IssueSquadOrder(ESPSquadOrder Order, ASPCharacter* RequestingPlayer)
{
	if (!RequestingPlayer || SquadMembers.Num() == 0)
	{
		return false;
	}

	// Compute a destination from the player's aim if the order needs one.
	FVector Destination = RequestingPlayer->GetActorLocation();
	if (Order == ESPSquadOrder::MoveTo || Order == ESPSquadOrder::Breach || Order == ESPSquadOrder::Recon)
	{
		const FVector Start = RequestingPlayer->GetActorLocation() + FVector(0.f, 0.f, 80.f);
		const FVector End = Start + RequestingPlayer->GetControlRotation().Vector() * 1500.f;

		FHitResult Hit;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(SPSquadOrder), false, RequestingPlayer);
		if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params))
		{
			Destination = Hit.ImpactPoint;
		}
		else
		{
			Destination = End;
		}
	}

	bool bIssuedToAnyone = false;
	for (ASPSquadMember* Member : SquadMembers)
	{
		if (Member && !Member->IsKIA() && !Member->IsDowned())
		{
			Member->IssueOrder(Order, Destination);
			bIssuedToAnyone = true;
		}
	}

	return bIssuedToAnyone;
}

// -------------------------------------------------------------------- events
void ASPGameMode::NotifyPlayerKilled(AActor* Killer)
{
	OnPlayerDeath.Broadcast(Killer);

	if (bReloadCheckpointOnDeath && !bCheckpointPending)
	{
		bCheckpointPending = true;
		GetWorld()->GetTimerManager().SetTimer(DeathReloadTimer, this,
			&ASPGameMode::HandleDeathReload, DeathReloadDelay, false);
	}
}

void ASPGameMode::NotifyMissionComplete(USPMissionData* Mission)
{
	// Persist campaign progress at the chapter boundary.
	if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
	{
		if (Mission)
		{
			Progress->CompleteChapter(Mission->ChapterIndex);
		}
		Progress->SaveProgress(CampaignSaveSlot);
	}

	if (SaveGameObject)
	{
		SaveGameObject->Campaign = USPProgressSubsystem::Get(this)
			? USPProgressSubsystem::Get(this)->GetProgress() : FSPCampaignProgress();
		UGameplayStatics::SaveGameToSlot(SaveGameObject, CampaignSaveSlot, 0);
	}

	OnChapterComplete.Broadcast(Mission);
	UE_LOG(LogShadowProtocol, Log, TEXT("Mission complete: %s"), Mission ? *Mission->MissionId.ToString() : TEXT("unknown"));
}

void ASPGameMode::NotifyPlayerInteract(ASPCharacter* Player)
{
	if (!MissionManager || !Player)
	{
		return;
	}

	// The interact key resolves to the nearest in-range pickup. Pickups carry
	// their own IntelId, so this route never guesses an identity from a label.
	const FVector PlayerLocation = Player->GetActorLocation();

	ASPIntelPickup* Nearest = nullptr;
	float NearestDistanceSq = TNumericLimits<float>::Max();

	for (TActorIterator<ASPIntelPickup> It(GetWorld()); It; ++It)
	{
		ASPIntelPickup* Pickup = *It;
		if (!Pickup || Pickup->IsCollected())
		{
			continue;
		}
		const float DistanceSq = FVector::DistSquared(PlayerLocation, Pickup->GetActorLocation());
		if (DistanceSq < NearestDistanceSq)
		{
			NearestDistanceSq = DistanceSq;
			Nearest = Pickup;
		}
	}

	if (Nearest)
	{
		Nearest->TryCollect(Player);
	}
}

void ASPGameMode::NotifyTacticalMapToggle()
{
	// The HUD widget subscribes to its own input for the map; this hook exists
	// so the game mode can pause the world for a real tactical pause if desired.
	UE_LOG(LogShadowProtocol, Verbose, TEXT("Tactical map toggled"));
}

void ASPGameMode::NotifyEnemyKilled(ASPEnemyCharacter* Enemy, bool bHeadshot, AActor* Killer)
{
	(void)bHeadshot;
	(void)Killer;

	// Kill bookkeeping is intentionally session-local: campaign progress only
	// tracks chapter completion, intel and the four ending flags.
	UE_LOG(LogShadowProtocol, Verbose, TEXT("Hostile down: %s"), *GetNameSafe(Enemy));
}

void ASPGameMode::NotifySquadMemberDowned(ASPSquadMember* Member)
{
	PushSubtitle(Member ? Member->GetCallsign() : FText::GetEmpty(),
		NSLOCTEXT("ShadowGameMode", "SquadDown", "is down! I need help!"), true);
}

void ASPGameMode::NotifySquadMemberRevived(ASPSquadMember* Member)
{
	PushSubtitle(Member ? Member->GetCallsign() : FText::GetEmpty(),
		NSLOCTEXT("ShadowGameMode", "SquadRevived", "is back up."), true);
}

void ASPGameMode::NotifySquadMemberKilled(ASPSquadMember* Member)
{
	if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
	{
		Progress->RecordCasualty();
	}

	PushSubtitle(Member ? Member->GetCallsign() : FText::GetEmpty(),
		NSLOCTEXT("ShadowGameMode", "SquadKIA", "is KIA."), true);
}

// -------------------------------------------------------------------- signals
void ASPGameMode::NotifySoundEvent(const FVector& Location, float RadiusCm, FName Tag)
{
	if (RadiusCm <= 0.f)
	{
		return;
	}

	for (TActorIterator<ASPAIController> It(GetWorld()); It; ++It)
	{
		ASPAIController* AI = *It;
		if (!AI || !AI->GetPawn())
		{
			continue;
		}

		const float Distance = FVector::Dist(AI->GetPawn()->GetActorLocation(), Location);
		if (Distance > RadiusCm)
		{
			continue;
		}

		// Attenuate with distance so a distant shot is a hint, not a command.
		const float Strength = FMath::Clamp(1.f - (Distance / RadiusCm), 0.f, 1.f);
		AI->NotifyHeardNoise(Location, Strength);

		UE_LOG(LogShadowProtocol, Verbose, TEXT("Noise '%s' heard by %s (%.0f cm, strength %.2f)"),
			*Tag.ToString(), *GetNameSafe(AI->GetPawn()), Distance, Strength);
	}
}

void ASPGameMode::PropagateAlert(const FVector& Location, float RadiusCm, AActor* Source)
{
	for (TActorIterator<ASPAIController> It(GetWorld()); It; ++It)
	{
		ASPAIController* AI = *It;
		if (!AI || AI->GetPawn() == Source)
		{
			continue;
		}
		if (!AI->GetPawn())
		{
			continue;
		}
		if (FVector::Dist(AI->GetPawn()->GetActorLocation(), Location) <= RadiusCm)
		{
			AI->ReceiveAlert(Location, Source);
		}
	}
}

// -------------------------------------------------------------------- dialogue
void ASPGameMode::PushSubtitle(const FText& Speaker, const FText& Line, bool bRadio)
{
	OnSubtitle.Broadcast(Speaker, Line);
	UE_LOG(LogShadowProtocol, Verbose, TEXT("[%s%s] %s"),
		bRadio ? TEXT("RADIO ") : TEXT(""), *Speaker.ToString(), *Line.ToString());
}

void ASPGameMode::PlayDialogueBeat(const FSPDialogueBeat& Beat)
{
	for (const FSPDialogueLine& Line : Beat.Lines)
	{
		PushSubtitle(FText::FromName(Line.SpeakerId), Line.English, Line.bRadioFiltered);
	}
}

// -------------------------------------------------------------------- checkpoints
bool ASPGameMode::StoreCheckpoint(const FSPCheckpointData& Checkpoint)
{
	LastCheckpoint = Checkpoint;
	bCheckpointPending = false;

	if (SaveGameObject)
	{
		SaveGameObject->ActiveCheckpoint = Checkpoint;
		if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
		{
			SaveGameObject->Campaign = Progress->GetProgress();
		}
		UGameplayStatics::SaveGameToSlot(SaveGameObject, CampaignSaveSlot, 0);
	}

	OnCheckpoint.Broadcast();
	return true;
}

bool ASPGameMode::RestoreLastCheckpoint()
{
	if (!MissionManager)
	{
		return false;
	}

	if (!SaveGameObject)
	{
		return false;
	}

	const bool bRestored = MissionManager->RestoreFromCheckpoint(SaveGameObject);
	bCheckpointPending = false;

	if (bRestored)
	{
		// The pawn is reused rather than respawned, so re-enable control and
		// clear any cinematic/death input lock left in place.
		if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
		{
			PC->SetIgnoreMoveInput(false);
			PC->SetIgnoreLookInput(false);
		}

		if (ASPCharacter* Player = GetPlayerCharacter())
		{
			Player->SetActorHiddenInGame(false);
			Player->SetActorEnableCollision(true);
		}

		PushSubtitle(NSLOCTEXT("ShadowCheckpoint", "Restored", "CHECKPOINT"),
			NSLOCTEXT("ShadowCheckpoint", "Reloaded", "Last checkpoint restored."), false);
	}

	UE_LOG(LogShadowProtocol, Log, TEXT("Checkpoint restore: %s"), bRestored ? TEXT("ok") : TEXT("failed"));
	return bRestored;
}

void ASPGameMode::ShowChapterCard(USPMissionData* Mission)
{
	if (!Mission)
	{
		return;
	}

	UE_LOG(LogShadowProtocol, Log, TEXT("Chapter card: %s — %s"),
		*Mission->EraLabel.ToString(), *Mission->ChapterTitle.ToString());
}
