use std::io;
use std::path::Path;

use crate::automation_api::{
    invoke_api, resolve_command, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
};
use crate::models::{
    ApprovalOperationCode, ApprovalOperationResult, RevisionApprovalRequest, RevisionApprovalSummary,
    RevisionCreationRequest, RevisionCreationSummary, RevisionOperationCode, RevisionOperationResult,
};

pub(super) const APPROVAL_EXECUTABLE: &str = "approve-mix";

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

pub fn preflight_revision_approval(
    home: &Path,
    project_directory: &Path,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(
        home,
        project_directory,
        request,
        ApprovalOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn approve_revision(
    home: &Path,
    project_directory: &Path,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(
        home,
        project_directory,
        request,
        ApprovalOperation::Approve,
        &SystemProcessRunner,
    )
}

pub fn blocked_approval_operation(
    code: ApprovalOperationCode,
    message: &str,
) -> ApprovalOperationResult {
    ApprovalOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        approval: None,
    }
}

#[derive(Clone, Copy)]
pub(super) enum ApprovalOperation {
    Preflight,
    Approve,
}

pub(super) fn run_approval_operation<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    request: RevisionApprovalRequest,
    operation: ApprovalOperation,
    runner: &R,
) -> ApprovalOperationResult {
    let request = match normalize_approval_request(request) {
        Ok(request) => request,
        Err(message) => {
            return blocked_approval_operation(ApprovalOperationCode::InvalidInput, &message)
        }
    };

    let version = super::check_version_with_runner(home, runner);
    if !version.available {
        return blocked_approval_operation(
            ApprovalOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_approval_operation(
            ApprovalOperationCode::UnsupportedVersion,
            &version.message,
        );
    }

    let Some(executable) = resolve_command(home, APPROVAL_EXECUTABLE) else {
        return blocked_approval_operation(
            ApprovalOperationCode::AutomationUnavailable,
            "The JL Mixing Automation approve-mix command was not found",
        );
    };
    let arguments = approval_arguments(&request, operation);
    match runner.run(&executable, &arguments, Some(project_directory)) {
        Ok(output) if output.success => {
            let Some(approval) = parse_approval_output(&output.stdout, &request, operation) else {
                return blocked_approval_operation(
                    match operation {
                        ApprovalOperation::Preflight => ApprovalOperationCode::Failed,
                        ApprovalOperation::Approve => ApprovalOperationCode::Uncertain,
                    },
                    match operation {
                        ApprovalOperation::Preflight => {
                            "The JL Mixing Automation approval preview could not be verified"
                        }
                        ApprovalOperation::Approve => {
                            "JL Mixing Automation reported success, but the approval identity could not be verified. The operation may have completed; do not retry automatically."
                        }
                    },
                );
            };
            ApprovalOperationResult {
                ok: true,
                code: match operation {
                    ApprovalOperation::Preflight => ApprovalOperationCode::Ready,
                    ApprovalOperation::Approve => ApprovalOperationCode::Approved,
                },
                message: match operation {
                    ApprovalOperation::Preflight => {
                        "Approval preview completed. No changes were made."
                    }
                    ApprovalOperation::Approve => "Revision approved successfully.",
                }
                .to_owned(),
                approval: Some(approval),
            }
        }
        Ok(output) => blocked_approval_operation(
            ApprovalOperationCode::Rejected,
            &super::bounded_process_message(
                &output.stderr,
                &output.stdout,
                &format!(
                    "JL Mixing Automation rejected revision approval with exit code {}",
                    output
                        .exit_code
                        .map_or_else(|| "unknown".into(), |code| code.to_string())
                ),
            ),
        ),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_approval_operation(
            ApprovalOperationCode::AutomationUnavailable,
            "The JL Mixing Automation approve-mix command was not found",
        ),
        Err(_) => blocked_approval_operation(
            match operation {
                ApprovalOperation::Preflight => ApprovalOperationCode::Failed,
                ApprovalOperation::Approve => ApprovalOperationCode::Uncertain,
            },
            match operation {
                ApprovalOperation::Preflight => {
                    "The JL Mixing Automation approve-mix command could not be started"
                }
                ApprovalOperation::Approve => {
                    "The revision-approval result could not be confirmed. The operation may have completed; do not retry automatically."
                }
            },
        ),
    }
}

fn normalize_approval_request(
    request: RevisionApprovalRequest,
) -> Result<RevisionApprovalRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let approved_by = request.approved_by.trim().to_owned();
    if !super::is_valid_client_id(&client_id) || !super::is_valid_client_id(&project_id) {
        return Err("Select a valid project before approving a revision".into());
    }
    if request.revision == 0 {
        return Err("Select a valid revision to approve".into());
    }
    if approved_by.is_empty() {
        return Err("Enter the approver identity".into());
    }
    if approved_by.chars().any(char::is_control) {
        return Err("Approver identity cannot contain control characters".into());
    }
    Ok(RevisionApprovalRequest {
        client_id,
        project_id,
        revision: request.revision,
        approved_by,
    })
}

fn approval_arguments(
    request: &RevisionApprovalRequest,
    operation: ApprovalOperation,
) -> Vec<String> {
    let mut arguments = vec![
        "--revision".into(),
        request.revision.to_string(),
        "--approved-by".into(),
        request.approved_by.clone(),
    ];
    if matches!(operation, ApprovalOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    arguments
}

fn parse_approval_output(
    stdout: &str,
    request: &RevisionApprovalRequest,
    operation: ApprovalOperation,
) -> Option<RevisionApprovalSummary> {
    let field = |label: &str| {
        stdout.lines().find_map(|line| {
            let (candidate, value) = line.split_once(':')?;
            (candidate.trim() == label).then(|| value.trim().to_owned())
        })
    };
    let revision = field(match operation {
        ApprovalOperation::Preflight => "Selected revision",
        ApprovalOperation::Approve => "Approved revision",
    })?
    .parse::<u32>()
    .ok()?;
    let approved_by = field(match operation {
        ApprovalOperation::Preflight => "Approver",
        ApprovalOperation::Approve => "Approved by",
    })?;
    let approved_at = match operation {
        ApprovalOperation::Preflight => None,
        ApprovalOperation::Approve => Some(field("Approved at")?),
    };
    if revision != request.revision
        || approved_by != request.approved_by
        || approved_at.as_ref().is_some_and(|value| value.is_empty())
    {
        return None;
    }
    Some(RevisionApprovalSummary {
        client_id: request.client_id.clone(),
        project_id: request.project_id.clone(),
        revision,
        approved_by,
        approved_at,
    })
}
