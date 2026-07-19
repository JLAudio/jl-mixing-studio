mod cli;
mod derived;
mod intake;
mod models;
mod workspace;

use models::{
    ApprovalOperationCode, ApprovalOperationResult, ClientCreationRequest, ClientOperationCode,
    ClientOperationResult, DeliveryCreationPreview, DeliveryCreationRequest, DeliveryNotesDocument,
    DeliveryNotesRequest, DeliveryNotesUpdateRequest, DeliveryOperationCode,
    DeliveryOperationResult, DeliveryReplacementMode, FolderLocation, FolderRequest, FolderResult,
    IntakeOperationCode, IntakeOperationResult, IntakeRequest, ProjectCreationRequest,
    ProjectOperationCode, ProjectOperationResult, ProjectSummary, RevisionApprovalRequest,
    RevisionApprovalSummary, RevisionCreationRequest, RevisionCreationSummary,
    RevisionOperationCode, RevisionOperationResult, StudioCreationRequest, StudioOperationCode,
    StudioOperationResult, SystemInfo, VersionCheck, WorkspaceSnapshot, WorkspaceStatus,
};
use std::path::PathBuf;
use std::{fs, io::Write};
use tauri::Manager;

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
        FolderLocation::Intake => project_path()
            .ok_or("The project folder could not be resolved safely")?
            .join("01_Intake"),
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
    let home = match resolve_home(&app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_intake_operation(IntakeOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_intake_report_read(snapshot.status) {
        return cli::blocked_intake_operation(
            IntakeOperationCode::ProjectUnavailable,
            "The selected project is not available in the validated workspace",
        );
    }
    let Some(project_directory) = validated_project_directory(
        &workspace_path,
        &snapshot,
        &request.client_id,
        &request.project_id,
    ) else {
        return cli::blocked_intake_operation(
            IntakeOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };
    cli::read_intake_report(&project_directory, request)
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

fn run_studio_operation(
    app: &tauri::AppHandle,
    request: StudioCreationRequest,
    operation: fn(&std::path::Path, StudioCreationRequest) -> StudioOperationResult,
    verify_after_creation: bool,
) -> StudioOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_studio_operation(
            StudioOperationCode::UnsupportedPlatform,
            "Studio creation requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_studio_operation(StudioOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let before = workspace::discover_workspace_at(&workspace_path);
    if before.status != WorkspaceStatus::Unavailable {
        return cli::blocked_studio_operation(
            StudioOperationCode::WorkspaceBlocked,
            "Studio setup is available only when the default workspace does not exist",
        );
    }
    let expected = request.clone();
    let result = operation(&home, request);
    if !verify_after_creation || !result.ok || result.code != StudioOperationCode::Created {
        return result;
    }
    let after = workspace::discover_workspace_at(&workspace_path);
    let Some(studio) = after.studio else {
        return uncertain_studio_result();
    };
    let engineer = expected.mix_engineer.unwrap_or_default().trim().to_owned();
    if after.status != WorkspaceStatus::Empty
        || studio.studio_name != expected.studio_name.trim()
        || studio.mix_engineer != engineer
        || studio.sample_rate != expected.sample_rate
        || studio.bit_depth != expected.bit_depth
        || studio.file_format != expected.file_format.trim().to_ascii_uppercase()
        || studio.change_directory_after_create
    {
        return uncertain_studio_result();
    }
    result
}

fn uncertain_studio_result() -> StudioOperationResult {
    cli::blocked_studio_operation(
        StudioOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the created studio could not be reconciled. The operation may have completed; do not retry automatically.",
    )
}

fn run_client_operation(
    app: &tauri::AppHandle,
    request: ClientCreationRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        ClientCreationRequest,
    ) -> ClientOperationResult,
) -> ClientOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_client_operation(
            ClientOperationCode::UnsupportedPlatform,
            "Client creation requires JL Mixing Automation on macOS or Linux",
        );
    }

    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_client_operation(ClientOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_client_creation(snapshot.status) {
        return cli::blocked_client_operation(
            ClientOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before creating a client",
        );
    }

    operation(&home, &workspace_path, request)
}

fn workspace_allows_client_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy | WorkspaceStatus::Empty)
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

