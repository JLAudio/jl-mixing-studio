from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "src-tauri/src/lib.rs"
WORKFLOWS = ROOT / "src-tauri/src/workflows/mod.rs"
COMMANDS_DIR = ROOT / "src-tauri/src/commands"
PROJECT_WORKFLOW = ROOT / "src-tauri/src/workflows/project_workflow.rs"


def remove_between(text: str, start: str, end: str) -> str:
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[:start_index] + text[end_index:]


lib = LIB.read_text()

if "mod commands;" not in lib:
    lib = lib.replace("mod cli;\n", "mod cli;\nmod commands;\n", 1)

production_models_start = lib.index("use models::{")
production_models_end = lib.index("};\n#[cfg(test)]", production_models_start) + 3
lib = (
    lib[:production_models_start]
    + "use models::{\n"
    + "    ApprovalOperationResult, ClientCreationRequest, ClientOperationResult, DeliveryCreationRequest,\n"
    + "    DeliveryOperationResult, IntakeOperationResult, IntakeRequest, ProjectCreationRequest,\n"
    + "    ProjectOperationResult, RevisionApprovalRequest, RevisionCreationRequest, RevisionOperationResult,\n"
    + "    StudioCreationRequest, StudioOperationResult,\n"
    + "};\n"
    + lib[production_models_end:]
)

cfg_models_start = lib.index("#[cfg(test)]\nuse models::{")
cfg_models_end = lib.index("};", cfg_models_start) + 2
lib = (
    lib[:cfg_models_start]
    + "#[cfg(test)]\nuse models::{\n"
    + "    DeliveryCreationPreview, DeliveryReplacementMode, ProjectSummary, RevisionApprovalSummary,\n"
    + "    RevisionCreationSummary, WorkspaceStatus,\n"
    + "};"
    + lib[cfg_models_end:]
)

for line in [
    "use std::path::{Path, PathBuf};\n",
    "use std::{fs, io::Write};\n",
    "use tauri::Manager;\n",
]:
    lib = lib.replace(line, "")

commands_import = (
    "use commands::{\n"
    "    discover_default_workspace, get_delivery_notes, get_jl_mixing_version, get_system_info,\n"
    "    open_folder, resolve_folder, update_delivery_notes,\n"
    "};\n"
    "#[cfg(test)]\n"
    "use commands::{\n"
    "    intake_directory, read_delivery_notes, write_delivery_notes, DELIVERY_NOTES_MAX_BYTES,\n"
    "};\n"
)
if "use commands::{" not in lib:
    insert_at = lib.index("#[cfg(test)]\nuse workflows::{")
    lib = lib[:insert_at] + commands_import + lib[insert_at:]

lib = lib.replace(
    "    workspace_allows_intake_validation, workspace_allows_revision_approval,\n"
    "    workspace_allows_revision_creation,\n",
    "    workspace_allows_intake_validation, workspace_allows_project_creation,\n"
    "    workspace_allows_revision_approval, workspace_allows_revision_creation,\n",
)
lib = lib.replace(
    "    read_intake_report, run_approval_operation, run_client_operation, run_delivery_operation,\n"
    "    run_intake_operation, run_revision_operation, run_studio_operation,\n",
    "    read_intake_report, run_approval_operation, run_client_operation, run_delivery_operation,\n"
    "    run_intake_operation, run_project_operation, run_revision_operation, run_studio_operation,\n",
)

lib = remove_between(
    lib,
    "#[tauri::command]\nfn get_system_info()",
    "#[tauri::command]\nfn preflight_studio_creation",
)
lib = remove_between(
    lib,
    "#[tauri::command]\nfn discover_default_workspace",
    "const DELIVERY_NOTES_MAX_BYTES",
)
lib = remove_between(
    lib,
    "const DELIVERY_NOTES_MAX_BYTES",
    "#[tauri::command]\nfn preflight_client_creation",
)
lib = remove_between(
    lib,
    "fn resolve_home(app: &tauri::AppHandle)",
    "#[cfg_attr(mobile, tauri::mobile_entry_point)]",
)
LIB.write_text(lib)

