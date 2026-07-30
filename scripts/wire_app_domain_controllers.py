from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


app_path = Path("src/App.tsx")
app = app_path.read_text()

app = replace_once(
    app,
    '''import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
''',
    '''import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
''',
    "react imports",
)

start = app.find('import type {\n  ApprovalOperationResult,\n')
end = app.find('} from "./types";\n', start)
if start == -1 or end == -1:
    raise SystemExit("types import block not found")
end += len('} from "./types";\n')
app = app[:start] + 'import type { VersionCheck, WorkspaceSnapshot } from "./types";\n' + app[end:]

app = replace_once(app, '  type IntakeReportState,\n', '', 'remove intake report type import')

start = app.find('import {\n  type IntakeWorkflowState,\n')
end = app.find('} from "./AppWorkflowModels";\n', start)
if start == -1 or end == -1:
    raise SystemExit("workflow models import block not found")
end += len('} from "./AppWorkflowModels";\n')
app = app[:start] + '''import {
  type AppPreferences,
  loadPreferences,
} from "./AppWorkflowModels";
''' + app[end:]

app = replace_once(
    app,
    'import { useProjectWorkflow } from "./project";\n',
    'import { useProjectWorkflow } from "./project";\n'
    'import { useIntakeWorkflow } from "./intake";\n'
    'import { useRevisionWorkflow } from "./revision";\n'
    'import { useApprovalWorkflow } from "./approval";\n'
    'import { useDeliveryWorkflow } from "./delivery";\n',
    "remaining domain controller imports",
)

old_state = '''  const [projectView, setProjectView] = useState<ProjectView>("overview");
  const [intakeReport, setIntakeReport] = useState<IntakeReportState>({ status: "idle" });
  const [intakeWorkflow, setIntakeWorkflow] = useState<IntakeWorkflowState>({ status: "closed" });
  const [intakeActionError, setIntakeActionError] = useState<string | null>(null);
  const [revisionWorkflow, setRevisionWorkflow] = useState<RevisionWorkflowState>({ status: "closed" });
  const [revisionForm, setRevisionForm] = useState<RevisionFormValues>(emptyRevisionForm);
  const [revisionActionError, setRevisionActionError] = useState<string | null>(null);
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalWorkflowState>({ status: "closed" });
  const [approvalForm, setApprovalForm] = useState<ApprovalFormValues>(emptyApprovalForm);
  const [approvalActionError, setApprovalActionError] = useState<string | null>(null);
  const [deliveryWorkflow, setDeliveryWorkflow] = useState<DeliveryWorkflowState>({ status: "closed" });
  const [deliveryActionError, setDeliveryActionError] = useState<string | null>(null);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
  const [projectCreationNotice, setProjectCreationNotice] = useState<string | null>(null);
  const [intakeNotice, setIntakeNotice] = useState<string | null>(null);
  const [revisionNotice, setRevisionNotice] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
'''
new_state = '''  const [projectView, setProjectView] = useState<ProjectView>("overview");
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
  const [projectCreationNotice, setProjectCreationNotice] = useState<string | null>(null);
'''
app = replace_once(app, old_state, new_state, "remaining workflow local state")

route_context = '''  const {
    resolvedClient,
    resolvedProjectClient,
    resolvedProject,
    deliveryCreationAvailable,
    deliveryCreationHelp,
    activeRouteDefinition,
  } = getAppRouteContext(
    workspace,
    version,
    selectedClientId,
    selectedProject,
    activeRoute,
    projectView,
    deliveryCreationSupported,
  );

'''
app = replace_once(app, route_context, '', 'remove late route context')

start_marker = '  const loadIntakeReport = (request: IntakeRequest) => {\n'
end_marker = '  const navigate = (route: PrimaryRoute) => {\n'
start = app.find(start_marker)
end = app.find(end_marker)
if start == -1 or end == -1 or end <= start:
    raise SystemExit("remaining workflow block markers not found")

