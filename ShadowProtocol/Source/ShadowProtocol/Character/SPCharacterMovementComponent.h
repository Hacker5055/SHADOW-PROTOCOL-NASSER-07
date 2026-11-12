// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPCharacterMovementComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnStanceChanged, ESPStance, OldStance, ESPStance, NewStance);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnSlideStarted, float, SlideSpeed);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FSPOnMantleStarted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FSPOnStaminaDepleted);

/**
 * USPCharacterMovementComponent
 *
 * Implements the movement set required by Milestone 1 of the brief:
 * walking, sprinting, tactical sprint, crouching, prone, sliding, jumping,
 * leaning and mantling, with smooth analytic transitions between all states.
 *
 * Design notes
 *  - Tactical sprint is a higher tier than sprint: it consumes stamina faster,
 *    widens the FOV slightly, forces the weapon into a "port arms" pose, and
 *    cannot fire. It kicks in automatically after SprintTacticalDelay seconds
 *    of continuous sprint input while looking roughly forward.
 *  - Prone is a hard state: no shooting over low cover without rolling (see
 *    ASPCharacter::TryProneRoll), and movement is capped at ProneSpeed.
 *  - Leaning is a camera offset + optional trace, not a locomotion state; the
 *    controller consumes GetLeanOffset() so AI can also read it.
 *  - Mantling uses a two-stage trace (chest blocked / knee clear) so the player
 *    can vault a wall but never climb geometry that is out of reach.
 */
UCLASS(ClassGroup = (ShadowProtocol), meta = (BlueprintSpawnableComponent))
class SHADOWPROTOCOL_API USPCharacterMovementComponent : public UCharacterMovementComponent
{
	GENERATED_BODY()

public:
	USPCharacterMovementComponent();

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
	virtual float GetMaxSpeed() const override;

	// ------------------------------------------------------------- input API
	UFUNCTION(BlueprintCallable, Category = "Shadow|Movement")
	void SetSprintIntent(bool bPressed);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Movement")
	void SetCrouchIntent(bool bPressed);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Movement")
	void ToggleProne();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Movement")
	void SetLeanIntent(float InLean); // -1 left, +1 right

	UFUNCTION(BlueprintCallable, Category = "Shadow|Movement")
	void TryStartSlide();

	UFUNCTION(BlueprintCallable, Category = "Shadow|Movement")
	bool TryMantle();

	UFUNCTION(BlueprintPure, Category = "Shadow|Movement")
	ESPStance GetStance() const { return CurrentStance; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Movement")
	float GetStamina() const { return Stamina / FMath::Max(StaminaMax, KINDA_SMALL_NUMBER); }

	UFUNCTION(BlueprintPure, Category = "Shadow|Movement")
	bool IsTacticalSprinting() const { return bTacticalSprinting; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Movement")
	bool IsSlidingNow() const { return CurrentStance == ESPStance::Slide; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Movement")
	bool IsMantling() const { return bMantling; }

	/** Smoothed lateral camera offset in cm for the current lean. */
	UFUNCTION(BlueprintPure, Category = "Shadow|Movement")
	float GetLeanOffset() const { return LeanAlpha * LeanDistance; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Movement")
	float GetLeanAlpha() const { return LeanAlpha; }

	/** Restores movement state after a checkpoint reload or respawn. */
	UFUNCTION(BlueprintCallable, Category = "Shadow|Movement")
	void ResetMovementState();

	// ------------------------------------------------------------- events
	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnStanceChanged OnStanceChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnSlideStarted OnSlideStarted;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnMantleStarted OnMantleStarted;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Events")
	FSPOnStaminaDepleted OnStaminaDepleted;

	// ------------------------------------------------------------- tuning
	/** Stand / crouch / prone eye and capsule heights, in cm. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Height")
	float StandCapsuleHalfHeight = 90.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Height")
	float CrouchCapsuleHalfHeight = 56.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Height")
	float ProneCapsuleHalfHeight = 34.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Height")
	float MantleCheckHeight = 100.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Height")
	float MantleMaxHeight = 190.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Height")
	float MantleTraceDistance = 65.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float WalkSpeed = 315.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float SprintSpeed = 490.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float TacticalSprintSpeed = 610.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float CrouchSpeed = 175.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float ProneSpeed = 90.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float AimingSpeedMultiplier = 0.62f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float SlideSpeed = 740.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float SlideDuration = 0.85f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Speeds")
	float SlideCooldown = 0.55f;

	/** Stamina is a normalised 0..1 resource. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Stamina")
	float SprintStaminaDrain = 11.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Stamina")
	float TacticalSprintStaminaDrain = 20.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Stamina")
	float StaminaRecovery = 16.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Stamina")
	float StaminaRecoveryDelay = 0.7f;

	/** Seconds of continuous sprint before tactical sprint engages. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Sprint")
	float SprintTacticalDelay = 1.1f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Sprint")
	float LeanTransitionSpeed = 9.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Sprint")
	float LeanDistance = 42.f;

	/** Set by the character while aiming down sights. */
	UPROPERTY(BlueprintReadWrite, Category = "Shadow|State")
	bool bWantsToAim = false;

	/** Set by the character while the player is holding a sprint input. */
	UPROPERTY(BlueprintReadOnly, Category = "Shadow|State")
	bool bSprintIntent = false;

protected:
	void UpdateStamina(float DeltaTime);
	void UpdateStance(float DeltaTime);
	void UpdateLean(float DeltaTime);
	void UpdateSlide(float DeltaTime);
	void UpdateTacticalSprint(float DeltaTime);
	void UpdateMantle(float DeltaTime);
	void ApplyCapsuleHeight(float TargetHalfHeight);
	void SetStance(ESPStance NewStance);

	/** True when there is room to stand at the current location. */
	bool CanStandUp() const;

	UFUNCTION()
	void HandleMovementModeChanged(ACharacter* Character, EMovementMode PrevMode, uint8 PrevCustomMode);

	// ------------------------------------------------------------- state
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	ESPStance CurrentStance = ESPStance::Stand;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float Stamina = 100.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float StaminaMax = 100.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bTacticalSprinting = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float SprintHeldTime = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float TimeSinceStaminaSpend = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float LeanTarget = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float LeanAlpha = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float SlideTimeRemaining = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float SlideCooldownRemaining = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	bool bMantling = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	float MantleAlpha = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	FVector MantleStart = FVector::ZeroVector;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|State")
	FVector MantleEnd = FVector::ZeroVector;

	/** Toggled by input mode settings so accessibility options can flip behaviour. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Input")
	bool bCrouchIsToggle = true;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shadow|Tuning|Input")
	bool bSprintIsToggle = false;
};