workflow_mod = WORKFLOWS.read_text()
if '#[path = "project_workflow.rs"]\nmod project;' not in workflow_mod:
    anchor = '#[path = "revision_workflow.rs"]\nmod revision;\n'
    workflow_mod = workflow_mod.replace(anchor, anchor + '#[path = "project_workflow.rs"]\nmod project;\n', 1)
    workflow_mod += (
        "\npub(super) use project::run_project_operation;\n"
        "#[cfg(test)]\n"
        "pub(super) use project::workspace_allows_project_creation;\n"
    )
WORKFLOWS.write_text(workflow_mod)

COMMANDS_DIR.mkdir(parents=True, exist_ok=True)

(COMMANDS_DIR / "mod.rs").write_text(r'''#[path = "delivery_notes_command.rs"]
mod delivery_notes;
#[path = "folder_command.rs"]
mod folders;
#[path = "system_command.rs"]
mod system;
mod workspace_command_support;

pub(super) use delivery_notes::{get_delivery_notes, update_delivery_notes};
pub(super) use folders::{open_folder, resolve_folder};
pub(super) use system::{discover_default_workspace, get_jl_mixing_version, get_system_info};

#[cfg(test)]
pub(super) use delivery_notes::{read_delivery_notes, write_delivery_notes, DELIVERY_NOTES_MAX_BYTES};
#[cfg(test)]
pub(super) use folders::intake_directory;
''')

(COMMANDS_DIR / "workspace_command_support.rs").write_text(r'''use crate::models::{ProjectSummary, WorkspaceSnapshot};
use crate::workspace;
use std::path::PathBuf;
use tauri::Manager;

pub(super) fn resolve_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map_err(|_| "The current user's home directory could not be resolved".to_owned())
}

pub(super) fn find_project_summary<'a>(
    snapshot: &'a WorkspaceSnapshot,
    client_id: &str,
    project_id: &str,
) -> Option<&'a ProjectSummary> {
    snapshot
        .clients
        .iter()
        .find(|client| client.client_id == client_id)?
        .projects
        .iter()
        .find(|project| project.project_id == project_id)
}

/// Resolves a project only after its stable IDs are confirmed in the current
/// validated workspace snapshot. This prevents stale UI paths from becoming
/// filesystem authority.
pub(super) fn validated_project_directory(
    workspace_path: &std::path::Path,
    snapshot: &WorkspaceSnapshot,
    client_id: &str,
    project_id: &str,
) -> Option<PathBuf> {
    let client_id = client_id.trim();
    let project_id = project_id.trim();
    let exists = snapshot.clients.iter().any(|client| {
        client.client_id == client_id
            && client
                .projects
                .iter()
                .any(|project| project.project_id == project_id)
    });
    exists.then(|| workspace::find_validated_project_path(workspace_path, client_id, project_id))?
}
''')

(COMMANDS_DIR / "system_command.rs").write_text(r'''use super::workspace_command_support::resolve_home;
use crate::cli;
use crate::models::{SystemInfo, VersionCheck, WorkspaceSnapshot};
use crate::workspace;

#[tauri::command]
pub(super) fn get_system_info() -> SystemInfo {
    SystemInfo {
        operating_system: std::env::consts::OS.to_owned(),
        architecture: std::env::consts::ARCH.to_owned(),
    }
}

/// Executes one fixed, allowlisted JL Mixing Automation operation.
/// The frontend cannot choose the executable or supply arguments.
#[tauri::command]
pub(super) fn get_jl_mixing_version(app: tauri::AppHandle) -> VersionCheck {
    match resolve_home(&app) {
        Ok(home) => cli::check_jl_mixing_version(&home),
        Err(message) => VersionCheck {
            available: false,
            supported: false,
            studio_creation_supported: false,
            client_creation_supported: false,
            project_creation_supported: false,
            intake_validation_supported: false,
            revision_creation_supported: false,
            revision_approval_supported: false,
            delivery_creation_supported: false,
            version: None,
            message,
        },
    }
}

#[tauri::command]
pub(super) fn discover_default_workspace(
    app: tauri::AppHandle,
) -> Result<WorkspaceSnapshot, String> {
    let home = resolve_home(&app)?;
    Ok(workspace::discover_workspace_at(
        &home.join("Music").join("Mixes"),
    ))
}
''')

