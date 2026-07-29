import {
  cleanup,
  fireEvent,
  render,
  beforeEach,
  describe,
  expect,
  version,
  healthyWorkspace,
  respondWith,
  resetAppTestState
} from "./App.testSupport";
import App from "./App";
import type { StudioOperationResult, WorkspaceSnapshot } from "./types";

afterEach(cleanup);

describe("JL Mixing Studio — workspace and studio states", () => {
  beforeEach(() => {
    resetAppTestState();
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

      expect(await screen.findByRole("heading", { name: "Your studio workspace isn’t ready yet" })).toBeInTheDocument();
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
      await screen.findByRole("heading", { name: "Your studio workspace isn’t ready yet" });
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

      expect(await screen.findByRole("heading", { name: "Your studio is ready for its first client" })).toBeInTheDocument();
      expect(screen.getByText(/ready to get started/i)).toBeInTheDocument();
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

      expect(await screen.findByRole("heading", { name: "We can’t read this studio setup yet" })).toBeInTheDocument();
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
        version: "1.4.0",
        message: "JL Mixing Automation 1.4.0 detected; guided creation requires 1.3.1",
      });
      render(<App />);

      expect(await screen.findByText("JL Mix Studio")).toBeInTheDocument();
      expect(screen.getAllByText(/guided creation requires 1.3.1/i)).toHaveLength(2);
      expect(screen.getByRole("button", { name: "New client" })).toBeDisabled();
    });
});
