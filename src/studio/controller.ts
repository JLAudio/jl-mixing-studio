import { useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { StudioCreationRequest, StudioOperationResult, WorkspaceSnapshot } from "../types";
import { safeError } from "../AppShellViews";
import { emptyStudioForm, type StudioFormValues, type StudioWorkflowState } from "./models";

function yieldToBrowserPaint(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export function useStudioWorkflow({
  studioCreationAvailable,
  onWorkspaceRefreshed,
}: {
  studioCreationAvailable: boolean;
  onWorkspaceRefreshed: (workspace: WorkspaceSnapshot) => void;
}) {
  const [studioWorkflow, setStudioWorkflow] = useState<StudioWorkflowState>({ status: "closed" });
  const [studioForm, setStudioForm] = useState<StudioFormValues>(emptyStudioForm);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  const openStudioWorkflow = () => {
    if (!studioCreationAvailable) return;
    setStudioNotice(null);
    setStudioForm(emptyStudioForm);
    setStudioWorkflow({ status: "editing" });
  };

  const closeStudioWorkflow = () => {
    if (studioWorkflow.status === "preflighting" || studioWorkflow.status === "creating") return;
    setStudioWorkflow({ status: "closed" });
  };

  const preflightStudio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (studioWorkflow.status !== "editing") return;
    const request: StudioCreationRequest = {
      studioName: studioForm.studioName.trim(),
      mixEngineer: studioForm.mixEngineer.trim() || null,
      sampleRate: Number(studioForm.sampleRate),
      bitDepth: Number(studioForm.bitDepth),
      fileFormat: studioForm.fileFormat,
    };
    if (!request.studioName) {
      setStudioWorkflow({ status: "editing", error: "Studio name is required." });
      return;
    }
    setStudioWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<StudioOperationResult>("preflight_studio_creation", { request })
      .then((result) => {
        if (result.ok && result.code === "ready" && result.studio) {
          setStudioWorkflow({ status: "confirming", request, preview: result.studio });
        } else {
          setStudioWorkflow({ status: "editing", error: result.message });
        }
      })
      .catch((error: unknown) => {
        setStudioWorkflow({ status: "editing", error: safeError(error, "The studio setup could not be reviewed.") });
      });
  };

  const confirmStudioCreation = async () => {
    if (studioWorkflow.status !== "confirming") return;
    const { request, preview } = studioWorkflow;
    setStudioWorkflow({ status: "creating", request, preview });
    await yieldToBrowserPaint();
    invoke<StudioOperationResult>("create_studio", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created") {
          if (result.code === "uncertain") {
            setStudioWorkflow({ status: "uncertain", message: result.message });
          } else {
            setStudioWorkflow({ status: "editing", error: result.message });
          }
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          onWorkspaceRefreshed(refreshed);
          if (!refreshed.studio || refreshed.studio.studioName !== preview.studioName) {
            setStudioWorkflow({
              status: "uncertain",
              message: "Creation succeeded, but the refreshed studio did not match the confirmed preview. Do not retry automatically.",
            });
            return;
          }
          setStudioNotice(`${refreshed.studio.studioName} was created and verified.`);
          setStudioWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setStudioWorkflow({
            status: "uncertain",
            message: safeError(error, "Creation succeeded, but the workspace could not be refreshed. Do not retry automatically."),
          });
        }
      })
      .catch((error: unknown) => {
        setStudioWorkflow({
          status: "uncertain",
          message: safeError(error, "The studio-creation result could not be confirmed. Do not retry automatically."),
        });
      });
  };

  return {
    studioWorkflow,
    setStudioWorkflow,
    studioForm,
    setStudioForm,
    studioNotice,
    openStudioWorkflow,
    closeStudioWorkflow,
    preflightStudio,
    confirmStudioCreation,
  };
}