(COMMANDS_DIR / "folder_command.rs").write_text(r'''use super::workspace_command_support::{resolve_home, validated_project_directory};
use crate::models::{FolderLocation, FolderRequest, FolderResult, WorkspaceStatus};
use crate::workspace;
use std::path::{Path, PathBuf};

#[tauri::command]
pub(super) fn resolve_folder(
    app: tauri::AppHandle,
    request: FolderRequest,
) -> Result<FolderResult, String> {
    let home = resolve_home(&app)?;
    let root = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&root);
    if !matches!(
        snapshot.status,
        WorkspaceStatus::Healthy | WorkspaceStatus::Empty | WorkspaceStatus::Partial
    ) {
        return Err("Resolve workspace issues before opening folders".into());
    }
    let project_path = || {
        let client_id = request.client_id.as_deref()?;
        let project_id = request.project_id.as_deref()?;
        validated_project_directory(&root, &snapshot, client_id, project_id)
    };
    let path = match request.location {
        FolderLocation::Workspace => root.clone(),
        FolderLocation::Studio => root.join("Studio"),
        FolderLocation::Client => workspace::find_validated_client_path(
            &root,
            request.client_id.as_deref().unwrap_or_default(),
        )
        .ok_or("The client folder could not be resolved safely")?,
        FolderLocation::Project => {
            project_path().ok_or("The project folder could not be resolved safely")?
        }
        FolderLocation::Intake => intake_directory(
            &project_path().ok_or("The project folder could not be resolved safely")?,
        ),
        FolderLocation::Revisions => project_path()
            .ok_or("The project folder could not be resolved safely")?
            .join("04_Revisions"),
        FolderLocation::Delivery => project_path()
            .ok_or("The project folder could not be resolved safely")?
            .join("05_Final_Delivery"),
    };
    let canonical = path
        .canonicalize()
        .map_err(|_| "The requested folder is unavailable")?;
    let canonical_root = root
        .canonicalize()
        .map_err(|_| "The workspace folder is unavailable")?;
    if !canonical.is_dir() || !canonical.starts_with(&canonical_root) {
        return Err("The requested folder could not be resolved safely".into());
    }
    Ok(FolderResult {
        path: canonical.to_string_lossy().into_owned(),
    })
}

pub(super) fn intake_directory(project_directory: &Path) -> PathBuf {
    project_directory
        .join("01_Client_Files")
        .join("Original_Delivery")
}

#[tauri::command]
pub(super) fn open_folder(
    app: tauri::AppHandle,
    request: FolderRequest,
) -> Result<FolderResult, String> {
    let result = resolve_folder(app, request)?;
    let mut command = if cfg!(target_os = "macos") {
        std::process::Command::new("open")
    } else if cfg!(target_os = "windows") {
        std::process::Command::new("explorer.exe")
    } else {
        std::process::Command::new("xdg-open")
    };
    let status = command
        .arg(&result.path)
        .status()
        .map_err(|_| "The operating-system folder window could not be opened")?;
    if !status.success() {
        return Err("The operating-system folder window could not be opened".into());
    }
    Ok(result)
}
''')

