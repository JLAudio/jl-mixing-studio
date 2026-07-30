import type { StudioCreationRequest, StudioCreationSummary } from "../types";

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

export const emptyStudioForm: StudioFormValues = {
  studioName: "",
  mixEngineer: "",
  sampleRate: "48000",
  bitDepth: "24",
  fileFormat: "WAV",
};
