use serde::Serialize;

use super::documents::ProjectSummary;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub workspace_path: String,
    pub status: WorkspaceStatus,
    pub studio: Option<StudioSummary>,
    pub counts: WorkspaceCounts,
    pub clients: Vec<ClientSummary>,
    pub issues: Vec<DiscoveryIssue>,
    pub tasks: Vec<DerivedTask>,
    pub activity: Vec<ActivityEvent>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioSummary {
    pub studio_id: String,
    pub studio_name: String,
    pub root_path: String,
    pub schema_version: String,
    pub created_with: String,
    pub created_at: String,
    pub mix_engineer: String,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
    pub delivery_method: String,
    pub requested_deliverables: Vec<String>,
    pub change_directory_after_create: bool,
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

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DerivedTask {
    pub id: String,
    pub priority: TaskPriority,
    pub title: String,
    pub reason: String,
    pub recommended_action: String,
    pub client_id: Option<String>,
    pub client_name: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub deadline: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TaskPriority {
    Recovery,
    Overdue,
    Delivery,
    Upcoming,
    Review,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: String,
    pub event_type: ActivityEventType,
    pub timestamp: String,
    pub client_id: String,
    pub client_name: String,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub revision: Option<u32>,
    pub persisted_source: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ActivityEventType {
    ClientCreated,
    ProjectCreated,
    RevisionCreated,
    RevisionApproved,
    DeliveryCreated,
}

#[derive(Debug, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCounts {
    pub clients: usize,
    pub projects: usize,
    pub issues: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryIssue {
    pub scope: DiscoveryScope,
    pub code: DiscoveryCode,
    pub display_name: Option<String>,
    pub relative_path: Option<String>,
    pub message: String,
    pub recovery: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceStatus {
    Healthy,
    Empty,
    Partial,
    Unavailable,
    Invalid,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryScope {
    Workspace,
    Studio,
    Client,
    Project,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiscoveryCode {
    NotFound,
    Unreadable,
    InvalidJson,
    InvalidSchema,
    UnsupportedSchema,
    MissingManifest,
}
