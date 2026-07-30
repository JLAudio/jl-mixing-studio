//! Revision creation and approval workflow policy with authoritative reconciliation.
//!
//! Successful Automation responses are reconciled against the validated project history before
//! Studio reports completion. A mismatch is intentionally `Uncertain`: callers must not turn a
//! potentially completed non-idempotent operation into an automatic retry.

use crate::cli;
use crate::models::{
    ApprovalOperationCode, ApprovalOperationResult, ProjectSummary, RevisionApprovalRequest,
    RevisionApprovalSummary, RevisionCreationRequest, RevisionCreationSummary,
    RevisionOperationCode, RevisionOperationResult, WorkspaceStatus,
};
use crate::workspace;

use super::super::{find_project_summary, resolve_home, validated_project_directory};

pub(crate) fn run_revision_operation(
    app: &tauri::AppHandle,
    request: RevisionCreationRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        RevisionCreationRequest,
    ) -> RevisionOperationResult,
    verify_after_creation: bool,
) -> RevisionOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_revision_operation(
            RevisionOperationCode::UnsupportedPlatform,
            "Revision creation requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_revision_operation(RevisionOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_revision_creation(snapshot.status) {
        return cli::blocked_revision_operation(
            RevisionOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before creating a revision",
        );
    }
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let Some(before) = find_project_summary(&snapshot, &client_id, &project_id).cloned() else {
        return cli::blocked_revision_operation(
            RevisionOperationCode::ProjectUnavailable,
            "The selected project is no longer available in the validated workspace",
        );
    };
    let Some(project_directory) =
        validated_project_directory(&workspace_path, &snapshot, &client_id, &project_id)
    else {
        return cli::blocked_revision_operation(
            RevisionOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };

    let result = operation(&home, &project_directory, request);
    if result.ok {
        let Some(preview) = result.revision.as_ref() else {
            return if verify_after_creation {
                uncertain_revision_result()
            } else {
                cli::blocked_revision_operation(
                    RevisionOperationCode::Failed,
                    "The revision preview did not include a verifiable revision identity",
                )
            };
        };
        if preview.client_id != client_id
            || preview.project_id != project_id
            || before.current_revision.checked_add(1) != Some(preview.number)
        {
            return if verify_after_creation {
                uncertain_revision_result()
            } else {
                cli::blocked_revision_operation(
                    RevisionOperationCode::Failed,
                    "The revision preview did not match the authoritative project state",
                )
            };
        }
    }
    if !verify_after_creation || !result.ok || result.code != RevisionOperationCode::Created {
        return result;
    }
    let Some(expected) = result.revision.as_ref() else {
        return uncertain_revision_result();
    };
    if expected.client_id != client_id || expected.project_id != project_id {
        return uncertain_revision_result();
    }
    let refreshed = workspace::discover_workspace_at(&workspace_path);
    let Some(after) = find_project_summary(&refreshed, &client_id, &project_id) else {
        return uncertain_revision_result();
    };
    if !verify_revision_creation(&before, after, expected) {
        return uncertain_revision_result();
    }
    result
}

pub(crate) fn verify_revision_creation(
    before: &ProjectSummary,
    after: &ProjectSummary,
    expected: &RevisionCreationSummary,
) -> bool {
    let Some(next_number) = before.current_revision.checked_add(1) else {
        return false;
    };
    if expected.number != next_number
        || after.project_id != before.project_id
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
        || after.current_revision != next_number
        || after.approved_revision != before.approved_revision
        || after.delivered_revision != before.delivered_revision
        || after.revisions.len() != before.revisions.len() + 1
    {
        return false;
    }
    if !before.revisions.iter().all(|revision| {
        after
            .revisions
            .iter()
            .find(|candidate| candidate.number == revision.number)
            == Some(revision)
    }) {
        return false;
    }
    let Some(created) = after
        .revisions
        .iter()
        .find(|revision| revision.number == next_number)
    else {
        return false;
    };
    created.description == expected.description
        && created.approved_at.is_none()
        && created.approved_by.is_none()
        && !before
            .revisions
            .iter()
            .any(|revision| revision.revision_id == created.revision_id)
}

fn uncertain_revision_result() -> RevisionOperationResult {
    cli::blocked_revision_operation(
        RevisionOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the authoritative revision history could not be reconciled. The operation may have completed; do not retry automatically.",
    )
}

