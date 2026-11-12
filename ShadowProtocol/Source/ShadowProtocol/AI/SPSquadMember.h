// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Core/ShadowProtocolTypes.h"
#include "SPSquadMember.generated.h"

class USPWeaponData;
class ASPCharacter;
class UNiagaraSystem;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FSPOnSquadMemberStateChanged, ASPSquadMember*, Member);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FSPOnSquadChatter, ASPSquadMember*, Member, FText, Line);

/**
 * ASPSquadMember
 *
 * A friendly AI. Uses simple, readable steering (formation slot following or an
 * ordered destination), takes damage, can go down and be revived, targets the
 * nearest visible hostile, and issues radio chatter through the HUD transcript.
 * Squad members are never static NPCs: they keep formation, break to cover when
 * suppressed, and re-form after combat.
 */
UCLASS()
class SHADOWPROTOCOL_API ASPSquadMember : public ACharacter
{
	GENERATED_BODY()

public:
	ASPSquadMember(const FObjectInitializer& ObjectInitializer);

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual float TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

	// ------------------------------------------------------------- orders
	UFUNCTION(BlueprintCallable, Category = "Shadow|Squad")
	void IssueOrder(ESPSquadOrder NewOrder, const FVector& Destination);

	UFUNCTION(BlueprintPure, Category = "Shadow|Squad")
	ESPSquadOrder GetCurrentOrder() const { return CurrentOrder; }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Squad")
	void SetFormationSlot(int32 SlotIndex, const FVector& Offset);

	UFUNCTION(BlueprintCallable, Category = "Shadow|Squad")
	void ConfigureIdentity(ESPCharacterId InCharacter, ESPEra InEra, const FText& InCallsign);

	// ------------------------------------------------------------- downed state
	UFUNCTION(BlueprintPure, Category = "Shadow|Squad")
	bool IsDowned() const { return bDowned; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Squad")
	bool IsKIA() const { return bKilled; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Squad")
	float GetHealthPercent() const { return Health / FMath::Max(MaxHealth, 1.f); }

	UFUNCTION(BlueprintCallable, Category = "Shadow|Squad")
	void AddReviveProgress(float Amount);

	UFUNCTION(BlueprintPure, Category = "Shadow|Squad")
	float GetReviveProgress() const { return bDowned ? ReviveProgress : 0.f; }

	UFUNCTION(BlueprintPure, Category = "Shadow|Squad")
	FText GetCallsign() const { return Callsign; }

	/** Eye-level world location, used for line-of-sight queries. */
	UFUNCTION(BlueprintPure, Category = "Shadow|Squad")
	FVector GetEyeLocation() const;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Squad|Events")
	FSPOnSquadMemberStateChanged OnSquadMemberStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "Shadow|Squad|Events")
	FSPOnSquadChatter OnSquadChatter;

	// ------------------------------------------------------------- tuning
	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float MaxHealth = 100.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float FollowSpeed = 440.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float CombatSpeed = 320.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float FormationCatchUpDistance = 900.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float EngagementRange = 4600.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float Accuracy = 0.46f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float DamagePerShot = 26.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float BleedOutSeconds = 45.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	float DownedDeathSecondsRealism = 22.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	TObjectPtr<USPWeaponData> WeaponData = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	TObjectPtr<UNiagaraSystem> MuzzleFX = nullptr;

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	FName MuzzleSocketName = TEXT("MuzzleFlash");

	UPROPERTY(EditDefaultsOnly, BlueprintReadWrite, Category = "Shadow|Squad")
	ESPCharacterId CharacterId = ESPCharacterId::Fang;

protected:
	void UpdateFollow(float DeltaSeconds);
	void UpdateCombat(float DeltaSeconds);
	void UpdateDowned(float DeltaSeconds);
	void MoveTowards(const FVector& Target, float Speed, float DeltaSeconds);
	AActor* FindBestTarget() const;
	void FireAt(AActor* Target);
	void Say(const FText& Text, bool bRadio = true);
	void HandleDowned();
	void HandleKilled();

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	ESPSquadOrder CurrentOrder = ESPSquadOrder::Follow;

	/** Last destination handed to the nav system, so we only path when it changes. */
	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	FVector CachedMoveGoal = FVector(FLT_MAX, FLT_MAX, FLT_MAX);

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	FVector OrderDestination = FVector::ZeroVector;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	FVector FormationOffset = FVector(-190.f, 160.f, 0.f);

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	float Health = 100.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	bool bDowned = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	bool bKilled = false;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	float ReviveProgress = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	float DownedTime = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	float FireCooldown = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	float TimeSinceChatter = 0.f;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	FText Callsign;

	UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Shadow|Squad|State")
	ESPEra Era = ESPEra::Egypt1973;
};
