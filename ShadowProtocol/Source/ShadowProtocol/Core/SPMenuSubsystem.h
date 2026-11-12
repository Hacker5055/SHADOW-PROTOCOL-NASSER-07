// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPMenuSubsystem.generated.h"

class USPProgressSubsystem;

/** Which screen the front end is showing. */
UENUM(BlueprintType)
enum class ESPMenuScreen : uint8
{
	Main        UMETA(DisplayName = "Main Menu"),
	NewCampaign UMETA(DisplayName = "New Campaign"),
	Continue    UMETA(DisplayName = "Continue"),
	ChapterSelect UMETA(DisplayName = "Chapter Select"),
	Settings    UMETA(DisplayName = "Settings"),
	Credits     UMETA(DisplayName = "Credits"),
	Briefing    UMETA(DisplayName = "Briefing")
};

/** One selectable chapter in the chapter-select screen. */
USTRUCT(BlueprintType)
struct FSPChapterEntry
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Chapter")
	int32 Index = 1;

	UPROPERTY(BlueprintReadOnly, Category = "Chapter")
	FText Title;

	UPROPERTY(BlueprintReadOnly, Category = "Chapter")
	FText TitleArabic;

	UPROPERTY(BlueprintReadOnly, Category = "Chapter")
	FText EraLabel;

	UPROPERTY(BlueprintReadOnly, Category = "Chapter")
	bool bUnlocked = false;

	UPROPERTY(BlueprintReadOnly, Category = "Chapter")
	bool bCompleted = false;

	/** Level name to open. Empty until the chapter's level is authored. */
	UPROPERTY(BlueprintReadOnly, Category = "Chapter")
	FName LevelName;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnMenuScreenChanged, ESPMenuScreen, NewScreen);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnChapterListBuilt, const TArray<FSPChapterEntry>&, Chapters);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnMenuError, FText, Message, FText, MessageArabic);

/**
 * USPMenuSubsystem
 *
 * The front end's state machine and the only place that decides "what level do we
 * open next". It reads campaign progress from USPProgressSubsystem, so a chapter
 * button is enablable only if the save says it is — no fake unlocked buttons.
 *
 * Every entry point is a real action: Continue loads the last checkpoint,
 * Chapter Select opens the chosen level, Settings writes through to the user
 * settings object, Credits just changes screen.
 */
UCLASS()
class SHADOWPROTOCOL_API USPMenuSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	// ------------------------------------------------------------- navigation
	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	void SetScreen(ESPMenuScreen NewScreen);

	UFUNCTION(BlueprintPure, Category = "Shadow|Menu")
	ESPMenuScreen GetScreen() const { return CurrentScreen; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	void ShowMainMenu();

	// ------------------------------------------------------------- actions
	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	bool StartNewCampaign(ESPDifficulty Difficulty);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	bool ContinueCampaign();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	bool OpenChapter(int32 ChapterIndex);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	bool QuitToDesktop();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Menu")
	void BuildChapterList();

	UFUNCTION(BlueprintPure, Category = "Shadow|Menu")
	const TArray<FSPChapterEntry>& GetChapterList() const { return Chapters; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Menu")
	bool CanContinue() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|Menu")
	FText GetLastError() const { return LastError; }

	// ------------------------------------------------------------- events
	UPROPERTY(BlueprintAssignable, Category = "Shadow|Menu|Events")
	FSPOnMenuScreenChanged OnScreenChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Menu|Events")
	FSPOnChapterListBuilt OnChapterListBuilt;

	/** Raised when an action cannot run yet (e.g. a chapter level is not authored). */
	UPROPERTY(BlueprintAssignable, Category = "Shadow|Menu|Events")
	FSPOnMenuError OnMenuError;

	/** Level opened when the very first chapter begins. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Menu")
	FName FirstMissionLevel = TEXT("L_GrayboxRange");

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Menu")
	FName MainMenuLevel = TEXT("L_MainMenu");

protected:
	void Fail(const FText& English, const FText& Arabic);

	UPROPERTY()
	ESPMenuScreen CurrentScreen = ESPMenuScreen::Main;

	UPROPERTY()
	TArray<FSPChapterEntry> Chapters;

	UPROPERTY()
	FText LastError;

	USPProgressSubsystem* Progress() const;
};
