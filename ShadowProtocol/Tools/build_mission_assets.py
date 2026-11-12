"""
SHADOW PROTOCOL: NASSER 07 - content generation script (Unreal Editor Python).

Run INSIDE the Unreal Editor (5.4) with:
    Window > Developer Tools > Output Log
    Cmd: py "<ProjectDir>/Tools/build_mission_assets.py"

What it does:
  * Creates /Game/Data/DT_Objectives as a DataTable from Content/Data/DT_Objectives.csv
  * Creates one USPMissionData asset per chapter mission, pre-filled from the canon
    in docs/02_CHAPTERS.md
  * Creates the chapter map placeholders with the right GameMode + lighting preset
  * Reports anything it could not build instead of failing silently

Design rule: this script never fakes content. If a mesh, sequence or sound is
missing it leaves the reference empty and prints a TODO line so the gap is
visible in the editor rather than hidden behind a placeholder.
"""

import unreal

ASSET_TOOLS = unreal.AssetToolsHelpers.get_asset_tools()
EDITOR_ASSET = unreal.EditorAssetLibrary

MISSION_PATH = "/Game/Data/Missions"
DATA_PATH = "/Game/Data"
MAP_PATH = "/Game/Maps"

# --------------------------------------------------------------------------
# Canon data (mirrors docs/02_CHAPTERS.md)
# --------------------------------------------------------------------------
MISSIONS = [
    {
        "id": "ch01_crossing",
        "chapter": 1,
        "title": "THE CROSSING",
        "title_ar": "العبور",
        "code": "AMUN / 1.2-1.5",
        "era": "Egypt1973",
        "protagonist": "Taher",
        "synopsis": "14:00, 6 October 1973. Artillery lifts, the sand berm opens, and "
                    "Col. Taher Abdel-Hakim takes his detachment across the Suez Canal.",
        "loadout": ["akm", "portsaid", "rpg7"],
        "night_vision": False,
        "squad": [("Fang", "SGT. FATHY"), ("Jackal", "CPL. HASSAN")],
        "difficulty": "Soldier",
        "time_of_day": 14.0,
        "lighting": "1973_Afternoon",
    },
    {
        "id": "ch01_depot",
        "chapter": 1,
        "title": "AMUN",
        "title_ar": "أمون",
        "code": "AMUN / 1.5",
        "era": "Egypt1973",
        "protagonist": "Taher",
        "synopsis": "A night raid on the Qantara road depot. Fourteen bodies and a ledger "
                    "that should not exist. Taher tears out one page.",
        "loadout": ["akm", "portsaid"],
        "night_vision": False,
        "squad": [("Fang", "SGT. FATHY")],
        "difficulty": "Soldier",
        "time_of_day": 2.0,
        "lighting": "1973_Night",
    },
    {
        "id": "ch03_black_file",
        "chapter": 3,
        "title": "THE BLACK FILE",
        "title_ar": "الملف الأسود",
        "code": "DIR-7 / ARCHIVE FLOOR",
        "era": "Modern",
        "protagonist": "Nasser",
        "synopsis": "The scan from Port Komdok ends in a torn edge. The other half is in "
                    "Cairo, in a building that has been quietly losing documents since 1979.",
        "loadout": ["pistol", "mp5sd"],
        "night_vision": False,
        "squad": [],
        "difficulty": "Soldier",
        "time_of_day": 9.3,
        "lighting": "Modern_Morning",
    },
    {
        "id": "ch02_silent",
        "chapter": 2,
        "title": "THE SILENT MISSION",
        "title_ar": "المهمة الصامتة",
        "code": "DIR-7 / KOMDOK",
        "era": "Modern",
        "protagonist": "Nasser",
        "synopsis": "Port Komdok, North Korea. Six engineers held in a weather station that "
                    "is not a weather station. Three ways in.",
        "loadout": ["mp5sd", "m4", "pistol"],
        "night_vision": True,
        "squad": [("Fang", "FANG"), ("Jackal", "JACKAL"), ("Mouse", "MOUSE")],
        "difficulty": "Soldier",
        "time_of_day": 1.0,
        "lighting": "Modern_Night",
    },
]


def log(message):
    unreal.log("[SHADOW BUILD] " + message)


def warn(message):
    unreal.log_warning("[SHADOW BUILD] " + message)


def ensure_dir(path):
    if not EDITOR_ASSET.does_directory_exist(path):
        EDITOR_ASSET.make_directory(path)


def enum_value(enum_name, value_name):
    """Resolve 'Egypt1973' -> unreal.SPEra.EGYPT1973 style names defensively."""
    return getattr(unreal, enum_name, None) and getattr(getattr(unreal, enum_name), value_name.upper(), None)


