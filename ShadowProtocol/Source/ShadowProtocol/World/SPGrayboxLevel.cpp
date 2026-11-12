// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "World/SPGrayboxLevel.h"
#include "AI/SPEnemyCharacter.h"
#include "AI/SPAIController.h"
#include "Mission/SPMissionManager.h"

#include "Engine/StaticMeshActor.h"
#include "Engine/StaticMesh.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "NavigationSystem.h"
#include "ShadowProtocol.h"

namespace
{
	/** 1 m = 100 uu, so sizes are authored in centimetres here. */
	constexpr float Metre = 100.f;

	const TCHAR* CubeMeshPath = TEXT("/Engine/BasicShapes/Cube.Cube");
	const TCHAR* BaseMaterialPath = TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial");
}

ASPGrayboxLevel::ASPGrayboxLevel()
{
	PrimaryActorTick.bCanEverTick = false;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeFinder(CubeMeshPath);
	if (CubeFinder.Succeeded())
	{
		CubeMesh = CubeFinder.Object;
	}
}

void ASPGrayboxLevel::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	// Build in the editor too, so designers can see the layout while placing it.
	BuildLayout();
}

void ASPGrayboxLevel::BeginPlay()
{
	Super::BeginPlay();

	if (!bBuilt || GeneratedBlocks.Num() == 0)
	{
		BuildLayout();
	}

	// Geometry placed in BeginPlay needs the navmesh rebuilt around it, otherwise
	// the AI has no polygons to path on.
	if (UWorld* World = GetWorld())
	{
		if (UNavigationSystemV1* Nav = FNavigationSystem::GetCurrent<UNavigationSystemV1>(World))
		{
			Nav->Build();
		}
	}

	PopulateStrongpoints();

	UE_LOG(LogShadowProtocol, Log,
		TEXT("Graybox level built: %d blocks, %d strongpoints, population %s."),
		GeneratedBlocks.Num(), StrongpointCentres.Num(),
		bSpawnEnemies ? TEXT("on") : TEXT("off"));
}

void ASPGrayboxLevel::ClearLayout()
{
	for (AStaticMeshActor* Block : GeneratedBlocks)
	{
		if (IsValid(Block))
		{
			Block->Destroy();
		}
	}
	GeneratedBlocks.Reset();
	StrongpointCentres.Reset();
	bBuilt = false;
}

AStaticMeshActor* ASPGrayboxLevel::SpawnBlock(const FVector& Centre, const FVector& Size,
	const FLinearColor& Colour, bool bCollision)
{
	if (!GetWorld() || !CubeMesh)
	{
		return nullptr;
	}

	// The engine cube is 100 cm; scale converts it to the requested size.
	const FVector Scale = Size / 100.f;

	FActorSpawnParameters Params;
	Params.Owner = this;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	AStaticMeshActor* Block = GetWorld()->SpawnActor<AStaticMeshActor>(
		AStaticMeshActor::StaticClass(), Centre, FRotator::ZeroRotator, Params);

	if (!Block)
	{
		return nullptr;
	}

	Block->SetMobility(EComponentMobility::Static);
	Block->SetActorScale3D(Scale);

	if (UStaticMeshComponent* MeshComp = Block->GetStaticMeshComponent())
	{
		MeshComp->SetStaticMesh(CubeMesh);
		MeshComp->SetCollisionEnabled(bCollision
			? ECollisionEnabled::QueryAndPhysics
			: ECollisionEnabled::NoCollision);

		if (UMaterialInterface* BaseMat = LoadObject<UMaterialInterface>(nullptr, BaseMaterialPath))
		{
			UMaterialInstanceDynamic* DynMat = UMaterialInstanceDynamic::Create(BaseMat, Block);
			if (DynMat)
			{
				DynMat->SetVectorParameterValue(TEXT("Color"), Colour);
				MeshComp->SetMaterial(0, DynMat);
			}
		}
	}

#if WITH_EDITOR
	// Editor-only label so the outliner is readable while blockout is tuned.
	Block->SetActorLabel(FString::Printf(TEXT("GB_%03d"), GeneratedBlocks.Num()));
#endif
	GeneratedBlocks.Add(Block);
	return Block;
}

