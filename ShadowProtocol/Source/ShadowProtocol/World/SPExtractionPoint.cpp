// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "World/SPExtractionPoint.h"
#include "Mission/SPMissionManager.h"
#include "Core/SPGameMode.h"
#include "Character/SPCharacter.h"
#include "AI/SPSquadMember.h"
#include "Core/SPPlayerController.h"

#include "Components/BoxComponent.h"
#include "Components/TextRenderComponent.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPExtractionPoint::ASPExtractionPoint()
{
	PrimaryActorTick.bCanEverTick = true;

	Zone = CreateDefaultSubobject<UBoxComponent>(TEXT("ExtractionZone"));
	Zone->SetBoxExtent(FVector(420.f, 420.f, 200.f));
	Zone->SetCollisionProfileName(TEXT("Trigger"));
	Zone->SetGenerateOverlapEvents(true);
	RootComponent = Zone;

	ZoneLabel = CreateDefaultSubobject<UTextRenderComponent>(TEXT("ZoneLabel"));
	ZoneLabel->SetupAttachment(Zone);
	ZoneLabel->SetText(FText::FromString(TEXT("EXTRACTION")));
	ZoneLabel->SetWorldSize(60.f);
	ZoneLabel->SetHorizontalAlignment(EHTA_Center);
	ZoneLabel->SetRelativeLocation(FVector(0.f, 0.f, 240.f));
}

void ASPExtractionPoint::BeginPlay()
{
	Super::BeginPlay();

	Zone->SetBoxExtent(FVector(ZoneRadius, ZoneRadius, 200.f));
	Zone->OnComponentBeginOverlap.AddDynamic(this, &ASPExtractionPoint::HandleBeginOverlap);
	Zone->OnComponentEndOverlap.AddDynamic(this, &ASPExtractionPoint::HandleEndOverlap);

	if (!ExtractionLabel.IsEmpty())
	{
		ZoneLabel->SetText(ExtractionLabel);
	}
}

void ASPExtractionPoint::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bExtracted)
	{
		return;
	}

	if (!bPlayerInZone)
	{
		HoldElapsed = 0.f;
		return;
	}

	// Squad requirement: the whole team must be at the bird, not just the player.
	if (CountSquadInZone() < RequiredSquadCount)
	{
		HoldElapsed = 0.f;
		return;
	}

	HoldElapsed += DeltaSeconds;
	if (HoldElapsed >= ExtractionHoldSeconds)
	{
		CompleteExtraction();
	}
}

void ASPExtractionPoint::HandleBeginOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
	UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult)
{
	(void)OverlappedComponent; (void)OtherComp; (void)OtherBodyIndex; (void)bFromSweep; (void)SweepResult;

	if (OtherActor && OtherActor->IsA<ASPCharacter>())
	{
		bPlayerInZone = true;
	}
}

void ASPExtractionPoint::HandleEndOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
	UPrimitiveComponent* OtherComp, int32 OtherBodyIndex)
{
	(void)OverlappedComponent; (void)OtherComp; (void)OtherBodyIndex;

	if (OtherActor && OtherActor->IsA<ASPCharacter>())
	{
		bPlayerInZone = false;
	}
}

int32 ASPExtractionPoint::CountSquadInZone() const
{
	int32 Count = 0;
	for (TActorIterator<ASPSquadMember> It(GetWorld()); It; ++It)
	{
		const ASPSquadMember* Member = *It;
		if (!Member || Member->IsKIA())
		{
			continue;
		}
		if (FVector::Dist2D(Member->GetActorLocation(), GetActorLocation()) <= ZoneRadius)
		{
			++Count;
		}
	}
	return Count;
}

void ASPExtractionPoint::CompleteExtraction()
{
	if (bExtracted)
	{
		return;
	}
	bExtracted = true;

	ASPMissionManager* Mission = nullptr;
	for (TActorIterator<ASPMissionManager> It(GetWorld()); It; ++It)
	{
		Mission = *It;
		break;
	}

	if (Mission && !ObjectiveId.IsNone())
	{
		Mission->CompleteObjective(ObjectiveId);
	}

	if (ExtractionCueSound)
	{
		UGameplayStatics::PlaySoundAtLocation(this, ExtractionCueSound, GetActorLocation());
	}

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		const int32 SquadCount = CountSquadInZone();
		OnExtractionComplete.Broadcast(SquadCount);
		GM->PushSubtitle(NSLOCTEXT("ShadowExtraction", "ExtractOk", "EXTRACTION"),
			bOptionalRoute
				? NSLOCTEXT("ShadowExtraction", "AltRoute", "Alternate route secured. Everyone is aboard.")
				: NSLOCTEXT("ShadowExtraction", "MainRoute", "Extraction complete. We're out."),
			false);
	}

	UE_LOG(LogShadowProtocol, Log, TEXT("Extraction point '%s' completed (%d squad aboard)."),
		*ObjectiveId.ToString(), CountSquadInZone());
}
