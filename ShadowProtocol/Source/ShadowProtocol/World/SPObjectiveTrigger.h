// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SPObjectiveTrigger.generated.h"

class UBoxComponent;
class USPMissionManager;
class USoundBase;

/**
 * ASPObjectiveTrigger
 *
 * A volume that completes an objective when the player enters it. Used for
 * "reach the radio", "breach the depot", "get to the roof" style objectives so
 * mission scripting stays in the level instead of in code.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPObjectiveTrigger : public AActor
{
	GENERATED_BODY()

public:
	ASPObjectiveTrigger();

	virtual void BeginPlay() override;

	/** Objective id from the mission asset. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Objective")
	FName ObjectiveId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Objective")
	bool bRequireAllSquadAlive = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Objective")
	bool bTriggerOnce = true;

	/** Optional line shown when the objective completes. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Objective")
	FText CompletionLine;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Objective")
	TObjectPtr<USoundBase> CompletionSound = nullptr;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Objective")
	TObjectPtr<UBoxComponent> TriggerVolume;

protected:
	UFUNCTION()
	void HandleBeginOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Objective")
	bool bFired = false;
};
