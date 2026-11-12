// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPGameMode.generated.h"

class USPMissionData;
class ASPMissionManager;
class ASPCharacter;
class ASPSquadMember;
class USPSaveGame;
class ASPEnemyCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnSubtitle, const FText&, Speaker, const FText&, Line);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnPlayerDeathEvent, AActor*, Killer);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnChapterCompleteEvent, USPMissionData*, Mission);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FSPOnCheckpointEvent);

/**
 * ASPGameMode
 *
 * Orchestrates the session: player spawn, mission manager discovery, squad
 * orders routing, noise propagation, checkpoints, dialogue and end-of-mission.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ASPGameMode();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual AActor* ChoosePlayerStart_Implementation(AController* Player) override;

	// ------------------------------------------------------------- squad orders
	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	bool IssueSquadOrder(ESPSquadOrder Order, ASPCharacter* RequestingPlayer);

	// ------------------------------------------------------------- mission events
	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifyPlayerKilled(AActor* Killer);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifyMissionComplete(USPMissionData* Mission);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifyPlayerInteract(ASPCharacter* Player);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifyTacticalMapToggle();

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifyEnemyKilled(ASPEnemyCharacter* Enemy, bool bHeadshot, AActor* Killer);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifySquadMemberDowned(ASPSquadMember* Member);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifySquadMemberRevived(ASPSquadMember* Member);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifySquadMemberKilled(ASPSquadMember* Member);

	// ------------------------------------------------------------- signals
	/** Any weapon firing calls this so all hostile controllers can hear it. */
	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void NotifySoundEvent(const FVector& Location, float RadiusCm, FName Tag);

	/** Push contact between hostiles (alert propagation). */
	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void PropagateAlert(const FVector& Location, float RadiusCm, AActor* Source);

	// ------------------------------------------------------------- dialogue
	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void PushSubtitle(const FText& Speaker, const FText& Line, bool bRadio);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void PlayDialogueBeat(const struct FSPDialogueBeat& Beat);

	// ------------------------------------------------------------- checkpoints
	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	bool StoreCheckpoint(const FSPCheckpointData& Checkpoint);

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	bool RestoreLastCheckpoint();

	UFUNCTION(BlueprintCallable, Category = "Shadow|GameMode")
	void ShowChapterCard(USPMissionData* Mission);

	// ------------------------------------------------------------- access
	UFUNCTION(BlueprintPure, Category = "Shadow|GameMode")
	ASPMissionManager* GetMissionManager() const { return MissionManager; }

	UFUNCTION(BlueprintPure, Category = "Shadow|GameMode")
	const TArray<TObjectPtr<ASPSquadMember>>& GetSquad() const { return SquadMembers; }

	UFUNCTION(BlueprintPure, Category = "Shadow|GameMode")
	int32 GetAliveSquadCount() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|GameMode")
	USPSaveGame* GetSaveGame() const;

	// ------------------------------------------------------------- events
	UPROPERTY(BlueprintAssignable, Category = "Shadow|GameMode|Events")
	FSPOnSubtitle OnSubtitle;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|GameMode|Events")
	FSPOnPlayerDeathEvent OnPlayerDeath;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|GameMode|Events")
	FSPOnChapterCompleteEvent OnChapterComplete;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|GameMode|Events")
	FSPOnCheckpointEvent OnCheckpoint;

	// ------------------------------------------------------------- config
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Config")
	TSubclassOf<ASPSquadMember> SquadMemberClass = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Config")
	FString CampaignSaveSlot = TEXT("Campaign");

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Config")
	bool bReloadCheckpointOnDeath = true;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Config")
	float DeathReloadDelay = 2.5f;

protected:
	void LoadGameFromSlotIfPresent();
	void HandleDeathReload();
	void CacheMissionManager();
	void CacheSquad();
	void ApplyDifficultyToWorld();
	ASPCharacter* GetPlayerCharacter() const;

	UPROPERTY()
	TObjectPtr<ASPMissionManager> MissionManager = nullptr;

	UPROPERTY()
	TArray<TObjectPtr<ASPSquadMember>> SquadMembers;

	UPROPERTY()
	TObjectPtr<USPSaveGame> SaveGameObject = nullptr;

	UPROPERTY()
	FSPCheckpointData LastCheckpoint;

	FTimerHandle DeathReloadTimer;
	bool bCheckpointPending = false;
};
