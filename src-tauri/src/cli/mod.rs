use crate::automation_api::{
    invoke_api, resolve_command, ApiCallError, ApiStatus, ProcessResult, ProcessRunner,
    SystemProcessRunner,
};
use crate::models::{
    ApprovalOperationCode, ApprovalOperationResult, DeliveryCreationPreview,
    DeliveryCreationRequest, DeliveryOperationCode, DeliveryOperationResult, ExcludedDeliveryFile,
    IntakeOperationCode, IntakeOperationResult, IntakeRequest, PlannedDeliveryFile,
    ProjectCreationRequest, ProjectCreationSummary, ProjectOperationCode, ProjectOperationResult,
    RevisionApprovalRequest, RevisionApprovalSummary, RevisionCreationRequest,
    RevisionCreationSummary, RevisionOperationCode, RevisionOperationResult, StudioCreationRequest,
    StudioCreationSummary, StudioOperationCode, StudioOperationResult, VersionCheck,
};
use crate::{intake, intake::IntakeReportError};
use std::io;
use std::path::Path;

mod client;
pub use client::{blocked_client_operation, create_client, preflight_client_creation};
#[cfg(test)]
use client::{run_client_operation, ClientOperation};

const STUDIO_EXECUTABLE: &str = "new-studio";
const APPROVAL_EXECUTABLE: &str = "approve-mix";
const DELIVERY_EXECUTABLE: &str = "create-delivery";
const MAX_PROCESS_MESSAGE_CHARS: usize = 1_000;

pub fn check_jl_mixing_version(home: &Path) -> VersionCheck {
    check_version_with_runner(home, &SystemProcessRunner)
}

