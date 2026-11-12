// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Mission/SPMissionManager.h"
#include "Mission/SPMissionData.h"
#include "AI/SPSquadMember.h"
#include "Character/SPCharacter.h"
#include "Core/SPGameMode.h"
#include "Core/SPSaveGame.h"
#include "Core/SPProgressSubsystem.h"

#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPMissionManager::ASPMissionManager()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ASPMissionManager::BeginPlay()
{
	Super::BeginPlay();

	if (MissionData)
	{
		StartMission(MissionData);
	}
}

void ASPMissionManager::StartMission(USPMissionData* InMissionData)
{
	if (!InMissionData)
	{
		UE_LOG(LogShadowProtocol, Error, TEXT("Mission manager has no mission data assigned."));
		return;
	}

	MissionData = InMissionData;
	RuntimeObjectives = MissionData->Objectives;
	CollectedIntel.Reset();
	FiredDialogueBeats.Reset();
	bMissionComplete = false;
	MissionTime = 0.f;
	TimeOnCurrentObjective = 0.f;
	LastObjectiveId = NAME_None;

	SpawnSquad();
	ShowChapterCard();

	UE_LOG(LogShadowProtocol, Log, TEXT("Mission started: %s (%d objectives, %d intel)"),
		*MissionData->MissionId.ToString(), RuntimeObjectives.Num(), MissionData->IntelEntries.Num());

	if (RuntimeObjectives.Num() > 0)
	{
		OnObjectiveChanged.Broadcast(RuntimeObjectives[0]);
	}
}

void ASPMissionManager::SpawnSquad()
{
	if (!MissionData || !SquadMemberClass)
	{
		return;
	}

	ASPCharacter* Player = GetPlayerCharacter();
	if (!Player)
	{
		return;
	}

	SquadMembers.Reset();

	for (const FSPSquadSpawn& SpawnDef : MissionData->SquadSpawns)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

		const FVector Location = Player->GetActorLocation() + SpawnDef.RelativeOffset;
		ASPSquadMember* Member = GetWorld()->SpawnActor<ASPSquadMember>(
			SquadMemberClass, Location, Player->GetActorRotation(), Params);

		if (Member)
		{
			Member->ConfigureIdentity(SpawnDef.CharacterId, MissionData->Era, SpawnDef.Callsign);
			Member->SetFormationSlot(SquadMembers.Num(), SpawnDef.RelativeOffset);
			SquadMembers.Add(Member);
		}
	}
}

void ASPMissionManager::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bMissionComplete)
	{
		return;
	}

	MissionTime += DeltaSeconds;
	TimeSinceLastCheckpoint += DeltaSeconds;
	TimeOnCurrentObjective += DeltaSeconds;

	UpdateObjectiveMarkers();

	if (TimeSinceLastCheckpoint >= AutoCheckpointInterval)
	{
		RecordCheckpoint();
	}

	// Softlock guard: an objective with a marker that has stood for a long time
	// completes when the player physically reaches it. This mirrors the browser
	// slice's behaviour and guarantees the mission is always finishable.
	const FSPObjective Current = GetCurrentObjective();
	if (Current.bHasMarker && TimeOnCurrentObjective > 25.f)
	{
		ASPCharacter* Player = GetPlayerCharacter();
		if (Player && FVector::Dist2D(Player->GetActorLocation(), Current.MarkerLocation) < 900.f)
		{
			CompleteObjective(Current.Id);
		}
	}

	if (Current.Id != LastObjectiveId)
	{
		LastObjectiveId = Current.Id;
		TimeOnCurrentObjective = 0.f;
	}
}

void ASPMissionManager::UpdateObjectiveMarkers()
{
	// Marker positions are authored in the data asset; nothing per-frame is
	// strictly required, but this hook is where a compass widget would refresh.
}

FSPObjective ASPMissionManager::GetCurrentObjective() const
{
	for (const FSPObjective& Objective : RuntimeObjectives)
	{
		if (!Objective.bComplete && !Objective.bOptional)
		{
			return Objective;
		}
	}
	return FSPObjective();
}

void ASPMissionManager::CompleteObjective(FName ObjectiveId)
{
	for (FSPObjective& Objective : RuntimeObjectives)
	{
		if (Objective.Id != ObjectiveId || Objective.bComplete)
		{
			continue;
		}

		Objective.bComplete = true;
		OnObjectiveChanged.Broadcast(Objective);

		UE_LOG(LogShadowProtocol, Log, TEXT("Objective complete: %s"), *ObjectiveId.ToString());

		// Completing an objective is a natural checkpoint.
		RecordCheckpoint();
		CheckForCompletion();
		return;
	}
}

