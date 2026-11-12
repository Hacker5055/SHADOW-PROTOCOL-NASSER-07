// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPProgressSubsystem.h"
#include "Core/SPSaveGame.h"

#include "Engine/GameInstance.h"
#include "Kismet/GameplayStatics.h"
#include "ShadowProtocol.h"

void USPProgressSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	LoadProgress();
	UE_LOG(LogShadowProtocol, Log, TEXT("Progress subsystem online (chapter %d unlocked, %d intel)."),
		Progress.ChaptersUnlocked, Progress.CollectedIntel.Num());
}

void USPProgressSubsystem::Deinitialize()
{
	SaveProgress();
	Super::Deinitialize();
}

USPProgressSubsystem* USPProgressSubsystem::Get(const UObject* Context)
{
	if (!Context)
	{
		return nullptr;
	}
	if (const UWorld* World = Context->GetWorld())
	{
		if (const UGameInstance* GameInstance = World->GetGameInstance())
		{
			return GameInstance->GetSubsystem<USPProgressSubsystem>();
		}
	}
	return nullptr;
}

void USPProgressSubsystem::SetProgress(const FSPCampaignProgress& InProgress)
{
	Progress = InProgress;
	OnProgressChanged.Broadcast(Progress);
}

void USPProgressSubsystem::SetDifficulty(ESPDifficulty NewDifficulty)
{
	Progress.Difficulty = NewDifficulty;
	OnProgressChanged.Broadcast(Progress);
	SaveProgress();
}

void USPProgressSubsystem::CompleteChapter(int32 ChapterIndex)
{
	if (!Progress.ChaptersCompleted.Contains(ChapterIndex))
	{
		Progress.ChaptersCompleted.Add(ChapterIndex);
	}
	Progress.ChaptersUnlocked = FMath::Max(Progress.ChaptersUnlocked, ChapterIndex + 1);

	OnProgressChanged.Broadcast(Progress);
	SaveProgress();
}

void USPProgressSubsystem::RecordIntel(FName IntelId)
{
	if (Progress.CollectedIntel.Contains(IntelId))
	{
		return;
	}
	Progress.CollectedIntel.Add(IntelId);
	OnProgressChanged.Broadcast(Progress);
	SaveProgress();
}

void USPProgressSubsystem::SetFlag(FName FlagName, bool bValue)
{
	Progress.Flags.Add(FlagName, bValue);
	OnFlagChanged.Broadcast(FlagName);
	OnProgressChanged.Broadcast(Progress);
	SaveProgress();
}

bool USPProgressSubsystem::GetFlag(FName FlagName) const
{
	const bool* Found = Progress.Flags.Find(FlagName);
	return Found ? *Found : false;
}

void USPProgressSubsystem::RecordCasualty()
{
	Progress.Casualties++;
	OnProgressChanged.Broadcast(Progress);
	SaveProgress();
}

void USPProgressSubsystem::AddPlayTime(float Seconds)
{
	Progress.PlayTimeSeconds += Seconds;
}

ESPEnding USPProgressSubsystem::ResolveEnding() const
{
	const bool bTrustAdel = GetFlag(TEXT("TRUST_ADEL"));
	const bool bSavedMariam = GetFlag(TEXT("SAVED_MARIAM"));
	const bool bPublished = GetFlag(TEXT("PUBLISHED_LEDGER"));
	const bool bSparedCurator = GetFlag(TEXT("SPARED_CURATOR"));

	// Secret epilogue takes priority when fully explored.
	if (Progress.CollectedIntel.Num() >= TotalIntelDocuments && bTrustAdel && bSavedMariam)
	{
		return ESPEnding::QuietChoice;
	}

	if (bTrustAdel && bSavedMariam && bPublished)
	{
		return ESPEnding::CleanHands;
	}

	if (!bPublished && bSparedCurator && Progress.Casualties < 2)
	{
		return ESPEnding::TheLedger;
	}

	return ESPEnding::Inheritance;
}

FText USPProgressSubsystem::GetEndingTitle(ESPEnding Ending) const
{
	switch (Ending)
	{
	case ESPEnding::CleanHands:
		return NSLOCTEXT("ShadowProgress", "CleanHands", "CLEAN HANDS");
	case ESPEnding::TheLedger:
		return NSLOCTEXT("ShadowProgress", "TheLedger", "THE LEDGER");
	case ESPEnding::QuietChoice:
		return NSLOCTEXT("ShadowProgress", "QuietChoice", "THE QUIET CHOICE");
	case ESPEnding::Inheritance:
	default:
		return NSLOCTEXT("ShadowProgress", "Inheritance", "INHERITANCE");
	}
}

bool USPProgressSubsystem::SaveProgress(const FString& SlotName)
{
	CurrentSlotName = SlotName;

	USPSaveGame* Save = CachedSave;
	if (!Save)
	{
		Save = Cast<USPSaveGame>(UGameplayStatics::CreateSaveGameObject(USPSaveGame::StaticClass()));
		CachedSave = Save;
	}

	if (!Save)
	{
		return false;
	}

	Save->Campaign = Progress;
	Save->SaveSlotName = SlotName;
	Save->LastSaved = FDateTime::UtcNow();

	return UGameplayStatics::SaveGameToSlot(Save, SlotName, 0);
}

bool USPProgressSubsystem::LoadProgress(const FString& SlotName)
{
	CurrentSlotName = SlotName;

	if (!UGameplayStatics::DoesSaveGameExist(SlotName, 0))
	{
		// Fresh campaign: sensible defaults.
		Progress = FSPCampaignProgress();
		OnProgressChanged.Broadcast(Progress);
		return false;
	}

	USPSaveGame* Loaded = Cast<USPSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, 0));
	if (!Loaded)
	{
		return false;
	}

	CachedSave = Loaded;
	Progress = Loaded->Campaign;
	OnProgressChanged.Broadcast(Progress);
	return true;
}

void USPProgressSubsystem::ResetProgress()
{
	Progress = FSPCampaignProgress();
	if (CachedSave)
	{
		CachedSave->Campaign = Progress;
	}
	SaveProgress(CurrentSlotName);
	OnProgressChanged.Broadcast(Progress);
}

bool USPProgressSubsystem::HasSaveGame() const
{
	return UGameplayStatics::DoesSaveGameExist(CurrentSlotName, 0);
}
