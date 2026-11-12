// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Core/SPGameMode.h"
#include "SPGrayboxGameMode.generated.h"

class ASPGrayboxLevel;
class USPMissionData;
class ASPMissionManager;
class ASPSquadMember;

/**
 * ASPGrayboxGameMode
 *
 * The "open an empty level and press Play" path. Spawns the procedural 1973
 * crossing range, a mission manager, and a code-defined test mission
 * (SPGrayboxRange) with objectives and intel, so the whole stack — movement,
 * weapons, AI, squad orders, objectives, checkpoints, HUD — can be exercised
 * before any level art exists.
 *
 * This is the project's default game mode. It backs the README's promise that
 * the project is playable without binary assets; it is not shipping content.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPGrayboxGameMode : public ASPGameMode
{
	GENERATED_BODY()

public:
	ASPGrayboxGameMode();

	virtual void BeginPlay() override;

	/** Build the range even if the level already has geometry. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Graybox")
	bool bBuildRange = true;

	/** Spawn the test mission (objectives, intel, squad). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Graybox")
	bool bRunTestMission = true;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Graybox")
	TSubclassOf<ASPGrayboxLevel> GrayboxLevelClass = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Graybox")
	TSubclassOf<ASPMissionManager> MissionManagerClass = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Graybox")
	TSubclassOf<ASPSquadMember> GrayboxSquadClass = nullptr;

protected:
	/** Built in code so the range works with zero authored assets. */
	USPMissionData* CreateTestMission();

	UPROPERTY()
	TObjectPtr<ASPGrayboxLevel> RangeLevel = nullptr;

	UPROPERTY()
	TObjectPtr<USPMissionData> TestMission = nullptr;

	UPROPERTY()
	TObjectPtr<ASPMissionManager> TestMissionManager = nullptr;
};
