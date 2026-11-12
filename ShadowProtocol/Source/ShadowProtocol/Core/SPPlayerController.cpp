// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPPlayerController.h"
#include "Core/SPGameMode.h"
#include "Character/SPCharacter.h"
#include "Character/SPCharacterMovementComponent.h"
#include "UI/SPHUDWidget.h"
#include "UI/SPPauseMenuWidget.h"
#include "Core/SPGameUserSettings.h"

#include "Kismet/GameplayStatics.h"
#include "Blueprint/UserWidget.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPPlayerController::ASPPlayerController()
{
	bShowMouseCursor = false;
}

void ASPPlayerController::BeginPlay()
{
	Super::BeginPlay();

	// Pull persisted options before the HUD is built so the first frame is correct.
	if (USPGameUserSettings* Settings = USPGameUserSettings::Get())
	{
		bArabicSubtitles = Settings->bArabicSubtitles;
	}

	CreateHUD();

	// Bind to the game mode's narrative events so subtitles and notifications
	// arrive from a single source.
	if (ASPGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ASPGameMode>() : nullptr)
	{
		GM->OnSubtitle.AddDynamic(this, &ASPPlayerController::HandleGameModeSubtitle);
	}

	if (ASPCharacter* Player = GetSPCharacter())
	{
		Player->OnDeath.AddUniqueDynamic(this, &ASPPlayerController::HandlePlayerDeath);
	}
}

void ASPPlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	CreateHUD();

	if (ASPCharacter* Player = Cast<ASPCharacter>(InPawn))
	{
		Player->OnDeath.AddUniqueDynamic(this, &ASPPlayerController::HandlePlayerDeath);
	}
}

void ASPPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	if (!InputComponent)
	{
		return;
	}

	InputComponent->BindAction(TEXT("Pause"), IE_Pressed, this, &ASPPlayerController::Input_Pause);
	InputComponent->BindAction(TEXT("TacticalMap"), IE_Pressed, this, &ASPPlayerController::Input_TacticalMap);

	// Squad orders live on the controller because they are commands to the
	// game mode rather than character abilities.
	InputComponent->BindAction(TEXT("SquadMove"), IE_Pressed, this, &ASPPlayerController::Input_SquadMove);
	InputComponent->BindAction(TEXT("SquadHold"), IE_Pressed, this, &ASPPlayerController::Input_SquadHold);
	InputComponent->BindAction(TEXT("SquadBreach"), IE_Pressed, this, &ASPPlayerController::Input_SquadBreach);
	InputComponent->BindAction(TEXT("SquadRecon"), IE_Pressed, this, &ASPPlayerController::Input_SquadRecon);
	InputComponent->BindAction(TEXT("SquadRevive"), IE_Pressed, this, &ASPPlayerController::Input_SquadRevive);
}

void ASPPlayerController::CreateHUD()
{
	if (HUDWidget || !HUDWidgetClass || !IsLocalController())
	{
		return;
	}

	HUDWidget = CreateWidget<USPHUDWidget>(this, HUDWidgetClass);
	if (HUDWidget)
	{
		HUDWidget->SetArabicSubtitles(bArabicSubtitles);
		HUDWidget->AddToViewport(10);
		OnHUDVisibilityChanged.Broadcast(true);
	}
}

void ASPPlayerController::SetHUDVisible(bool bVisible)
{
	if (HUDWidget)
	{
		HUDWidget->SetVisibility(bVisible ? ESlateVisibility::SelfHitTestInvisible : ESlateVisibility::Collapsed);
		OnHUDVisibilityChanged.Broadcast(bVisible);
	}
}

void ASPPlayerController::SetCinematicMode(bool bEnabled, bool bShowLetterbox)
{
	bCinematicMode = bEnabled;

	SetIgnoreMoveInput(bEnabled);
	SetIgnoreLookInput(bEnabled);

	if (HUDWidget)
	{
		// In cinematics only the subtitle band stays; the combat HUD is hidden.
		HUDWidget->SetVisibility(bEnabled ? ESlateVisibility::HitTestInvisible : ESlateVisibility::SelfHitTestInvisible);
		HUDWidget->SetCinematicLetterbox(bEnabled && bShowLetterbox);
	}
}

void ASPPlayerController::TogglePauseMenu()
{
	if (!PauseMenuClass)
	{
		return;
	}

	if (!PauseMenuWidget)
	{
		PauseMenuWidget = CreateWidget<USPPauseMenuWidget>(this, PauseMenuClass);
	}

	if (!PauseMenuWidget)
	{
		return;
	}

	const bool bNowPaused = !UGameplayStatics::IsGamePaused(this);
	UGameplayStatics::SetGamePaused(this, bNowPaused);

	if (bNowPaused)
	{
		PauseMenuWidget->AddToViewport(50);
		bShowMouseCursor = true;
		SetInputMode(FInputModeGameAndUI().SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock));
	}
	else
	{
		PauseMenuWidget->RemoveFromParent();
		bShowMouseCursor = false;
		SetInputMode(FInputModeGameOnly());
	}
}

