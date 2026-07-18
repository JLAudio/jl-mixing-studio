import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import type {
  ClientOperationResult,
  ProjectOperationResult,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

afterEach(cleanup);

const version: VersionCheck = {
  available: true,
  supported: true,
  clientCreationSupported: true,
  projectCreationSupported: true,
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

describe("JL Mixing Studio", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    respondWith(healthyWorkspace());
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
    expect(screen.getByRole("button", { name: "New project Planned" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Validate intake Planned" })).toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Intake Planned" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open folder — Planned" })).toBeDisabled();
  });

  it("uses the client and project ID pair when opening projects across clients", async () => {
    const snapshot = healthyWorkspace("Blue Sky");
    snapshot.clients.push({
      clientId: "second-client",
      clientName: "Second Client",
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
      supported: false,
      clientCreationSupported: false,
      projectCreationSupported: false,
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
      clientCreationSupported: false,
      projectCreationSupported: false,
      version: "1.3.0",
      message: "JL Mixing Automation 1.3.0 detected; guided creation requires 1.2.0",
    });
    render(<App />);

    expect(await screen.findByText("JL Mix Studio")).toBeInTheDocument();
    expect(screen.getAllByText(/guided creation requires 1.2.0/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "New client" })).toBeDisabled();
  });
});
