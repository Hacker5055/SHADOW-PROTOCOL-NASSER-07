// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameUserSettings.h"
#include "SPGameUserSettings.generated.h"

/**
 * USPGameUserSettings
 *
 * Persistent, user-facing options. Extends UGameUserSettings so it inherits the
 * engine's resolution / scalability handling, then adds the settings this game
 * actually exposes: subtitle language, sensitivity, audio buses, comfort toggles.
 *
 * Written to DefaultGameUserSettings.ini under [/Script/ShadowProtocol.SPGameUserSettings].
 */
UCLASS(config = GameUserSettings, configdonotcheckdefaults)
class SHADOWPROTOCOL_API USPGameUserSettings : public UGameUserSettings
{
	GENERATED_BODY()

public:
	USPGameUserSettings();

	static USPGameUserSettings* Get();

	// ------------------------------------------------------------- accessibility
	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Accessibility")
	bool bArabicSubtitles = false;

	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Accessibility")
	bool bSubtitlesEnabled = true;

	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Accessibility")
	float SubtitleSize = 1.f;

	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Accessibility")
	bool bReducedMotion = false;

	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Accessibility")
	bool bScreenShake = true;

	// ------------------------------------------------------------- input
	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Input")
	float LookSensitivity = 1.f;

	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Input")
	bool bInvertY = false;

	// ------------------------------------------------------------- audio
	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Audio")
	float MasterVolume = 0.9f;

	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Audio")
	float MusicVolume = 0.7f;

	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Audio")
	float DialogueVolume = 1.f;

	// ------------------------------------------------------------- look
	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Graphics")
	bool bFilmGrain = true;

	/** 0 Low, 1 Medium, 2 High, 3 Cinematic. Mirrored into Scalability. */
	UPROPERTY(config, BlueprintReadWrite, Category = "Shadow|Graphics")
	int32 GraphicsPreset = 2;

	UFUNCTION(BlueprintCallable, Category = "Shadow|Settings")
	void ApplyShadowSettings();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Settings")
	void ApplyGraphicsPreset(int32 PresetIndex);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Settings")
	void SaveShadowSettings();

protected:
	void ApplyScalabilityForPreset(int32 PresetIndex);
};
