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
    pub schema: String,
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
