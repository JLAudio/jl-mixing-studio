import type {
  ClientCreationRequest,
  ClientCreationSummary,
  DeliveryCreationPreview,
  DeliveryCreationRequest,
  IntakeReport,
  ProjectCreationRequest,
  ProjectCreationSummary,
  RevisionApprovalRequest,
  RevisionApprovalSummary,
  RevisionCreationRequest,
  RevisionCreationSummary,
  RevisionSummary,
  StudioCreationRequest,
  StudioCreationSummary,
} from "./types";

/**
 * Workflow states keep preview/confirm/commit phases explicit so destructive or
 * non-idempotent operations are never retried implicitly after an uncertain result.
 */
export type ClientWorkflowState =
  | { status: "closed" }
  | { status: "editing"; error?: string }
  | { status: "preflighting" }
  | { status: "confirming"; request: ClientCreationRequest; preview: ClientCreationSummary }
  | { status: "creating"; request: ClientCreationRequest; preview: ClientCreationSummary }
  | { status: "uncertain"; message: string };

export interface ClientFormValues {
  clientId: string;
  clientName: string;
  defaultArtist: string;
}

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

export type IntakeWorkflowState =
  | { status: "closed" }
  | { status: "preflighting" }
  | { status: "confirming"; preview: IntakeReport }
  | { status: "running"; preview: IntakeReport }
  | { status: "uncertain"; message: string };

export type RevisionWorkflowState =
  | { status: "closed" }
  | { status: "editing"; error?: string }
  | { status: "preflighting" }
  | { status: "confirming"; request: RevisionCreationRequest; preview: RevisionCreationSummary }
  | { status: "creating"; request: RevisionCreationRequest; preview: RevisionCreationSummary }
  | { status: "uncertain"; message: string };

export interface RevisionFormValues {
  description: string;
}

export type ApprovalWorkflowState =
  | { status: "closed" }
  | { status: "editing"; revision: RevisionSummary; error?: string }
  | { status: "preflighting"; revision: RevisionSummary }
  | { status: "confirming"; revision: RevisionSummary; request: RevisionApprovalRequest; preview: RevisionApprovalSummary }
  | { status: "approving"; revision: RevisionSummary; request: RevisionApprovalRequest; preview: RevisionApprovalSummary }
  | { status: "uncertain"; revision: RevisionSummary; message: string };

export interface ApprovalFormValues {
  approvedBy: string;
}

export type DeliveryWorkflowState =
  | { status: "closed" }
  | { status: "options"; request: DeliveryCreationRequest }
  | { status: "preflighting"; request: DeliveryCreationRequest }
  | { status: "confirming"; request: DeliveryCreationRequest; preview: DeliveryCreationPreview }
  | { status: "creating"; request: DeliveryCreationRequest; preview: DeliveryCreationPreview }
  | { status: "uncertain"; message: string };

export type StudioWorkflowState =
  | { status: "closed" }
  | { status: "editing"; error?: string }
  | { status: "preflighting" }
  | { status: "confirming"; request: StudioCreationRequest; preview: StudioCreationSummary }
  | { status: "creating"; request: StudioCreationRequest; preview: StudioCreationSummary }
  | { status: "uncertain"; message: string };

export interface StudioFormValues {
  studioName: string;
  mixEngineer: string;
  sampleRate: string;
  bitDepth: string;
  fileFormat: string;
}

export interface AppPreferences {
  compactLayout: boolean;
  reduceMotion: boolean;
}

export const defaultPreferences: AppPreferences = { compactLayout: false, reduceMotion: false };

/**
 * Preferences are intentionally best-effort. Corrupt or older local storage must
 * never prevent the Studio UI from starting, so unsupported values fall back safely.
 */
export const loadPreferences = (): AppPreferences => {
  try {
    const parsed = JSON.parse(localStorage.getItem("jl-mixing-studio.preferences") ?? "null") as Partial<AppPreferences> | null;
    return {
      compactLayout: parsed?.compactLayout === true,
      reduceMotion: parsed?.reduceMotion === true,
    };
  } catch {
    return defaultPreferences;
  }
};

export const emptyClientForm: ClientFormValues = { clientId: "", clientName: "", defaultArtist: "" };
export const emptyProjectForm: ProjectFormValues = { clientId: "", projectName: "", artist: "" };
export const emptyStudioForm: StudioFormValues = {
  studioName: "",
  mixEngineer: "",
  sampleRate: "48000",
  bitDepth: "24",
  fileFormat: "WAV",
};
export const emptyRevisionForm: RevisionFormValues = { description: "" };
export const emptyApprovalForm: ApprovalFormValues = { approvedBy: "Client" };

export const clientIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A delivery commit is allowed only for the exact plan the user reviewed.
 * Keep this comparison in lockstep with preview fields that can change paths,
 * destructive scope, or packaged contents.
 */
export const sameDeliveryPlan = (
  left: DeliveryCreationPreview,
  right: DeliveryCreationPreview,
) =>
  left.clientId === right.clientId &&
  left.projectId === right.projectId &&
  left.projectName === right.projectName &&
  left.currentRevision === right.currentRevision &&
  left.approvedRevision === right.approvedRevision &&
  left.deliveryMethod === right.deliveryMethod &&
  left.replacementMode === right.replacementMode &&
  left.createZip === right.createZip &&
  left.deletions.length === right.deletions.length &&
  left.deletions.every((path, index) => path === right.deletions[index]) &&
  left.selected.length === right.selected.length &&
  left.selected.every((file, index) => {
    const candidate = right.selected[index];
    return candidate &&
      file.sourceName === candidate.sourceName &&
      file.deliverableType === candidate.deliverableType &&
      file.path === candidate.path;
  });
