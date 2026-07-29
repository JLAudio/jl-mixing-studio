#![cfg(test)]

use std::io;
use std::path::Path;

use crate::automation_api::{resolve_command, ProcessRunner};
use crate::models::{
    ApprovalOperationCode, ApprovalOperationResult, RevisionApprovalRequest,
    RevisionApprovalSummary,
};

pub(super) const APPROVAL_EXECUTABLE: &str = "approve-mix";

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
    let request = match super::revision::normalize_approval_request(request) {
        Ok(request) => request,
        Err(message) => {
            return super::revision::blocked_approval_operation(
                ApprovalOperationCode::InvalidInput,
                &message,
            )
        }
    };

    let version = super::check_version_with_runner(home, runner);
    if !version.available {
        return super::revision::blocked_approval_operation(
            ApprovalOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return super::revision::blocked_approval_operation(
            ApprovalOperationCode::UnsupportedVersion,
            &version.message,
        );
    }

    let Some(executable) = resolve_command(home, APPROVAL_EXECUTABLE) else {
        return super::revision::blocked_approval_operation(
            ApprovalOperationCode::AutomationUnavailable,
            "The JL Mixing Automation approve-mix command was not found",
        );
    };
    let arguments = approval_arguments(&request, operation);
    match runner.run(&executable, &arguments, Some(project_directory)) {
        Ok(output) if output.success => {
            let Some(approval) = parse_approval_output(&output.stdout, &request, operation) else {
                return super::revision::blocked_approval_operation(
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
        Ok(output) => super::revision::blocked_approval_operation(
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
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            super::revision::blocked_approval_operation(
                ApprovalOperationCode::AutomationUnavailable,
                "The JL Mixing Automation approve-mix command was not found",
            )
        }
        Err(_) => super::revision::blocked_approval_operation(
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
