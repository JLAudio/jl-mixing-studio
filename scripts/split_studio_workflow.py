from pathlib import Path
import subprocess

lib_path = Path("src-tauri/src/lib.rs")
mod_path = Path("src-tauri/src/workflows/mod.rs")
studio_path = Path("src-tauri/src/workflows/studio.rs")
source = lib_path.read_text()

start = source.index("fn run_studio_operation(")
end = source.index("fn run_client_operation(", start)
studio_block = source[start:end]
source = source[:start] + source[end:]

source = source.replace(
    "RevisionCreationRequest, RevisionOperationResult, StudioCreationRequest, StudioOperationCode,\n    StudioOperationResult, SystemInfo, VersionCheck, WorkspaceSnapshot, WorkspaceStatus,",
    "RevisionCreationRequest, RevisionOperationResult, StudioCreationRequest, StudioOperationResult,\n    SystemInfo, VersionCheck, WorkspaceSnapshot, WorkspaceStatus,",
    1,
)
source = source.replace(
    "run_revision_operation,\n};",
    "run_revision_operation, run_studio_operation,\n};",
    1,
)

studio_block = studio_block.replace("fn run_studio_operation(", "pub(crate) fn run_studio_operation(", 1)
studio_text = '''//! Studio creation workflow policy and authoritative post-create reconciliation.\n//!\n//! Studio creation is non-idempotent. A successful Automation response is reconciled against the\n//! discovered workspace before Studio reports completion; reconciliation failure is `Uncertain` so\n//! callers do not blindly retry an operation that may already have completed.\n\nuse crate::cli;\nuse crate::models::{StudioCreationRequest, StudioOperationCode, StudioOperationResult, WorkspaceStatus};\nuse crate::workspace;\n\nuse super::super::resolve_home;\n\n''' + studio_block
studio_path.write_text(studio_text)

mod_text = mod_path.read_text()
if "mod studio;\n" not in mod_text:
    mod_text += "\nmod studio;\n"
if "pub(super) use studio::run_studio_operation;" not in mod_text:
    mod_text += "pub(super) use studio::run_studio_operation;\n"
mod_path.write_text(mod_text)
lib_path.write_text(source)
subprocess.run(["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml"], check=True)
print("split studio workflow from lib.rs")