fn run_intake_operation(
    app: &tauri::AppHandle,
    request: IntakeRequest,
    operation: fn(&std::path::Path, &std::path::Path, IntakeRequest) -> IntakeOperationResult,
) -> IntakeOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_intake_operation(
            IntakeOperationCode::UnsupportedPlatform,
            "Intake validation requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_intake_operation(IntakeOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_intake_validation(snapshot.status) {
        return cli::blocked_intake_operation(
            IntakeOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before running intake validation",
        );
    }
    let Some(project_directory) = validated_project_directory(
        &workspace_path,
        &snapshot,
        &request.client_id,
        &request.project_id,
    ) else {
        return cli::blocked_intake_operation(
            IntakeOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };
    operation(&home, &project_directory, request)
}

fn run_revision_operation(
    app: &tauri::AppHandle,
    request: RevisionCreationRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        RevisionCreationRequest,
    ) -> RevisionOperationResult,
    verify_after_creation: bool,
) -> RevisionOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_revision_operation(
            RevisionOperationCode::UnsupportedPlatform,
            "Revision creation requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_revision_operation(RevisionOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_revision_creation(snapshot.status) {
        return cli::blocked_revision_operation(
            RevisionOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before creating a revision",
        );
    }
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let Some(before) = find_project_summary(&snapshot, &client_id, &project_id).cloned() else {
        return cli::blocked_revision_operation(
            RevisionOperationCode::ProjectUnavailable,
            "The selected project is no longer available in the validated workspace",
        );
    };
    let Some(project_directory) =
        validated_project_directory(&workspace_path, &snapshot, &client_id, &project_id)
    else {
        return cli::blocked_revision_operation(
            RevisionOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };

    let result = operation(&home, &project_directory, request);
    if result.ok {
        let Some(preview) = result.revision.as_ref() else {
            return if verify_after_creation {
                uncertain_revision_result()
            } else {
                cli::blocked_revision_operation(
                    RevisionOperationCode::Failed,
                    "The revision preview did not include a verifiable revision identity",
                )
            };
        };
        if preview.client_id != client_id
            || preview.project_id != project_id
            || before.current_revision.checked_add(1) != Some(preview.number)
        {
            return if verify_after_creation {
                uncertain_revision_result()
            } else {
                cli::blocked_revision_operation(
                    RevisionOperationCode::Failed,
                    "The revision preview did not match the authoritative project state",
                )
            };
        }
    }
    if !verify_after_creation || !result.ok || result.code != RevisionOperationCode::Created {
        return result;
    }
    let Some(expected) = result.revision.as_ref() else {
        return uncertain_revision_result();
    };
    if expected.client_id != client_id || expected.project_id != project_id {
        return uncertain_revision_result();
    }
    let refreshed = workspace::discover_workspace_at(&workspace_path);
    let Some(after) = find_project_summary(&refreshed, &client_id, &project_id) else {
        return uncertain_revision_result();
    };
    if !verify_revision_creation(&before, after, expected) {
        return uncertain_revision_result();
    }
    result
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

fn verify_revision_creation(
    before: &ProjectSummary,
    after: &ProjectSummary,
    expected: &RevisionCreationSummary,
) -> bool {
    let Some(next_number) = before.current_revision.checked_add(1) else {
        return false;
    };
    if expected.number != next_number
        || after.project_id != before.project_id
        || after.project_name != before.project_name
        || after.artist != before.artist
        || after.schema_version != before.schema_version
        || after.created_with != before.created_with
        || after.created_at != before.created_at
        || after.deadline != before.deadline
        || after.sample_rate != before.sample_rate
        || after.bit_depth != before.bit_depth
        || after.file_format != before.file_format
        || after.delivery_method != before.delivery_method
        || after.current_revision != next_number
        || after.approved_revision != before.approved_revision
        || after.delivered_revision != before.delivered_revision
        || after.revisions.len() != before.revisions.len() + 1
    {
        return false;
    }
    if !before.revisions.iter().all(|revision| {
        after
            .revisions
            .iter()
            .find(|candidate| candidate.number == revision.number)
            == Some(revision)
    }) {
        return false;
    }
    let Some(created) = after
        .revisions
        .iter()
        .find(|revision| revision.number == next_number)
    else {
        return false;
    };
    created.description == expected.description
        && created.approved_at.is_none()
        && created.approved_by.is_none()
        && !before
            .revisions
            .iter()
            .any(|revision| revision.revision_id == created.revision_id)
}

fn uncertain_revision_result() -> RevisionOperationResult {
    cli::blocked_revision_operation(
        RevisionOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the authoritative revision history could not be reconciled. The operation may have completed; do not retry automatically.",
    )
}

fn run_approval_operation(
    app: &tauri::AppHandle,
    request: RevisionApprovalRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        RevisionApprovalRequest,
    ) -> ApprovalOperationResult,
    verify_after_approval: bool,
) -> ApprovalOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::UnsupportedPlatform,
            "Revision approval requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_approval_operation(ApprovalOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_revision_approval(snapshot.status) {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before approving a revision",
        );
    }
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let revision_number = request.revision;
    let approved_by = request.approved_by.trim().to_owned();
    let Some(before) = find_project_summary(&snapshot, &client_id, &project_id).cloned() else {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::ProjectUnavailable,
            "The selected project is no longer available in the validated workspace",
        );
    };
    if !before
        .revisions
        .iter()
        .any(|revision| revision.number == revision_number)
    {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::RevisionUnavailable,
            "The selected revision is no longer available in the validated project",
        );
    }
    if before.approved_revision == Some(revision_number) {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::AlreadyApproved,
            "The selected revision is already the approved revision",
        );
    }
    let Some(project_directory) =
        validated_project_directory(&workspace_path, &snapshot, &client_id, &project_id)
    else {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };

    let result = operation(&home, &project_directory, request);
    if result.ok {
        let Some(approval) = result.approval.as_ref() else {
            return if verify_after_approval {
                uncertain_approval_result()
            } else {
                cli::blocked_approval_operation(
                    ApprovalOperationCode::Failed,
                    "The approval preview did not include a verifiable revision identity",
                )
            };
        };
        if approval.client_id != client_id
            || approval.project_id != project_id
            || approval.revision != revision_number
            || approval.approved_by != approved_by
            || !before
                .revisions
                .iter()
                .any(|revision| revision.number == approval.revision)
        {
            return if verify_after_approval {
                uncertain_approval_result()
            } else {
                cli::blocked_approval_operation(
                    ApprovalOperationCode::Failed,
                    "The approval preview did not match the authoritative project state",
                )
            };
        }
    }
    if !verify_after_approval || !result.ok || result.code != ApprovalOperationCode::Approved {
        return result;
    }
    let Some(expected) = result.approval.as_ref() else {
        return uncertain_approval_result();
    };
    if expected.client_id != client_id || expected.project_id != project_id {
        return uncertain_approval_result();
    }
    let refreshed = workspace::discover_workspace_at(&workspace_path);
    let Some(after) = find_project_summary(&refreshed, &client_id, &project_id) else {
        return uncertain_approval_result();
    };
    if !verify_revision_approval(&before, after, expected) {
        return uncertain_approval_result();
    }
    result
}

