from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


app_path = Path("src/App.tsx")
app = app_path.read_text()

for line in (
    "  ClientCreationRequest,\n",
    "  ClientOperationResult,\n",
    "  ProjectCreationRequest,\n",
    "  ProjectOperationResult,\n",
    "  StudioCreationRequest,\n",
    "  StudioOperationResult,\n",
):
    app = replace_once(app, line, "", f"remove import {line.strip()}")

old_models_import = '''import {
  type ClientWorkflowState,
  type ClientFormValues,
  type ProjectWorkflowState,
  type ProjectFormValues,
  type IntakeWorkflowState,
  type RevisionWorkflowState,
  type RevisionFormValues,
  type ApprovalWorkflowState,
  type ApprovalFormValues,
  type DeliveryWorkflowState,
  type StudioWorkflowState,
  type StudioFormValues,
  type AppPreferences,
  loadPreferences,
  emptyClientForm,
  emptyProjectForm,
  emptyStudioForm,
  emptyRevisionForm,
  emptyApprovalForm,
  clientIdPattern,
  sameDeliveryPlan,
} from "./AppWorkflowModels";
'''
new_models_import = '''import {
  type IntakeWorkflowState,
  type RevisionWorkflowState,
  type RevisionFormValues,
  type ApprovalWorkflowState,
  type ApprovalFormValues,
  type DeliveryWorkflowState,
  type AppPreferences,
  loadPreferences,
  emptyRevisionForm,
  emptyApprovalForm,
  sameDeliveryPlan,
} from "./AppWorkflowModels";
'''
app = replace_once(app, old_models_import, new_models_import, "workflow model imports")

app = replace_once(
    app,
    'import { getWorkflowAvailability } from "./AppWorkflowAvailability";\n',
    'import { getWorkflowAvailability } from "./AppWorkflowAvailability";\n'
    'import { useStudioWorkflow } from "./studio";\n'
    'import { useClientWorkflow } from "./client";\n'
    'import { useProjectWorkflow } from "./project";\n',
    "domain controller imports",
)

old_state_block = '''  const [studioWorkflow, setStudioWorkflow] = useState<StudioWorkflowState>({ status: "closed" });
  const [studioForm, setStudioForm] = useState<StudioFormValues>(emptyStudioForm);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const [clientWorkflow, setClientWorkflow] = useState<ClientWorkflowState>({ status: "closed" });
  const [clientForm, setClientForm] = useState<ClientFormValues>(emptyClientForm);
  const [projectWorkflow, setProjectWorkflow] = useState<ProjectWorkflowState>({ status: "closed" });
  const [projectForm, setProjectForm] = useState<ProjectFormValues>(emptyProjectForm);
'''
app = replace_once(app, old_state_block, "", "remove core workflow local state")

start_marker = "  const openStudioWorkflow = () => {\n"
end_marker = "  const loadIntakeReport = (request: IntakeRequest) => {\n"
start = app.find(start_marker)
end = app.find(end_marker)
if start == -1 or end == -1 or end <= start:
    raise SystemExit("core workflow block markers not found in expected order")

wiring = '''  const {
    studioWorkflow,
    setStudioWorkflow,
    studioForm,
    setStudioForm,
    studioNotice,
    openStudioWorkflow,
    closeStudioWorkflow,
    preflightStudio,
    confirmStudioCreation,
  } = useStudioWorkflow({
    studioCreationAvailable,
    onWorkspaceRefreshed: (refreshed) => setWorkspace({ status: "ready", value: refreshed }),
  });

  const clientController = useClientWorkflow({
    creationAvailable: clientCreationAvailable,
    setWorkspace,
    setNotice: setCreationNotice,
  });

  const projectController = useProjectWorkflow({
    creationAvailable: projectCreationAvailable,
    workspace,
    setWorkspace,
    setNotice: setProjectCreationNotice,
    onOpen: () => clientController.setState({ status: "closed" }),
    onCreated: (clientId, projectId, fromClient) => {
      setSelectedClientId(null);
      setSelectedProject({ clientId, projectId, fromClient });
      setActiveRoute("projects");
      setRouteNotice(null);
    },
  });

  const {
    state: clientWorkflow,
    setState: setClientWorkflow,
    form: clientForm,
    setForm: setClientForm,
    close: closeClientWorkflow,
    preflight: preflightClient,
    confirm: confirmClientCreation,
  } = clientController;

  const {
    state: projectWorkflow,
    setState: setProjectWorkflow,
    form: projectForm,
    setForm: setProjectForm,
    open: openProjectWorkflow,
    close: closeProjectWorkflow,
    preflight: preflightProject,
    confirm: confirmProjectCreation,
  } = projectController;

  const openClientWorkflow = () => {
    if (!clientCreationAvailable) return;
    projectController.setState({ status: "closed" });
    clientController.open();
  };

'''
app = app[:start] + wiring + app[end:]
app_path.write_text(app)

for controller_path in (Path("src/client/controller.ts"), Path("src/project/controller.ts")):
    text = controller_path.read_text()
    if "    setState,\n" not in text:
        text = replace_once(text, "  return {\n    state,\n", "  return {\n    state,\n    setState,\n", f"expose setState in {controller_path}")
        controller_path.write_text(text)