void ASPGrayboxLevel::BuildLayout()
{
	ClearLayout();

	if (!CubeMesh)
	{
		UE_LOG(LogShadowProtocol, Error, TEXT("Graybox build failed: engine cube mesh unavailable."));
		return;
	}

	BuildGround();
	BuildCanal();
	BuildBerm();
	BuildTrenchNetwork();
	BuildDepotYard();
	BuildWireAndObstacles();

	bBuilt = true;
}

// ---------------------------------------------------------------------------
void ASPGrayboxLevel::BuildGround()
{
	// West bank staging area, then the east bank beyond the canal.
	const float GroundThickness = 200.f;

	// West bank: 400 m deep, canal length wide.
	SpawnBlock(
		FVector(-200.f * Metre, 0.f, -GroundThickness * 0.5f),
		FVector(400.f * Metre, CanalLength, GroundThickness),
		SandColour);

	// East bank: everything past the canal, extending to the depot.
	SpawnBlock(
		FVector((EastBankDepth * 0.5f) + (CanalWidth * 0.5f), 0.f, -GroundThickness * 0.5f),
		FVector(EastBankDepth, CanalLength, GroundThickness),
		SandColour);

	// Depot road running east from the crossing.
	SpawnBlock(
		FVector(CanalWidth * 0.5f + EastBankDepth * 0.75f, 0.f, 2.f * Metre),
		FVector(EastBankDepth * 0.5f, 9.f * Metre, 4.f * Metre),
		ConcreteColour);
}

void ASPGrayboxLevel::BuildCanal()
{
	// Water surface just below bank level.
	SpawnBlock(
		FVector(0.f, 0.f, -1.4f * Metre),
		FVector(CanalWidth, CanalLength, 2.f * Metre),
		WaterColour,
		/*bCollision*/ false);

	// Revetted banks: two long walls that keep the player in the water channel
	// until they reach the breach. 3.5 m tall, like the real canal revetment.
	const float BankHeight = 350.f;
	const float BankOffset = CanalWidth * 0.5f;

	SpawnBlock(FVector(-BankOffset, 0.f, BankHeight * 0.5f),
		FVector(80.f, CanalLength, BankHeight), TrenchColour);

	SpawnBlock(FVector(BankOffset, 0.f, BankHeight * 0.5f),
		FVector(80.f, CanalLength, BankHeight), TrenchColour);
}

void ASPGrayboxLevel::BuildBerm()
{
	// The Egyptian sand berm, breached at Y = 0 through BreachWidth.
	const float BermDepth = 12.f * Metre;
	const float BermOffset = (CanalWidth * 0.5f) + (BermDepth * 0.5f);

	const float LeftSegmentLength = (CanalLength * 0.5f) - (BreachWidth * 0.5f);
	const float SegmentCentre = (BreachWidth * 0.5f) + (LeftSegmentLength * 0.5f);

	if (LeftSegmentLength > 0.f)
	{
		// North segment.
		SpawnBlock(FVector(BermOffset, SegmentCentre, BermHeight * 0.5f),
			FVector(BermDepth, LeftSegmentLength, BermHeight), TrenchColour);

		// South segment.
		SpawnBlock(FVector(BermOffset, -SegmentCentre, BermHeight * 0.5f),
			FVector(BermDepth, LeftSegmentLength, BermHeight), TrenchColour);
	}

	// Ramp through the breach so the player can walk up and over the gap.
	const int32 RampSteps = 4;
	for (int32 Step = 0; Step < RampSteps; ++Step)
	{
		const float Alpha = (Step + 1.f) / RampSteps;
		const float Height = BermHeight * Alpha;
		const float Depth = BermDepth / RampSteps;
		SpawnBlock(
			FVector(BermOffset - (BermDepth * 0.5f) + (Depth * (Step + 0.5f)), 0.f, Height * 0.5f),
			FVector(Depth, BreachWidth, Height),
			TrenchColour);
	}

	// Israeli-side rampart, mirrored and slightly lower.
	const float RampartOffset = (CanalWidth * 0.5f) - (30.f * Metre);
	SpawnBlock(FVector(RampartOffset, 0.f, 300.f),
		FVector(24.f * Metre, 60.f * Metre, 600.f), TrenchColour);
}

