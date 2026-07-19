import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
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

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

afterEach(cleanup);

const version: VersionCheck = {
  available: true,
  supported: true,
  studioCreationSupported: true,
  clientCreationSupported: true,
  projectCreationSupported: true,
  intakeValidationSupported: true,
  revisionCreationSupported: true,
  revisionApprovalSupported: true,
  deliveryCreationSupported: true,
  version: "1.2.0",
  message: "JL Mixing Automation 1.2.0 detected",
};

const preflightResult: ClientOperationResult = {
  ok: true,
  code: "ready",
  message: "Preflight passed. No changes were made.",
  client: {
    clientId: "new-client",
    clientName: "New Client",
    defaultArtist: "New Artist",
  },
};

const createResult: ClientOperationResult = {
  ...preflightResult,
  code: "created",
  message: "Client created successfully.",
};

const projectPreflightResult: ProjectOperationResult = {
  ok: true,
  code: "ready",
  message: "Preflight passed. No changes were made.",
  project: {
    clientId: "acme",
    projectId: "night-drive",
    projectName: "Night Drive",
    artist: "The Artist",
  },
};

const projectCreateResult: ProjectOperationResult = {
  ...projectPreflightResult,
  code: "created",
  message: "Project created successfully.",
};

const revisionPreviewResult: RevisionOperationResult = {
  ok: true,
  code: "ready",
  message: "Revision preview completed. No changes were made.",
  revision: {
    clientId: "acme",
    projectId: "blue-sky",
    number: 3,
    description: "Vocal lift",
  },
};

const revisionCreateResult: RevisionOperationResult = {
  ...revisionPreviewResult,
  code: "created",
  message: "Revision created successfully.",
};

const deliveryPreviewResult: DeliveryOperationResult = {
  ok: true,
  code: "ready",
  message: "Delivery preview completed. No changes were made.",
  delivery: {
    clientId: "acme",
    projectId: "blue-sky",
    projectName: "Blue Sky",
    currentRevision: 2,
    approvedRevision: 1,
    deliveredRevision: null,
    deliveryMethod: "Download",
    replacementMode: "default",
    createZip: false,
    selected: [
      { sourceName: "Blue Sky Main Mix.wav", deliverableType: "main_mix", path: "Blue Sky Main Mix.wav" },
      { sourceName: "Blue Sky Stems.wav", deliverableType: "stems", path: "Stems/Blue Sky Stems.wav" },
    ],
    excluded: [{ name: "Revision_Notes.md", reason: "revision notes" }],
    deletions: [],
  },
};

const deliveryCreateResult: DeliveryOperationResult = {
  ...deliveryPreviewResult,
  code: "created",
  message: "Delivery package created successfully.",
  delivery: { ...deliveryPreviewResult.delivery!, deliveredRevision: 1 },
};

const approvalPreviewResult: ApprovalOperationResult = {
  ok: true,
  code: "ready",
  message: "Approval preview completed. No changes were made.",
  approval: {
    clientId: "acme",
    projectId: "blue-sky",
    revision: 2,
    approvedBy: "Client",
    approvedAt: null,
  },
};

const approvalResult: ApprovalOperationResult = {
  ...approvalPreviewResult,
  code: "approved",
  message: "Revision approved successfully.",
  approval: {
    ...approvalPreviewResult.approval!,
    approvedAt: "2026-07-18T13:00:00Z",
  },
};

const intakeReport: IntakeReport = {
  clientId: "acme",
  projectId: "blue-sky",
  source: "/Users/engineer/Music/Mixes/Clients/Acme/Projects/Blue Sky/01_Client_Files/Original_Delivery",
  filesDiscovered: 2,
  blockingErrors: 0,
  warnings: 1,
  expectedSampleRate: 48000,
  expectedBitDepth: 24,
  enhancedInspectionAvailable: true,
  criticalErrors: [],
  duplicateFilenames: ["`one/song.wav`, `two/song.wav`"],
  formatMismatches: [],
  unsupportedFiles: [],
  unavailableChecks: [],
  inventory: [
    { file: "one/song.wav", sizeBytes: 1200, technicalDetails: "48000 Hz, 24-bit, 2 ch" },
    { file: "two/song.wav", sizeBytes: 2400, technicalDetails: "48000 Hz, 24-bit, 2 ch" },
  ],
  recommendations: ["Review duplicate filenames to avoid ambiguous DAW imports."],
};

