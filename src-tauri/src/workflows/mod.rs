#[path = "client_workflow.rs"]
mod client;
#[path = "delivery_workflow.rs"]
mod delivery;
#[path = "intake_workflow.rs"]
mod intake;
#[path = "revision_workflow.rs"]
mod revision;

pub(super) use delivery::run_delivery_operation;
#[cfg(test)]
pub(super) use delivery::{
    list_delivery_entries, verify_delivery_artifacts, verify_delivery_creation,
    workspace_allows_delivery_creation,
};

pub(super) use revision::{run_approval_operation, run_revision_operation};
#[cfg(test)]
pub(super) use revision::{
    verify_revision_approval, verify_revision_creation, workspace_allows_revision_approval,
    workspace_allows_revision_creation,
};

pub(super) use intake::{read_intake_report, run_intake_operation};
#[cfg(test)]
pub(super) use intake::{workspace_allows_intake_report_read, workspace_allows_intake_validation};

#[path = "studio_workflow.rs"]
mod studio;
pub(super) use studio::run_studio_operation;

pub(super) use client::run_client_operation;
#[cfg(test)]
pub(super) use client::workspace_allows_client_creation;
