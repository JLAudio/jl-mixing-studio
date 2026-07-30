import type { ProjectCreationRequest, ProjectCreationSummary } from "../types";

export type ProjectWorkflowState =
  | { status: "closed" }
  | { status: "editing"; lockedClientId: string | null; fromClient: boolean; error?: string }
  | { status: "preflighting"; lockedClientId: string | null; fromClient: boolean }
  | { status: "confirming"; request: ProjectCreationRequest; preview: ProjectCreationSummary; fromClient: boolean }
  | { status: "creating"; request: ProjectCreationRequest; preview: ProjectCreationSummary; fromClient: boolean }
  | { status: "uncertain"; message: string };

export interface ProjectFormValues {
  clientId: string;
  projectName: string;
  artist: string;
}

export const emptyProjectForm: ProjectFormValues = { clientId: "", projectName: "", artist: "" };
