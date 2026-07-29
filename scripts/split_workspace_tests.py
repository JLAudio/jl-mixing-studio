from pathlib import Path

workspace_path = Path("src-tauri/src/workspace.rs")
tests_path = Path("src-tauri/src/workspace/workspace_tests.rs")
source = workspace_path.read_text()
marker = "#[cfg(test)]\nmod tests {\n"
start = source.find(marker)
if start < 0:
    raise SystemExit("workspace test module not found")
body_start = start + len(marker)
if not source.rstrip().endswith("}"):
    raise SystemExit("workspace.rs does not end with test module")
body = source[body_start:source.rfind("}")]
if "use super::*;" not in body:
    raise SystemExit("workspace tests do not import parent module")
production = source[:start].rstrip() + "\n\n#[cfg(test)]\nmod workspace_tests;\n"
tests_path.parent.mkdir(parents=True, exist_ok=True)
tests_path.write_text(body.lstrip())
workspace_path.write_text(production)
print(f"workspace.rs reduced to {len(production.splitlines())} lines")
print(f"workspace/workspace_tests.rs contains {len(body.splitlines())} lines")