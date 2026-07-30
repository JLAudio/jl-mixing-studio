from pathlib import Path

ROOT = Path("src-tauri/src")

CLI_DOMAINS = ["client", "delivery", "intake", "project", "revision", "studio"]
WORKFLOW_DOMAINS = ["client", "delivery", "intake", "revision", "studio"]
TEST_DOMAINS = ["approval", "client", "delivery", "intake", "project", "revision", "studio"]


def rename(directory: Path, old_stem: str, new_stem: str) -> None:
    old = directory / f"{old_stem}.rs"
    new = directory / f"{new_stem}.rs"
    if not old.exists():
        raise RuntimeError(f"missing source file: {old}")
    if new.exists():
        raise RuntimeError(f"target already exists: {new}")
    old.rename(new)


for domain in CLI_DOMAINS:
    rename(ROOT / "cli", domain, f"{domain}_cli")

for domain in WORKFLOW_DOMAINS:
    rename(ROOT / "workflows", domain, f"{domain}_workflow")

for domain in TEST_DOMAINS:
    rename(ROOT / "cli" / "tests", domain, f"{domain}_test")

cli_mod = (ROOT / "cli" / "mod.rs").read_text()
for domain in CLI_DOMAINS:
    cli_mod = cli_mod.replace(f"mod {domain};", f"#[path = \"{domain}_cli.rs\"]\nmod {domain};")
(ROOT / "cli" / "mod.rs").write_text(cli_mod)

workflow_mod = (ROOT / "workflows" / "mod.rs").read_text()
for domain in WORKFLOW_DOMAINS:
    workflow_mod = workflow_mod.replace(
        f"mod {domain};", f"#[path = \"{domain}_workflow.rs\"]\nmod {domain};"
    )
(ROOT / "workflows" / "mod.rs").write_text(workflow_mod)

tests_mod = (ROOT / "cli" / "tests" / "mod.rs").read_text()
for domain in TEST_DOMAINS:
    tests_mod = tests_mod.replace(f"mod {domain};", f"#[path = \"{domain}_test.rs\"]\nmod {domain};")
(ROOT / "cli" / "tests" / "mod.rs").write_text(tests_mod)

print("normalized Rust domain filenames with explicit layer suffixes")
