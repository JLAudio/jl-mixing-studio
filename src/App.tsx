import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VersionCheck, WorkspaceSnapshot } from "./types";
import {
  ActivityRoute,
  ClientDetails,
  ClientsRoute,
  Dashboard,
  DeliveryView,
  IntakeView,
  ProjectArtifactsView,
  ProjectOverview,
  ProjectsRoute,
  ReportsRoute,
  RevisionsView,
  RouteHeader,
  Sidebar,
  TasksRoute,
  safeError,
  type ProjectView,
  type ResourceState,
} from "./AppViews";
import type { PrimaryRoute } from "./ui/routes";
import { getAppRouteContext } from "./AppRouteContext";
import {
  DeliveryOptionsDialog,
  DeliveryDialog,
  RevisionDialog,
  ApprovalDialog,
  IntakeDialog,
  StudioRoute,
  StudioDialog,
  SettingsRoute,
  ClientDialog,
  ProjectDialog,
} from "./AppWorkflows";
import {
  type AppPreferences,
  loadPreferences,
} from "./AppWorkflowModels";
import { getWorkflowAvailability } from "./AppWorkflowAvailability";
import { useStudioWorkflow } from "./studio";
import { useClientWorkflow } from "./client";
import { useProjectWorkflow } from "./project";
import { useIntakeWorkflow } from "./intake";
import { useRevisionWorkflow } from "./revision";
import { useApprovalWorkflow } from "./approval";
import { useDeliveryWorkflow } from "./delivery";
import "./App.css";

/**
 * Lets React commit a busy state and gives the WebView a paint opportunity
 * before native or CLI work begins.
 */
