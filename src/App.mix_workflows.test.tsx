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

describe("JL Mixing Studio — revision, approval, and delivery workflows", () => {
  beforeEach(() => {
    resetAppTestState();
  });

  it("opens authoritative revision history and selects an older approved revision", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));

      expect(screen.getByRole("heading", { name: "Revision history" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New revision" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Approve revision" })).toBeEnabled();
      expect(screen.getByRole("heading", { name: "Revision 2" })).toBeInTheDocument();
      expect(screen.getByText("Balance update")).toBeInTheDocument();
      expect(screen.getAllByText("Current").length).toBeGreaterThan(0);

      fireEvent.click(within(screen.getByRole("navigation", { name: "Revision history" })).getByRole("button", { name: /Revision 1/ }));

      expect(screen.getByRole("heading", { name: "Revision 1" })).toBeInTheDocument();
      expect(screen.getByText("Initial mix")).toBeInTheDocument();
      expect(screen.getByText("Approved by Client Reviewer")).toBeInTheDocument();
      expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Approve revision" })).toBeDisabled();
    });

  it("keeps revision history readable in a partial workspace", async () => {
      const partial = healthyWorkspace();
      partial.status = "partial";
      partial.counts.issues = 1;
      partial.issues = [{ scope: "project", code: "invalidJson", displayName: "Other Project", relativePath: "other.json", message: "Invalid JSON", recovery: "Repair it." }];
      respondWith(partial);
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));

      expect(screen.getByRole("heading", { name: "Revision history" })).toBeInTheDocument();
      expect(screen.getByText("Balance update")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New revision" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Approve revision" })).toBeDisabled();
      expect(screen.getAllByText(/still read the revision history/i)).toHaveLength(2);
    });

  it("shows authoritative first-delivery readiness with guided creation available", async () => {
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));

      expect(screen.getByRole("heading", { name: "Delivery", level: 2 })).toBeInTheDocument();
      expect(screen.getByText("Ready for first delivery")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create delivery" })).toBeEnabled();
      expect(screen.getByText("No delivery package yet")).toBeInTheDocument();
    });

  it("previews the fixed first-delivery plan and cancels without creating", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "preflight_delivery_creation") return Promise.resolve(deliveryPreviewResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Create delivery" }));
      const options = await screen.findByRole("dialog", { name: "Create delivery package" });
      expect(within(options).getByRole("checkbox", { name: /create delivery ZIP/i })).not.toBeChecked();
      fireEvent.click(within(options).getByRole("button", { name: "Preview package" }));

      const dialog = await screen.findByRole("dialog", { name: "Confirm delivery package" });
      expect(within(dialog).getAllByText("Blue Sky Main Mix.wav")).toHaveLength(2);
      expect(within(dialog).getByText("Stems/Blue Sky Stems.wav")).toBeInTheDocument();
      expect(within(dialog).getByText(/Revision_Notes.md \(revision notes\)/)).toBeInTheDocument();
      expect(within(dialog).getByText(/custom filters are not enabled/i)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog", { name: "Confirm delivery package" })).not.toBeInTheDocument();
      expect(mockedInvoke.mock.calls.some(([command]) => command === "create_delivery")).toBe(false);
    });

  it("displays a validated current delivery manifest and recorded checksums", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: [{ path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) }],
      };
      respondWith(workspace);
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));

      expect(screen.getByText("Delivery is current")).toBeInTheDocument();
      expect(screen.getByText("Blue Sky Main Mix.wav")).toBeInTheDocument();
      expect(screen.getByText("main mix")).toBeInTheDocument();
      expect(screen.getAllByText("1,200")).toHaveLength(2);
      expect(screen.getByText(/did not re-check the delivery files/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rebuild delivery" })).toBeEnabled();
      expect(screen.getByText(/same-path overwrite.*Delivery Notes/i)).toBeInTheDocument();
    });

  it("edits and verifies the fixed Delivery Notes document", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: [{ path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) }],
      };
      mockedInvoke.mockImplementation((command, args) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "resolve_folder") return Promise.resolve({ path: "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky/05_Final_Delivery" });
        if (command === "get_delivery_notes") return Promise.resolve({ content: "# Delivery\n\nOriginal notes.\n", maxBytes: 65536 });
        if (command === "update_delivery_notes") {
          const request = (args as { request: { content: string } }).request;
          return Promise.resolve({ content: request.content, maxBytes: 65536 });
        }
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));

      const editor = await screen.findByRole("textbox", { name: "Delivery Notes Markdown content" });
      fireEvent.change(editor, { target: { value: "# Delivery\n\nUpdated handoff.\n" } });
      fireEvent.click(screen.getByRole("button", { name: "Save Delivery Notes" }));

      expect(await screen.findByText("Delivery Notes saved and verified.")).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("update_delivery_notes", {
        request: { clientId: "acme", projectId: "blue-sky", content: "# Delivery\n\nUpdated handoff.\n" },
      });
    });

  it("previews and confirms a ZIP overwrite while preserving the fixed mode", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: deliveryPreviewResult.delivery!.selected.map((file, index) => ({ path: file.path, deliverableType: file.deliverableType, sizeBytes: 1200 + index, sha256: String(index).repeat(64) })),
      };
      const preview: DeliveryOperationResult = { ...deliveryPreviewResult, delivery: { ...deliveryPreviewResult.delivery!, deliveredRevision: 1, replacementMode: "overwrite", createZip: true } };
      const created: DeliveryOperationResult = { ...preview, code: "created", message: "Delivery package created successfully.", delivery: { ...preview.delivery!, zipName: "blue-sky-rev-01-20260724153045.zip" } };
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "resolve_folder") return Promise.resolve({ path: "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky/05_Final_Delivery" });
        if (command === "get_delivery_notes") return Promise.resolve({ content: "Edited notes\n", maxBytes: 65536 });
        if (command === "preflight_delivery_creation") return Promise.resolve(preview);
        if (command === "create_delivery") return Promise.resolve(created);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Rebuild delivery" }));

      const options = await screen.findByRole("dialog", { name: "Rebuild delivery package" });
      expect(within(options).getByRole("checkbox", { name: /create delivery ZIP/i })).toBeChecked();
      expect(within(options).getByText(/Delivery Notes and unrelated files stay in place/i)).toBeInTheDocument();
      fireEvent.click(within(options).getByRole("button", { name: "Preview package" }));
      const confirmation = await screen.findByRole("dialog", { name: "Confirm delivery package" });
      expect(within(confirmation).getByText("blue-sky-rev-01-YYYYMMDDHHMMSS.zip")).toBeInTheDocument();
      fireEvent.click(within(confirmation).getByRole("button", { name: "Rebuild delivery" }));

      expect(await screen.findByText(/Revision 1 was packaged and verified with 2 delivered files/)).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_delivery_creation", {
        request: { clientId: "acme", projectId: "blue-sky", replacementMode: "overwrite", createZip: true, confirmedDeletions: [] },
      });
    });

  it("requires exact typed confirmation for the clean deletion preview", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: [{ path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) }],
      };
      const deletions = ["Blue Sky Main Mix.wav", "Delivery_Notes.md", "client-reference.pdf", "delivery-manifest.json"];
      const preview: DeliveryOperationResult = {
        ...deliveryPreviewResult,
        delivery: {
          ...deliveryPreviewResult.delivery!,
          deliveredRevision: 1,
          replacementMode: "clean",
          createZip: true,
          selected: [deliveryPreviewResult.delivery!.selected[0]],
          deletions,
        },
      };
      const created: DeliveryOperationResult = { ...preview, code: "created", message: "Delivery package created successfully." };
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "resolve_folder") return Promise.resolve({ path: "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky/05_Final_Delivery" });
        if (command === "get_delivery_notes") return Promise.resolve({ content: "Fresh template\n", maxBytes: 65536 });
        if (command === "preflight_delivery_creation") return Promise.resolve(preview);
        if (command === "create_delivery") return Promise.resolve(created);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Rebuild delivery" }));
      const options = await screen.findByRole("dialog", { name: "Rebuild delivery package" });
      fireEvent.click(within(options).getByRole("radio", { name: /clean replacement/i }));
      expect(within(options).getByRole("alert")).toHaveTextContent(/everything currently inside 05_Final_Delivery/i);
      fireEvent.click(within(options).getByRole("button", { name: "Preview package" }));

      const confirmation = await screen.findByRole("dialog", { name: "Confirm delivery package" });
      expect(within(confirmation).getByText("client-reference.pdf")).toBeInTheDocument();
      const cleanButton = within(confirmation).getByRole("button", { name: "Clean and rebuild delivery" });
      expect(cleanButton).toBeDisabled();
      fireEvent.change(within(confirmation).getByRole("textbox", { name: "Clean replacement confirmation" }), { target: { value: "CLEAN blue-sky" } });
      expect(cleanButton).toBeEnabled();
      fireEvent.click(cleanButton);

      expect(await screen.findByText(/Revision 1 was packaged and verified with 1 delivered file/)).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("create_delivery", {
        request: {
          clientId: "acme",
          projectId: "blue-sky",
          replacementMode: "clean",
          createZip: true,
          confirmedDeletions: deletions,
        },
      });
    });

  it("creates the first delivery and refreshes the authoritative package", async () => {
      const before = healthyWorkspace();
      const after = healthyWorkspace();
      const project = after.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065",
        createdWith: "jl-mixing 1.2.0",
        createdAt: "2026-07-18T13:00:00Z",
        method: "Download",
        revision: 1,
        revisionId: project.revisions[0].revisionId,
        description: project.revisions[0].description,
        approvedAt: project.revisions[0].approvedAt!,
        approvedBy: project.revisions[0].approvedBy!,
        files: [
          { path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) },
          { path: "Stems/Blue Sky Stems.wav", deliverableType: "stems", sizeBytes: 2400, sha256: "1".repeat(64) },
        ],
      };
      let discoveries = 0;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(discoveries++ === 0 ? before : after);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
        if (command === "preflight_delivery_creation") return Promise.resolve(deliveryPreviewResult);
        if (command === "create_delivery") return Promise.resolve(deliveryCreateResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      fireEvent.click(screen.getByRole("button", { name: "Create delivery" }));
      fireEvent.click(await screen.findByRole("button", { name: "Preview package" }));
      const dialog = await screen.findByRole("dialog", { name: "Confirm delivery package" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Create delivery" }));

      expect(await screen.findByText(/Revision 1 was packaged and verified with 2 delivered files/)).toBeInTheDocument();
      expect(screen.getByText("Delivery is current")).toBeInTheDocument();
      expect(screen.getByText("Stems/Blue Sky Stems.wav")).toBeInTheDocument();
    });

  it("identifies an existing package that requires replacement review", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.deliveredRevision = 1;
      project.approvedRevision = 2;
      project.revisions[1].approvedAt = "2026-07-18T12:00:00Z";
      project.revisions[1].approvedBy = "Client";
      project.delivery = {
        documentId: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065", createdWith: "jl-mixing 1.2.0", createdAt: "2026-07-18T13:00:00Z", method: "Download", revision: 1,
        revisionId: project.revisions[0].revisionId, description: project.revisions[0].description, approvedAt: project.revisions[0].approvedAt!, approvedBy: project.revisions[0].approvedBy!,
        files: [{ path: "Blue Sky Main Mix.wav", deliverableType: "main_mix", sizeBytes: 1200, sha256: "0".repeat(64) }],
      };
      respondWith(workspace);
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
      expect(screen.getByText("New delivery available")).toBeInTheDocument();
      expect(screen.getByText(/current package contains Revision 1.*approved Revision 2/i)).toBeInTheDocument();
    });

  it("preflights a trimmed revision description and cancels without creating", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_creation") return Promise.resolve(revisionPreviewResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "New revision" }));

      expect(screen.getByRole("heading", { name: "New revision" })).toBeInTheDocument();
      expect(screen.getByLabelText(/revision description/i)).toHaveFocus();
      fireEvent.change(screen.getByLabelText(/revision description/i), { target: { value: " Vocal lift " } });
      fireEvent.click(screen.getByRole("button", { name: "Review revision" }));

      expect(await screen.findByRole("heading", { name: "Confirm new revision" })).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByText("Revision 3")).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_revision_creation", {
        request: { clientId: "acme", projectId: "blue-sky", description: "Vocal lift" },
      });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mockedInvoke).not.toHaveBeenCalledWith("create_revision", expect.anything());
    });

  it("creates, refreshes, and selects the verified authoritative revision", async () => {
      let workspaceCalls = 0;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") {
          workspaceCalls += 1;
          const snapshot = healthyWorkspace();
          if (workspaceCalls > 1) {
            const project = snapshot.clients[0].projects[0];
            project.currentRevision = 3;
            project.revisions.push({
              number: 3,
              revisionId: "dd0cb190-bd55-4200-bca0-b5472cbef368",
              createdAt: "2026-07-18T12:00:00Z",
              description: "Vocal lift",
              approvedAt: null,
              approvedBy: null,
            });
          }
          return Promise.resolve(snapshot);
        }
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_creation") return Promise.resolve(revisionPreviewResult);
        if (command === "create_revision") return Promise.resolve(revisionCreateResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "New revision" }));
      fireEvent.change(screen.getByLabelText(/revision description/i), { target: { value: "Vocal lift" } });
      fireEvent.click(screen.getByRole("button", { name: "Review revision" }));
      await screen.findByRole("heading", { name: "Confirm new revision" });
      fireEvent.click(screen.getByRole("button", { name: "Create revision" }));

      expect(await screen.findByText("Revision 3 was created and verified.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Revision history" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Revision 3" })).toBeInTheDocument();
      expect(screen.getAllByText("Vocal lift").length).toBeGreaterThan(0);
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_revision")).toHaveLength(1);
    });

  it("does not retry an uncertain revision-creation result", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_creation") return Promise.resolve(revisionPreviewResult);
        if (command === "create_revision") return Promise.resolve({
          ok: false,
          code: "uncertain",
          message: "The operation may have completed; do not retry automatically.",
          revision: null,
        } satisfies RevisionOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "New revision" }));
      fireEvent.change(screen.getByLabelText(/revision description/i), { target: { value: "Vocal lift" } });
      fireEvent.click(screen.getByRole("button", { name: "Review revision" }));
      await screen.findByRole("heading", { name: "Confirm new revision" });
      fireEvent.click(screen.getByRole("button", { name: "Create revision" }));

      expect(await screen.findByRole("heading", { name: "Creation needs verification" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/do not retry automatically/i);
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_revision")).toHaveLength(1);
    });

  it("preflights approval for the selected revision and cancels without approving", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(approvalPreviewResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "Approve revision" }));

      expect(screen.getByRole("heading", { name: "Approve Revision 2" })).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByRole("textbox", { name: /approved by/i })).toHaveValue("Client");
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));

      expect(await screen.findByRole("heading", { name: "Confirm revision approval" })).toBeInTheDocument();
      expect(mockedInvoke).toHaveBeenCalledWith("preflight_revision_approval", {
        request: { clientId: "acme", projectId: "blue-sky", revision: 2, approvedBy: "Client" },
      });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mockedInvoke).not.toHaveBeenCalledWith("approve_revision", expect.anything());
    });

  it("approves, refreshes, and verifies the authoritative selected revision", async () => {
      let workspaceCalls = 0;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") {
          workspaceCalls += 1;
          const snapshot = healthyWorkspace();
          if (workspaceCalls > 1) {
            const project = snapshot.clients[0].projects[0];
            project.approvedRevision = 2;
            project.revisions[1].approvedBy = "Client";
            project.revisions[1].approvedAt = "2026-07-18T13:00:00Z";
          }
          return Promise.resolve(snapshot);
        }
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(approvalPreviewResult);
        if (command === "approve_revision") return Promise.resolve(approvalResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "Approve revision" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));
      await screen.findByRole("heading", { name: "Confirm revision approval" });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve revision" }));

      expect(await screen.findByText("Revision 2 was approved by Client and verified.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Approve revision" })).toBeDisabled();
      expect(screen.getByText("Approved by Client")).toBeInTheDocument();
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "approve_revision")).toHaveLength(1);
    });

  it("warns before replacing historical approval on an older revision", async () => {
      const workspace = healthyWorkspace();
      const project = workspace.clients[0].projects[0];
      project.approvedRevision = 2;
      project.revisions[1].approvedAt = "2026-07-17T18:00:00Z";
      project.revisions[1].approvedBy = "Current Reviewer";
      const historicalPreview: ApprovalOperationResult = {
        ...approvalPreviewResult,
        approval: { ...approvalPreviewResult.approval!, revision: 1 },
      };
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(workspace);
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(historicalPreview);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(within(screen.getByRole("navigation", { name: "Revision history" })).getByRole("button", { name: /Revision 1/ }));
      fireEvent.click(screen.getByRole("button", { name: "Approve revision" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));

      const warning = await screen.findByText("Check what will change");
      expect(warning.parentElement).toHaveTextContent(/existing approval record.*older than current Revision 2/i);
    });

  it("does not retry an uncertain revision-approval result", async () => {
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "preflight_revision_approval") return Promise.resolve(approvalPreviewResult);
        if (command === "approve_revision") return Promise.resolve({
          ok: false,
          code: "uncertain",
          message: "The operation may have completed; do not retry automatically.",
          approval: null,
        } satisfies ApprovalOperationResult);
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(screen.getByRole("button", { name: "Revisions" }));
      fireEvent.click(screen.getByRole("button", { name: "Approve revision" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Review approval" }));
      await screen.findByRole("heading", { name: "Confirm revision approval" });
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve revision" }));

      expect(await screen.findByRole("heading", { name: "Approval needs verification" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(/do not retry automatically/i);
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "approve_revision")).toHaveLength(1);
    });
});
