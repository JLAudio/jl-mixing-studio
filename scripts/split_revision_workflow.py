from pathlib import Path
import subprocess

lib_path = Path("src-tauri/src/lib.rs")
workflows_mod_path = Path("src-tauri/src/workflows/mod.rs")
revision_path = Path("src-tauri/src/workflows/revision.rs")
source = lib_path.read_text()

first_start = source.index("fn run_revision_operation(")
first_end = source.index("fn find_project_summary<'a>(", first_start)
run_revision = source[first_start:first_end]
source = source[:first_start] + source[first_end:]

second_start = source.index("fn verify_revision_creation(")
second_end = source.index("fn validated_project_directory(", second_start)
revision_rest = source[second_start:second_end]
source = source[:second_start] + source[second_end:]

creation_status = '''fn workspace_allows_revision_creation(status: WorkspaceStatus) -> bool {\n    matches!(status, WorkspaceStatus::Healthy)\n}\n\n'''
approval_status = '''fn workspace_allows_revision_approval(status: WorkspaceStatus) -> bool {\n    matches!(status, WorkspaceStatus::Healthy)\n}\n\n'''
for helper in (creation_status, approval_status):
    if helper not in source:
        raise RuntimeError("revision workspace helper not found")
    source = source.replace(helper, "", 1)

# Keep only command-surface types in production imports; reconciliation summaries move with the domain.
source = source.replace("ApprovalOperationCode, ApprovalOperationResult,", "ApprovalOperationResult,")
source = source.replace("RevisionApprovalRequest, RevisionApprovalSummary, RevisionCreationRequest,\n    RevisionCreationSummary, RevisionOperationCode, RevisionOperationResult,", "RevisionApprovalRequest, RevisionCreationRequest, RevisionOperationResult,")
source = source.replace(
    "#[cfg(test)]\nuse models::{DeliveryCreationPreview, DeliveryReplacementMode};",
    "#[cfg(test)]\nuse models::{\n    DeliveryCreationPreview, DeliveryReplacementMode, RevisionApprovalSummary,\n    RevisionCreationSummary,\n};",
)
source = source.replace(
    "use workflows::run_delivery_operation;",
    "use workflows::{run_approval_operation, run_delivery_operation, run_revision_operation};",
)
source = source.replace(
    "    list_delivery_entries, verify_delivery_artifacts, verify_delivery_creation,\n    workspace_allows_delivery_creation,",
    "    list_delivery_entries, verify_delivery_artifacts, verify_delivery_creation,\n    verify_revision_approval, verify_revision_creation, workspace_allows_delivery_creation,\n    workspace_allows_revision_approval, workspace_allows_revision_creation,",
)

revision_body = run_revision + revision_rest
revision_body = revision_body.replace("fn run_revision_operation(", "pub(crate) fn run_revision_operation(", 1)
revision_body = revision_body.replace("fn verify_revision_creation(", "pub(crate) fn verify_revision_creation(", 1)
revision_body = revision_body.replace("fn run_approval_operation(", "pub(crate) fn run_approval_operation(", 1)
revision_body = revision_body.replace("fn verify_revision_approval(", "pub(crate) fn verify_revision_approval(", 1)

revision_text = '''//! Revision creation and approval workflow policy with authoritative reconciliation.\n//!\n//! Successful Automation responses are reconciled against the validated project history before\n//! Studio reports completion. A mismatch is intentionally `Uncertain`: callers must not turn a\n//! potentially completed non-idempotent operation into an automatic retry.\n\nuse crate::cli;\nuse crate::models::{\n    ApprovalOperationCode, ApprovalOperationResult, ProjectSummary, RevisionApprovalRequest,\n    RevisionApprovalSummary, RevisionCreationRequest, RevisionCreationSummary,\n    RevisionOperationCode, RevisionOperationResult, WorkspaceStatus,\n};\nuse crate::workspace;\n\nuse super::super::{find_project_summary, resolve_home, validated_project_directory};\n\n''' + revision_body + creation_status.replace("fn workspace_allows_revision_creation(", "pub(crate) fn workspace_allows_revision_creation(") + approval_status.replace("fn workspace_allows_revision_approval(", "pub(crate) fn workspace_allows_revision_approval(")
revision_path.write_text(revision_text)

mod_text = workflows_mod_path.read_text()
if "mod revision;\n" not in mod_text:
    mod_text = mod_text.replace("mod delivery;\n", "mod delivery;\nmod revision;\n", 1)
if "pub(super) use revision::" not in mod_text:
    mod_text += '''\npub(super) use revision::{run_approval_operation, run_revision_operation};\n#[cfg(test)]\npub(super) use revision::{\n    verify_revision_approval, verify_revision_creation, workspace_allows_revision_approval,\n    workspace_allows_revision_creation,\n};\n'''
workflows_mod_path.write_text(mod_text)
lib_path.write_text(source)
subprocess.run(["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml"], check=True)
print("split revision and approval workflows from lib.rs")
