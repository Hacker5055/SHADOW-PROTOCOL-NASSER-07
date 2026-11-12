// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPAIController.generated.h"

class UAIPerceptionComponent;
class UAISenseConfig_Sight;
class UAISenseConfig_Hearing;
class ASPEnemyCharacter;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnAIStateChanged, ESPAIState, OldState, ESPAIState, NewState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnAIShout, FText, ShoutText, bool, bUrgent);

/**
 * Enemy perception profile. Four presets map to the four difficulty tiers so
 * that "challenging" never means "unfair" — the AI is capped by physics, not
 * artificially buffed damage.
 */
USTRUCT(BlueprintType)
struct FSPPerceptionProfile
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float SightRadius = 5200.f;      // cm

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float LoseSightRadius = 6800.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float PeripheralVisionAngle = 68.f; // half-angle in degrees

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float HearingRange = 3400.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float ReactionTimeSeconds = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float AimErrorDegrees = 3.4f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float BurstLengthMin = 3.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float BurstLengthMax = 6.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Perception")
	float TriggerDisciplineSeconds = 0.9f;
};

/**
 * ASPAIController
 *
 * Hostile AI. Awareness is accumulated (never binary), vision is LOS-gated and
 * cone-limited, hearing comes from the perception system plus explicit game-mode
 * noise events, and the state machine covers cover, flanking and retreat.
 */
UCLASS()
class SHADOWPROTOCOL_API ASPAIController : public AAIController
{
	GENERATED_BODY()

public:
	ASPAIController(const FObjectInitializer& ObjectInitializer);

	virtual void OnPossess(APawn* InPawn) override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void OnUnPossess() override;

	// ------------------------------------------------------------- perception
	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	float GetAwareness() const { return Awareness; }

	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	ESPAIState GetAIState() const { return State; }

	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	bool CanSeePlayer() const { return bCanSeePlayer; }

	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	bool IsAlerted() const { return State == ESPAIState::Combat || State == ESPAIState::TakeCover || State == ESPAIState::Flank; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void SetAIState(ESPAIState NewState);

	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void ApplyDifficulty(ESPDifficulty Difficulty);

	/** Called by the game mode when any noise occurs (in addition to hearing sense). */
	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void NotifyHeardNoise(const FVector& Location, float Strength);

	/** Called by allies propagating contact. */
	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void ReceiveAlert(const FVector& EnemyLocation, AActor* AlertSource);

	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void ApplySuppression(float Amount);

	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	float GetSuppression() const { return Suppression; }

	UPROPERTY(BlueprintAssignable, Category = "Shadow|AI|Events")
	FSPOnAIStateChanged OnAIStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|AI|Events")
	FSPOnAIShout OnAIShout;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	FSPPerceptionProfile Perception;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float AwarenessGainRate = 1.9f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float AwarenessDecayRate = 0.24f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float SearchDurationSeconds = 7.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float AlertPropagationRadius = 2400.f;

protected:
	void UpdatePerception(float DeltaSeconds);
	void UpdateCombat(float DeltaSeconds);
	void UpdateSuppression(float DeltaSeconds);
	void TickStateMachine(float DeltaSeconds);
	void TryFlank();
	void Shout(const FText& Text, bool bUrgent);

	UFUNCTION()
	void OnTargetPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus);

	UFUNCTION()
	void OnPerceptionForgotten(AActor* Actor);

	/** Builds the sight/hearing senses for the configured profile. */
	void ConfigurePerception();

	UPROPERTY()
	TObjectPtr<UAIPerceptionComponent> AIPerception = nullptr;

	UPROPERTY()
	TObjectPtr<UAISenseConfig_Sight> SightConfig = nullptr;

	UPROPERTY()
	TObjectPtr<UAISenseConfig_Hearing> HearingConfig = nullptr;

	UPROPERTY()
	TObjectPtr<ASPEnemyCharacter> ControlledEnemy = nullptr;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	ESPAIState State = ESPAIState::Idle;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float Awareness = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	bool bCanSeePlayer = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float Suppression = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float ReactionTimer = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float SearchTimer = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float TimeSinceShout = 100.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	FVector LastKnownEnemyLocation = FVector::ZeroVector;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	TObjectPtr<AActor> CurrentTarget = nullptr;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float FireCooldown = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	bool bFlankRequested = false;
};
