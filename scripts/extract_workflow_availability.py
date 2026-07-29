from pathlib import Path

path = Path("src/App.tsx")
source = path.read_text()

import_anchor = 'import "./App.css";\n'
new_import = 'import { getWorkflowAvailability } from "./AppWorkflowAvailability";\n'
if new_import not in source:
    if import_anchor not in source:
        raise SystemExit("App.css import anchor not found")
    source = source.replace(import_anchor, new_import + import_anchor, 1)

start = source.index("  const automationReady =")
end = source.index("\n\n  const openStudioWorkflow", start)
replacement = '''  const {
    automationReady,
    clientCreationAvailable,
    clientCreationHelp,
    projectCreationAvailable,
    projectCreationHelp,
    intakeValidationAvailable,
    intakeValidationHelp,
    revisionCreationAvailable,
    revisionCreationHelp,
    revisionApprovalAvailable,
    revisionApprovalHelp,
    deliveryCreationSupported,
    studioCreationAvailable,
    studioCreationHelp,
  } = getWorkflowAvailability(workspace, version);'''
source = source[:start] + replacement + source[end:]

start = source.index("  const clientCreationHelp =")
end = source.index("\n\n  const openClientWorkflow", start)
source = source[:start] + source[end:]

for forbidden in [
    "const workspaceAllowsCreation =",
    "const workspaceAllowsProjectCreation =",
    "const clientCreationHelp =",
    "const projectCreationHelp =",
    "const intakeValidationHelp =",
    "const revisionCreationHelp =",
    "const revisionApprovalHelp =",
]:
    if forbidden in source:
        raise SystemExit(f"stale availability logic remains: {forbidden}")

if source.count("getWorkflowAvailability(workspace, version)") != 1:
    raise SystemExit("availability helper call count mismatch")

path.write_text(source)
print(f"App.tsx now {len(source.splitlines())} lines")
