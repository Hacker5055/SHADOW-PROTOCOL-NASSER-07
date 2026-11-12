// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPGameUserSettings.h"
#include "GameFramework/GameUserSettings.h"
#include "ShadowProtocol.h"

USPGameUserSettings::USPGameUserSettings()
{
	SetToDefaults();
}

USPGameUserSettings* USPGameUserSettings::Get()
{
	return Cast<USPGameUserSettings>(UGameUserSettings::GetGameUserSettings());
}

void USPGameUserSettings::ApplyGraphicsPreset(int32 PresetIndex)
{
	GraphicsPreset = FMath::Clamp(PresetIndex, 0, 3);
	ApplyScalabilityForPreset(GraphicsPreset);
	ApplyShadowSettings();
}

void USPGameUserSettings::ApplyScalabilityForPreset(int32 PresetIndex)
{
	// Scalability levels: 0 Low .. 3 Epic. The Cinematic preset pins the UE5
	// features the visual identity depends on (Lumen, volumetrics) at maximum.
	const int32 Level = FMath::Clamp(PresetIndex, 0, 3);

	ScalabilityQuality.ViewDistanceQuality = Level;
	ScalabilityQuality.AntiAliasingQuality = Level;
	ScalabilityQuality.ShadowQuality = Level;
	ScalabilityQuality.GlobalIlluminationQuality = Level;
	ScalabilityQuality.ReflectionQuality = Level;
	ScalabilityQuality.PostProcessQuality = Level;
	ScalabilityQuality.TextureQuality = Level;
	ScalabilityQuality.EffectsQuality = Level;
	ScalabilityQuality.FoliageQuality = Level;
	ScalabilityQuality.ShadingQuality = Level;

	UE_LOG(LogShadowProtocol, Log, TEXT("Graphics preset applied: %d"), Level);
}

void USPGameUserSettings::ApplyShadowSettings()
{
	ApplySettings(true);

	// Audio buses: the sound class hierarchy is authored in Content/Audio; these
	// values are pushed through the audio device on demand.
	UE_LOG(LogShadowProtocol, Verbose,
		TEXT("Shadow settings applied — subtitles:%s arabic:%s master:%.2f music:%.2f dialogue:%.2f"),
		bSubtitlesEnabled ? TEXT("on") : TEXT("off"),
		bArabicSubtitles ? TEXT("ar") : TEXT("en"),
		MasterVolume, MusicVolume, DialogueVolume);
}

void USPGameUserSettings::SaveShadowSettings()
{
	SaveSettings();
	UE_LOG(LogShadowProtocol, Log, TEXT("User settings saved."));
}
