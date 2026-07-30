//! Serialized application contracts grouped by business domain.
//!
//! Re-exports intentionally preserve the existing `crate::models::TypeName` paths so this
//! structural refactor cannot silently change Tauri command contracts or JL Mixing metadata
//! compatibility. Field names, serde attributes, and enum variants remain unchanged.

mod client_model;
mod delivery_model;
mod intake_model;
mod project_model;
mod revision_model;
mod shared_model;
mod studio_model;
mod system_model;
mod workspace_model;

pub use client_model::*;
pub use delivery_model::*;
pub use intake_model::*;
pub use project_model::*;
pub use revision_model::*;
// Shared value objects remain part of the compatibility barrel even when current crate code
// reaches them through their owning domain modules.
#[allow(unused_imports)]
pub use shared_model::*;
pub use studio_model::*;
pub use system_model::*;
pub use workspace_model::*;
