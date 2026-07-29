import {
  cleanup,
  fireEvent,
  render,
  screen,
  beforeEach,
  describe,
  expect,
  version,
  preflightResult,
  createResult,
  healthyWorkspace,
  resetAppTestState
} from "./App.testSupport";
import App from "./App";
import type { ClientOperationResult } from "./types";

afterEach(cleanup);

describe("JL Mixing Studio — client workflow", () => {
  beforeEach(() => {
    resetAppTestState();
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

      expect(await screen.findByText(/was added to your studio/i)).toBeInTheDocument();
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
      expect(screen.getByRole("alert")).toHaveTextContent(/result is uncertain/i);
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
      await waitFor(() => {
        expect(mockedInvoke.mock.calls.filter(([command]) => command === "preflight_client_creation")).toHaveLength(1);
      });

      resolvePreflight?.(preflightResult);
      expect(await screen.findByRole("heading", { name: "Confirm new client" })).toBeInTheDocument();
    });
});
