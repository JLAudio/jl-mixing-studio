from pathlib import Path

app = Path('src/App.tsx')
text = app.read_text()
for line in [
    '  ClientCreationSummary,\n',
    '  ClientSummary,\n',
    '  DeliveryCreationPreview,\n',
    '  IntakeReport,\n',
    '  ProjectCreationSummary,\n',
    '  ProjectSummary,\n',
    '  RevisionApprovalSummary,\n',
    '  RevisionCreationSummary,\n',
    '  StudioCreationSummary,\n',
    '  FolderControl,\n',
    '  IntakeReportContent,\n',
    '  RouteIssues,\n',
    '  defaultPreferences,\n',
    '  ClientDialogProps,\n',
    '  ProjectDialogProps,\n',
]:
    text = text.replace(line, '')
app.write_text(text)

wf = Path('src/AppWorkflows.tsx')
text = wf.read_text()
old = 'import type {\n  \n} from "./types";\n'
new = '''import type {\n  ClientCreationRequest,\n  ClientCreationSummary,\n  ClientSummary,\n  DeliveryCreationPreview,\n  DeliveryCreationRequest,\n  IntakeReport,\n  ProjectCreationRequest,\n  ProjectCreationSummary,\n  ProjectSummary,\n  RevisionApprovalRequest,\n  RevisionApprovalSummary,\n  RevisionCreationRequest,\n  RevisionCreationSummary,\n  RevisionSummary,\n  StudioCreationRequest,\n  StudioCreationSummary,\n  VersionCheck,\n  WorkspaceSnapshot,\n} from "./types";\nimport { FolderControl, IntakeReportContent, RouteIssues, type ResourceState } from "./AppViews";\n'''
if old not in text:
    raise SystemExit('expected empty type import block not found')
text = text.replace(old, new, 1)
wf.write_text(text)

# Guardrails: only import/header areas should have changed.
assert 'export default function App()' in app.read_text()
for symbol in ['ClientDialog', 'ProjectDialog', 'DeliveryDialog', 'StudioRoute', 'SettingsRoute']:
    assert f'export function {symbol}' in wf.read_text()