void ASPGrayboxLevel::BuildTrenchNetwork()
{
	const float BaseX = (CanalWidth * 0.5f) + (20.f * Metre);

	// Three strongpoints along the east bank, linked by a communications trench.
	StrongpointCentres.Add(FVector(BaseX + (90.f * Metre), -320.f * Metre, 0.f));
	StrongpointCentres.Add(FVector(BaseX + (140.f * Metre), 0.f, 0.f));
	StrongpointCentres.Add(FVector(BaseX + (90.f * Metre), 320.f * Metre, 0.f));

	// Communication trench connecting them (a sunken channel, represented as two
	// low walls with a walkable floor).
	const float WallHeight = 240.f;
	const float WallThickness = 40.f;
	const float TrenchHalfWidth = 110.f;

	for (int32 i = 0; i < StrongpointCentres.Num() - 1; ++i)
	{
		const FVector A = StrongpointCentres[i];
		const FVector B = StrongpointCentres[i + 1];
		const FVector Mid = (A + B) * 0.5f;
		const float Length = FVector::Dist2D(A, B);
		const float Yaw = FMath::RadiansToDegrees(FMath::Atan2(B.Y - A.Y, B.X - A.X));

		for (int32 Side = -1; Side <= 1; Side += 2)
		{
			SpawnBlock(
				Mid + FVector(0.f, Side * TrenchHalfWidth, WallHeight * 0.5f),
				FVector(Length, WallThickness, WallHeight),
				TrenchColour);
		}

		// Sandbag lip at the trench mouth.
		SpawnBlock(Mid + FVector(0.f, 0.f, 10.f),
			FVector(60.f, TrenchHalfWidth * 2.f, 20.f),
			EmplacementColour);
		(void)Yaw;
	}

	for (int32 Index = 0; Index < StrongpointCentres.Num(); ++Index)
	{
		const FVector Centre = StrongpointCentres[Index];
		const float FacingYaw = 180.f; // facing back toward the canal
		BuildStrongpoint(Index, Centre, FacingYaw);
	}
}

void ASPGrayboxLevel::BuildStrongpoint(int32 Index, const FVector& Centre, float FacingYaw)
{
	(void)FacingYaw;

	// A bunker block with a firing slit formed by two shoulder blocks.
	SpawnBlock(Centre + FVector(0.f, 0.f, 120.f),
		FVector(8.f * Metre, 14.f * Metre, 240.f),
		ConcreteColour);

	SpawnBlock(Centre + FVector(-4.4f * Metre, 0.f, 200.f),
		FVector(20.f, 14.f * Metre, 60.f),
		ConcreteColour);

	// Trench wing walls either side of the bunker.
	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		SpawnBlock(Centre + FVector(6.f * Metre, Side * 16.f * Metre, 90.f),
			FVector(40.f * Metre, 40.f, 240.f),
			TrenchColour);
	}

	// Sandbag emplacement ring.
	const int32 BagCount = 8;
	for (int32 Bag = 0; Bag < BagCount; ++Bag)
	{
		const float Angle = (2.f * PI * Bag) / BagCount;
		const float Radius = 9.f * Metre;
		SpawnBlock(
			Centre + FVector(FMath::Cos(Angle) * Radius, FMath::Sin(Angle) * Radius, 45.f),
			FVector(140.f, 90.f, 90.f),
			EmplacementColour);
	}

	UE_LOG(LogShadowProtocol, Verbose, TEXT("Strongpoint %d built at %s"), Index + 1, *Centre.ToCompactString());
}

