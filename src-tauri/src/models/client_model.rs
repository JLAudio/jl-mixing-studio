//! Client domain contracts: persisted metadata, workspace projection, and creation workflow.

use serde::{Deserialize, Serialize};

use super::project_model::ProjectSummary;
use super::shared_model::Metadata;

#[derive(Debug, Deserialize)]
pub struct ClientDocument {
    #[serde(rename = "metadata")]
    pub _metadata: Metadata,
    pub client_id: String,
    pub client_name: String,
    pub defaults: ClientDefaults,
}

#[derive(Debug, Deserialize)]
pub struct ClientDefaults {
    pub artist: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientSummary {
    pub client_id: String,
    pub client_name: String,
    pub created_at: String,
    pub default_artist: String,
    pub projects: Vec<ProjectSummary>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientCreationRequest {
    pub client_id: String,
    pub client_name: String,
    pub default_artist: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientCreationSummary {
    pub client_id: String,
    pub client_name: String,
    pub default_artist: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientOperationResult {
    pub ok: bool,
    pub code: ClientOperationCode,
    pub message: String,
    pub client: Option<ClientCreationSummary>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ClientOperationCode {
    Ready,
    Created,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    UnsupportedPlatform,
    WorkspaceBlocked,
    Collision,
    Rejected,
    Failed,
}
