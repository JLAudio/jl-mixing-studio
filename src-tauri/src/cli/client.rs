use std::path::Path;

use crate::automation_api::{
    invoke_api, ApiCallError, ApiStatus, ProcessRunner, SystemProcessRunner,
};
use crate::models::{
    ClientCreationRequest, ClientCreationSummary, ClientOperationCode, ClientOperationResult,
};

use super::check_version_with_runner;

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

pub fn blocked_client_operation(code: ClientOperationCode, message: &str) -> ClientOperationResult {
    ClientOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        client: None,
    }
}

#[derive(Clone, Copy)]
pub(super) enum ClientOperation {
    Preflight,
    Create,
}

pub(super) fn run_client_operation<R: ProcessRunner>(
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
    if !version.client_creation_supported {
        return blocked_client_operation(
            ClientOperationCode::Rejected,
            "JL Mixing Automation does not advertise the client.create capability",
        );
    }

    let arguments = client_arguments(&client, operation);
    match invoke_api(home, "client.create", &arguments, Some(workspace), runner) {
        Ok(response)
            if matches!(
                (operation, response.status),
                (ClientOperation::Preflight, ApiStatus::Planned)
                    | (ClientOperation::Create, ApiStatus::Success)
            ) =>
        {
            let returned_id = response
                .data
                .get("client")
                .and_then(|value| value.get("id"))
                .and_then(|value| value.as_str());
            if returned_id != Some(client.client_id.as_str()) {
                return blocked_client_operation(
                        ClientOperationCode::Failed,
                        "JL Mixing Automation returned a client identity that did not match the request",
                    );
            }
            ClientOperationResult {
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
            }
        }
        Ok(response) => rejected_client_api_response(response, client),
        Err(ApiCallError::Unavailable) => blocked_client_operation(
            ClientOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        Err(ApiCallError::IncompatibleVersion(version)) => blocked_client_operation(
            ClientOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        Err(error) => blocked_client_operation(ClientOperationCode::Failed, &error.message()),
    }
}

fn rejected_client_api_response(
    response: crate::automation_api::ApiResponse,
    client: ClientCreationSummary,
) -> ClientOperationResult {
    let error = response.errors.first();
    let collision = error
        .map(|item| item.code == "CLIENT_ALREADY_EXISTS")
        .unwrap_or(false);
    let message = error.map(|item| item.message.clone()).unwrap_or_else(|| {
        format!(
            "JL Mixing Automation returned unexpected status {:?} for client.create",
            response.status
        )
    });
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

pub(super) fn normalize_request(
    request: ClientCreationRequest,
) -> Result<ClientCreationSummary, String> {
    let client_id = request.client_id.trim().to_owned();
    let client_name = request.client_name.trim().to_owned();
    let default_artist = request
        .default_artist
        .map(|artist| artist.trim().to_owned())
        .filter(|artist| !artist.is_empty());

    if client_id.is_empty() {
        return Err("Client ID is required".into());
    }
    if !super::is_valid_client_id(&client_id) {
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

pub(super) fn client_arguments(
    client: &ClientCreationSummary,
    operation: ClientOperation,
) -> Vec<String> {
    let mut arguments = vec![
        "client".into(),
        "create".into(),
        client.client_id.clone(),
        "--json".into(),
        "--name".into(),
        client.client_name.clone(),
    ];
    if let Some(artist) = &client.default_artist {
        arguments.push("--artist".into());
        arguments.push(artist.clone());
    }
    if matches!(operation, ClientOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    arguments
}