fn verify_revision_approval(
    before: &ProjectSummary,
    after: &ProjectSummary,
    expected: &RevisionApprovalSummary,
) -> bool {
    if expected.approved_at.as_deref().is_none_or(str::is_empty)
        || after.project_id != before.project_id
        || after.project_name != before.project_name
        || after.artist != before.artist
        || after.schema_version != before.schema_version
        || after.created_with != before.created_with
        || after.created_at != before.created_at
        || after.deadline != before.deadline
        || after.sample_rate != before.sample_rate
        || after.bit_depth != before.bit_depth
        || after.file_format != before.file_format
        || after.delivery_method != before.delivery_method
        || after.current_revision != before.current_revision
        || after.delivered_revision != before.delivered_revision
        || after.approved_revision != Some(expected.revision)
        || after.revisions.len() != before.revisions.len()
    {
        return false;
    }
    if !before.revisions.iter().all(|revision| {
        if revision.number == expected.revision {
            return true;
        }
        after
            .revisions
            .iter()
            .find(|candidate| candidate.number == revision.number)
            == Some(revision)
    }) {
        return false;
    }
    let Some(previous) = before
        .revisions
        .iter()
        .find(|revision| revision.number == expected.revision)
    else {
        return false;
    };
    let Some(approved) = after
        .revisions
        .iter()
        .find(|revision| revision.number == expected.revision)
    else {
        return false;
    };
    approved.number == previous.number
        && approved.revision_id == previous.revision_id
        && approved.created_at == previous.created_at
        && approved.description == previous.description
        && approved.approved_by == Some(expected.approved_by.clone())
        && approved.approved_at == expected.approved_at
}

