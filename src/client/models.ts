import type { ClientCreationRequest, ClientCreationSummary } from "../types";

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

export const emptyClientForm: ClientFormValues = { clientId: "", clientName: "", defaultArtist: "" };
export const clientIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
