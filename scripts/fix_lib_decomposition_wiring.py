from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src-tauri/src"

# Command functions are re-exported through commands/mod.rs to the crate root,
# so their visibility must permit that one-level re-export.
for relative in [
    "commands/system_command.rs",
    "commands/folder_command.rs",
    "commands/delivery_notes_command.rs",
    "commands/workspace_command_support.rs",
]:
    path = SRC / relative
    text = path.read_text()
    text = text.replace("pub(super) fn ", "pub(crate) fn ")
    text = text.replace("pub(super) const DELIVERY_NOTES_MAX_BYTES", "pub(crate) const DELIVERY_NOTES_MAX_BYTES")
    path.write_text(text)

project = SRC / "workflows/project_workflow.rs"
project_text = project.read_text().replace("pub(super) fn ", "pub(crate) fn ")
project.write_text(project_text)

commands_mod = SRC / "commands/mod.rs"
commands_text = commands_mod.read_text()
if "pub(crate) use workspace_command_support" not in commands_text:
    commands_text += (
        "\npub(crate) use workspace_command_support::{\n"
        "    find_project_summary, resolve_home, validated_project_directory,\n"
        "};\n"
    )
commands_mod.write_text(commands_text)

lib = SRC / "lib.rs"
lib_text = lib.read_text()
root_support = (
    "pub(crate) use commands::{find_project_summary, resolve_home, validated_project_directory};\n"
)
if root_support not in lib_text:
    anchor = "use commands::{\n"
    lib_text = lib_text.replace(anchor, root_support + anchor, 1)
lib.write_text(lib_text)

# lib_tests.rs previously inherited std::fs through `use super::*` from lib.rs.
# The production import disappears in this decomposition, so make the test
# dependency explicit instead of retaining an unused production-level import.
lib_tests = SRC / "lib_tests.rs"
lib_tests_text = lib_tests.read_text()
if "use std::fs;\n" not in lib_tests_text:
    lib_tests_text = "use std::fs;\n" + lib_tests_text
lib_tests.write_text(lib_tests_text)