fn uncertain_approval_result() -> ApprovalOperationResult {
    cli::blocked_approval_operation(
        ApprovalOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the authoritative approval state could not be reconciled. The operation may have completed; do not retry automatically.",
    )
}

fn run_delivery_operation(
    app: &tauri::AppHandle,
    request: DeliveryCreationRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        DeliveryCreationRequest,
    ) -> DeliveryOperationResult,
    verify_after_creation: bool,
) -> DeliveryOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::UnsupportedPlatform,
            "Delivery creation requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_delivery_operation(DeliveryOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_delivery_creation(snapshot.status) {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before creating a delivery",
        );
    }
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let Some(before) = find_project_summary(&snapshot, &client_id, &project_id).cloned() else {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::ProjectUnavailable,
            "The selected project is no longer available in the validated workspace",
        );
    };
    let Some(approved_revision) = before.approved_revision else {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::ApprovalRequired,
            "Approve a revision before creating a delivery",
        );
    };
    match request.replacement_mode {
        DeliveryReplacementMode::Default
            if before.delivered_revision.is_some() || before.delivery.is_some() =>
        {
            return cli::blocked_delivery_operation(
                DeliveryOperationCode::AlreadyDelivered,
                "This project already has a delivery package; select the overwrite workflow",
            );
        }
        DeliveryReplacementMode::Overwrite
            if before.delivered_revision.is_none() || before.delivery.is_none() =>
        {
            return cli::blocked_delivery_operation(
                DeliveryOperationCode::ProjectUnavailable,
                "Overwrite requires a validated existing delivery package",
            );
        }
        _ => {}
    }
    let Some(project_directory) =
        validated_project_directory(&workspace_path, &snapshot, &client_id, &project_id)
    else {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };

    let replacement_mode = request.replacement_mode;
    let create_zip = request.create_zip;
    let prior_notes = matches!(replacement_mode, DeliveryReplacementMode::Overwrite)
        .then(|| fs::read(project_directory.join("05_Final_Delivery/Delivery_Notes.md")).ok())
        .flatten();
    let result = operation(&home, &project_directory, request);
    if result.ok {
        let Some(preview) = result.delivery.as_ref() else {
            return if verify_after_creation {
                uncertain_delivery_result()
            } else {
                cli::blocked_delivery_operation(
                    DeliveryOperationCode::Failed,
                    "The delivery preview did not include a verifiable package plan",
                )
            };
        };
        let expected_delivered = if verify_after_creation {
            Some(approved_revision)
        } else {
            before.delivered_revision
        };
        if preview.client_id != client_id
            || preview.project_id != project_id
            || preview.project_name != before.project_name
            || preview.current_revision != before.current_revision
            || preview.approved_revision != approved_revision
            || preview.delivered_revision != expected_delivered
            || preview.delivery_method != before.delivery_method
            || preview.replacement_mode != replacement_mode
            || preview.create_zip != create_zip
        {
            return if verify_after_creation {
                uncertain_delivery_result()
            } else {
                cli::blocked_delivery_operation(
                    DeliveryOperationCode::Failed,
                    "The delivery preview did not match the authoritative project state",
                )
            };
        }
    }
    if !verify_after_creation || !result.ok || result.code != DeliveryOperationCode::Created {
        return result;
    }
    let Some(expected) = result.delivery.as_ref() else {
        return uncertain_delivery_result();
    };
    let refreshed = workspace::discover_workspace_at(&workspace_path);
    let Some(after) = find_project_summary(&refreshed, &client_id, &project_id) else {
        return uncertain_delivery_result();
    };
    if !verify_delivery_creation(&before, after, expected)
        || !verify_delivery_artifacts(
            &project_directory,
            &project_id,
            create_zip,
            prior_notes.as_deref(),
        )
    {
        return uncertain_delivery_result();
    }
    result
}

