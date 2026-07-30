import type {
  RevisionApprovalRequest,
  RevisionApprovalSummary,
  RevisionSummary,
} from "../types";

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

export const emptyApprovalForm: ApprovalFormValues = { approvedBy: "Client" };
