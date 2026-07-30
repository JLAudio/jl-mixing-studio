use super::workspace_command_support::resolve_home;
use crate::cli;
use crate::models::{SystemInfo, VersionCheck, WorkspaceSnapshot};
use crate::workspace;

#[tauri::command]
pub(crate) fn get_system_info() -> SystemInfo {
    SystemInfo {
        operating_system: std::env::consts::OS.to_owned(),
        architecture: std::env::consts::ARCH.to_owned(),
    }
}

/// Executes one fixed, allowlisted JL Mixing Automation operation.
/// The frontend cannot choose the executable or supply arguments.
#[tauri::command]
pub(crate) fn get_jl_mixing_version(app: tauri::AppHandle) -> VersionCheck {
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
pub(crate) fn discover_default_workspace(
    app: tauri::AppHandle,
) -> Result<WorkspaceSnapshot, String> {
    let home = resolve_home(&app)?;
    Ok(workspace::discover_workspace_at(
        &home.join("Music").join("Mixes"),
    ))
}
