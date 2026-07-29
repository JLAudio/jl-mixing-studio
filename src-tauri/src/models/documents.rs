use serde::{Deserialize, Serialize};

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
pub struct Metadata {
    #[serde(rename = "schema")]
    pub _schema: String,
    pub schema_version: String,
    pub document_id: String,
    pub created_with: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryManifest {
    pub metadata: DeliveryMetadata,
    pub project: DeliveryProject,
    pub client: DeliveryClient,
    pub revision: DeliveryRevision,
    pub delivery: DeliveryMethod,
    pub files: Vec<DeliveryFile>,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryMetadata {
    pub document_id: String,
    pub created_with: String,
    pub created_at: String,
}
#[derive(Debug, Deserialize)]
pub struct DeliveryProject {
    pub project_document_id: String,
    pub project_id: String,
    pub project_name: String,
}
#[derive(Debug, Deserialize)]
pub struct DeliveryClient {
    pub client_document_id: String,
    pub client_id: String,
}
#[derive(Debug, Deserialize)]
pub struct DeliveryRevision {
    pub number: u32,
    pub revision_id: String,
    pub description: String,
    pub approval: DeliveredApproval,
}
#[derive(Debug, Deserialize)]
pub struct DeliveredApproval {
    pub approved_at: String,
    pub approved_by: String,
}
#[derive(Debug, Deserialize)]
pub struct DeliveryMethod {
    pub method: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectSchedule {
    pub deadline: Option<String>,
}
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct DeliveryFile {
    pub path: String,
    pub deliverable_type: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliverySummary {
    pub document_id: String,
    pub created_with: String,
    pub created_at: String,
    pub method: String,
    pub revision: u32,
    pub revision_id: String,
    pub description: String,
    pub approved_at: String,
    pub approved_by: String,
    pub files: Vec<DeliveryFile>,
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

#[derive(Debug, Deserialize)]
pub struct StudioDocument {
    pub metadata: Metadata,
    pub studio_id: String,
    pub studio_name: String,
    pub root_path: String,
    pub defaults: StudioDefaults,
    pub cli: StudioCliDefaults,
}

#[derive(Debug, Deserialize)]
pub struct StudioDefaults {
    pub mix_engineer: String,
    pub audio: Audio,
    pub delivery: StudioDeliveryDefaults,
}

#[derive(Debug, Deserialize)]
pub struct StudioDeliveryDefaults {
    pub method: String,
    pub requested_deliverables: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct StudioCliDefaults {
    pub change_directory_after_create: bool,
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
