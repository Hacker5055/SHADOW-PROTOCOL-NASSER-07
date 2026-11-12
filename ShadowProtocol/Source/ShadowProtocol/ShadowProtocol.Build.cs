// SHADOW PROTOCOL: NASSER 07 — module rules

using UnrealBuildTool;

public class ShadowProtocol : ModuleRules
{
	public ShadowProtocol(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"UMG",
			"Slate",
			"SlateCore",
			"AIModule",
			"GameplayTasks",
			"NavigationSystem",
			"Niagara",
			"MetasoundEngine",
			"AudioMixer",
			"PhysicsCore",
			"GeometryScriptingCore",
			"LevelSequence",
			"MovieScene"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Projects",
			"RenderCore",
			"ApplicationCore"
		});

		// Enable code-inspection helpers in editor builds only.
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.Add("UnrealEd");
		}
	}
}
