// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#include "Core/SPSaveGame.h"

USPSaveGame::USPSaveGame()
{
	SaveSlotName = TEXT("Campaign");
	SaveVersion = 1;
	LastSaved = FDateTime::UtcNow();
}
