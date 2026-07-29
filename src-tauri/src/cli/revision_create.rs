use std::path::Path;

use crate::automation_api::{
    invoke_api, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
};
use crate::models::{
    RevisionCreationRequest, RevisionCreationSummary, RevisionOperationCode, RevisionOperationResult,
};

pub fn preflight_revision_creation(
    home: &Path,
    project_directory: &Path,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(
        home,
        project_directory,
        request,
        RevisionOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn create_revision(
    home: &Path,
    project_directory: &Path,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(
        home,
        project_directory,
        request,
        RevisionOperation::Create,
        &SystemProcessRunner,
    )
}

pub fn blocked_revision_operation(
    code: RevisionOperationCode,
    message: &str,
) -> RevisionOperationResult {
    RevisionOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        revision: None,
    }
}

#[derive(Clone, Copy)]
pub(super) enum RevisionOperation {
    Preflight,
    Create,
}

pub(super) fn run_revision_operation<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    request: RevisionCreationRequest,
    operation: RevisionOperation,
    runner: &R,
) -> RevisionOperationResult {
    let request = match normalize_revision_request(request) {
        Ok(request) => request,
        Err(message) => {
            return blocked_revision_operation(RevisionOperationCode::InvalidInput, &message)
        }
    };

    let version = super::check_version_with_runner(home, runner);
    if !version.available {
        return blocked_revision_operation(
            RevisionOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_revision_operation(
            RevisionOperationCode::UnsupportedVersion,
            &version.message,
        );
    }
    if !version.revision_creation_supported {
        return blocked_revision_operation(
            RevisionOperationCode::Rejected,
            "JL Mixing Automation does not advertise the revision.create description capability required by Studio",
        );
    }

    let arguments = revision_arguments(project_directory, &request, operation);
    match invoke_api(
        home,
        "revision.create",
        &arguments,
        Some(project_directory),
        runner,
    ) {
        Ok(response)
            if matches!(
                (operation, response.status),
                (RevisionOperation::Preflight, ApiStatus::Planned)
                    | (RevisionOperation::Create, ApiStatus::Success)
            ) =>
        {
            let Some(revision) = revision_summary_from_api(&response.data, &request) else {
                return blocked_revision_operation(
                    match operation {
                        RevisionOperation::Preflight => RevisionOperationCode::Failed,
                        RevisionOperation::Create => RevisionOperationCode::Uncertain,
                    },
                    match operation {
                        RevisionOperation::Preflight => {
                            "The JL Mixing Automation revision preview could not be verified"
                        }
                        RevisionOperation::Create => {
                            "JL Mixing Automation reported success, but the new revision identity could not be verified. The operation may have completed; do not retry automatically."
                        }
                    },
                );
            };
            RevisionOperationResult {
                ok: true,
                code: match operation {
                    RevisionOperation::Preflight => RevisionOperationCode::Ready,
                    RevisionOperation::Create => RevisionOperationCode::Created,
                },
                message: match operation {
                    RevisionOperation::Preflight => {
                        "Revision preview completed. No changes were made."
                    }
                    RevisionOperation::Create => "Revision created successfully.",
                }
                .to_owned(),
                revision: Some(revision),
            }
        }
        Ok(response) => blocked_revision_operation(
            RevisionOperationCode::Rejected,
            &response
                .errors
                .first()
                .map(|error| error.message.clone())
                .unwrap_or_else(|| {
                    format!(
                        "JL Mixing Automation returned unexpected status {:?} for revision.create",
                        response.status
                    )
                }),
        ),
        Err(ApiCallError::Unavailable) => blocked_revision_operation(
            RevisionOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        Err(ApiCallError::IncompatibleVersion(version)) => blocked_revision_operation(
            RevisionOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        Err(error) => blocked_revision_operation(
            match operation {
                RevisionOperation::Preflight => RevisionOperationCode::Failed,
                RevisionOperation::Create => RevisionOperationCode::Uncertain,
            },
            &error.message(),
        ),
    }
}

fn revision_summary_from_api(
    data: &serde_json::Value,
    request: &RevisionCreationRequest,
) -> Option<RevisionCreationSummary> {
    let project_id = data.get("project")?.get("id")?.as_str()?;
    let revision = data.get("revision")?;
    let number = revision.get("number")?.as_u64()?;
    let description = revision.get("description")?.as_str()?;
    if project_id != request.project_id
        || number == 0
        || number > u32::MAX as u64
        || description.trim().is_empty()
        || request
            .description
            .as_ref()
            .is_some_and(|expected| expected != description)
    {
        return None;
    }
    Some(RevisionCreationSummary {
        client_id: request.client_id.clone(),
        project_id: request.project_id.clone(),
        number: number as u32,
        description: description.to_owned(),
    })
}

fn normalize_revision_request(
    request: RevisionCreationRequest,
) -> Result<RevisionCreationRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let description = request
        .description
        .map(|description| description.trim().to_owned())
        .filter(|description| !description.is_empty());
    if !super::is_valid_client_id(&client_id) || !super::is_valid_client_id(&project_id) {
        return Err("Select a valid project before creating a revision".into());
    }
    if description
        .as_ref()
        .is_some_and(|value| value.chars().any(char::is_control))
    {
        return Err("Revision description cannot contain control characters".into());
    }
    Ok(RevisionCreationRequest {
        client_id,
        project_id,
        description,
    })
}

fn revision_arguments(
    project_directory: &Path,
    request: &RevisionCreationRequest,
    operation: RevisionOperation,
) -> Vec<String> {
    let mut arguments = vec![
        "revision".into(),
        "create".into(),
        "--json".into(),
        "--project".into(),
        project_directory.to_string_lossy().into_owned(),
    ];
    if let Some(description) = &request.description {
        arguments.push("--description".into());
        arguments.push(description.clone());
    }
    if matches!(operation, RevisionOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    arguments
}
