using UnrealBuildTool;
using System.Collections.Generic;

public class ShadowProtocolEditorTarget : TargetRules
{
	public ShadowProtocolEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("ShadowProtocol");
	}
}
