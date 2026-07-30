import { type FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ResourceState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import type {
  ProjectSummary,
  RevisionCreationRequest,
  RevisionOperationResult,
  WorkspaceSnapshot,
} from "../types";
import {
  emptyRevisionForm,
  type RevisionFormValues,
  type RevisionWorkflowState,
} from "./models";

const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseRevisionWorkflowOptions {
  creationAvailable: boolean;
  clientId: string | null;
  project: ProjectSummary | null;
  setWorkspace: (state: ResourceState<WorkspaceSnapshot>) => void;
  onOpen?: () => void;
  onCreated?: () => void;
}

export function useRevisionWorkflow({
  creationAvailable,
  clientId,
  project,
  setWorkspace,
  onOpen,
  onCreated,
}: UseRevisionWorkflowOptions) {
  const [state, setState] = useState<RevisionWorkflowState>({ status: "closed" });
  const [form, setForm] = useState<RevisionFormValues>(emptyRevisionForm);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = () => {
    if (!clientId || !project || !creationAvailable) return;
    setNotice(null);
    setActionError(null);
    onOpen?.();
    setForm(emptyRevisionForm);
    setState({ status: "editing" });
  };

  const reset = () => {
    setState({ status: "closed" });
    setActionError(null);
  };

  const close = () => {
    if (state.status === "preflighting" || state.status === "creating") return;
    setState({ status: "closed" });
  };

  const back = () => {
    if (state.status !== "confirming") return;
    setState({ status: "editing" });
  };

  const preflight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "editing" || !clientId || !project) return;
    const request: RevisionCreationRequest = {
      clientId,
      projectId: project.projectId,
      description: form.description.trim() || null,
    };
    setState({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<RevisionOperationResult>("preflight_revision_creation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.revision &&
          result.revision.clientId === request.clientId &&
          result.revision.projectId === request.projectId &&
          result.revision.number === project.currentRevision + 1
        ) {
          setState({ status: "confirming", request, preview: result.revision });
        } else {
          setState({
            status: "editing",
            error: result.ok
              ? "The revision preview no longer matches the current project. Refresh Revisions and review it again."
              : result.message,
          });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "editing",
          error: safeError(error, "The revision preview could not be completed."),
        });
      });
  };

  const confirm = async () => {
    if (state.status !== "confirming") return;
    const { request, preview } = state;
    setState({ status: "creating", request, preview });
    await yieldToBrowserPaint();
    invoke<RevisionOperationResult>("create_revision", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.revision) {
          if (result.code === "uncertain") {
            setState({ status: "uncertain", message: result.message });
          } else {
            setState({ status: "editing", error: result.message });
          }
          return;
        }
        if (
          result.revision.clientId !== preview.clientId ||
          result.revision.projectId !== preview.projectId ||
          result.revision.number !== preview.number ||
          result.revision.description !== preview.description
        ) {
          setState({
            status: "uncertain",
            message: "The revision was created, but it did not match what you reviewed. The result is uncertain; do not retry automatically.",
          });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const refreshedProject = client?.projects.find((item) => item.projectId === request.projectId);
          const revision = refreshedProject?.revisions.find((item) => item.number === preview.number);
          if (
            !refreshedProject ||
            refreshedProject.currentRevision !== preview.number ||
            !revision ||
            revision.description !== preview.description
          ) {
            setState({
              status: "uncertain",
              message: "The revision was created, but the refreshed revision history did not match what you reviewed. The result is uncertain; do not retry automatically.",
            });
            return;
          }
          onCreated?.();
          setNotice(`Revision ${revision.number} was created and verified.`);
          setState({ status: "closed" });
        } catch (error: unknown) {
          setState({
            status: "uncertain",
            message: safeError(
              error,
              "The revision was created, but the studio could not be refreshed. The result is uncertain; do not retry automatically.",
            ),
          });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "uncertain",
          message: safeError(
            error,
            "The revision-creation result could not be confirmed. The operation may have completed; do not retry automatically.",
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