pub(crate) fn run_approval_operation(
    app: &tauri::AppHandle,
    request: RevisionApprovalRequest,
    operation: fn(
        &std::path::Path,
        &std::path::Path,
        RevisionApprovalRequest,
    ) -> ApprovalOperationResult,
    verify_after_approval: bool,
) -> ApprovalOperationResult {
    if cfg!(target_os = "windows") {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::UnsupportedPlatform,
            "Revision approval requires JL Mixing Automation on macOS or Linux",
        );
    }
    let home = match resolve_home(app) {
        Ok(home) => home,
        Err(message) => {
            return cli::blocked_approval_operation(ApprovalOperationCode::Failed, &message)
        }
    };
    let workspace_path = home.join("Music").join("Mixes");
    let snapshot = workspace::discover_workspace_at(&workspace_path);
    if !workspace_allows_revision_approval(snapshot.status) {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::WorkspaceBlocked,
            "Resolve workspace issues before approving a revision",
        );
    }
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let revision_number = request.revision;
    let approved_by = request.approved_by.trim().to_owned();
    let Some(before) = find_project_summary(&snapshot, &client_id, &project_id).cloned() else {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::ProjectUnavailable,
            "The selected project is no longer available in the validated workspace",
        );
    };
    if !before
        .revisions
        .iter()
        .any(|revision| revision.number == revision_number)
    {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::RevisionUnavailable,
            "The selected revision is no longer available in the validated project",
        );
    }
    if before.approved_revision == Some(revision_number) {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::AlreadyApproved,
            "The selected revision is already the approved revision",
        );
    }
    let Some(project_directory) =
        validated_project_directory(&workspace_path, &snapshot, &client_id, &project_id)
    else {
        return cli::blocked_approval_operation(
            ApprovalOperationCode::ProjectUnavailable,
            "The selected project directory could not be resolved safely",
        );
    };

    let result = operation(&home, &project_directory, request);
    if result.ok {
        let Some(approval) = result.approval.as_ref() else {
            return if verify_after_approval {
                uncertain_approval_result()
            } else {
                cli::blocked_approval_operation(
                    ApprovalOperationCode::Failed,
                    "The approval preview did not include a verifiable revision identity",
                )
            };
        };
        if approval.client_id != client_id
            || approval.project_id != project_id
            || approval.revision != revision_number
            || approval.approved_by != approved_by
            || !before
                .revisions
                .iter()
                .any(|revision| revision.number == approval.revision)
        {
            return if verify_after_approval {
                uncertain_approval_result()
            } else {
                cli::blocked_approval_operation(
                    ApprovalOperationCode::Failed,
                    "The approval preview did not match the authoritative project state",
                )
            };
        }
    }
    if !verify_after_approval || !result.ok || result.code != ApprovalOperationCode::Approved {
        return result;
    }
    let Some(expected) = result.approval.as_ref() else {
        return uncertain_approval_result();
    };
    if expected.client_id != client_id || expected.project_id != project_id {
        return uncertain_approval_result();
    }
    let refreshed = workspace::discover_workspace_at(&workspace_path);
    let Some(after) = find_project_summary(&refreshed, &client_id, &project_id) else {
        return uncertain_approval_result();
    };
    if !verify_revision_approval(&before, after, expected) {
        return uncertain_approval_result();
    }
    result
}

pub(crate) fn verify_revision_approval(
    before: &ProjectSummary,
    after: &ProjectSummary,
    expected: &RevisionApprovalSummary,
) -> bool {
    if expected.approved_at.as_deref().is_none_or(str::is_empty)
        || after.project_id != before.project_id
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
        || after.delivered_revision != before.delivered_revision
        || after.approved_revision != Some(expected.revision)
        || after.revisions.len() != before.revisions.len()
    {
        return false;
    }
    if !before.revisions.iter().all(|revision| {
        if revision.number == expected.revision {
            return true;
        }
        after
            .revisions
            .iter()
            .find(|candidate| candidate.number == revision.number)
            == Some(revision)
    }) {
        return false;
    }
    let Some(previous) = before
        .revisions
        .iter()
        .find(|revision| revision.number == expected.revision)
    else {
        return false;
    };
    let Some(approved) = after
        .revisions
        .iter()
        .find(|revision| revision.number == expected.revision)
    else {
        return false;
    };
    approved.number == previous.number
        && approved.revision_id == previous.revision_id
        && approved.created_at == previous.created_at
        && approved.description == previous.description
        && approved.approved_by == Some(expected.approved_by.clone())
        && approved.approved_at == expected.approved_at
}

fn uncertain_approval_result() -> ApprovalOperationResult {
    cli::blocked_approval_operation(
        ApprovalOperationCode::Uncertain,
        "JL Mixing Automation reported success, but the authoritative approval state could not be reconciled. The operation may have completed; do not retry automatically.",
    )
}

pub(crate) fn workspace_allows_revision_creation(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}

pub(crate) fn workspace_allows_revision_approval(status: WorkspaceStatus) -> bool {
    matches!(status, WorkspaceStatus::Healthy)
}
