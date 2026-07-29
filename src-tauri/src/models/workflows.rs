use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioCreationRequest {
    pub studio_name: String,
    pub mix_engineer: Option<String>,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioCreationSummary {
    pub studio_name: String,
    pub mix_engineer: Option<String>,
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioOperationResult {
    pub ok: bool,
    pub code: StudioOperationCode,
    pub message: String,
    pub studio: Option<StudioCreationSummary>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StudioOperationCode {
    Ready,
    Created,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    UnsupportedPlatform,
    WorkspaceBlocked,
    Rejected,
    Uncertain,
    Failed,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCreationRequest {
    pub client_id: String,
    pub project_id: String,
    pub replacement_mode: DeliveryReplacementMode,
    pub create_zip: bool,
    pub confirmed_deletions: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryReplacementMode {
    Default,
    Overwrite,
    Clean,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlannedDeliveryFile {
    pub source_name: String,
    pub deliverable_type: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExcludedDeliveryFile {
    pub name: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryCreationPreview {
    pub client_id: String,
    pub project_id: String,
    pub project_name: String,
    pub current_revision: u32,
    pub approved_revision: u32,
    pub delivered_revision: Option<u32>,
    pub delivery_method: String,
    pub replacement_mode: DeliveryReplacementMode,
    pub create_zip: bool,
    pub zip_name: Option<String>,
    pub selected: Vec<PlannedDeliveryFile>,
    pub excluded: Vec<ExcludedDeliveryFile>,
    pub deletions: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryOperationResult {
    pub ok: bool,
    pub code: DeliveryOperationCode,
    pub message: String,
    pub delivery: Option<DeliveryCreationPreview>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryOperationCode {
    Ready,
    Created,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    UnsupportedPlatform,
    WorkspaceBlocked,
    ProjectUnavailable,
    ApprovalRequired,
    AlreadyDelivered,
    Rejected,
    Uncertain,
    Failed,
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

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeRequest {
    pub client_id: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeInventoryItem {
    pub file: String,
    pub size_bytes: u64,
    pub technical_details: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeReport {
    pub client_id: String,
    pub project_id: String,
    pub source: String,
    pub files_discovered: usize,
    pub blocking_errors: usize,
    pub warnings: usize,
    pub expected_sample_rate: u32,
    pub expected_bit_depth: u16,
    pub enhanced_inspection_available: bool,
    pub critical_errors: Vec<String>,
    pub duplicate_filenames: Vec<String>,
    pub format_mismatches: Vec<String>,
    pub unsupported_files: Vec<String>,
    pub unavailable_checks: Vec<String>,
    pub inventory: Vec<IntakeInventoryItem>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntakeOperationResult {
    pub ok: bool,
    pub code: IntakeOperationCode,
    pub message: String,
    pub report: Option<IntakeReport>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IntakeOperationCode {
    NotRun,
    Ready,
    Validated,
    BlockingFindings,
    InvalidInput,
    AutomationUnavailable,
    UnsupportedVersion,
    UnsupportedPlatform,
    WorkspaceBlocked,
    ProjectUnavailable,
    ReportUnavailable,
    Rejected,
    Uncertain,
    Failed,
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