fn verify_delivery_artifacts(
    project_directory: &std::path::Path,
    project_id: &str,
    create_zip: bool,
    prior_notes: Option<&[u8]>,
) -> bool {
    let delivery = project_directory.join("05_Final_Delivery");
    let notes = delivery.join("Delivery_Notes.md");
    let Ok(notes_metadata) = fs::symlink_metadata(&notes) else {
        return false;
    };
    if !notes_metadata.is_file() || notes_metadata.file_type().is_symlink() {
        return false;
    }
    if prior_notes.is_some_and(|expected| fs::read(&notes).ok().as_deref() != Some(expected)) {
        return false;
    }
    if create_zip {
        let zip = delivery.join(format!("{project_id}-delivery.zip"));
        let Ok(zip_metadata) = fs::symlink_metadata(zip) else {
            return false;
        };
        if !zip_metadata.is_file() || zip_metadata.file_type().is_symlink() {
            return false;
        }
    }
    true
}

fn verify_delivery_creation(
    before: &ProjectSummary,
    after: &ProjectSummary,
    expected: &DeliveryCreationPreview,
) -> bool {
    let Some(approved_revision) = before.approved_revision else {
        return false;
    };
    if after.project_id != before.project_id
        || after.project_name != before.project_name
        || after.artist != before.artist
        || after.schema_version != before.schema_version
        || after.created_with != before.created_with
        || after.created_at != before.created_at
        || after.deadline != before.deadline
        || after.sample_rate != before.sample_rate
        || after.bit_depth != before.bit_depth
        || after.file_format != before.file_format
        || after.delivery_method != before.delivery_method
        || after.current_revision != before.current_revision
        || after.approved_revision != before.approved_revision
        || after.delivered_revision != Some(approved_revision)
        || after.revisions != before.revisions
    {
        return false;
    }
    let Some(delivery) = after.delivery.as_ref() else {
        return false;
    };
    if delivery.revision != approved_revision
        || delivery.method != before.delivery_method
        || delivery.files.len() != expected.selected.len()
    {
        return false;
    }
    expected.selected.iter().all(|planned| {
        delivery.files.iter().any(|file| {
            file.path == planned.path && file.deliverable_type == planned.deliverable_type
        })
    })
}

fn uncertain_delivery_result() -> DeliveryOperationResult {
    cli::blocked_delivery_operation(
        DeliveryOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the authoritative delivery state could not be reconciled. The operation may have completed; do not retry automatically.",
    )
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

fn workspace_allows_intake_report_read(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy | WorkspaceStatus::Partial)
}

fn workspace_allows_intake_validation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}

fn workspace_allows_revision_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}

fn workspace_allows_revision_approval(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}

fn workspace_allows_delivery_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
mod tests {
    use super::*;
    use crate::models::{DeliveryFile, DeliverySummary, PlannedDeliveryFile, RevisionSummary};
    use tempfile::tempdir;

    fn project_with_two_revisions() -> ProjectSummary {
        ProjectSummary {
            project_id: "blue-sky".into(),
            project_name: "Blue Sky".into(),
            artist: "The Artist".into(),
            schema_version: "1.1.0".into(),
            created_with: "jl-mixing 1.2.0".into(),
            created_at: "2026-07-16T10:00:00Z".into(),
            deadline: Some("2026-07-31".into()),
            sample_rate: 48_000,
            bit_depth: 24,
            file_format: "WAV".into(),
            delivery_method: "Download".into(),
            current_revision: 2,
            approved_revision: Some(1),
            delivered_revision: None,
            delivery: None,
            revisions: vec![
                RevisionSummary {
                    number: 1,
                    revision_id: "45a87315-78b0-4cc5-a971-e0a34b394cf5".into(),
                    created_at: "2026-07-16T12:00:00Z".into(),
                    description: "Initial mix".into(),
                    approved_at: Some("2026-07-17T12:00:00Z".into()),
                    approved_by: Some("Client Reviewer".into()),
                },
                RevisionSummary {
                    number: 2,
                    revision_id: "838e1b52-e8d3-48c7-8a8d-179c985d4bbc".into(),
                    created_at: "2026-07-17T18:00:00Z".into(),
                    description: "Balance update".into(),
                    approved_at: None,
                    approved_by: None,
                },
            ],
        }
    }

