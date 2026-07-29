import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockedInvoke, mockedWriteText, version, intakePreview, healthyWorkspace, respondWith, resetAppTestState } from "./App.testSupport";
import App from "./App";

afterEach(cleanup);

describe("JL Mixing Studio — shell and routes", () => {
  beforeEach(() => {
    resetAppTestState();
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
      expect(screen.getByText("JL Mixing Automation 1.3.1 detected")).toBeInTheDocument();
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
      expect(screen.getByRole("heading", { name: "1 task" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      expect(screen.getByRole("heading", { name: "Blue Sky", level: 1 })).toBeInTheDocument();
    });

  it("activates Activity Log as an incomplete derived event feed", async () => {
      const snapshot = healthyWorkspace();
      snapshot.activity = [{ id: "event", eventType: "clientCreated", timestamp: "2026-07-15T12:00:00Z", clientId: "acme", clientName: "Acme Records", projectId: null, projectName: null, revision: null, persistedSource: "client metadata.created_at" }];
      respondWith(snapshot); render(<App />); await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Activity Log" }));
      expect(screen.getByRole("heading", { name: "1 event" })).toBeInTheDocument();
      expect(screen.getByText(/supported project milestones/i)).toBeInTheDocument();
    });

  it("shows honest empty derived-route states", async () => {
      render(<App />); await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
      expect(screen.getByRole("heading", { name: "Nothing needs your attention" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Activity Log" }));
      expect(screen.getByRole("heading", { name: "No recent activity yet" })).toBeInTheDocument();
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
      expect(screen.getByText(/client editing.*available yet/i)).toBeInTheDocument();
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

  it("copies only the freshly resolved validated project folder", async () => {
      const path = "/Users/engineer/Music/Mixes/Clients/acme/Projects/blue-sky";
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "resolve_folder") return Promise.resolve({ path });
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));
      fireEvent.click(await screen.findByRole("button", { name: "Copy path" }));

      await waitFor(() => expect(mockedWriteText).toHaveBeenCalledWith(path));
      expect(await screen.findByText("Path copied.")).toBeInTheDocument();
    });

  it("keeps long validated paths in a separate row above folder actions", async () => {
      const path = `/Users/engineer/Music/Mixes/Clients/${"very-long-client-name-".repeat(6)}/Projects/blue-sky`;
      mockedInvoke.mockImplementation((command) => {
        if (command === "discover_default_workspace") return Promise.resolve(healthyWorkspace());
        if (command === "get_jl_mixing_version") return Promise.resolve(version);
        if (command === "resolve_folder") return Promise.resolve({ path });
        return Promise.reject(new Error("Unexpected command"));
      });
      render(<App />);
      await screen.findByText("JL Mix Studio");
      fireEvent.click(screen.getByRole("button", { name: "Projects" }));
      fireEvent.click(screen.getByRole("button", { name: "Blue Sky" }));

      const pathText = await screen.findByText(path);
      const folderControl = pathText.closest(".folder-control");
      const actions = folderControl?.querySelector(".directory-actions");

      expect(folderControl).not.toBeNull();
      expect(pathText.nextElementSibling).toBe(actions);
      expect(actions).toContainElement(screen.getByRole("button", { name: "Copy path" }));
      expect(actions).toContainElement(screen.getByRole("button", { name: "Open folder" }));
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
      expect(screen.getByRole("heading", { name: "Project files" })).toBeInTheDocument();
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
      expect(screen.getByText("Delivery details")).toBeInTheDocument();
      expect(screen.queryByText(/report browsing is planned/i)).not.toBeInTheDocument();
    });
});
