//! Revision domain contracts: persisted history, workspace projection, creation, and approval.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct RevisionDocument {
    pub number: u32,
    pub revision_id: String,
    pub created_at: String,
    pub description: String,
    pub approval: RevisionApproval,
}

#[derive(Debug, Deserialize)]
pub struct RevisionApproval {
    pub approved_at: Option<String>,
    pub approved_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionSummary {
    pub number: u32,
    pub revision_id: String,
    pub created_at: String,
    pub description: String,
    pub approved_at: Option<String>,
    pub approved_by: Option<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionCreationRequest {
    pub client_id: String,
    pub project_id: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionCreationSummary {
    pub client_id: String,
    pub project_id: String,
    pub number: u32,
    pub description: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionOperationResult {
    pub ok: bool,
    pub code: RevisionOperationCode,
    pub message: String,
    pub revision: Option<RevisionCreationSummary>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RevisionOperationCode {
    Ready,
    Created,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    UnsupportedPlatform,
    WorkspaceBlocked,
    ProjectUnavailable,
    Rejected,
    Uncertain,
    Failed,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionApprovalRequest {
    pub client_id: String,
    pub project_id: String,
    pub revision: u32,
    pub approved_by: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevisionApprovalSummary {
    pub client_id: String,
    pub project_id: String,
    pub revision: u32,
    pub approved_by: String,
    pub approved_at: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalOperationResult {
    pub ok: bool,
    pub code: ApprovalOperationCode,
    pub message: String,
    pub approval: Option<RevisionApprovalSummary>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalOperationCode {
    Ready,
    Approved,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    UnsupportedPlatform,
    WorkspaceBlocked,
    ProjectUnavailable,
    RevisionUnavailable,
    AlreadyApproved,
    Rejected,
    Uncertain,
    Failed,
}
