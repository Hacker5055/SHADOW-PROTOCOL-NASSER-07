// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPExtractionPoint.generated.h"

class UBoxComponent;
class UTextRenderComponent;
class USoundBase;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPSquadExtracted, int32, ExtractedCount);

/**
 * ASPExtractionPoint
 *
 * The end-of-mission extraction zone. Supports the brief's alternate extraction
 * requirements: more than one may exist per mission, each with its own objective
 * id, squad requirement and optional bonus.
 *
 * The zone only completes when the player is inside for ExtractionHoldSeconds and
 * the squad requirement is met, so it can never be triggered by clipping through.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPExtractionPoint : public AActor
{
	GENERATED_BODY()

public:
	ASPExtractionPoint();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UFUNCTION(BlueprintPure, Category = "Shadow|Extraction")
	float GetHoldProgress() const
	{
		return ExtractionHoldSeconds > 0.f
			? FMath::Clamp(HoldElapsed / ExtractionHoldSeconds, 0.f, 1.f)
			: 1.f;
	}

	UFUNCTION(BlueprintPure, Category = "Shadow|Extraction")
	bool IsPlayerInZone() const { return bPlayerInZone; }

	/** Objective completed when extraction succeeds (e.g. "reach_roof"). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Extraction")
	FName ObjectiveId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Extraction")
	FText ExtractionLabel;

	/** Secondary (optional) extraction routes award extra intel on completion. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Extraction")
	bool bOptionalRoute = false;

	/** Squad members that must be inside the zone (0 = no requirement). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Extraction")
	int32 RequiredSquadCount = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Extraction")
	float ExtractionHoldSeconds = 3.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Extraction")
	float ZoneRadius = 420.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Extraction")
	TObjectPtr<USoundBase> ExtractionCueSound = nullptr;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Extraction|Events")
	FSPSquadExtracted OnExtractionComplete;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Extraction")
	TObjectPtr<UBoxComponent> Zone;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Extraction")
	TObjectPtr<UTextRenderComponent> ZoneLabel;

protected:
	UFUNCTION()
	void HandleBeginOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);

	UFUNCTION()
	void HandleEndOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex);

	int32 CountSquadInZone() const;
	void CompleteExtraction();

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Extraction")
	bool bPlayerInZone = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Extraction")
	bool bExtracted = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Extraction")
	float HoldElapsed = 0.f;
};