function yieldToBrowserPaint(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export default function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(loadPreferences);
  const [activeRoute, setActiveRoute] = useState<PrimaryRoute>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<{
    clientId: string;
    projectId: string;
    fromClient: boolean;
  } | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ResourceState<WorkspaceSnapshot>>({ status: "loading" });
  const [version, setVersion] = useState<ResourceState<VersionCheck>>({ status: "loading" });
  const [projectView, setProjectView] = useState<ProjectView>("overview");
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
  const [projectCreationNotice, setProjectCreationNotice] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setWorkspace({ status: "loading" });
    setVersion({ status: "loading" });
    await yieldToBrowserPaint();

    invoke<WorkspaceSnapshot>("discover_default_workspace")
      .then((value) => {
        if (requestId.current === currentRequest) setWorkspace({ status: "ready", value });
      })
      .catch((error: unknown) => {
        if (requestId.current === currentRequest) {
          setWorkspace({ status: "error", message: safeError(error, "Workspace discovery could not be completed.") });
        }
      });

    invoke<VersionCheck>("get_jl_mixing_version")
      .then((value) => {
        if (requestId.current === currentRequest) setVersion({ status: "ready", value });
      })
      .catch((error: unknown) => {
        if (requestId.current === currentRequest) {
          setVersion({ status: "error", message: safeError(error, "JL Mixing Automation could not be checked.") });
        }
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (workspace.status !== "ready") return;
    if (selectedProject) {
      const client = workspace.value.clients.find((item) => item.clientId === selectedProject.clientId);
      const project = client?.projects.find((item) => item.projectId === selectedProject.projectId);
      if (!client || !project) {
        setSelectedProject(null);
        setProjectView("overview");
        clearIntakeWorkflow();
        setSelectedClientId(null);
        setActiveRoute("projects");
        setRouteNotice("The selected project is no longer available in the refreshed workspace.");
      }
      return;
    }
    if (selectedClientId && !workspace.value.clients.some((item) => item.clientId === selectedClientId)) {
      setSelectedClientId(null);
      setActiveRoute("clients");
      setRouteNotice("The selected client is no longer available in the refreshed workspace.");
    }
  }, [workspace, selectedClientId, selectedProject]);

  const loading = workspace.status === "loading" || version.status === "loading";
  const {
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
  } = getWorkflowAvailability(workspace, version);

  const {
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

  const {
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

  const intakeController = useIntakeWorkflow({
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

  const navigate = (route: PrimaryRoute) => {
    setActiveRoute(route);
    setSelectedClientId(null);
    setSelectedProject(null);
    setProjectView("overview");
    clearIntakeWorkflow();
    resetRevisionWorkflow();
    resetApprovalWorkflow();
    setRouteNotice(null);
  };

  const openDerivedProject = (clientId: string, projectId: string) => {
    setSelectedClientId(null); setSelectedProject({ clientId, projectId, fromClient: false });
    setProjectView("overview"); setActiveRoute("projects"); setRouteNotice(null);
  };

  return (
    <div className={`app-shell${preferences.compactLayout ? " compact-layout" : ""}${preferences.reduceMotion ? " reduce-motion" : ""}`}>
      <Sidebar activeRoute={activeRoute} onNavigate={navigate} workspace={workspace} />
      <main className="main-content" id="main-content">
        <RouteHeader route={activeRouteDefinition} />
        {routeNotice && <section className="notice warning" role="status"><strong>Selection changed</strong><span>{routeNotice}</span></section>}
        {studioNotice && <section className="notice success" role="status"><strong>Studio created</strong><span>{studioNotice}</span></section>}
        {creationNotice && (
          <section className="notice success" role="status">
            <strong>Client created</strong>
            <span>{creationNotice}</span>
          </section>
        )}
        {projectCreationNotice && (
          <section className="notice success" role="status">
            <strong>Project created</strong>
            <span>{projectCreationNotice}</span>
          </section>
        )}
        {intakeNotice && (
          <section className="notice success" role="status"><strong>Intake report updated</strong><span>{intakeNotice}</span></section>
        )}
        {revisionNotice && (
          <section className="notice success" role="status"><strong>Revision created</strong><span>{revisionNotice}</span></section>
        )}
        {approvalNotice && (
          <section className="notice success" role="status"><strong>Revision approved</strong><span>{approvalNotice}</span></section>
        )}
        {deliveryNotice && (
          <section className="notice success" role="status"><strong>Delivery created</strong><span>{deliveryNotice}</span></section>
        )}
        {activeRoute === "dashboard" && (
          <Dashboard
            workspace={workspace}
            version={version}
            automationReady={automationReady}
            loading={loading}
            clientCreationAvailable={clientCreationAvailable}
            clientCreationHelp={clientCreationHelp}
            projectCreationAvailable={projectCreationAvailable}
            projectCreationHelp={projectCreationHelp}
            onRefresh={refresh}
            onNewClient={openClientWorkflow}
            onNewProject={() => openProjectWorkflow(null, false)}
            onTasks={() => navigate("tasks")}
            onActivity={() => navigate("activity")}
            onOpenProject={openDerivedProject}
          />
        )}
        {activeRoute === "studio" && <StudioRoute workspace={workspace} version={version} loading={loading} setupAvailable={studioCreationAvailable} setupHelp={studioCreationHelp} onSetup={openStudioWorkflow} onRefresh={refresh} />}
        {activeRoute === "tasks" && <TasksRoute workspace={workspace} loading={loading} onRefresh={refresh} onOpenProject={openDerivedProject} />}
        {activeRoute === "activity" && <ActivityRoute workspace={workspace} loading={loading} onRefresh={refresh} onOpenProject={openDerivedProject} />}
        {activeRoute === "reports" && <ReportsRoute workspace={workspace} onOpenProject={(clientId, projectId) => { openDerivedProject(clientId, projectId); setProjectView("reports"); }} />}
        {activeRoute === "settings" && <SettingsRoute preferences={preferences} onChange={setPreferences} workspace={workspace} version={version} />}
        {activeRoute === "clients" && (resolvedClient ? (
          <ClientDetails
            client={resolvedClient}
            onBack={() => { setSelectedClientId(null); setRouteNotice(null); }}
            onRefresh={refresh}
            loading={loading}
            onNewProject={() => openProjectWorkflow(resolvedClient.clientId, true)}
            projectCreationAvailable={projectCreationAvailable}
            projectCreationHelp={projectCreationHelp}
            onSelectProject={(projectId) => {
              setSelectedProject({ clientId: resolvedClient.clientId, projectId, fromClient: true });
              setProjectView("overview");
              setActiveRoute("projects");
              setRouteNotice(null);
            }}
          />
        ) : (
          <ClientsRoute
            workspace={workspace}
            onSelectClient={(clientId) => { setSelectedClientId(clientId); setRouteNotice(null); }}
            onNewClient={openClientWorkflow}
            onRefresh={refresh}
            loading={loading}
            clientCreationAvailable={clientCreationAvailable}
            clientCreationHelp={clientCreationHelp}
          />
        ))}
        {activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject && (projectView === "reports" || projectView === "files" || projectView === "metadata") ? (
          <ProjectArtifactsView active={projectView} client={resolvedProjectClient} project={resolvedProject} onSelectView={selectProjectView} />
        ) : activeRoute === "projects" && resolvedProject && selectedProject && projectView === "delivery" ? (
          <DeliveryView clientId={resolvedProjectClient?.clientId ?? ""} project={resolvedProject} loading={loading || deliveryWorkflow.status === "preflighting" || deliveryWorkflow.status === "creating"} actionError={deliveryActionError} creationAvailable={deliveryCreationAvailable} creationHelp={deliveryCreationHelp} onOverview={() => setProjectView("overview")} onCreate={openDeliveryWorkflow} onRefresh={refresh} onSelectView={selectProjectView} />
        ) : activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject && projectView === "revisions" ? (
          <RevisionsView
            client={resolvedProjectClient}
            project={resolvedProject}
            loading={loading}
            actionError={revisionActionError ?? approvalActionError}
            creationAvailable={revisionCreationAvailable}
            creationHelp={revisionCreationHelp}
            approvalAvailable={revisionApprovalAvailable}
            approvalHelp={revisionApprovalHelp}
            onOverview={() => setProjectView("overview")}
            onRefresh={refresh}
            onNewRevision={openRevisionWorkflow}
            onApprove={openApprovalWorkflow}
            onSelectView={selectProjectView}
          />
        ) : activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject && projectView === "intake" ? (
          <IntakeView
            client={resolvedProjectClient}
            project={resolvedProject}
            reportState={intakeReport}
            actionError={intakeActionError}
            validationAvailable={intakeValidationAvailable}
            validationHelp={intakeValidationHelp}
            loading={loading || intakeWorkflow.status === "preflighting"}
            onOverview={() => { setProjectView("overview"); resetIntakeWorkflow(); }}
            onPreview={preflightIntake}
            onRefresh={() => {
              refresh();
              reloadIntakeReport();
            }}
            onSelectView={selectProjectView}
          />
        ) : activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject ? (
          <ProjectOverview
            client={resolvedProjectClient}
            project={resolvedProject}
            fromClient={selectedProject.fromClient}
            onProjects={() => { setSelectedProject(null); setSelectedClientId(null); setProjectView("overview"); setRouteNotice(null); }}
            onClient={() => {
              setSelectedProject(null);
              setProjectView("overview");
              setSelectedClientId(resolvedProjectClient.clientId);
              setActiveRoute("clients");
              setRouteNotice(null);
            }}
            onRefresh={refresh}
            onIntake={openIntake}
            onRevisions={openRevisions}
            onNewRevision={openRevisionWorkflow}
            revisionCreationAvailable={revisionCreationAvailable}
            revisionCreationHelp={revisionCreationHelp}
            loading={loading}
            onSelectView={selectProjectView}
          />
        ) : activeRoute === "projects" ? (
          <ProjectsRoute
            workspace={workspace}
            onRefresh={refresh}
            loading={loading}
            onNewProject={() => openProjectWorkflow(null, false)}
            projectCreationAvailable={projectCreationAvailable}
            projectCreationHelp={projectCreationHelp}
            onSelectProject={(clientId, projectId) => {
              setSelectedClientId(null);
              setSelectedProject({ clientId, projectId, fromClient: false });
              setProjectView("overview");
              setRouteNotice(null);
            }}
          />
        ) : null}
      </main>

      {studioWorkflow.status !== "closed" && <StudioDialog state={studioWorkflow} values={studioForm} onChange={setStudioForm} onPreflight={preflightStudio} onConfirm={confirmStudioCreation} onBack={() => setStudioWorkflow({ status: "editing" })} onClose={closeStudioWorkflow} />}

      {clientWorkflow.status !== "closed" && (
        <ClientDialog
          state={clientWorkflow}
          values={clientForm}
          onChange={setClientForm}
          onPreflight={preflightClient}
          onConfirm={confirmClientCreation}
          onBack={() => setClientWorkflow({ status: "editing" })}
          onClose={closeClientWorkflow}
        />
      )}
      {projectWorkflow.status !== "closed" && (
        <ProjectDialog
          state={projectWorkflow}
          values={projectForm}
          clients={workspace.status === "ready" ? workspace.value.clients : []}
          onChange={setProjectForm}
          onPreflight={preflightProject}
          onConfirm={confirmProjectCreation}
          onBack={() => {
            if (projectWorkflow.status !== "confirming") return;
            setProjectWorkflow({
              status: "editing",
              lockedClientId: projectWorkflow.fromClient ? projectWorkflow.request.clientId : null,
              fromClient: projectWorkflow.fromClient,
            });
          }}
          onClose={closeProjectWorkflow}
        />
      )}
      {intakeWorkflow.status !== "closed" && intakeWorkflow.status !== "preflighting" && (
        <IntakeDialog
          state={intakeWorkflow}
          onConfirm={confirmIntake}
          onClose={closeIntakeDialog}
        />
      )}
      {revisionWorkflow.status !== "closed" && resolvedProject && (
        <RevisionDialog
          state={revisionWorkflow}
          values={revisionForm}
          project={resolvedProject}
          onChange={setRevisionForm}
          onPreflight={preflightRevision}
          onConfirm={confirmRevision}
          onBack={backRevisionWorkflow}
          onClose={closeRevisionWorkflow}
        />
      )}
      {approvalWorkflow.status !== "closed" && resolvedProject && (
        <ApprovalDialog
          state={approvalWorkflow}
          values={approvalForm}
          project={resolvedProject}
          onChange={setApprovalForm}
          onPreflight={preflightApproval}
          onConfirm={confirmApproval}
          onBack={backApprovalWorkflow}
          onClose={closeApprovalWorkflow}
        />
      )}
      {deliveryWorkflow.status === "options" && resolvedProject && (
        <DeliveryOptionsDialog
          request={deliveryWorkflow.request}
          projectName={resolvedProject.projectName}
          onChange={setDeliveryRequest}
          onPreview={preflightDelivery}
          onClose={closeDeliveryWorkflow}
        />
      )}
      {deliveryWorkflow.status !== "closed" && deliveryWorkflow.status !== "options" && deliveryWorkflow.status !== "preflighting" && (
        <DeliveryDialog
          state={deliveryWorkflow}
          onConfirm={confirmDelivery}
          onClose={() => {
            closeDeliveryWorkflow();
            if (deliveryWorkflow.status === "uncertain") refresh();
          }}
        />
      )}
    </div>
  );
}
