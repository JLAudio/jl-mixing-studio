use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::{
    ApprovalOperationCode, ApprovalOperationResult, ClientCreationRequest, ClientCreationSummary,
    ClientOperationCode, ClientOperationResult, DeliveryCreationPreview, DeliveryCreationRequest,
    DeliveryOperationCode, DeliveryOperationResult, ExcludedDeliveryFile, IntakeOperationCode,
    IntakeOperationResult, IntakeRequest, PlannedDeliveryFile, ProjectCreationRequest,
    ProjectCreationSummary, ProjectOperationCode, ProjectOperationResult, RevisionApprovalRequest,
    RevisionApprovalSummary, RevisionCreationRequest, RevisionCreationSummary,
    RevisionOperationCode, RevisionOperationResult, VersionCheck,
};
use crate::{intake, intake::IntakeReportError};

const CLIENT_EXECUTABLE: &str = "new-client";
const PROJECT_EXECUTABLE: &str = "new-mix";
const INTAKE_EXECUTABLE: &str = "validate-intake";
const REVISION_EXECUTABLE: &str = "new-revision";
const APPROVAL_EXECUTABLE: &str = "approve-mix";
const DELIVERY_EXECUTABLE: &str = "create-delivery";
const VERSION_FILE: &str = "VERSION";
const SUPPORTED_VERSION: &str = "1.2.0";
const MAX_VERSION_FILE_BYTES: usize = 64;
const MAX_PROCESS_MESSAGE_CHARS: usize = 1_000;

pub fn check_jl_mixing_version(home: &Path) -> VersionCheck {
    check_version_with_runner(home, &SystemProcessRunner)
}

