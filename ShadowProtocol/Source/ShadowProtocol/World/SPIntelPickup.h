// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPIntelPickup.generated.h"

class USphereComponent;
class UStaticMeshComponent;
class USPMissionManager;
class USoundBase;

/**
 * ASPIntelPickup
 *
 * A collectable intelligence document. Placing one in a level is enough: it
 * registers with the mission manager and marks itself complete when the player
 * interacts. The visual (paper, folder, ledger, tape reel) is a data choice, not
 * a separate class.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPIntelPickup : public AActor
{
	GENERATED_BODY()

public:
	ASPIntelPickup();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UFUNCTION(BlueprintCallable, Category = "Shadow|Intel")
	bool TryCollect(AActor* Collector);

	UFUNCTION(BlueprintPure, Category = "Shadow|Intel")
	FName GetIntelId() const { return IntelId; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Intel")
	bool IsCollected() const { return bCollected; }

	/** Matches an entry in the mission's IntelEntries array. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Intel")
	FName IntelId;

	/** Optional override so one mesh can serve several document types. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Intel")
	FText DisplayTitle;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Intel")
	bool bRequiresInteraction = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Intel")
	float InteractionRadius = 220.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Intel")
	TObjectPtr<USoundBase> PickupSound = nullptr;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Intel")
	TObjectPtr<USphereComponent> InteractionSphere;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Intel")
	TObjectPtr<UStaticMeshComponent> DocumentMesh;

protected:
	UFUNCTION()
	void HandleBeginOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);

	UFUNCTION()
	void HandleEndOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
		UPrimitiveComponent* OtherComp, int32 OtherBodyIndex);

	void ShowPrompt(bool bShow);

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Intel")
	bool bCollected = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Intel")
	bool bPlayerInRange = false;

	UPROPERTY()
	TObjectPtr<USPMissionManager> MissionManager = nullptr;

	float BobTime = 0.f;
	FVector BaseMeshLocation = FVector::ZeroVector;
};
