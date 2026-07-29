from pathlib import Path
import subprocess

models_path = Path("src-tauri/src/models.rs")
models_dir = Path("src-tauri/src/models")
source = models_path.read_text()

workflow_marker = "#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]\n#[serde(rename_all = \"camelCase\")]\npub struct StudioCreationRequest"
documents_marker = "#[derive(Debug, Deserialize)]\npub struct ProjectManifest"
workspace_marker = "#[derive(Debug, Serialize, PartialEq, Eq)]\n#[serde(rename_all = \"camelCase\")]\npub struct WorkspaceSnapshot"

workflow_start = source.index(workflow_marker)
documents_start = source.index(documents_marker)
workspace_start = source.index(workspace_marker)

header_end = source.index("\n\n", source.index("use serde")) + 2
imports = source[:header_end]
system_body = source[header_end:workflow_start]
workflow_body = source[workflow_start:documents_start]
documents_body = source[documents_start:workspace_start]
workspace_body = source[workspace_start:]

models_dir.mkdir(parents=True, exist_ok=True)
models_dir.joinpath("system.rs").write_text(imports + system_body)
models_dir.joinpath("workflows.rs").write_text(imports + workflow_body)
models_dir.joinpath("documents.rs").write_text(imports + documents_body)
models_dir.joinpath("workspace.rs").write_text(
    imports + "use super::documents::ProjectSummary;\n\n" + workspace_body
)

models_path.write_text(
    "//! Serialized application contracts grouped by ownership.\n"
    "//!\n"
    "//! Re-exports intentionally preserve the existing `crate::models::TypeName` paths so this\n"
    "//! structural split cannot silently change Tauri command contracts or JL Mixing metadata\n"
    "//! compatibility. Field names and serde attributes remain owned by the domain modules.\n\n"
    "mod documents;\n"
    "mod system;\n"
    "mod workflows;\n"
    "mod workspace;\n\n"
    "pub use documents::*;\n"
    "pub use system::*;\n"
    "pub use workflows::*;\n"
    "pub use workspace::*;\n"
)

subprocess.run(["cargo", "fmt", "--manifest-path", "src-tauri/Cargo.toml"], check=True)
print("split models.rs into system/workflows/documents/workspace contract modules")
