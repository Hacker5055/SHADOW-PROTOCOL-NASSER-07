// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPMenuSubsystem.h"
#include "Core/SPProgressSubsystem.h"
#include "Core/SPGameUserSettings.h"

#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Misc/Paths.h"
#include "ShadowProtocol.h"

namespace
{
	/** Chapter canon: titles and era, mirroring docs/02_CHAPTERS.md. */
	struct FSPChapterCanon
	{
		int32 Index;
		const TCHAR* Title;
		const TCHAR* TitleArabic;
		const TCHAR* EraLabel;
		const TCHAR* LevelName;
	};

	const FSPChapterCanon ChapterCanon[] =
	{
		{ 1, TEXT("THE CROSSING"),      TEXT("العبور"),           TEXT("EGYPT 1973"),  TEXT("L_GrayboxRange") },
		{ 2, TEXT("THE SILENT MISSION"), TEXT("المهمة الصامتة"),  TEXT("PRESENT DAY"), TEXT("L_Chapter02_Silent") },
		{ 3, TEXT("THE BLACK FILE"),    TEXT("الملف الأسود"),     TEXT("PRESENT DAY"), TEXT("L_Chapter03_Archive") },
		{ 4, TEXT("CITY OF SHADOWS"),   TEXT("مدينة الظلال"),     TEXT("PRESENT DAY"), TEXT("L_Chapter04_City") },
		{ 5, TEXT("BETRAYAL"),          TEXT("الخيانة"),          TEXT("PRESENT DAY"), TEXT("L_Chapter05_Betrayal") },
		{ 6, TEXT("SHADOW PROTOCOL"),   TEXT("بروتوكول الظل"),    TEXT("PRESENT DAY"), TEXT("L_Chapter06_Facility") },
		{ 7, TEXT("THE FINAL LEGACY"),  TEXT("الإرث الأخير"),     TEXT("PRESENT DAY"), TEXT("L_Chapter07_Legacy") },
	};
}

void USPMenuSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	BuildChapterList();
	CurrentScreen = ESPMenuScreen::Main;
}

USPProgressSubsystem* USPMenuSubsystem::Progress() const
{
	if (const UGameInstance* GI = GetGameInstance())
	{
		return GI->GetSubsystem<USPProgressSubsystem>();
	}
	return nullptr;
}

void USPMenuSubsystem::SetScreen(ESPMenuScreen NewScreen)
{
	CurrentScreen = NewScreen;
	OnScreenChanged.Broadcast(CurrentScreen);

	if (NewScreen == ESPMenuScreen::ChapterSelect)
	{
		BuildChapterList();
	}
}

void USPMenuSubsystem::ShowMainMenu()
{
	SetScreen(ESPMenuScreen::Main);
}

void USPMenuSubsystem::BuildChapterList()
{
	Chapters.Reset();

	const USPProgressSubsystem* SaveProgress = Progress();
	const int32 Unlocked = SaveProgress ? SaveProgress->GetProgress().ChaptersUnlocked : 1;

	for (const FSPChapterCanon& Canon : ChapterCanon)
	{
		FSPChapterEntry Entry;
		Entry.Index = Canon.Index;
		Entry.Title = FText::FromString(Canon.Title);
		Entry.TitleArabic = FText::FromString(Canon.TitleArabic);
		Entry.EraLabel = FText::FromString(Canon.EraLabel);
		Entry.LevelName = FName(Canon.LevelName);

		// A chapter is unlocked by progress, and truly playable only when its level
		// exists on disk. Both conditions are reported so the UI can say why a
		// button is disabled instead of pretending it works.
		Entry.bUnlocked = Canon.Index <= Unlocked;
		Entry.bCompleted = SaveProgress
			? SaveProgress->GetProgress().ChaptersCompleted.Contains(Canon.Index)
			: false;

		Chapters.Add(Entry);
	}

	OnChapterListBuilt.Broadcast(Chapters);
}

bool USPMenuSubsystem::CanContinue() const
{
	const USPProgressSubsystem* SaveProgress = Progress();
	if (!SaveProgress)
	{
		return false;
	}
	return SaveProgress->HasSaveGame();
}