wiring = route_context + '''  const intakeController = useIntakeWorkflow({
    validationAvailable: intakeValidationAvailable,
    clientId: resolvedProjectClient?.clientId ?? null,
    projectId: resolvedProject?.projectId ?? null,
    onOpen: () => {
      setProjectView("intake");
      revisionController.reset();
      approvalController.reset();
    },
  });

  const revisionController = useRevisionWorkflow({
    creationAvailable: revisionCreationAvailable,
    clientId: resolvedProjectClient?.clientId ?? null,
    project: resolvedProject,
    setWorkspace,
    onOpen: () => {
      intakeController.reset();
      approvalController.reset();
    },
    onCreated: () => setProjectView("revisions"),
  });

  const approvalController = useApprovalWorkflow({
    approvalAvailable: revisionApprovalAvailable,
    clientId: resolvedProjectClient?.clientId ?? null,
    project: resolvedProject,
    setWorkspace,
    onOpen: () => revisionController.reset(),
  });

  const deliveryController = useDeliveryWorkflow({
    creationAvailable: deliveryCreationAvailable,
    clientId: resolvedProjectClient?.clientId ?? null,
    project: resolvedProject,
    setWorkspace,
  });

  const {
    state: intakeWorkflow,
    reportState: intakeReport,
    actionError: intakeActionError,
    notice: intakeNotice,
    reset: resetIntakeWorkflow,
    clear: clearIntakeWorkflow,
    reload: reloadIntakeReport,
    open: openIntake,
    preflight: preflightIntake,
    confirm: confirmIntake,
    closeDialog: closeIntakeDialog,
  } = intakeController;

  const {
    state: revisionWorkflow,
    form: revisionForm,
    setForm: setRevisionForm,
    actionError: revisionActionError,
    notice: revisionNotice,
    open: openRevisionWorkflow,
    reset: resetRevisionWorkflow,
    close: closeRevisionWorkflow,
    back: backRevisionWorkflow,
    preflight: preflightRevision,
    confirm: confirmRevision,
  } = revisionController;

  const {
    state: approvalWorkflow,
    form: approvalForm,
    setForm: setApprovalForm,
    actionError: approvalActionError,
    notice: approvalNotice,
    open: openApprovalWorkflow,
    reset: resetApprovalWorkflow,
    close: closeApprovalWorkflow,
    back: backApprovalWorkflow,
    preflight: preflightApproval,
    confirm: confirmApproval,
  } = approvalController;

  const {
    state: deliveryWorkflow,
    actionError: deliveryActionError,
    notice: deliveryNotice,
    open: openDeliveryWorkflow,
    close: closeDeliveryWorkflow,
    setRequest: setDeliveryRequest,
    preflight: preflightDelivery,
    confirm: confirmDelivery,
  } = deliveryController;

  const openRevisions = () => {
    if (!resolvedProjectClient || !resolvedProject) return;
    setProjectView("revisions");
    resetIntakeWorkflow();
  };

  const selectProjectView = (view: ProjectView) => {
    if (view === "intake") { openIntake(); return; }
    if (view === "revisions") { openRevisions(); return; }
    setProjectView(view);
    resetIntakeWorkflow();
    resetRevisionWorkflow();
    resetApprovalWorkflow();
  };

'''
app = app[:start] + wiring + app[end:]

old_navigate = '''  const navigate = (route: PrimaryRoute) => {
    setActiveRoute(route);
    setSelectedClientId(null);
    setSelectedProject(null);
    setProjectView("overview");
    setIntakeReport({ status: "idle" });
    setRevisionWorkflow({ status: "closed" });
    setRevisionActionError(null);
    setApprovalWorkflow({ status: "closed" });
    setApprovalActionError(null);
    setRouteNotice(null);
  };
'''
new_navigate = '''  const navigate = (route: PrimaryRoute) => {
    setActiveRoute(route);
    setSelectedClientId(null);
    setSelectedProject(null);
    setProjectView("overview");
    clearIntakeWorkflow();
    resetRevisionWorkflow();
    resetApprovalWorkflow();
    setRouteNotice(null);
  };
'''
app = replace_once(app, old_navigate, new_navigate, 'navigation workflow reset')

app = replace_once(
    app,
    '        setIntakeReport({ status: "idle" });\n',
    '        clearIntakeWorkflow();\n',
    'selection invalidation intake clear',
)

