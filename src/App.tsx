import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ApprovalOperationResult,
  ClientCreationRequest,
  ClientOperationResult,
  DeliveryCreationRequest,
  DeliveryOperationResult,
  IntakeOperationResult,
  IntakeRequest,
  ProjectCreationRequest,
  ProjectOperationResult,
  RevisionApprovalRequest,
  RevisionCreationRequest,
  RevisionOperationResult,
  RevisionSummary,
  StudioCreationRequest,
  StudioOperationResult,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";
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
  type IntakeReportState,
  type ProjectView,
  type ResourceState,
} from "./AppViews";
import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";
import {
  ClientWorkflowState,
  ClientFormValues,
  ProjectWorkflowState,
  ProjectFormValues,
  IntakeWorkflowState,
  RevisionWorkflowState,
  RevisionFormValues,
  ApprovalWorkflowState,
  ApprovalFormValues,
  DeliveryWorkflowState,
  StudioWorkflowState,
  StudioFormValues,
  AppPreferences,
  loadPreferences,
  emptyClientForm,
  emptyProjectForm,
  emptyStudioForm,
  emptyRevisionForm,
  emptyApprovalForm,
  clientIdPattern,
  sameDeliveryPlan,
  DeliveryOptionsDialog,
  DeliveryDialog,
  RevisionDialog,
  ApprovalDialog,
  IntakeDialog,
  StudioRoute,
  StudioDialog,
  SettingsRoute,
  ClientDialog,
  ProjectDialog
} from "./AppWorkflows";
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
  const [studioWorkflow, setStudioWorkflow] = useState<StudioWorkflowState>({ status: "closed" });
  const [studioForm, setStudioForm] = useState<StudioFormValues>(emptyStudioForm);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const [clientWorkflow, setClientWorkflow] = useState<ClientWorkflowState>({ status: "closed" });
  const [clientForm, setClientForm] = useState<ClientFormValues>(emptyClientForm);
  const [projectWorkflow, setProjectWorkflow] = useState<ProjectWorkflowState>({ status: "closed" });
  const [projectForm, setProjectForm] = useState<ProjectFormValues>(emptyProjectForm);
  const [projectView, setProjectView] = useState<ProjectView>("overview");
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
        setIntakeReport({ status: "idle" });
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
  const automationReady =
    version.status === "ready" &&
    version.value.available &&
    version.value.supported;
  const workspaceAllowsCreation =
    workspace.status === "ready" &&
    (workspace.value.status === "healthy" || workspace.value.status === "empty");
  const clientCreationAvailable =
    workspaceAllowsCreation &&
    version.status === "ready" &&
    version.value.clientCreationSupported;
  const workspaceAllowsProjectCreation =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    workspace.value.clients.length > 0;
  const projectCreationAvailable =
    workspaceAllowsProjectCreation &&
    version.status === "ready" &&
    version.value.projectCreationSupported;
  const intakeValidationAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.intakeValidationSupported;
  const revisionCreationAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.revisionCreationSupported;
  const revisionApprovalAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.revisionApprovalSupported;
  const deliveryCreationSupported =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.deliveryCreationSupported;
  const studioCreationAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "unavailable" &&
    version.status === "ready" &&
    version.value.studioCreationSupported;
  const studioCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") return "Finishing the studio checks first…";
    if (workspace.value.status !== "unavailable") return workspace.value.studio ? "Your studio workspace is already set up." : "Fix the studio setup issue before continuing.";
    if (!version.value.studioCreationSupported) return version.value.message;
    return "Review the setup, then create your studio workspace at ~/Music/Mixes.";
  })();

  const openStudioWorkflow = () => {
    if (!studioCreationAvailable) return;
    setStudioNotice(null);
    setStudioForm(emptyStudioForm);
    setStudioWorkflow({ status: "editing" });
  };
  const closeStudioWorkflow = () => {
    if (studioWorkflow.status === "preflighting" || studioWorkflow.status === "creating") return;
    setStudioWorkflow({ status: "closed" });
  };
  const preflightStudio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (studioWorkflow.status !== "editing") return;
    const request: StudioCreationRequest = { studioName: studioForm.studioName.trim(), mixEngineer: studioForm.mixEngineer.trim() || null, sampleRate: Number(studioForm.sampleRate), bitDepth: Number(studioForm.bitDepth), fileFormat: studioForm.fileFormat };
    if (!request.studioName) { setStudioWorkflow({ status: "editing", error: "Studio name is required." }); return; }
    setStudioWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<StudioOperationResult>("preflight_studio_creation", { request }).then((result) => {
      if (result.ok && result.code === "ready" && result.studio) setStudioWorkflow({ status: "confirming", request, preview: result.studio });
      else setStudioWorkflow({ status: "editing", error: result.message });
    }).catch((error: unknown) => setStudioWorkflow({ status: "editing", error: safeError(error, "The studio setup could not be reviewed.") }));
  };
  const confirmStudioCreation = async () => {
    if (studioWorkflow.status !== "confirming") return;
    const { request, preview } = studioWorkflow;
    setStudioWorkflow({ status: "creating", request, preview });
    await yieldToBrowserPaint();
    invoke<StudioOperationResult>("create_studio", { request }).then(async (result) => {
      if (!result.ok || result.code !== "created") {
        if (result.code === "uncertain") setStudioWorkflow({ status: "uncertain", message: result.message });
        else setStudioWorkflow({ status: "editing", error: result.message });
        return;
      }
      try {
        const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
        setWorkspace({ status: "ready", value: refreshed });
        if (!refreshed.studio || refreshed.studio.studioName !== preview.studioName) { setStudioWorkflow({ status: "uncertain", message: "Creation succeeded, but the refreshed studio did not match the confirmed preview. Do not retry automatically." }); return; }
        setStudioNotice(`${refreshed.studio.studioName} was created and verified.`);
        setStudioWorkflow({ status: "closed" });
      } catch (error: unknown) { setStudioWorkflow({ status: "uncertain", message: safeError(error, "Creation succeeded, but the workspace could not be refreshed. Do not retry automatically.") }); }
    }).catch((error: unknown) => setStudioWorkflow({ status: "uncertain", message: safeError(error, "The studio-creation result could not be confirmed. Do not retry automatically.") }));
  };

  const clientCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Finishing the studio checks first…";
    }
    if (!workspaceAllowsCreation) {
      return "Fix the studio setup issues before adding a client.";
    }
    if (!version.value.clientCreationSupported) {
      return version.value.message;
    }
    return "Review the client details, then add them to your studio.";
  })();

  const projectCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Finishing the studio checks first…";
    }
    if (!workspaceAllowsProjectCreation) {
      return workspace.value.status === "empty"
        ? "Create a client before creating a project."
        : "Fix the studio setup issues before starting a project.";
    }
    if (!version.value.projectCreationSupported) {
      return version.value.message;
    }
    return "Review the project details, then create it.";
  })();

  const intakeValidationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Finishing the studio checks first…";
    }
    if (workspace.value.status !== "healthy") {
      return "You can still read the current report, but fix the studio setup issues before running intake again.";
    }
    if (!version.value.intakeValidationSupported) return version.value.message;
    return "Preview the intake check, then update the report when everything looks right.";
  })();

  const revisionCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Finishing the studio checks first…";
    }
    if (workspace.value.status !== "healthy") {
      return "You can still read the revision history, but fix the studio setup issues before creating a new revision.";
    }
    if (!version.value.revisionCreationSupported) return version.value.message;
    return "Review the next revision, then create it when you’re ready.";
  })();

  const revisionApprovalHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Finishing the studio checks first…";
    }
    if (workspace.value.status !== "healthy") {
      return "You can still read the revision history, but fix the studio setup issues before approving a revision.";
    }
    if (!version.value.revisionApprovalSupported) return version.value.message;
    return "Choose a revision, review what will change, then approve it.";
  })();

  const openClientWorkflow = () => {
    if (!clientCreationAvailable) return;
    setCreationNotice(null);
    setProjectWorkflow({ status: "closed" });
    setClientForm(emptyClientForm);
    setClientWorkflow({ status: "editing" });
  };

  const closeClientWorkflow = () => {
    if (clientWorkflow.status === "preflighting" || clientWorkflow.status === "creating") return;
    setClientWorkflow({ status: "closed" });
  };

  const openProjectWorkflow = (clientId: string | null, fromClient: boolean) => {
    if (!projectCreationAvailable) return;
    if (clientId && workspace.status === "ready" && !workspace.value.clients.some((client) => client.clientId === clientId)) return;
    setProjectCreationNotice(null);
    setClientWorkflow({ status: "closed" });
    setProjectForm({ ...emptyProjectForm, clientId: clientId ?? "" });
    setProjectWorkflow({ status: "editing", lockedClientId: clientId, fromClient });
  };

  const closeProjectWorkflow = () => {
    if (projectWorkflow.status === "preflighting" || projectWorkflow.status === "creating") return;
    setProjectWorkflow({ status: "closed" });
  };

  const preflightClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (clientWorkflow.status !== "editing") return;

    const request: ClientCreationRequest = {
      clientId: clientForm.clientId.trim(),
      clientName: clientForm.clientName.trim(),
      defaultArtist: clientForm.defaultArtist.trim() || null,
    };
    if (!clientIdPattern.test(request.clientId)) {
      setClientWorkflow({
        status: "editing",
        error: "Client ID must use lowercase letters and numbers separated by single hyphens.",
      });
      return;
    }
    if (!request.clientName) {
      setClientWorkflow({ status: "editing", error: "Display name is required." });
      return;
    }

    setClientWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<ClientOperationResult>("preflight_client_creation", { request })
      .then((result) => {
        if (result.ok && result.code === "ready" && result.client) {
          setClientWorkflow({ status: "confirming", request, preview: result.client });
        } else {
          setClientWorkflow({ status: "editing", error: result.message });
        }
      })
      .catch((error: unknown) => {
        setClientWorkflow({
          status: "editing",
          error: safeError(error, "The client details could not be reviewed."),
        });
      });
  };

  const confirmClientCreation = async () => {
    if (clientWorkflow.status !== "confirming") return;
    const { request, preview } = clientWorkflow;
    setClientWorkflow({ status: "creating", request, preview });
    await yieldToBrowserPaint();

    invoke<ClientOperationResult>("create_client", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created") {
          setClientWorkflow({ status: "editing", error: result.message });
          return;
        }

        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const discovered = refreshed.clients.some(
            (client) => client.clientId === request.clientId,
          );
          if (!discovered) {
            setClientWorkflow({
              status: "uncertain",
              message: "The client creation completed, but the new client was not found after refresh. The result is uncertain.",
            });
            return;
          }
          setCreationNotice(`${request.clientName} was added to your studio.`);
          setClientWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setClientWorkflow({
            status: "uncertain",
            message: safeError(
              error,
              "The client was created, but the studio could not be refreshed. The result is uncertain.",
            ),
          });
        }
      })
      .catch((error: unknown) => {
        setClientWorkflow({
          status: "editing",
          error: safeError(error, "Client creation could not be completed."),
        });
      });
  };

  const preflightProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectWorkflow.status !== "editing") return;
    const { lockedClientId, fromClient } = projectWorkflow;
    const request: ProjectCreationRequest = {
      clientId: projectForm.clientId.trim(),
      projectName: projectForm.projectName.trim(),
      artist: projectForm.artist.trim() || null,
    };
    const clientExists = workspace.status === "ready" && workspace.value.clients.some(
      (client) => client.clientId === request.clientId,
    );
    if (!clientExists) {
      setProjectWorkflow({ status: "editing", lockedClientId, fromClient, error: "Select a valid client." });
      return;
    }
    if (!request.projectName) {
      setProjectWorkflow({ status: "editing", lockedClientId, fromClient, error: "Project name is required." });
      return;
    }

    setProjectWorkflow({ status: "preflighting", lockedClientId, fromClient });
    await yieldToBrowserPaint();
    invoke<ProjectOperationResult>("preflight_project_creation", { request })
      .then((result) => {
        if (result.ok && result.code === "ready" && result.project) {
          setProjectWorkflow({ status: "confirming", request, preview: result.project, fromClient });
        } else {
          setProjectWorkflow({ status: "editing", lockedClientId, fromClient, error: result.message });
        }
      })
      .catch((error: unknown) => {
        setProjectWorkflow({
          status: "editing",
          lockedClientId,
          fromClient,
          error: safeError(error, "The project details could not be reviewed."),
        });
      });
  };

  const confirmProjectCreation = async () => {
    if (projectWorkflow.status !== "confirming") return;
    const { request, preview, fromClient } = projectWorkflow;
    setProjectWorkflow({ status: "creating", request, preview, fromClient });
    await yieldToBrowserPaint();

    invoke<ProjectOperationResult>("create_project", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.project) {
          if (result.code === "uncertain") {
            setProjectWorkflow({ status: "uncertain", message: result.message });
          } else {
            setProjectWorkflow({
              status: "editing",
              lockedClientId: fromClient ? request.clientId : null,
              fromClient,
              error: result.message,
            });
          }
          return;
        }
        if (
          result.project.clientId !== preview.clientId ||
          result.project.projectId !== preview.projectId
        ) {
          setProjectWorkflow({
            status: "uncertain",
            message: "The project was created, but its details did not match what you reviewed. The result is uncertain.",
          });
          return;
        }

        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === result.project?.clientId);
          const project = client?.projects.find((item) => item.projectId === result.project?.projectId);
          if (!client || !project) {
            setProjectWorkflow({
              status: "uncertain",
              message: "The project was created, but it was not found after refresh. The result is uncertain.",
            });
            return;
          }
          setProjectCreationNotice(`${project.projectName} was created with Revision 1.`);
          setSelectedClientId(null);
          setSelectedProject({ clientId: client.clientId, projectId: project.projectId, fromClient });
          setActiveRoute("projects");
          setRouteNotice(null);
          setProjectWorkflow({ status: "closed" });
        } catch (error: unknown) {
          const detail = safeError(error, "");
          setProjectWorkflow({
            status: "uncertain",
            message: `The client was created, but the studio could not be refreshed. The result is uncertain.${detail ? ` ${detail}` : ""}`,
          });
        }
      })
      .catch((error: unknown) => {
        const detail = safeError(error, "");
        setProjectWorkflow({
          status: "uncertain",
          message: `The project creation result could not be confirmed. The operation may have completed.${detail ? ` ${detail}` : ""}`,
        });
      });
  };

  const loadIntakeReport = (request: IntakeRequest) => {
    setIntakeReport({ status: "loading" });
    invoke<IntakeOperationResult>("get_intake_report", { request })
      .then((result) => setIntakeReport({ status: "ready", value: result }))
      .catch((error: unknown) => {
        setIntakeReport({ status: "error", message: safeError(error, "The intake report could not be read.") });
      });
  };

  const openIntake = () => {
    if (!resolvedProjectClient || !resolvedProject) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    setProjectView("intake");
    setIntakeWorkflow({ status: "closed" });
    setIntakeActionError(null);
    setIntakeNotice(null);
    setRevisionWorkflow({ status: "closed" });
    setApprovalWorkflow({ status: "closed" });
    loadIntakeReport(request);
  };

  const openRevisions = () => {
    if (!resolvedProjectClient || !resolvedProject) return;
    setProjectView("revisions");
    setIntakeWorkflow({ status: "closed" });
    setIntakeActionError(null);
  };

  const selectProjectView = (view: ProjectView) => {
    if (view === "intake") { openIntake(); return; }
    if (view === "revisions") { openRevisions(); return; }
    setProjectView(view);
    setIntakeWorkflow({ status: "closed" });
    setRevisionWorkflow({ status: "closed" });
    setApprovalWorkflow({ status: "closed" });
  };

  const openDeliveryWorkflow = () => {
    if (!resolvedProjectClient || !resolvedProject || !deliveryCreationAvailable) return;
    const request: DeliveryCreationRequest = {
      clientId: resolvedProjectClient.clientId,
      projectId: resolvedProject.projectId,
      replacementMode: resolvedProject.delivery ? "overwrite" : "default",
      createZip: resolvedProject.delivery !== null,
      confirmedDeletions: [],
    };
    setDeliveryNotice(null);
    setDeliveryActionError(null);
    setDeliveryWorkflow({ status: "options", request });
  };

  const preflightDelivery = async () => {
    if (deliveryWorkflow.status !== "options" || !resolvedProject) return;
    const { request } = deliveryWorkflow;
    setDeliveryWorkflow({ status: "preflighting", request });
    await yieldToBrowserPaint();
    invoke<DeliveryOperationResult>("preflight_delivery_creation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.delivery &&
          result.delivery.clientId === request.clientId &&
          result.delivery.projectId === request.projectId &&
          result.delivery.projectName === resolvedProject.projectName &&
          result.delivery.currentRevision === resolvedProject.currentRevision &&
          result.delivery.approvedRevision === resolvedProject.approvedRevision &&
          result.delivery.deliveredRevision === resolvedProject.deliveredRevision &&
          result.delivery.deliveryMethod === resolvedProject.deliveryMethod &&
          result.delivery.replacementMode === request.replacementMode &&
          result.delivery.createZip === request.createZip &&
          result.delivery.selected.length > 0
        ) {
          setDeliveryWorkflow({ status: "confirming", request, preview: result.delivery });
        } else {
          setDeliveryWorkflow({ status: "closed" });
          setDeliveryActionError(result.ok ? "The delivery preview no longer matches the current project. Refresh the project and review the delivery again." : result.message);
        }
      })
      .catch((error: unknown) => {
        setDeliveryWorkflow({ status: "closed" });
        setDeliveryActionError(safeError(error, "The delivery preview could not be completed."));
      });
  };

  const closeDeliveryWorkflow = () => {
    if (deliveryWorkflow.status === "creating") return;
    setDeliveryWorkflow({ status: "closed" });
  };

  const confirmDelivery = async () => {
    if (deliveryWorkflow.status !== "confirming") return;
    const { request, preview } = deliveryWorkflow;
    const executionRequest: DeliveryCreationRequest = {
      ...request,
      confirmedDeletions: preview.replacementMode === "clean" ? preview.deletions : [],
    };
    setDeliveryWorkflow({ status: "creating", request: executionRequest, preview });
    await yieldToBrowserPaint();
    invoke<DeliveryOperationResult>("create_delivery", { request: executionRequest })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.delivery) {
          if (result.code === "uncertain") setDeliveryWorkflow({ status: "uncertain", message: result.message });
          else {
            setDeliveryWorkflow({ status: "closed" });
            setDeliveryActionError(result.message);
          }
          return;
        }
        if (!sameDeliveryPlan(preview, result.delivery) || result.delivery.deliveredRevision !== preview.approvedRevision) {
          setDeliveryWorkflow({ status: "uncertain", message: "The delivery was created, but it did not match what you confirmed. The result is uncertain; do not retry automatically." });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const project = client?.projects.find((item) => item.projectId === request.projectId);
          if (!project?.delivery || project.deliveredRevision !== preview.approvedRevision) {
            setDeliveryWorkflow({ status: "uncertain", message: "The delivery was created, but the refreshed delivery details did not match what you confirmed. The result is uncertain; do not retry automatically." });
            return;
          }
          setDeliveryNotice(`Revision ${project.deliveredRevision} was packaged and verified with ${project.delivery.files.length} delivered ${project.delivery.files.length === 1 ? "file" : "files"}.`);
          setDeliveryWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setDeliveryWorkflow({ status: "uncertain", message: safeError(error, "The delivery was created, but the studio could not be refreshed. The result is uncertain; do not retry automatically.") });
        }
      })
      .catch((error: unknown) => {
        setDeliveryWorkflow({ status: "uncertain", message: safeError(error, "The delivery-creation result could not be confirmed. The operation may have completed; do not retry automatically.") });
      });
  };

  const openRevisionWorkflow = () => {
    if (!resolvedProjectClient || !resolvedProject || !revisionCreationAvailable) return;
    setRevisionNotice(null);
    setRevisionActionError(null);
    setIntakeWorkflow({ status: "closed" });
    setRevisionForm(emptyRevisionForm);
    setRevisionWorkflow({ status: "editing" });
    setApprovalWorkflow({ status: "closed" });
  };

  const closeRevisionWorkflow = () => {
    if (revisionWorkflow.status === "preflighting" || revisionWorkflow.status === "creating") return;
    setRevisionWorkflow({ status: "closed" });
  };

  const preflightRevision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (revisionWorkflow.status !== "editing" || !resolvedProjectClient || !resolvedProject) return;
    const request: RevisionCreationRequest = {
      clientId: resolvedProjectClient.clientId,
      projectId: resolvedProject.projectId,
      description: revisionForm.description.trim() || null,
    };
    setRevisionWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<RevisionOperationResult>("preflight_revision_creation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.revision &&
          result.revision.clientId === request.clientId &&
          result.revision.projectId === request.projectId &&
          result.revision.number === resolvedProject.currentRevision + 1
        ) {
          setRevisionWorkflow({ status: "confirming", request, preview: result.revision });
        } else {
          setRevisionWorkflow({ status: "editing", error: result.ok ? "The revision preview no longer matches the current project. Refresh Revisions and review it again." : result.message });
        }
      })
      .catch((error: unknown) => {
        setRevisionWorkflow({ status: "editing", error: safeError(error, "The revision preview could not be completed.") });
      });
  };

  const confirmRevision = async () => {
    if (revisionWorkflow.status !== "confirming") return;
    const { request, preview } = revisionWorkflow;
    setRevisionWorkflow({ status: "creating", request, preview });
    await yieldToBrowserPaint();
    invoke<RevisionOperationResult>("create_revision", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.revision) {
          if (result.code === "uncertain") setRevisionWorkflow({ status: "uncertain", message: result.message });
          else setRevisionWorkflow({ status: "editing", error: result.message });
          return;
        }
        if (
          result.revision.clientId !== preview.clientId ||
          result.revision.projectId !== preview.projectId ||
          result.revision.number !== preview.number ||
          result.revision.description !== preview.description
        ) {
          setRevisionWorkflow({ status: "uncertain", message: "The revision was created, but it did not match what you reviewed. The result is uncertain; do not retry automatically." });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const project = client?.projects.find((item) => item.projectId === request.projectId);
          const revision = project?.revisions.find((item) => item.number === preview.number);
          if (!project || project.currentRevision !== preview.number || !revision || revision.description !== preview.description) {
            setRevisionWorkflow({ status: "uncertain", message: "The revision was created, but the refreshed revision history did not match what you reviewed. The result is uncertain; do not retry automatically." });
            return;
          }
          setProjectView("revisions");
          setRevisionNotice(`Revision ${revision.number} was created and verified.`);
          setRevisionWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setRevisionWorkflow({ status: "uncertain", message: safeError(error, "The revision was created, but the studio could not be refreshed. The result is uncertain; do not retry automatically.") });
        }
      })
      .catch((error: unknown) => {
        setRevisionWorkflow({ status: "uncertain", message: safeError(error, "The revision-creation result could not be confirmed. The operation may have completed; do not retry automatically.") });
      });
  };

  const openApprovalWorkflow = (revision: RevisionSummary) => {
    if (!resolvedProject || !revisionApprovalAvailable || revision.number === resolvedProject.approvedRevision) return;
    setApprovalNotice(null);
    setApprovalActionError(null);
    setRevisionWorkflow({ status: "closed" });
    setApprovalForm(emptyApprovalForm);
    setApprovalWorkflow({ status: "editing", revision });
  };

  const closeApprovalWorkflow = () => {
    if (approvalWorkflow.status === "preflighting" || approvalWorkflow.status === "approving") return;
    setApprovalWorkflow({ status: "closed" });
  };

  const preflightApproval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (approvalWorkflow.status !== "editing" || !resolvedProjectClient || !resolvedProject) return;
    const revision = approvalWorkflow.revision;
    const request: RevisionApprovalRequest = {
      clientId: resolvedProjectClient.clientId,
      projectId: resolvedProject.projectId,
      revision: revision.number,
      approvedBy: approvalForm.approvedBy.trim(),
    };
    if (!request.approvedBy) {
      setApprovalWorkflow({ status: "editing", revision, error: "Enter the approver identity." });
      return;
    }
    setApprovalWorkflow({ status: "preflighting", revision });
    await yieldToBrowserPaint();
    invoke<ApprovalOperationResult>("preflight_revision_approval", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.approval &&
          result.approval.clientId === request.clientId &&
          result.approval.projectId === request.projectId &&
          result.approval.revision === request.revision &&
          result.approval.approvedBy === request.approvedBy &&
          result.approval.approvedAt === null
        ) {
          setApprovalWorkflow({ status: "confirming", revision, request, preview: result.approval });
        } else {
          setApprovalWorkflow({ status: "editing", revision, error: result.ok ? "The approval preview no longer matches the current revision history. Refresh Revisions and review the approval again." : result.message });
        }
      })
      .catch((error: unknown) => {
        setApprovalWorkflow({ status: "editing", revision, error: safeError(error, "The approval preview could not be completed.") });
      });
  };

  const confirmApproval = async () => {
    if (approvalWorkflow.status !== "confirming") return;
    const { revision, request, preview } = approvalWorkflow;
    setApprovalWorkflow({ status: "approving", revision, request, preview });
    await yieldToBrowserPaint();
    invoke<ApprovalOperationResult>("approve_revision", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "approved" || !result.approval) {
          if (result.code === "uncertain") setApprovalWorkflow({ status: "uncertain", revision, message: result.message });
          else setApprovalWorkflow({ status: "editing", revision, error: result.message });
          return;
        }
        if (
          result.approval.clientId !== preview.clientId ||
          result.approval.projectId !== preview.projectId ||
          result.approval.revision !== preview.revision ||
          result.approval.approvedBy !== preview.approvedBy ||
          !result.approval.approvedAt
        ) {
          setApprovalWorkflow({ status: "uncertain", revision, message: "The approval was recorded, but it did not match what you reviewed. The result is uncertain; do not retry automatically." });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const project = client?.projects.find((item) => item.projectId === request.projectId);
          const approved = project?.revisions.find((item) => item.number === request.revision);
          if (
            !project ||
            project.approvedRevision !== request.revision ||
            !approved ||
            approved.approvedBy !== result.approval.approvedBy ||
            approved.approvedAt !== result.approval.approvedAt
          ) {
            setApprovalWorkflow({ status: "uncertain", revision, message: "The approval was recorded, but the refreshed project approval did not match the result. The result is uncertain; do not retry automatically." });
            return;
          }
          setApprovalNotice(`Revision ${approved.number} was approved by ${approved.approvedBy} and verified.`);
          setApprovalWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setApprovalWorkflow({ status: "uncertain", revision, message: safeError(error, "The approval was recorded, but the studio could not be refreshed. The result is uncertain; do not retry automatically.") });
        }
      })
      .catch((error: unknown) => {
        setApprovalWorkflow({ status: "uncertain", revision, message: safeError(error, "The revision-approval result could not be confirmed. The operation may have completed; do not retry automatically.") });
      });
  };

  const preflightIntake = async () => {
    if (!resolvedProjectClient || !resolvedProject || !intakeValidationAvailable) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    setIntakeActionError(null);
    setIntakeNotice(null);
    setIntakeWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<IntakeOperationResult>("preflight_intake_validation", { request })
      .then((result) => {
        if (result.ok && result.report && (result.code === "ready" || result.code === "blockingFindings")) {
          setIntakeWorkflow({ status: "confirming", preview: result.report });
        } else {
          setIntakeWorkflow({ status: "closed" });
          setIntakeActionError(result.message);
        }
      })
      .catch((error: unknown) => {
        setIntakeWorkflow({ status: "closed" });
        setIntakeActionError(safeError(error, "The intake preview could not be completed."));
      });
  };

  const confirmIntake = async () => {
    if (intakeWorkflow.status !== "confirming" || !resolvedProjectClient || !resolvedProject) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    const preview = intakeWorkflow.preview;
    setIntakeWorkflow({ status: "running", preview });
    await yieldToBrowserPaint();
    invoke<IntakeOperationResult>("run_intake_validation", { request })
      .then((result) => {
        if (result.code === "uncertain") {
          setIntakeWorkflow({ status: "uncertain", message: result.message });
          return;
        }
        if (!result.ok || !result.report || (result.code !== "validated" && result.code !== "blockingFindings")) {
          setIntakeWorkflow({ status: "closed" });
          setIntakeActionError(result.message);
          return;
        }
        if (result.report.clientId !== request.clientId || result.report.projectId !== request.projectId) {
          setIntakeWorkflow({ status: "uncertain", message: "The intake report was updated, but its project identity could not be verified. Do not retry automatically." });
          return;
        }
        setIntakeReport({ status: "ready", value: result });
        setIntakeWorkflow({ status: "closed" });
        setIntakeNotice(result.report.blockingErrors > 0 ? "The intake report was updated with blocking findings." : "The intake report was updated and verified.");
      })
      .catch((error: unknown) => {
        setIntakeWorkflow({ status: "uncertain", message: safeError(error, "The intake-validation result could not be confirmed. The report may have been updated; do not retry automatically.") });
      });
  };

  const navigate = (route: PrimaryRoute) => {
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

  const resolvedClient = workspace.status === "ready" && selectedClientId
    ? workspace.value.clients.find((client) => client.clientId === selectedClientId) ?? null
    : null;
  const resolvedProjectClient = workspace.status === "ready" && selectedProject
    ? workspace.value.clients.find((client) => client.clientId === selectedProject.clientId) ?? null
    : null;
  const resolvedProject = resolvedProjectClient && selectedProject
    ? resolvedProjectClient.projects.find((project) => project.projectId === selectedProject.projectId) ?? null
    : null;
  const openDerivedProject = (clientId: string, projectId: string) => {
    setSelectedClientId(null); setSelectedProject({ clientId, projectId, fromClient: false });
    setProjectView("overview"); setActiveRoute("projects"); setRouteNotice(null);
  };
  const deliveryCreationAvailable =
    deliveryCreationSupported &&
    resolvedProject !== null &&
    resolvedProject.approvedRevision !== null &&
    ((resolvedProject.deliveredRevision === null && resolvedProject.delivery === null) ||
      (resolvedProject.deliveredRevision !== null && resolvedProject.delivery !== null));
  const deliveryCreationHelp = (() => {
    if (!resolvedProject) return "Select a project before creating a delivery.";
    if (workspace.status !== "ready" || version.status !== "ready") return "Finishing the studio checks first…";
    if (workspace.value.status !== "healthy") return "You can still read the delivery history, but fix the studio setup issues before creating a package.";
    if (!version.value.deliveryCreationSupported) return version.value.message;
    if (resolvedProject.approvedRevision === null) return "Approve a revision before creating the first delivery package.";
    if (resolvedProject.deliveredRevision !== null && resolvedProject.delivery !== null) return "Preview a same-path overwrite that preserves edited Delivery Notes and unrelated package files; optionally rebuild the ZIP.";
    return "Preview the first delivery package, then create it with SHA-256 file verification and an optional ZIP.";
  })();
  const baseRouteDefinition = routes.find((route) => route.id === activeRoute) ?? routes[0];
  const activeRouteDefinition: RouteDefinition = resolvedProject
    ? {
        id: "projects",
        label: "Projects",
        eyebrow: projectView === "intake" ? "Project intake" : projectView === "revisions" ? "Project revisions" : projectView === "delivery" ? "Project delivery" : "Project overview",
        title: resolvedProject.projectName,
        description: projectView === "intake" ? `${resolvedProject.artist} · Check the files before mixing.` : projectView === "revisions" ? `${resolvedProject.artist} · Revisions, approvals, and mix history.` : projectView === "delivery" ? `${resolvedProject.artist} · Final files and delivery status.` : `${resolvedProject.artist} · Project details and next steps.`,
      }
    : resolvedClient
      ? {
          id: "clients",
          label: "Clients",
          eyebrow: "Client details",
          title: resolvedClient.clientName,
          description: "Client details, defaults, and projects in your studio.",
        }
      : baseRouteDefinition;

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
            onOverview={() => { setProjectView("overview"); setIntakeWorkflow({ status: "closed" }); setIntakeActionError(null); }}
            onPreview={preflightIntake}
            onRefresh={() => {
              refresh();
              loadIntakeReport({ clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId });
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
          onClose={() => {
            if (intakeWorkflow.status === "running") return;
            setIntakeWorkflow({ status: "closed" });
            if (resolvedProjectClient && resolvedProject) {
              loadIntakeReport({ clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId });
            }
          }}
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
          onBack={() => {
            if (revisionWorkflow.status !== "confirming") return;
            setRevisionWorkflow({ status: "editing" });
          }}
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
          onBack={() => {
            if (approvalWorkflow.status !== "confirming") return;
            setApprovalWorkflow({ status: "editing", revision: approvalWorkflow.revision });
          }}
          onClose={closeApprovalWorkflow}
        />
      )}
      {deliveryWorkflow.status === "options" && resolvedProject && (
        <DeliveryOptionsDialog
          request={deliveryWorkflow.request}
          projectName={resolvedProject.projectName}
          onChange={(request) => setDeliveryWorkflow({ status: "options", request })}
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
