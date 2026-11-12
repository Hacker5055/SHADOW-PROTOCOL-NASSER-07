// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPHUDWidget.generated.h"

class ASPCharacter;
class USPMissionManager;

/** Squad row data pushed to the HUD each refresh. */
USTRUCT(BlueprintType)
struct FSPSquadRow
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Squad")
	FText Callsign;

	UPROPERTY(BlueprintReadOnly, Category = "Squad")
	float HealthAlpha = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "Squad")
	bool bDowned = false;

	UPROPERTY(BlueprintReadOnly, Category = "Squad")
	bool bKIA = false;
};

/**
 * USPHUDWidget
 *
 * Presentation only. The C++ side gathers state once per refresh and hands the
 * widget Blueprint plain values; the Blueprint draws the actual layout. This
 * keeps the "no fake HUD" rule enforceable — every element here is fed by live
 * gameplay data.
 */
UCLASS(Abstract, Blueprintable)
class SHADOWPROTOCOL_API USPHUDWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	virtual void NativeConstruct() override;
	virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;

	// ---------------------------------------------- data the BP binds to
	UPROPERTY(BlueprintReadOnly, Category = "HUD|Player")
	float HealthAlpha = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Player")
	float StaminaAlpha = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Player")
	ESPStance Stance = ESPStance::Stand;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Player")
	float CompassHeading = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	FText WeaponName;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	int32 MagazineAmmo = 0;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	int32 ReserveAmmo = 0;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	bool bReloading = false;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	float ReloadProgress = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	int32 Grenades = 0;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	bool bAiming = false;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Weapon")
	float Suppression = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Objective")
	FText ObjectiveTitle;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Objective")
	FText ObjectiveArabic;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Objective")
	bool bHasObjective = false;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Objective")
	float ObjectiveDistanceMetres = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Intel")
	int32 IntelCollected = 0;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Intel")
	int32 IntelTotal = 21;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Squad")
	TArray<FSPSquadRow> SquadRows;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Radio")
	FText SubtitleSpeaker;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Radio")
	FText SubtitleLine;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Radio")
	bool bSubtitleVisible = false;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Radio")
	bool bSubtitleIsRadio = false;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Era")
	ESPEra Era = ESPEra::Egypt1973;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Death")
	bool bPlayerDead = false;

	// ---------------------------------------------- interaction prompt
	UPROPERTY(BlueprintReadOnly, Category = "HUD|Interaction")
	bool bInteractionPromptVisible = false;

	UPROPERTY(BlueprintReadOnly, Category = "HUD|Interaction")
	FText InteractionPromptText;

	// ---------------------------------------------- Blueprint events
	UFUNCTION(BlueprintImplementableEvent, Category = "HUD")
	void OnHUDRefreshed();

	UFUNCTION(BlueprintImplementableEvent, Category = "HUD")
	void OnDamageDirection(float AngleDegrees, float Strength);

	UFUNCTION(BlueprintCallable, Category = "HUD")
	void ShowSubtitleLine(const FText& Speaker, const FText& Line, bool bRadio);

	UFUNCTION(BlueprintCallable, Category = "HUD")
	void HideSubtitle();

	/** Reserved for the widget Blueprint to animate a toast. */
	UFUNCTION(BlueprintImplementableEvent, Category = "HUD")
	void OnNotificationFlash(const FText& Message, FLinearColor Colour);

	UFUNCTION(BlueprintCallable, Category = "HUD")
	void FlashNotification(const FText& Message, FLinearColor Colour);

	UFUNCTION(BlueprintCallable, Category = "HUD")
	void SetArabicSubtitles(bool bEnabled);

	/** Derived HUD states driven by the player controller. */
	UFUNCTION(BlueprintCallable, Category = "HUD")
	void SetTacticalMapOpen(bool bOpen);

	UFUNCTION(BlueprintCallable, Category = "HUD")
	void SetCinematicLetterbox(bool bEnabled);

	UFUNCTION(BlueprintCallable, Category = "HUD")
	void SetInteractionPrompt(const FText& Text, bool bShow);

	UPROPERTY(BlueprintReadOnly, Category = "HUD")
	bool bTacticalMapOpen = false;

	UPROPERTY(BlueprintReadOnly, Category = "HUD")
	bool bCinematicLetterbox = false;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HUD")
	bool bArabicSubtitles = false;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HUD")
	float SubtitleDuration = 4.5f;

protected:
	void RefreshFromPlayer();

	UPROPERTY()
	TObjectPtr<ASPMissionManager> CachedMission = nullptr;

	float SubtitleTimer = 0.f;

	/** HUD refresh cadence — 10 Hz keeps label churn off the frame budget. */
	UPROPERTY(EditDefaultsOnly, Category = "HUD")
	float RefreshInterval = 0.1f;

	float TimeSinceRefresh = 0.f;
};
