use std::collections::HashSet;
use std::io;
use std::path::Path;

use crate::automation_api::{resolve_command, ProcessRunner, SystemProcessRunner};
use crate::models::{
    DeliveryCreationPreview, DeliveryCreationRequest, DeliveryOperationCode, DeliveryOperationResult,
    DeliveryReplacementMode, ExcludedDeliveryFile, PlannedDeliveryFile,
};

pub(super) const DELIVERY_EXECUTABLE: &str = "create-delivery";

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
pub(super) enum DeliveryOperation {
    Preflight,
    Create,
}

pub(super) fn run_delivery_operation<R: ProcessRunner>(
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

    let version = super::check_version_with_runner(home, runner);
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
            &super::bounded_process_message(
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

fn normalize_delivery_request(
    request: DeliveryCreationRequest,
) -> Result<DeliveryCreationRequest, String> {
    let client_id = request.client_id.trim().to_owned();
    let project_id = request.project_id.trim().to_owned();
    if !super::is_valid_client_id(&client_id) || !super::is_valid_client_id(&project_id) {
        return Err("Select a valid project before creating a delivery".into());
    }
    if !matches!(request.replacement_mode, DeliveryReplacementMode::Clean)
        && !request.confirmed_deletions.is_empty()
    {
        return Err("Deletion confirmation is valid only for clean replacement".into());
    }
    let mut unique_deletions = HashSet::new();
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

fn delivery_arguments(
    request: &DeliveryCreationRequest,
    operation: DeliveryOperation,
) -> Vec<String> {
    let mut arguments = Vec::new();
    if matches!(request.replacement_mode, DeliveryReplacementMode::Overwrite) {
        arguments.push("--overwrite".into());
    }
    if matches!(request.replacement_mode, DeliveryReplacementMode::Clean) {
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
        "default" => DeliveryReplacementMode::Default,
        "overwrite" => DeliveryReplacementMode::Overwrite,
        "clean" => DeliveryReplacementMode::Clean,
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
    let mut unique_deletions = HashSet::new();
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
    if matches!(replacement_mode, DeliveryReplacementMode::Clean) {
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
