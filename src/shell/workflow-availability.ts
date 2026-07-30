import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { ResourceState } from "../AppViews";

export interface WorkflowAvailability {
  automationReady: boolean;
  clientCreationAvailable: boolean;
  clientCreationHelp: string;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
  intakeValidationAvailable: boolean;
  intakeValidationHelp: string;
  revisionCreationAvailable: boolean;
  revisionCreationHelp: string;
  revisionApprovalAvailable: boolean;
  revisionApprovalHelp: string;
  deliveryCreationSupported: boolean;
  studioCreationAvailable: boolean;
  studioCreationHelp: string;
}

export function getWorkflowAvailability(
  workspace: ResourceState<WorkspaceSnapshot>,
  version: ResourceState<VersionCheck>,
): WorkflowAvailability {
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
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Finishing the studio checks first…";
    }
    if (workspace.value.status !== "unavailable") {
      return workspace.value.studio
        ? "Your studio workspace is already set up."
        : "Fix the studio setup issue before continuing.";
    }
    if (!version.value.studioCreationSupported) return version.value.message;
    return "Review the setup, then create your studio workspace at ~/Music/Mixes.";
  })();

  const clientCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Finishing the studio checks first…";
    }
    if (!workspaceAllowsCreation) {
      return "Fix the studio setup issues before adding a client.";
    }
    if (!version.value.clientCreationSupported) return version.value.message;
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
    if (!version.value.projectCreationSupported) return version.value.message;
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

  return {
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
  };
}