    fn expected_revision() -> RevisionCreationSummary {
        RevisionCreationSummary {
            client_id: "acme".into(),
            project_id: "blue-sky".into(),
            number: 3,
            description: "Vocal lift".into(),
        }
    }

    fn project_after_revision_creation() -> ProjectSummary {
        let mut project = project_with_two_revisions();
        project.current_revision = 3;
        project.revisions.push(RevisionSummary {
            number: 3,
            revision_id: "dd0cb190-bd55-4200-bca0-b5472cbef368".into(),
            created_at: "2026-07-18T12:00:00Z".into(),
            description: "Vocal lift".into(),
            approved_at: None,
            approved_by: None,
        });
        project
    }

    fn expected_approval(revision: u32) -> RevisionApprovalSummary {
        RevisionApprovalSummary {
            client_id: "acme".into(),
            project_id: "blue-sky".into(),
            revision,
            approved_by: "Client".into(),
            approved_at: Some("2026-07-18T13:00:00Z".into()),
        }
    }

    fn project_after_revision_approval(revision: u32) -> ProjectSummary {
        let mut project = project_with_two_revisions();
        project.approved_revision = Some(revision);
        let selected = project
            .revisions
            .iter_mut()
            .find(|candidate| candidate.number == revision)
            .unwrap();
        selected.approved_by = Some("Client".into());
        selected.approved_at = Some("2026-07-18T13:00:00Z".into());
        project
    }

    fn expected_delivery() -> DeliveryCreationPreview {
        DeliveryCreationPreview {
            client_id: "acme".into(),
            project_id: "blue-sky".into(),
            project_name: "Blue Sky".into(),
            current_revision: 2,
            approved_revision: 1,
            delivered_revision: Some(1),
            delivery_method: "Download".into(),
            replacement_mode: crate::models::DeliveryReplacementMode::Default,
            create_zip: false,
            selected: vec![PlannedDeliveryFile {
                source_name: "Blue Sky Main Mix.wav".into(),
                deliverable_type: "main_mix".into(),
                path: "Blue Sky Main Mix.wav".into(),
            }],
            excluded: Vec::new(),
        }
    }

    fn project_after_delivery_creation() -> ProjectSummary {
        let mut project = project_with_two_revisions();
        project.delivered_revision = Some(1);
        project.delivery = Some(DeliverySummary {
            document_id: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065".into(),
            created_with: "jl-mixing 1.2.0".into(),
            created_at: "2026-07-18T14:00:00Z".into(),
            method: "Download".into(),
            revision: 1,
            revision_id: project.revisions[0].revision_id.clone(),
            description: project.revisions[0].description.clone(),
            approved_at: project.revisions[0].approved_at.clone().unwrap(),
            approved_by: project.revisions[0].approved_by.clone().unwrap(),
            files: vec![DeliveryFile {
                path: "Blue Sky Main Mix.wav".into(),
                deliverable_type: "main_mix".into(),
                size_bytes: 12,
                sha256: "0".repeat(64),
            }],
        });
        project
    }

    #[test]
    fn only_healthy_and_empty_workspaces_allow_client_creation() {
        assert!(workspace_allows_client_creation(WorkspaceStatus::Healthy));
        assert!(workspace_allows_client_creation(WorkspaceStatus::Empty));
        assert!(!workspace_allows_client_creation(WorkspaceStatus::Partial));
        assert!(!workspace_allows_client_creation(
            WorkspaceStatus::Unavailable
        ));
        assert!(!workspace_allows_client_creation(WorkspaceStatus::Invalid));
    }

