//! Delivery workflow policy and post-operation reconciliation.
//!
//! This module deliberately sits above the Automation CLI/API adapter: it validates the
//! authoritative workspace state before execution and reconciles it afterward so destructive
//! delivery operations never become implicit retries after an uncertain result.

use std::fs;

use crate::cli;
use crate::models::{
    DeliveryCreationPreview, DeliveryCreationRequest, DeliveryOperationCode,
    DeliveryOperationResult, DeliveryReplacementMode, ProjectSummary, WorkspaceStatus,
};
use crate::workspace;

use super::super::{find_project_summary, resolve_home, validated_project_directory};

pub(crate) fn run_delivery_operation(
    app: &tauri::AppHandle,
    request: DeliveryCreationRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        DeliveryCreationRequest,
    ) -> DeliveryOperationResult,
    verify_after_creation: bool,
) -> DeliveryOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::UnsupportedPlatform,
            "Delivery creation requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_delivery_operation(DeliveryOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_delivery_creation(snapshot.status) {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before creating a delivery",
        );
    }
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let Some(before) = find_project_summary(&snapshot, &client_id, &project_id).cloned() else {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::ProjectUnavailable,
            "The selected project is no longer available in the validated workspace",
        );
    };
    let Some(approved_revision) = before.approved_revision else {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::ApprovalRequired,
            "Approve a revision before creating a delivery",
        );
    };
    match request.replacement_mode {
        DeliveryReplacementMode::Default
            if before.delivered_revision.is_some() || before.delivery.is_some() =>
        {
            return cli::blocked_delivery_operation(
                DeliveryOperationCode::AlreadyDelivered,
                "This project already has a delivery package; select the overwrite workflow",
            );
        }
        DeliveryReplacementMode::Overwrite | DeliveryReplacementMode::Clean
            if before.delivered_revision.is_none() || before.delivery.is_none() =>
        {
            return cli::blocked_delivery_operation(
                DeliveryOperationCode::ProjectUnavailable,
                "Delivery replacement requires a validated existing package",
            );
        }
        _ => {}
    }
    let Some(project_directory) =
        validated_project_directory(&workspace_path, &snapshot, &client_id, &project_id)
    else {
        return cli::blocked_delivery_operation(
            DeliveryOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };

    if matches!(request.replacement_mode, DeliveryReplacementMode::Clean) {
        if !verify_after_creation && !request.confirmed_deletions.is_empty() {
            return cli::blocked_delivery_operation(
                DeliveryOperationCode::InvalidInput,
                "Clean preview cannot include a prior deletion confirmation",
            );
        }
        if verify_after_creation {
            // Clean replacement is authorized only for the exact deletion inventory the user reviewed.
            if request.confirmed_deletions.is_empty() {
                return cli::blocked_delivery_operation(
                    DeliveryOperationCode::InvalidInput,
                    "Confirm the clean deletion preview before replacement",
                );
            }
            let current_deletions = match list_delivery_entries(&project_directory) {
                Ok(entries) => entries,
                Err(message) => {
                    return cli::blocked_delivery_operation(
                        DeliveryOperationCode::Rejected,
                        &message,
                    )
                }
            };
            let expected: std::collections::BTreeSet<_> =
                request.confirmed_deletions.iter().cloned().collect();
            let current: std::collections::BTreeSet<_> = current_deletions.into_iter().collect();
            if current != expected {
                return cli::blocked_delivery_operation(
                    DeliveryOperationCode::Rejected,
                    "Delivery contents changed after preview; review a new clean-deletion plan",
                );
            }
        }
    }

    let replacement_mode = request.replacement_mode;
    let create_zip = request.create_zip;
    let prior_notes = matches!(replacement_mode, DeliveryReplacementMode::Overwrite)
        .then(|| fs::read(project_directory.join("05_Final_Delivery/Delivery_Notes.md")).ok())
        .flatten();
    let result = operation(&home, &project_directory, request);
    if result.ok {
        let Some(preview) = result.delivery.as_ref() else {
            return if verify_after_creation {
                uncertain_delivery_result()
            } else {
                cli::blocked_delivery_operation(
                    DeliveryOperationCode::Failed,
                    "The delivery preview did not include a verifiable package plan",
                )
            };
        };
        let expected_delivered = if verify_after_creation {
            Some(approved_revision)
        } else {
            before.delivered_revision
        };
        if preview.client_id != client_id
            || preview.project_id != project_id
            || preview.project_name != before.project_name
            || preview.current_revision != before.current_revision
            || preview.approved_revision != approved_revision
            || preview.delivered_revision != expected_delivered
            || preview.delivery_method != before.delivery_method
            || preview.replacement_mode != replacement_mode
            || preview.create_zip != create_zip
        {
            return if verify_after_creation {
                uncertain_delivery_result()
            } else {
                cli::blocked_delivery_operation(
                    DeliveryOperationCode::Failed,
                    "The delivery preview did not match the authoritative project state",
                )
            };
        }
    }
    if !verify_after_creation || !result.ok || result.code != DeliveryOperationCode::Created {
        return result;
    }
    let Some(expected) = result.delivery.as_ref() else {
        return uncertain_delivery_result();
    };
    // Automation success is reconciled against authoritative workspace state before we claim
    // completion; failure to reconcile is Uncertain so callers must not retry automatically.
    let refreshed = workspace::discover_workspace_at(&workspace_path);
    let Some(after) = find_project_summary(&refreshed, &client_id, &project_id) else {
        return uncertain_delivery_result();
    };
    if !verify_delivery_creation(&before, after, expected)
        || !verify_delivery_artifacts(&project_directory, expected, prior_notes.as_deref())
    {
        return uncertain_delivery_result();
    }
    result
}

