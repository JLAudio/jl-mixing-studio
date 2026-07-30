//! Client creation workflow policy.
//!
//! Client creation is allowed only against a validated existing studio workspace. The workflow
//! also owns the platform gate before JL Mixing Automation is invoked.

use crate::cli;
use crate::models::{
    ClientCreationRequest, ClientOperationCode, ClientOperationResult, WorkspaceStatus,
};
use crate::workspace;

use super::super::resolve_home;

pub(crate) fn run_client_operation(
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

pub(crate) fn workspace_allows_client_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy | WorkspaceStatus::Empty)
}
