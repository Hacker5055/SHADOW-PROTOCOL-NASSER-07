// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Weapons/SPWeaponComponent.h"
#include "Weapons/SPWeaponData.h"
#include "Character/SPCharacter.h"
#include "Character/SPCharacterMovementComponent.h"
#include "AI/SPAIController.h"
#include "Core/SPGameMode.h"

#include "Camera/CameraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraComponent.h"
#include "TimerManager.h"
#include "Perception/AISense_Hearing.h"
#include "ShadowProtocol.h"

USPWeaponComponent::USPWeaponComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostPhysics;
}

void USPWeaponComponent::BeginPlay()
{
	Super::BeginPlay();

	// Build the starting loadout, filtering anything era-incompatible.
	for (USPWeaponData* Data : StartingLoadout)
	{
		if (Data)
		{
			AddWeaponToLoadout(Data);
		}
	}

	if (Loadout.Num() > 0)
	{
		EquipWeapon(Loadout[0].Data, true);
	}
}

void USPWeaponComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	FireCooldown = FMath::Max(0.f, FireCooldown - DeltaTime);
	SwitchCooldown = FMath::Max(0.f, SwitchCooldown - DeltaTime);
	TimeSinceLastShot += DeltaTime;

	// Recoil recovery toward zero.
	if (!AccumulatedRecoil.IsNearlyZero())
	{
		const FRotator Recovery = AccumulatedRecoil * FMath::Clamp(RecoilRecoverySpeed * DeltaTime, 0.f, 1.f);
		AccumulatedRecoil -= Recovery;
		if (AccumulatedRecoil.IsNearlyZero(0.01f))
		{
			AccumulatedRecoil = FRotator::ZeroRotator;
		}
	}

	Suppression = FMath::Max(0.f, Suppression - SuppressionDecayPerSecond * DeltaTime);

	if (bReloading)
	{
		ReloadRemaining -= DeltaTime;
		// The timer handle drives completion on clients/servers alike; this is a
		// fallback safety net if the timer is cleared by a weapon swap.
		if (ReloadRemaining <= 0.f)
		{
			FinishReload();
		}
	}

	// Automatic fire.
	if (bFiring && !bReloading && SwitchCooldown <= 0.f)
	{
		const USPWeaponData* Data = GetCurrentWeapon();
		if (!Data)
		{
			return;
		}

		if (Data->FireMode == ESPFireMode::FullAuto && FireCooldown <= 0.f)
		{
			FireOneShot();
		}
		else if (Data->FireMode == ESPFireMode::Burst && BurstShotsRemaining > 0 && FireCooldown <= 0.f)
		{
			FireOneShot();
			BurstShotsRemaining--;
		}
	}
}

// -------------------------------------------------------------------- loadout
void USPWeaponComponent::SetEra(ESPEra InEra)
{
	CurrentEra = InEra;

	// Drop anything that no longer matches (e.g. a checkpoint reload into a
	// different era). This is the single authoritative era gate.
	for (int32 Index = Loadout.Num() - 1; Index >= 0; --Index)
	{
		const USPWeaponData* Data = Loadout[Index].Data;
		if (!Data)
		{
			Loadout.RemoveAt(Index);
			continue;
		}
		FString Reason;
		if (!Data->ValidateEraCompatibility(CurrentEra, Reason))
		{
			UE_LOG(LogShadowProtocol, Error, TEXT("Loadout purge: %s"), *Reason);
			Loadout.RemoveAt(Index);
		}
	}

	if (Loadout.Num() > 0)
	{
		EquipWeapon(Loadout[0].Data, true);
	}
	else
	{
		CurrentIndex = INDEX_NONE;
		OnWeaponChanged.Broadcast(nullptr);
	}
}

bool USPWeaponComponent::AddWeaponToLoadout(USPWeaponData* WeaponData)
{
	if (!WeaponData)
	{
		return false;
	}

	FString Reason;
	if (!WeaponData->ValidateEraCompatibility(CurrentEra, Reason))
	{
		UE_LOG(LogShadowProtocol, Warning, TEXT("Refused weapon: %s"), *Reason);
		return false;
	}

	for (const FSPWeaponInstance& Existing : Loadout)
	{
		if (Existing.Data == WeaponData)
		{
			return false; // already carried
		}
	}

	FSPWeaponInstance Instance;
	Instance.Data = WeaponData;
	Instance.MagazineAmmo = WeaponData->MagazineSize;
	Instance.ReserveAmmo = WeaponData->StartingReserveAmmo;
	Loadout.Add(Instance);
	return true;
}

