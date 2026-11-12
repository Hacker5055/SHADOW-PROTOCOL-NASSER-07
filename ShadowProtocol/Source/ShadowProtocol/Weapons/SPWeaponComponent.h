// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPWeaponComponent.generated.h"

class USPWeaponData;
class ASPCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FSPOnAmmoChanged, int32, Magazine, int32, Reserve, USPWeaponData*, Weapon);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnWeaponChanged, USPWeaponData*, NewWeapon);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnHitConfirmed, bool, bKillingBlow, bool, bHeadshot);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnReloadStateChanged, bool, bReloading);

/**
 * Runtime state for one carried weapon.
 */
USTRUCT(BlueprintType)
struct FSPWeaponInstance
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Weapon")
	TObjectPtr<USPWeaponData> Data = nullptr;

	UPROPERTY(BlueprintReadOnly, Category = "Weapon")
	int32 MagazineAmmo = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Weapon")
	int32 ReserveAmmo = 0;
};

/**
 * USPWeaponComponent
 *
 * Handles equip/swap, firing (hitscan with spread + recoil accumulation),
 * reloads, ammo bookkeeping, noise propagation for AI hearing, and the era gate
 * that keeps 1973 characters on period kit.
 */
UCLASS(ClassGroup = (ShadowProtocol), meta = (BlueprintSpawnableComponent))
class SHADOWPROTOCOL_API USPWeaponComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	USPWeaponComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// ------------------------------------------------------------- loadout
	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	bool EquipWeapon(USPWeaponData* WeaponData, bool bForce = false);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	bool AddWeaponToLoadout(USPWeaponData* WeaponData);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	void CycleWeapon();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	void SetEra(ESPEra InEra);

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	USPWeaponData* GetCurrentWeapon() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	ESPEra GetEra() const { return CurrentEra; }

	// ------------------------------------------------------------- firing
	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	void StartFire();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	void StopFire();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	bool Reload();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	void SetAiming(bool bNewAiming);

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	bool IsReloading() const { return bReloading; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	float GetReloadProgress() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	float GetAimFOV(float BaseFOV) const;

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	int32 GetMagazineAmmo() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	int32 GetReserveAmmo() const;

	/** Accumulated recoil the camera should apply, then cleared each frame. */
	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	FRotator ConsumeRecoil();

	/** Suppression value 0..1 caused by incoming fire (read by the HUD/post FX). */
	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	float GetSuppression() const { return Suppression; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Weapons")
	void AddSuppression(float Amount);

	UFUNCTION(BlueprintPure, Category = "Shadow|Weapons")
	float GetCurrentSpreadDegrees() const;

	// ------------------------------------------------------------- events
	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnAmmoChanged OnAmmoChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnWeaponChanged OnWeaponChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnHitConfirmed OnHitConfirmed;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnReloadStateChanged OnReloadStateChanged;

	// ------------------------------------------------------------- config
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Loadout")
	TArray<TObjectPtr<USPWeaponData>> StartingLoadout;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning")
	float RecoilRecoverySpeed = 6.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning")
	float SuppressionDecayPerSecond = 0.55f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning")
	float SuppressionPerNearMiss = 0.18f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning")
	FName MuzzleSocketName = TEXT("MuzzleFlash");

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning")
	FName TracerEffectSocket = TEXT("Muzzle");

protected:
	void FireOneShot();
	void FinishReload();
	void ApplyRecoil();
	void BroadcastAmmo();
	void PlayFireEffects();
	void ReportNoise();
	ASPCharacter* GetOwningCharacter() const;

	/** Where the shot originates (eye/camera) and where it points. */
	void GetShotOriginAndDirection(FVector& OutOrigin, FVector& OutDirection) const;

	UFUNCTION()
	void HandleReloadFinished();

	// ------------------------------------------------------------- state
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	TArray<FSPWeaponInstance> Loadout;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	int32 CurrentIndex = INDEX_NONE;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	ESPEra CurrentEra = ESPEra::Egypt1973;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bFiring = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bReloading = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bAiming = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float FireCooldown = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float ReloadRemaining = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float Suppression = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	FRotator AccumulatedRecoil = FRotator::ZeroRotator;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	int32 BurstShotsRemaining = 0;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float TimeSinceLastShot = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float SwitchCooldown = 0.f;

	FTimerHandle ReloadTimer;
};
