// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "UI/SPHUDWidget.h"
#include "Character/SPCharacter.h"
#include "Character/SPCharacterMovementComponent.h"
#include "Weapons/SPWeaponComponent.h"
#include "Weapons/SPWeaponData.h"
#include "AI/SPSquadMember.h"
#include "Mission/SPMissionManager.h"

#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Engine/World.h"

void USPHUDWidget::NativeConstruct()
{
	Super::NativeConstruct();
	RefreshFromPlayer();
}

void USPHUDWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
	Super::NativeTick(MyGeometry, InDeltaTime);

	TimeSinceRefresh += InDeltaTime;
	if (TimeSinceRefresh >= RefreshInterval)
	{
		TimeSinceRefresh = 0.f;
		RefreshFromPlayer();
	}

	if (bSubtitleVisible)
	{
		SubtitleTimer -= InDeltaTime;
		if (SubtitleTimer <= 0.f)
		{
			HideSubtitle();
		}
	}
}

void USPHUDWidget::RefreshFromPlayer()
{
	ASPCharacter* Player = Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!Player)
	{
		return;
	}

	HealthAlpha = Player->GetHealthNormalised();
	bPlayerDead = !Player->IsAlive();
	Era = Player->GetEra();
	CompassHeading = Player->GetCompassHeading();
	Grenades = Player->GetGrenadeCount();

	if (Player->ShadowMovement)
	{
		Stance = Player->ShadowMovement->GetStance();
		StaminaAlpha = Player->ShadowMovement->GetStamina();
	}

	if (Player->WeaponComponent)
	{
		USPWeaponComponent* Weapons = Player->WeaponComponent;
		MagazineAmmo = Weapons->GetMagazineAmmo();
		ReserveAmmo = Weapons->GetReserveAmmo();
		bReloading = Weapons->IsReloading();
		ReloadProgress = Weapons->GetReloadProgress();
		Suppression = Weapons->GetSuppression();

		if (const USPWeaponData* Weapon = Weapons->GetCurrentWeapon())
		{
			WeaponName = bArabicSubtitles ? Weapon->DisplayNameArabic : Weapon->DisplayName;
		}
	}

	// Mission data.
	if (!CachedMission)
	{
		for (TActorIterator<ASPMissionManager> It(GetWorld()); It; ++It)
		{
			CachedMission = *It;
			break;
		}
	}

	if (CachedMission)
	{
		const FSPObjective Current = CachedMission->GetCurrentObjective();
		bHasObjective = !Current.Id.IsNone();
		ObjectiveTitle = Current.Text;
		ObjectiveArabic = Current.TextArabic;
		IntelCollected = CachedMission->GetCollectedIntelCount();

		if (Current.bHasMarker)
		{
			ObjectiveDistanceMetres =
				FVector::Dist2D(Player->GetActorLocation(), Current.MarkerLocation) / 100.f;
		}
	}

	// Squad status rows.
	SquadRows.Reset();
	for (TActorIterator<ASPSquadMember> It(GetWorld()); It; ++It)
	{
		ASPSquadMember* Member = *It;
		if (!Member)
		{
			continue;
		}

		FSPSquadRow Row;
		Row.Callsign = Member->GetCallsign();
		Row.HealthAlpha = Member->GetHealthPercent();
		Row.bDowned = Member->IsDowned();
		Row.bKIA = Member->IsKIA();
		SquadRows.Add(Row);
	}

	OnHUDRefreshed();
}

void USPHUDWidget::ShowSubtitleLine(const FText& Speaker, const FText& Line, bool bRadio)
{
	SubtitleSpeaker = Speaker;
	SubtitleLine = Line;
	bSubtitleIsRadio = bRadio;
	bSubtitleVisible = true;
	SubtitleTimer = SubtitleDuration;
}

void USPHUDWidget::HideSubtitle()
{
	bSubtitleVisible = false;
	SubtitleTimer = 0.f;
}

void USPHUDWidget::FlashNotification(const FText& Message, FLinearColor Colour)
{
	// Forward to the widget Blueprint, which owns the toast animation.
	OnNotificationFlash(Message, Colour);
}

void USPHUDWidget::SetArabicSubtitles(bool bEnabled)
{
	bArabicSubtitles = bEnabled;
}

void USPHUDWidget::SetTacticalMapOpen(bool bOpen)
{
	bTacticalMapOpen = bOpen;
}

void USPHUDWidget::SetCinematicLetterbox(bool bEnabled)
{
	bCinematicLetterbox = bEnabled;
}

void USPHUDWidget::SetInteractionPrompt(const FText& Text, bool bShow)
{
	bInteractionPromptVisible = bShow;
	InteractionPromptText = bShow ? Text : FText::GetEmpty();
}