bool USPWeaponComponent::EquipWeapon(USPWeaponData* WeaponData, bool bForce)
{
	if (!WeaponData)
	{
		return false;
	}

	int32 FoundIndex = INDEX_NONE;
	for (int32 Index = 0; Index < Loadout.Num(); ++Index)
	{
		if (Loadout[Index].Data == WeaponData)
		{
			FoundIndex = Index;
			break;
		}
	}

	if (FoundIndex == INDEX_NONE)
	{
		if (!bForce || !AddWeaponToLoadout(WeaponData))
		{
			return false;
		}
		FoundIndex = Loadout.Num() - 1;
	}

	FString Reason;
	if (!WeaponData->ValidateEraCompatibility(CurrentEra, Reason))
	{
		UE_LOG(LogShadowProtocol, Error, TEXT("Equip refused: %s"), *Reason);
		return false;
	}

	CurrentIndex = FoundIndex;
	SwitchCooldown = WeaponData->WeaponSwitchTime;
	bReloading = false;
	bFiring = false;
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(ReloadTimer);
	}

	OnWeaponChanged.Broadcast(WeaponData);
	BroadcastAmmo();
	return true;
}

void USPWeaponComponent::CycleWeapon()
{
	if (Loadout.Num() < 2 || SwitchCooldown > 0.f)
	{
		return;
	}
	const int32 Next = (CurrentIndex + 1) % Loadout.Num();
	EquipWeapon(Loadout[Next].Data);
}

USPWeaponData* USPWeaponComponent::GetCurrentWeapon() const
{
	if (!Loadout.IsValidIndex(CurrentIndex))
	{
		return nullptr;
	}
	return Loadout[CurrentIndex].Data;
}

int32 USPWeaponComponent::GetMagazineAmmo() const
{
	return Loadout.IsValidIndex(CurrentIndex) ? Loadout[CurrentIndex].MagazineAmmo : 0;
}

int32 USPWeaponComponent::GetReserveAmmo() const
{
	return Loadout.IsValidIndex(CurrentIndex) ? Loadout[CurrentIndex].ReserveAmmo : 0;
}

// -------------------------------------------------------------------- firing
void USPWeaponComponent::StartFire()
{
	USPWeaponData* Data = GetCurrentWeapon();
	if (!Data || bReloading || SwitchCooldown > 0.f)
	{
		return;
	}

	bFiring = true;

	if (Data->FireMode == ESPFireMode::Single || Data->FireMode == ESPFireMode::BoltAction)
	{
		if (FireCooldown <= 0.f)
		{
			FireOneShot();
		}
		bFiring = false;
	}
	else if (Data->FireMode == ESPFireMode::Burst)
	{
		BurstShotsRemaining = 3;
	}
}

void USPWeaponComponent::StopFire()
{
	bFiring = false;
	BurstShotsRemaining = 0;
}

void USPWeaponComponent::FireOneShot()
{
	if (!Loadout.IsValidIndex(CurrentIndex))
	{
		return;
	}

	USPWeaponData* Data = Loadout[CurrentIndex].Data;
	FSPWeaponInstance& Instance = Loadout[CurrentIndex];

	if (Instance.MagazineAmmo <= 0)
	{
		// Click, then auto-reload (a courtesy the brief asks for in §4).
		Reload();
		return;
	}

	Instance.MagazineAmmo--;
	FireCooldown = 60.f / FMath::Max(Data->RoundsPerMinute, 1.f);
	TimeSinceLastShot = 0.f;

	ASPCharacter* Character = GetOwningCharacter();
	FCollisionQueryParams Params(SCENE_QUERY_STAT(SPWeaponFire), true, Character);

	const float SpreadDegrees = GetCurrentSpreadDegrees();

	FVector Origin;
	FVector Direction;
	GetShotOriginAndDirection(Origin, Direction);

	for (int32 Pellet = 0; Pellet < FMath::Max(1, Data->PelletsPerShot); ++Pellet)
	{
		// Cone spread using two Gaussian samples.
		const float PitchOffset = FMath::FRandRange(-SpreadDegrees, SpreadDegrees);
		const float YawOffset = FMath::FRandRange(-SpreadDegrees, SpreadDegrees);
		FRotator ShotRotation = Direction.Rotation();
		ShotRotation.Pitch += PitchOffset;
		ShotRotation.Yaw += YawOffset;
		const FVector ShotDir = ShotRotation.Vector();

		FHitResult Hit;
		const FVector TraceEnd = Origin + ShotDir * Data->MaxRange;
		const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, Origin, TraceEnd, ECC_Pawn, Params);

		if (bHit)
		{
			AActor* HitActor = Hit.GetActor();
			const float Distance = Hit.Distance;
			float Damage = Data->GetDamageAtDistance(Distance);

			// Determine hit zone from the bone name.
			const FName Bone = Hit.BoneName;
			const bool bHead = Bone == TEXT("head") || Bone == TEXT("neck_01");
			const bool bLimb = Bone == TEXT("upperarm_l") || Bone == TEXT("upperarm_r")
				|| Bone == TEXT("thigh_l") || Bone == TEXT("thigh_r")
				|| Bone == TEXT("calf_l") || Bone == TEXT("calf_r")
				|| Bone == TEXT("lowerarm_l") || Bone == TEXT("lowerarm_r");

			if (bHead)
			{
				Damage *= Data->HeadshotMultiplier;
			}
			else if (bLimb)
			{
				Damage *= Data->LimbMultiplier;
			}

			if (HitActor)
			{
				FDamageEvent DamageEvent;
				HitActor->TakeDamage(Damage, DamageEvent, Character ? Character->GetController() : nullptr, Character);

				const bool bKilling = bHead; // precise report comes back from the AI
				OnHitConfirmed.Broadcast(bKilling, bHead);
			}

			// Impact FX + physical material response.
			if (Data->ImpactEffect)
			{
				UNiagaraFunctionLibrary::SpawnSystemAtLocation(GetWorld(), Data->ImpactEffect,
					Hit.ImpactPoint, Hit.ImpactNormal.Rotation());
			}
			UGameplayStatics::PlaySoundAtLocation(GetWorld(), Data->FireSound, Hit.ImpactPoint, 0.35f);
		}
	}

	ApplyRecoil();
	PlayFireEffects();
	ReportNoise();
	BroadcastAmmo();
}