bool USPMenuSubsystem::StartNewCampaign(ESPDifficulty Difficulty)
{
	USPProgressSubsystem* SaveProgress = Progress();
	if (!SaveProgress)
	{
		Fail(NSLOCTEXT("ShadowMenu", "NoProgress", "Campaign data unavailable."),
			NSLOCTEXT("ShadowMenu", "NoProgressAr", "بيانات الحملة غير متاحة."));
		return false;
	}

	// A new campaign genuinely resets progress; it does not pretend to and then
	// leave the old save in place.
	SaveProgress->ResetProgress();
	SaveProgress->SetDifficulty(Difficulty);

	if (USPGameUserSettings* Settings = USPGameUserSettings::Get())
	{
		Settings->SaveShadowSettings();
	}

	UE_LOG(LogShadowProtocol, Log, TEXT("New campaign started at difficulty %d"), static_cast<int32>(Difficulty));
	BuildChapterList();
	return OpenChapter(1);
}

bool USPMenuSubsystem::ContinueCampaign()
{
	USPProgressSubsystem* SaveProgress = Progress();
	if (!SaveProgress)
	{
		return false;
	}

	if (!SaveProgress->LoadProgress())
	{
		Fail(NSLOCTEXT("ShadowMenu", "NoSave", "No campaign save found. Start a new campaign."),
			NSLOCTEXT("ShadowMenu", "NoSaveAr", "لا توجد حملة محفوظة. ابدأ حملة جديدة."));
		return false;
	}

	const int32 Next = FMath::Clamp(SaveProgress->GetProgress().ChaptersUnlocked, 1, 7);
	return OpenChapter(Next);
}

bool USPMenuSubsystem::OpenChapter(int32 ChapterIndex)
{
	const FSPChapterEntry* Entry = Chapters.FindByPredicate(
		[ChapterIndex](const FSPChapterEntry& Candidate) { return Candidate.Index == ChapterIndex; });

	if (!Entry)
	{
		Fail(NSLOCTEXT("ShadowMenu", "BadChapter", "That chapter does not exist."),
			NSLOCTEXT("ShadowMenu", "BadChapterAr", "هذا الفصل غير موجود."));
		return false;
	}

	if (!Entry->bUnlocked)
	{
		Fail(NSLOCTEXT("ShadowMenu", "Locked", "This chapter is still locked."),
			NSLOCTEXT("ShadowMenu", "LockedAr", "هذا الفصل مقفل حتى الآن."));
		return false;
	}

	// Never attempt to load a level that has not been authored: report it plainly.
	const FString PackageFile = FPaths::Combine(
		FPaths::ProjectContentDir(), TEXT("Maps"), Entry->LevelName.ToString() + TEXT(".umap"));

	if (!FPaths::FileExists(PackageFile))
	{
		Fail(
			FText::Format(NSLOCTEXT("ShadowMenu", "LevelMissing",
				"'{0}' is not built yet. The first chapter is playable in the graybox range."),
				Entry->Title),
			FText::Format(NSLOCTEXT("ShadowMenu", "LevelMissingAr",
				"«{0}» غير جاهز بعد. الفصل الأول متاح في ميدان التدريب."),
				Entry->TitleArabic));
		return false;
	}

	UE_LOG(LogShadowProtocol, Log, TEXT("Opening chapter %d (%s)"), ChapterIndex, *Entry->LevelName.ToString());

	if (UWorld* World = GetWorld())
	{
		UGameplayStatics::OpenLevel(World, Entry->LevelName);
		return true;
	}
	return false;
}

bool USPMenuSubsystem::QuitToDesktop()
{
	if (UWorld* World = GetWorld())
	{
		UKismetSystemLibrary::QuitGame(World, World->GetFirstPlayerController(),
			EQuitPreference::Quit, false);
		return true;
	}
	return false;
}

void USPMenuSubsystem::Fail(const FText& English, const FText& Arabic)
{
	LastError = English;
	OnMenuError.Broadcast(English, Arabic);
	UE_LOG(LogShadowProtocol, Warning, TEXT("Menu: %s"), *English.ToString());
}
