// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "World/SPObjectiveTrigger.h"
#include "Mission/SPMissionManager.h"
#include "Core/SPGameMode.h"
#include "Character/SPCharacter.h"

#include "Components/BoxComponent.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPObjectiveTrigger::ASPObjectiveTrigger()
{
	PrimaryActorTick.bCanEverTick = false;

	TriggerVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("TriggerVolume"));
	TriggerVolume->SetBoxExtent(FVector(400.f, 400.f, 200.f));
	TriggerVolume->SetCollisionProfileName(TEXT("Trigger"));
	TriggerVolume->SetGenerateOverlapEvents(true);
	RootComponent = TriggerVolume;
}

void ASPObjectiveTrigger::BeginPlay()
{
	Super::BeginPlay();

	TriggerVolume->OnComponentBeginOverlap.AddDynamic(this, &ASPObjectiveTrigger::HandleBeginOverlap);

	if (ObjectiveId.IsNone())
	{
		UE_LOG(LogShadowProtocol, Warning, TEXT("Objective trigger '%s' has no ObjectiveId."), *GetName());
	}
}

void ASPObjectiveTrigger::HandleBeginOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
	UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult)
{
	(void)OverlappedComponent; (void)OtherComp; (void)OtherBodyIndex; (void)bFromSweep; (void)SweepResult;

	if (bFired && bTriggerOnce)
	{
		return;
	}

	if (!OtherActor || !OtherActor->IsA<ASPCharacter>())
	{
		return;
	}

	ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>();
	if (bRequireAllSquadAlive && GM && GM->GetAliveSquadCount() == 0)
	{
		return;
	}

	ASPMissionManager* Mission = nullptr;
	for (TActorIterator<ASPMissionManager> It(GetWorld()); It; ++It)
	{
		Mission = *It;
		break;
	}

	if (!Mission)
	{
		UE_LOG(LogShadowProtocol, Warning, TEXT("Objective trigger fired with no mission manager."));
		return;
	}

	Mission->CompleteObjective(ObjectiveId);
	bFired = true;

	if (!CompletionLine.IsEmpty() && GM)
	{
		GM->PushSubtitle(FText::GetEmpty(), CompletionLine, false);
	}

	if (CompletionSound)
	{
		UGameplayStatics::PlaySoundAtLocation(this, CompletionSound, GetActorLocation());
	}
}
