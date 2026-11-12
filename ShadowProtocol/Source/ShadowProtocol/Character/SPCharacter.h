// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPCharacter.generated.h"

class USPCharacterMovementComponent;
class USPWeaponComponent;
class USpringArmComponent;
class UCameraComponent;
class USkeletalMeshComponent;
class USPHUDWidget;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnHealthChanged, float, NewHealth, float, MaxHealth);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnDeath, AActor*, Killer);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnDamageTaken, float, Amount, FVector, FromDirection);

/**
 * ASPCharacter
 *
 * The playable soldier. One class drives both protagonists — identity, era and
 * gear are data (see ESPCharacterId / ESPEra), so Taher and Nasser share the
 * exact same movement, damage and weapon code. This is deliberate: the two
 * generations must feel mechanically continuous and only differ in equipment.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ASPCharacter(const FObjectInitializer& ObjectInitializer);

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual float TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	// ------------------------------------------------------------- identity
	UFUNCTION(BlueprintCallable, Category = "Shadow|Identity")
	void ConfigureForCharacter(ESPCharacterId InCharacterId, ESPEra InEra);

	UFUNCTION(BlueprintPure, Category = "Shadow|Identity")
	ESPCharacterId GetCharacterId() const { return CharacterId; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Identity")
	ESPEra GetEra() const { return Era; }

	// ------------------------------------------------------------- health
	UFUNCTION(BlueprintPure, Category = "Shadow|Health")
	float GetHealthNormalised() const { return Health / FMath::Max(MaxHealth, 1.f); }

	UFUNCTION(BlueprintPure, Category = "Shadow|Health")
	bool IsAlive() const { return !bDead; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Health")
	void Heal(float Amount);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Health")
	void ApplyCheckpointHealth(float InHealth);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Combat")
	void SetGodMode(bool bEnabled) { bGodMode = bEnabled; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Combat")
	bool TryMelee();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Combat")
	bool TryThrowGrenade();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Camera")
	void SetNightVisionEnabled(bool bEnabled);

	/** Runtime look tuning, driven by the settings menu. */
	UFUNCTION(BlueprintCallable, Category = "Shadow|Input")
	void SetLookSensitivity(float NewSensitivity);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Input")
	void SetInvertY(bool bInvert);

	UFUNCTION(BlueprintPure, Category = "Shadow|Input")
	float GetLookSensitivity() const { return LookSensitivity; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Camera")
	bool IsNightVisionEnabled() const { return bNightVision; }

	/** Compass heading in degrees, 0 = north (-X), clockwise. */
	UFUNCTION(BlueprintPure, Category = "Shadow|Camera")
	float GetCompassHeading() const;

	// ------------------------------------------------------------- components
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Components")
	TObjectPtr<USPCharacterMovementComponent> ShadowMovement;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Components")
	TObjectPtr<USPWeaponComponent> WeaponComponent;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Components")
	TObjectPtr<USpringArmComponent> SpringArm;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Shadow|Components")
	TObjectPtr<UCameraComponent> FirstPersonCamera;

	// ------------------------------------------------------------- events
	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnHealthChanged OnHealthChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnDeath OnDeath;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnDamageTaken OnDamageTaken;

	// ------------------------------------------------------------- tuning
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Health")
	float MaxHealth = 100.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Health")
	float HealthRegenPerSecond = 16.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Health")
	float HealthRegenDelay = 5.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Grenade")
	int32 StartingGrenades = 2;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Grenade")
	int32 MaxGrenades = 4;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Melee")
	float MeleeRange = 230.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Melee")
	float MeleeDamage = 65.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Melee")
	float MeleeCooldown = 0.7f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Camera")
	float BaseFOV = 90.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Camera")
	float TacticalSprintFOV = 96.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Camera")
	float NightVisionFOVOffset = -9.f;

	UFUNCTION(BlueprintPure, Category = "Shadow|Combat")
	int32 GetGrenadeCount() const { return Grenades; }

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Grenade")
	TSubclassOf<AActor> GrenadeClass;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Input")
	float LookSensitivity = 1.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Input")
	bool bInvertY = false;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Input")
	bool bHoldToCrouch = false;

protected:
	// ------------------------------------------------------------- input handlers
	void Input_Move(const FVector2D& Value);
	void Input_MoveForwardLegacy(float Value);
	void Input_MoveRightLegacy(float Value);
	void Input_TurnLegacy(float Value);
	void Input_LookUpLegacy(float Value);
	void Input_Look(const FVector2D& Value);
	void Input_FirePressed();
	void Input_FireReleased();
	void Input_AimPressed();
	void Input_AimReleased();
	void Input_Reload();
	void Input_SprintPressed();
	void Input_SprintReleased();
	void Input_CrouchPressed();
	void Input_CrouchReleased();
	void Input_Prone();
	void Input_Jump();
	void Input_LeanLeftPressed();
	void Input_LeanLeftReleased();
	void Input_LeanRightPressed();
	void Input_LeanRightReleased();
	void Input_Melee();
	void Input_Grenade();
	void Input_NightVision();
	void Input_SwapWeapon();
	void Input_Interact();

	// ------------------------------------------------------------- internal
	void UpdateCamera(float DeltaSeconds);
	void UpdateHealthRegen(float DeltaSeconds);
	void UpdateAimState(float DeltaSeconds);
	void OnDied(AActor* Killer);
	void HandleStanceChanged(ESPStance OldStance, ESPStance NewStance);
	void CheckForReviveTarget();

	UFUNCTION()
	void HandleSlideStarted(float SlideSpeed);

	// ------------------------------------------------------------- state
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	ESPCharacterId CharacterId = ESPCharacterId::Taher;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	ESPEra Era = ESPEra::Egypt1973;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float Health = 100.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bDead = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bGodMode = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	int32 Grenades = 2;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float TimeSinceDamage = 100.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float MeleeCooldownRemaining = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bNightVision = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bAiming = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float AimAlpha = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float CurrentFOV = 90.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	TObjectPtr<AActor> ReviveTarget = nullptr;

	/** Base eye offset used by the first-person camera. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Camera")
	FVector FirstPersonCameraOffset = FVector(12.f, 0.f, 68.f);
};
