mod cli;
mod models;
mod workspace;

use models::{SystemInfo, VersionCheck, WorkspaceSnapshot};
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
fn get_jl_mixing_version() -> VersionCheck {
    cli::check_jl_mixing_version()
}

#[tauri::command]
fn discover_default_workspace(app: tauri::AppHandle) -> Result<WorkspaceSnapshot, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|_| "The current user's home directory could not be resolved".to_owned())?;
    Ok(workspace::discover_workspace_at(
        &home.join("Music").join("Mixes"),
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_jl_mixing_version,
            discover_default_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
