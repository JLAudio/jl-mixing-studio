from pathlib import Path
import subprocess

lib_path = Path("src-tauri/src/lib.rs")
mod_path = Path("src-tauri/src/workflows/mod.rs")
intake_path = Path("src-tauri/src/workflows/intake.rs")
source = lib_path.read_text()

old_report = '''#[tauri::command]\nfn get_intake_report(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {\n    let home = match resolve_home(&app) {\n        Ok(home) => home,\n        Err(message) => {\n            return cli::blocked_intake_operation(IntakeOperationCode::Failed, &message)\n        }\n    };\n    let workspace_path = home.join("Music").join("Mixes");\n    let snapshot = workspace::discover_workspace_at(&workspace_path);\n    if !workspace_allows_intake_report_read(snapshot.status) {\n        return cli::blocked_intake_operation(\n            IntakeOperationCode::ProjectUnavailable,\n            "The selected project is not available in the validated workspace",\n        );\n    }\n    let Some(project_directory) = validated_project_directory(\n        &workspace_path,\n        &snapshot,\n        &request.client_id,\n        &request.project_id,\n    ) else {\n        return cli::blocked_intake_operation(\n            IntakeOperationCode::ProjectUnavailable,\n            "The selected project directory could not be resolved safely",\n        );\n    };\n    cli::read_intake_report(&project_directory, request)\n}\n'''
new_report = '''#[tauri::command]\nfn get_intake_report(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {\n    read_intake_report(app, request)\n}\n'''
if old_report not in source:
    raise RuntimeError("intake report command block not found")
source = source.replace(old_report, new_report, 1)

start = source.index("fn run_intake_operation(")
end = source.index("fn find_project_summary<'a>(", start)
run_block = source[start:end]
source = source[:start] + source[end:]

read_status = '''fn workspace_allows_intake_report_read(status: WorkspaceStatus) -> bool {\n    matches!(status, WorkspaceStatus::Healthy | WorkspaceStatus::Partial)\n}\n\n'''
validation_status = '''fn workspace_allows_intake_validation(status: WorkspaceStatus) -> bool {\n    matches!(status, WorkspaceStatus::Healthy)\n}\n\n'''
for helper in (read_status, validation_status):
    if helper not in source:
        raise RuntimeError("intake workspace helper not found")
    source = source.replace(helper, "", 1)

source = source.replace(
    "FolderResult, IntakeOperationCode, IntakeOperationResult, IntakeRequest,",
    "FolderResult, IntakeOperationResult, IntakeRequest,",
    1,
)
source = source.replace(
    "workspace_allows_revision_approval, workspace_allows_revision_creation,\n};",
    "workspace_allows_intake_report_read, workspace_allows_intake_validation,\n    workspace_allows_revision_approval, workspace_allows_revision_creation,\n};",
    1,
)
source = source.replace(
    "use workflows::{run_approval_operation, run_delivery_operation, run_revision_operation};",
    "use workflows::{\n    read_intake_report, run_approval_operation, run_delivery_operation, run_intake_operation,\n    run_revision_operation,\n};",
    1,
)

report_logic = old_report.replace("#[tauri::command]\nfn get_intake_report", "pub(crate) fn read_intake_report")
run_block = run_block.replace("fn run_intake_operation(", "pub(crate) fn run_intake_operation(", 1)
read_status = read_status.replace("fn workspace_allows_intake_report_read(", "pub(crate) fn workspace_allows_intake_report_read(", 1)
validation_status = validation_status.replace("fn workspace_allows_intake_validation(", "pub(crate) fn workspace_allows_intake_validation(", 1)
intake_text = '''//! Intake report access and validation workflow policy.\n//!\n//! Report reads may tolerate a partial workspace because they do not mutate project state;\n//! validation requires a healthy workspace and a validated project directory before Automation\n//! can run. Keeping both paths together makes that trust boundary explicit.\n\nuse crate::cli;\nuse crate::models::{IntakeOperationCode, IntakeOperationResult, IntakeRequest, WorkspaceStatus};\nuse crate::workspace;\n\nuse super::super::{resolve_home, validated_project_directory};\n\n''' + report_logic.replace("fn get_intake_report", "fn read_intake_report") + "\n" + run_block + read_status + validation_status
intake_path.write_text(intake_text)

mod_text = mod_path.read_text()
if "mod intake;\n" not in mod_text:
    mod_text = mod_text.replace("mod delivery;\n", "mod delivery;\nmod intake;\n", 1)
if "pub(super) use intake::" not in mod_text:
    mod_text += '''\npub(super) use intake::{read_intake_report, run_intake_operation};\n#[cfg(test)]\npub(super) use intake::{\n    workspace_allows_intake_report_read, workspace_allows_intake_validation,\n};\n'''
mod_path.write_text(mod_text)
lib_path.write_text(source)
subprocess.run(["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml"], check=True)
print("split intake workflow from lib.rs")
