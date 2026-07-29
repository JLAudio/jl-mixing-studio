use crate::automation_api::{ProcessRunner, SystemProcessRunner};
use crate::models::VersionCheck;
use std::path::Path;

#[cfg(test)]
use crate::models::{
    ApprovalOperationCode, DeliveryCreationRequest, DeliveryOperationCode, IntakeOperationCode,
    IntakeRequest, RevisionApprovalRequest, RevisionCreationRequest, RevisionOperationCode,
};
#[cfg(test)]
use std::io;

mod client;
mod delivery;
mod intake;
mod project;
mod revision;
mod studio;

pub use client::{blocked_client_operation, create_client, preflight_client_creation};
#[cfg(test)]
use client::{run_client_operation, ClientOperation};
pub use delivery::{blocked_delivery_operation, create_delivery, preflight_delivery_creation};
#[cfg(test)]
use delivery::{
    parse_delivery_output, run_delivery_operation, DeliveryOperation, DELIVERY_EXECUTABLE,
};
pub use intake::{
    blocked_intake_operation, preflight_intake_validation, read_intake_report,
    run_intake_validation,
};
#[cfg(test)]
use intake::{run_intake_operation, IntakeOperation};
pub use project::{blocked_project_operation, create_project, preflight_project_creation};
#[cfg(test)]
use project::{run_project_operation, ProjectOperation};
pub use revision::{
    approve_revision, blocked_approval_operation, blocked_revision_operation, create_revision,
    preflight_revision_approval, preflight_revision_creation,
};
#[cfg(test)]
use revision::{
    run_approval_operation, run_revision_operation, ApprovalOperation, RevisionOperation,
    APPROVAL_EXECUTABLE,
};
pub use studio::{blocked_studio_operation, create_studio, preflight_studio_creation};
#[cfg(test)]
use studio::{run_studio_operation, StudioOperation, STUDIO_EXECUTABLE};

const MAX_PROCESS_MESSAGE_CHARS: usize = 1_000;

pub fn check_jl_mixing_version(home: &Path) -> VersionCheck {
    check_version_with_runner(home, &SystemProcessRunner)
}

fn is_valid_client_id(value: &str) -> bool {
    value.split('-').all(|part| {
        !part.is_empty()
            && part
                .chars()
                .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
    })
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
