// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPPlayerController.generated.h"

class USPHUDWidget;
class USPPauseMenuWidget;
class UInputMappingContext;
class UInputAction;
class ASPCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnHUDVisibilityChanged, bool, bVisible);

/**
 * ASPPlayerController
 *
 * Owns the player's UI layer, input contexts, pause/tactical-map routing and the
 * cinematic letterbox state. All HUD data flows through the controller so the
 * widgets stay presentation-only.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ASPPlayerController();

	virtual void BeginPlay() override;
	virtual void SetupInputComponent() override;
	virtual void OnPossess(APawn* InPawn) override;

	// ------------------------------------------------------------- UI
	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void CreateHUD();

	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void SetHUDVisible(bool bVisible);

	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void SetCinematicMode(bool bEnabled, bool bShowLetterbox = true);

	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void TogglePauseMenu();

	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void ToggleTacticalMap();

	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void ShowSubtitle(const FText& Speaker, const FText& Line, bool bRadio);

	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void ShowNotification(const FText& Message, FLinearColor Colour);

	UFUNCTION(BlueprintCallable, Category = "Shadow|UI")
	void SetInteractionPrompt(const FText& Text, bool bShow);

	UFUNCTION(BlueprintPure, Category = "Shadow|UI")
	USPHUDWidget* GetHUD() const { return HUDWidget; }

	// ------------------------------------------------------------- settings
	UFUNCTION(BlueprintCallable, Category = "Shadow|Settings")
	void ApplySensitivity(float NewSensitivity);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Settings")
	void ApplyInvertY(bool bInvert);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Settings")
	void ApplySubtitleLanguage(bool bArabicSubtitles);

	UFUNCTION(BlueprintPure, Category = "Shadow|Settings")
	bool IsUsingArabicSubtitles() const;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|UI|Events")
	FSPOnHUDVisibilityChanged OnHUDVisibilityChanged;

	// ------------------------------------------------------------- classes
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|UI")
	TSubclassOf<USPHUDWidget> HUDWidgetClass = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|UI")
	TSubclassOf<USPPauseMenuWidget> PauseMenuClass = nullptr;

	// ------------------------------------------------------------- state
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|UI")
	TObjectPtr<USPHUDWidget> HUDWidget = nullptr;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|UI")
	TObjectPtr<USPPauseMenuWidget> PauseMenuWidget = nullptr;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|UI")
	bool bCinematicMode = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|UI")
	bool bTacticalMapOpen = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Settings")
	bool bArabicSubtitles = false;

protected:
	void Input_Pause();
	void Input_TacticalMap();
	void Input_SquadMove();
	void Input_SquadHold();
	void Input_SquadBreach();
	void Input_SquadRecon();
	void Input_SquadRevive();
	void PushSquadOrder(ESPSquadOrder Order);
	ASPCharacter* GetSPCharacter() const;

	/** Dynamic delegates need UFUNCTION handlers with matching signatures. */
	UFUNCTION()
	void HandlePlayerDeath(AActor* Killer);

	UFUNCTION()
	void HandleGameModeSubtitle(const FText& Speaker, const FText& Line);

	/** Enhanced Input contexts, assigned in the Blueprint child. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Input")
	TArray<TObjectPtr<UInputMappingContext>> MappingContexts;

	FTimerHandle HUDRefreshTimer;
};
