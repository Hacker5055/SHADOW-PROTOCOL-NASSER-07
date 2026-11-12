// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "UI/SPMainMenuWidget.h"
#include "Core/SPGameUserSettings.h"

#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

USPMenuSubsystem* USPMainMenuWidget::GetMenuSubsystem() const
{
	if (const UWorld* World = GetWorld())
	{
		if (UGameInstance* GameInstance = World->GetGameInstance())
		{
			return GameInstance->GetSubsystem<USPMenuSubsystem>();
		}
	}
	return nullptr;
}

void USPMainMenuWidget::NativeConstruct()
{
	Super::NativeConstruct();

	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->OnMenuError.AddDynamic(this, &USPMainMenuWidget::HandleMenuError);
		Menu->OnScreenChanged.AddDynamic(this, &USPMainMenuWidget::HandleScreenChanged);
		Menu->OnChapterListBuilt.AddDynamic(this, &USPMainMenuWidget::HandleChapterListBuilt);
	}

	Refresh();
}

void USPMainMenuWidget::Refresh()
{
	USPMenuSubsystem* Menu = GetMenuSubsystem();
	if (!Menu)
	{
		return;
	}

	bCanContinue = Menu->CanContinue();
	Chapters = Menu->GetChapterList();
	CurrentScreen = Menu->GetScreen();

	// The front end sits in the 1973 skin: the campaign opens on that chapter.
	bShowPeriodSkin = true;

	OnMenuStateChanged();
}

void USPMainMenuWidget::NewCampaign()
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->StartNewCampaign(SelectedDifficulty);
	}
	Refresh();
}

void USPMainMenuWidget::ContinueGame()
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->ContinueCampaign();
	}
	Refresh();
}

void USPMainMenuWidget::OpenChapterSelect()
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->SetScreen(ESPMenuScreen::ChapterSelect);
	}
}

void USPMainMenuWidget::OpenSettings()
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->SetScreen(ESPMenuScreen::Settings);
	}
}

void USPMainMenuWidget::OpenCredits()
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->SetScreen(ESPMenuScreen::Credits);
	}
}

void USPMainMenuWidget::BackToMain()
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->ShowMainMenu();
	}
}

void USPMainMenuWidget::QuitGame()
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->QuitToDesktop();
	}
}

void USPMainMenuWidget::SelectChapter(int32 ChapterIndex)
{
	if (USPMenuSubsystem* Menu = GetMenuSubsystem())
	{
		Menu->OpenChapter(ChapterIndex);
	}
}

void USPMainMenuWidget::SetDifficulty(ESPDifficulty NewDifficulty)
{
	SelectedDifficulty = NewDifficulty;

	if (USPGameUserSettings* Settings = USPGameUserSettings::Get())
	{
		Settings->SaveShadowSettings();
	}

	OnDifficultyChanged(SelectedDifficulty);
}

void USPMainMenuWidget::ShowError(const FText& Message)
{
	ErrorMessage = Message;
	bErrorVisible = true;
	OnErrorShown(Message);
}

void USPMainMenuWidget::HandleMenuError(const FText& Message, const FText& MessageArabic)
{
	(void)MessageArabic;
	ShowError(Message);
}

void USPMainMenuWidget::HandleScreenChanged(ESPMenuScreen NewScreen)
{
	CurrentScreen = NewScreen;
	bErrorVisible = false;
	Refresh();
}

void USPMainMenuWidget::HandleChapterListBuilt(const TArray<FSPChapterEntry>& InChapters)
{
	Chapters = InChapters;
	OnMenuStateChanged();
}