void ASPMissionManager::CompleteObjectiveByIndex(int32 Index)
{
	if (RuntimeObjectives.IsValidIndex(Index))
	{
		CompleteObjective(RuntimeObjectives[Index].Id);
	}
}

bool ASPMissionManager::CollectIntel(FName IntelId)
{
	if (CollectedIntel.Contains(IntelId) || !MissionData)
	{
		return false;
	}

	for (const FSPIntelEntry& Entry : MissionData->IntelEntries)
	{
		if (Entry.Id == IntelId)
		{
			CollectedIntel.Add(IntelId);
			OnIntelCollected.Broadcast(Entry);

			if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
			{
				Progress->RecordIntel(IntelId);
			}
			return true;
		}
	}
	return false;
}

void ASPMissionManager::RecordCheckpoint(bool bUsePlayerTransform, const FVector& Location)
{
	if (bMissionComplete)
	{
		return;
	}

	ASPGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ASPGameMode>() : nullptr;
	if (!GM)
	{
		return;
	}

	FSPCheckpointData Checkpoint;
	Checkpoint.MissionId = MissionData ? MissionData->MissionId : NAME_None;

	if (bUsePlayerTransform)
	{
		if (ASPCharacter* Player = GetPlayerCharacter())
		{
			Checkpoint.PlayerLocation = Player->GetActorLocation();
			Checkpoint.PlayerRotation = Player->GetControlRotation();
			Checkpoint.PlayerHealth = Player->GetHealthNormalised() * 100.f;
		}
	}
	else
	{
		Checkpoint.PlayerLocation = Location;
	}

	for (const FSPObjective& Objective : RuntimeObjectives)
	{
		if (Objective.bComplete)
		{
			Checkpoint.CompletedObjectiveIds.Add(Objective.Id);
		}
	}
	Checkpoint.CollectedIntelIds = CollectedIntel;
	Checkpoint.SavedAt = FDateTime::UtcNow();

	GM->StoreCheckpoint(Checkpoint);
	OnCheckpointReached.Broadcast();
	TimeSinceLastCheckpoint = 0.f;
}

bool ASPMissionManager::RestoreFromCheckpoint(USPSaveGame* SaveGame)
{
	if (!SaveGame || !MissionData)
	{
		return false;
	}

	const FSPCheckpointData& Checkpoint = SaveGame->ActiveCheckpoint;
	if (Checkpoint.MissionId != MissionData->MissionId)
	{
		return false;
	}

	RuntimeObjectives = MissionData->Objectives;
	for (FSPObjective& Objective : RuntimeObjectives)
	{
		Objective.bComplete = Checkpoint.CompletedObjectiveIds.Contains(Objective.Id);
	}

	CollectedIntel = Checkpoint.CollectedIntelIds;

	if (ASPCharacter* Player = GetPlayerCharacter())
	{
		Player->SetActorLocationAndRotation(Checkpoint.PlayerLocation, Checkpoint.PlayerRotation);
		Player->ApplyCheckpointHealth(Checkpoint.PlayerHealth);
	}

	OnObjectiveChanged.Broadcast(GetCurrentObjective());
	return true;
}

void ASPMissionManager::TriggerDialogueBeat(FName BeatId)
{
	if (!MissionData || FiredDialogueBeats.Contains(BeatId))
	{
		return;
	}

	for (const FSPDialogueBeat& Beat : MissionData->DialogueBeats)
	{
		if (Beat.TriggerId != BeatId)
		{
			continue;
		}

		if (Beat.bPlayOnce)
		{
			FiredDialogueBeats.Add(BeatId);
		}

		for (const FSPDialogueLine& Line : Beat.Lines)
		{
			OnSubtitleRequested.Broadcast(FText::FromName(Line.SpeakerId), Line.English);
		}

		if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
		{
			GM->PlayDialogueBeat(Beat);
		}
		return;
	}
}

void ASPMissionManager::CheckForCompletion()
{
	if (bMissionComplete)
	{
		return;
	}

	for (const FSPObjective& Objective : RuntimeObjectives)
	{
		if (!Objective.bOptional && !Objective.bComplete)
		{
			return;
		}
	}

	bMissionComplete = true;
	OnMissionComplete.Broadcast();

	if (USPProgressSubsystem* Progress = USPProgressSubsystem::Get(this))
	{
		if (MissionData)
		{
			Progress->CompleteChapter(MissionData->ChapterIndex);
			for (const TPair<FName, bool>& Flag : MissionData->FlagsOnComplete)
			{
				Progress->SetFlag(Flag.Key, Flag.Value);
			}
		}
	}

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->NotifyMissionComplete(MissionData);
	}
}

void ASPMissionManager::ShowChapterCard()
{
	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->ShowChapterCard(MissionData);
	}
}

ASPCharacter* ASPMissionManager::GetPlayerCharacter() const
{
	return Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
}
