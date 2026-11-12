// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPSaveGame.generated.h"

/**
 * USPSaveGame
 *
 * Holds both the campaign-wide progress and the most recent checkpoint. The
 * campaign progress is also mirrored in a subsystem so it survives level
 * transitions without a disk round-trip.
 */
UCLASS()
class SHADOWPROTOCOL_API USPSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	USPSaveGame();

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FSPCampaignProgress Campaign;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FSPCheckpointData ActiveCheckpoint;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FString SaveSlotName;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	int32 SaveVersion = 1;

	UPROPERTY(BlueprintReadWrite, Category = "Save")
	FDateTime LastSaved;
};