const intakeNotRun: IntakeOperationResult = {
  ok: true,
  code: "notRun",
  message: "No intake validation has been run for this project.",
  report: null,
};

const intakePreview: IntakeOperationResult = {
  ok: true,
  code: "ready",
  message: "Intake preview completed. No changes were made.",
  report: intakeReport,
};

const healthyWorkspace = (projectName = "Blue Sky"): WorkspaceSnapshot => ({
  workspacePath: "/Users/engineer/Music/Mixes",
  status: "healthy",
  studio: {
    studioId: "jl-studio",
    studioName: "JL Mix Studio",
    rootPath: "/Users/engineer/Music/Mixes",
    schemaVersion: "1.1.0",
    createdWith: "jl-mixing 1.2.0",
    createdAt: "2026-07-14T12:00:00Z",
    mixEngineer: "JL Engineer",
    sampleRate: 48000,
    bitDepth: 24,
    fileFormat: "WAV",
    deliveryMethod: "digital",
    requestedDeliverables: ["master", "instrumental"],
    changeDirectoryAfterCreate: false,
  },
  counts: { clients: 1, projects: 1, issues: 0 },
  clients: [{
    clientId: "acme",
    clientName: "Acme Records",
    createdAt: "2026-07-15T12:00:00Z",
    defaultArtist: "The Artist",
    projects: [{
      projectId: "blue-sky",
      projectName,
      artist: "The Artist",
      schemaVersion: "1.1.0",
      createdWith: "jl-mixing 1.1.1",
      createdAt: "2026-07-16T10:00:00Z",
      deadline: null,
      sampleRate: 48000,
      bitDepth: 24,
      fileFormat: "WAV",
      deliveryMethod: "Download",
      currentRevision: 2,
      approvedRevision: 1,
      deliveredRevision: null,
      delivery: null,
      revisions: [
        {
          number: 1,
          revisionId: "7af79825-2253-4c82-aed2-da00b22bf635",
          createdAt: "2026-07-16T12:00:00Z",
          description: "Initial mix",
          approvedAt: "2026-07-16T18:00:00Z",
          approvedBy: "Client Reviewer",
        },
        {
          number: 2,
          revisionId: "838e1b52-e8d3-48c7-8a8d-179c985d4bbc",
          createdAt: "2026-07-17T12:00:00Z",
          description: "Balance update",
          approvedAt: null,
          approvedBy: null,
        },
      ],
    }],
  }],
  issues: [],
  tasks: [],
  activity: [],
});

const respondWith = (
  workspace: WorkspaceSnapshot,
  automation: VersionCheck = version,
) => {
  mockedInvoke.mockImplementation((command) => {
    if (command === "discover_default_workspace") return Promise.resolve(workspace);
    if (command === "get_jl_mixing_version") return Promise.resolve(automation);
    if (command === "get_intake_report") return Promise.resolve(intakeNotRun);
    return Promise.reject(new Error("Unexpected command"));
  });
};

