from pathlib import Path

source_path = Path('src-tauri/src/cli/tests.rs')
source = source_path.read_text()

markers = {
    'studio': '#[test]\nfn studio_preflight_uses_fixed_default_workspace_arguments()',
    'client': '#[test]\nfn preflight_uses_dry_run_without_directory_change_flags()',
    'project': '#[test]\nfn project_preflight_uses_fixed_arguments_and_validated_client_directory()',
    'revision': '#[test]\nfn revision_preflight_uses_description_and_dry_run_from_validated_project()',
    'approval': '#[test]\nfn approval_preflight_uses_only_selected_revision_approver_and_dry_run()',
    'delivery': '#[test]\nfn delivery_preflight_uses_only_dry_run_from_the_validated_project()',
    'intake': '#[test]\nfn intake_preflight_uses_structured_api_from_the_validated_project()',
    'support_tail': '#[test]\nfn bounds_process_error_output()',
}

positions = {name: source.index(marker) for name, marker in markers.items()}
order = ['studio', 'client', 'project', 'revision', 'approval', 'delivery', 'intake', 'support_tail']
assert [positions[name] for name in order] == sorted(positions[name] for name in order)

out_dir = Path('src-tauri/src/cli/tests')
out_dir.mkdir()

prefix = source[:positions['studio']].rstrip()
suffix = source[positions['support_tail']:].strip()
module_decls = '\n'.join(f'mod {name};' for name in order[:-1])
(out_dir / 'mod.rs').write_text(f'{prefix}\n\n{module_decls}\n\n{suffix}\n')

for index, name in enumerate(order[:-1]):
    start = positions[name]
    end = positions[order[index + 1]]
    body = source[start:end].strip()
    (out_dir / f'{name}.rs').write_text(f'use super::*;\n\n{body}\n')

source_path.unlink()

# Guardrail: every original test name must remain exactly once after redistribution.
import re
original_tests = re.findall(r'(?m)^#\[test\]\nfn ([a-zA-Z0-9_]+)\(\)', source)
split_text = '\n'.join(path.read_text() for path in sorted(out_dir.glob('*.rs')))
split_tests = re.findall(r'(?m)^#\[test\]\nfn ([a-zA-Z0-9_]+)\(\)', split_text)
assert sorted(original_tests) == sorted(split_tests), (original_tests, split_tests)
assert len(original_tests) == len(set(split_tests))
