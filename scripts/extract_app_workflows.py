from pathlib import Path
import re

app_path = Path("src/App.tsx")
source = app_path.read_text()

start_marker = "type ClientWorkflowState ="
app_marker = "export default function App() {"
start = source.index(start_marker)
end = source.index(app_marker)
block = source[start:end].rstrip() + "\n"

# Export each top-level declaration/function in the extracted workflow UI/model layer.
block = re.sub(r"(?m)^(type|interface|const|function) ", r"export \1 ", block)

# Build only the type imports actually referenced by the extracted block.
type_names = [
    "ClientCreationRequest", "ClientCreationSummary", "ClientSummary",
    "DeliveryCreationPreview", "DeliveryCreationRequest", "IntakeReport",
    "ProjectCreationRequest", "ProjectCreationSummary", "ProjectSummary",
    "RevisionApprovalRequest", "RevisionApprovalSummary", "RevisionCreationRequest",
    "RevisionCreationSummary", "RevisionSummary", "StudioCreationRequest",
    "StudioCreationSummary",
]
used_types = [name for name in type_names if re.search(rf"\\b{name}\\b", block)]
imports = 'import { type FormEvent, useEffect, useRef, useState } from "react";\n'
imports += 'import type {\n  ' + ',\n  '.join(used_types) + '\n} from "./types";\n\n'
workflows = imports + block
Path("src/AppWorkflows.tsx").write_text(workflows)

# Remove the moved block from App.tsx and import its public surface.
exported = re.findall(r"(?m)^export (?:type|interface|const|function) ([A-Za-z0-9_]+)", block)
assert exported, "no workflow exports found"
workflow_import = 'import {\n  ' + ',\n  '.join(exported) + '\n} from "./AppWorkflows";\n'
new_source = source[:start] + source[end:]
insert_after = 'import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";\n'
assert insert_after in new_source
new_source = new_source.replace(insert_after, insert_after + workflow_import, 1)
app_path.write_text(new_source)

assert app_marker in new_source
assert "function DeliveryDialog" not in new_source
assert "function ProjectDialog" not in new_source
for name in [
    "ClientWorkflowState", "ProjectWorkflowState", "IntakeWorkflowState",
    "RevisionWorkflowState", "ApprovalWorkflowState", "DeliveryWorkflowState",
    "StudioWorkflowState", "DeliveryDialog", "RevisionDialog", "ApprovalDialog",
    "ProjectDialog", "ClientDialog", "StudioDialog",
]:
    assert name in workflows, name

print(f"Extracted {len(exported)} workflow declarations to src/AppWorkflows.tsx")
