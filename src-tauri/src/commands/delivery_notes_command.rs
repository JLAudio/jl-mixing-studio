use super::workspace_command_support::{
    find_project_summary, resolve_home, validated_project_directory,
};
use crate::models::{
    DeliveryNotesDocument, DeliveryNotesRequest, DeliveryNotesUpdateRequest, WorkspaceStatus,
};
use crate::workspace;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

pub(crate) const DELIVERY_NOTES_MAX_BYTES: usize = 65_536;

#[tauri::command]
pub(crate) fn get_delivery_notes(
    app: tauri::AppHandle,
    request: DeliveryNotesRequest,
) -> Result<DeliveryNotesDocument, String> {
    let path = resolve_delivery_notes_path(&app, &request.client_id, &request.project_id, true)?;
    read_delivery_notes(&path)
}

#[tauri::command]
pub(crate) fn update_delivery_notes(
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

pub(crate) fn read_delivery_notes(path: &std::path::Path) -> Result<DeliveryNotesDocument, String> {
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

pub(crate) fn write_delivery_notes(path: &std::path::Path, content: &str) -> Result<(), String> {
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