(COMMANDS_DIR / "delivery_notes_command.rs").write_text(r'''use super::workspace_command_support::{
    find_project_summary, resolve_home, validated_project_directory,
};
use crate::models::{
    DeliveryNotesDocument, DeliveryNotesRequest, DeliveryNotesUpdateRequest, WorkspaceStatus,
};
use crate::workspace;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

pub(super) const DELIVERY_NOTES_MAX_BYTES: usize = 65_536;

#[tauri::command]
pub(super) fn get_delivery_notes(
    app: tauri::AppHandle,
    request: DeliveryNotesRequest,
) -> Result<DeliveryNotesDocument, String> {
    let path = resolve_delivery_notes_path(&app, &request.client_id, &request.project_id, true)?;
    read_delivery_notes(&path)
}

#[tauri::command]
pub(super) fn update_delivery_notes(
    app: tauri::AppHandle,
    request: DeliveryNotesUpdateRequest,
) -> Result<DeliveryNotesDocument, String> {
    if request.content.len() > DELIVERY_NOTES_MAX_BYTES {
        return Err(format!(
            "Delivery Notes must not exceed {DELIVERY_NOTES_MAX_BYTES} bytes"
        ));
    }
    let path = resolve_delivery_notes_path(&app, &request.client_id, &request.project_id, false)?;
    write_delivery_notes(&path, &request.content)?;
    let saved = read_delivery_notes(&path)?;
    if saved.content != request.content {
        return Err("Delivery Notes were written but could not be verified exactly".into());
    }
    Ok(saved)
}

fn resolve_delivery_notes_path(
    app: &tauri::AppHandle,
    client_id: &str,
    project_id: &str,
    allow_partial: bool,
) -> Result<PathBuf, String> {
    let home = resolve_home(app)?;
    let root = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&root);
    if snapshot.status != WorkspaceStatus::Healthy
        && !(allow_partial && snapshot.status == WorkspaceStatus::Partial)
    {
        return Err("Resolve workspace issues before editing Delivery Notes".into());
    }
    let project = find_project_summary(&snapshot, client_id.trim(), project_id.trim())
        .ok_or("The selected project is no longer available in the validated workspace")?;
    if project.delivery.is_none() || project.delivered_revision.is_none() {
        return Err("Create a validated delivery package before editing Delivery Notes".into());
    }
    let project_path =
        validated_project_directory(&root, &snapshot, client_id.trim(), project_id.trim())
            .ok_or("The selected project directory could not be resolved safely")?;
    let canonical_root = root
        .canonicalize()
        .map_err(|_| "The workspace folder is unavailable")?;
    let delivery_path = project_path.join("05_Final_Delivery");
    let canonical_delivery = delivery_path
        .canonicalize()
        .map_err(|_| "The delivery folder is unavailable")?;
    if !canonical_delivery.is_dir() || !canonical_delivery.starts_with(&canonical_root) {
        return Err("The delivery folder could not be resolved safely".into());
    }
    let notes_path = canonical_delivery.join("Delivery_Notes.md");
    let metadata = fs::symlink_metadata(&notes_path)
        .map_err(|_| "Delivery_Notes.md is missing from the validated package")?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Delivery_Notes.md could not be resolved safely".into());
    }
    let canonical_notes = notes_path
        .canonicalize()
        .map_err(|_| "Delivery_Notes.md could not be resolved safely")?;
    if !canonical_notes.starts_with(&canonical_delivery) {
        return Err("Delivery_Notes.md could not be resolved safely".into());
    }
    Ok(canonical_notes)
}

pub(super) fn read_delivery_notes(path: &std::path::Path) -> Result<DeliveryNotesDocument, String> {
    let metadata = fs::metadata(path).map_err(|_| "Delivery Notes could not be read")?;
    if metadata.len() > DELIVERY_NOTES_MAX_BYTES as u64 {
        return Err(format!(
            "Delivery Notes exceed the {DELIVERY_NOTES_MAX_BYTES}-byte editor limit"
        ));
    }
    let content = fs::read_to_string(path)
        .map_err(|_| "Delivery Notes must be a readable UTF-8 Markdown file")?;
    Ok(DeliveryNotesDocument {
        content,
        max_bytes: DELIVERY_NOTES_MAX_BYTES,
    })
}

pub(super) fn write_delivery_notes(path: &std::path::Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Delivery Notes do not have a valid parent folder")?;
    let temporary = parent.join(format!(
        ".Delivery_Notes.md.jl-mixing-studio-{}.tmp",
        std::process::id()
    ));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "A Delivery Notes save is already pending or could not be started")?;
    if let Err(error) = file
        .write_all(content.as_bytes())
        .and_then(|_| file.sync_all())
    {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Delivery Notes could not be saved: {error}"));
    }
    drop(file);
    replace_delivery_notes_file(&temporary, path)
}

#[cfg(not(target_os = "windows"))]
fn replace_delivery_notes_file(
    temporary: &std::path::Path,
    path: &std::path::Path,
) -> Result<(), String> {
    fs::rename(temporary, path).map_err(|error| {
        let _ = fs::remove_file(temporary);
        format!("Delivery Notes could not be replaced safely: {error}")
    })
}

#[cfg(target_os = "windows")]
fn replace_delivery_notes_file(
    temporary: &std::path::Path,
    path: &std::path::Path,
) -> Result<(), String> {
    let backup = path.with_file_name(".Delivery_Notes.md.jl-mixing-studio.backup");
    if backup.exists() {
        let _ = fs::remove_file(temporary);
        return Err("A prior Delivery Notes backup requires manual review".into());
    }
    fs::rename(path, &backup).map_err(|error| {
        let _ = fs::remove_file(temporary);
        format!("Delivery Notes could not be prepared for replacement: {error}")
    })?;
    if let Err(error) = fs::rename(temporary, path) {
        let _ = fs::rename(&backup, path);
        let _ = fs::remove_file(temporary);
        return Err(format!(
            "Delivery Notes could not be replaced safely: {error}"
        ));
    }
    fs::remove_file(&backup).map_err(|error| {
        format!("Delivery Notes were saved, but the backup could not be removed: {error}")
    })
}
''')