pub fn preflight_client_creation(
    home: &Path,
    workspace: &Path,
    request: ClientCreationRequest,
) -> ClientOperationResult {
    run_client_operation(
        home,
        workspace,
        request,
        ClientOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn create_client(
    home: &Path,
    workspace: &Path,
    request: ClientCreationRequest,
) -> ClientOperationResult {
    run_client_operation(
        home,
        workspace,
        request,
        ClientOperation::Create,
        &SystemProcessRunner,
    )
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

pub fn blocked_client_operation(code: ClientOperationCode, message: &str) -> ClientOperationResult {
    ClientOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        client: None,
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

trait ProcessRunner {
    fn run(
        &self,
        executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult>;
}

struct SystemProcessRunner;

impl ProcessRunner for SystemProcessRunner {
    fn run(
        &self,
        executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult> {
        let mut command = Command::new(executable);
        command.args(arguments);
        if let Some(directory) = current_directory {
            command.current_dir(directory);
        }
        let output = command.output()?;
        Ok(ProcessResult {
            success: output.status.success(),
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

#[derive(Debug)]
struct ProcessResult {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[derive(Clone, Copy)]
enum ClientOperation {
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

fn run_client_operation<R: ProcessRunner>(
    home: &Path,
    workspace: &Path,
    request: ClientCreationRequest,
    operation: ClientOperation,
    runner: &R,
) -> ClientOperationResult {
    let client = match normalize_request(request) {
        Ok(client) => client,
        Err(message) => {
            return blocked_client_operation(ClientOperationCode::InvalidInput, &message)
        }
    };

    let version = check_version_with_runner(home, runner);
    if !version.available {
        return blocked_client_operation(
            ClientOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_client_operation(ClientOperationCode::UnsupportedVersion, &version.message);
    }

    let Some(executable) = resolve_command(home, CLIENT_EXECUTABLE) else {
        return blocked_client_operation(
            ClientOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-client command was not found",
        );
    };
    let arguments = client_arguments(&client, operation);
    match runner.run(&executable, &arguments, Some(workspace)) {
        Ok(output) if output.success => ClientOperationResult {
            ok: true,
            code: match operation {
                ClientOperation::Preflight => ClientOperationCode::Ready,
                ClientOperation::Create => ClientOperationCode::Created,
            },
            message: match operation {
                ClientOperation::Preflight => "Preflight passed. No changes were made.",
                ClientOperation::Create => "Client created successfully.",
            }
            .to_owned(),
            client: Some(client),
        },
        Ok(output) => rejected_operation(output, client),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_client_operation(
            ClientOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-client command was not found",
        ),
        Err(_) => blocked_client_operation(
            ClientOperationCode::Failed,
            "The JL Mixing Automation new-client command could not be started",
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

    let Some(executable) = resolve_command(home, PROJECT_EXECUTABLE) else {
        return blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-mix command was not found",
        );
    };
    let arguments = project_arguments(&request, operation);
    match runner.run(&executable, &arguments, Some(client_directory)) {
        Ok(output) if output.success => {
            let Some(project) = parse_project_preview(&output.stdout, &request) else {
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
        Ok(output) => rejected_project_operation(output),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-mix command was not found",
        ),
        Err(_) => blocked_project_operation(
            match operation {
                ProjectOperation::Preflight => ProjectOperationCode::Failed,
                ProjectOperation::Create => ProjectOperationCode::Uncertain,
            },
            match operation {
                ProjectOperation::Preflight => {
                    "The JL Mixing Automation new-mix command could not be started"
                }
                ProjectOperation::Create => {
                    "The JL Mixing Automation new-mix result could not be confirmed. The operation may have completed."
                }
            },
        ),
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

    let Some(executable) = resolve_command(home, INTAKE_EXECUTABLE) else {
        return blocked_intake_operation(
            IntakeOperationCode::AutomationUnavailable,
            "The JL Mixing Automation validate-intake command was not found",
        );
    };
    let arguments = match operation {
        IntakeOperation::Preflight => vec!["--dry-run".to_owned()],
        IntakeOperation::Run => Vec::new(),
    };
    match runner.run(&executable, &arguments, Some(project_directory)) {
        Ok(output) if output.success || output.exit_code == Some(5) => {
            let parsed = match operation {
                IntakeOperation::Preflight => intake::parse_report(&output.stdout, &request),
                IntakeOperation::Run => intake::read_report(project_directory, &request),
            };
            let mut result = report_result(parsed, matches!(operation, IntakeOperation::Preflight));
            let expected_blocking = output.exit_code == Some(5);
            let actual_blocking = result
                .report
                .as_ref()
                .is_some_and(|report| report.blocking_errors > 0);
            if result.report.is_none() || expected_blocking != actual_blocking {
                return blocked_intake_operation(
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
                );
            }
            if matches!(operation, IntakeOperation::Run)
                && result.code == IntakeOperationCode::Validated
            {
                result.message = "Intake validation completed and the report was verified.".into();
            }
            result
        }
        Ok(output) => blocked_intake_operation(
            IntakeOperationCode::Rejected,
            &bounded_process_message(
                &output.stderr,
                &output.stdout,
                &format!(
                    "JL Mixing Automation rejected intake validation with exit code {}",
                    output
                        .exit_code
                        .map_or_else(|| "unknown".into(), |code| code.to_string())
                ),
            ),
        ),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_intake_operation(
            IntakeOperationCode::AutomationUnavailable,
            "The JL Mixing Automation validate-intake command was not found",
        ),
        Err(_) => blocked_intake_operation(
            match operation {
                IntakeOperation::Preflight => IntakeOperationCode::Failed,
                IntakeOperation::Run => IntakeOperationCode::Uncertain,
            },
            match operation {
                IntakeOperation::Preflight => {
                    "The JL Mixing Automation validate-intake command could not be started"
                }
                IntakeOperation::Run => {
                    "The intake-validation result could not be confirmed. The report may have been updated; do not retry automatically."
                }
            },
        ),
    }
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

    let Some(executable) = resolve_command(home, REVISION_EXECUTABLE) else {
        return blocked_revision_operation(
            RevisionOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-revision command was not found",
        );
    };
    let arguments = revision_arguments(&request, operation);
    match runner.run(&executable, &arguments, Some(project_directory)) {
        Ok(output) if output.success => {
            let Some(revision) = parse_revision_output(&output.stdout, &request, operation) else {
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
        Ok(output) => blocked_revision_operation(
            RevisionOperationCode::Rejected,
            &bounded_process_message(
                &output.stderr,
                &output.stdout,
                &format!(
                    "JL Mixing Automation rejected revision creation with exit code {}",
                    output
                        .exit_code
                        .map_or_else(|| "unknown".into(), |code| code.to_string())
                ),
            ),
        ),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_revision_operation(
            RevisionOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-revision command was not found",
        ),
        Err(_) => blocked_revision_operation(
            match operation {
                RevisionOperation::Preflight => RevisionOperationCode::Failed,
                RevisionOperation::Create => RevisionOperationCode::Uncertain,
            },
            match operation {
                RevisionOperation::Preflight => {
                    "The JL Mixing Automation new-revision command could not be started"
                }
                RevisionOperation::Create => {
                    "The revision-creation result could not be confirmed. The operation may have completed; do not retry automatically."
                }
            },
        ),
    }
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
    let arguments = if matches!(operation, DeliveryOperation::Preflight) {
        vec!["--dry-run".to_owned()]
    } else {
        Vec::new()
    };
    match runner.run(&executable, &arguments, Some(project_directory)) {
        Ok(output) if output.success => {
            let Some(delivery) = parse_delivery_output(&output.stdout, &request) else {
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

fn normalize_request(request: ClientCreationRequest) -> Result<ClientCreationSummary, String> {
    let client_id = request.client_id.trim().to_owned();
    let client_name = request.client_name.trim().to_owned();
    let default_artist = request
        .default_artist
        .map(|artist| artist.trim().to_owned())
        .filter(|artist| !artist.is_empty());

    if client_id.is_empty() {
        return Err("Client ID is required".into());
    }
    if !is_valid_client_id(&client_id) {
        return Err(
            "Client ID must use lowercase letters and numbers separated by single hyphens".into(),
        );
    }
    if client_name.is_empty() {
        return Err("Client name is required".into());
    }
    if client_name.chars().any(char::is_control) {
        return Err("Client name cannot contain control characters".into());
    }
    if default_artist
        .as_ref()
        .is_some_and(|artist| artist.chars().any(char::is_control))
    {
        return Err("Default artist cannot contain control characters".into());
    }

    Ok(ClientCreationSummary {
        client_id,
        client_name,
        default_artist,
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
    Ok(DeliveryCreationRequest {
        client_id,
        project_id,
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

fn client_arguments(client: &ClientCreationSummary, operation: ClientOperation) -> Vec<String> {
    let mut arguments = vec![
        client.client_id.clone(),
        "--name".into(),
        client.client_name.clone(),
    ];
    if let Some(artist) = &client.default_artist {
        arguments.push("--artist".into());
        arguments.push(artist.clone());
    }
    match operation {
        ClientOperation::Preflight => arguments.push("--dry-run".into()),
        ClientOperation::Create => arguments.push("--no-cd".into()),
    }
    arguments
}

fn project_arguments(request: &ProjectCreationRequest, operation: ProjectOperation) -> Vec<String> {
    let mut arguments = vec!["--project".into(), request.project_name.clone()];
    if let Some(artist) = &request.artist {
        arguments.push("--artist".into());
        arguments.push(artist.clone());
    }
    match operation {
        ProjectOperation::Preflight => arguments.push("--dry-run".into()),
        ProjectOperation::Create => arguments.push("--no-cd".into()),
    }
    arguments
}

fn revision_arguments(
    request: &RevisionCreationRequest,
    operation: RevisionOperation,
) -> Vec<String> {
    let mut arguments = Vec::new();
    if let Some(description) = &request.description {
        arguments.push("--description".into());
        arguments.push(description.clone());
    }
    match operation {
        RevisionOperation::Preflight => arguments.push("--dry-run".into()),
        RevisionOperation::Create => arguments.push("--no-cd".into()),
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

fn parse_project_preview(
    stdout: &str,
    request: &ProjectCreationRequest,
) -> Option<ProjectCreationSummary> {
    let field = |label: &str| {
        stdout.lines().find_map(|line| {
            let (candidate, value) = line.split_once(':')?;
            (candidate.trim() == label).then(|| value.trim().to_owned())
        })
    };
    let project_id = field("Project ID")?;
    let artist = field("Artist")?;
    if !is_valid_client_id(&project_id) || artist.is_empty() {
        return None;
    }
    Some(ProjectCreationSummary {
        client_id: request.client_id.clone(),
        project_id,
        project_name: request.project_name.clone(),
        artist,
    })
}

fn parse_revision_output(
    stdout: &str,
    request: &RevisionCreationRequest,
    operation: RevisionOperation,
) -> Option<RevisionCreationSummary> {
    let field = |label: &str| {
        stdout.lines().find_map(|line| {
            let (candidate, value) = line.split_once(':')?;
            (candidate.trim() == label).then(|| value.trim().to_owned())
        })
    };
    let number = field(match operation {
        RevisionOperation::Preflight => "New revision",
        RevisionOperation::Create => "Revision",
    })?
    .parse::<u32>()
    .ok()?;
    let description = field("Description")?;
    if number == 0
        || description.is_empty()
        || request
            .description
            .as_ref()
            .is_some_and(|expected| expected != &description)
    {
        return None;
    }
    Some(RevisionCreationSummary {
        client_id: request.client_id.clone(),
        project_id: request.project_id.clone(),
        number,
        description,
    })
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
    if project_name.is_empty()
        || current_revision == 0
        || approved_revision == 0
        || delivery_method.is_empty()
        || field("Replacement mode")?.as_str() != "default"
        || field("Create ZIP")?.as_str() != "no"
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

    Some(DeliveryCreationPreview {
        client_id: request.client_id.clone(),
        project_id: request.project_id.clone(),
        project_name,
        current_revision,
        approved_revision,
        delivered_revision,
        delivery_method,
        selected,
        excluded,
    })
}

fn rejected_operation(
    output: ProcessResult,
    client: ClientCreationSummary,
) -> ClientOperationResult {
    let fallback = format!(
        "JL Mixing Automation rejected the client request with exit code {}",
        output
            .exit_code
            .map_or_else(|| "unknown".into(), |code| code.to_string())
    );
    let message = bounded_process_message(&output.stderr, &output.stdout, &fallback);
    let normalized = message.to_ascii_lowercase();
    let collision = normalized.contains("already exists")
        || normalized.contains("already used")
        || normalized.contains("already in use")
        || normalized.contains("collision");

    ClientOperationResult {
        ok: false,
        code: if collision {
            ClientOperationCode::Collision
        } else {
            ClientOperationCode::Rejected
        },
        message,
        client: Some(client),
    }
}

fn rejected_project_operation(output: ProcessResult) -> ProjectOperationResult {
    let fallback = format!(
        "JL Mixing Automation rejected the project request with exit code {}",
        output
            .exit_code
            .map_or_else(|| "unknown".into(), |code| code.to_string())
    );
    let message = bounded_process_message(&output.stderr, &output.stdout, &fallback);
    let normalized = message.to_ascii_lowercase();
    let collision = normalized.contains("already exists")
        || normalized.contains("already used")
        || normalized.contains("already in use")
        || normalized.contains("collision");

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

fn check_version_with_runner<R: ProcessRunner>(home: &Path, runner: &R) -> VersionCheck {
    let Some(executable) = resolve_command(home, CLIENT_EXECUTABLE) else {
        return unavailable_version(
            "JL Mixing Automation was not found in its default install location or on PATH",
        );
    };
    let Some(version_file) = version_file_for_command(&executable) else {
        return unavailable_version(
            "The JL Mixing Automation installation location could not be verified",
        );
    };
    let version = match read_version_file(&version_file) {
        Ok(version) => version,
        Err(message) => return unavailable_version(message),
    };

    let arguments = vec!["--help".to_owned()];
    match runner.run(&executable, &arguments, None) {
        Ok(output) if output.success => evaluate_version(&version),
        Ok(output) => unavailable_version(&format!(
            "JL Mixing Automation health check failed with exit code {}",
            output
                .exit_code
                .map_or_else(|| "unknown".into(), |code| code.to_string())
        )),
        Err(error) => evaluate_health_check_error(error),
    }
}

fn resolve_command(home: &Path, executable: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH");
    resolve_command_with_path(home, executable, path.as_deref())
}

fn resolve_command_with_path(
    home: &Path,
    executable: &str,
    search_path: Option<&OsStr>,
) -> Option<PathBuf> {
    let default_install = home.join(".local").join("bin").join(executable);
    if default_install.is_file() {
        return Some(default_install);
    }

    search_path.and_then(|value| {
        env::split_paths(value)
            .map(|directory| directory.join(executable))
            .find(|candidate| candidate.is_file())
    })
}

fn version_file_for_command(executable: &Path) -> Option<PathBuf> {
    let bin_directory = executable.parent()?;
    if bin_directory.file_name()? != OsStr::new("bin") {
        return None;
    }
    let prefix = bin_directory.parent()?;
    Some(prefix.join("share").join("jl-mixing").join(VERSION_FILE))
}

fn read_version_file(path: &Path) -> Result<String, &'static str> {
    let bytes =
        fs::read(path).map_err(|_| "The JL Mixing Automation VERSION file could not be read")?;
    if bytes.len() > MAX_VERSION_FILE_BYTES {
        return Err("The JL Mixing Automation VERSION file is invalid");
    }
    let text = std::str::from_utf8(&bytes)
        .map_err(|_| "The JL Mixing Automation VERSION file is invalid")?;
    parse_version(text).ok_or("The JL Mixing Automation VERSION file is invalid")
}

fn evaluate_health_check_error(error: io::Error) -> VersionCheck {
    let message = if error.kind() == io::ErrorKind::NotFound {
        "JL Mixing Automation was not found in its default install location or on PATH"
    } else {
        "JL Mixing Automation could not be started"
    };
    unavailable_version(message)
}

fn evaluate_version(version: &str) -> VersionCheck {
    let supported = version == SUPPORTED_VERSION;
    VersionCheck {
        available: true,
        supported,
        client_creation_supported: supported && !cfg!(target_os = "windows"),
        project_creation_supported: supported && !cfg!(target_os = "windows"),
        intake_validation_supported: supported && !cfg!(target_os = "windows"),
        revision_creation_supported: supported && !cfg!(target_os = "windows"),
        revision_approval_supported: supported && !cfg!(target_os = "windows"),
        delivery_creation_supported: supported && !cfg!(target_os = "windows"),
        message: if supported {
            format!("JL Mixing Automation {version} detected")
        } else {
            format!(
                "JL Mixing Automation {version} detected; guided creation requires {SUPPORTED_VERSION}"
            )
        },
        version: Some(version.to_owned()),
    }
}

fn unavailable_version(message: &str) -> VersionCheck {
    VersionCheck {
        available: false,
        supported: false,
        client_creation_supported: false,
        project_creation_supported: false,
        intake_validation_supported: false,
        revision_creation_supported: false,
        revision_approval_supported: false,
        delivery_creation_supported: false,
        version: None,
        message: message.to_owned(),
    }
}

fn parse_version(input: &str) -> Option<String> {
    let version = input.trim();
    let parts: Vec<_> = version.split('.').collect();

    if parts.len() == 3
        && parts.iter().all(|part| {
            !part.is_empty() && part.chars().all(|character| character.is_ascii_digit())
        })
    {
        Some(version.to_owned())
    } else {
        None
    }
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
mod tests {
    use std::cell::RefCell;
    use std::collections::VecDeque;

    use super::*;

    #[derive(Debug, PartialEq, Eq)]
    struct Invocation {
        executable: PathBuf,
        arguments: Vec<String>,
        current_directory: Option<PathBuf>,
    }

    struct FakeRunner {
        results: RefCell<VecDeque<io::Result<ProcessResult>>>,
        invocations: RefCell<Vec<Invocation>>,
    }

    impl FakeRunner {
        fn new(results: Vec<io::Result<ProcessResult>>) -> Self {
            Self {
                results: RefCell::new(results.into()),
                invocations: RefCell::new(Vec::new()),
            }
        }
    }

    impl ProcessRunner for FakeRunner {
        fn run(
            &self,
            executable: &Path,
            arguments: &[String],
            current_directory: Option<&Path>,
        ) -> io::Result<ProcessResult> {
            self.invocations.borrow_mut().push(Invocation {
                executable: executable.to_owned(),
                arguments: arguments.to_vec(),
                current_directory: current_directory.map(Path::to_owned),
            });
            self.results
                .borrow_mut()
                .pop_front()
                .expect("a fake process result")
        }
    }

    fn success(stdout: &str) -> io::Result<ProcessResult> {
        Ok(ProcessResult {
            success: true,
            exit_code: Some(0),
            stdout: stdout.into(),
            stderr: String::new(),
        })
    }

    fn failure(code: i32, stderr: &str) -> io::Result<ProcessResult> {
        Ok(ProcessResult {
            success: false,
            exit_code: Some(code),
            stdout: String::new(),
            stderr: stderr.into(),
        })
    }

    fn completed_with_findings(stdout: &str) -> io::Result<ProcessResult> {
        Ok(ProcessResult {
            success: false,
            exit_code: Some(5),
            stdout: stdout.into(),
            stderr: String::new(),
        })
    }

    fn request(artist: Option<&str>) -> ClientCreationRequest {
        ClientCreationRequest {
            client_id: "acme-records".into(),
            client_name: " Acme Records ".into(),
            default_artist: artist.map(str::to_owned),
        }
    }

    fn project_request(artist: Option<&str>) -> ProjectCreationRequest {
        ProjectCreationRequest {
            client_id: "acme-records".into(),
            project_name: " Blue Sky ".into(),
            artist: artist.map(str::to_owned),
        }
    }

    fn project_output(project_id: &str, artist: &str) -> String {
        format!("Project: Blue Sky\nProject ID: {project_id}\nArtist: {artist}\n")
    }

    fn intake_request() -> IntakeRequest {
        IntakeRequest {
            client_id: "acme-records".into(),
            project_id: "blue-sky".into(),
        }
    }

    fn revision_request(description: Option<&str>) -> RevisionCreationRequest {
        RevisionCreationRequest {
            client_id: "acme-records".into(),
            project_id: "blue-sky".into(),
            description: description.map(str::to_owned),
        }
    }

    fn revision_output(preflight: bool, description: &str) -> String {
        let revision_label = if preflight {
            "New revision"
        } else {
            "Revision"
        };
        format!(
            "Project: Blue Sky\n{revision_label}: 3\nDescription: {description}\nRevision folder: /fixed/project/04_Revisions/Revision_03\n"
        )
    }

    fn approval_request(revision: u32, approved_by: &str) -> RevisionApprovalRequest {
        RevisionApprovalRequest {
            client_id: "acme-records".into(),
            project_id: "blue-sky".into(),
            revision,
            approved_by: approved_by.into(),
        }
    }

    fn approval_output(preflight: bool, revision: u32, approved_by: &str) -> String {
        if preflight {
            format!(
                "Dry run — no changes made.\n\nProject: Blue Sky\nCurrent revision: 3\nSelected revision: {revision}\nCurrent approved revision: 1\nApprover: {approved_by}\nApproval timestamp: current time at execution\n"
            )
        } else {
            format!(
                "Revision approved successfully.\n\nProject: Blue Sky\nApproved revision: {revision}\nApproved by: {approved_by}\nApproved at: 2026-07-18T13:00:00Z\nProject state: approved\n"
            )
        }
    }

    fn delivery_request() -> DeliveryCreationRequest {
        DeliveryCreationRequest {
            client_id: "acme-records".into(),
            project_id: "blue-sky".into(),
        }
    }

    fn delivery_output(preflight: bool) -> String {
        let heading = if preflight {
            "Dry run — no changes made."
        } else {
            "Final delivery created successfully."
        };
        let delivered = if preflight { "null" } else { "1" };
        format!(
            "{heading}\n\nProject:             Blue Sky\nCurrent revision:    2\nApproved revision:   1\nDelivered revision:  {delivered}\nDelivery method:     Download\nReplacement mode:    default\nCreate ZIP:          no\n\nSelected files:\n  Blue Sky Main Mix.wav\n    Type: main_mix\n    Destination: Blue Sky Main Mix.wav\n  Blue Sky Stems.wav\n    Type: stems\n    Destination: Stems/Blue Sky Stems.wav\n\nExcluded:\n  Revision_Notes.md    revision notes\n\nWould create:\n  Blue Sky Main Mix.wav\n  Stems/Blue Sky Stems.wav\n  Delivery_Notes.md\n  delivery-manifest.json\n"
        )
    }

    fn intake_report(blocking: bool) -> String {
        let error_count = usize::from(blocking);
        let errors = if blocking {
            "- Unreadable audio file `broken.wav`: invalid data"
        } else {
            "- None."
        };
        format!(
            r#"## Intake Summary

- Source: `/fixed/project/01_Client_Files/Original_Delivery`
- Files discovered: 1
- Blocking errors: {error_count}
- Warnings: 0
- Expected sample rate: 48000
- Expected bit depth: 24
- Enhanced inspection: unavailable

## Critical Errors

{errors}

## Duplicate Filenames

- None.

## Project-Format Mismatches

- None.

## Unsupported or Non-Audio Files

- None.

## Skipped or Unavailable Checks

- ffprobe is not installed; enhanced audio inspection was unavailable.

## Source Inventory

| File | Size (bytes) | Technical details |
|---|---:|---|
| `song.wav` | 12 | not inspected |

## Preparation Recommendations

- Review the intake report.
"#
        )
    }

    fn installed_home(version: &str) -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        let bin = home.path().join(".local/bin");
        let application = home.path().join(".local/share/jl-mixing");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::create_dir_all(&application).unwrap();
        std::fs::write(bin.join(CLIENT_EXECUTABLE), "managed launcher").unwrap();
        std::fs::write(bin.join(PROJECT_EXECUTABLE), "managed launcher").unwrap();
        std::fs::write(bin.join(INTAKE_EXECUTABLE), "managed launcher").unwrap();
        std::fs::write(bin.join(DELIVERY_EXECUTABLE), "managed launcher").unwrap();
        std::fs::write(bin.join(REVISION_EXECUTABLE), "managed launcher").unwrap();
        std::fs::write(bin.join(APPROVAL_EXECUTABLE), "managed launcher").unwrap();
        std::fs::write(application.join(VERSION_FILE), format!("{version}\n")).unwrap();
        home
    }

    #[test]
    fn accepts_only_the_released_supported_version_for_creation() {
        let supported = evaluate_version("1.2.0");
        assert!(supported.available);
        assert!(supported.supported);
        assert!(supported.intake_validation_supported);
        assert!(supported.revision_creation_supported);
        assert!(supported.revision_approval_supported);
        assert!(supported.delivery_creation_supported);

        let future = evaluate_version("1.3.0");
        assert!(future.available);
        assert!(!future.supported);
        assert!(future.message.contains("requires 1.2.0"));
    }

    #[test]
    fn rejects_unrecognized_version_output() {
        assert_eq!(parse_version("version one"), None);
        assert_eq!(parse_version("jl-mixing 1.2.0"), None);
    }

    #[test]
    fn reports_missing_executable_without_exposing_system_details() {
        let result =
            evaluate_health_check_error(io::Error::new(io::ErrorKind::NotFound, "private path"));
        assert!(!result.available);
        assert!(result
            .message
            .contains("default install location or on PATH"));
    }

    #[test]
    fn prefers_the_documented_default_install_location() {
        let home = installed_home(SUPPORTED_VERSION);
        assert_eq!(
            resolve_command_with_path(home.path(), CLIENT_EXECUTABLE, None),
            Some(home.path().join(".local/bin").join(CLIENT_EXECUTABLE))
        );
    }

    #[test]
    fn resolves_a_documented_custom_prefix_from_path() {
        let home = tempfile::tempdir().unwrap();
        let prefix = tempfile::tempdir().unwrap();
        let bin = prefix.path().join("bin");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join(CLIENT_EXECUTABLE), "managed launcher").unwrap();
        let search_path = env::join_paths([&bin]).unwrap();

        let executable = resolve_command_with_path(
            home.path(),
            CLIENT_EXECUTABLE,
            Some(search_path.as_os_str()),
        )
        .unwrap();
        assert_eq!(executable, bin.join(CLIENT_EXECUTABLE));
        assert_eq!(
            version_file_for_command(&executable),
            Some(prefix.path().join("share/jl-mixing/VERSION"))
        );
    }

    #[test]
    fn rejects_missing_or_invalid_version_metadata_without_running_a_command() {
        let home = installed_home("not-a-version");
        let runner = FakeRunner::new(Vec::new());
        let result = check_version_with_runner(home.path(), &runner);

        assert!(!result.available);
        assert!(result.message.contains("VERSION file is invalid"));
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn checks_new_client_health_after_reading_the_installed_version() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("Usage: new-client CLIENT_ID [options]")]);
        let result = check_version_with_runner(home.path(), &runner);

        assert!(result.available);
        assert!(result.supported);
        assert_eq!(result.version.as_deref(), Some(SUPPORTED_VERSION));
        assert_eq!(runner.invocations.borrow().len(), 1);
        assert_eq!(runner.invocations.borrow()[0].arguments, vec!["--help"]);
    }

    #[test]
    fn preflight_uses_dry_run_without_directory_change_flags() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("preview")]);
        let workspace = Path::new("/fixed/workspace");
        let result = run_client_operation(
            home.path(),
            workspace,
            request(Some(" The Artist ")),
            ClientOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ClientOperationCode::Ready);
        let invocations = runner.invocations.borrow();
        assert_eq!(invocations.len(), 2);
        assert_eq!(
            invocations[1].executable,
            home.path().join(".local/bin/new-client")
        );
        assert_eq!(
            invocations[1].arguments,
            vec![
                "acme-records",
                "--name",
                "Acme Records",
                "--artist",
                "The Artist",
                "--dry-run"
            ]
        );
        assert!(!invocations[1].arguments.contains(&"--no-cd".into()));
        assert_eq!(invocations[1].current_directory, Some(workspace.to_owned()));
    }

    #[test]
    fn confirmed_creation_uses_no_cd_and_omits_empty_artist() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("created")]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(Some("   ")),
            ClientOperation::Create,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ClientOperationCode::Created);
        assert_eq!(
            runner.invocations.borrow()[1].arguments,
            vec!["acme-records", "--name", "Acme Records", "--no-cd"]
        );
    }

    #[test]
    fn invalid_input_never_starts_a_process() {
        let runner = FakeRunner::new(Vec::new());
        let mut invalid = request(None);
        invalid.client_id = "Not Valid".into();
        let result = run_client_operation(
            Path::new("/home/tester"),
            Path::new("/fixed/workspace"),
            invalid,
            ClientOperation::Preflight,
            &runner,
        );
        assert_eq!(result.code, ClientOperationCode::InvalidInput);
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn unsupported_version_never_starts_new_client() {
        let home = installed_home("2.0.0");
        let runner = FakeRunner::new(vec![success("help")]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(None),
            ClientOperation::Preflight,
            &runner,
        );
        assert_eq!(result.code, ClientOperationCode::UnsupportedVersion);
        assert_eq!(runner.invocations.borrow().len(), 1);
    }

    #[test]
    fn reports_collision_from_rejected_dry_run() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            failure(4, "Client destination already exists"),
        ]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(None),
            ClientOperation::Preflight,
            &runner,
        );
        assert!(!result.ok);
        assert_eq!(result.code, ClientOperationCode::Collision);
        assert!(result.message.contains("already exists"));
    }

    #[test]
    fn reports_missing_new_client_separately() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            Err(io::Error::new(io::ErrorKind::NotFound, "missing")),
        ]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(None),
            ClientOperation::Create,
            &runner,
        );
        assert_eq!(result.code, ClientOperationCode::AutomationUnavailable);
        assert!(result.message.contains("new-client"));
    }

    #[test]
    fn project_preflight_uses_fixed_arguments_and_validated_client_directory() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            success(&project_output("blue-sky", "The Artist")),
        ]);
        let client_directory = Path::new("/fixed/workspace/Clients/Acme Records");
        let result = run_project_operation(
            home.path(),
            client_directory,
            project_request(Some(" The Artist ")),
            ProjectOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ProjectOperationCode::Ready);
        assert_eq!(
            result.project,
            Some(ProjectCreationSummary {
                client_id: "acme-records".into(),
                project_id: "blue-sky".into(),
                project_name: "Blue Sky".into(),
                artist: "The Artist".into(),
            })
        );
        let invocations = runner.invocations.borrow();
        assert_eq!(invocations.len(), 2);
        assert_eq!(
            invocations[1].executable,
            home.path().join(".local/bin/new-mix")
        );
        assert_eq!(
            invocations[1].arguments,
            vec![
                "--project",
                "Blue Sky",
                "--artist",
                "The Artist",
                "--dry-run"
            ]
        );
        assert!(!invocations[1].arguments.contains(&"--no-cd".into()));
        assert_eq!(
            invocations[1].current_directory,
            Some(client_directory.to_owned())
        );
    }

    #[test]
    fn confirmed_project_creation_uses_no_cd_and_inherits_artist() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            success(&project_output("blue-sky", "Inherited Artist")),
        ]);
        let result = run_project_operation(
            home.path(),
            Path::new("/fixed/client"),
            project_request(Some("   ")),
            ProjectOperation::Create,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ProjectOperationCode::Created);
        assert_eq!(
            runner.invocations.borrow()[1].arguments,
            vec!["--project", "Blue Sky", "--no-cd"]
        );
        assert_eq!(result.project.unwrap().artist, "Inherited Artist");
    }

    #[test]
    fn invalid_project_input_never_starts_a_process() {
        let runner = FakeRunner::new(Vec::new());
        let mut invalid = project_request(None);
        invalid.project_name = "   ".into();
        let result = run_project_operation(
            Path::new("/home/tester"),
            Path::new("/fixed/client"),
            invalid,
            ProjectOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, ProjectOperationCode::InvalidInput);
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn project_collision_is_reported_from_preflight() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            failure(4, "Project destination already exists"),
        ]);
        let result = run_project_operation(
            home.path(),
            Path::new("/fixed/client"),
            project_request(None),
            ProjectOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, ProjectOperationCode::Collision);
        assert!(result.message.contains("already exists"));
    }

    #[test]
    fn successful_creation_without_identity_is_uncertain() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("Project created")]);
        let result = run_project_operation(
            home.path(),
            Path::new("/fixed/client"),
            project_request(None),
            ProjectOperation::Create,
            &runner,
        );

        assert_eq!(result.code, ProjectOperationCode::Uncertain);
        assert!(result.message.contains("may have completed"));
    }

    #[test]
    fn revision_preflight_uses_description_and_dry_run_from_validated_project() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            success(&revision_output(true, "Vocal lift")),
        ]);
        let project_directory = Path::new("/fixed/project");
        let result = run_revision_operation(
            home.path(),
            project_directory,
            revision_request(Some(" Vocal lift ")),
            RevisionOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, RevisionOperationCode::Ready);
        assert_eq!(result.revision.unwrap().number, 3);
        let invocations = runner.invocations.borrow();
        assert_eq!(
            invocations[1].executable,
            home.path().join(".local/bin/new-revision")
        );
        assert_eq!(
            invocations[1].arguments,
            vec!["--description", "Vocal lift", "--dry-run"]
        );
        assert_eq!(
            invocations[1].current_directory,
            Some(project_directory.to_owned())
        );
    }

    #[test]
    fn confirmed_revision_creation_uses_no_cd_and_automation_default_description() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            success(&revision_output(false, "Revision 3")),
        ]);
        let result = run_revision_operation(
            home.path(),
            Path::new("/fixed/project"),
            revision_request(Some("   ")),
            RevisionOperation::Create,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, RevisionOperationCode::Created);
        assert_eq!(runner.invocations.borrow()[1].arguments, vec!["--no-cd"]);
        assert_eq!(result.revision.unwrap().description, "Revision 3");
    }

    #[test]
    fn invalid_revision_input_never_starts_a_process() {
        let runner = FakeRunner::new(Vec::new());
        let result = run_revision_operation(
            Path::new("/home/tester"),
            Path::new("/fixed/project"),
            revision_request(Some("unsafe\nvalue")),
            RevisionOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, RevisionOperationCode::InvalidInput);
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn successful_revision_creation_without_identity_is_uncertain() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("Revision created")]);
        let result = run_revision_operation(
            home.path(),
            Path::new("/fixed/project"),
            revision_request(None),
            RevisionOperation::Create,
            &runner,
        );

        assert_eq!(result.code, RevisionOperationCode::Uncertain);
        assert!(result.message.contains("do not retry automatically"));
    }

    #[test]
    fn revision_rejection_preserves_the_bounded_automation_message() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            failure(4, "Revision destination already exists"),
        ]);
        let result = run_revision_operation(
            home.path(),
            Path::new("/fixed/project"),
            revision_request(None),
            RevisionOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, RevisionOperationCode::Rejected);
        assert!(result.message.contains("already exists"));
    }

    #[test]
    fn approval_preflight_uses_only_selected_revision_approver_and_dry_run() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            success(&approval_output(true, 2, "Client Reviewer")),
        ]);
        let project_directory = Path::new("/fixed/project");
        let result = run_approval_operation(
            home.path(),
            project_directory,
            approval_request(2, " Client Reviewer "),
            ApprovalOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ApprovalOperationCode::Ready);
        let approval = result.approval.unwrap();
        assert_eq!(approval.revision, 2);
        assert_eq!(approval.approved_by, "Client Reviewer");
        assert_eq!(approval.approved_at, None);
        let invocations = runner.invocations.borrow();
        assert_eq!(
            invocations[1].executable,
            home.path().join(".local/bin/approve-mix")
        );
        assert_eq!(
            invocations[1].arguments,
            vec![
                "--revision",
                "2",
                "--approved-by",
                "Client Reviewer",
                "--dry-run"
            ]
        );
        assert_eq!(
            invocations[1].current_directory,
            Some(project_directory.to_owned())
        );
    }

    #[test]
    fn confirmed_approval_parses_automation_timestamp_without_date_override() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            success(&approval_output(false, 2, "Client")),
        ]);
        let result = run_approval_operation(
            home.path(),
            Path::new("/fixed/project"),
            approval_request(2, "Client"),
            ApprovalOperation::Approve,
            &runner,
        );

        assert_eq!(result.code, ApprovalOperationCode::Approved);
        assert_eq!(
            runner.invocations.borrow()[1].arguments,
            vec!["--revision", "2", "--approved-by", "Client"]
        );
        assert_eq!(
            result.approval.unwrap().approved_at.as_deref(),
            Some("2026-07-18T13:00:00Z")
        );
    }

    #[test]
    fn invalid_approval_input_never_starts_a_process() {
        let runner = FakeRunner::new(Vec::new());
        let result = run_approval_operation(
            Path::new("/home/tester"),
            Path::new("/fixed/project"),
            approval_request(0, "Client"),
            ApprovalOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, ApprovalOperationCode::InvalidInput);
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn successful_approval_without_identity_is_uncertain() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("Revision approved")]);
        let result = run_approval_operation(
            home.path(),
            Path::new("/fixed/project"),
            approval_request(2, "Client"),
            ApprovalOperation::Approve,
            &runner,
        );

        assert_eq!(result.code, ApprovalOperationCode::Uncertain);
        assert!(result.message.contains("do not retry automatically"));
    }

    #[test]
    fn approval_rejection_preserves_the_bounded_automation_message() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            failure(5, "Revision 2 is already the approved revision"),
        ]);
        let result = run_approval_operation(
            home.path(),
            Path::new("/fixed/project"),
            approval_request(2, "Client"),
            ApprovalOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, ApprovalOperationCode::Rejected);
        assert!(result.message.contains("already the approved revision"));
    }

    #[test]
    fn delivery_preflight_uses_only_dry_run_from_the_validated_project() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success(&delivery_output(true))]);
        let project_directory = Path::new("/fixed/project");
        let result = run_delivery_operation(
            home.path(),
            project_directory,
            delivery_request(),
            DeliveryOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, DeliveryOperationCode::Ready);
        let delivery = result.delivery.unwrap();
        assert_eq!(delivery.approved_revision, 1);
        assert_eq!(delivery.delivered_revision, None);
        assert_eq!(delivery.selected.len(), 2);
        assert_eq!(delivery.selected[1].path, "Stems/Blue Sky Stems.wav");
        assert_eq!(delivery.excluded[0].reason, "revision notes");
        let invocations = runner.invocations.borrow();
        assert_eq!(invocations[1].arguments, vec!["--dry-run"]);
        assert_eq!(
            invocations[1].current_directory,
            Some(project_directory.to_owned())
        );
    }

    #[test]
    fn confirmed_delivery_creation_uses_no_arguments() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success(&delivery_output(false))]);
        let result = run_delivery_operation(
            home.path(),
            Path::new("/fixed/project"),
            delivery_request(),
            DeliveryOperation::Create,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, DeliveryOperationCode::Created);
        assert_eq!(result.delivery.unwrap().delivered_revision, Some(1));
        assert!(runner.invocations.borrow()[1].arguments.is_empty());
    }

    #[test]
    fn invalid_delivery_identity_never_starts_a_process() {
        let runner = FakeRunner::new(Vec::new());
        let mut request = delivery_request();
        request.project_id = "Not Valid".into();
        let result = run_delivery_operation(
            Path::new("/home/tester"),
            Path::new("/fixed/project"),
            request,
            DeliveryOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, DeliveryOperationCode::InvalidInput);
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn unverifiable_confirmed_delivery_is_uncertain() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("created")]);
        let result = run_delivery_operation(
            home.path(),
            Path::new("/fixed/project"),
            delivery_request(),
            DeliveryOperation::Create,
            &runner,
        );

        assert_eq!(result.code, DeliveryOperationCode::Uncertain);
        assert!(result.message.contains("do not retry automatically"));
    }

    #[test]
    fn delivery_rejection_preserves_the_bounded_automation_message() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            failure(5, "No deliverable files were found after applying filters"),
        ]);
        let result = run_delivery_operation(
            home.path(),
            Path::new("/fixed/project"),
            delivery_request(),
            DeliveryOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, DeliveryOperationCode::Rejected);
        assert!(result.message.contains("No deliverable files"));
    }

    #[test]
    fn intake_preflight_uses_only_dry_run_from_the_validated_project() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success(&intake_report(false))]);
        let project_directory = Path::new("/fixed/project");
        let result = run_intake_operation(
            home.path(),
            project_directory,
            intake_request(),
            IntakeOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, IntakeOperationCode::Ready);
        let invocations = runner.invocations.borrow();
        assert_eq!(
            invocations[1].executable,
            home.path().join(".local/bin/validate-intake")
        );
        assert_eq!(invocations[1].arguments, vec!["--dry-run"]);
        assert_eq!(
            invocations[1].current_directory,
            Some(project_directory.into())
        );
    }

    #[test]
    fn intake_exit_five_is_a_completed_preview_with_blocking_findings() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            completed_with_findings(&intake_report(true)),
        ]);
        let result = run_intake_operation(
            home.path(),
            Path::new("/fixed/project"),
            intake_request(),
            IntakeOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, IntakeOperationCode::BlockingFindings);
        assert_eq!(result.report.unwrap().blocking_errors, 1);
    }

    #[test]
    fn confirmed_intake_run_has_no_arguments_and_verifies_the_report_from_disk() {
        let home = installed_home(SUPPORTED_VERSION);
        let project = tempfile::tempdir().unwrap();
        let admin = project.path().join("00_Admin");
        std::fs::create_dir_all(&admin).unwrap();
        std::fs::write(
            admin.join("Intake_Report.md"),
            format!(
                "# Intake Report\n\n<!-- BEGIN AUTOMATED SECTION -->\n{}<!-- END AUTOMATED SECTION -->\n",
                intake_report(false)
            ),
        )
        .unwrap();
        let runner = FakeRunner::new(vec![
            success("help"),
            success("Intake validation completed"),
        ]);
        let result = run_intake_operation(
            home.path(),
            project.path(),
            intake_request(),
            IntakeOperation::Run,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, IntakeOperationCode::Validated);
        assert!(runner.invocations.borrow()[1].arguments.is_empty());
        assert_eq!(
            runner.invocations.borrow()[1].current_directory,
            Some(project.path().into())
        );
    }

    #[test]
    fn invalid_intake_identity_never_starts_a_process() {
        let runner = FakeRunner::new(Vec::new());
        let mut invalid = intake_request();
        invalid.project_id = "../unsafe".into();
        let result = run_intake_operation(
            Path::new("/home/tester"),
            Path::new("/fixed/project"),
            invalid,
            IntakeOperation::Preflight,
            &runner,
        );

        assert_eq!(result.code, IntakeOperationCode::InvalidInput);
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn unverifiable_confirmed_intake_result_is_uncertain() {
        let home = installed_home(SUPPORTED_VERSION);
        let project = tempfile::tempdir().unwrap();
        let runner = FakeRunner::new(vec![success("help"), success("completed")]);
        let result = run_intake_operation(
            home.path(),
            project.path(),
            intake_request(),
            IntakeOperation::Run,
            &runner,
        );

        assert_eq!(result.code, IntakeOperationCode::Uncertain);
        assert!(result.message.contains("Do not retry automatically"));
    }

    #[test]
    fn bounds_process_error_output() {
        let message = "x".repeat(MAX_PROCESS_MESSAGE_CHARS + 20);
        let result = rejected_operation(
            failure(1, &message).unwrap(),
            ClientCreationSummary {
                client_id: "acme".into(),
                client_name: "Acme".into(),
                default_artist: None,
            },
        );
        assert_eq!(result.message.chars().count(), MAX_PROCESS_MESSAGE_CHARS);
    }
}