    #[test]
    fn only_healthy_workspaces_allow_project_creation() {
        assert!(workspace_allows_project_creation(WorkspaceStatus::Healthy));
        assert!(!workspace_allows_project_creation(WorkspaceStatus::Empty));
        assert!(!workspace_allows_project_creation(WorkspaceStatus::Partial));
        assert!(!workspace_allows_project_creation(
            WorkspaceStatus::Unavailable
        ));
        assert!(!workspace_allows_project_creation(WorkspaceStatus::Invalid));
    }

    #[test]
    fn intake_reports_remain_readable_in_partial_workspaces() {
        assert!(workspace_allows_intake_report_read(
            WorkspaceStatus::Healthy
        ));
        assert!(workspace_allows_intake_report_read(
            WorkspaceStatus::Partial
        ));
        assert!(!workspace_allows_intake_report_read(WorkspaceStatus::Empty));
        assert!(!workspace_allows_intake_report_read(
            WorkspaceStatus::Invalid
        ));
    }

    #[test]
    fn only_healthy_workspaces_allow_intake_validation() {
        assert!(workspace_allows_intake_validation(WorkspaceStatus::Healthy));
        assert!(!workspace_allows_intake_validation(
            WorkspaceStatus::Partial
        ));
        assert!(!workspace_allows_intake_validation(WorkspaceStatus::Empty));
        assert!(!workspace_allows_intake_validation(
            WorkspaceStatus::Invalid
        ));
    }

    #[test]
    fn only_healthy_workspaces_allow_revision_creation() {
        assert!(workspace_allows_revision_creation(WorkspaceStatus::Healthy));
        assert!(!workspace_allows_revision_creation(
            WorkspaceStatus::Partial
        ));
        assert!(!workspace_allows_revision_creation(WorkspaceStatus::Empty));
        assert!(!workspace_allows_revision_creation(
            WorkspaceStatus::Invalid
        ));
    }

    #[test]
    fn only_healthy_workspaces_allow_revision_approval() {
        assert!(workspace_allows_revision_approval(WorkspaceStatus::Healthy));
        assert!(!workspace_allows_revision_approval(
            WorkspaceStatus::Partial
        ));
        assert!(!workspace_allows_revision_approval(WorkspaceStatus::Empty));
        assert!(!workspace_allows_revision_approval(
            WorkspaceStatus::Invalid
        ));
    }

    #[test]
    fn only_healthy_workspaces_allow_delivery_creation() {
        assert!(workspace_allows_delivery_creation(WorkspaceStatus::Healthy));
        assert!(!workspace_allows_delivery_creation(
            WorkspaceStatus::Partial
        ));
        assert!(!workspace_allows_delivery_creation(WorkspaceStatus::Empty));
        assert!(!workspace_allows_delivery_creation(
            WorkspaceStatus::Invalid
        ));
    }

    #[test]
    fn verifies_one_authoritative_revision_and_preserved_lifecycle_state() {
        assert!(verify_revision_creation(
            &project_with_two_revisions(),
            &project_after_revision_creation(),
            &expected_revision(),
        ));
    }

    #[test]
    fn rejects_reconciliation_when_prior_history_or_pointers_change() {
        let before = project_with_two_revisions();
        let mut changed_history = project_after_revision_creation();
        changed_history.revisions[0].description = "Changed".into();
        assert!(!verify_revision_creation(
            &before,
            &changed_history,
            &expected_revision(),
        ));

        let mut changed_pointer = project_after_revision_creation();
        changed_pointer.approved_revision = None;
        assert!(!verify_revision_creation(
            &before,
            &changed_pointer,
            &expected_revision(),
        ));
    }

    #[test]
    fn rejects_reconciliation_when_new_revision_reuses_an_identity() {
        let before = project_with_two_revisions();
        let mut after = project_after_revision_creation();
        after.revisions[2].revision_id = before.revisions[0].revision_id.clone();
        assert!(!verify_revision_creation(
            &before,
            &after,
            &expected_revision(),
        ));
    }

