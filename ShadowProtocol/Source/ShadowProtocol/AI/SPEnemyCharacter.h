// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPEnemyCharacter.generated.h"

class USPWeaponData;
class UBehaviorTree;
class UNiagaraSystem;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FSPOnEnemyKilled, ASPEnemyCharacter*, Enemy, bool, bHeadshot, AActor*, Killer);

/**
 * ASPEnemyCharacter
 *
 * Lightweight hostile pawn. Deliberately shares its damage model with the
 * player so balance is readable, but carries no player-only systems.
 */
UCLASS()
class SHADOWPROTOCOL_API ASPEnemyCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ASPEnemyCharacter(const FObjectInitializer& ObjectInitializer);

	virtual void BeginPlay() override;
	virtual float TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;
	virtual void Tick(float DeltaSeconds) override;

	/** Fires one round at the target. bWillHit controls the sampling only. */
	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void FireAtTarget(AActor* Target, bool bWillHit, float AimErrorDegrees);

	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	float GetHealthPercent() const { return Health / FMath::Max(MaxHealth, 1.f); }

	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	FVector GetEyeLocation() const;

	UFUNCTION(BlueprintPure, Category = "Shadow|AI")
	bool IsDead() const { return bDead; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void ConfigureForEra(ESPEra InEra);

	UFUNCTION(BlueprintCallable, Category = "Shadow|AI")
	void PlayDeath(bool bHeadshot);

	UPROPERTY(BlueprintAssignable, Category = "Shadow|AI|Events")
	FSPOnEnemyKilled OnEnemyKilled;

	// ------------------------------------------------------------- config
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float MaxHealth = 100.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float BaseDamage = 17.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float ArmourValue = 0.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	ESPEra Era = ESPEra::Egypt1973;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	TObjectPtr<USPWeaponData> WeaponData = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	TObjectPtr<UBehaviorTree> BehaviorTreeAsset = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	TObjectPtr<UNiagaraSystem> MuzzleFX = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	FName MuzzleSocketName = TEXT("MuzzleFlash");

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|AI")
	float MaxEngagementRange = 6000.f;

protected:
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float Health = 100.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	bool bDead = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	float FireCooldown = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|AI|State")
	bool bHasFiredThisBurst = false;

	void HandleDeath(AActor* Killer, bool bHeadshot);
};
