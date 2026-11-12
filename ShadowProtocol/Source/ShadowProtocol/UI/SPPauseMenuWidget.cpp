// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "UI/SPPauseMenuWidget.h"
#include "Core/SPPlayerController.h"
#include "Core/SPGameMode.h"

#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetSystemLibrary.h"

ASPPlayerController* USPPauseMenuWidget::GetSPController() const
{
	return Cast<ASPPlayerController>(GetOwningPlayer());
}

void USPPauseMenuWidget::Resume()
{
	if (ASPPlayerController* PC = GetSPController())
	{
		PC->TogglePauseMenu();
	}
}

void USPPauseMenuWidget::RestartFromCheckpoint()
{
	if (ASPPlayerController* PC = GetSPController())
	{
		PC->TogglePauseMenu();
	}

	if (UWorld* World = GetWorld())
	{
		if (ASPGameMode* GM = World->GetAuthGameMode<ASPGameMode>())
		{
			GM->RestoreLastCheckpoint();
		}
	}
}

void USPPauseMenuWidget::QuitToMainMenu()
{
	UGameplayStatics::SetGamePaused(this, false);
	UGameplayStatics::OpenLevel(this, MainMenuLevelName);
}

void USPPauseMenuWidget::SetSensitivity(float NewSensitivity)
{
	Sensitivity = FMath::Clamp(NewSensitivity, 0.1f, 3.f);
	if (ASPPlayerController* PC = GetSPController())
	{
		PC->ApplySensitivity(Sensitivity);
	}
}

void USPPauseMenuWidget::SetInvertY(bool bInvert)
{
	bInvertY = bInvert;
	if (ASPPlayerController* PC = GetSPController())
	{
		PC->ApplyInvertY(bInvertY);
	}
}

void USPPauseMenuWidget::SetArabicSubtitles(bool bEnabled)
{
	bArabicSubtitles = bEnabled;
	if (ASPPlayerController* PC = GetSPController())
	{
		PC->ApplySubtitleLanguage(bArabicSubtitles);
	}
}
