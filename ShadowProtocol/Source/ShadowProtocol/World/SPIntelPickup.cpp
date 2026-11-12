// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "World/SPIntelPickup.h"
#include "Mission/SPMissionManager.h"
#include "Character/SPCharacter.h"
#include "Core/SPGameMode.h"
#include "Core/SPPlayerController.h"

#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPIntelPickup::ASPIntelPickup()
{
	PrimaryActorTick.bCanEverTick = true;

	InteractionSphere = CreateDefaultSubobject<USphereComponent>(TEXT("InteractionSphere"));
	InteractionSphere->SetSphereRadius(InteractionRadius);
	InteractionSphere->SetCollisionProfileName(TEXT("Trigger"));
	InteractionSphere->SetGenerateOverlapEvents(true);
	RootComponent = InteractionSphere;

	DocumentMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("DocumentMesh"));
	DocumentMesh->SetupAttachment(InteractionSphere);
	DocumentMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	DocumentMesh->SetRelativeScale3D(FVector(0.35f));
}

void ASPIntelPickup::BeginPlay()
{
	Super::BeginPlay();

	// Tagged so ASPGameMode::NotifyPlayerInteract can find us without a cast.
	Tags.AddUnique(TEXT("Intel"));

	InteractionSphere->SetSphereRadius(InteractionRadius);
	InteractionSphere->OnComponentBeginOverlap.AddDynamic(this, &ASPIntelPickup::HandleBeginOverlap);
	InteractionSphere->OnComponentEndOverlap.AddDynamic(this, &ASPIntelPickup::HandleEndOverlap);

	BaseMeshLocation = DocumentMesh->GetRelativeLocation();

	// The interactable's FName is the reliable identity used by the interaction
	// route; do not rely on editor-only actor labels.
	if (IntelId.IsNone())
	{
		UE_LOG(LogShadowProtocol, Warning, TEXT("Intel pickup '%s' has no IntelId assigned."), *GetName());
	}
}

void ASPIntelPickup::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bCollected)
	{
		return;
	}

	// Subtle float so documents read as interactive without a glowing outline.
	BobTime += DeltaSeconds;
	const float Offset = FMath::Sin(BobTime * 1.6f) * 4.f;
	DocumentMesh->SetRelativeLocation(BaseMeshLocation + FVector(0.f, 0.f, Offset));
}

void ASPIntelPickup::HandleBeginOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
	UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult)
{
	(void)OverlappedComponent; (void)OtherComp; (void)OtherBodyIndex; (void)bFromSweep; (void)SweepResult;

	if (bCollected || !OtherActor || !OtherActor->IsA<ASPCharacter>())
	{
		return;
	}

	bPlayerInRange = true;
	ShowPrompt(true);

	// Documents flagged as automatic are absorbed on touch; the rest need the
	// interact key so the player reads them deliberately.
	if (!bRequiresInteraction)
	{
		TryCollect(OtherActor);
	}

}

void ASPIntelPickup::HandleEndOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor,
	UPrimitiveComponent* OtherComp, int32 OtherBodyIndex)
{
	(void)OverlappedComponent; (void)OtherComp; (void)OtherBodyIndex;

	if (OtherActor && OtherActor->IsA<ASPCharacter>())
	{
		bPlayerInRange = false;
		ShowPrompt(false);
	}
}

bool ASPIntelPickup::TryCollect(AActor* Collector)
{
	if (bCollected || IntelId.IsNone() || !Collector)
	{
		return false;
	}

	if (!MissionManager)
	{
		for (TActorIterator<ASPMissionManager> It(GetWorld()); It; ++It)
		{
			MissionManager = *It;
			break;
		}
	}

	if (MissionManager)
	{
		if (!MissionManager->CollectIntel(IntelId))
		{
			// Already collected, or an authoring mismatch. Either way the pickup
			// is consumed so the level never leaves a dead interactable behind.
			UE_LOG(LogShadowProtocol, Warning,
				TEXT("Intel '%s' was already recorded or missing from the mission data."),
				*IntelId.ToString());
		}
	}
	else
	{
		UE_LOG(LogShadowProtocol, Warning,
			TEXT("Intel '%s' collected with no mission manager present."), *IntelId.ToString());
	}

	bCollected = true;
	ShowPrompt(false);

	if (PickupSound)
	{
		UGameplayStatics::PlaySoundAtLocation(this, PickupSound, GetActorLocation());
	}

	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		const FText Title = DisplayTitle.IsEmpty() ? FText::FromName(IntelId) : DisplayTitle;
		GM->PushSubtitle(NSLOCTEXT("ShadowIntel", "IntelHeader", "INTELLIGENCE"),
			FText::Format(NSLOCTEXT("ShadowIntel", "IntelCollected", "Recovered: {0}"), Title), false);
	}

	SetActorHiddenInGame(true);
	SetActorEnableCollision(false);
	SetLifeSpan(0.5f);
	return true;
}

void ASPIntelPickup::ShowPrompt(bool bShow)
{
	// The HUD owns the visual language; the pickup just reports proximity.
	if (ASPPlayerController* PC = Cast<ASPPlayerController>(UGameplayStatics::GetPlayerController(this, 0)))
	{
		const FText Title = DisplayTitle.IsEmpty() ? FText::FromName(IntelId) : DisplayTitle;
		const FText Prompt = FText::Format(
			NSLOCTEXT("ShadowIntel", "RecoverPrompt", "[E]  RECOVER: {0}"), Title);
		PC->SetInteractionPrompt(Prompt, bShow);
	}
}