void ASPGrayboxLevel::BuildDepotYard()
{
	// Qantara road depot, Chapter 01's final mission location.
	const FVector DepotCentre(
		(CanalWidth * 0.5f) + EastBankDepth - (60.f * Metre), 140.f * Metre, 0.f);

	// Perimeter wall with a gate gap on the west side.
	const float YardSize = 45.f * Metre;
	const float WallHeight = 300.f;

	SpawnBlock(DepotCentre + FVector(YardSize * 0.5f, 0.f, WallHeight * 0.5f),
		FVector(40.f, YardSize, WallHeight), ConcreteColour);
	SpawnBlock(DepotCentre + FVector(-YardSize * 0.5f, YardSize * 0.5f, WallHeight * 0.5f),
		FVector(40.f, YardSize * 0.5f, WallHeight), ConcreteColour);
	SpawnBlock(DepotCentre + FVector(-YardSize * 0.5f, -YardSize * 0.5f, WallHeight * 0.5f),
		FVector(40.f, YardSize * 0.5f, WallHeight), ConcreteColour);
	SpawnBlock(DepotCentre + FVector(0.f, YardSize * 0.5f, WallHeight * 0.5f),
		FVector(YardSize, 40.f, WallHeight), ConcreteColour);
	SpawnBlock(DepotCentre + FVector(0.f, -YardSize * 0.5f, WallHeight * 0.5f),
		FVector(YardSize, 40.f, WallHeight), ConcreteColour);

	// Two warehouse blocks and a loading ramp.
	SpawnBlock(DepotCentre + FVector(0.f, 14.f * Metre, 350.f),
		FVector(26.f * Metre, 14.f * Metre, 700.f), ConcreteColour);

	SpawnBlock(DepotCentre + FVector(-14.f * Metre, -14.f * Metre, 220.f),
		FVector(14.f * Metre, 12.f * Metre, 440.f), ConcreteColour);

	SpawnBlock(DepotCentre + FVector(14.f * Metre, -16.f * Metre, 40.f),
		FVector(10.f * Metre, 6.f * Metre, 80.f), EmplacementColour);

	// Crate stacks: cover in the depot yard and the visual language of a supply dump.
	for (int32 Row = 0; Row < 4; ++Row)
	{
		for (int32 Col = 0; Col < 3; ++Col)
		{
			SpawnBlock(
				DepotCentre + FVector(-8.f * Metre + Row * 150.f, -6.f * Metre + Col * 130.f, 60.f),
				FVector(120.f, 110.f, 120.f),
				EmplacementColour);
		}
	}
}

void ASPGrayboxLevel::BuildWireAndObstacles()
{
	// Concertina wire lines in front of the rampart: low, thin, non-walkable cover
	// that will later become a real hazard volume.
	const float WireX = (CanalWidth * 0.5f) + 1600.f;
	for (int32 i = -6; i <= 6; ++i)
	{
		SpawnBlock(FVector(WireX, i * 700.f, 35.f),
			FVector(60.f, 600.f, 70.f),
			EmplacementColour,
			/*bCollision*/ true);
	}

	// Anti-tank ditch east of the wire.
	SpawnBlock(FVector(WireX + 900.f, 0.f, 60.f),
		FVector(500.f, 8000.f, 120.f),
		TrenchColour);
}

void ASPGrayboxLevel::PopulateStrongpoints()
{
	if (!bSpawnEnemies || !EnemyClass || !GetWorld())
	{
		return;
	}

	for (int32 Index = 0; Index < StrongpointCentres.Num(); ++Index)
	{
		const FVector Centre = StrongpointCentres[Index];

		for (int32 Slot = 0; Slot < EnemiesPerStrongpoint; ++Slot)
		{
			const float Angle = (2.f * PI * Slot) / FMath::Max(EnemiesPerStrongpoint, 1);
			const FVector Offset(FMath::Cos(Angle) * 500.f, FMath::Sin(Angle) * 500.f, 120.f);

			FActorSpawnParameters Params;
			Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

			ASPEnemyCharacter* Enemy = GetWorld()->SpawnActor<ASPEnemyCharacter>(
				EnemyClass, Centre + Offset, FRotator(0.f, 180.f, 0.f), Params);

			if (Enemy)
			{
				Enemy->ConfigureForEra(LayoutEra);
			}
		}
	}

	UE_LOG(LogShadowProtocol, Log, TEXT("Populated %d strongpoints with hostiles."), StrongpointCentres.Num());
}
