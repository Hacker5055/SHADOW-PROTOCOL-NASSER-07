// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPMenuGameMode.h"
#include "Core/SPMainMenuController.h"

#include "GameFramework/SpectatorPawn.h"

ASPMenuGameMode::ASPMenuGameMode()
{
	PlayerControllerClass = ASPMainMenuController::StaticClass();
	DefaultPawnClass = ASpectatorPawn::StaticClass();
	bStartPlayersAsSpectators = false;
}
