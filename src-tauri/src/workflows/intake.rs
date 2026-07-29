//! Intake report access and validation workflow policy.
//!
//! Report reads may tolerate a partial workspace because they do not mutate project state;
//! validation requires a healthy workspace and a validated project directory before Automation
//! can run. Keeping both paths together makes that trust boundary explicit.

use crate::cli;
use crate::models::{IntakeOperationCode, IntakeOperationResult, IntakeRequest, WorkspaceStatus};
use crate::workspace;

use super::super::{resolve_home, validated_project_directory};

pub(crate) fn read_intake_report(
    app: tauri::AppHandle,
    request: IntakeRequest,
) -> IntakeOperationResult {
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

pub(crate) fn run_intake_operation(
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

pub(crate) fn workspace_allows_intake_report_read(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy | WorkspaceStatus::Partial)
}

pub(crate) fn workspace_allows_intake_validation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}
