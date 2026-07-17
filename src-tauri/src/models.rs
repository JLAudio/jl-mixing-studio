use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub operating_system: String,
    pub architecture: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VersionCheck {
    pub available: bool,
    pub version: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectManifest {
    pub metadata: Metadata,
    pub project_id: String,
    pub project_name: String,
    pub artist: String,
    pub audio: Audio,
    pub state: ProjectState,
}

#[derive(Debug, Deserialize)]
pub struct Metadata {
    #[serde(rename = "schema")]
    pub _schema: String,
    pub schema_version: String,
    pub created_with: String,
}

#[derive(Debug, Deserialize)]
pub struct Audio {
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectState {
    pub current_revision: u32,
    pub approved_revision: Option<u32>,
    pub delivered_revision: Option<u32>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub project_id: String,
    pub project_name: String,
    pub artist: String,
    pub schema_version: String,
    pub created_with: String,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
    pub current_revision: u32,
    pub approved_revision: Option<u32>,
    pub delivered_revision: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct StudioDocument {
    pub metadata: Metadata,
    pub studio_id: String,
    pub studio_name: String,
}

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

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub workspace_path: String,
    pub status: WorkspaceStatus,
    pub studio: Option<StudioSummary>,
    pub counts: WorkspaceCounts,
    pub clients: Vec<ClientSummary>,
    pub issues: Vec<DiscoveryIssue>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioSummary {
    pub studio_id: String,
    pub studio_name: String,
    pub schema_version: String,
    pub created_with: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClientSummary {
    pub client_id: String,
    pub client_name: String,
    pub default_artist: String,
    pub projects: Vec<ProjectSummary>,
}

#[derive(Debug, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCounts {
    pub clients: usize,
    pub projects: usize,
    pub issues: usize,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryIssue {
    pub scope: DiscoveryScope,
    pub code: DiscoveryCode,
    pub display_name: Option<String>,
    pub relative_path: Option<String>,
    pub message: String,
    pub recovery: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceStatus {
    Healthy,
    Empty,
    Partial,
    Unavailable,
    Invalid,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryScope {
    Workspace,
    Studio,
    Client,
    Project,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryCode {
    NotFound,
    Unreadable,
    InvalidJson,
    InvalidSchema,
    UnsupportedSchema,
    MissingManifest,
}
