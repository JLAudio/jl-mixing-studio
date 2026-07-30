use crate::cli;
use crate::models::{
    ProjectCreationRequest, ProjectOperationCode, ProjectOperationResult, WorkspaceStatus,
};
use crate::workspace;
use tauri::Manager;

/// Project creation requires a healthy workspace and a client directory that
/// is re-resolved from the current validated snapshot. UI-selected identity is
/// never trusted as a filesystem path.
pub(crate) fn run_project_operation(
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

pub(crate) fn workspace_allows_project_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}