pub(crate) fn verify_delivery_artifacts(
    project_directory: &std::path::Path,
    expected: &DeliveryCreationPreview,
    prior_notes: Option<&[u8]>,
) -> bool {
    let delivery = project_directory.join("05_Final_Delivery");
    let notes = delivery.join("Delivery_Notes.md");
    let Ok(notes_metadata) = fs::symlink_metadata(&notes) else {
        return false;
    };
    if !notes_metadata.is_file() || notes_metadata.file_type().is_symlink() {
        return false;
    }
    if prior_notes.is_some_and(|expected| fs::read(&notes).ok().as_deref() != Some(expected)) {
        return false;
    }
    if expected.create_zip {
        let Some(zip_name) = expected.zip_name.as_deref() else {
            return false;
        };
        let zip = delivery.join(zip_name);
        let Ok(zip_metadata) = fs::symlink_metadata(zip) else {
            return false;
        };
        if !zip_metadata.is_file() || zip_metadata.file_type().is_symlink() {
            return false;
        }
    }
    if matches!(expected.replacement_mode, DeliveryReplacementMode::Clean) {
        let mut recreated = std::collections::BTreeSet::from([
            "Delivery_Notes.md".to_owned(),
            "delivery-manifest.json".to_owned(),
        ]);
        if expected.create_zip {
            let Some(zip_name) = expected.zip_name.as_ref() else {
                return false;
            };
            recreated.insert(zip_name.clone());
        }
        for file in &expected.selected {
            recreated.insert(file.path.clone());
            let mut parent = std::path::Path::new(&file.path).parent();
            while let Some(path) = parent {
                if path.as_os_str().is_empty() {
                    break;
                }
                let Some(relative) = path.to_str() else {
                    return false;
                };
                recreated.insert(format!("{relative}/"));
                parent = path.parent();
            }
        }
        for deletion in &expected.deletions {
            if !recreated.contains(deletion)
                && fs::symlink_metadata(delivery.join(deletion.trim_end_matches('/'))).is_ok()
            {
                return false;
            }
        }
    }
    true
}

pub(crate) fn list_delivery_entries(
    project_directory: &std::path::Path,
) -> Result<Vec<String>, String> {
    fn visit(
        root: &std::path::Path,
        directory: &std::path::Path,
        entries: &mut Vec<String>,
    ) -> Result<(), String> {
        let children = fs::read_dir(directory)
            .map_err(|_| "The delivery deletion inventory could not be read")?;
        for child in children {
            let child = child.map_err(|_| "The delivery deletion inventory could not be read")?;
            let path = child.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|_| "The delivery deletion inventory could not be inspected")?;
            let relative = path
                .strip_prefix(root)
                .ok()
                .and_then(std::path::Path::to_str)
                .ok_or("The delivery deletion inventory contains an unsupported path")?
                .replace(std::path::MAIN_SEPARATOR, "/");
            if metadata.is_dir() && !metadata.file_type().is_symlink() {
                entries.push(format!("{relative}/"));
                visit(root, &path, entries)?;
            } else {
                entries.push(relative);
            }
            if entries.len() > 10_000 {
                return Err("The delivery deletion inventory is too large".into());
            }
        }
        Ok(())
    }

    let root = project_directory.join("05_Final_Delivery");
    let mut entries = Vec::new();
    visit(&root, &root, &mut entries)?;
    entries.sort_by(|left, right| {
        left.to_ascii_lowercase()
            .cmp(&right.to_ascii_lowercase())
            .then_with(|| left.cmp(right))
    });
    Ok(entries)
}

pub(crate) fn verify_delivery_creation(
    before: &ProjectSummary,
    after: &ProjectSummary,
    expected: &DeliveryCreationPreview,
) -> bool {
    let Some(approved_revision) = before.approved_revision else {
        return false;
    };
    if after.project_id != before.project_id
        || after.project_name != before.project_name
        || after.artist != before.artist
        || after.schema_version != before.schema_version
        || after.created_with != before.created_with
        || after.created_at != before.created_at
        || after.deadline != before.deadline
        || after.sample_rate != before.sample_rate
        || after.bit_depth != before.bit_depth
        || after.file_format != before.file_format
        || after.delivery_method != before.delivery_method
        || after.current_revision != before.current_revision
        || after.approved_revision != before.approved_revision
        || after.delivered_revision != Some(approved_revision)
        || after.revisions != before.revisions
    {
        return false;
    }
    let Some(delivery) = after.delivery.as_ref() else {
        return false;
    };
    if delivery.revision != approved_revision || delivery.method != before.delivery_method {
        return false;
    }
    expected.selected.iter().all(|planned| {
        delivery.files.iter().any(|file| {
            file.path == planned.path && file.deliverable_type == planned.deliverable_type
        })
    })
}

fn uncertain_delivery_result() -> DeliveryOperationResult {
    cli::blocked_delivery_operation(
        DeliveryOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the authoritative delivery state could not be reconciled. The operation may have completed; do not retry automatically.",
    )
}

pub(crate) fn workspace_allows_delivery_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}
