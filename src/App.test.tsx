import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import type { VersionCheck, WorkspaceSnapshot } from "./types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

afterEach(cleanup);

const version: VersionCheck = {
  available: true,
  version: "1.2.0",
  message: "JL Mixing Automation 1.2.0 detected",
};

const healthyWorkspace = (projectName = "Blue Sky"): WorkspaceSnapshot => ({
  workspacePath: "/Users/engineer/Music/Mixes",
  status: "healthy",
  studio: {
    studioId: "jl-studio",
    studioName: "JL Mix Studio",
    schemaVersion: "1.1.0",
    createdWith: "jl-mixing 1.2.0",
  },
  counts: { clients: 1, projects: 1, issues: 0 },
  clients: [{
    clientId: "acme",
    clientName: "Acme Records",
    defaultArtist: "The Artist",
    projects: [{
      projectId: "blue-sky",
      projectName,
      artist: "The Artist",
      schemaVersion: "1.1.0",
      createdWith: "jl-mixing 1.1.1",
      sampleRate: 48000,
      bitDepth: 24,
      fileFormat: "WAV",
      currentRevision: 2,
      approvedRevision: 1,
      deliveredRevision: null,
    }],
  }],
  issues: [],
});

const respondWith = (
  workspace: WorkspaceSnapshot,
  automation: VersionCheck = version,
) => {
  mockedInvoke.mockImplementation((command) => {
    if (command === "discover_default_workspace") return Promise.resolve(workspace);
    if (command === "get_jl_mixing_version") return Promise.resolve(automation);
    return Promise.reject(new Error("Unexpected command"));
  });
};

describe("workspace dashboard", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    respondWith(healthyWorkspace());
  });

  it("shows a healthy workspace and project lifecycle state", async () => {
    render(<App />);
    expect(screen.getByText(/reading the default workspace/i)).toBeInTheDocument();
    expect(await screen.findByText("Blue Sky")).toBeInTheDocument();
    expect(screen.getByText("JL Mix Studio")).toBeInTheDocument();
    expect(screen.getByText("Revision 2")).toBeInTheDocument();
    expect(screen.getByText("Revision 1")).toBeInTheDocument();
    expect(screen.getByText("JL Mixing Automation 1.2.0 detected")).toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledWith("discover_default_workspace");
    expect(mockedInvoke).toHaveBeenCalledWith("get_jl_mixing_version");
  });

  it("keeps valid projects visible beside partial-discovery guidance", async () => {
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

    expect(await screen.findByText("Blue Sky")).toBeInTheDocument();
    expect(screen.getByText(/1 workspace item needs attention/i)).toBeInTheDocument();
    expect(screen.getByText("Broken Project")).toBeInTheDocument();
    expect(screen.getByText(/correct or recreate/i)).toBeInTheDocument();
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
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workspace not found" })).toBeInTheDocument();
    expect(screen.getByText(/run new-studio/i)).toBeInTheDocument();
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
      version: null,
      message: "JL Mixing Automation was not found on PATH",
    });

    render(<App />);

    expect(await screen.findByText("Blue Sky")).toBeInTheDocument();
    expect(screen.getByText("JL Mixing Automation was not found on PATH")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
  });

  it("refreshes workspace and version state independently", async () => {
    let workspaceCalls = 0;
    mockedInvoke.mockImplementation((command) => {
      if (command === "discover_default_workspace") {
        workspaceCalls += 1;
        return Promise.resolve(
          healthyWorkspace(workspaceCalls === 1 ? "Blue Sky" : "After Refresh"),
        );
      }
      if (command === "get_jl_mixing_version") return Promise.resolve(version);
      return Promise.reject(new Error("Unexpected command"));
    });
    render(<App />);
    expect(await screen.findByText("Blue Sky")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

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
});