void USPWeaponComponent::ApplyRecoil()
{
	USPWeaponData* Data = GetCurrentWeapon();
	ASPCharacter* Character = GetOwningCharacter();
	if (!Data || !Character)
	{
		return;
	}

	// Recoil scales down while aiming (shouldering the weapon braces it).
	const float AimScale = bAiming ? 0.62f : 1.f;
	FRotator Kick(
		Data->RecoilPitch * AimScale,
		FMath::FRandRange(-Data->RecoilYaw, Data->RecoilYaw) * AimScale,
		0.f);

	AccumulatedRecoil += Kick;

	// Part of the kick is applied immediately to the controller so the shot
	// "feels" instant; the rest is recovered by ConsumeRecoil each frame.
	AController* Controller = Character->GetController();
	if (Controller)
	{
		Controller->AddPitchInput(-Data->RecoilPitch * (1.f - Data->RecoilRecoilControl) * 0.35f);
		Controller->AddYawInput(FMath::FRandRange(-Data->RecoilYaw, Data->RecoilYaw) * 0.35f);
	}
}

FRotator USPWeaponComponent::ConsumeRecoil()
{
	// The camera consumes a slice of the accumulated recoil each frame; the
	// remainder is returned to zero by the component's own recovery.
	const FRotator Out = AccumulatedRecoil * 0.22f;
	return Out;
}

void USPWeaponComponent::PlayFireEffects()
{
	USPWeaponData* Data = GetCurrentWeapon();
	ASPCharacter* Character = GetOwningCharacter();
	if (!Data || !Character)
	{
		return;
	}

	if (USkeletalMeshComponent* Mesh = Character->GetMesh())
	{
		if (Data->MuzzleFlash)
		{
			UNiagaraComponent* FX = UNiagaraFunctionLibrary::SpawnSystemAttached(
				Data->MuzzleFlash, Mesh, MuzzleSocketName, FVector::ZeroVector,
				FRotator::ZeroRotator, EAttachLocation::SnapToTarget, true);
			if (FX)
			{
				FX->SetAutoDestroy(true);
			}
		}
	}

	USoundBase* Sound = (Data->bSuppressed && Data->SuppressedFireSound) ? Data->SuppressedFireSound : Data->FireSound;
	if (Sound)
	{
		UGameplayStatics::PlaySoundAtLocation(GetWorld(), Sound, Character->GetActorLocation());
	}
}

void USPWeaponComponent::ReportNoise()
{
	USPWeaponData* Data = GetCurrentWeapon();
	ASPCharacter* Character = GetOwningCharacter();
	if (!Data || !Character)
	{
		return;
	}

	// Suppressed weapons carry far less: this is the mechanical teeth of the
	// stealth design in Chapter 02.
	const float RadiusMeters = Data->bSuppressed ? Data->NoiseRadiusMeters * 0.22f : Data->NoiseRadiusMeters;

	UAISense_Hearing::ReportNoiseEvent(
		GetWorld(),
		Character->GetActorLocation(),
		1.f,
		Character,
		RadiusMeters * 100.f,
		TEXT("Gunshot"));

	// Alert nearby squad AI's enemies through our own director as well, so the
	// behaviour tree can react without a perception update latency.
	if (ASPGameMode* GM = GetWorld()->GetAuthGameMode<ASPGameMode>())
	{
		GM->NotifySoundEvent(Character->GetActorLocation(), RadiusMeters * 100.f, TEXT("Gunshot"));
	}
}

