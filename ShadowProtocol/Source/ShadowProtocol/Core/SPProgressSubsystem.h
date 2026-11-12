// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPProgressSubsystem.generated.h"

class USPSaveGame;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnProgressChanged, const FSPCampaignProgress&, Progress);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnFlagChanged, FName, FlagName);

/**
 * USPProgressSubsystem
 *
 * Campaign-wide persistence: chapters unlocked, collected intelligence, and the
 * four flags that decide which of the three endings the player receives.
 * Auto-loads on game start and writes through to disk on demand.
 */
UCLASS()
class SHADOWPROTOCOL_API USPProgressSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	/** Convenience: fetches the subsystem from any world context object. */
	UFUNCTION(BlueprintPure, Category = "Shadow|Progress", meta = (WorldContext = "Context"))
	static USPProgressSubsystem* Get(const UObject* Context);

	// ------------------------------------------------------------- access
	UFUNCTION(BlueprintPure, Category = "Shadow|Progress")
	const FSPCampaignProgress& GetProgress() const { return Progress; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void SetProgress(const FSPCampaignProgress& InProgress);

	UFUNCTION(BlueprintPure, Category = "Shadow|Progress")
	ESPDifficulty GetDifficulty() const { return Progress.Difficulty; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void SetDifficulty(ESPDifficulty NewDifficulty);

	// ------------------------------------------------------------- mutation
	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void CompleteChapter(int32 ChapterIndex);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void RecordIntel(FName IntelId);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void SetFlag(FName FlagName, bool bValue);

	UFUNCTION(BlueprintPure, Category = "Shadow|Progress")
	bool GetFlag(FName FlagName) const;

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void RecordCasualty();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void AddPlayTime(float Seconds);

	// ------------------------------------------------------------- ending logic
	/**
	 * Resolves which ending the campaign has earned.
	 *  CLEAN_HANDS : trusted Adel + saved Mariam + published the ledger
	 *  THE_LEDGER  : kept the ledger, spared the Curator, fewer than 2 losses
	 *  QUIET_CHOICE: all 21 documents found and Adel alive (secret epilogue)
	 *  INHERITANCE : everything else
	 */
	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	ESPEnding ResolveEnding() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|Progress")
	FText GetEndingTitle(ESPEnding Ending) const;

	// ------------------------------------------------------------- persistence
	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	bool SaveProgress(const FString& SlotName = TEXT("Campaign"));

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	bool LoadProgress(const FString& SlotName = TEXT("Campaign"));

	UFUNCTION(BlueprintCallable, Category = "Shadow|Progress")
	void ResetProgress();

	UFUNCTION(BlueprintPure, Category = "Shadow|Progress")
	bool HasSaveGame() const;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Progress|Events")
	FSPOnProgressChanged OnProgressChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Progress|Events")
	FSPOnFlagChanged OnFlagChanged;

protected:
	UPROPERTY()
	FSPCampaignProgress Progress;

	UPROPERTY()
	TObjectPtr<USPSaveGame> CachedSave = nullptr;

	UPROPERTY()
	FString CurrentSlotName = TEXT("Campaign");

	static constexpr int32 TotalIntelDocuments = 21;
};
