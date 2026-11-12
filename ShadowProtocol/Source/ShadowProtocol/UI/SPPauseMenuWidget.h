// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "SPPauseMenuWidget.generated.h"

class ASPPlayerController;

/**
 * USPPauseMenuWidget
 *
 * The pause surface: resume, restart checkpoint, settings, quit to main menu.
 * Every button is wired to real functionality — the QC brief forbids decoration.
 */
UCLASS(Abstract, Blueprintable)
class SHADOWPROTOCOL_API USPPauseMenuWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "Menu")
	void Resume();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void RestartFromCheckpoint();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void QuitToMainMenu();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void SetSensitivity(float NewSensitivity);

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void SetInvertY(bool bInvert);

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void SetArabicSubtitles(bool bEnabled);

	UFUNCTION(BlueprintPure, Category = "Menu")
	float GetSensitivity() const { return Sensitivity; }

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	float Sensitivity = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	bool bInvertY = false;

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	bool bArabicSubtitles = false;

	/** Level to open when quitting. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Menu")
	FName MainMenuLevelName = TEXT("L_MainMenu");

protected:
	ASPPlayerController* GetSPController() const;
};
