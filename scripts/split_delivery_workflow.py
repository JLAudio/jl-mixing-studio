from pathlib import Path
import subprocess

lib_path = Path("src-tauri/src/lib.rs")
workflows_dir = Path("src-tauri/src/workflows")
source = lib_path.read_text()

start = source.index("fn run_delivery_operation(")
end = source.index("fn validated_project_directory(", start)
delivery_body = source[start:end]
source = source[:start] + source[end:]

status_fn = '''fn workspace_allows_delivery_creation(status: WorkspaceStatus) -> bool {\n    matches!(status, WorkspaceStatus::Healthy)\n}\n\n'''
if status_fn not in source:
    raise RuntimeError("delivery workspace status helper not found")
source = source.replace(status_fn, "", 1)

if "mod workflows;\n" not in source:
    source = source.replace("mod workspace;\n", "mod workspace;\nmod workflows;\n", 1)

imports_anchor = "use tauri::Manager;\n"
workflow_import = (
    "use workflows::{run_delivery_operation, verify_delivery_creation, "
    "workspace_allows_delivery_creation};\n"
)
if workflow_import not in source:
    source = source.replace(imports_anchor, imports_anchor + workflow_import, 1)

# These comments document the two safety properties that are easy to lose during future edits:
# a clean replacement must execute the exact reviewed deletion plan, and a successful CLI exit is
# not sufficient evidence that a destructive/non-idempotent operation is safe to retry.
delivery_body = delivery_body.replace(
    "        if verify_after_creation {\n            if request.confirmed_deletions.is_empty() {",
    "        if verify_after_creation {\n            // Clean replacement is authorized only for the exact deletion inventory the user reviewed.\n            if request.confirmed_deletions.is_empty() {",
    1,
)
delivery_body = delivery_body.replace(
    "    let refreshed = workspace::discover_workspace_at(&workspace_path);",
    "    // Automation success is reconciled against authoritative workspace state before we claim\n"
    "    // completion; failure to reconcile is Uncertain so callers must not retry automatically.\n"
    "    let refreshed = workspace::discover_workspace_at(&workspace_path);",
    1,
)

workflows_dir.mkdir(parents=True, exist_ok=True)
Path("src-tauri/src/workflows/mod.rs").write_text(
    "mod delivery;\n\n"
    "pub(super) use delivery::{\n"
    "    run_delivery_operation, verify_delivery_creation, workspace_allows_delivery_creation,\n"
    "};\n"
)
Path("src-tauri/src/workflows/delivery.rs").write_text(
    "//! Delivery workflow policy and post-operation reconciliation.\n"
    "//!\n"
    "//! This module deliberately sits above the Automation CLI/API adapter: it validates the\n"
    "//! authoritative workspace state before execution and reconciles it afterward so destructive\n"
    "//! delivery operations never become implicit retries after an uncertain result.\n\n"
    "use std::fs;\n\n"
    "use crate::cli;\n"
    "use crate::models::{\n"
    "    DeliveryCreationPreview, DeliveryCreationRequest, DeliveryOperationCode,\n"
    "    DeliveryOperationResult, DeliveryReplacementMode, ProjectSummary, WorkspaceStatus,\n"
    "};\n"
    "use crate::workspace;\n\n"
    "use super::super::{find_project_summary, resolve_home, validated_project_directory};\n\n"
    + delivery_body.replace("fn run_delivery_operation(", "pub(super) fn run_delivery_operation(", 1)
      .replace("fn verify_delivery_creation(", "pub(super) fn verify_delivery_creation(", 1)
    + status_fn.replace("fn workspace_allows_delivery_creation(", "pub(super) fn workspace_allows_delivery_creation(")
)

lib_path.write_text(source)
subprocess.run(["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml"], check=True)
print("split delivery workflow from lib.rs")
