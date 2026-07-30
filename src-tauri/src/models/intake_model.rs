//! Intake domain contracts: validation request, report inventory, and operation result.

use serde::{Deserialize, Serialize};

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
