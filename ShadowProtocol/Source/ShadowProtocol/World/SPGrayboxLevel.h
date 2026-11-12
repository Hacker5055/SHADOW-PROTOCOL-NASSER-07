// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPGrayboxLevel.generated.h"

class AStaticMeshActor;
class ASPEnemyCharacter;
class USPMissionData;

/**
 * ASPGrayboxLevel
 *
 * Procedurally builds a playable Chapter 01 space out of engine primitives:
 * desert floor, canal, sand berm with a breached lane, a trench network with
 * three strongpoints, a road, and the Qantara depot yard.
 *
 * Why this exists: the project ships no binary art yet, and a shooter without
 * geometry cannot be tested. Dropping this one actor into an empty level (or
 * letting Tools/build_mission_assets.py do it) produces a level with correct
 * scale, collision and nav-relevant geometry, so movement, AI, squad orders,
 * cover and objective flow can all be validated before a single mesh is
 * authored.
 *
 * It is a test range, not shipping art. Meshes, materials and lighting are
 * placeholders by definition.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPGrayboxLevel : public AActor
{
	GENERATED_BODY()

public:
	ASPGrayboxLevel();

	virtual void BeginPlay() override;
	virtual void OnConstruction(const FTransform& Transform) override;

	/** Builds the whole layout. Safe to call more than once (clears first). */
	UFUNCTION(BlueprintCallable, Category = "Shadow|Graybox")
	void BuildLayout();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Graybox")
	void ClearLayout();

	/** Total blocks the last build produced (for the log/verification). */
	UFUNCTION(BlueprintPure, Category = "Shadow|Graybox")
	int32 GetBlockCount() const { return GeneratedBlocks.Num(); }

	// ------------------------------------------------------------- layout
	/** Metres of canal length. The crossing axis runs +X. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Layout")
	float CanalLength = 12000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Layout")
	float CanalWidth = 17000.f;

	/** Trench network extent beyond the canal's east bank. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Layout")
	float EastBankDepth = 9000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Layout")
	float BermHeight = 800.f;

	/** Width of the water-cannon breach the player crosses through. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Layout")
	float BreachWidth = 900.f;

	// ------------------------------------------------------------- population
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Population")
	bool bSpawnEnemies = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Population")
	TSubclassOf<ASPEnemyCharacter> EnemyClass = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Population")
	int32 EnemiesPerStrongpoint = 4;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Population")
	ESPEra LayoutEra = ESPEra::Egypt1973;

	// ------------------------------------------------------------- palette
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Palette")
	FLinearColor SandColour = FLinearColor(0.62f, 0.52f, 0.34f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Palette")
	FLinearColor TrenchColour = FLinearColor(0.35f, 0.29f, 0.20f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Palette")
	FLinearColor ConcreteColour = FLinearColor(0.42f, 0.40f, 0.36f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Palette")
	FLinearColor WaterColour = FLinearColor(0.13f, 0.26f, 0.28f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Shadow|Graybox|Palette")
	FLinearColor EmplacementColour = FLinearColor(0.30f, 0.27f, 0.22f);

protected:
	// ------------------------------------------------------------- primitives
	AStaticMeshActor* SpawnBlock(const FVector& Centre, const FVector& Size,
		const FLinearColor& Colour, bool bCollision = true);

	void BuildGround();
	void BuildCanal();
	void BuildBerm();
	void BuildTrenchNetwork();
	void BuildStrongpoint(int32 Index, const FVector& Centre, float FacingYaw);
	void BuildDepotYard();
	void BuildWireAndObstacles();
	void PopulateStrongpoints();

	/** Static-mesh cube used for every block (engine primitive, no project art). */
	UPROPERTY()
	TObjectPtr<UStaticMesh> CubeMesh = nullptr;

	UPROPERTY()
	TArray<TObjectPtr<AStaticMeshActor>> GeneratedBlocks;

	UPROPERTY()
	TArray<FVector> StrongpointCentres;

	bool bBuilt = false;
};

/** Helper struct used by the trench generator. */
struct FSPTrenchSegment
{
	FVector Start = FVector::ZeroVector;
	FVector End = FVector::ZeroVector;
	float Width = 220.f;
	float Depth = 180.f;
};
