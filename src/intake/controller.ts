import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { IntakeReportState } from "../AppShellViews";
import { safeError } from "../AppShellViews";
import type { IntakeOperationResult, IntakeRequest } from "../types";
import type { IntakeWorkflowState } from "./models";

const yieldToBrowserPaint = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

export interface UseIntakeWorkflowOptions {
  validationAvailable: boolean;
  clientId: string | null;
  projectId: string | null;
  onOpen?: () => void;
}

export function useIntakeWorkflow({
  validationAvailable,
  clientId,
  projectId,
  onOpen,
}: UseIntakeWorkflowOptions) {
  const [reportState, setReportState] = useState<IntakeReportState>({ status: "idle" });
  const [state, setState] = useState<IntakeWorkflowState>({ status: "closed" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentRequest = (): IntakeRequest | null =>
    clientId && projectId ? { clientId, projectId } : null;

  const loadReport = (request: IntakeRequest) => {
    setReportState({ status: "loading" });
    invoke<IntakeOperationResult>("get_intake_report", { request })
      .then((result) => setReportState({ status: "ready", value: result }))
      .catch((error: unknown) => {
        setReportState({
          status: "error",
          message: safeError(error, "The intake report could not be read."),
        });
      });
  };

  const reload = () => {
    const request = currentRequest();
    if (request) loadReport(request);
  };

  const open = () => {
    const request = currentRequest();
    if (!request) return;
    onOpen?.();
    setState({ status: "closed" });
    setActionError(null);
    setNotice(null);
    loadReport(request);
  };

  const reset = () => {
    setState({ status: "closed" });
    setActionError(null);
  };

  const clear = () => {
    reset();
    setReportState({ status: "idle" });
  };

  const preflight = async () => {
    const request = currentRequest();
    if (!request || !validationAvailable) return;
    setActionError(null);
    setNotice(null);
    setState({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<IntakeOperationResult>("preflight_intake_validation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.report &&
          (result.code === "ready" || result.code === "blockingFindings")
        ) {
          setState({ status: "confirming", preview: result.report });
        } else {
          setState({ status: "closed" });
          setActionError(result.message);
        }
      })
      .catch((error: unknown) => {
        setState({ status: "closed" });
        setActionError(safeError(error, "The intake preview could not be completed."));
      });
  };

  const confirm = async () => {
    const request = currentRequest();
    if (state.status !== "confirming" || !request) return;
    const preview = state.preview;
    setState({ status: "running", preview });
    await yieldToBrowserPaint();
    invoke<IntakeOperationResult>("run_intake_validation", { request })
      .then((result) => {
        if (result.code === "uncertain") {
          setState({ status: "uncertain", message: result.message });
          return;
        }
        if (
          !result.ok ||
          !result.report ||
          (result.code !== "validated" && result.code !== "blockingFindings")
        ) {
          setState({ status: "closed" });
          setActionError(result.message);
          return;
        }
        if (
          result.report.clientId !== request.clientId ||
          result.report.projectId !== request.projectId
        ) {
          setState({
            status: "uncertain",
            message: "The intake report was updated, but its project identity could not be verified. Do not retry automatically.",
          });
          return;
        }
        setReportState({ status: "ready", value: result });
        setState({ status: "closed" });
        setNotice(
          result.report.blockingErrors > 0
            ? "The intake report was updated with blocking findings."
            : "The intake report was updated and verified.",
        );
      })
      .catch((error: unknown) => {
        setState({
          status: "uncertain",
          message: safeError(
            error,
            "The intake-validation result could not be confirmed. The report may have been updated; do not retry automatically.",
          ),
        });
      });
  };

  const closeDialog = () => {
    if (state.status === "running") return;
    setState({ status: "closed" });
    reload();
  };

  return {
    state,
    reportState,
    actionError,
    notice,
    open,
    reset,
    clear,
    reload,
    preflight,
    confirm,
    closeDialog,
  };
}
