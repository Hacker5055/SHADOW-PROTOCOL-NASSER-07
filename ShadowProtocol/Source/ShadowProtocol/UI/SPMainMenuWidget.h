// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Core/SPMenuSubsystem.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPMainMenuWidget.generated.h"

/**
 * USPMainMenuWidget
 *
 * Presentation for the front end. The layout is UMG (WBP_MainMenu); this class
 * exposes exactly the data and actions the layout needs, all backed by the real
 * menu subsystem.
 *
 * The brief forbids non-functional menu entries. Every button here maps to a
 * function that either does the thing or reports why it cannot.
 */
UCLASS(Abstract, Blueprintable)
class SHADOWPROTOCOL_API USPMainMenuWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	virtual void NativeConstruct() override;

	// ------------------------------------------------------------- navigation
	UFUNCTION(BlueprintCallable, Category = "Menu")
	void NewCampaign();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void ContinueGame();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void OpenChapterSelect();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void OpenSettings();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void OpenCredits();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void BackToMain();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void QuitGame();

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void SelectChapter(int32 ChapterIndex);

	UFUNCTION(BlueprintCallable, Category = "Menu")
	void SetDifficulty(ESPDifficulty NewDifficulty);

	// ------------------------------------------------------------- data
	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	bool bCanContinue = false;

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	ESPDifficulty SelectedDifficulty = ESPDifficulty::Soldier;

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	TArray<FSPChapterEntry> Chapters;

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	FText ErrorMessage;

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	bool bErrorVisible = false;

	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	ESPMenuScreen CurrentScreen = ESPMenuScreen::Main;

	/** 1973 or modern: drives the menu's palette and background art. */
	UPROPERTY(BlueprintReadOnly, Category = "Menu")
	bool bShowPeriodSkin = true;

	// ------------------------------------------------------------- BP hooks
	UFUNCTION(BlueprintImplementableEvent, Category = "Menu")
	void OnMenuStateChanged();

	UFUNCTION(BlueprintImplementableEvent, Category = "Menu")
	void OnErrorShown(const FText& Message);

	UFUNCTION(BlueprintImplementableEvent, Category = "Menu")
	void OnDifficultyChanged(ESPDifficulty Difficulty);

	UFUNCTION(BlueprintPure, Category = "Menu")
	USPMenuSubsystem* GetMenuSubsystem() const;

protected:
	void Refresh();
	void ShowError(const FText& Message);

	UFUNCTION()
	void HandleMenuError(const FText& Message, const FText& MessageArabic);

	UFUNCTION()
	void HandleScreenChanged(ESPMenuScreen NewScreen);

	UFUNCTION()
	void HandleChapterListBuilt(const TArray<FSPChapterEntry>& InChapters);
};
