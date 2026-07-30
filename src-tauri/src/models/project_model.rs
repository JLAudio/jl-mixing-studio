//! Project domain contracts: persisted project state, workspace projection, and creation workflow.

use serde::{Deserialize, Serialize};

use super::delivery_model::DeliverySummary;
use super::revision_model::{RevisionDocument, RevisionSummary};
use super::shared_model::{Audio, DeliveryMethod, Metadata};

#[derive(Debug, Deserialize)]
pub struct ProjectManifest {
    pub metadata: Metadata,
    pub project_id: String,
    pub project_name: String,
    pub artist: String,
    pub audio: Audio,
    pub delivery: DeliveryMethod,
    pub schedule: ProjectSchedule,
    pub state: ProjectState,
    pub revisions: Vec<RevisionDocument>,
}

#[derive(Debug, Deserialize)]
pub struct ProjectSchedule {
    pub deadline: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProjectState {
    pub current_revision: u32,
    pub approved_revision: Option<u32>,
    pub delivered_revision: Option<u32>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub project_id: String,
    pub project_name: String,
    pub artist: String,
    pub schema_version: String,
    pub created_with: String,
    pub created_at: String,
    pub deadline: Option<String>,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
    pub delivery_method: String,
    pub current_revision: u32,
    pub approved_revision: Option<u32>,
    pub delivered_revision: Option<u32>,
    pub delivery: Option<DeliverySummary>,
    pub revisions: Vec<RevisionSummary>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreationRequest {
    pub client_id: String,
    pub project_name: String,
    pub artist: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreationSummary {
    pub client_id: String,
    pub project_id: String,
    pub project_name: String,
    pub artist: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectOperationResult {
    pub ok: bool,
    pub code: ProjectOperationCode,
    pub message: String,
    pub project: Option<ProjectCreationSummary>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProjectOperationCode {
    Ready,
    Created,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    UnsupportedPlatform,
    WorkspaceBlocked,
    ClientUnavailable,
    Collision,
    Rejected,
    Uncertain,
    Failed,
}
