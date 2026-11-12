// Copyright (c) SHADOW PROTOCOL: NASSER 07. All rights reserved.
// Original work of fiction. See docs/01_STORY_BIBLE.md for the canon.

#pragma once

#include "CoreMinimal.h"
#include "ShadowProtocolTypes.generated.h"

class USoundBase;

/**
 * Era of a chapter. Drives the entire equipment, audio and lighting pipeline:
 * 1973 chapters may never receive modern kit (enforced in USPWeaponComponent
 * and validated by the automated test FShadowProtocolEraTest).
 */
UENUM(BlueprintType)
enum class ESPEra : uint8
{
	Egypt1973  UMETA(DisplayName = "Egypt 1973"),
	Modern     UMETA(DisplayName = "Modern Era")
};

/** Difficulty tiers. Realism removes the HUD and makes every round lethal. */
UENUM(BlueprintType)
enum class ESPDifficulty : uint8
{
	Recruit   UMETA(DisplayName = "Recruit"),
	Soldier   UMETA(DisplayName = "Soldier"),
	Veteran   UMETA(DisplayName = "Veteran"),
	Realism   UMETA(DisplayName = "Realism")
};

/** Character identity used to drive gear, voice and dialogue sets. */
UENUM(BlueprintType)
enum class ESPCharacterId : uint8
{
	Taher        UMETA(DisplayName = "Col. Taher Abdel-Hakim"),
	Nasser       UMETA(DisplayName = "Nasser 07"),
	Fang         UMETA(DisplayName = "Lt. Karim 'FANG' El-Sayed"),
	Jackal       UMETA(DisplayName = "Sgt. Hoda 'JACKAL' Mansour"),
	Mouse        UMETA(DisplayName = "Sgt. Adel 'MOUSE' Farhan"),
	Glass        UMETA(DisplayName = "Lt. Rami 'GLASS' Fahmy"),
	Zidan        UMETA(DisplayName = "Gen. Ashraf Zidan"),
	Curator      UMETA(DisplayName = "The Curator"),
	Mariam       UMETA(DisplayName = "Mariam Fahmy"),
	EnemyGeneric UMETA(DisplayName = "Hostile")
};

/** Stance state machine values, mirrored on the HUD and in movement tuning. */
UENUM(BlueprintType)
enum class ESPStance : uint8
{
	Stand  UMETA(DisplayName = "Standing"),
	Crouch UMETA(DisplayName = "Crouching"),
	Prone  UMETA(DisplayName = "Prone"),
	Slide  UMETA(DisplayName = "Sliding"),
	Mantle UMETA(DisplayName = "Mantling")
};

/** Squad command vocabulary. */
UENUM(BlueprintType)
enum class ESPSquadOrder : uint8
{
	Follow UMETA(DisplayName = "Follow"),
	MoveTo UMETA(DisplayName = "Move To"),
	Hold   UMETA(DisplayName = "Hold Position"),
	Breach UMETA(DisplayName = "Breach"),
	Recon  UMETA(DisplayName = "Recon"),
	Revive UMETA(DisplayName = "Revive Teammate")
};

/** Enemy awareness states (behaviour-tree selector). */
UENUM(BlueprintType)
enum class ESPAIState : uint8
{
	Idle       UMETA(DisplayName = "Idle"),
	Patrol     UMETA(DisplayName = "Patrol"),
	Suspicious UMETA(DisplayName = "Suspicious"),
	Search     UMETA(DisplayName = "Search"),
	Combat     UMETA(DisplayName = "Combat"),
	TakeCover  UMETA(DisplayName = "Take Cover"),
	Flank      UMETA(DisplayName = "Flank"),
	Retreat    UMETA(DisplayName = "Retreat"),
	Downed     UMETA(DisplayName = "Downed"),
	Dead       UMETA(DisplayName = "Dead")
};

/** What kind of damage a hit does — drives feedback, gore decals and audio. */
UENUM(BlueprintType)
enum class ESPHitZone : uint8
{
	Head,
	Torso,
	Limb,
	Armour,
	Explosive
};

/**
 * A single objective in a mission's objective graph.
 * Objectives are ordered; only Primaries are required to finish a mission.
 */
USTRUCT(BlueprintType)
struct FSPObjective
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objective")
	FName Id;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objective")
	FText Text;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objective")
	FText TextArabic;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objective")
	bool bOptional = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objective")
	bool bHidden = false;

	UPROPERTY(BlueprintReadOnly, Category = "Objective")
	bool bComplete = false;

	/** Optional world marker for the compass / objective tracker. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objective")
	FVector MarkerLocation = FVector::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objective")
	bool bHasMarker = false;
};

/** One checkpoint payload, serialised into the save game. */
USTRUCT(BlueprintType)
struct FSPCheckpointData
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	FName MissionId;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	FVector PlayerLocation = FVector::ZeroVector;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	FRotator PlayerRotation = FRotator::ZeroRotator;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	TArray<FName> CompletedObjectiveIds;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	TArray<FName> CollectedIntelIds;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	float PlayerHealth = 100.f;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	int32 WeaponSlot = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	FDateTime SavedAt;

	UPROPERTY(BlueprintReadWrite, Category = "Checkpoint")
	int32 TimesLoaded = 0;
};

/** Campaign-wide persistent progress. */
USTRUCT(BlueprintType)
struct FSPCampaignProgress
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	int32 ChaptersUnlocked = 1;

	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	TArray<int32> ChaptersCompleted;

	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	TArray<FName> CollectedIntel;

	/** The four endings flags plus supporting decisions, matched to docs/02. */
	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	TMap<FName, bool> Flags;

	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	int32 Casualties = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	TArray<FName> EndingsSeen;

	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	float PlayTimeSeconds = 0.f;

	UPROPERTY(BlueprintReadWrite, Category = "Campaign")
	ESPDifficulty Difficulty = ESPDifficulty::Soldier;

	FSPCampaignProgress()
	{
		Flags.Add(TEXT("TRUST_ADEL"), false);
		Flags.Add(TEXT("SAVED_MARIAM"), false);
		Flags.Add(TEXT("SPARED_CURATOR"), false);
		Flags.Add(TEXT("PUBLISHED_LEDGER"), false);
		Flags.Add(TEXT("KONSUL_ALIVE"), false);
	}
};

/** Result of the campaign's flag resolution — see USPProgressSubsystem. */
UENUM(BlueprintType)
enum class ESPEnding : uint8
{
	CleanHands   UMETA(DisplayName = "Clean Hands"),
	TheLedger    UMETA(DisplayName = "The Ledger"),
	Inheritance  UMETA(DisplayName = "Inheritance"),
	QuietChoice  UMETA(DisplayName = "The Quiet Choice")
};

/** Dialogue line played through the radio/voice system with subtitles. */
USTRUCT(BlueprintType)
struct FSPDialogueLine
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FName SpeakerId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FText English;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	FText Arabic;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	TObjectPtr<USoundBase> VoiceAsset = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	bool bRadioFiltered = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Dialogue")
	float Duration = 3.5f;
};

/** A single placed intelligence document. */
USTRUCT(BlueprintType)
struct FSPIntelEntry
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Intel")
	FName Id;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Intel")
	FText Title;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Intel")
	FText TitleArabic;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Intel")
	FText Body;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Intel")
	FText BodyArabic;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Intel")
	int32 Chapter = 1;
};
