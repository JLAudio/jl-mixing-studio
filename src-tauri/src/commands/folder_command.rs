use super::workspace_command_support::{resolve_home, validated_project_directory};
use crate::models::{FolderLocation, FolderRequest, FolderResult, WorkspaceStatus};
use crate::workspace;
use std::path::{Path, PathBuf};

#[tauri::command]
pub(crate) fn resolve_folder(
    app: tauri::AppHandle,
    request: FolderRequest,
) -> Result<FolderResult, String> {
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

pub(crate) fn intake_directory(project_directory: &Path) -> PathBuf {
    project_directory
        .join("01_Client_Files")
        .join("Original_Delivery")
}

#[tauri::command]
pub(crate) fn open_folder(
    app: tauri::AppHandle,
    request: FolderRequest,
) -> Result<FolderResult, String> {
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
