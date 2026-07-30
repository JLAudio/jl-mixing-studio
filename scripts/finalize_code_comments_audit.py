from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old!r}")
    path.write_text(text.replace(old, new, 1))


def main() -> None:
    automation = Path("src-tauri/src/automation_api.rs")
    replace_once(
        automation,
        "pub(crate) fn automation_subprocess_path(\n    inherited_path: Option<&OsStr>,\n) -> Option<std::ffi::OsString> {\n",
        "/// GUI launches on macOS may not inherit the user's interactive shell PATH. Keep the\n/// inherited search order, then add the standard Intel and Apple Silicon Homebrew locations so\n/// Automation discovery behaves consistently without overriding an explicitly configured binary.\npub(crate) fn automation_subprocess_path(\n    inherited_path: Option<&OsStr>,\n) -> Option<std::ffi::OsString> {\n",
    )
    replace_once(
        automation,
        "    let platform_supported = !cfg!(target_os = \"windows\");\n    let has = |capability: &str| capabilities.iter().any(|item| item == capability);\n",
        "    let platform_supported = !cfg!(target_os = \"windows\");\n    // Feature availability follows provider-advertised API capabilities rather than Automation's\n    // product version, preserving Studio/Automation version independence within API 1.0.\n    let has = |capability: &str| capabilities.iter().any(|item| item == capability);\n",
    )

    workspace = Path("src-tauri/src/workspace.rs")
    replace_once(
        workspace,
        'const DELIVERY_SCHEMA: &str =\n    include_str!("../../schemas/jl-mixing-v1.2.0/delivery-manifest.schema.json");\nconst SUPPORTED_SCHEMA_VERSION: &str = "1.1.0";\n',
        'const DELIVERY_SCHEMA: &str =\n    include_str!("../../schemas/jl-mixing-v1.2.0/delivery-manifest.schema.json");\n// The bundled schema snapshot came from the Automation 1.2.0 release, while metadata schema\n// identity intentionally remains 1.1.0. Product release and metadata schema versions are\n// independent; historical `created_with` values remain valid when the schema contract matches.\nconst SUPPORTED_SCHEMA_VERSION: &str = "1.1.0";\n',
    )


if __name__ == "__main__":
    main()