PROJECT_WORKFLOW.write_text(r'''use crate::cli;
use crate::models::{
    ProjectCreationRequest, ProjectOperationCode, ProjectOperationResult, WorkspaceStatus,
};
use crate::workspace;
use tauri::Manager;

/// Project creation requires a healthy workspace and a client directory that
/// is re-resolved from the current validated snapshot. UI-selected identity is
/// never trusted as a filesystem path.
pub(super) fn run_project_operation(
    app: &tauri::AppHandle,
    request: ProjectCreationRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        ProjectCreationRequest,
    ) -> ProjectOperationResult,
) -> ProjectOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_project_operation(
            ProjectOperationCode::UnsupportedPlatform,
            "Project creation requires JL Mixing Automation on macOS or Linux",
        );
    }

    let home = match app.path().home_dir() {
        Ok(home) => home,
        Err(_) => {
            return cli::blocked_project_operation(
                ProjectOperationCode::Failed,
                "The current user's home directory could not be resolved",
            )
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_project_creation(snapshot.status) {
        return cli::blocked_project_operation(
            ProjectOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before creating a project",
        );
    }

    let client_id = request.client_id.trim();
    if !snapshot
        .clients
        .iter()
        .any(|client| client.client_id == client_id)
    {
        return cli::blocked_project_operation(
            ProjectOperationCode::ClientUnavailable,
            "The selected client is no longer available in the validated workspace",
        );
    }
    let Some(client_directory) = workspace::find_validated_client_path(&workspace_path, client_id)
    else {
        return cli::blocked_project_operation(
            ProjectOperationCode::ClientUnavailable,
            "The selected client directory could not be resolved safely",
        );
    };

    operation(&home, &client_directory, request)
}

pub(super) fn workspace_allows_project_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}
''')
