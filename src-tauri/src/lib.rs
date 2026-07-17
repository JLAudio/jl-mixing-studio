mod cli;
mod manifest;
mod models;

use models::{ProjectSummary, SystemInfo, VersionCheck};

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

/// Parses the read-only fixture bundled with this architecture spike.
/// Accepting arbitrary paths is intentionally deferred until a file-picker
/// workflow and its path-validation policy have been designed.
#[tauri::command]
fn read_sample_manifest() -> Result<ProjectSummary, String> {
    manifest::parse_project_manifest(include_str!(
        "../../fixtures/project with spaces/project-manifest.json"
    ))
    .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_jl_mixing_version,
            read_sample_manifest
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
