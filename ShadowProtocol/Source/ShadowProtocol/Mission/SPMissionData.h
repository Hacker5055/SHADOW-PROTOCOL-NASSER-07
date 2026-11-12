// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPMissionData.generated.h"

class USPWeaponData;
class ULevelSequence;
class USoundBase;

/** A squad member the mission spawns alongside the player. */
USTRUCT(BlueprintType)
struct FSPSquadSpawn
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Squad")
	ESPCharacterId CharacterId = ESPCharacterId::Fang;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Squad")
	FText Callsign;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Squad")
	FVector RelativeOffset = FVector(-190.f, 160.f, 0.f);
};

/** A scripted dialogue beat triggered by objective completion or a trigger volume. */
USTRUCT(BlueprintType)
struct FSPDialogueBeat
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FName TriggerId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	TArray<FSPDialogueLine> Lines;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	bool bPlayOnce = true;
};

/**
 * USPMissionData
 *
 * One chapter-mission definition. Everything the mission framework needs to
 * stand up a playable mission: identity, era, spawn transform, loadout,
 * objective graph, intel manifest, squad, cinematics and dialogue beats.
 *
 * Chapters are data. Adding Chapter 03 is authoring one of these assets — no
 * engineering changes required, which is what the brief's "mission management
 * framework" asks for.
 */
UCLASS(BlueprintType)
class SHADOWPROTOCOL_API USPMissionData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	// ------------------------------------------------------------- identity
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FName MissionId;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	int32 ChapterIndex = 1;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText ChapterTitle;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText ChapterTitleArabic;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText MissionCode;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText Synopsis;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText EraLabel;

	// ------------------------------------------------------------- setup
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	ESPEra Era = ESPEra::Egypt1973;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	ESPCharacterId Protagonist = ESPCharacterId::Taher;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	FVector PlayerStartLocation = FVector::ZeroVector;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	FRotator PlayerStartRotation = FRotator::ZeroRotator;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	TArray<TObjectPtr<USPWeaponData>> Loadout;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	bool bAllowNightVision = false;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	TArray<FSPSquadSpawn> SquadSpawns;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Setup")
	ESPDifficulty DefaultDifficulty = ESPDifficulty::Soldier;

	// ------------------------------------------------------------- objectives
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objectives")
	TArray<FSPObjective> Objectives;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objectives")
	TArray<FSPIntelEntry> IntelEntries;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Objectives")
	TArray<FSPDialogueBeat> DialogueBeats;

	// ------------------------------------------------------------- cinematics
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cinematics")
	TObjectPtr<ULevelSequence> OpeningSequence = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cinematics")
	TObjectPtr<ULevelSequence> ClosingSequence = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cinematics")
	TObjectPtr<USoundBase> AmbienceBed = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cinematics")
	float TimeOfDayHours = 14.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Cinematics")
	FName LightingPresetName = TEXT("1973_Afternoon");

	/** Sets campaign flags when the mission completes (used by the ending logic). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Outcome")
	TMap<FName, bool> FlagsOnComplete;

	UFUNCTION(BlueprintPure, Category = "Objectives")
	int32 GetPrimaryObjectiveCount() const
	{
		int32 Count = 0;
		for (const FSPObjective& Objective : Objectives)
		{
			if (!Objective.bOptional)
			{
				++Count;
			}
		}
		return Count;
	}

	UFUNCTION(BlueprintPure, Category = "Objectives")
	int32 GetIntelCount() const { return IntelEntries.Num(); }
};
