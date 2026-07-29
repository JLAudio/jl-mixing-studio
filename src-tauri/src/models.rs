//! Serialized application contracts grouped by ownership.
//!
//! Re-exports intentionally preserve the existing `crate::models::TypeName` paths so this
//! structural split cannot silently change Tauri command contracts or JL Mixing metadata
//! compatibility. Field names and serde attributes remain owned by the domain modules.

mod documents;
mod system;
mod workflows;
mod workspace;

pub use documents::*;
pub use system::*;
pub use workflows::*;
pub use workspace::*;
