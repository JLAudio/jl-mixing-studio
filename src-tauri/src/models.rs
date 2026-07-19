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
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeliveryReplacementMode {
    Default,
    Overwrite,
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
    pub selected: Vec<PlannedDeliveryFile>,
    pub excluded: Vec<ExcludedDeliveryFile>,
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