app = replace_once(
    app,
    '            onOverview={() => { setProjectView("overview"); setIntakeWorkflow({ status: "closed" }); setIntakeActionError(null); }}\n',
    '            onOverview={() => { setProjectView("overview"); resetIntakeWorkflow(); }}\n',
    'intake overview reset',
)
app = replace_once(
    app,
    '''            onRefresh={() => {
              refresh();
              loadIntakeReport({ clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId });
            }}
''',
    '''            onRefresh={() => {
              refresh();
              reloadIntakeReport();
            }}
''',
    'intake refresh',
)

app = replace_once(
    app,
    '      {studioWorkflow.status !== "closed" && <StudioDialog state={studioWorkflow} values={studioForm} onChange={setStudioForm} onPreflight={preflightStudio} onConfirm={confirmStudioCreation} onBack={() => setStudioWorkflow({ status: "editing" })} onClose={closeStudioWorkflow} />}\n',
    '      {studioWorkflow.status !== "closed" && <StudioDialog state={studioWorkflow} values={studioForm} onChange={setStudioForm} onPreflight={preflightStudio} onConfirm={confirmStudioCreation} onBack={() => setStudioWorkflow({ status: "editing" })} onClose={closeStudioWorkflow} />}\n',
    'studio dialog unchanged guard',
)

old_intake_close = '''          onClose={() => {
            if (intakeWorkflow.status === "running") return;
            setIntakeWorkflow({ status: "closed" });
            if (resolvedProjectClient && resolvedProject) {
              loadIntakeReport({ clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId });
            }
          }}
'''
app = replace_once(app, old_intake_close, '          onClose={closeIntakeDialog}\n', 'intake dialog close')

old_revision_back = '''          onBack={() => {
            if (revisionWorkflow.status !== "confirming") return;
            setRevisionWorkflow({ status: "editing" });
          }}
'''
app = replace_once(app, old_revision_back, '          onBack={backRevisionWorkflow}\n', 'revision dialog back')

old_approval_back = '''          onBack={() => {
            if (approvalWorkflow.status !== "confirming") return;
            setApprovalWorkflow({ status: "editing", revision: approvalWorkflow.revision });
          }}
'''
app = replace_once(app, old_approval_back, '          onBack={backApprovalWorkflow}\n', 'approval dialog back')

app = replace_once(
    app,
    '          onChange={(request) => setDeliveryWorkflow({ status: "options", request })}\n',
    '          onChange={setDeliveryRequest}\n',
    'delivery option request change',
)

for forbidden in (
    'setIntakeWorkflow(', 'setIntakeActionError(', 'setIntakeReport(',
    'setRevisionWorkflow(', 'setRevisionActionError(',
    'setApprovalWorkflow(', 'setApprovalActionError(',
    'setDeliveryWorkflow(', 'setDeliveryActionError(',
    'loadIntakeReport(',
):
    if forbidden in app:
        raise SystemExit(f"unexpected legacy App workflow mutation remains: {forbidden}")

app_path.write_text(app)

# Add domain-owned reset/clear helpers needed by App-level routing orchestration.
intake_path = Path('src/intake/controller.ts')
intake = intake_path.read_text()
intake = replace_once(
    intake,
    '''  const reset = () => {
    setState({ status: "closed" });
    setActionError(null);
  };
''',
    '''  const reset = () => {
    setState({ status: "closed" });
    setActionError(null);
  };

  const clear = () => {
    reset();
    setReportState({ status: "idle" });
  };
''',
    'intake clear helper',
)
intake = replace_once(intake, '    reset,\n    reload,\n', '    reset,\n    clear,\n    reload,\n', 'intake clear export')
intake_path.write_text(intake)

for controller_path in (Path('src/revision/controller.ts'), Path('src/approval/controller.ts')):
    text = controller_path.read_text()
    close_marker = '''  const close = () => {
'''
    pos = text.find(close_marker)
    if pos == -1:
        raise SystemExit(f'close helper not found in {controller_path}')
    # Insert reset immediately before close, with domain-specific action-error cleanup.
    reset = '''  const reset = () => {
    setState({ status: "closed" });
    setActionError(null);
  };

'''
    text = text[:pos] + reset + text[pos:]
    text = replace_once(text, '    open,\n    close,\n', '    open,\n    reset,\n    close,\n', f'reset export in {controller_path}')
    controller_path.write_text(text)
