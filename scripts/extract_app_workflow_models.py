from pathlib import Path

workflows_path = Path("src/AppWorkflows.tsx")
app_path = Path("src/App.tsx")
workflows = workflows_path.read_text()
app = app_path.read_text()

model_start = workflows.index("export type ClientWorkflowState =")
component_start = workflows.index("export function DeliveryOptionsDialog")

workflows_header = '''import { type FormEvent, useEffect, useRef, useState } from "react";\nimport type {\n  ClientSummary,\n  DeliveryCreationRequest,\n  ProjectSummary,\n  VersionCheck,\n  WorkspaceSnapshot,\n} from "./types";\nimport { FolderControl, IntakeReportContent, RouteIssues, type ResourceState } from "./AppViews";\nimport type {\n  ApprovalFormValues,\n  ApprovalWorkflowState,\n  AppPreferences,\n  ClientFormValues,\n  ClientWorkflowState,\n  DeliveryWorkflowState,\n  IntakeWorkflowState,\n  ProjectFormValues,\n  ProjectWorkflowState,\n  RevisionFormValues,\n  RevisionWorkflowState,\n  StudioFormValues,\n  StudioWorkflowState,\n} from "./AppWorkflowModels";\n\n'''
workflows = workflows_header + workflows[component_start:]

old_import_start = app.index('import {\n  ClientWorkflowState,')
old_import_end = app.index('} from "./AppWorkflows";\n', old_import_start) + len('} from "./AppWorkflows";\n')
new_imports = '''import {\n  DeliveryOptionsDialog,\n  DeliveryDialog,\n  RevisionDialog,\n  ApprovalDialog,\n  IntakeDialog,\n  StudioRoute,\n  StudioDialog,\n  SettingsRoute,\n  ClientDialog,\n  ProjectDialog,\n} from "./AppWorkflows";\nimport {\n  type ClientWorkflowState,\n  type ClientFormValues,\n  type ProjectWorkflowState,\n  type ProjectFormValues,\n  type IntakeWorkflowState,\n  type RevisionWorkflowState,\n  type RevisionFormValues,\n  type ApprovalWorkflowState,\n  type ApprovalFormValues,\n  type DeliveryWorkflowState,\n  type StudioWorkflowState,\n  type StudioFormValues,\n  type AppPreferences,\n  loadPreferences,\n  emptyClientForm,\n  emptyProjectForm,\n  emptyStudioForm,\n  emptyRevisionForm,\n  emptyApprovalForm,\n  clientIdPattern,\n  sameDeliveryPlan,\n} from "./AppWorkflowModels";\n'''
app = app[:old_import_start] + new_imports + app[old_import_end:]

if "export type ClientWorkflowState" in workflows:
    raise SystemExit("workflow model definitions still present in AppWorkflows")
if 'from "./AppWorkflowModels"' not in workflows or 'from "./AppWorkflowModels"' not in app:
    raise SystemExit("model imports missing")

workflows_path.write_text(workflows)
app_path.write_text(app)
print(f"AppWorkflows.tsx reduced to {len(workflows.splitlines())} lines")
print(f"App.tsx remains {len(app.splitlines())} lines")
