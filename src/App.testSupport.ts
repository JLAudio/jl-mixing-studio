import { vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type {
  ApprovalOperationResult,
  ClientOperationResult,
  DeliveryOperationResult,
  IntakeOperationResult,
  IntakeReport,
  ProjectOperationResult,
  RevisionOperationResult,
  VersionCheck,
  WorkspaceSnapshot
} from "./types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn() }));
export const mockedInvoke = vi.mocked(invoke);
export const mockedWriteText = vi.mocked(writeText);

export const version: VersionCheck = {
  available: true,
  supported: true,
  studioCreationSupported: true,
  clientCreationSupported: true,
  projectCreationSupported: true,
  intakeValidationSupported: true,
  revisionCreationSupported: true,
  revisionApprovalSupported: true,
  deliveryCreationSupported: true,
  version: "1.3.1",
  message: "JL Mixing Automation 1.3.1 detected",
};

export const preflightResult: ClientOperationResult = {
  ok: true,
  code: "ready",
  message: "Preflight passed. No changes were made.",
  client: {
    clientId: "new-client",
    clientName: "New Client",
    defaultArtist: "New Artist",
  },
};

export const createResult: ClientOperationResult = {
  ...preflightResult,
  code: "created",
  message: "Client created successfully.",
};

export const projectPreflightResult: ProjectOperationResult = {
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

export const projectCreateResult: ProjectOperationResult = {
  ...projectPreflightResult,
  code: "created",
  message: "Project created successfully.",
};

export const revisionPreviewResult: RevisionOperationResult = {
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

export const revisionCreateResult: RevisionOperationResult = {
  ...revisionPreviewResult,
  code: "created",
  message: "Revision created successfully.",
};

export const deliveryPreviewResult: DeliveryOperationResult = {
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
    zipName: null,
    selected: [
      { sourceName: "Blue Sky Main Mix.wav", deliverableType: "main_mix", path: "Blue Sky Main Mix.wav" },
      { sourceName: "Blue Sky Stems.wav", deliverableType: "stems", path: "Stems/Blue Sky Stems.wav" },
    ],
    excluded: [{ name: "Revision_Notes.md", reason: "revision notes" }],
    deletions: [],
  },
};

export const deliveryCreateResult: DeliveryOperationResult = {
  ...deliveryPreviewResult,
  code: "created",
  message: "Delivery package created successfully.",
  delivery: { ...deliveryPreviewResult.delivery!, deliveredRevision: 1 },
};

export const approvalPreviewResult: ApprovalOperationResult = {
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

export const approvalResult: ApprovalOperationResult = {
  ...approvalPreviewResult,
  code: "approved",
  message: "Revision approved successfully.",
  approval: {
    ...approvalPreviewResult.approval!,
    approvedAt: "2026-07-18T13:00:00Z",
  },
};

export const intakeReport: IntakeReport = {
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

export const intakeNotRun: IntakeOperationResult = {
  ok: true,
  code: "notRun",
  message: "No intake validation has been run for this project.",
  report: null,
};

export const intakePreview: IntakeOperationResult = {
  ok: true,
  code: "ready",
  message: "Intake preview completed. No changes were made.",
  report: intakeReport,
};

export const healthyWorkspace = (projectName = "Blue Sky"): WorkspaceSnapshot => ({
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

export const respondWith = (
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

export function resetAppTestState() {
  mockedInvoke.mockReset();
  mockedWriteText.mockReset();
  localStorage.clear();
  respondWith(healthyWorkspace());
}
