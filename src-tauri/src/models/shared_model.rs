//! Cross-domain serialized value objects shared by multiple model domains.

use serde::Deserialize;

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
pub struct Audio {
    pub sample_rate: u32,
    pub bit_depth: u16,
    pub file_format: String,
}

#[derive(Debug, Deserialize)]
pub struct DeliveryMethod {
    pub method: String,
}
