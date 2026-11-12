// SHADOW PROTOCOL: NASSER 07 — module implementation

#include "ShadowProtocol.h"
#include "Modules/ModuleManager.h"

DEFINE_LOG_CATEGORY(LogShadowProtocol);

void FShadowProtocolModule::StartupModule()
{
	UE_LOG(LogShadowProtocol, Log, TEXT("SHADOW PROTOCOL: NASSER 07 — module online."));
}

void FShadowProtocolModule::ShutdownModule()
{
	UE_LOG(LogShadowProtocol, Log, TEXT("SHADOW PROTOCOL: NASSER 07 — module offline."));
}

IMPLEMENT_PRIMARY_GAME_MODULE(FShadowProtocolModule, ShadowProtocol, "ShadowProtocol");
