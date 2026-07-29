use std::collections::HashSet;
use std::path::Path;

use crate::automation_api::{
    invoke_api, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
};
use crate::models::{
    DeliveryCreationPreview, DeliveryCreationRequest, DeliveryOperationCode,
    DeliveryOperationResult, DeliveryReplacementMode, ExcludedDeliveryFile, PlannedDeliveryFile,
};

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
    if !version.delivery_creation_supported {
        return blocked_delivery_operation(
            DeliveryOperationCode::Rejected,
            "JL Mixing Automation does not advertise the delivery.create capability required by Studio",
        );
    }

    if matches!(operation, DeliveryOperation::Create)
        && matches!(request.replacement_mode, DeliveryReplacementMode::Clean)
    {
        if let Err(result) = verify_clean_confirmation(home, project_directory, &request, runner) {
            return *result;
        }
    }

    invoke_delivery_api(home, project_directory, &request, operation, runner)
}

fn verify_clean_confirmation<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    request: &DeliveryCreationRequest,
    runner: &R,
) -> Result<(), Box<DeliveryOperationResult>> {
    if request.confirmed_deletions.is_empty() {
        return Err(Box::new(blocked_delivery_operation(
            DeliveryOperationCode::InvalidInput,
            "Confirm the clean-deletion inventory before creating the delivery",
        )));
    }

    let arguments = delivery_arguments(project_directory, request, DeliveryOperation::Preflight);
    match invoke_api(
        home,
        "delivery.create",
        &arguments,
        Some(project_directory),
        runner,
    ) {
        Ok(response) if response.status == ApiStatus::Planned => {
            let Some(preview) =
                delivery_preview_from_api(&response.data, request, DeliveryOperation::Preflight)
            else {
                return Err(Box::new(blocked_delivery_operation(
                    DeliveryOperationCode::Failed,
                    "The JL Mixing Automation clean-delivery preview could not be verified",
                )));
            };
            if preview.deletions != request.confirmed_deletions {
                return Err(Box::new(blocked_delivery_operation(
                    DeliveryOperationCode::Rejected,
                    "The clean-deletion inventory changed after confirmation. Review the delivery preview again before continuing.",
                )));
            }
            Ok(())
        }
        Ok(response) => Err(Box::new(provider_rejection(
            &response,
            "JL Mixing Automation rejected the clean-delivery verification",
        ))),
        Err(error) => Err(Box::new(api_error_result(
            error,
            DeliveryOperation::Preflight,
        ))),
    }
}

