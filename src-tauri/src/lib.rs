mod cli;
mod models;
mod workspace;

use models::{
    ClientCreationRequest, ClientOperationCode, ClientOperationResult, SystemInfo, VersionCheck,
    WorkspaceSnapshot, WorkspaceStatus,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_jl_mixing_version,
            discover_default_workspace,
            preflight_client_creation,
            create_client
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
