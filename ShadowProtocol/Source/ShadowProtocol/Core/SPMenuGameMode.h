// Copyright (c) SHADOW PROTOCOL: NASSER 07.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "SPMenuGameMode.generated.h"

/**
 * ASPMenuGameMode
 *
 * The front-end session: no pawn, no combat, mouse-driven UI. Kept separate from
 * ASPGameMode so the menu can never accidentally start spawning squads or
 * applying difficulty rules.
 */
UCLASS(Blueprintable)
class SHADOWPROTOCOL_API ASPMenuGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ASPMenuGameMode();
};
