// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPMainMenuController.h"
#include "UI/SPMainMenuWidget.h"

#include "Blueprint/UserWidget.h"
#include "Engine/World.h"
#include "ShadowProtocol.h"

ASPMainMenuController::ASPMainMenuController()
{
	bShowMouseCursor = true;
	bEnableClickEvents = true;
	bEnableMouseOverEvents = true;
}

void ASPMainMenuController::BeginPlay()
{
	Super::BeginPlay();

	OpenMenuWidget();

	if (UWorld* World = GetWorld())
	{
		if (UGameInstance* GameInstance = World->GetGameInstance())
		{
			if (USPMenuSubsystem* Menu = GameInstance->GetSubsystem<USPMenuSubsystem>())
			{
				Menu->OnMenuError.AddDynamic(this, &ASPMainMenuController::HandleMenuError);
				Menu->OnScreenChanged.AddDynamic(this, &ASPMainMenuController::HandleScreenChanged);
			}
		}
	}
}

void ASPMainMenuController::SetupInputComponent()
{
	Super::SetupInputComponent();

	if (InputComponent)
	{
		// Escape backs out of any submenu to the main screen. The widget itself
		// owns the buttons; this only gives the pad/keyboard a reliable exit.
		InputComponent->BindAction(TEXT("Pause"), IE_Pressed, this, &ASPMainMenuController::Input_Back);
	}
}

void ASPMainMenuController::Input_Back()
{
	if (UWorld* World = GetWorld())
	{
		if (UGameInstance* GameInstance = World->GetGameInstance())
		{
			if (USPMenuSubsystem* Menu = GameInstance->GetSubsystem<USPMenuSubsystem>())
			{
				if (Menu->GetScreen() != ESPMenuScreen::Main)
				{
					Menu->ShowMainMenu();
				}
			}
		}
	}
}

void ASPMainMenuController::OpenMenuWidget()
{
	if (MenuWidget)
	{
		return;
	}

	if (!MenuWidgetClass)
	{
		UE_LOG(LogShadowProtocol, Warning,
			TEXT("Main menu: MenuWidgetClass (WBP_MainMenu) is not assigned, so no front end is shown."));
		return;
	}

	MenuWidget = CreateWidget<USPMainMenuWidget>(this, MenuWidgetClass);
	if (MenuWidget)
	{
		MenuWidget->AddToViewport(0);
		SetInputMode(FInputModeUIOnly().SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock));
	}
}

void ASPMainMenuController::HandleMenuError(const FText& Message, const FText& MessageArabic)
{
	(void)MessageArabic;
	UE_LOG(LogShadowProtocol, Warning, TEXT("Menu error surfaced to UI: %s"), *Message.ToString());
}

void ASPMainMenuController::HandleScreenChanged(ESPMenuScreen NewScreen)
{
	// Coming back to the main screen restores mouse focus if a submenu stole it.
	if (NewScreen == ESPMenuScreen::Main)
	{
		SetInputMode(FInputModeUIOnly().SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock));
	}
}
