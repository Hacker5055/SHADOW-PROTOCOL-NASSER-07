// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPWeaponData.generated.h"

class USoundBase;
class UAnimMontage;
class UStaticMesh;
class UNiagaraSystem;

/** Firing behaviour. */
UENUM(BlueprintType)
enum class ESPFireMode : uint8
{
	Single     UMETA(DisplayName = "Single"),
	Burst      UMETA(DisplayName = "Burst"),
	FullAuto   UMETA(DisplayName = "Full Auto"),
	BoltAction UMETA(DisplayName = "Bolt Action"),
	Launcher   UMETA(DisplayName = "Launcher")
};

/**
 * A weapon definition. Everything about a gun is data, so the 1973 and modern
 * arsenals use the exact same runtime code and only differ in values.
 *
 * USPWeaponComponent::EquipWeapon() refuses any asset whose Era does not match
 * the character's era — see ValidateEraCompatibility().
 */
UCLASS(BlueprintType)
class SHADOWPROTOCOL_API USPWeaponData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FName WeaponId;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText DisplayName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText DisplayNameArabic;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText WeaponClass;

	/** Where the weapon comes from — shown in the loadout screen for authenticity. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	FText Origin;

	/** Era gate. A weapon may only be equipped by a character of the same era. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Identity")
	ESPEra Era = ESPEra::Egypt1973;

	// ------------------------------------------------------------- ballistics
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float BaseDamage = 28.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float HeadshotMultiplier = 2.6f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float LimbMultiplier = 0.75f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float ArmourPenetration = 0.4f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float RoundsPerMinute = 600.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float RangeFalloffStart = 3500.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float RangeFalloffEnd = 12000.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	float MaxRange = 25000.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Ballistics")
	int32 PelletsPerShot = 1;

	// ------------------------------------------------------------- handling
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	ESPFireMode FireMode = ESPFireMode::FullAuto;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	int32 MagazineSize = 30;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	int32 StartingReserveAmmo = 180;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float ReloadTime = 2.3f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float ReloadTimeEmpty = 3.0f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float HipFireSpread = 1.1f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float AimSpread = 0.28f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float MovingSpreadPenalty = 2.4f;

	/** Recoil applied per shot, in degrees; Yaw is randomised +/- this value. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float RecoilPitch = 1.05f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float RecoilYaw = 0.42f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float RecoilRecoveryRate = 7.5f;

	/** How much of the recoil the player must manually compensate. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float RecoilRecoilControl = 0.55f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float SwayIntensity = 1.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	bool bSuppressed = false;

	/** Metres at which the shot can still alert an enemy. 0 = audible map-wide. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float NoiseRadiusMeters = 70.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float AimFOVMultiplier = 0.62f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Handling")
	float WeaponSwitchTime = 0.55f;

	// ------------------------------------------------------------- explosives
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Explosive")
	bool bExplosiveAmmo = false;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Explosive", meta = (EditCondition = "bExplosiveAmmo"))
	float ExplosionRadius = 650.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Explosive", meta = (EditCondition = "bExplosiveAmmo"))
	float ExplosionDamage = 160.f;

	// ------------------------------------------------------------- presentation
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<UStaticMesh> FirstPersonMesh = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<USkeletalMesh> ThirdPersonMesh = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<UNiagaraSystem> MuzzleFlash = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<UNiagaraSystem> ImpactEffect = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<USoundBase> FireSound = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<USoundBase> SuppressedFireSound = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<USoundBase> ReloadSound = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<UAnimMontage> FireMontage = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Presentation")
	TObjectPtr<UAnimMontage> ReloadMontage = nullptr;

	/** Called by the component before equipping. Returns false to refuse. */
	UFUNCTION(BlueprintCallable, Category = "Validation")
	bool ValidateEraCompatibility(ESPEra CharacterEra, FString& OutReason) const
	{
		if (Era != CharacterEra)
		{
			OutReason = FString::Printf(
				TEXT("Weapon '%s' is %s and cannot be equipped in a %s chapter."),
				*WeaponId.ToString(),
				Era == ESPEra::Egypt1973 ? TEXT("1973-era") : TEXT("modern-era"),
				CharacterEra == ESPEra::Egypt1973 ? TEXT("1973") : TEXT("modern"));
			return false;
		}
		return true;
	}

	/** Damage after distance falloff. */
	UFUNCTION(BlueprintPure, Category = "Ballistics")
	float GetDamageAtDistance(float DistanceCm) const
	{
		if (DistanceCm <= RangeFalloffStart)
		{
			return BaseDamage;
		}
		if (DistanceCm >= RangeFalloffEnd)
		{
			return BaseDamage * 0.55f;
		}
		const float Alpha = (DistanceCm - RangeFalloffStart) / (RangeFalloffEnd - RangeFalloffStart);
		return FMath::Lerp(BaseDamage, BaseDamage * 0.55f, Alpha);
	}
};
