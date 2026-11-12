// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Core/SPMenuSubsystem.h"
#include "SPMainMenuController.generated.h"

class USPMainMenuWidget;

/**
 * ASPMainMenuController
 *
 * The front end's controller: owns the menu widget, mouse focus and the
 * keyboard/gamepad navigation. It never decides anything itself — every action
 * is delegated to USPMenuSubsystem, so the menu cannot drift from the save state.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPMainMenuController : public APlayerController
{
	GENERATED_BODY()

public:
	ASPMainMenuController();

	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;

	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	void OpenMenuWidget();

	UFUNCTION(BlueprintPure, Category = "Shadow|Menu")
	USPMainMenuWidget* GetMenuWidget() const { return MenuWidget; }

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Menu")
	TSubclassOf<USPMainMenuWidget> MenuWidgetClass = nullptr;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Menu")
	TObjectPtr<USPMainMenuWidget> MenuWidget = nullptr;

protected:
	void Input_Back();

	UFUNCTION()
	void HandleMenuError(const FText& Message, const FText& MessageArabic);

	UFUNCTION()
	void HandleScreenChanged(ESPMenuScreen NewScreen);
};
