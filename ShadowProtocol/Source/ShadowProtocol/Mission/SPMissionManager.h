// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPMissionManager.generated.h"

class USPMissionData;
class USPSaveGame;
class ASPCharacter;
class ASPSquadMember;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnObjectiveChanged, const FSPObjective&, Objective);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnIntelCollected, const FSPIntelEntry&, Entry);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FSPOnCheckpointReached);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FSPOnMissionComplete);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnSubtitleRequested, FText, Speaker, FText, Line);

/**
 * ASPMissionManager
 *
 * The mission's runtime brain. Owns the objective graph, checkpoint lifecycle,
 * squad spawning, intel collection, dialogue beats and the completion handoff
 * to the campaign progression system.
 *
 * Place exactly one in each mission level and assign its MissionData asset.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPMissionManager : public AActor
{
	GENERATED_BODY()

public:
	ASPMissionManager();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	// ------------------------------------------------------------- lifecycle
	UFUNCTION(BlueprintCallable, Category = "Shadow|Mission")
	void StartMission(USPMissionData* InMissionData);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Mission")
	void CompleteObjective(FName ObjectiveId);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Mission")
	void CompleteObjectiveByIndex(int32 Index);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Mission")
	bool CollectIntel(FName IntelId);

	/** Records a checkpoint at the given transform (or the player's current one). */
	UFUNCTION(BlueprintCallable, Category = "Shadow|Mission")
	void RecordCheckpoint(bool bUsePlayerTransform = true, const FVector& Location = FVector::ZeroVector);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Mission")
	bool RestoreFromCheckpoint(USPSaveGame* SaveGame);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Mission")
	void TriggerDialogueBeat(FName BeatId);

	UFUNCTION(BlueprintPure, Category = "Shadow|Mission")
	USPMissionData* GetMissionData() const { return MissionData; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Mission")
	const TArray<FSPObjective>& GetObjectives() const { return RuntimeObjectives; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Mission")
	FSPObjective GetCurrentObjective() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|Mission")
	int32 GetCollectedIntelCount() const { return CollectedIntel.Num(); }

	UFUNCTION(BlueprintPure, Category = "Shadow|Mission")
	bool IsMissionComplete() const { return bMissionComplete; }

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Mission|Events")
	FSPOnObjectiveChanged OnObjectiveChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Mission|Events")
	FSPOnIntelCollected OnIntelCollected;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Mission|Events")
	FSPOnCheckpointReached OnCheckpointReached;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Mission|Events")
	FSPOnMissionComplete OnMissionComplete;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Mission|Events")
	FSPOnSubtitleRequested OnSubtitleRequested;

	/** The mission definition. Assign in the level, or spawn the manager from code. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Mission")
	TObjectPtr<USPMissionData> MissionData = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Mission")
	TSubclassOf<ASPSquadMember> SquadMemberClass = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Mission")
	float AutoCheckpointInterval = 240.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Mission")
	bool bAllowManualCheckpoint = true;

protected:
	void CheckForCompletion();
	void SpawnSquad();
	void UpdateObjectiveMarkers();
	void ShowChapterCard();
	ASPCharacter* GetPlayerCharacter() const;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	TArray<FSPObjective> RuntimeObjectives;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	TArray<FName> CollectedIntel;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	TArray<FName> FiredDialogueBeats;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	TArray<TObjectPtr<ASPSquadMember>> SquadMembers;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	bool bMissionComplete = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	float TimeSinceLastCheckpoint = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	float MissionTime = 0.f;

	/** Used by the softlock guard: how long the current objective has stood. */
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	float TimeOnCurrentObjective = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Mission|State")
	FName LastObjectiveId = NAME_None;
};
