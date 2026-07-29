import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockedInvoke, version, projectPreflightResult, projectCreateResult, healthyWorkspace, respondWith, resetAppTestState } from "./App.testSupport";
import App from "./App";
import type { ProjectOperationResult } from "./types";

afterEach(cleanup);

describe("JL Mixing Studio — project workflow", () => {
  beforeEach(() => {
    resetAppTestState();
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
      expect(screen.getByText(/clients and projects we can read are still available/i)).toBeInTheDocument();
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

      expect(await screen.findByRole("alert")).toHaveTextContent(/studio could not be refreshed/i);
      expect(screen.getByRole("alert")).toHaveTextContent(/result is uncertain/i);
      expect(mockedInvoke.mock.calls.filter(([command]) => command === "create_project")).toHaveLength(1);
    });
});
