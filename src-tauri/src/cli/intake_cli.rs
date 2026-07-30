use std::path::Path;

use crate::automation_api::{
    invoke_api, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
};
use crate::intake as intake_report;
use crate::intake::IntakeReportError;
use crate::models::{IntakeOperationCode, IntakeOperationResult, IntakeRequest};

pub fn read_intake_report(
    project_directory: &Path,
    request: IntakeRequest,
) -> IntakeOperationResult {
    match normalize_intake_request(request) {
        Ok(request) => report_result(
            intake_report::read_report(project_directory, &request),
            false,
        ),
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

pub fn blocked_intake_operation(code: IntakeOperationCode, message: &str) -> IntakeOperationResult {
    IntakeOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        report: None,
    }
}

#[derive(Clone, Copy)]
pub(super) enum IntakeOperation {
    Preflight,
    Run,
}

pub(super) fn run_intake_operation<R: ProcessRunner>(
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

    let version = super::check_version_with_runner(home, runner);
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

            let parsed = intake_report::parse_report(report_markdown, &request);
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

fn normalize_intake_request(request: IntakeRequest) -> Result<IntakeRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    if !super::is_valid_client_id(&client_id) || !super::is_valid_client_id(&project_id) {
        return Err("Select a valid project before running intake validation".into());
    }
    Ok(IntakeRequest {
        client_id,
        project_id,
    })
}