void USPWeaponComponent::GetShotOriginAndDirection(FVector& OutOrigin, FVector& OutDirection) const
{
	const ASPCharacter* Character = GetOwningCharacter();
	if (!Character || !Character->FirstPersonCamera)
	{
		OutOrigin = GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector;
		OutDirection = GetOwner() ? GetOwner()->GetActorForwardVector() : FVector::ForwardVector;
		return;
	}

	OutOrigin = Character->FirstPersonCamera->GetComponentLocation();
	OutDirection = Character->FirstPersonCamera->GetForwardVector();
}

float USPWeaponComponent::GetCurrentSpreadDegrees() const
{
	const USPWeaponData* Data = GetCurrentWeapon();
	if (!Data)
	{
		return 0.f;
	}

	float Spread = bAiming ? Data->AimSpread : Data->HipFireSpread;

	const ASPCharacter* Character = GetOwningCharacter();
	if (Character && Character->GetVelocity().SizeSquared() > 100.f)
	{
		const float SpeedAlpha = FMath::Clamp(Character->GetVelocity().Size() / 500.f, 0.f, 1.f);
		Spread += Data->MovingSpreadPenalty * SpeedAlpha;
	}

	if (Character && Character->ShadowMovement)
	{
		if (Character->ShadowMovement->IsSlidingNow())
		{
			Spread += 1.8f;
		}
		else if (Character->GetCharacterMovement()->IsFalling())
		{
			Spread += 2.2f;
		}
	}

	return Spread;
}

void USPWeaponComponent::SetAiming(bool bNewAiming)
{
	bAiming = bNewAiming;
}

float USPWeaponComponent::GetAimFOV(float BaseFOV) const
{
	const USPWeaponData* Data = GetCurrentWeapon();
	return Data ? BaseFOV * Data->AimFOVMultiplier : BaseFOV;
}

void USPWeaponComponent::AddSuppression(float Amount)
{
	Suppression = FMath::Clamp(Suppression + Amount, 0.f, 1.f);
}

// -------------------------------------------------------------------- reload
bool USPWeaponComponent::Reload()
{
	if (bReloading || !Loadout.IsValidIndex(CurrentIndex))
	{
		return false;
	}

	USPWeaponData* Data = Loadout[CurrentIndex].Data;
	FSPWeaponInstance& Instance = Loadout[CurrentIndex];

	if (Instance.MagazineAmmo >= Data->MagazineSize || Instance.ReserveAmmo <= 0)
	{
		return false;
	}

	bReloading = true;
	bFiring = false;
	const float Duration = Instance.MagazineAmmo == 0 ? Data->ReloadTimeEmpty : Data->ReloadTime;
	ReloadRemaining = Duration;

	OnReloadStateChanged.Broadcast(true);

	GetWorld()->GetTimerManager().SetTimer(ReloadTimer, this, &USPWeaponComponent::HandleReloadFinished, Duration, false);
	return true;
}

void USPWeaponComponent::HandleReloadFinished()
{
	FinishReload();
}

void USPWeaponComponent::FinishReload()
{
	if (!bReloading || !Loadout.IsValidIndex(CurrentIndex))
	{
		return;
	}

	USPWeaponData* Data = Loadout[CurrentIndex].Data;
	FSPWeaponInstance& Instance = Loadout[CurrentIndex];

	const int32 Needed = Data->MagazineSize - Instance.MagazineAmmo;
	const int32 Taken = FMath::Min(Needed, Instance.ReserveAmmo);
	Instance.MagazineAmmo += Taken;
	Instance.ReserveAmmo -= Taken;

	bReloading = false;
	ReloadRemaining = 0.f;
	OnReloadStateChanged.Broadcast(false);
	BroadcastAmmo();
}

float USPWeaponComponent::GetReloadProgress() const
{
	const USPWeaponData* Data = GetCurrentWeapon();
	if (!Data || !bReloading)
	{
		return 0.f;
	}
	const float Total = Data->ReloadTime;
	return Total > 0.f ? FMath::Clamp(1.f - (ReloadRemaining / Total), 0.f, 1.f) : 0.f;
}

void USPWeaponComponent::BroadcastAmmo()
{
	OnAmmoChanged.Broadcast(GetMagazineAmmo(), GetReserveAmmo(), GetCurrentWeapon());
}

ASPCharacter* USPWeaponComponent::GetOwningCharacter() const
{
	return Cast<ASPCharacter>(GetOwner());
}