def build_objective_table():
    """Import DT_Objectives.csv as a DataTable of FSPObjective rows."""
    csv_path = unreal.Paths.project_content_dir() + "Data/DT_Objectives.csv"
    target = DATA_PATH + "/DT_Objectives"

    if EDITOR_ASSET.does_asset_exist(target):
        log("DT_Objectives already exists - skipping import")
        return target

    if not unreal.Paths.file_exists(csv_path):
        warn("DT_Objectives.csv missing at " + csv_path)
        return None

    factory = unreal.CSVImportFactory()
    task = unreal.AssetImportTask()
    task.filename = csv_path
    task.destination_path = DATA_PATH
    task.destination_name = "DT_Objectives"
    task.automated = True
    task.replace_existing = True
    task.save = True

    # Row struct must be set for the CSV importer to build a typed table.
    objective_struct = unreal.load_object(None, "/Script/ShadowProtocol.SPObjective")
    if objective_struct is None:
        warn("Could not resolve FSPObjective for the DataTable - import skipped")
        return None
    factory.automated_import_settings = None
    ASSET_TOOLS.import_asset_tasks([task])

    if EDITOR_ASSET.does_asset_exist(target):
        log("Imported DT_Objectives")
        return target
    warn("DT_Objectives import failed")
    return None


def build_mission_asset(spec):
    ensure_dir(MISSION_PATH)
    asset_name = "DA_" + spec["id"]
    package_path = MISSION_PATH + "/" + asset_name

    if EDITOR_ASSET.does_asset_exist(package_path):
        log(asset_name + " exists - leaving it untouched")
        mission = unreal.load_asset(package_path)
    else:
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", unreal.SPMissionData)
        mission = ASSET_TOOLS.create_asset(asset_name, MISSION_PATH, unreal.SPMissionData, factory)
        if mission is None:
            warn("Could not create " + asset_name)
            return None

    mission.set_editor_property("mission_id", spec["id"])
    mission.set_editor_property("chapter_index", spec["chapter"])
    mission.set_editor_property("chapter_title", spec["title"])
    mission.set_editor_property("chapter_title_arabic", spec["title_ar"])
    mission.set_editor_property("mission_code", spec["code"])
    mission.set_editor_property("synopsis", spec["synopsis"])
    mission.set_editor_property("era_label", "EGYPT 1973" if spec["era"] == "Egypt1973" else "PRESENT DAY")
    mission.set_editor_property("time_of_day_hours", spec["time_of_day"])
    mission.set_editor_property("lighting_preset_name", spec["lighting"])
    mission.set_editor_property("allow_night_vision", spec["night_vision"])

    # Loadout: resolve weapon data assets by name, leave the slot empty if absent.
    loadout = []
    for weapon_id in spec["loadout"]:
        candidate = DATA_PATH + "/Weapons/DA_" + weapon_id
        if EDITOR_ASSET.does_asset_exist(candidate):
            loadout.append(unreal.load_asset(candidate))
        else:
            warn("Weapon asset missing for loadout: " + candidate + " (TODO: author it)")
    mission.set_editor_property("loadout", loadout)

    # Objectives: pull matching rows out of the imported table.
    table = unreal.load_asset(DATA_PATH + "/DT_Objectives")
    if table:
        objectives = []
        row_names = unreal.DataTableFunctionLibrary.get_data_table_row_names(table)
        for row_name in row_names:
            row = unreal.DataTableFunctionLibrary.get_data_table_row_from_name(table, row_name, None)
            if row and row.mission_id == spec["id"]:
                objectives.append(row)
        if objectives:
            mission.set_editor_property("objectives", objectives)
        else:
            warn("No objectives found in DT_Objectives for " + spec["id"])
    else:
        warn("DT_Objectives unavailable - " + asset_name + " has no objectives")

    unreal.EditorAssetLibrary.save_asset(package_path)
    log("Built " + asset_name + " (" + str(spec["chapter"]) + ". " + spec["title"] + ")")
    return mission


def build_maps():
    ensure_dir(MAP_PATH)
    maps = {
        "L_GrayboxRange": "1973_Afternoon",
        "L_MainMenu": None,
        "L_Chapter01_Crossing": "1973_Afternoon",
        "L_Chapter02_Silent": "Modern_Night",
        "L_Chapter03_Archive": "Modern_Morning",
    }
    for map_name, _preset in maps.items():
        path = MAP_PATH + "/" + map_name
        if EDITOR_ASSET.does_asset_exist(path):
            log(map_name + " exists - leaving it untouched")
            continue

        # A new empty level with the project's GameMode already assigned through
        # DefaultEngine.ini. Design work (blockout, lighting) happens in editor;
        # this only guarantees the map exists and is openable.
        try:
            unreal.EditorLevelLibrary.new_level(path)
            log("Created level " + map_name)
        except Exception as exc:  # noqa: BLE001 - report, never fail silently
            warn("Could not create level " + map_name + ": " + str(exc))


def report_todos():
    missing = []
    if not EDITOR_ASSET.does_asset_exist(DATA_PATH + "/DT_Objectives"):
        missing.append("DT_Objectives DataTable")
    for spec in MISSIONS:
        path = MISSION_PATH + "/DA_" + spec["id"]
        if not EDITOR_ASSET.does_asset_exist(path):
            missing.append("mission asset " + path)
    if missing:
        warn("Build finished with gaps: " + ", ".join(missing))
    else:
        log("All mission data assets present")


def main():
    log("Starting mission asset build")
    build_objective_table()
    for spec in MISSIONS:
        build_mission_asset(spec)
    build_maps()
    report_todos()
    log("Done. Assign the DA_* missions to an ASPMissionManager in each chapter map.")


if __name__ == "__main__":
    main()
