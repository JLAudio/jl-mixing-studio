mod automation_api;
mod cli;
mod commands;
mod derived;
mod intake;
mod models;
mod workflows;
mod workspace;

use commands::{
    discover_default_workspace, get_delivery_notes, get_jl_mixing_version, get_system_info,
    open_folder, resolve_folder, update_delivery_notes,
};
pub(crate) use commands::{find_project_summary, resolve_home, validated_project_directory};
#[cfg(test)]
use commands::{
    intake_directory, read_delivery_notes, write_delivery_notes, DELIVERY_NOTES_MAX_BYTES,
};
use models::{
    ApprovalOperationResult, ClientCreationRequest, ClientOperationResult, DeliveryCreationRequest,
    DeliveryOperationResult, IntakeOperationResult, IntakeRequest, ProjectCreationRequest,
    ProjectOperationResult, RevisionApprovalRequest, RevisionCreationRequest,
    RevisionOperationResult, StudioCreationRequest, StudioOperationResult,
};
#[cfg(test)]
use models::{
    DeliveryCreationPreview, DeliveryReplacementMode, ProjectSummary, RevisionApprovalSummary,
    RevisionCreationSummary, WorkspaceStatus,
};
#[cfg(test)]
use workflows::{
    list_delivery_entries, verify_delivery_artifacts, verify_delivery_creation,
    verify_revision_approval, verify_revision_creation, workspace_allows_client_creation,
    workspace_allows_delivery_creation, workspace_allows_intake_report_read,
    workspace_allows_intake_validation, workspace_allows_project_creation,
    workspace_allows_revision_approval, workspace_allows_revision_creation,
};
use workflows::{
    read_intake_report, run_approval_operation, run_client_operation, run_delivery_operation,
    run_intake_operation, run_project_operation, run_revision_operation, run_studio_operation,
};

#[tauri::command]
fn preflight_studio_creation(
    app: tauri::AppHandle,
    request: StudioCreationRequest,
) -> StudioOperationResult {
    run_studio_operation(&app, request, cli::preflight_studio_creation, false)
}

#[tauri::command]
fn create_studio(app: tauri::AppHandle, request: StudioCreationRequest) -> StudioOperationResult {
    run_studio_operation(&app, request, cli::create_studio, true)
}

#[tauri::command]
fn preflight_client_creation(
    app: tauri::AppHandle,
    request: ClientCreationRequest,
) -> ClientOperationResult {
    run_client_operation(&app, request, cli::preflight_client_creation)
}

#[tauri::command]
fn create_client(app: tauri::AppHandle, request: ClientCreationRequest) -> ClientOperationResult {
    run_client_operation(&app, request, cli::create_client)
}

#[tauri::command]
fn preflight_project_creation(
    app: tauri::AppHandle,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(&app, request, cli::preflight_project_creation)
}

#[tauri::command]
fn create_project(
    app: tauri::AppHandle,
    request: ProjectCreationRequest,
) -> ProjectOperationResult {
    run_project_operation(&app, request, cli::create_project)
}

#[tauri::command]
fn get_intake_report(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {
    read_intake_report(app, request)
}

#[tauri::command]
fn preflight_intake_validation(
    app: tauri::AppHandle,
    request: IntakeRequest,
) -> IntakeOperationResult {
    run_intake_operation(&app, request, cli::preflight_intake_validation)
}

#[tauri::command]
fn run_intake_validation(app: tauri::AppHandle, request: IntakeRequest) -> IntakeOperationResult {
    run_intake_operation(&app, request, cli::run_intake_validation)
}

#[tauri::command]
fn preflight_revision_creation(
    app: tauri::AppHandle,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(&app, request, cli::preflight_revision_creation, false)
}

#[tauri::command]
fn create_revision(
    app: tauri::AppHandle,
    request: RevisionCreationRequest,
) -> RevisionOperationResult {
    run_revision_operation(&app, request, cli::create_revision, true)
}

#[tauri::command]
fn preflight_revision_approval(
    app: tauri::AppHandle,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(&app, request, cli::preflight_revision_approval, false)
}

#[tauri::command]
fn approve_revision(
    app: tauri::AppHandle,
    request: RevisionApprovalRequest,
) -> ApprovalOperationResult {
    run_approval_operation(&app, request, cli::approve_revision, true)
}

#[tauri::command]
fn preflight_delivery_creation(
    app: tauri::AppHandle,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(&app, request, cli::preflight_delivery_creation, false)
}

#[tauri::command]
fn create_delivery(
    app: tauri::AppHandle,
    request: DeliveryCreationRequest,
) -> DeliveryOperationResult {
    run_delivery_operation(&app, request, cli::create_delivery, true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_jl_mixing_version,
            discover_default_workspace,
            resolve_folder,
            open_folder,
            get_delivery_notes,
            update_delivery_notes,
            preflight_studio_creation,
            create_studio,
            preflight_client_creation,
            create_client,
            preflight_project_creation,
            create_project,
            get_intake_report,
            preflight_intake_validation,
            run_intake_validation,
            preflight_revision_creation,
            create_revision,
            preflight_revision_approval,
            approve_revision,
            preflight_delivery_creation,
            create_delivery,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
