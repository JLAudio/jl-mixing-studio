from pathlib import Path
import re

source_path = Path("src/App.test.tsx")
source = source_path.read_text()

describe_marker = 'describe("JL Mixing Studio", () => {'
describe_pos = source.index(describe_marker)
prefix = source[:describe_pos]
body = source[describe_pos + len(describe_marker):]

# The suite ends with the describe() closing. Test blocks are all top-level two-space `it(...)` entries.
block_matches = list(re.finditer(r'(?m)^  it\("([^"]+)"', body))
assert block_matches, "no App tests found"

blocks = []
for index, match in enumerate(block_matches):
    start = match.start()
    end = block_matches[index + 1].start() if index + 1 < len(block_matches) else body.rfind("\n});")
    blocks.append((match.group(1), body[start:end].strip()))

original_titles = [title for title, _ in blocks]
assert len(original_titles) == 65, f"expected 65 tests, found {len(original_titles)}"

markers = {
    "mix_workflows": "opens authoritative revision history and selects an older approved revision",
    "intake": "opens the functional Intake route and reads the authoritative report",
    "projects": "uses the client and project ID pair when opening projects across clients",
    "workspace": "shows setup guidance for an unavailable workspace",
    "clients": "validates the client form before invoking preflight",
    "compatibility": "keeps the read-only dashboard usable for an unsupported automation version",
}
indices = {name: original_titles.index(title) for name, title in markers.items()}
assert list(indices.values()) == sorted(indices.values()), indices

groups = {
    "shell": blocks[:indices["mix_workflows"]],
    "mix_workflows": blocks[indices["mix_workflows"]:indices["intake"]],
    "intake": blocks[indices["intake"]:indices["projects"]],
    "projects": blocks[indices["projects"]:indices["workspace"]],
    "workspace": blocks[indices["workspace"]:indices["clients"]] + blocks[indices["compatibility"]:],
    "clients": blocks[indices["clients"]:indices["compatibility"]],
}

# Build a shared support module from the existing fixture/mock prefix.
support_lines = []
for line in prefix.splitlines():
    if line.startswith('import { cleanup,'):
        continue
    if line.startswith('import { afterEach,'):
        support_lines.append('import { vi } from "vitest";')
        continue
    if line == 'import App from "./App";':
        continue
    if line == 'afterEach(cleanup);':
        continue
    if line.startswith('const '):
        line = 'export ' + line
    support_lines.append(line)

support = "\n".join(support_lines).rstrip() + "\n\n"
support += "export function resetAppTestState() {\n"
support += "  mockedInvoke.mockReset();\n"
support += "  mockedWriteText.mockReset();\n"
support += "  localStorage.clear();\n"
support += "  respondWith(healthyWorkspace());\n"
support += "}\n"
Path("src/App.testSupport.ts").write_text(support)

exported_names = re.findall(r'(?m)^export const ([A-Za-z0-9_]+)', support)
exported_names.append("resetAppTestState")
imports = ",\n  ".join(exported_names)

type_imports = """import type {
  ApprovalOperationResult,
  ClientOperationResult,
  DeliveryOperationResult,
  IntakeOperationResult,
  IntakeReport,
  ProjectOperationResult,
  RevisionOperationResult,
  StudioOperationResult,
  VersionCheck,
  WorkspaceSnapshot,
} from \"./types\";
"""

labels = {
    "shell": "shell and routes",
    "mix_workflows": "revision, approval, and delivery workflows",
    "intake": "intake workflow",
    "projects": "project workflow",
    "workspace": "workspace and studio states",
    "clients": "client workflow",
}

for name, entries in groups.items():
    text = 'import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";\n'
    text += 'import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";\n'
    text += f'import {{\n  {imports}\n}} from "./App.testSupport";\n'
    text += 'import App from "./App";\n'
    text += type_imports + '\n'
    text += 'afterEach(cleanup);\n\n'
    text += f'describe("JL Mixing Studio — {labels[name]}", () => {{\n'
    text += '  beforeEach(() => {\n    resetAppTestState();\n  });\n\n'
    indented_blocks = []
    for _, block in entries:
        indented_blocks.append("\n".join(f"  {line}" if line else "" for line in block.splitlines()))
    text += "\n\n".join(indented_blocks) + "\n});\n"
    Path(f"src/App.{name}.test.tsx").write_text(text)

source_path.unlink()

split_titles = []
for path in sorted(Path("src").glob("App.*.test.tsx")):
    split_titles.extend(re.findall(r'(?m)^  it\("([^"]+)"', path.read_text()))
assert sorted(original_titles) == sorted(split_titles), (original_titles, split_titles)
assert len(split_titles) == len(set(split_titles)) == 65, "test titles must remain unique and complete"
