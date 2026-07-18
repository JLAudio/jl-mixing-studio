mod cli;
mod intake;
mod models;
mod workspace;

use models::{
    ClientCreationRequest, ClientOperationCode, ClientOperationResult, IntakeOperationCode,
    IntakeOperationResult, IntakeRequest, ProjectCreationRequest, ProjectOperationCode,
    ProjectOperationResult, ProjectSummary, RevisionCreationRequest, RevisionCreationSummary,
    RevisionOperationCode, RevisionOperationResult, SystemInfo, VersionCheck, WorkspaceSnapshot,
    WorkspaceStatus,
};
use std::path::PathBuf;
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
            client_creation_supported: false,
            project_creation_supported: false,
            intake_validation_supported: false,
            revision_creation_supported: false,
            version: None,
            message,
        },
    }
}

#[tauri::command]
fn discover_default_workspace(app: tauri::AppHandle) -> Result<WorkspaceSnapshot, String> {
    let home = resolve_home(&app)?;
    Ok(workspace::discover_workspace_at(
        &home.join("Music").join("Mixes"),
    ))
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
    )
    else {
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
    run_revision_operation(
        &app,
        request,
        cli::preflight_revision_creation,
        false,
    )
}

#[tauri::command]
fn create_revision(
    app: tauri::AppHandle,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(&app, request, cli::create_revision, true)
}

fn resolve_home(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map_err(|_| "The current user's home directory could not be resolved".to_owned())
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
    )
    else {
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
    if !verify_after_creation
        || !result.ok
        || result.code != RevisionOperationCode::Created
    {
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
        || after.sample_rate != before.sample_rate
        || after.bit_depth != before.bit_depth
        || after.file_format != before.file_format
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_jl_mixing_version,
            discover_default_workspace,
            preflight_client_creation,
            create_client,
            preflight_project_creation,
            create_project,
            get_intake_report,
            preflight_intake_validation,
            run_intake_validation,
            preflight_revision_creation,
            create_revision,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::RevisionSummary;

    fn project_with_two_revisions() -> ProjectSummary {
        ProjectSummary {
            project_id: "blue-sky".into(),
            project_name: "Blue Sky".into(),
            artist: "The Artist".into(),
            schema_version: "1.1.0".into(),
            created_with: "jl-mixing 1.2.0".into(),
            sample_rate: 48_000,
            bit_depth: 24,
            file_format: "WAV".into(),
            current_revision: 2,
            approved_revision: Some(1),
            delivered_revision: None,
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
        assert!(!workspace_allows_revision_creation(WorkspaceStatus::Partial));
        assert!(!workspace_allows_revision_creation(WorkspaceStatus::Empty));
        assert!(!workspace_allows_revision_creation(
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
}
