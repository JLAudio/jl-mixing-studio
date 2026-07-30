from pathlib import Path
import subprocess

ROOT = Path("src-tauri/src/models")
workflows = (ROOT / "workflows.rs").read_text()
documents = (ROOT / "documents.rs").read_text()
workspace = (ROOT / "workspace.rs").read_text()


def decl(source: str, name: str) -> str:
    markers = (f"pub struct {name}", f"pub enum {name}")
    positions = [source.find(marker) for marker in markers if source.find(marker) >= 0]
    if not positions:
        raise RuntimeError(f"declaration not found: {name}")
    pos = min(positions)
    start = source.rfind("#[derive", 0, pos)
    if start < 0:
        raise RuntimeError(f"derive start not found: {name}")
    next_decl = source.find("#[derive", pos)
    end = len(source) if next_decl < 0 else next_decl
    return source[start:end].rstrip() + "\n\n"


def write_domain(path: str, header: str, source_groups: list[tuple[str, str]]) -> None:
    text = header.rstrip() + "\n\n"
    for source, name in source_groups:
        text += decl(source, name)
    (ROOT / path).write_text(text.rstrip() + "\n")


write_domain(
    "shared_model.rs",
    "//! Cross-domain serialized value objects shared by multiple model domains.\n\nuse serde::Deserialize;",
    [(documents, "Metadata"), (documents, "Audio"), (documents, "DeliveryMethod")],
)

write_domain(
    "studio_model.rs",
    """//! Studio domain contracts: persisted metadata, workspace projection, and creation workflow.\n\nuse serde::{Deserialize, Serialize};\n\nuse super::shared_model::{Audio, Metadata};""",
    [
        (documents, "StudioDocument"), (documents, "StudioDefaults"),
        (documents, "StudioDeliveryDefaults"), (documents, "StudioCliDefaults"),
        (workspace, "StudioSummary"), (workflows, "StudioCreationRequest"),
        (workflows, "StudioCreationSummary"), (workflows, "StudioOperationResult"),
        (workflows, "StudioOperationCode"),
    ],
)

write_domain(
    "client_model.rs",
    """//! Client domain contracts: persisted metadata, workspace projection, and creation workflow.\n\nuse serde::{Deserialize, Serialize};\n\nuse super::project_model::ProjectSummary;\nuse super::shared_model::Metadata;""",
    [
        (documents, "ClientDocument"), (documents, "ClientDefaults"),
        (workspace, "ClientSummary"), (workflows, "ClientCreationRequest"),
        (workflows, "ClientCreationSummary"), (workflows, "ClientOperationResult"),
        (workflows, "ClientOperationCode"),
    ],
)

write_domain(
    "revision_model.rs",
    "//! Revision domain contracts: persisted history, workspace projection, creation, and approval.\n\nuse serde::{Deserialize, Serialize};",
    [
        (documents, "RevisionDocument"), (documents, "RevisionApproval"),
        (documents, "RevisionSummary"), (workflows, "RevisionCreationRequest"),
        (workflows, "RevisionCreationSummary"), (workflows, "RevisionOperationResult"),
        (workflows, "RevisionOperationCode"), (workflows, "RevisionApprovalRequest"),
        (workflows, "RevisionApprovalSummary"), (workflows, "ApprovalOperationResult"),
        (workflows, "ApprovalOperationCode"),
    ],
)

write_domain(
    "delivery_model.rs",
    """//! Delivery domain contracts: persisted package metadata, workspace projection, and creation workflow.\n\nuse serde::{Deserialize, Serialize};\n\nuse super::shared_model::DeliveryMethod;""",
    [
        (documents, "DeliveryManifest"), (documents, "DeliveryMetadata"),
        (documents, "DeliveryProject"), (documents, "DeliveryClient"),
        (documents, "DeliveryRevision"), (documents, "DeliveredApproval"),
        (documents, "DeliveryFile"), (documents, "DeliverySummary"),
        (workflows, "DeliveryCreationRequest"), (workflows, "DeliveryReplacementMode"),
        (workflows, "PlannedDeliveryFile"), (workflows, "ExcludedDeliveryFile"),
        (workflows, "DeliveryCreationPreview"), (workflows, "DeliveryOperationResult"),
        (workflows, "DeliveryOperationCode"),
    ],
)

write_domain(
    "project_model.rs",
    """//! Project domain contracts: persisted project state, workspace projection, and creation workflow.\n\nuse serde::{Deserialize, Serialize};\n\nuse super::delivery_model::DeliverySummary;\nuse super::revision_model::{RevisionDocument, RevisionSummary};\nuse super::shared_model::{Audio, DeliveryMethod, Metadata};""",
    [
        (documents, "ProjectManifest"), (documents, "ProjectSchedule"),
        (documents, "ProjectState"), (documents, "ProjectSummary"),
        (workflows, "ProjectCreationRequest"), (workflows, "ProjectCreationSummary"),
        (workflows, "ProjectOperationResult"), (workflows, "ProjectOperationCode"),
    ],
)

write_domain(
    "intake_model.rs",
    "//! Intake domain contracts: validation request, report inventory, and operation result.\n\nuse serde::{Deserialize, Serialize};",
    [
        (workflows, "IntakeRequest"), (workflows, "IntakeInventoryItem"),
        (workflows, "IntakeReport"), (workflows, "IntakeOperationResult"),
        (workflows, "IntakeOperationCode"),
    ],
)

for name in ("StudioSummary", "ClientSummary"):
    workspace = workspace.replace(decl(workspace, name), "")
workspace = workspace.replace(
    "use super::documents::ProjectSummary;\n",
    "use super::client_model::ClientSummary;\nuse super::studio_model::StudioSummary;\n",
)
(ROOT / "workspace_model.rs").write_text(workspace)
(ROOT / "system_model.rs").write_text((ROOT / "system.rs").read_text())

(ROOT.parent / "models.rs").write_text(
    """//! Serialized application contracts grouped by business domain.
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
"""
)

for path in ("documents.rs", "workflows.rs", "workspace.rs", "system.rs"):
    (ROOT / path).unlink()

subprocess.run(["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml"], check=True)
print("refactored Rust models into suffixed business-domain modules")
