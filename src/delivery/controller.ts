import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ResourceState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import type {
  DeliveryCreationRequest,
  DeliveryOperationResult,
  ProjectSummary,
  WorkspaceSnapshot,
} from "../types";
import { sameDeliveryPlan, type DeliveryWorkflowState } from "./models";

const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseDeliveryWorkflowOptions {
  creationAvailable: boolean;
  clientId: string | null;
  project: ProjectSummary | null;
  setWorkspace: (state: ResourceState<WorkspaceSnapshot>) => void;
}

export function useDeliveryWorkflow({
  creationAvailable,
  clientId,
  project,
  setWorkspace,
}: UseDeliveryWorkflowOptions) {
  const [state, setState] = useState<DeliveryWorkflowState>({ status: "closed" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = () => {
    if (!clientId || !project || !creationAvailable) return;
    const request: DeliveryCreationRequest = {
      clientId,
      projectId: project.projectId,
      replacementMode: project.delivery ? "overwrite" : "default",
      createZip: project.delivery !== null,
      confirmedDeletions: [],
    };
    setNotice(null);
    setActionError(null);
    setState({ status: "options", request });
  };

  const close = () => {
    if (state.status === "creating") return;
    setState({ status: "closed" });
  };

  const backToOptions = () => {
    if (state.status !== "confirming") return;
    setState({ status: "options", request: state.request });
  };

  const setRequest = (request: DeliveryCreationRequest) => {
    setState({ status: "options", request });
  };

  const preflight = async () => {
    if (state.status !== "options" || !project) return;
    const { request } = state;
    setState({ status: "preflighting", request });
    await yieldToBrowserPaint();
    invoke<DeliveryOperationResult>("preflight_delivery_creation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.delivery &&
          result.delivery.clientId === request.clientId &&
          result.delivery.projectId === request.projectId &&
          result.delivery.projectName === project.projectName &&
          result.delivery.currentRevision === project.currentRevision &&
          result.delivery.approvedRevision === project.approvedRevision &&
          result.delivery.deliveredRevision === project.deliveredRevision &&
          result.delivery.deliveryMethod === project.deliveryMethod &&
          result.delivery.replacementMode === request.replacementMode &&
          result.delivery.createZip === request.createZip &&
          result.delivery.selected.length > 0
        ) {
          setState({ status: "confirming", request, preview: result.delivery });
        } else {
          setState({ status: "closed" });
          setActionError(
            result.ok
              ? "The delivery preview no longer matches the current project. Refresh the project and review the delivery again."
              : result.message,
          );
        }
      })
      .catch((error: unknown) => {
        setState({ status: "closed" });
        setActionError(safeError(error, "The delivery preview could not be completed."));
      });
  };

  const confirm = async () => {
    if (state.status !== "confirming") return;
    const { request, preview } = state;
    const executionRequest: DeliveryCreationRequest = {
      ...request,
      confirmedDeletions: preview.replacementMode === "clean" ? preview.deletions : [],
    };
    setState({ status: "creating", request: executionRequest, preview });
    await yieldToBrowserPaint();
    invoke<DeliveryOperationResult>("create_delivery", { request: executionRequest })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.delivery) {
          if (result.code === "uncertain") {
            setState({ status: "uncertain", message: result.message });
          } else {
            setState({ status: "closed" });
            setActionError(result.message);
          }
          return;
        }
        if (
          !sameDeliveryPlan(preview, result.delivery) ||
          result.delivery.deliveredRevision !== preview.approvedRevision
        ) {
          setState({
            status: "uncertain",
            message:
              "The delivery was created, but it did not match what you confirmed. The result is uncertain; do not retry automatically.",
          });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const refreshedProject = client?.projects.find((item) => item.projectId === request.projectId);
          if (
            !refreshedProject?.delivery ||
            refreshedProject.deliveredRevision !== preview.approvedRevision
          ) {
            setState({
              status: "uncertain",
              message:
                "The delivery was created, but the refreshed delivery details did not match what you confirmed. The result is uncertain; do not retry automatically.",
            });
            return;
          }
          setNotice(
            `Revision ${refreshedProject.deliveredRevision} was packaged and verified with ${refreshedProject.delivery.files.length} delivered ${refreshedProject.delivery.files.length === 1 ? "file" : "files"}.`,
          );
          setState({ status: "closed" });
        } catch (error: unknown) {
          setState({
            status: "uncertain",
            message: safeError(
              error,
              "The delivery was created, but the studio could not be refreshed. The result is uncertain; do not retry automatically.",
            ),
          });
        }
      })
      .catch((error: unknown) => {
        setState({
          status: "uncertain",
          message: safeError(
            error,
            "The delivery-creation result could not be confirmed. The operation may have completed; do not retry automatically.",
          ),
        });
      });
  };

  return {
    state,
    setState,
    actionError,
    setActionError,
    notice,
    setNotice,
    open,
    close,
    backToOptions,
    setRequest,
    preflight,
    confirm,
  };
}
