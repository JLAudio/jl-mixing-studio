use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub operating_system: String,
    pub architecture: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FolderRequest {
    pub location: FolderLocation,
    pub client_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FolderLocation {
    Workspace,
    Studio,
    Client,
    Project,
    Intake,
    Revisions,
    Delivery,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FolderResult {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryNotesRequest {
    pub client_id: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryNotesUpdateRequest {
    pub client_id: String,
    pub project_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryNotesDocument {
    pub content: String,
    pub max_bytes: usize,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VersionCheck {
    pub available: bool,
    pub supported: bool,
    pub studio_creation_supported: bool,
    pub client_creation_supported: bool,
    pub project_creation_supported: bool,
    pub intake_validation_supported: bool,
    pub revision_creation_supported: bool,
    pub revision_approval_supported: bool,
    pub delivery_creation_supported: bool,
    pub version: Option<String>,
    pub message: String,
}
