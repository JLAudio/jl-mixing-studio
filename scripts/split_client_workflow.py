from pathlib import Path
import subprocess

lib_path = Path("src-tauri/src/lib.rs")
mod_path = Path("src-tauri/src/workflows/mod.rs")
client_path = Path("src-tauri/src/workflows/client.rs")
source = lib_path.read_text()

start = source.index("fn run_client_operation(")
end = source.index("fn run_project_operation(", start)
client_block = source[start:end]
source = source[:start] + source[end:]

source = source.replace(
    "ApprovalOperationResult, ClientCreationRequest, ClientOperationCode, ClientOperationResult,",
    "ApprovalOperationResult, ClientCreationRequest, ClientOperationResult,",
    1,
)
source = source.replace(
    "workspace_allows_revision_approval, workspace_allows_revision_creation,\n};",
    "workspace_allows_client_creation, workspace_allows_revision_approval,\n    workspace_allows_revision_creation,\n};",
    1,
)
source = source.replace(
    "read_intake_report, run_approval_operation, run_delivery_operation, run_intake_operation,\n    run_revision_operation, run_studio_operation,",
    "read_intake_report, run_approval_operation, run_client_operation, run_delivery_operation,\n    run_intake_operation, run_revision_operation, run_studio_operation,",
    1,
)
lib_path.write_text(source)

client_text = '''//! Client creation workflow policy.\n//!\n//! Client creation is allowed only against a validated existing studio workspace. The workflow\n//! also owns the platform gate before JL Mixing Automation is invoked.\n\nuse crate::cli;\nuse crate::models::{\n    ClientCreationRequest, ClientOperationCode, ClientOperationResult, WorkspaceStatus,\n};\nuse crate::workspace;\n\nuse super::super::resolve_home;\n\n''' + client_block.replace("fn run_client_operation(", "pub(crate) fn run_client_operation(", 1).replace(
    "fn workspace_allows_client_creation(", "pub(crate) fn workspace_allows_client_creation(", 1
)
client_path.write_text(client_text)

mod_text = mod_path.read_text()
if "mod client;\n" not in mod_text:
    mod_text = "mod client;\n" + mod_text
if "pub(super) use client::run_client_operation;" not in mod_text:
    mod_text += '''\npub(super) use client::run_client_operation;\n#[cfg(test)]\npub(super) use client::workspace_allows_client_creation;\n'''
mod_path.write_text(mod_text)

subprocess.run(["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml"], check=True)
print("split client workflow from lib.rs")