pub fn preflight_studio_creation(
    home: &Path,
    request: StudioCreationRequest,
) -> StudioOperationResult {
    run_studio_operation(
        home,
        request,
        StudioOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn create_studio(home: &Path, request: StudioCreationRequest) -> StudioOperationResult {
    run_studio_operation(home, request, StudioOperation::Create, &SystemProcessRunner)
}

pub fn preflight_project_creation(
    home: &Path,
    client_directory: &Path,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(
        home,
        client_directory,
        request,
        ProjectOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn create_project(
    home: &Path,
    client_directory: &Path,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(
        home,
        client_directory,
        request,
        ProjectOperation::Create,
        &SystemProcessRunner,
    )
}

pub fn read_intake_report(
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    match normalize_intake_request(request) {
        Ok(request) => report_result(intake::read_report(project_directory, &request), false),
        Err(message) => blocked_intake_operation(IntakeOperationCode::InvalidInput, &message),
    }
}

pub fn preflight_intake_validation(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(
        home,
        project_directory,
        request,
        IntakeOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn run_intake_validation(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(
        home,
        project_directory,
        request,
        IntakeOperation::Run,
        &SystemProcessRunner,
    )
}

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

pub fn preflight_delivery_creation(
    home: &Path,
    project_directory: &Path,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(
        home,
        project_directory,
        request,
        DeliveryOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn create_delivery(
    home: &Path,
    project_directory: &Path,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(
        home,
        project_directory,
        request,
        DeliveryOperation::Create,
        &SystemProcessRunner,
    )
}

pub fn blocked_studio_operation(code: StudioOperationCode, message: &str) -> StudioOperationResult {
    StudioOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        studio: None,
    }
}

pub fn blocked_project_operation(
    code: ProjectOperationCode,
    message: &str,
) -> ProjectOperationResult {
    ProjectOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        project: None,
    }
}

pub fn blocked_intake_operation(code: IntakeOperationCode, message: &str) -> IntakeOperationResult {
    IntakeOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        report: None,
    }
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

pub fn blocked_delivery_operation(
    code: DeliveryOperationCode,
    message: &str,
) -> DeliveryOperationResult {
    DeliveryOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        delivery: None,
    }
}

#[derive(Clone, Copy)]
enum StudioOperation {
    Preflight,
    Create,
}

#[derive(Clone, Copy)]
enum ProjectOperation {
    Preflight,
    Create,
}

#[derive(Clone, Copy)]
enum IntakeOperation {
    Preflight,
    Run,
}

#[derive(Clone, Copy)]
enum RevisionOperation {
    Preflight,
    Create,
}

#[derive(Clone, Copy)]
enum ApprovalOperation {
    Preflight,
    Approve,
}

#[derive(Clone, Copy)]
enum DeliveryOperation {
    Preflight,
    Create,
}

fn run_studio_operation<R: ProcessRunner>(
    home: &Path,
    request: StudioCreationRequest,
    operation: StudioOperation,
    runner: &R,
) -> StudioOperationResult {
    let studio = match normalize_studio_request(request) {
        Ok(studio) => studio,
        Err(message) => {
            return blocked_studio_operation(StudioOperationCode::InvalidInput, &message)
        }
    };
    let version = check_version_with_runner(home, runner);
    if !version.available {
        return blocked_studio_operation(
            StudioOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_studio_operation(StudioOperationCode::UnsupportedVersion, &version.message);
    }
    let Some(executable) = resolve_command(home, STUDIO_EXECUTABLE) else {
        return blocked_studio_operation(
            StudioOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-studio command was not found",
        );
    };
    let arguments = studio_arguments(&studio, operation);
    match runner.run(&executable, &arguments, Some(home)) {
        Ok(output) if output.success => StudioOperationResult {
            ok: true,
            code: match operation {
                StudioOperation::Preflight => StudioOperationCode::Ready,
                StudioOperation::Create => StudioOperationCode::Created,
            },
            message: match operation {
                StudioOperation::Preflight => "Preflight passed. No changes were made.",
                StudioOperation::Create => "Studio workspace created successfully.",
            }
            .to_owned(),
            studio: Some(studio),
        },
        Ok(output) => rejected_studio_operation(output, studio),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_studio_operation(
            StudioOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-studio command was not found",
        ),
        Err(_) => blocked_studio_operation(
            match operation {
                StudioOperation::Preflight => StudioOperationCode::Failed,
                StudioOperation::Create => StudioOperationCode::Uncertain,
            },
            match operation {
                StudioOperation::Preflight => {
                    "The JL Mixing Automation new-studio command could not be started"
                }
                StudioOperation::Create => {
                    "The studio creation result could not be confirmed. The operation may have completed; do not retry automatically."
                }
            },
        ),
    }
}

fn run_project_operation<R: ProcessRunner>(
    home: &Path,
    client_directory: &Path,
    request: ProjectCreationRequest,
    operation: ProjectOperation,
    runner: &R,
) -> ProjectOperationResult {
    let request = match normalize_project_request(request) {
        Ok(request) => request,
        Err(message) => {
            return blocked_project_operation(ProjectOperationCode::InvalidInput, &message)
        }
    };

    let version = check_version_with_runner(home, runner);
    if !version.available {
        return blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_project_operation(
            ProjectOperationCode::UnsupportedVersion,
            &version.message,
        );
    }
    if !version.project_creation_supported {
        return blocked_project_operation(
            ProjectOperationCode::Rejected,
            "JL Mixing Automation does not advertise the project.create effective-artist capability required by Studio",
        );
    }

    let arguments = project_arguments(&request, operation);
    match invoke_api(
        home,
        "project.create",
        &arguments,
        Some(client_directory),
        runner,
    ) {
        Ok(response)
            if matches!(
                (operation, response.status),
                (ProjectOperation::Preflight, ApiStatus::Planned)
                    | (ProjectOperation::Create, ApiStatus::Success)
            ) =>
        {
            let Some(project) = project_summary_from_api(&response.data, &request) else {
                return blocked_project_operation(
                    match operation {
                        ProjectOperation::Preflight => ProjectOperationCode::Failed,
                        ProjectOperation::Create => ProjectOperationCode::Uncertain,
                    },
                    match operation {
                        ProjectOperation::Preflight => {
                            "The JL Mixing Automation project preview could not be verified"
                        }
                        ProjectOperation::Create => {
                            "JL Mixing Automation reported success, but the created project identity could not be verified. The operation may have completed."
                        }
                    },
                );
            };
            ProjectOperationResult {
                ok: true,
                code: match operation {
                    ProjectOperation::Preflight => ProjectOperationCode::Ready,
                    ProjectOperation::Create => ProjectOperationCode::Created,
                },
                message: match operation {
                    ProjectOperation::Preflight => "Preflight passed. No changes were made.",
                    ProjectOperation::Create => "Project created successfully.",
                }
                .to_owned(),
                project: Some(project),
            }
        }
        Ok(response) => rejected_project_api_response(response),
        Err(ApiCallError::Unavailable) => blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        Err(ApiCallError::IncompatibleVersion(version)) => blocked_project_operation(
            ProjectOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        Err(error) => blocked_project_operation(
            match operation {
                ProjectOperation::Preflight => ProjectOperationCode::Failed,
                ProjectOperation::Create => ProjectOperationCode::Uncertain,
            },
            &error.message(),
        ),
    }
}

fn project_summary_from_api(
    data: &serde_json::Value,
    request: &ProjectCreationRequest,
) -> Option<ProjectCreationSummary> {
    let project = data.get("project")?;
    let project_id = project.get("id")?.as_str()?;
    let project_name = project.get("name")?.as_str()?;
    let artist = project.get("artist")?.as_str()?;
    let client_id = data.get("client")?.get("id")?.as_str()?;

    if !is_valid_client_id(project_id)
        || project_name != request.project_name
        || artist.trim().is_empty()
        || client_id != request.client_id
    {
        return None;
    }

    Some(ProjectCreationSummary {
        client_id: request.client_id.clone(),
        project_id: project_id.to_owned(),
        project_name: request.project_name.clone(),
        artist: artist.to_owned(),
    })
}

fn rejected_project_api_response(
    response: crate::automation_api::ApiResponse,
) -> ProjectOperationResult {
    let error = response.errors.first();
    let collision = error
        .map(|item| item.code == "PROJECT_ALREADY_EXISTS")
        .unwrap_or(false);
    let message = error.map(|item| item.message.clone()).unwrap_or_else(|| {
        format!(
            "JL Mixing Automation returned unexpected status {:?} for project.create",
            response.status
        )
    });
    ProjectOperationResult {
        ok: false,
        code: if collision {
            ProjectOperationCode::Collision
        } else {
            ProjectOperationCode::Rejected
        },
        message,
        project: None,
    }
}

fn run_intake_operation<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    request: IntakeRequest,
    operation: IntakeOperation,
    runner: &R,
) -> IntakeOperationResult {
    let request = match normalize_intake_request(request) {
        Ok(request) => request,
        Err(message) => {
            return blocked_intake_operation(IntakeOperationCode::InvalidInput, &message)
        }
    };

    let version = check_version_with_runner(home, runner);
    if !version.available {
        return blocked_intake_operation(
            IntakeOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_intake_operation(IntakeOperationCode::UnsupportedVersion, &version.message);
    }
    if !version.intake_validation_supported {
        return blocked_intake_operation(
            IntakeOperationCode::Rejected,
            "JL Mixing Automation does not advertise the intake.validate report capability required by Studio",
        );
    }

    let arguments = intake_arguments(project_directory, operation);
    match invoke_api(
        home,
        "intake.validate",
        &arguments,
        Some(project_directory),
        runner,
    ) {
        Ok(response) => {
            let completed_with_findings = response.status == ApiStatus::Blocked
                && response
                    .errors
                    .first()
                    .is_some_and(|error| error.code == "INTAKE_BLOCKING_FINDINGS");
            let completed = matches!(
                (operation, response.status),
                (IntakeOperation::Preflight, ApiStatus::Planned)
                    | (IntakeOperation::Run, ApiStatus::Success)
            ) || completed_with_findings;

            if !completed {
                let message = response
                    .errors
                    .first()
                    .map(|error| error.message.clone())
                    .unwrap_or_else(|| {
                        format!(
                            "JL Mixing Automation returned unexpected status {:?} for intake.validate",
                            response.status
                        )
                    });
                return blocked_intake_operation(IntakeOperationCode::Rejected, &message);
            }

            let Some(report_markdown) = response
                .data
                .get("report_markdown")
                .and_then(|value| value.as_str())
            else {
                return unverifiable_intake_result(operation);
            };

            let parsed = intake::parse_report(report_markdown, &request);
            let mut result = report_result(parsed, matches!(operation, IntakeOperation::Preflight));
            let Some(report) = result.report.as_ref() else {
                return unverifiable_intake_result(operation);
            };

            let returned_project_id = response
                .data
                .get("project")
                .and_then(|value| value.get("id"))
                .and_then(|value| value.as_str());
            let summary = response.data.get("summary");
            let files_discovered = summary
                .and_then(|value| value.get("files_discovered"))
                .and_then(|value| value.as_u64());
            let blocking_errors = summary
                .and_then(|value| value.get("blocking_errors"))
                .and_then(|value| value.as_u64());
            let warnings = summary
                .and_then(|value| value.get("warnings"))
                .and_then(|value| value.as_u64());

            let blocking_matches = completed_with_findings == (report.blocking_errors > 0);
            let summary_matches = returned_project_id == Some(request.project_id.as_str())
                && files_discovered == Some(report.files_discovered as u64)
                && blocking_errors == Some(report.blocking_errors as u64)
                && warnings == Some(report.warnings as u64);

            if !blocking_matches || !summary_matches {
                return unverifiable_intake_result(operation);
            }

            if matches!(operation, IntakeOperation::Run)
                && result.code == IntakeOperationCode::Validated
            {
                result.message = "Intake validation completed and the report was verified.".into();
            }
            result
        }
        Err(ApiCallError::Unavailable) => blocked_intake_operation(
            IntakeOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        Err(ApiCallError::IncompatibleVersion(version)) => blocked_intake_operation(
            IntakeOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        Err(error) => blocked_intake_operation(
            match operation {
                IntakeOperation::Preflight => IntakeOperationCode::Failed,
                IntakeOperation::Run => IntakeOperationCode::Uncertain,
            },
            &error.message(),
        ),
    }
}

fn intake_arguments(project_directory: &Path, operation: IntakeOperation) -> Vec<String> {
    let mut arguments = vec![
        "intake".into(),
        "validate".into(),
        "--json".into(),
        "--project".into(),
        project_directory.to_string_lossy().into_owned(),
    ];
    if matches!(operation, IntakeOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    arguments
}

fn unverifiable_intake_result(operation: IntakeOperation) -> IntakeOperationResult {
    blocked_intake_operation(
        match operation {
            IntakeOperation::Preflight => IntakeOperationCode::Failed,
            IntakeOperation::Run => IntakeOperationCode::Uncertain,
        },
        match operation {
            IntakeOperation::Preflight => {
                "The JL Mixing Automation intake preview could not be verified"
            }
            IntakeOperation::Run => {
                "Intake validation may have updated the report, but the authoritative result could not be verified. Do not retry automatically."
            }
        },
    )
}

fn run_revision_operation<R: ProcessRunner>(
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

    let version = check_version_with_runner(home, runner);
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

fn run_approval_operation<R: ProcessRunner>(
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

    let version = check_version_with_runner(home, runner);
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
            &bounded_process_message(
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

fn run_delivery_operation<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    request: DeliveryCreationRequest,
    operation: DeliveryOperation,
    runner: &R,
) -> DeliveryOperationResult {
    let request = match normalize_delivery_request(request) {
        Ok(request) => request,
        Err(message) => {
            return blocked_delivery_operation(DeliveryOperationCode::InvalidInput, &message)
        }
    };

    let version = check_version_with_runner(home, runner);
    if !version.available {
        return blocked_delivery_operation(
            DeliveryOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_delivery_operation(
            DeliveryOperationCode::UnsupportedVersion,
            &version.message,
        );
    }

    let Some(executable) = resolve_command(home, DELIVERY_EXECUTABLE) else {
        return blocked_delivery_operation(
            DeliveryOperationCode::AutomationUnavailable,
            "The JL Mixing Automation create-delivery command was not found",
        );
    };
    let arguments = delivery_arguments(&request, operation);
    match runner.run(&executable, &arguments, Some(project_directory)) {
        Ok(output) if output.success => {
            let Some(delivery) = parse_delivery_output(&output.stdout, &request, operation) else {
                return blocked_delivery_operation(
                    match operation {
                        DeliveryOperation::Preflight => DeliveryOperationCode::Failed,
                        DeliveryOperation::Create => DeliveryOperationCode::Uncertain,
                    },
                    match operation {
                        DeliveryOperation::Preflight => {
                            "The JL Mixing Automation delivery preview could not be verified"
                        }
                        DeliveryOperation::Create => {
                            "JL Mixing Automation reported success, but the delivery result could not be verified. The operation may have completed; do not retry automatically."
                        }
                    },
                );
            };
            DeliveryOperationResult {
                ok: true,
                code: match operation {
                    DeliveryOperation::Preflight => DeliveryOperationCode::Ready,
                    DeliveryOperation::Create => DeliveryOperationCode::Created,
                },
                message: match operation {
                    DeliveryOperation::Preflight => {
                        "Delivery preview completed. No changes were made."
                    }
                    DeliveryOperation::Create => "Delivery package created successfully.",
                }
                .to_owned(),
                delivery: Some(delivery),
            }
        }
        Ok(output) => blocked_delivery_operation(
            DeliveryOperationCode::Rejected,
            &bounded_process_message(
                &output.stderr,
                &output.stdout,
                &format!(
                    "JL Mixing Automation rejected delivery creation with exit code {}",
                    output
                        .exit_code
                        .map_or_else(|| "unknown".into(), |code| code.to_string())
                ),
            ),
        ),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_delivery_operation(
            DeliveryOperationCode::AutomationUnavailable,
            "The JL Mixing Automation create-delivery command was not found",
        ),
        Err(_) => blocked_delivery_operation(
            match operation {
                DeliveryOperation::Preflight => DeliveryOperationCode::Failed,
                DeliveryOperation::Create => DeliveryOperationCode::Uncertain,
            },
            match operation {
                DeliveryOperation::Preflight => {
                    "The JL Mixing Automation create-delivery command could not be started"
                }
                DeliveryOperation::Create => {
                    "The delivery-creation result could not be confirmed. The operation may have completed; do not retry automatically."
                }
            },
        ),
    }
}

fn report_result(
    report: Result<Option<crate::models::IntakeReport>, IntakeReportError>,
    preview: bool,
) -> IntakeOperationResult {
    match report {
        Ok(Some(report)) => {
            let blocking = report.blocking_errors > 0;
            IntakeOperationResult {
                ok: true,
                code: if blocking {
                    IntakeOperationCode::BlockingFindings
                } else if preview {
                    IntakeOperationCode::Ready
                } else {
                    IntakeOperationCode::Validated
                },
                message: if blocking {
                    "Intake validation completed with blocking findings."
                } else if preview {
                    "Intake preview completed. No changes were made."
                } else {
                    "The authoritative intake report was loaded."
                }
                .to_owned(),
                report: Some(report),
            }
        }
        Ok(None) => IntakeOperationResult {
            ok: true,
            code: IntakeOperationCode::NotRun,
            message: "No intake validation has been run for this project.".into(),
            report: None,
        },
        Err(IntakeReportError::Missing | IntakeReportError::Unsafe) => blocked_intake_operation(
            IntakeOperationCode::ReportUnavailable,
            "The authoritative intake report is missing or unsafe",
        ),
        Err(IntakeReportError::TooLarge | IntakeReportError::Invalid) => blocked_intake_operation(
            IntakeOperationCode::ReportUnavailable,
            "The authoritative intake report could not be parsed safely",
        ),
    }
}

fn normalize_studio_request(
    request: StudioCreationRequest,
) -> Result<StudioCreationSummary, String> {
    let studio_name = request.studio_name.trim().to_owned();
    let mix_engineer = request
        .mix_engineer
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let file_format = request.file_format.trim().to_ascii_uppercase();
    if studio_name.is_empty() {
        return Err("Studio name is required".into());
    }
    if studio_name.chars().any(char::is_control)
        || mix_engineer
            .as_ref()
            .is_some_and(|value| value.chars().any(char::is_control))
    {
        return Err("Studio identity cannot contain control characters".into());
    }
    if ![44_100, 48_000, 88_200, 96_000, 176_400, 192_000].contains(&request.sample_rate) {
        return Err("Select a supported sample rate".into());
    }
    if ![16, 24, 32].contains(&request.bit_depth) {
        return Err("Select a supported bit depth".into());
    }
    if !matches!(file_format.as_str(), "WAV" | "AIFF") {
        return Err("Select WAV or AIFF as the file format".into());
    }
    Ok(StudioCreationSummary {
        studio_name,
        mix_engineer,
        sample_rate: request.sample_rate,
        bit_depth: request.bit_depth,
        file_format,
    })
}

fn normalize_project_request(
    request: ProjectCreationRequest,
) -> Result<ProjectCreationRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_name = request.project_name.trim().to_owned();
    let artist = request
        .artist
        .map(|artist| artist.trim().to_owned())
        .filter(|artist| !artist.is_empty());

    if client_id.is_empty() || !is_valid_client_id(&client_id) {
        return Err("Select a valid client before creating a project".into());
    }
    if project_name.is_empty() {
        return Err("Project name is required".into());
    }
    if project_name.chars().any(char::is_control) {
        return Err("Project name cannot contain control characters".into());
    }
    if artist
        .as_ref()
        .is_some_and(|value| value.chars().any(char::is_control))
    {
        return Err("Artist cannot contain control characters".into());
    }

    Ok(ProjectCreationRequest {
        client_id,
        project_name,
        artist,
    })
}

fn normalize_intake_request(request: IntakeRequest) -> Result<IntakeRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    if !is_valid_client_id(&client_id) || !is_valid_client_id(&project_id) {
        return Err("Select a valid project before running intake validation".into());
    }
    Ok(IntakeRequest {
        client_id,
        project_id,
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
    if !is_valid_client_id(&client_id) || !is_valid_client_id(&project_id) {
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

fn normalize_approval_request(
    request: RevisionApprovalRequest,
) -> Result<RevisionApprovalRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    let approved_by = request.approved_by.trim().to_owned();
    if !is_valid_client_id(&client_id) || !is_valid_client_id(&project_id) {
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

fn normalize_delivery_request(
    request: DeliveryCreationRequest,
) -> Result<DeliveryCreationRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    if !is_valid_client_id(&client_id) || !is_valid_client_id(&project_id) {
        return Err("Select a valid project before creating a delivery".into());
    }
    if !matches!(
        request.replacement_mode,
        crate::models::DeliveryReplacementMode::Clean
    ) && !request.confirmed_deletions.is_empty()
    {
        return Err("Deletion confirmation is valid only for clean replacement".into());
    }
    let mut unique_deletions = std::collections::HashSet::new();
    if request.confirmed_deletions.len() > 10_000
        || request.confirmed_deletions.iter().any(|path| {
            !is_safe_delivery_relative_path(path) || !unique_deletions.insert(path.clone())
        })
    {
        return Err("The confirmed clean-deletion inventory is invalid".into());
    }
    Ok(DeliveryCreationRequest {
        client_id,
        project_id,
        replacement_mode: request.replacement_mode,
        create_zip: request.create_zip,
        confirmed_deletions: request.confirmed_deletions,
    })
}

fn is_valid_client_id(value: &str) -> bool {
    value.split('-').all(|part| {
        !part.is_empty()
            && part
                .chars()
                .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
    })
}

fn studio_arguments(studio: &StudioCreationSummary, operation: StudioOperation) -> Vec<String> {
    let mut arguments = vec!["--name".into(), studio.studio_name.clone()];
    if let Some(engineer) = &studio.mix_engineer {
        arguments.push("--engineer".into());
        arguments.push(engineer.clone());
    }
    arguments.extend([
        "--sample-rate".into(),
        studio.sample_rate.to_string(),
        "--bit-depth".into(),
        studio.bit_depth.to_string(),
        "--file-format".into(),
        studio.file_format.clone(),
    ]);
    arguments.push(
        match operation {
            StudioOperation::Preflight => "--dry-run",
            StudioOperation::Create => "--no-default-cd",
        }
        .into(),
    );
    arguments
}

fn project_arguments(request: &ProjectCreationRequest, operation: ProjectOperation) -> Vec<String> {
    let mut arguments = vec![
        "project".into(),
        "create".into(),
        request.project_name.clone(),
        "--json".into(),
    ];
    if let Some(artist) = &request.artist {
        arguments.push("--artist".into());
        arguments.push(artist.clone());
    }
    if matches!(operation, ProjectOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    arguments
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

fn delivery_arguments(
    request: &DeliveryCreationRequest,
    operation: DeliveryOperation,
) -> Vec<String> {
    let mut arguments = Vec::new();
    if matches!(
        request.replacement_mode,
        crate::models::DeliveryReplacementMode::Overwrite
    ) {
        arguments.push("--overwrite".into());
    }
    if matches!(
        request.replacement_mode,
        crate::models::DeliveryReplacementMode::Clean
    ) {
        arguments.push("--clean".into());
    }
    if request.create_zip {
        arguments.push("--zip".into());
    }
    if matches!(operation, DeliveryOperation::Preflight) {
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

fn parse_delivery_output(
    stdout: &str,
    request: &DeliveryCreationRequest,
    operation: DeliveryOperation,
) -> Option<DeliveryCreationPreview> {
    let field = |label: &str| {
        stdout.lines().find_map(|line| {
            let (candidate, value) = line.split_once(':')?;
            (candidate.trim() == label).then(|| value.trim().to_owned())
        })
    };
    let project_name = field("Project")?;
    let current_revision = field("Current revision")?.parse::<u32>().ok()?;
    let approved_revision = field("Approved revision")?.parse::<u32>().ok()?;
    let delivered_value = field("Delivered revision")?;
    let delivered_revision = if delivered_value == "null" {
        None
    } else {
        Some(delivered_value.parse::<u32>().ok()?)
    };
    let delivery_method = field("Delivery method")?;
    let replacement_mode = match field("Replacement mode")?.as_str() {
        "default" => crate::models::DeliveryReplacementMode::Default,
        "overwrite" => crate::models::DeliveryReplacementMode::Overwrite,
        "clean" => crate::models::DeliveryReplacementMode::Clean,
        _ => return None,
    };
    let create_zip = match field("Create ZIP")?.as_str() {
        "yes" => true,
        "no" => false,
        _ => return None,
    };
    let zip_name = match (create_zip, operation) {
        (true, DeliveryOperation::Create) => {
            let name = field("ZIP")?;
            is_expected_delivery_zip_name(&name, &request.project_id, approved_revision)
                .then_some(name)
        }
        _ => None,
    };
    if create_zip && matches!(operation, DeliveryOperation::Create) && zip_name.is_none() {
        return None;
    }
    if project_name.is_empty()
        || current_revision == 0
        || approved_revision == 0
        || delivery_method.is_empty()
        || replacement_mode != request.replacement_mode
        || create_zip != request.create_zip
    {
        return None;
    }

    let lines: Vec<_> = stdout.lines().collect();
    let selected_start = lines
        .iter()
        .position(|line| line.trim() == "Selected files:")?
        + 1;
    let mut selected = Vec::new();
    let mut index = selected_start;
    while index < lines.len() && !lines[index].trim().is_empty() {
        let source_line = lines[index];
        if !source_line.starts_with("  ") || source_line.starts_with("    ") {
            return None;
        }
        let source_name = source_line.trim().to_owned();
        let deliverable_type = lines
            .get(index + 1)?
            .trim()
            .strip_prefix("Type: ")?
            .to_owned();
        let path = lines
            .get(index + 2)?
            .trim()
            .strip_prefix("Destination: ")?
            .to_owned();
        if source_name.is_empty() || deliverable_type.is_empty() || path.is_empty() {
            return None;
        }
        selected.push(PlannedDeliveryFile {
            source_name,
            deliverable_type,
            path,
        });
        index += 3;
    }
    if selected.is_empty() {
        return None;
    }

    let mut excluded = Vec::new();
    if let Some(excluded_start) = lines
        .iter()
        .position(|line| line.trim() == "Excluded:")
        .map(|position| position + 1)
    {
        for line in lines.iter().skip(excluded_start) {
            if line.trim().is_empty() {
                break;
            }
            let (name, reason) = line.trim().rsplit_once("    ")?;
            if name.is_empty() || reason.is_empty() {
                return None;
            }
            excluded.push(ExcludedDeliveryFile {
                name: name.to_owned(),
                reason: reason.to_owned(),
            });
        }
    }

    let mut deletions = Vec::new();
    let mut unique_deletions = std::collections::HashSet::new();
    if let Some(deletions_start) = lines
        .iter()
        .position(|line| line.trim() == "Would delete from 05_Final_Delivery/:")
        .map(|position| position + 1)
    {
        for line in lines.iter().skip(deletions_start) {
            if line.trim().is_empty() {
                break;
            }
            let path = line.trim();
            if !is_safe_delivery_relative_path(path)
                || deletions.len() >= 10_000
                || !unique_deletions.insert(path.to_owned())
            {
                return None;
            }
            deletions.push(path.to_owned());
        }
    }
    if matches!(
        replacement_mode,
        crate::models::DeliveryReplacementMode::Clean
    ) {
        if deletions.is_empty() {
            deletions = request.confirmed_deletions.clone();
        }
        if deletions.is_empty() {
            return None;
        }
    } else if !deletions.is_empty() || !request.confirmed_deletions.is_empty() {
        return None;
    }

    Some(DeliveryCreationPreview {
        client_id: request.client_id.clone(),
        project_id: request.project_id.clone(),
        project_name,
        current_revision,
        approved_revision,
        delivered_revision,
        delivery_method,
        replacement_mode,
        create_zip,
        zip_name,
        selected,
        excluded,
        deletions,
    })
}

fn is_expected_delivery_zip_name(value: &str, project_id: &str, revision: u32) -> bool {
    let prefix = format!("{project_id}-rev-{revision:02}-");
    let Some(timestamp) = value
        .strip_prefix(&prefix)
        .and_then(|name| name.strip_suffix(".zip"))
    else {
        return false;
    };
    timestamp.len() == 14 && timestamp.bytes().all(|byte| byte.is_ascii_digit())
}

fn is_safe_delivery_relative_path(value: &str) -> bool {
    let value = value.strip_suffix('/').unwrap_or(value);
    !value.is_empty()
        && value.len() <= 4_096
        && !value.starts_with('/')
        && !value.contains('\\')
        && value
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

fn rejected_studio_operation(
    output: ProcessResult,
    studio: StudioCreationSummary,
) -> StudioOperationResult {
    let fallback = format!(
        "JL Mixing Automation rejected the studio request with exit code {}",
        output
            .exit_code
            .map_or_else(|| "unknown".into(), |code| code.to_string())
    );
    StudioOperationResult {
        ok: false,
        code: StudioOperationCode::Rejected,
        message: bounded_process_message(&output.stderr, &output.stdout, &fallback),
        studio: Some(studio),
    }
}

fn check_version_with_runner<R: ProcessRunner>(home: &Path, runner: &R) -> VersionCheck {
    crate::automation_api::check_automation_compatibility(home, runner)
}

fn bounded_process_message(stderr: &str, stdout: &str, fallback: &str) -> String {
    let source = if !stderr.trim().is_empty() {
        stderr
    } else if !stdout.trim().is_empty() {
        stdout
    } else {
        fallback
    };
    let filtered: String = source
        .trim()
        .chars()
        .filter(|character| !character.is_control() || *character == '\n' || *character == '\t')
        .take(MAX_PROCESS_MESSAGE_CHARS)
        .collect();
    if filtered.is_empty() {
        fallback.to_owned()
    } else {
        filtered
    }
}

#[cfg(test)]
mod tests;
