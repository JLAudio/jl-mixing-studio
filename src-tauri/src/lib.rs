mod automation_api;
mod cli;
mod derived;
mod intake;
mod models;
mod workflows;
mod workspace;

use models::{
    ApprovalOperationResult, ClientCreationRequest, ClientOperationResult, DeliveryCreationRequest,
    DeliveryNotesDocument, DeliveryNotesRequest, DeliveryNotesUpdateRequest,
    DeliveryOperationResult, FolderLocation, FolderRequest, FolderResult, IntakeOperationResult,
    IntakeRequest, ProjectCreationRequest, ProjectOperationCode, ProjectOperationResult,
    ProjectSummary, RevisionApprovalRequest, RevisionCreationRequest, RevisionOperationResult,
    StudioCreationRequest, StudioOperationResult, SystemInfo, VersionCheck, WorkspaceSnapshot,
    WorkspaceStatus,
};
#[cfg(test)]
use models::{
    DeliveryCreationPreview, DeliveryReplacementMode, RevisionApprovalSummary,
    RevisionCreationSummary,
};
use std::path::{Path, PathBuf};
use std::{fs, io::Write};
use tauri::Manager;
#[cfg(test)]
use workflows::{
    list_delivery_entries, verify_delivery_artifacts, verify_delivery_creation,
    verify_revision_approval, verify_revision_creation, workspace_allows_client_creation,
    workspace_allows_delivery_creation, workspace_allows_intake_report_read,
    workspace_allows_intake_validation, workspace_allows_revision_approval,
    workspace_allows_revision_creation,
};
use workflows::{
    read_intake_report, run_approval_operation, run_client_operation, run_delivery_operation,
    run_intake_operation, run_revision_operation, run_studio_operation,
};

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        operating_system: std::env::consts::OS.to_owned(),
        architecture: std::env::consts::ARCH.to_owned(),
    }
}

/// Executes one fixed, allowlisted JL Mixing Automation operation.
/// The frontend cannot choose the executable or supply arguments.
#[tauri::command]
fn get_jl_mixing_version(app: tauri::AppHandle) -> VersionCheck {
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
fn preflight_studio_creation(
    app: tauri::AppHandle,
    request: StudioCreationRequest,
) -> StudioOperationResult {
    run_studio_operation(&app, request, cli::preflight_studio_creation, false)
}

#[tauri::command]
fn create_studio(app: tauri::AppHandle, request: StudioCreationRequest) -> StudioOperationResult {
    run_studio_operation(&app, request, cli::create_studio, true)
}

#[tauri::command]
fn discover_default_workspace(app: tauri::AppHandle) -> Result<WorkspaceSnapshot, String> {
    let home = resolve_home(&app)?;
    Ok(workspace::discover_workspace_at(
        &home.join("Music").join("Mixes"),
    ))
}

#[tauri::command]
fn resolve_folder(app: tauri::AppHandle, request: FolderRequest) -> Result<FolderResult, String> {
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

fn intake_directory(project_directory: &Path) -> PathBuf {
    project_directory
        .join("01_Client_Files")
        .join("Original_Delivery")
}

#[tauri::command]
fn open_folder(app: tauri::AppHandle, request: FolderRequest) -> Result<FolderResult, String> {
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

const DELIVERY_NOTES_MAX_BYTES: usize = 65_536;

#[tauri::command]
fn get_delivery_notes(
    app: tauri::AppHandle,
    request: DeliveryNotesRequest,
) -> Result<DeliveryNotesDocument, String> {
    let path = resolve_delivery_notes_path(&app, &request.client_id, &request.project_id, true)?;
    read_delivery_notes(&path)
}

#[tauri::command]
fn update_delivery_notes(
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

fn read_delivery_notes(path: &std::path::Path) -> Result<DeliveryNotesDocument, String> {
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

fn write_delivery_notes(path: &std::path::Path, content: &str) -> Result<(), String> {
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

#[tauri::command]
fn preflight_client_creation(
    app: tauri::AppHandle,
    request: ClientCreationRequest,
) -> ClientOperationResult {
    run_client_operation(&app, request, cli::preflight_client_creation)
}

#[tauri::command]
fn create_client(app: tauri::AppHandle, request: ClientCreationRequest) -> ClientOperationResult {
    run_client_operation(&app, request, cli::create_client)
}

#[tauri::command]
fn preflight_project_creation(
    app: tauri::AppHandle,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(&app, request, cli::preflight_project_creation)
}

#[tauri::command]
fn create_project(
    app: tauri::AppHandle,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(&app, request, cli::create_project)
}

#[tauri::command]
fn get_intake_report(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {
    read_intake_report(app, request)
}

#[tauri::command]
fn preflight_intake_validation(
    app: tauri::AppHandle,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(&app, request, cli::preflight_intake_validation)
}

#[tauri::command]
fn run_intake_validation(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {
    run_intake_operation(&app, request, cli::run_intake_validation)
}

#[tauri::command]
fn preflight_revision_creation(
    app: tauri::AppHandle,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(&app, request, cli::preflight_revision_creation, false)
}

#[tauri::command]
fn create_revision(
    app: tauri::AppHandle,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(&app, request, cli::create_revision, true)
}

#[tauri::command]
fn preflight_revision_approval(
    app: tauri::AppHandle,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(&app, request, cli::preflight_revision_approval, false)
}

#[tauri::command]
fn approve_revision(
    app: tauri::AppHandle,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(&app, request, cli::approve_revision, true)
}

#[tauri::command]
fn preflight_delivery_creation(
    app: tauri::AppHandle,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(&app, request, cli::preflight_delivery_creation, false)
}

#[tauri::command]
fn create_delivery(
    app: tauri::AppHandle,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(&app, request, cli::create_delivery, true)
}

fn resolve_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map_err(|_| "The current user's home directory could not be resolved".to_owned())
}

fn run_project_operation(
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

    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_project_operation(ProjectOperationCode::Failed, &message)
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

fn workspace_allows_project_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}

fn find_project_summary<'a>(
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

fn validated_project_directory(
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_jl_mixing_version,
            discover_default_workspace,
            resolve_folder,
            open_folder,
            get_delivery_notes,
            update_delivery_notes,
            preflight_studio_creation,
            create_studio,
            preflight_client_creation,
            create_client,
            preflight_project_creation,
            create_project,
            get_intake_report,
            preflight_intake_validation,
            run_intake_validation,
            preflight_revision_creation,
            create_revision,
            preflight_revision_approval,
            approve_revision,
            preflight_delivery_creation,
            create_delivery,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
