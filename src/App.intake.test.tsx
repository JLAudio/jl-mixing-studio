import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockedInvoke,
  mockedWriteText,
  version,
  preflightResult,
  createResult,
  projectPreflightResult,
  projectCreateResult,
  revisionPreviewResult,
  revisionCreateResult,
  deliveryPreviewResult,
  deliveryCreateResult,
  approvalPreviewResult,
  approvalResult,
  intakeReport,
  intakeNotRun,
  intakePreview,
  healthyWorkspace,
  respondWith,
  resetAppTestState
} from "./App.testSupport";
import App from "./App";
import type {
  ApprovalOperationResult,
  ClientOperationResult,
  DeliveryOperationResult,
  IntakeOperationResult,
  IntakeReport,
  ProjectOperationResult,
  RevisionOperationResult,
  StudioOperationResult,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";

afterEach(cleanup);

describe("JL Mixing Studio — intake workflow", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("opens the functional Intake route and reads the authoritative report", async () => {
      const path = "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky/01_Client_Files/Original_Delivery";
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve({ ...intakePreview, code: "validated" } satisfies IntakeOperationResult);
        if (command === "resolve_folder" || command === "open_folder") return Promise.resolve({ path });
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Intake" }));

      expect(await screen.findByRole("heading", { name: "Intake validation" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "2 inspected files" })).toBeInTheDocument();
      expect(screen.getByText("one/song.wav")).toBeInTheDocument();
      expect(screen.getByText(/review duplicate filenames/i)).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("get_intake_report", {
        request: { clientId: "acme", projectId: "blue-sky" },
      });

      fireEvent.click(await screen.findByRole("button", { name: "Copy path" }));
      await waitFor(() => expect(mockedWriteText).toHaveBeenCalledWith(path));
      expect(await screen.findByText("Path copied.")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Open intake folder" }));
      await waitFor(() =>
        expect(mockedInvoke).toHaveBeenCalledWith("open_folder", {
          request: { location: "intake", clientId: "acme", projectId: "blue-sky" },
        }),
      );
      expect(await screen.findByText("Folder opened.")).toBeInTheDocument();
    });

  it("shows the authoritative not-yet-validated state", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Validate intake" }));

      expect(await screen.findByRole("heading", { name: "Intake validation has not been run" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Preview validation" })).toBeEnabled();
    });

  it("previews intake validation and cancels without updating the report", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "preflight_intake_validation") return Promise.resolve(intakePreview);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Intake" }));
      await screen.findByRole("heading", { name: "Intake validation has not been run" });
      fireEvent.click(screen.getByRole("button", { name: "Preview validation" }));

      expect(await screen.findByRole("heading", { name: "Confirm intake report update" })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("button", { name: "Update intake report" })).toHaveFocus());
      expect(screen.getByText(/intake source files will not be changed/i)).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_intake_validation", {
        request: { clientId: "acme", projectId: "blue-sky" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mockedInvoke).not.toHaveBeenCalledWith("run_intake_validation", expect.anything());
    });

  it("presents exit-code-five blocking findings as a completed preview", async () => {
      const blockingReport: IntakeReport = {
        ...intakeReport,
        blockingErrors: 1,
        criticalErrors: ["Unreadable audio file `broken.wav`: invalid data"],
      };
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "preflight_intake_validation") return Promise.resolve({
          ok: true,
          code: "blockingFindings",
          message: "Intake validation completed with blocking findings.",
          report: blockingReport,
        } satisfies IntakeOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Intake" }));
      await screen.findByRole("heading", { name: "Intake validation has not been run" });
      fireEvent.click(screen.getByRole("button", { name: "Preview validation" }));

      expect(await screen.findByRole("heading", { name: "Confirm intake report update" })).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText("Blocking errors").nextElementSibling).toHaveTextContent("1");
      expect(screen.getByRole("button", { name: "Update intake report" })).toBeEnabled();
    });

  it("updates and displays the verified authoritative intake report", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "preflight_intake_validation") return Promise.resolve(intakePreview);
        if (command === "run_intake_validation") return Promise.resolve({ ...intakePreview, code: "validated" } satisfies IntakeOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Intake" }));
      await screen.findByRole("heading", { name: "Intake validation has not been run" });
      fireEvent.click(screen.getByRole("button", { name: "Preview validation" }));
      await screen.findByRole("heading", { name: "Confirm intake report update" });
      fireEvent.click(screen.getByRole("button", { name: "Update intake report" }));

      expect(await screen.findByText(/report was updated and verified/i)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "2 inspected files" })).toBeInTheDocument();
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "run_intake_validation")).toHaveLength(1);
    });

  it("keeps existing intake reports readable while partial workspaces block validation", async () => {
      const partial = healthyWorkspace();
      partial.status = "partial";
      partial.counts.issues = 1;
      partial.issues = [{ scope: "project", code: "invalidJson", displayName: "Other Project", relativePath: "other.json", message: "Invalid JSON", recovery: "Repair it." }];
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(partial);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve({ ...intakePreview, code: "validated" } satisfies IntakeOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Intake" }));

      expect(await screen.findByRole("heading", { name: "2 inspected files" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Preview validation" })).toBeDisabled();
      expect(screen.getByText(/still read the current report/i)).toBeInTheDocument();
    });

  it("does not retry an uncertain intake-validation result", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "preflight_intake_validation") return Promise.resolve(intakePreview);
        if (command === "run_intake_validation") return Promise.resolve({ ok: false, code: "uncertain", message: "The report may have been updated; do not retry automatically.", report: null } satisfies IntakeOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Intake" }));
      await screen.findByRole("heading", { name: "Intake validation has not been run" });
      fireEvent.click(screen.getByRole("button", { name: "Preview validation" }));
      await screen.findByRole("heading", { name: "Confirm intake report update" });
      fireEvent.click(screen.getByRole("button", { name: "Update intake report" }));

      expect(await screen.findByRole("heading", { name: "Validation needs verification" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/do not retry automatically/i);
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "run_intake_validation")).toHaveLength(1);
    });
});
