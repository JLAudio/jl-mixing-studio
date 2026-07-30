import type { IntakeReport } from "../types";

export type IntakeWorkflowState =
  | { status: "closed" }
  | { status: "preflighting" }
  | { status: "confirming"; preview: IntakeReport }
  | { status: "running"; preview: IntakeReport }
  | { status: "uncertain"; message: string };
