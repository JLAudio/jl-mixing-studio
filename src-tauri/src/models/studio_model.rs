//! Studio domain contracts: persisted metadata, workspace projection, and creation workflow.

use serde::{Deserialize, Serialize};

use super::shared_model::{Audio, Metadata};

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
