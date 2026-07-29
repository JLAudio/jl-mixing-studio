use std::io;
use std::path::Path;

use crate::automation_api::{resolve_command, ProcessResult, ProcessRunner, SystemProcessRunner};
use crate::models::{
    StudioCreationRequest, StudioCreationSummary, StudioOperationCode, StudioOperationResult,
};

pub(super) const STUDIO_EXECUTABLE: &str = "new-studio";

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

pub fn blocked_studio_operation(code: StudioOperationCode, message: &str) -> StudioOperationResult {
    StudioOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        studio: None,
    }
}

#[derive(Clone, Copy)]
pub(super) enum StudioOperation {
    Preflight,
    Create,
}

pub(super) fn run_studio_operation<R: ProcessRunner>(
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
    let version = super::check_version_with_runner(home, runner);
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
        message: super::bounded_process_message(&output.stderr, &output.stdout, &fallback),
        studio: Some(studio),
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
