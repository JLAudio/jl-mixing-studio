import { type FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ResourceState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import type {
  ApprovalOperationResult,
  ProjectSummary,
  RevisionApprovalRequest,
  RevisionSummary,
  WorkspaceSnapshot,
} from "../types";
import {
  emptyApprovalForm,
  type ApprovalFormValues,
  type ApprovalWorkflowState,
} from "./models";

const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseApprovalWorkflowOptions {
  approvalAvailable: boolean;
  clientId: string | null;
  project: ProjectSummary | null;
  setWorkspace: (state: ResourceState<WorkspaceSnapshot>) => void;
  onOpen?: () => void;
}

export function useApprovalWorkflow({
  approvalAvailable,
  clientId,
  project,
  setWorkspace,
  onOpen,
}: UseApprovalWorkflowOptions) {
  const [state, setState] = useState<ApprovalWorkflowState>({ status: "closed" });
  const [form, setForm] = useState<ApprovalFormValues>(emptyApprovalForm);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = (revision: RevisionSummary) => {
    if (!project || !approvalAvailable || revision.number === project.approvedRevision) return;
    setNotice(null);
    setActionError(null);
    onOpen?.();
    setForm(emptyApprovalForm);
    setState({ status: "editing", revision });
  };

  const reset = () => {
    setState({ status: "closed" });
    setActionError(null);
  };

  const close = () => {
    if (state.status === "preflighting" || state.status === "approving") return;
    setState({ status: "closed" });
  };

  const back = () => {
    if (state.status !== "confirming") return;
    setState({ status: "editing", revision: state.revision });
  };

  const preflight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "editing" || !clientId || !project) return;
    const revision = state.revision;
    const request: RevisionApprovalRequest = {
      clientId,
      projectId: project.projectId,
      revision: revision.number,
      approvedBy: form.approvedBy.trim(),
    };
    if (!request.approvedBy) {
      setState({ status: "editing", revision, error: "Enter the approver identity." });
      return;
    }
    setState({ status: "preflighting", revision });
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
          setState({ status: "confirming", revision, request, preview: result.approval });
        } else {
          setState({
            status: "editing",
            revision,
            error: result.ok
              ? "The approval preview no longer matches the current revision history. Refresh Revisions and review the approval again."
              : result.message,
          });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "editing",
          revision,
          error: safeError(error, "The approval preview could not be completed."),
        });
      });
  };

  const confirm = async () => {
    if (state.status !== "confirming") return;
    const { revision, request, preview } = state;
    setState({ status: "approving", revision, request, preview });
    await yieldToBrowserPaint();
    invoke<ApprovalOperationResult>("approve_revision", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "approved" || !result.approval) {
          if (result.code === "uncertain") {
            setState({ status: "uncertain", revision, message: result.message });
          } else {
            setState({ status: "editing", revision, error: result.message });
          }
          return;
        }
        if (
          result.approval.clientId !== preview.clientId ||
          result.approval.projectId !== preview.projectId ||
          result.approval.revision !== preview.revision ||
          result.approval.approvedBy !== preview.approvedBy ||
          !result.approval.approvedAt
        ) {
          setState({
            status: "uncertain",
            revision,
            message: "The approval was recorded, but it did not match what you reviewed. The result is uncertain; do not retry automatically.",
          });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const refreshedProject = client?.projects.find((item) => item.projectId === request.projectId);
          const approved = refreshedProject?.revisions.find((item) => item.number === request.revision);
          if (
            !refreshedProject ||
            refreshedProject.approvedRevision !== request.revision ||
            !approved ||
            approved.approvedBy !== result.approval.approvedBy ||
            approved.approvedAt !== result.approval.approvedAt
          ) {
            setState({
              status: "uncertain",
              revision,
              message: "The approval was recorded, but the refreshed project approval did not match the result. The result is uncertain; do not retry automatically.",
            });
            return;
          }
          setNotice(`Revision ${approved.number} was approved by ${approved.approvedBy} and verified.`);
          setState({ status: "closed" });
        } catch (error: unknown) {
          setState({
            status: "uncertain",
            revision,
            message: safeError(
              error,
              "The approval was recorded, but the studio could not be refreshed. The result is uncertain; do not retry automatically.",
            ),
          });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "uncertain",
          revision,
          message: safeError(
            error,
            "The revision-approval result could not be confirmed. The operation may have completed; do not retry automatically.",
          ),
        });
      });
  };

  return {
    state,
    form,
    setForm,
    actionError,
    notice,
    open,
    reset,
    close,
    back,
    preflight,
    confirm,
  };
}