void ASPPlayerController::ToggleTacticalMap()
{
	bTacticalMapOpen = !bTacticalMapOpen;

	// The tactical map is a real overlay: the world keeps running (it is a
	// live map, not a pause screen) and the HUD swaps to its map layer.
	if (HUDWidget)
	{
		HUDWidget->SetTacticalMapOpen(bTacticalMapOpen);
	}

	if (ASPGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ASPGameMode>() : nullptr)
	{
		GM->NotifyTacticalMapToggle();
	}
}

void ASPPlayerController::ShowSubtitle(const FText& Speaker, const FText& Line, bool bRadio)
{
	if (HUDWidget)
	{
		HUDWidget->ShowSubtitleLine(Speaker, Line, bRadio);
	}
}

void ASPPlayerController::ShowNotification(const FText& Message, FLinearColor Colour)
{
	if (HUDWidget)
	{
		HUDWidget->FlashNotification(Message, Colour);
	}
}

void ASPPlayerController::SetInteractionPrompt(const FText& Text, bool bShow)
{
	if (HUDWidget)
	{
		HUDWidget->SetInteractionPrompt(Text, bShow);
	}
}

void ASPPlayerController::HandleGameModeSubtitle(const FText& Speaker, const FText& Line)
{
	// Game-mode subtitles are radio traffic by default.
	ShowSubtitle(Speaker, Line, true);
}

bool ASPPlayerController::IsUsingArabicSubtitles() const
{
	return bArabicSubtitles;
}

void ASPPlayerController::ApplySensitivity(float NewSensitivity)
{
	// Single source of truth: the settings object. The character reads the same
	// value so mouse and stick input stay consistent.
	if (USPGameUserSettings* Settings = USPGameUserSettings::Get())
	{
		Settings->LookSensitivity = FMath::Clamp(NewSensitivity, 0.1f, 3.f);
		Settings->SaveShadowSettings();
	}

	if (ASPCharacter* Player = GetSPCharacter())
	{
		Player->SetLookSensitivity(NewSensitivity);
	}
}

void ASPPlayerController::ApplyInvertY(bool bInvert)
{
	if (USPGameUserSettings* Settings = USPGameUserSettings::Get())
	{
		Settings->bInvertY = bInvert;
		Settings->SaveShadowSettings();
	}

	if (ASPCharacter* Player = GetSPCharacter())
	{
		Player->SetInvertY(bInvert);
	}
}

void ASPPlayerController::ApplySubtitleLanguage(bool bArabicSubtitles)
{
	if (USPGameUserSettings* Settings = USPGameUserSettings::Get())
	{
		Settings->bArabicSubtitles = bArabicSubtitles;
		Settings->SaveShadowSettings();
	}

	bArabicSubtitles = bArabicSubtitles;
	if (HUDWidget)
	{
		HUDWidget->SetArabicSubtitles(bArabicSubtitles);
	}
}

void ASPPlayerController::HandlePlayerDeath(AActor* Killer)
{
	(void)Killer;

	if (HUDWidget)
	{
		HUDWidget->SetVisibility(ESlateVisibility::HitTestInvisible);
	}

	SetIgnoreMoveInput(false);
}

ASPCharacter* ASPPlayerController::GetSPCharacter() const
{
	return Cast<ASPCharacter>(GetPawn());
}

void ASPPlayerController::PushSquadOrder(ESPSquadOrder Order)
{
	if (ASPGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ASPGameMode>() : nullptr)
	{
		GM->IssueSquadOrder(Order, GetSPCharacter());
	}
}

void ASPPlayerController::Input_Pause()
{
	if (bCinematicMode)
	{
		return;
	}
	TogglePauseMenu();
}

void ASPPlayerController::Input_TacticalMap()
{
	ToggleTacticalMap();
}

void ASPPlayerController::Input_SquadMove()   { PushSquadOrder(ESPSquadOrder::MoveTo); }
void ASPPlayerController::Input_SquadHold()   { PushSquadOrder(ESPSquadOrder::Hold); }
void ASPPlayerController::Input_SquadBreach() { PushSquadOrder(ESPSquadOrder::Breach); }
void ASPPlayerController::Input_SquadRecon()  { PushSquadOrder(ESPSquadOrder::Recon); }
void ASPPlayerController::Input_SquadRevive() { PushSquadOrder(ESPSquadOrder::Revive); }
