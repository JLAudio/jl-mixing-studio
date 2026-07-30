import type { RevisionCreationRequest, RevisionCreationSummary } from "../types";

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

export const emptyRevisionForm: RevisionFormValues = { description: "" };