    #[test]
    fn verifies_only_selected_approval_and_pointer_change() {
        assert!(verify_revision_approval(
            &project_with_two_revisions(),
            &project_after_revision_approval(2),
            &expected_approval(2),
        ));
    }

    #[test]
    fn verifies_historical_reapproval_without_changing_other_records() {
        let mut before = project_with_two_revisions();
        before.approved_revision = Some(2);
        before.revisions[1].approved_by = Some("Earlier Reviewer".into());
        before.revisions[1].approved_at = Some("2026-07-17T19:00:00Z".into());
        let mut after = before.clone();
        after.approved_revision = Some(1);
        after.revisions[0].approved_by = Some("Client".into());
        after.revisions[0].approved_at = Some("2026-07-18T13:00:00Z".into());

        assert!(verify_revision_approval(
            &before,
            &after,
            &expected_approval(1),
        ));
    }

    #[test]
    fn rejects_approval_reconciliation_when_unselected_history_or_delivery_changes() {
        let before = project_with_two_revisions();
        let mut changed_history = project_after_revision_approval(2);
        changed_history.revisions[0].description = "Changed".into();
        assert!(!verify_revision_approval(
            &before,
            &changed_history,
            &expected_approval(2),
        ));

        let mut changed_delivery = project_after_revision_approval(2);
        changed_delivery.delivered_revision = Some(1);
        assert!(!verify_revision_approval(
            &before,
            &changed_delivery,
            &expected_approval(2),
        ));
    }

    #[test]
    fn verifies_exact_first_delivery_transition() {
        assert!(verify_delivery_creation(
            &project_with_two_revisions(),
            &project_after_delivery_creation(),
            &expected_delivery(),
        ));
    }

    #[test]
    fn rejects_delivery_reconciliation_when_history_or_files_change() {
        let before = project_with_two_revisions();
        let mut changed_history = project_after_delivery_creation();
        changed_history.revisions[0].description = "Changed".into();
        assert!(!verify_delivery_creation(
            &before,
            &changed_history,
            &expected_delivery(),
        ));

        let mut changed_files = project_after_delivery_creation();
        changed_files.delivery.as_mut().unwrap().files[0].path = "Other.wav".into();
        assert!(!verify_delivery_creation(
            &before,
            &changed_files,
            &expected_delivery(),
        ));
    }

    #[test]
    fn replaces_and_reads_delivery_notes_exactly() {
        let directory = tempdir().expect("temporary directory");
        let notes = directory.path().join("Delivery_Notes.md");
        fs::write(&notes, "Original\n").expect("original notes");

        write_delivery_notes(&notes, "# Delivery\n\nUpdated handoff.\n").expect("save notes");

        let document = read_delivery_notes(&notes).expect("read notes");
        assert_eq!(document.content, "# Delivery\n\nUpdated handoff.\n");
        assert_eq!(document.max_bytes, DELIVERY_NOTES_MAX_BYTES);
    }

    #[test]
    fn rejects_oversized_delivery_notes_before_reading_content() {
        let directory = tempdir().expect("temporary directory");
        let notes = directory.path().join("Delivery_Notes.md");
        fs::write(&notes, vec![b'a'; DELIVERY_NOTES_MAX_BYTES + 1]).expect("large notes");

        assert!(read_delivery_notes(&notes)
            .expect_err("oversized notes must fail")
            .contains("editor limit"));
    }

    #[test]
    fn verifies_requested_zip_and_preserved_overwrite_notes() {
        let directory = tempdir().expect("temporary directory");
        let delivery = directory.path().join("05_Final_Delivery");
        fs::create_dir(&delivery).expect("delivery directory");
        fs::write(delivery.join("Delivery_Notes.md"), "Edited notes\n").expect("notes");
        fs::write(delivery.join("blue-sky-delivery.zip"), "zip").expect("zip");

        assert!(verify_delivery_artifacts(
            directory.path(),
            "blue-sky",
            true,
            Some(b"Edited notes\n"),
        ));
        assert!(!verify_delivery_artifacts(
            directory.path(),
            "blue-sky",
            true,
            Some(b"Different notes\n"),
        ));
    }
}
