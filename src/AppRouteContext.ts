import type { ClientSummary, ProjectSummary, VersionCheck, WorkspaceSnapshot } from "./types";
import type { ProjectView, ResourceState } from "./AppViews";
import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";

export interface SelectedProject {
  clientId: string;
  projectId: string;
  fromClient: boolean;
}

export interface AppRouteContext {
  resolvedClient: ClientSummary | null;
  resolvedProjectClient: ClientSummary | null;
  resolvedProject: ProjectSummary | null;
  deliveryCreationAvailable: boolean;
  deliveryCreationHelp: string;
  activeRouteDefinition: RouteDefinition;
}

export function getAppRouteContext(
  workspace: ResourceState<WorkspaceSnapshot>,
  version: ResourceState<VersionCheck>,
  selectedClientId: string | null,
  selectedProject: SelectedProject | null,
  activeRoute: PrimaryRoute,
  projectView: ProjectView,
  deliveryCreationSupported: boolean,
): AppRouteContext {
  const resolvedClient = workspace.status === "ready" && selectedClientId
    ? workspace.value.clients.find((client) => client.clientId === selectedClientId) ?? null
    : null;
  const resolvedProjectClient = workspace.status === "ready" && selectedProject
    ? workspace.value.clients.find((client) => client.clientId === selectedProject.clientId) ?? null
    : null;
  const resolvedProject = resolvedProjectClient && selectedProject
    ? resolvedProjectClient.projects.find((project) => project.projectId === selectedProject.projectId) ?? null
    : null;

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

  return {
    resolvedClient,
    resolvedProjectClient,
    resolvedProject,
    deliveryCreationAvailable,
    deliveryCreationHelp,
    activeRouteDefinition,
  };
}
