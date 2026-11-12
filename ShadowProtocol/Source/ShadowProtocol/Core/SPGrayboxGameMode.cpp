// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPGrayboxGameMode.h"
#include "Core/SPPlayerController.h"
#include "Core/SPGameUserSettings.h"
#include "Mission/SPMissionManager.h"
#include "Mission/SPMissionData.h"
#include "World/SPGrayboxLevel.h"
#include "AI/SPSquadMember.h"
#include "Character/SPCharacter.h"

#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "UObject/UObjectGlobals.h"
#include "ShadowProtocol.h"

ASPGrayboxGameMode::ASPGrayboxGameMode()
{
	PlayerControllerClass = ASPPlayerController::StaticClass();

	// Classes are resolved at runtime by path rather than hard-referenced, so a
	// project without a Blueprint subclass still runs.
	GrayboxLevelClass = ASPGrayboxLevel::StaticClass();
	MissionManagerClass = ASPMissionManager::StaticClass();
	GrayboxSquadClass = ASPSquadMember::StaticClass();
}

void ASPGrayboxGameMode::BeginPlay()
{
	Super::BeginPlay();

	// 1) The range. If the level already contains one, use it.
	if (bBuildRange)
	{
		if (RangeLevel == nullptr)
		{
			for (TActorIterator<ASPGrayboxLevel> It(GetWorld()); It; ++It)
			{
				RangeLevel = *It;
				break;
			}
		}

		if (RangeLevel == nullptr && GrayboxLevelClass)
		{
			FActorSpawnParameters Params;
			Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
			RangeLevel = GetWorld()->SpawnActor<ASPGrayboxLevel>(
				GrayboxLevelClass, FVector::ZeroVector, FRotator::ZeroRotator, Params);
		}

		if (RangeLevel)
		{
			RangeLevel->BuildLayout();
		}
	}

	// 2) The test mission.
	if (!bRunTestMission)
	{
		return;
	}

	TestMission = CreateTestMission();

	if (!MissionManagerClass)
	{
		UE_LOG(LogShadowProtocol, Error, TEXT("Graybox game mode has no mission manager class."));
		return;
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	TestMissionManager = GetWorld()->SpawnActor<ASPMissionManager>(
		MissionManagerClass, FVector::ZeroVector, FRotator::ZeroRotator, Params);

	if (!TestMissionManager)
	{
		UE_LOG(LogShadowProtocol, Error, TEXT("Could not spawn the mission manager for the test range."));
		return;
	}

	TestMissionManager->SquadMemberClass = GrayboxSquadClass;
	TestMissionManager->StartMission(TestMission);

	// 3) Place the player on the west bank, facing the crossing.
	if (ASPCharacter* Player = Cast<ASPCharacter>(UGameplayStatics::GetPlayerPawn(this, 0)))
	{
		Player->ConfigureForCharacter(ESPCharacterId::Taher, ESPEra::Egypt1973);
		Player->SetActorLocation(FVector(-160.f * 100.f, 0.f, 120.f));
		Player->SetActorRotation(FRotator(0.f, 0.f, 0.f));
	}
}

USPMissionData* ASPGrayboxGameMode::CreateTestMission()
{
	// Built in code: the range must work with zero authored data assets.
	USPMissionData* Mission = NewObject<USPMissionData>(this, TEXT("DA_SPGrayboxRange"));
	if (!Mission)
	{
		return nullptr;
	}

	Mission->MissionId = TEXT("sp_graybox_range");
	Mission->ChapterIndex = 1;
	Mission->ChapterTitle = NSLOCTEXT("ShadowGraybox", "Title", "GRAYBOX RANGE — THE CROSSING");
	Mission->ChapterTitleArabic = NSLOCTEXT("ShadowGraybox", "TitleAr", "ميدان التدريب — العبور");
	Mission->MissionCode = TEXT("TEST / 1973");
	Mission->Synopsis = NSLOCTEXT("ShadowGraybox", "Synopsis",
		"Procedural 1973 crossing range. Cross the canal, clear three strongpoints, reach the depot.");
	Mission->EraLabel = NSLOCTEXT("ShadowGraybox", "Era", "EGYPT 1973");
	Mission->Era = ESPEra::Egypt1973;
	Mission->Protagonist = ESPCharacterId::Taher;
	Mission->PlayerStartLocation = FVector(-16000.f, 0.f, 120.f);
	Mission->PlayerStartRotation = FRotator::ZeroRotator;
	Mission->bAllowNightVision = false;
	Mission->TimeOfDayHours = 14.f;
	Mission->LightingPresetName = TEXT("1973_Afternoon");
	Mission->DefaultDifficulty = ESPDifficulty::Soldier;

	// Objectives.
	auto AddObjective = [Mission](FName Id, const FText& Text, const FText& Arabic,
		const FVector& Marker, bool bOptional)
	{
		FSPObjective Objective;
		Objective.Id = Id;
		Objective.Text = Text;
		Objective.TextArabic = Arabic;
		Objective.bOptional = bOptional;
		Objective.MarkerLocation = Marker;
		Objective.bHasMarker = !bOptional;
		Mission->Objectives.Add(Objective);
	};

	AddObjective(TEXT("range_breach"),
		NSLOCTEXT("ShadowGraybox", "Obj1", "Cross the canal through the breach"),
		NSLOCTEXT("ShadowGraybox", "Obj1Ar", "اعبر القناة من الفتحة"),
		FVector(4200.f, 0.f, 120.f), false);

	AddObjective(TEXT("range_strongpoint_1"),
		NSLOCTEXT("ShadowGraybox", "Obj2", "Clear strongpoint one"),
		NSLOCTEXT("ShadowGraybox", "Obj2Ar", "أمن النقطة الأولى"),
		FVector(13000.f, -3200.f, 120.f), false);

	AddObjective(TEXT("range_strongpoint_2"),
		NSLOCTEXT("ShadowGraybox", "Obj3", "Clear strongpoint two"),
		NSLOCTEXT("ShadowGraybox", "Obj3Ar", "أمن النقطة الثانية"),
		FVector(18000.f, 0.f, 120.f), false);

	AddObjective(TEXT("range_strongpoint_3"),
		NSLOCTEXT("ShadowGraybox", "Obj4", "Clear strongpoint three"),
		NSLOCTEXT("ShadowGraybox", "Obj4Ar", "أمن النقطة الثالثة"),
		FVector(13000.f, 3200.f, 120.f), false);

	AddObjective(TEXT("range_depot"),
		NSLOCTEXT("ShadowGraybox", "Obj5", "Reach the Qantara road depot"),
		NSLOCTEXT("ShadowGraybox", "Obj5Ar", "ابلغ مخزن طريق القنطرة"),
		FVector(27000.f, 14000.f, 120.f), false);

	AddObjective(TEXT("range_intel"),
		NSLOCTEXT("ShadowGraybox", "ObjOpt", "Recover the field ledger (optional)"),
		NSLOCTEXT("ShadowGraybox", "ObjOptAr", "استعد دفتر الميدان (اختياري)"),
		FVector::ZeroVector, true);

	// Intel manifest: two documents so the collection path is exercised.
	FSPIntelEntry Ledger;
	Ledger.Id = TEXT("box07_scan");
	Ledger.Chapter = 1;
	Ledger.Title = NSLOCTEXT("ShadowGraybox", "Intel1", "Field Ledger — torn page");
	Ledger.TitleArabic = NSLOCTEXT("ShadowGraybox", "Intel1Ar", "دفتر ميداني — صفحة ممزقة");
	Ledger.Body = NSLOCTEXT("ShadowGraybox", "Intel1Body",
		"Fourteen names, none of them in any Egyptian order of battle. The page is torn along the binding.");
	Ledger.BodyArabic = NSLOCTEXT("ShadowGraybox", "Intel1BodyAr",
		"أربعة عشر اسمًا لا يظهر أي منهم في جداول القوات المصرية. الصفحة ممزقة من عند الكعب.");
	Mission->IntelEntries.Add(Ledger);

	FSPIntelEntry Manifest;
	Manifest.Id = TEXT("depot_manifest");
	Manifest.Chapter = 1;
	Manifest.Title = NSLOCTEXT("ShadowGraybox", "Intel2", "Depot manifest, 6 October");
	Manifest.TitleArabic = NSLOCTEXT("ShadowGraybox", "Intel2Ar", "بيان المخزن، ٦ أكتوبر");
	Manifest.Body = NSLOCTEXT("ShadowGraybox", "Intel2Body",
		"Medical supplies signed for by a unit that was never formed.");
	Manifest.BodyArabic = NSLOCTEXT("ShadowGraybox", "Intel2BodyAr",
		"مستلزمات طبية موقعة من وحدة لم تُشكَّل قط.");
	Mission->IntelEntries.Add(Manifest);

	// Squad.
	FSPSquadSpawn SquadOne;
	SquadOne.CharacterId = ESPCharacterId::Fang;
	SquadOne.Callsign = NSLOCTEXT("ShadowGraybox", "Squad1", "SGT. FATHY");
	SquadOne.RelativeOffset = FVector(-220.f, 180.f, 0.f);
	Mission->SquadSpawns.Add(SquadOne);

	FSPSquadSpawn SquadTwo;
	SquadTwo.CharacterId = ESPCharacterId::Jackal;
	SquadTwo.Callsign = NSLOCTEXT("ShadowGraybox", "Squad2", "CPL. HASSAN");
	SquadTwo.RelativeOffset = FVector(-220.f, -180.f, 0.f);
	Mission->SquadSpawns.Add(SquadTwo);

	// Dialogue.
	FSPDialogueBeat Opening;
	Opening.TriggerId = TEXT("range_start");
	FSPDialogueLine Line;
	Line.SpeakerId = TEXT("Taher");
	Line.English = NSLOCTEXT("ShadowGraybox", "Line1",
		"Artillery lifts in one minute. Boats in the water. Nobody stops on the bank.");
	Line.Arabic = NSLOCTEXT("ShadowGraybox", "Line1Ar",
		"التمهيد يرفع بعد دقيقة. القوارب في الماء. لا أحد يتوقف على الضفة.");
	Line.bRadioFiltered = true;
	Opening.Lines.Add(Line);
	Mission->DialogueBeats.Add(Opening);

	UE_LOG(LogShadowProtocol, Log, TEXT("Graybox test mission built: %d objectives, %d intel, %d squad."),
		Mission->Objectives.Num(), Mission->IntelEntries.Num(), Mission->SquadSpawns.Num());

	return Mission;
}