fn invoke_delivery_api<R: ProcessRunner>(
    home: &Path,
    project_directory: &Path,
    request: &DeliveryCreationRequest,
    operation: DeliveryOperation,
    runner: &R,
) -> DeliveryOperationResult {
    let arguments = delivery_arguments(project_directory, request, operation);
    match invoke_api(
        home,
        "delivery.create",
        &arguments,
        Some(project_directory),
        runner,
    ) {
        Ok(response)
            if matches!(
                (operation, response.status),
                (DeliveryOperation::Preflight, ApiStatus::Planned)
                    | (DeliveryOperation::Create, ApiStatus::Success)
            ) =>
        {
            let Some(delivery) = delivery_preview_from_api(&response.data, request, operation)
            else {
                return unverifiable_delivery_result(operation);
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
        Ok(response) => provider_rejection(
            &response,
            "JL Mixing Automation returned an unexpected delivery.create result",
        ),
        Err(error) => api_error_result(error, operation),
    }
}

fn provider_rejection(
    response: &crate::automation_api::ApiResponse,
    fallback: &str,
) -> DeliveryOperationResult {
    blocked_delivery_operation(
        DeliveryOperationCode::Rejected,
        &response
            .errors
            .first()
            .map(|error| error.message.clone())
            .unwrap_or_else(|| fallback.to_owned()),
    )
}

fn api_error_result(error: ApiCallError, operation: DeliveryOperation) -> DeliveryOperationResult {
    match error {
        ApiCallError::Unavailable => blocked_delivery_operation(
            DeliveryOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        ApiCallError::IncompatibleVersion(version) => blocked_delivery_operation(
            DeliveryOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        error => blocked_delivery_operation(
            match operation {
                DeliveryOperation::Preflight => DeliveryOperationCode::Failed,
                DeliveryOperation::Create => DeliveryOperationCode::Uncertain,
            },
            &error.message(),
        ),
    }
}

fn unverifiable_delivery_result(operation: DeliveryOperation) -> DeliveryOperationResult {
    blocked_delivery_operation(
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
    )
}

fn delivery_preview_from_api(
    data: &serde_json::Value,
    request: &DeliveryCreationRequest,
    operation: DeliveryOperation,
) -> Option<DeliveryCreationPreview> {
    let project = data.get("project")?;
    let project_id = project.get("id")?.as_str()?;
    let project_name = project.get("name")?.as_str()?.trim();
    let revision = data.get("revision")?;
    let revision_number = as_revision(revision.get("number")?)?;
    let current_revision = as_revision(data.get("current_revision")?)?;
    let approved_revision = as_revision(data.get("approved_revision")?)?;
    let delivered_revision = optional_revision(data.get("delivered_revision")?)?;
    let delivery_method = data.get("delivery_method")?.as_str()?.trim();
    let replacement_mode = replacement_mode_from_api(data.get("replacement_mode")?.as_str()?)?;
    let create_zip = data.get("zip_requested")?.as_bool()?;
    let provider_zip_name = optional_string(data.get("zip_name")?)?;

    if project_id != request.project_id
        || project_name.is_empty()
        || delivery_method.is_empty()
        || revision_number != approved_revision
        || replacement_mode != request.replacement_mode
        || create_zip != request.create_zip
        || matches!(operation, DeliveryOperation::Create)
            && delivered_revision != Some(approved_revision)
    {
        return None;
    }

    if create_zip {
        let name = provider_zip_name.as_deref()?;
        if !is_expected_delivery_zip_name(name, &request.project_id, approved_revision) {
            return None;
        }
    } else if provider_zip_name.is_some() {
        return None;
    }

    let selected = parse_selected(data.get("selected")?)?;
    if selected.is_empty() {
        return None;
    }
    let excluded = parse_excluded(data.get("excluded")?)?;
    let deletions = parse_deletions(data.get("deletions")?)?;

    if matches!(replacement_mode, DeliveryReplacementMode::Clean) {
        if matches!(operation, DeliveryOperation::Create)
            && deletions != request.confirmed_deletions
        {
            return None;
        }
    } else if !deletions.is_empty() || !request.confirmed_deletions.is_empty() {
        return None;
    }

    Some(DeliveryCreationPreview {
        client_id: request.client_id.clone(),
        project_id: request.project_id.clone(),
        project_name: project_name.to_owned(),
        current_revision,
        approved_revision,
        delivered_revision,
        delivery_method: delivery_method.to_owned(),
        replacement_mode,
        create_zip,
        zip_name: if matches!(operation, DeliveryOperation::Create) {
            provider_zip_name
        } else {
            None
        },
        selected,
        excluded,
        deletions,
    })
}

fn parse_selected(value: &serde_json::Value) -> Option<Vec<PlannedDeliveryFile>> {
    value
        .as_array()?
        .iter()
        .map(|item| {
            let source_name = item.get("source_name")?.as_str()?.trim();
            let deliverable_type = item.get("deliverable_type")?.as_str()?.trim();
            let path = item.get("path")?.as_str()?.trim();
            if source_name.is_empty() || deliverable_type.is_empty() || path.is_empty() {
                return None;
            }
            Some(PlannedDeliveryFile {
                source_name: source_name.to_owned(),
                deliverable_type: deliverable_type.to_owned(),
                path: path.to_owned(),
            })
        })
        .collect()
}

fn parse_excluded(value: &serde_json::Value) -> Option<Vec<ExcludedDeliveryFile>> {
    value
        .as_array()?
        .iter()
        .map(|item| {
            let name = item.get("name")?.as_str()?.trim();
            let reason = item.get("reason")?.as_str()?.trim();
            if name.is_empty() || reason.is_empty() {
                return None;
            }
            Some(ExcludedDeliveryFile {
                name: name.to_owned(),
                reason: reason.to_owned(),
            })
        })
        .collect()
}

fn parse_deletions(value: &serde_json::Value) -> Option<Vec<String>> {
    let values = value.as_array()?;
    if values.len() > 10_000 {
        return None;
    }
    let mut unique = HashSet::new();
    values
        .iter()
        .map(|value| {
            let path = value.as_str()?;
            if !is_safe_delivery_relative_path(path) || !unique.insert(path.to_owned()) {
                return None;
            }
            Some(path.to_owned())
        })
        .collect()
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
    project_directory: &Path,
    request: &DeliveryCreationRequest,
    operation: DeliveryOperation,
) -> Vec<String> {
    let mut arguments = vec![
        "delivery".into(),
        "create".into(),
        "--json".into(),
        "--project".into(),
        project_directory.to_string_lossy().into_owned(),
    ];
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

fn replacement_mode_from_api(value: &str) -> Option<DeliveryReplacementMode> {
    match value {
        "default" => Some(DeliveryReplacementMode::Default),
        "overwrite" => Some(DeliveryReplacementMode::Overwrite),
        "clean" => Some(DeliveryReplacementMode::Clean),
        _ => None,
    }
}

fn as_revision(value: &serde_json::Value) -> Option<u32> {
    let value = value.as_u64()?;
    (value > 0 && value <= u32::MAX as u64).then_some(value as u32)
}

fn optional_revision(value: &serde_json::Value) -> Option<Option<u32>> {
    if value.is_null() {
        Some(None)
    } else {
        as_revision(value).map(Some)
    }
}

fn optional_string(value: &serde_json::Value) -> Option<Option<String>> {
    if value.is_null() {
        Some(None)
    } else {
        let value = value.as_str()?.trim();
        (!value.is_empty()).then(|| Some(value.to_owned()))
    }
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