describe("JL Mixing Studio", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    localStorage.clear();
    respondWith(healthyWorkspace());
  });

  it("activates local Studio settings without mutating workspace metadata", async () => {
    const { unmount } = render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
    const compact = screen.getByRole("checkbox", { name: /compact layout/i });
    fireEvent.click(compact);
    expect(compact).toBeChecked();
    expect(document.querySelector(".app-shell")).toHaveClass("compact-layout");
    expect(localStorage.getItem("jl-mixing-studio.preferences")).toContain('"compactLayout":true');
    expect(mockedInvoke.mock.calls.some(([command]) => /setting|update|write/.test(String(command)))).toBe(false);
    unmount();
    render(<App />);
    await screen.findByText("JL Mix Studio");
    expect(document.querySelector(".app-shell")).toHaveClass("compact-layout");
  });

  it("shows a healthy workspace without duplicating client and project details", async () => {
    render(<App />);
    expect(screen.getByText(/reading the default workspace/i)).toBeInTheDocument();
    expect(await screen.findByText("JL Mix Studio")).toBeInTheDocument();
    expect(screen.getByText("~/Music/Mixes")).toBeInTheDocument();
    expect(screen.queryByText("Blue Sky")).not.toBeInTheDocument();
    expect(screen.queryByText("Revision 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Revision 1")).not.toBeInTheDocument();
    expect(screen.getByText("JL Mixing Automation 1.2.0 detected")).toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledWith("discover_default_workspace");
    expect(mockedInvoke).toHaveBeenCalledWith("get_jl_mixing_version");
  });

  it("renders the persistent shell, planned global search, and authoritative summaries", async () => {
    render(<App />);

    await screen.findByText("JL Mix Studio");
    expect(screen.getByLabelText("JL Mixing Studio")).toBeInTheDocument();
    expect(screen.getByText("JL Mix Studio")).toBeInTheDocument();
    expect(screen.getByText("~/Music/Mixes")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Global search")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Awaiting review").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Ready to deliver").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "New project" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /validate intake/i })).not.toBeInTheDocument();
  });

  it("launches guided project creation from the Dashboard", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(screen.getByRole("heading", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Client")).toBeEnabled();
    expect(screen.getByLabelText("Client")).toHaveFocus();
  });

  it("shows derived priorities and persisted activity on Dashboard", async () => {
    const snapshot = healthyWorkspace();
    snapshot.tasks = [{ id: "task", priority: "delivery", title: "Create or update delivery", reason: "Approved differs from delivered.", recommendedAction: "Open Delivery.", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", deadline: null }];
    snapshot.activity = [{ id: "event", eventType: "revisionApproved", timestamp: "2026-07-16T18:00:00Z", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", revision: 1, persistedSource: "revision approval.approved_at" }];
    respondWith(snapshot); render(<App />); await screen.findByText("JL Mix Studio");
    expect(screen.getByText("Create or update delivery")).toBeInTheDocument();
    expect(screen.getByText("Revision approved · Revision 1")).toBeInTheDocument();
  });

  it("opens a project-scoped task from the active Tasks route", async () => {
    const snapshot = healthyWorkspace();
    snapshot.tasks = [{ id: "task", priority: "review", title: "Review current revision", reason: "Current differs from approved.", recommendedAction: "Open Revisions.", clientId: "acme", clientName: "Acme Records", projectId: "blue-sky", projectName: "Blue Sky", deadline: null }];
    respondWith(snapshot); render(<App />); await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByRole("heading", { name: "1 derived task" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
    expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
  });

  it("activates Activity Log as an incomplete derived event feed", async () => {
    const snapshot = healthyWorkspace();
    snapshot.activity = [{ id: "event", eventType: "clientCreated", timestamp: "2026-07-15T12:00:00Z", clientId: "acme", clientName: "Acme Records", projectId: null, projectName: null, revision: null, persistedSource: "client metadata.created_at" }];
    respondWith(snapshot); render(<App />); await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Activity Log" }));
    expect(screen.getByRole("heading", { name: "1 derived event" })).toBeInTheDocument();
    expect(screen.getByText(/not a complete audit log/i)).toBeInTheDocument();
  });

  it("shows honest empty derived-route states", async () => {
    render(<App />); await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByRole("heading", { name: "No derived tasks" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activity Log" }));
    expect(screen.getByRole("heading", { name: "No supported activity events" })).toBeInTheDocument();
  });

  it("navigates to the functional project directory with a programmatic active state", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(screen.getByRole("button", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Blue Sky" })).toBeInTheDocument();
    expect(screen.getByLabelText("Projects search")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Global search")).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps guided client creation available from the Clients directory", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    expect(screen.getByRole("button", { name: "Clients" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "New client" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New client" })).toBeInTheDocument();
  });

  it("opens Client Details and the shared Project Overview from Clients", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    expect(screen.getByRole("button", { name: "Acme Records" })).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText("The Artist")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Acme Records" }));
    expect(screen.getByRole("heading", { name: "Acme Records", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/no approved client-edit command/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Blue Sky" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", {
        name: "Projects",
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("48 kHz / 24-bit / WAV")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intake" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Revisions" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open folder" })).toBeEnabled();
  });

  it("resolves and opens only the validated project folder", async () => {
    const path = "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky";
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "resolve_folder" || command === "open_folder") return Promise.resolve({ path });
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
    expect(await screen.findByText(path)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    await waitFor(() => expect(mockedInvoke).toHaveBeenCalledWith("open_folder", { request: { location: "project", clientId: "acme", projectId: "blue-sky" } }));
    expect(await screen.findByText("Folder opened.")).toBeInTheDocument();
  });

  it("activates project Reports, Files, and Metadata from authoritative records", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "get_intake_report") return Promise.resolve(intakePreview);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
    fireEvent.click(within(screen.getByLabelText("Project workflow")).getByRole("button", { name: "Reports" }));
    expect(await screen.findByRole("heading", { name: "Project reports" })).toBeInTheDocument();
    expect(screen.getByText(/2 files · 0 blocking errors/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(screen.getByRole("heading", { name: "Authoritative files" })).toBeInTheDocument();
    expect(screen.getByText("one/song.wav")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    expect(screen.getByRole("heading", { name: "Project metadata" })).toBeInTheDocument();
    expect(screen.getByText("48000 Hz · 24-bit WAV")).toBeInTheDocument();
  });

  it("activates the global validated delivery report index", async () => {
    const snapshot = healthyWorkspace();
    snapshot.clients[0].projects[0].delivery = {
      documentId: "delivery-1", createdWith: "jl-mixing 1.2.0", createdAt: "2026-07-18T12:00:00Z",
      method: "digital", revision: 1, revisionId: "revision-1", description: "Approved",
      approvedAt: "2026-07-18T11:00:00Z", approvedBy: "Engineer", files: [],
    };
    respondWith(snapshot);
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Reports" }));
    expect(screen.getByRole("heading", { name: "Reports", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Delivery manifest")).toBeInTheDocument();
    expect(screen.queryByText(/report browsing is planned/i)).not.toBeInTheDocument();
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
    expect(screen.getAllByText(/history remains readable/i)).toHaveLength(2);
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
    expect(screen.getByText("No delivery package recorded")).toBeInTheDocument();
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
    expect(screen.getByText(/did not re-hash delivery files/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rebuild delivery" })).toBeEnabled();
    expect(screen.getByText(/same-path overwrite that preserves edited Delivery Notes/i)).toBeInTheDocument();
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
    const created: DeliveryOperationResult = { ...preview, code: "created", message: "Delivery package created successfully." };
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
    expect(within(options).getByText(/preserve Delivery Notes and unrelated package files/i)).toBeInTheDocument();
    fireEvent.click(within(options).getByRole("button", { name: "Preview package" }));
    const confirmation = await screen.findByRole("dialog", { name: "Confirm delivery package" });
    expect(within(confirmation).getByText("blue-sky-delivery.zip")).toBeInTheDocument();
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
    expect(within(options).getByText(/every file, folder, edited note, ZIP/i)).toBeInTheDocument();
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
    expect(screen.getByText("Replacement review required")).toBeInTheDocument();
    expect(screen.getByText(/existing package represents Revision 1.*approved Revision 2/i)).toBeInTheDocument();
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

    const warning = await screen.findByText("Review lifecycle impact");
    expect(warning.parentElement).toHaveTextContent(/historical approval metadata.*older than current Revision 2/i);
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

  it("opens the functional Intake route and reads the authoritative report", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "get_intake_report") return Promise.resolve({ ...intakePreview, code: "validated" } satisfies IntakeOperationResult);
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
    expect(screen.getByText(/intake source files will not be modified/i)).toBeInTheDocument();
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
    expect(screen.getByText(/existing report remains readable/i)).toBeInTheDocument();
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

  it("uses the client and project ID pair when opening projects across clients", async () => {
    const snapshot = healthyWorkspace("Blue Sky");
    snapshot.clients.push({
      clientId: "second-client",
      clientName: "Second Client",
      createdAt: "2026-07-15T13:00:00Z",
      defaultArtist: "Second Artist",
      projects: [{
        ...snapshot.clients[0].projects[0],
        projectId: "blue-sky",
        projectName: "Second Blue Sky",
        artist: "Second Artist",
      }],
    });
    snapshot.counts = { clients: 2, projects: 2, issues: 0 };
    respondWith(snapshot);
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Second Blue Sky" }));

    expect(screen.getByRole("heading", { name: "Second Blue Sky", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Second Client")).toBeInTheDocument();
    expect(screen.getByText("Second Artist")).toBeInTheDocument();
  });

  it("returns safely to Projects when refresh removes the selected project", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        const snapshot = healthyWorkspace();
        if (workspaceCalls > 1) {
          snapshot.clients[0].projects = [];
          snapshot.counts.projects = 0;
        }
        return Promise.resolve(snapshot);
      }
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/selected project is no longer available/i);
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Blue Sky", level: 1 })).not.toBeInTheDocument();
  });

  it("shows partial-discovery guidance without duplicating project details", async () => {
    const partial = healthyWorkspace();
    partial.status = "partial";
    partial.counts.issues = 1;
    partial.issues = [{
      scope: "project",
      code: "invalidJson",
      displayName: "Broken Project",
      relativePath: "Clients/Acme/Projects/Broken/00_Admin/project-manifest.json",
      message: "A JL Mixing metadata file contains invalid JSON",
      recovery: "Correct or recreate the metadata file with JL Mixing Automation.",
    }];
    respondWith(partial);

    render(<App />);

    expect(await screen.findByText("Broken Project")).toBeInTheDocument();
    expect(screen.queryByText("Blue Sky")).not.toBeInTheDocument();
    expect(screen.getByText(/1 workspace item needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/correct or recreate/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New client" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(screen.getByRole("button", { name: "Blue Sky" })).toBeInTheDocument();
    expect(screen.getByText("Broken Project")).toBeInTheDocument();
    expect(screen.getByText(/only validated clients and projects are shown/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New project" })).toBeDisabled();
  });

  it("launches project creation from Client Details with the client locked", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Clients" }));
    fireEvent.click(screen.getByRole("button", { name: "Acme Records" }));

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(screen.getByRole("heading", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Client")).toHaveValue("acme");
    expect(screen.getByLabelText("Client")).toBeDisabled();
    expect(screen.getByLabelText(/^project name/i)).toHaveFocus();
  });

  it("requires an explicit client when project creation starts from Projects", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(screen.getByLabelText("Client")).toBeEnabled();
    expect(screen.getByLabelText("Client")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Review project" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/select a valid client/i);
    expect(mockedInvoke).not.toHaveBeenCalledWith("preflight_project_creation", expect.anything());
  });

  it("preflights the project summary and cancels without creating", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_project_creation") return Promise.resolve(projectPreflightResult);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText(/^project name/i), { target: { value: " Night Drive " } });
    fireEvent.click(screen.getByRole("button", { name: "Review project" }));

    expect(await screen.findByRole("heading", { name: "Confirm new project" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Create project" })).toHaveFocus());
    expect(screen.getByText("night-drive")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("Revision 1")).toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledWith("preflight_project_creation", {
      request: { clientId: "acme", projectName: "Night Drive", artist: null },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedInvoke).not.toHaveBeenCalledWith("create_project", expect.anything());
  });

  it("preserves project values when preflight rejects the request", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_project_creation") {
        return Promise.resolve({
          ok: false,
          code: "collision",
          message: "Project destination already exists",
          project: null,
        } satisfies ProjectOperationResult);
      }
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText(/^project name/i), { target: { value: "Night Drive" } });
    fireEvent.click(screen.getByRole("button", { name: "Review project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
    expect(screen.getByLabelText("Client")).toHaveValue("acme");
    expect(screen.getByLabelText(/^project name/i)).toHaveValue("Night Drive");
  });

  it("creates, verifies, and opens the authoritative Project Overview", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        const snapshot = healthyWorkspace();
        if (workspaceCalls > 1) {
          snapshot.clients[0].projects.push({
            ...snapshot.clients[0].projects[0],
            projectId: "night-drive",
            projectName: "Night Drive",
            currentRevision: 1,
            approvedRevision: null,
            deliveredRevision: null,
            delivery: null,
          });
          snapshot.counts.projects = 2;
        }
        return Promise.resolve(snapshot);
      }
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_project_creation") return Promise.resolve(projectPreflightResult);
      if (command === "create_project") return Promise.resolve(projectCreateResult);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText(/^project name/i), { target: { value: "Night Drive" } });
    fireEvent.click(screen.getByRole("button", { name: "Review project" }));
    await screen.findByRole("heading", { name: "Confirm new project" });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("heading", { name: "Night Drive", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/was created with Revision 1/i)).toBeInTheDocument();
    expect(screen.getByText("Revision 1")).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("button", { name: "Projects" }),
    ).toHaveAttribute("aria-current", "page");
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_project")).toHaveLength(1);
  });

  it("does not retry an uncertain project creation result", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_project_creation") return Promise.resolve(projectPreflightResult);
      if (command === "create_project") {
        return Promise.resolve({
          ok: false,
          code: "uncertain",
          message: "The operation may have completed.",
          project: null,
        } satisfies ProjectOperationResult);
      }
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText(/^project name/i), { target: { value: "Night Drive" } });
    fireEvent.click(screen.getByRole("button", { name: "Review project" }));
    await screen.findByRole("heading", { name: "Confirm new project" });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("heading", { name: "Creation needs verification" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/may have completed/i);
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_project")).toHaveLength(1);
  });

  it("treats refresh failure after project success as uncertain", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        return workspaceCalls === 1
          ? Promise.resolve(healthyWorkspace())
          : Promise.reject(new Error("Refresh failed"));
      }
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_project_creation") return Promise.resolve(projectPreflightResult);
      if (command === "create_project") return Promise.resolve(projectCreateResult);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText(/^project name/i), { target: { value: "Night Drive" } });
    fireEvent.click(screen.getByRole("button", { name: "Review project" }));
    await screen.findByRole("heading", { name: "Confirm new project" });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/workspace could not be refreshed/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/may have completed/i);
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_project")).toHaveLength(1);
  });

  it("shows setup guidance for an unavailable workspace", async () => {
    respondWith({
      workspacePath: "/Users/engineer/Music/Mixes",
      status: "unavailable",
      studio: null,
      counts: { clients: 0, projects: 0, issues: 1 },
      clients: [],
      issues: [{
        scope: "workspace",
        code: "notFound",
        displayName: null,
        relativePath: null,
        message: "The default JL Mixing workspace was not found",
        recovery: "Install JL Mixing Automation and run new-studio.",
      }],
      tasks: [],
      activity: [],
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workspace not found" })).toBeInTheDocument();
    expect(screen.getByText(/run new-studio/i)).toBeInTheDocument();
  });

  it("shows validated studio identity, defaults, and workspace path", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");
    fireEvent.click(screen.getByRole("button", { name: "Studio" }));
    expect(screen.getByRole("heading", { name: "JL Mix Studio" })).toBeInTheDocument();
    expect(screen.getByText("JL Engineer")).toBeInTheDocument();
    expect(screen.getByText("48,000 Hz")).toBeInTheDocument();
    expect(screen.getAllByText("/Users/engineer/Music/Mixes")).toHaveLength(2);
    expect(screen.queryByText(/studio details are planned/i)).not.toBeInTheDocument();
  });

  it("preflights and creates the default studio workspace once", async () => {
    const unavailable: WorkspaceSnapshot = {
      workspacePath: "/Users/engineer/Music/Mixes", status: "unavailable", studio: null,
      counts: { clients: 0, projects: 0, issues: 1 }, clients: [], tasks: [], activity: [],
      issues: [{ scope: "workspace", code: "notFound", displayName: null, relativePath: null, message: "Workspace not found", recovery: "Create it with guided setup." }],
    };
    const requestSummary = { studioName: "New Studio", mixEngineer: "Engineer", sampleRate: 48000, bitDepth: 24, fileFormat: "WAV" };
    const preflight: StudioOperationResult = { ok: true, code: "ready", message: "Ready", studio: requestSummary };
    const created: StudioOperationResult = { ok: true, code: "created", message: "Created", studio: requestSummary };
    const refreshed = healthyWorkspace();
    refreshed.status = "empty";
    refreshed.clients = [];
    refreshed.counts = { clients: 0, projects: 0, issues: 0 };
    refreshed.studio!.studioName = "New Studio";
    let discoveryCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(discoveryCalls++ === 0 ? unavailable : refreshed);
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_studio_creation") return Promise.resolve(preflight);
      if (command === "create_studio") return Promise.resolve(created);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Workspace not found" });
    fireEvent.click(screen.getByRole("button", { name: "Studio" }));
    fireEvent.click(screen.getByRole("button", { name: "New studio" }));
    fireEvent.change(screen.getByLabelText("Studio name"), { target: { value: " New Studio " } });
    fireEvent.change(screen.getByLabelText("Mix engineer"), { target: { value: " Engineer " } });
    fireEvent.click(screen.getByRole("button", { name: "Review studio" }));
    expect(await screen.findByRole("heading", { name: "Confirm new studio" })).toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledWith("preflight_studio_creation", { request: requestSummary });
    fireEvent.click(screen.getByRole("button", { name: "Create studio" }));
    expect(await screen.findByText("New Studio was created and verified.")).toBeInTheDocument();
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_studio")).toHaveLength(1);
  });

  it("distinguishes a valid empty workspace", async () => {
    const empty = healthyWorkspace();
    empty.status = "empty";
    empty.counts = { clients: 0, projects: 0, issues: 0 };
    empty.clients = [];
    respondWith(empty);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "No clients or projects yet" })).toBeInTheDocument();
    expect(screen.getByText(/create the first client/i)).toBeInTheDocument();
  });

  it("blocks project presentation when studio configuration is invalid", async () => {
    const invalid = healthyWorkspace();
    invalid.status = "invalid";
    invalid.studio = null;
    invalid.counts = { clients: 0, projects: 0, issues: 1 };
    invalid.clients = [];
    invalid.issues = [{
      scope: "studio",
      code: "invalidSchema",
      displayName: null,
      relativePath: "Studio/studio.json",
      message: "A JL Mixing metadata file does not match its supported schema",
      recovery: "Validate or recreate the metadata file.",
    }];
    respondWith(invalid);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "The workspace cannot be read safely" })).toBeInTheDocument();
    expect(screen.queryByText("Blue Sky")).not.toBeInTheDocument();
    expect(screen.getByText("Studio/studio.json")).toBeInTheDocument();
  });

  it("reports a missing CLI without hiding workspace data", async () => {
    respondWith(healthyWorkspace(), {
      available: false,
      supported: false,
      studioCreationSupported: false,
      clientCreationSupported: false,
        projectCreationSupported: false,
        intakeValidationSupported: false,
      revisionCreationSupported: false,
      revisionApprovalSupported: false,
      deliveryCreationSupported: false,
      version: null,
      message: "JL Mixing Automation was not found in its default install location or on PATH",
    });

    render(<App />);

    expect(await screen.findByText("JL Mix Studio")).toBeInTheDocument();
    expect(screen.getAllByText(/not found in its default install location or on PATH/i)).toHaveLength(2);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New client" })).toBeDisabled();
  });

  it("refreshes workspace and version state independently", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        const snapshot = healthyWorkspace();
        if (workspaceCalls > 1 && snapshot.studio) snapshot.studio.studioName = "After Refresh";
        return Promise.resolve(snapshot);
      }
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    expect(await screen.findByText("JL Mix Studio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));

    expect(await screen.findByText("After Refresh")).toBeInTheDocument();
    expect(workspaceCalls).toBe(2);
    expect(mockedInvoke).toHaveBeenCalledTimes(4);
  });

  it("offers retry after an unexpected discovery failure", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        return Promise.reject(new Error("Unexpected internal failure"));
      }
      return Promise.resolve(version);
    });

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unexpected internal failure");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("validates the client form before invoking preflight", async () => {
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    const idInput = screen.getByLabelText(/client id/i);
    expect(idInput).toHaveFocus();
    expect(idInput).toHaveAttribute("autocapitalize", "none");
    expect(idInput).toHaveAttribute("autocorrect", "off");
    expect(idInput).toHaveAttribute("spellcheck", "false");
    fireEvent.change(idInput, { target: { value: "Not Valid" } });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "New Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/lowercase letters and numbers/i);
    expect(mockedInvoke).not.toHaveBeenCalledWith(
      "preflight_client_creation",
      expect.anything(),
    );
  });

  it("preflights, focuses confirmation, and cancels without creating", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_client_creation") return Promise.resolve(preflightResult);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    fireEvent.change(screen.getByLabelText(/client id/i), {
      target: { value: "new-client" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: " New Client " },
    });
    fireEvent.change(screen.getByLabelText(/default artist/i), {
      target: { value: " New Artist " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));

    expect(await screen.findByRole("heading", { name: "Confirm new client" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create client" })).toHaveFocus();
    });
    expect(mockedInvoke).toHaveBeenCalledWith("preflight_client_creation", {
      request: {
        clientId: "new-client",
        clientName: "New Client",
        defaultArtist: "New Artist",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedInvoke).not.toHaveBeenCalledWith("create_client", expect.anything());
  });

  it("creates a client once and reconciles it through workspace discovery", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        const snapshot = healthyWorkspace();
        if (workspaceCalls > 1) {
          snapshot.clients.push({
            clientId: "new-client",
            clientName: "New Client",
            createdAt: "2026-07-18T12:00:00Z",
            defaultArtist: "New Artist",
            projects: [],
          });
          snapshot.counts.clients = 2;
        }
        return Promise.resolve(snapshot);
      }
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_client_creation") return Promise.resolve(preflightResult);
      if (command === "create_client") return Promise.resolve(createResult);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    fireEvent.change(screen.getByLabelText(/client id/i), {
      target: { value: "new-client" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "New Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));
    await screen.findByRole("heading", { name: "Confirm new client" });
    fireEvent.click(screen.getByRole("button", { name: "Create client" }));

    expect(await screen.findByText(/was created and added to the workspace/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "New Client" })).not.toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledWith("create_client", {
      request: {
        clientId: "new-client",
        clientName: "New Client",
        defaultArtist: null,
      },
    });
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_client")).toHaveLength(1);
  });

  it("preserves form values after a confirmed command is rejected", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_client_creation") return Promise.resolve(preflightResult);
      if (command === "create_client") {
        return Promise.resolve({
          ok: false,
          code: "collision",
          message: "Client destination already exists",
          client: preflightResult.client,
        } satisfies ClientOperationResult);
      }
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    fireEvent.change(screen.getByLabelText(/client id/i), {
      target: { value: "new-client" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "New Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));
    await screen.findByRole("heading", { name: "Confirm new client" });
    fireEvent.click(screen.getByRole("button", { name: "Create client" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
    expect(screen.getByLabelText(/client id/i)).toHaveValue("new-client");
    expect(screen.getByLabelText(/display name/i)).toHaveValue("New Client");
  });

  it("does not retry when creation succeeds but reconciliation fails", async () => {
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_client_creation") return Promise.resolve(preflightResult);
      if (command === "create_client") return Promise.resolve(createResult);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    fireEvent.change(screen.getByLabelText(/client id/i), {
      target: { value: "new-client" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "New Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));
    await screen.findByRole("heading", { name: "Confirm new client" });
    fireEvent.click(screen.getByRole("button", { name: "Create client" }));

    expect(await screen.findByRole("heading", { name: "Creation needs verification" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/may have completed/i);
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_client")).toHaveLength(1);
  });

  it("prevents duplicate submission while preflight is running", async () => {
    let resolvePreflight: ((result: ClientOperationResult) => void) | undefined;
    const pendingPreflight = new Promise<ClientOperationResult>((resolve) => {
      resolvePreflight = resolve;
    });
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      if (command === "preflight_client_creation") return pendingPreflight;
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    await screen.findByText("JL Mix Studio");

    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    fireEvent.change(screen.getByLabelText(/client id/i), {
      target: { value: "new-client" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "New Client" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));
    const pendingButton = screen.getByRole("button", { name: "Checking…" });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(mockedInvoke.mock.calls.filter(([command]) => command === "preflight_client_creation")).toHaveLength(1);

    resolvePreflight?.(preflightResult);
    expect(await screen.findByRole("heading", { name: "Confirm new client" })).toBeInTheDocument();
  });

  it("keeps the read-only dashboard usable for an unsupported automation version", async () => {
    respondWith(healthyWorkspace(), {
      available: true,
      supported: false,
      studioCreationSupported: false,
      clientCreationSupported: false,
        projectCreationSupported: false,
        intakeValidationSupported: false,
      revisionCreationSupported: false,
      revisionApprovalSupported: false,
      deliveryCreationSupported: false,
      version: "1.3.0",
      message: "JL Mixing Automation 1.3.0 detected; guided creation requires 1.2.0",
    });
    render(<App />);

    expect(await screen.findByText("JL Mix Studio")).toBeInTheDocument();
    expect(screen.getAllByText(/guided creation requires 1.2.0/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "New client" })).toBeDisabled();
  });
});
