import { type FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ResourceState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import type {
  ProjectCreationRequest,
  ProjectOperationResult,
  WorkspaceSnapshot,
} from "../types";
import {
  emptyProjectForm,
  type ProjectFormValues,
  type ProjectWorkflowState,
} from "./models";

const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseProjectWorkflowOptions {
  creationAvailable: boolean;
  workspace: ResourceState<WorkspaceSnapshot>;
  setWorkspace: (state: ResourceState<WorkspaceSnapshot>) => void;
  setNotice: (notice: string | null) => void;
  onOpen?: () => void;
  onCreated: (clientId: string, projectId: string, fromClient: boolean) => void;
}

export function useProjectWorkflow({
  creationAvailable,
  workspace,
  setWorkspace,
  setNotice,
  onOpen,
  onCreated,
}: UseProjectWorkflowOptions) {
  const [state, setState] = useState<ProjectWorkflowState>({ status: "closed" });
  const [form, setForm] = useState<ProjectFormValues>(emptyProjectForm);

  const open = (clientId: string | null, fromClient: boolean) => {
    if (!creationAvailable) return;
    if (
      clientId &&
      workspace.status === "ready" &&
      !workspace.value.clients.some((client) => client.clientId === clientId)
    ) return;
    setNotice(null);
    onOpen?.();
    setForm({ ...emptyProjectForm, clientId: clientId ?? "" });
    setState({ status: "editing", lockedClientId: clientId, fromClient });
  };

  const close = () => {
    if (state.status === "preflighting" || state.status === "creating") return;
    setState({ status: "closed" });
  };

  const back = () => {
    if (state.status !== "confirming") return;
    setState({
      status: "editing",
      lockedClientId: state.fromClient ? state.request.clientId : null,
      fromClient: state.fromClient,
    });
  };

  const preflight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "editing") return;
    const { lockedClientId, fromClient } = state;
    const request: ProjectCreationRequest = {
      clientId: form.clientId.trim(),
      projectName: form.projectName.trim(),
      artist: form.artist.trim() || null,
    };
    const clientExists =
      workspace.status === "ready" &&
      workspace.value.clients.some((client) => client.clientId === request.clientId);
    if (!clientExists) {
      setState({ status: "editing", lockedClientId, fromClient, error: "Select a valid client." });
      return;
    }
    if (!request.projectName) {
      setState({ status: "editing", lockedClientId, fromClient, error: "Project name is required." });
      return;
    }

    setState({ status: "preflighting", lockedClientId, fromClient });
    await yieldToBrowserPaint();
    invoke<ProjectOperationResult>("preflight_project_creation", { request })
      .then((result) => {
        if (result.ok && result.code === "ready" && result.project) {
          setState({ status: "confirming", request, preview: result.project, fromClient });
        } else {
          setState({ status: "editing", lockedClientId, fromClient, error: result.message });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "editing",
          lockedClientId,
          fromClient,
          error: safeError(error, "The project details could not be reviewed."),
        });
      });
  };

  const confirm = async () => {
    if (state.status !== "confirming") return;
    const { request, preview, fromClient } = state;
    setState({ status: "creating", request, preview, fromClient });
    await yieldToBrowserPaint();

    invoke<ProjectOperationResult>("create_project", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.project) {
          if (result.code === "uncertain") {
            setState({ status: "uncertain", message: result.message });
          } else {
            setState({
              status: "editing",
              lockedClientId: fromClient ? request.clientId : null,
              fromClient,
              error: result.message,
            });
          }
          return;
        }
        if (
          result.project.clientId !== preview.clientId ||
          result.project.projectId !== preview.projectId
        ) {
          setState({
            status: "uncertain",
            message: "The project was created, but its details did not match what you reviewed. The result is uncertain.",
          });
          return;
        }

        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === result.project?.clientId);
          const project = client?.projects.find((item) => item.projectId === result.project?.projectId);
          if (!client || !project) {
            setState({
              status: "uncertain",
              message: "The project was created, but it was not found after refresh. The result is uncertain.",
            });
            return;
          }
          setNotice(`${project.projectName} was created with Revision 1.`);
          onCreated(client.clientId, project.projectId, fromClient);
          setState({ status: "closed" });
        } catch (error: unknown) {
          const detail = safeError(error, "");
          setState({
            status: "uncertain",
            message: `The client was created, but the studio could not be refreshed. The result is uncertain.${detail ? ` ${detail}` : ""}`,
          });
        }
      })
      .catch((error: unknown) => {
        const detail = safeError(error, "");
        setState({
          status: "uncertain",
          message: `The project creation result could not be confirmed. The operation may have completed.${detail ? ` ${detail}` : ""}`,
        });
      });
  };

  return {
    state,
    setState,
    form,
    setForm,
    open,
    close,
    back,
    preflight,
    confirm,
  };
}
