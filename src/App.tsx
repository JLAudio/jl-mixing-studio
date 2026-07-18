import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ClientCreationRequest,
  ClientCreationSummary,
  ClientOperationResult,
  ClientSummary,
  DiscoveryIssue,
  ProjectCreationRequest,
  ProjectCreationSummary,
  ProjectOperationResult,
  ProjectSummary,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";
import "./App.css";

type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; message: string };

type ClientWorkflowState =
  | { status: "closed" }
  | { status: "editing"; error?: string }
  | { status: "preflighting" }
  | {
      status: "confirming";
      request: ClientCreationRequest;
      preview: ClientCreationSummary;
    }
  | {
      status: "creating";
      request: ClientCreationRequest;
      preview: ClientCreationSummary;
    }
  | { status: "uncertain"; message: string };

interface ClientFormValues {
  clientId: string;
  clientName: string;
  defaultArtist: string;
}

type ProjectWorkflowState =
  | { status: "closed" }
  | { status: "editing"; lockedClientId: string | null; fromClient: boolean; error?: string }
  | { status: "preflighting"; lockedClientId: string | null; fromClient: boolean }
  | {
      status: "confirming";
      request: ProjectCreationRequest;
      preview: ProjectCreationSummary;
      fromClient: boolean;
    }
  | {
      status: "creating";
      request: ProjectCreationRequest;
      preview: ProjectCreationSummary;
      fromClient: boolean;
    }
  | { status: "uncertain"; message: string };

interface ProjectFormValues {
  clientId: string;
  projectName: string;
  artist: string;
}

type PrimaryRoute =
  | "dashboard"
  | "studio"
  | "clients"
  | "projects"
  | "tasks"
  | "reports"
  | "activity"
  | "settings";

interface RouteDefinition {
  id: PrimaryRoute;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}

const routes: RouteDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    eyebrow: "Workspace overview",
    title: "What do I need to work on today?",
    description: "Authoritative workspace status and the safest available next actions.",
  },
  {
    id: "studio",
    label: "Studio",
    eyebrow: "Studio workspace",
    title: "Studio",
    description: "Studio identity, defaults, workspace information, and approved diagnostics.",
  },
  {
    id: "clients",
    label: "Clients",
    eyebrow: "Client directory",
    title: "Clients",
    description: "Find clients, review their defaults, and enter their project work.",
  },
  {
    id: "projects",
    label: "Projects",
    eyebrow: "Project directory",
    title: "Projects",
    description: "Inspect project lifecycle state across every client.",
  },
  {
    id: "tasks",
    label: "Tasks",
    eyebrow: "Derived work",
    title: "Tasks",
    description: "Actionable work derived from authoritative project state.",
  },
  {
    id: "reports",
    label: "Reports",
    eyebrow: "Generated output",
    title: "Reports",
    description: "Find supported reports without duplicating their state.",
  },
  {
    id: "activity",
    label: "Activity Log",
    eyebrow: "Derived events",
    title: "Activity Log",
    description: "Supported project events reconstructed from persisted timestamps.",
  },
  {
    id: "settings",
    label: "Settings",
    eyebrow: "Application preferences",
    title: "Settings",
    description: "Application preferences kept separate from project metadata.",
  },
];

type PlannedRouteId = Exclude<PrimaryRoute, "dashboard" | "clients" | "projects">;

const plannedRouteContent: Record<PlannedRouteId, {
  status: string;
  sections: { title: string; detail: string }[];
  tableColumns?: string[];
  routeNote?: string;
}> = {
  studio: {
    status: "Studio details are planned",
    sections: [
      { title: "Studio identity", detail: "Validated studio name and workspace configuration" },
      { title: "Installed tools", detail: "Restricted, allowlisted compatibility checks" },
      { title: "Audio defaults", detail: "Read-only sample rate, bit depth, and file format" },
      { title: "Storage & statistics", detail: "Requires approved diagnostics before activation" },
    ],
  },
  tasks: {
    status: "Derived tasks are planned",
    sections: [
      { title: "Recovery", detail: "Resolve invalid or unreadable workspace data" },
      { title: "Review", detail: "Review newer unapproved revisions and approaching deadlines" },
      { title: "Delivery", detail: "Create or update delivery for an approved revision" },
    ],
    tableColumns: ["Priority", "Task", "Project", "Reason", "Recommended action"],
    routeNote: "Tasks will be derived on refresh. They will not have manual completion state or a GUI-owned database.",
  },
  reports: {
    status: "Report browsing is planned",
    sections: [
      { title: "Validation", detail: "Non-destructive intake validation reports" },
      { title: "Delivery", detail: "Generated delivery manifests and checksums" },
      { title: "Project context", detail: "Report type, project, and persisted update information" },
    ],
    tableColumns: ["Report", "Type", "Project", "Updated"],
  },
  activity: {
    status: "Derived activity is planned",
    sections: [
      { title: "Creation", detail: "Client and project creation timestamps" },
      { title: "Revisions & approvals", detail: "Persisted revision and approval events" },
      { title: "Delivery", detail: "Persisted delivery-manifest creation events" },
    ],
    tableColumns: ["Timestamp", "Event", "Project", "Persisted source"],
    routeNote: "This will be a derived project-event feed, not a complete audit log.",
  },
  settings: {
    status: "Settings changes are planned",
    sections: [
      { title: "Studio & workspace", detail: "Approved configuration distinct from application preferences" },
      { title: "Integrations", detail: "Detected JL Mixing Automation compatibility" },
      { title: "Audio & delivery", detail: "Supported defaults from authoritative studio configuration" },
      { title: "Appearance & advanced", detail: "Local application preferences after separate review" },
    ],
    routeNote: "Opening Settings does not mutate studio, client, project, or application state.",
  },
};

const emptyClientForm: ClientFormValues = {
  clientId: "",
  clientName: "",
  defaultArtist: "",
};

const emptyProjectForm: ProjectFormValues = {
  clientId: "",
  projectName: "",
  artist: "",
};

const clientIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const displayWorkspacePath = (path: string) =>
  path
    .replace(/^\/Users\/[^/]+(?=\/)/, "~")
    .replace(/^\/home\/[^/]+(?=\/)/, "~")
    .replace(/^[A-Za-z]:\\Users\\[^\\]+(?=\\)/, "~");

const safeError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;

function IssueDetail({ issue }: { issue: DiscoveryIssue }) {
  return (
    <li>
      <strong>{issue.displayName ?? "Workspace"}</strong>
      <span>{issue.message}</span>
      {issue.relativePath && <code>{issue.relativePath}</code>}
      <small>{issue.recovery}</small>
    </li>
  );
}

function WorkspaceContent({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  return (
    <>
      {snapshot.status === "partial" && (
        <section className="notice warning" role="status">
          <strong>
            {snapshot.counts.issues} workspace{" "}
            {snapshot.counts.issues === 1 ? "item needs" : "items need"} attention
          </strong>
          <span>Valid clients and projects remain available below.</span>
          <a href="#workspace-issues">Review issues</a>
        </section>
      )}

      {snapshot.status === "unavailable" && (
        <section className="empty-state">
          <p className="kicker">Setup required</p>
          <h2>Workspace not found</h2>
          <p>Install JL Mixing Automation and run <code>new-studio</code> to create the default workspace.</p>
        </section>
      )}

      {snapshot.status === "invalid" && (
        <section className="empty-state error">
          <p className="kicker">Configuration problem</p>
          <h2>The workspace cannot be read safely</h2>
          <p>Review the issue details before trying again.</p>
        </section>
      )}

      {snapshot.status === "empty" && (
        <section className="empty-state">
          <p className="kicker">Workspace ready</p>
          <h2>No clients or projects yet</h2>
          <p>Use <strong>New client</strong> to create the first client safely.</p>
        </section>
      )}

      {snapshot.issues.length > 0 && (
        <section className="issues" id="workspace-issues" aria-labelledby="issues-heading">
          <p className="kicker">Recovery guidance</p>
          <h2 id="issues-heading">Workspace issues</h2>
          <ul>
            {snapshot.issues.map((issue, index) => (
              <IssueDetail
                key={[issue.relativePath ?? issue.scope, issue.code, index].join("-")}
                issue={issue}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function NavIcon({ route }: { route: PrimaryRoute }) {
  const paths: Record<PrimaryRoute, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    studio: <><path d="M4 21V8l8-5 8 5v13"/><path d="M8 21v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/></>,
    clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    projects: <><path d="M3 7h7l2 2h9v11H3z"/><path d="M3 7V4h7l2 3"/></>,
    tasks: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    reports: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    activity: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/></>,
  };

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[route]}
    </svg>
  );
}

function Sidebar({
  activeRoute,
  onNavigate,
  workspace,
}: {
  activeRoute: PrimaryRoute;
  onNavigate: (route: PrimaryRoute) => void;
  workspace: ResourceState<WorkspaceSnapshot>;
}) {
  return (
    <aside className="sidebar">
      <div className="brand" aria-label="JL Mixing Studio">
        <span className="brand-mark" aria-hidden="true">JL</span>
        <span><strong>JL Mixing</strong><small>Studio</small></span>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {routes.map((route) => (
          <button
            key={route.id}
            type="button"
            className="nav-item"
            aria-current={activeRoute === route.id ? "page" : undefined}
            onClick={() => onNavigate(route.id)}
          >
            <NavIcon route={route.id} />
            <span>{route.label}</span>
          </button>
        ))}
      </nav>
      <div className="workspace-context">
        <span
          className={`workspace-dot ${
            workspace.status === "ready" &&
            (workspace.value.status === "healthy" || workspace.value.status === "empty")
              ? "good"
              : "attention"
          }`}
          aria-hidden="true"
        />
        <span>
          <small>Current workspace</small>
          <strong>
            {workspace.status === "ready"
              ? workspace.value.studio?.studioName ?? "Default workspace"
              : workspace.status === "loading"
                ? "Checking…"
                : "Unavailable"}
          </strong>
          {workspace.status === "ready" && (
            <code>{displayWorkspacePath(workspace.value.workspacePath)}</code>
          )}
        </span>
      </div>
    </aside>
  );
}

function GlobalSearch() {
  return (
    <div className="global-search" aria-label="Global search" aria-disabled="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <span>Search everything</span>
      <span className="planned-pill">Planned</span>
    </div>
  );
}

function RouteHeader({ route }: { route: RouteDefinition }) {
  return (
    <header className="route-header">
      <div>
        <p className="eyebrow">{route.eyebrow}</p>
        <h1>{route.title}</h1>
        <p className="lede">{route.description}</p>
      </div>
      <GlobalSearch />
    </header>
  );
}

function Dashboard({
  workspace,
  version,
  automationReady,
  loading,
  clientCreationAvailable,
  clientCreationHelp,
  onRefresh,
  onNewClient,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  version: ResourceState<VersionCheck>;
  automationReady: boolean;
  loading: boolean;
  clientCreationAvailable: boolean;
  clientCreationHelp: string;
  onRefresh: () => void;
  onNewClient: () => void;
}) {
  const snapshot = workspace.status === "ready" ? workspace.value : null;
  const projects = snapshot?.clients.flatMap((client) => client.projects) ?? [];
  const awaitingReview = projects.filter(
    (project) => project.currentRevision !== project.approvedRevision,
  ).length;
  const readyForDelivery = projects.filter(
    (project) => project.approvedRevision !== null && project.approvedRevision !== project.deliveredRevision,
  ).length;
  const workspaceStatus = snapshot
    ? {
        healthy: "Healthy",
        empty: "Ready",
        partial: "Needs attention",
        unavailable: "Not found",
        invalid: "Invalid",
      }[snapshot.status]
    : workspace.status === "loading" ? "Checking…" : "Unavailable";

  return (
    <>
      <section className="summary-grid" aria-label="Workspace summary">
        <article className="summary-card accent-blue">
          <span>Clients</span><strong>{snapshot?.counts.clients ?? "—"}</strong><small>Validated workspace clients</small>
        </article>
        <article className="summary-card accent-violet">
          <span>Projects</span><strong>{snapshot?.counts.projects ?? "—"}</strong><small>Validated project manifests</small>
        </article>
        <article className="summary-card accent-amber">
          <span>Awaiting review</span><strong>{snapshot ? awaitingReview : "—"}</strong><small>Current revision differs from approved</small>
        </article>
        <article className="summary-card accent-green">
          <span>Ready to deliver</span><strong>{snapshot ? readyForDelivery : "—"}</strong><small>Approved revision differs from delivered</small>
        </article>
      </section>

      {workspace.status === "loading" && (
        <section className="notice" aria-live="polite">Reading the default workspace…</section>
      )}
      {workspace.status === "error" && (
        <section className="notice error" role="alert">
          <strong>Workspace discovery failed</strong>
          <span>{workspace.message}</span>
          <button type="button" onClick={onRefresh}>Try again</button>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="panel today-panel" aria-labelledby="today-heading">
          <div className="panel-heading">
            <div><p className="kicker">Today’s work</p><h2 id="today-heading">Recommended priorities</h2></div>
            <span className="planned-pill">Planned</span>
          </div>
          <div className="planned-message">
            <strong>Priority ranking is not active yet.</strong>
            <p>Future priorities will be derived from validated recovery, revision, delivery, and deadline state—never from hidden task data.</p>
          </div>
        </section>

        <section className="panel health-panel" aria-labelledby="health-heading">
          <div className="panel-heading"><div><p className="kicker">Studio health</p><h2 id="health-heading">Current checks</h2></div></div>
          <dl className="health-list">
            <div><dt>Workspace</dt><dd><span className={`status-dot ${snapshot?.status === "healthy" || snapshot?.status === "empty" ? "good" : "attention"}`} />{workspaceStatus}</dd></div>
            <div><dt>JL Mixing Automation</dt><dd><span className={`status-dot ${automationReady ? "good" : "attention"}`} />{version.status === "loading" ? "Checking…" : automationReady ? "Detected" : "Needs attention"}</dd></div>
          </dl>
          {snapshot && <code className="workspace-path">{snapshot.workspacePath}</code>}
          <p className="health-detail">
            {version.status === "ready" ? version.value.message : version.status === "error" ? version.message : "Checking the installed release."}
          </p>
        </section>

        <section className="panel quick-actions" aria-labelledby="actions-heading">
          <div className="panel-heading"><div><p className="kicker">Quick actions</p><h2 id="actions-heading">Start safely</h2></div></div>
          <div className="action-grid">
            <button type="button" onClick={onNewClient} disabled={!clientCreationAvailable} aria-describedby="new-client-help">New client</button>
            <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh workspace"}</button>
            <button type="button" className="planned-action" disabled>New project <span>Planned</span></button>
            <button type="button" className="planned-action" disabled>Validate intake <span>Planned</span></button>
          </div>
          <p id="new-client-help" className="action-help">{clientCreationHelp}</p>
        </section>

        <section className="panel activity-panel" aria-labelledby="activity-heading">
          <div className="panel-heading"><div><p className="kicker">Recent activity</p><h2 id="activity-heading">Persisted project events</h2></div><span className="planned-pill">Planned</span></div>
          <div className="planned-message compact">
            <strong>No activity feed is generated yet.</strong>
            <p>Only supported creation, revision, approval, and delivery timestamps will appear here.</p>
          </div>
        </section>
      </div>

      {snapshot && <WorkspaceContent snapshot={snapshot} />}
    </>
  );
}

const revisionLabel = (revision: number | null) =>
  revision === null ? "Not set" : `Revision ${revision}`;

function ContextSearch({ label }: { label: string }) {
  return (
    <div className="context-search" aria-label={`${label} search`} aria-disabled="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <span>Search {label.toLowerCase()}</span><span className="planned-pill">Planned</span>
    </div>
  );
}

function RouteIssues({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  if (snapshot.issues.length === 0) return null;
  return (
    <section className="issues route-issues" aria-labelledby="route-issues-heading">
      <p className="kicker">Recovery guidance</p>
      <h2 id="route-issues-heading">Some workspace data is unavailable</h2>
      <p className="route-supporting-copy">Only validated clients and projects are shown.</p>
      <ul>
        {snapshot.issues.map((issue, index) => (
          <IssueDetail key={[issue.relativePath ?? issue.scope, issue.code, index].join("-")} issue={issue} />
        ))}
      </ul>
    </section>
  );
}

function ClientsRoute({
  workspace,
  onSelectClient,
  onNewClient,
  onRefresh,
  loading,
  clientCreationAvailable,
  clientCreationHelp,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  onSelectClient: (clientId: string) => void;
  onNewClient: () => void;
  onRefresh: () => void;
  loading: boolean;
  clientCreationAvailable: boolean;
  clientCreationHelp: string;
}) {
  if (workspace.status === "loading") return <section className="notice" aria-live="polite">Reading clients…</section>;
  if (workspace.status === "error") return <section className="notice error" role="alert"><strong>Clients could not be loaded</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;

  return (
    <>
      <section className="directory-toolbar" aria-labelledby="client-directory-heading">
        <div><p className="kicker">Validated workspace</p><h2 id="client-directory-heading">{snapshot.counts.clients} {snapshot.counts.clients === 1 ? "client" : "clients"}</h2></div>
        <div className="directory-actions"><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button><button type="button" onClick={onNewClient} disabled={!clientCreationAvailable} aria-describedby="clients-new-client-help">New client</button></div>
      </section>
      <p id="clients-new-client-help" className="action-help directory-help">{clientCreationHelp}</p>
      <ContextSearch label="Clients" />

      {(snapshot.status === "unavailable" || snapshot.status === "invalid" || snapshot.status === "empty") && (
        <WorkspaceContent snapshot={snapshot} />
      )}
      {snapshot.clients.length > 0 && (
        <div className="table-scroll directory-table">
          <table>
            <thead><tr><th scope="col">Client</th><th scope="col">Client ID</th><th scope="col">Default artist</th><th scope="col">Projects</th></tr></thead>
            <tbody>
              {snapshot.clients.map((client) => (
                <tr key={client.clientId}>
                  <td><button type="button" className="table-link" onClick={() => onSelectClient(client.clientId)}>{client.clientName}</button></td>
                  <td><code>{client.clientId}</code></td>
                  <td>{client.defaultArtist || "Not set"}</td>
                  <td>{client.projects.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RouteIssues snapshot={snapshot} />
    </>
  );
}

function ClientDetails({
  client,
  onBack,
  onSelectProject,
  onNewProject,
  onRefresh,
  loading,
  projectCreationAvailable,
  projectCreationHelp,
}: {
  client: ClientSummary;
  onBack: () => void;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  loading: boolean;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
}) {
  return (
    <>
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label="Breadcrumb">
        <button type="button" onClick={onBack}>Clients</button><span aria-hidden="true">/</span><span aria-current="page">{client.clientName}</span>
      </nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      <section className="detail-summary" aria-label="Client details">
        <article><span>Client ID</span><strong><code>{client.clientId}</code></strong></article>
        <article><span>Default artist</span><strong>{client.defaultArtist || "Not set"}</strong></article>
        <article><span>Projects</span><strong>{client.projects.length}</strong></article>
      </section>
      <aside className="route-note"><strong>Read only</strong><span>Client editing is unavailable because JL Mixing Automation v1.2.0 has no approved client-edit command.</span></aside>
      <section className="detail-section" aria-labelledby="client-projects-heading">
        <div className="panel-heading"><div><p className="kicker">Client projects</p><h2 id="client-projects-heading">Projects for {client.clientName}</h2></div><div className="directory-actions"><button type="button" disabled className="planned-action">Edit client <span>Planned</span></button><button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} aria-describedby="client-new-project-help">New project</button></div></div>
        <p id="client-new-project-help" className="action-help directory-help">{projectCreationHelp}</p>
        {client.projects.length === 0 ? (
          <div className="planned-message compact"><strong>No projects for this client.</strong><p>Create the first project with the guided JL Mixing Automation workflow.</p></div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th scope="col">Project</th><th scope="col">Artist</th><th scope="col">Current</th><th scope="col">Approved</th><th scope="col">Delivered</th></tr></thead>
              <tbody>{client.projects.map((project) => (
                <tr key={project.projectId}>
                  <td><button type="button" className="table-link" onClick={() => onSelectProject(project.projectId)}>{project.projectName}</button></td>
                  <td>{project.artist}</td><td>{revisionLabel(project.currentRevision)}</td><td>{revisionLabel(project.approvedRevision)}</td><td>{revisionLabel(project.deliveredRevision)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

interface ProjectEntry {
  client: ClientSummary;
  project: ProjectSummary;
}

function ProjectsRoute({
  workspace,
  onSelectProject,
  onNewProject,
  onRefresh,
  loading,
  projectCreationAvailable,
  projectCreationHelp,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  onSelectProject: (clientId: string, projectId: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  loading: boolean;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
}) {
  if (workspace.status === "loading") return <section className="notice" aria-live="polite">Reading projects…</section>;
  if (workspace.status === "error") return <section className="notice error" role="alert"><strong>Projects could not be loaded</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;
  const entries: ProjectEntry[] = snapshot.clients.flatMap((client) => client.projects.map((project) => ({ client, project })));

  return (
    <>
      <section className="directory-toolbar" aria-labelledby="project-directory-heading">
        <div><p className="kicker">Validated workspace</p><h2 id="project-directory-heading">{entries.length} {entries.length === 1 ? "project" : "projects"}</h2></div>
        <div className="directory-actions"><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button><button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} aria-describedby="projects-new-project-help">New project</button></div>
      </section>
      <p id="projects-new-project-help" className="action-help directory-help">{projectCreationHelp}</p>
      <ContextSearch label="Projects" />
      {(snapshot.status === "unavailable" || snapshot.status === "invalid" || snapshot.status === "empty") && <WorkspaceContent snapshot={snapshot} />}
      {entries.length > 0 && (
        <div className="table-scroll directory-table">
          <table>
            <thead><tr><th scope="col">Project</th><th scope="col">Client</th><th scope="col">Artist</th><th scope="col">Current</th><th scope="col">Approved</th><th scope="col">Delivered</th></tr></thead>
            <tbody>{entries.map(({ client, project }) => (
              <tr key={`${client.clientId}:${project.projectId}`}>
                <td><button type="button" className="table-link" onClick={() => onSelectProject(client.clientId, project.projectId)}>{project.projectName}</button></td>
                <td>{client.clientName}</td><td>{project.artist}</td><td>{revisionLabel(project.currentRevision)}</td><td>{revisionLabel(project.approvedRevision)}</td><td>{revisionLabel(project.deliveredRevision)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <RouteIssues snapshot={snapshot} />
    </>
  );
}

function ProjectOverview({
  client,
  project,
  fromClient,
  onProjects,
  onClient,
  onRefresh,
  loading,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  fromClient: boolean;
  onProjects: () => void;
  onClient: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const workflowTabs = ["Overview", "Intake", "Revisions", "Delivery", "Reports", "Files", "Metadata"];
  return (
    <>
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label="Breadcrumb">
        <button type="button" onClick={onProjects}>Projects</button><span aria-hidden="true">/</span>
        {fromClient && <><button type="button" onClick={onClient}>{client.clientName}</button><span aria-hidden="true">/</span></>}
        <span aria-current="page">{project.projectName}</span>
      </nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      <div className="workflow-tabs" aria-label="Project workflow">
        {workflowTabs.map((tab) => tab === "Overview" ? <span key={tab} aria-current="page">{tab}</span> : <button key={tab} type="button" disabled>{tab}<small>Planned</small></button>)}
      </div>
      <section className="detail-summary project-revisions" aria-label="Project revision state">
        <article><span>Current</span><strong>{revisionLabel(project.currentRevision)}</strong></article>
        <article><span>Approved</span><strong>{revisionLabel(project.approvedRevision)}</strong></article>
        <article><span>Delivered</span><strong>{revisionLabel(project.deliveredRevision)}</strong></article>
      </section>
      <div className="project-detail-grid">
        <section className="panel" aria-labelledby="project-information-heading">
          <div className="panel-heading"><div><p className="kicker">Project information</p><h2 id="project-information-heading">Authoritative metadata</h2></div></div>
          <dl className="metadata-list">
            <div><dt>Client</dt><dd>{client.clientName}</dd></div><div><dt>Project ID</dt><dd><code>{project.projectId}</code></dd></div><div><dt>Artist</dt><dd>{project.artist}</dd></div><div><dt>Audio</dt><dd>{project.sampleRate / 1000} kHz / {project.bitDepth}-bit / {project.fileFormat}</dd></div><div><dt>Schema</dt><dd>{project.schemaVersion}</dd></div><div><dt>Created with</dt><dd>{project.createdWith}</dd></div>
          </dl>
        </section>
        <section className="panel" aria-labelledby="project-actions-heading">
          <div className="panel-heading"><div><p className="kicker">Project actions</p><h2 id="project-actions-heading">Workflow controls</h2></div><span className="planned-pill">Planned</span></div>
          <div className="action-stack"><button type="button" disabled>Open folder — Planned</button><button type="button" disabled>Open DAW — Planned</button><button type="button" disabled>Validate intake — Planned</button></div>
          <p className="action-help">Project creation is available from the directories; lifecycle actions remain planned.</p>
        </section>
      </div>
    </>
  );
}

function PlannedRoute({
  route,
}: {
  route: PlannedRouteId;
}) {
  const content = plannedRouteContent[route];
  const routeLabel = routes.find((item) => item.id === route)?.label ?? route;

  return (
    <section className="planned-route" aria-labelledby="planned-route-heading">
      <div className="planned-banner">
        <div>
          <span className="planned-pill">Planned</span>
          <h2 id="planned-route-heading">{content.status}</h2>
          <p>This composition reserves the approved product structure without implying unsupported data or actions.</p>
        </div>
      </div>

      {content.tableColumns && (
        <div className="collection-preview">
          <div className="context-search" aria-label={`${routeLabel} search`} aria-disabled="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <span>Search {routeLabel.toLowerCase()}</span><span className="planned-pill">Planned</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr>{content.tableColumns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
              <tbody><tr><td colSpan={content.tableColumns.length}>Validated {routeLabel.toLowerCase()} data will appear here after its focused milestone.</td></tr></tbody>
            </table>
          </div>
        </div>
      )}

      <div className="planned-section-grid">
        {content.sections.map((section) => (
          <article className="planned-section" key={section.title}>
            <span className="section-icon" aria-hidden="true" />
            <h3>{section.title}</h3>
            <p>{section.detail}</p>
            <span className="unavailable-label">Unavailable in this milestone</span>
          </article>
        ))}
      </div>
      {content.routeNote && <aside className="route-note"><strong>Route rule</strong><span>{content.routeNote}</span></aside>}
    </section>
  );
}

interface ClientDialogProps {
  state: Exclude<ClientWorkflowState, { status: "closed" }>;
  values: ClientFormValues;
  onChange: (values: ClientFormValues) => void;
  onPreflight: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}

function ClientDialog({
  state,
  values,
  onChange,
  onPreflight,
  onConfirm,
  onBack,
  onClose,
}: ClientDialogProps) {
  const clientIdInput = useRef<HTMLInputElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const pending = state.status === "preflighting" || state.status === "creating";

  useEffect(() => {
    if (state.status === "editing") clientIdInput.current?.focus();
    if (state.status === "confirming") confirmButton.current?.focus();
  }, [state.status]);

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) onClose();
      }}
    >
      <section
        className="client-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-dialog-title"
      >
        <p className="kicker">Guided setup</p>
        <h2 id="client-dialog-title">
          {state.status === "confirming" || state.status === "creating"
            ? "Confirm new client"
            : state.status === "uncertain"
              ? "Creation needs verification"
              : "New client"}
        </h2>

        {(state.status === "editing" || state.status === "preflighting") && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">
              Audio and delivery settings will inherit the current studio defaults.
            </p>
            {state.status === "editing" && state.error && (
              <div className="form-error" role="alert">{state.error}</div>
            )}
            <label>
              Client ID
              <input
                ref={clientIdInput}
                name="clientId"
                value={values.clientId}
                onChange={(event) => onChange({ ...values, clientId: event.target.value })}
                placeholder="acme-records"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={pending}
                required
              />
              <small>Lowercase letters and numbers separated by single hyphens.</small>
            </label>
            <label>
              Display name
              <input
                name="clientName"
                value={values.clientName}
                onChange={(event) => onChange({ ...values, clientName: event.target.value })}
                placeholder="Acme Records"
                autoComplete="organization"
                disabled={pending}
                required
              />
            </label>
            <label>
              Default artist <span>(optional)</span>
              <input
                name="defaultArtist"
                value={values.defaultArtist}
                onChange={(event) => onChange({ ...values, defaultArtist: event.target.value })}
                placeholder="The Artist"
                autoComplete="off"
                disabled={pending}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button type="submit" disabled={pending}>
                {pending ? "Checking…" : "Review client"}
              </button>
            </div>
          </form>
        )}

        {(state.status === "confirming" || state.status === "creating") && (
          <div>
            <p className="dialog-intro">
              Preflight passed without changing the workspace. Confirm to create this client.
            </p>
            <dl className="confirmation-list">
              <div><dt>Client ID</dt><dd>{state.preview.clientId}</dd></div>
              <div><dt>Display name</dt><dd>{state.preview.clientName}</dd></div>
              <div><dt>Default artist</dt><dd>{state.preview.defaultArtist ?? "Not set"}</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="secondary" onClick={onBack} disabled={pending}>
                Back
              </button>
              <button
                ref={confirmButton}
                type="button"
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? "Creating…" : "Create client"}
              </button>
            </div>
          </div>
        )}

        {state.status === "uncertain" && (
          <div>
            <div className="form-error" role="alert">{state.message}</div>
            <p className="dialog-intro">
              Do not submit the request again automatically. Close this message and use Refresh to inspect the workspace.
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

interface ProjectDialogProps {
  state: Exclude<ProjectWorkflowState, { status: "closed" }>;
  values: ProjectFormValues;
  clients: ClientSummary[];
  onChange: (values: ProjectFormValues) => void;
  onPreflight: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}

function ProjectDialog({
  state,
  values,
  clients,
  onChange,
  onPreflight,
  onConfirm,
  onBack,
  onClose,
}: ProjectDialogProps) {
  const clientSelect = useRef<HTMLSelectElement>(null);
  const projectNameInput = useRef<HTMLInputElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const pending = state.status === "preflighting" || state.status === "creating";
  const editing = state.status === "editing" || state.status === "preflighting";
  const lockedClientId = editing ? state.lockedClientId : null;

  useEffect(() => {
    if (state.status === "editing") {
      if (state.lockedClientId) projectNameInput.current?.focus();
      else clientSelect.current?.focus();
    }
    if (state.status === "confirming") confirmButton.current?.focus();
  }, [state]);

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) onClose();
      }}
    >
      <section
        className="client-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
      >
        <p className="kicker">Guided setup</p>
        <h2 id="project-dialog-title">
          {state.status === "confirming" || state.status === "creating"
            ? "Confirm new project"
            : state.status === "uncertain"
              ? "Creation needs verification"
              : "New project"}
        </h2>

        {editing && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">
              Audio and delivery settings inherit the selected client and studio defaults. Revision 1 is created automatically.
            </p>
            {state.status === "editing" && state.error && (
              <div className="form-error" role="alert">{state.error}</div>
            )}
            <label>
              Client
              <select
                ref={clientSelect}
                aria-label="Client"
                name="clientId"
                value={values.clientId}
                onChange={(event) => onChange({ ...values, clientId: event.target.value })}
                disabled={pending || lockedClientId !== null}
                required
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.clientId} value={client.clientId}>{client.clientName}</option>
                ))}
              </select>
              {lockedClientId && <small>This project will be created for the current client.</small>}
            </label>
            <label>
              Project name
              <input
                ref={projectNameInput}
                aria-label="Project name"
                name="projectName"
                value={values.projectName}
                onChange={(event) => onChange({ ...values, projectName: event.target.value })}
                placeholder="Blue Sky"
                autoComplete="off"
                disabled={pending}
                required
              />
              <small>JL Mixing Automation derives the stable project ID.</small>
            </label>
            <label>
              Artist <span>(optional)</span>
              <input
                name="artist"
                aria-label="Artist"
                value={values.artist}
                onChange={(event) => onChange({ ...values, artist: event.target.value })}
                placeholder="Use the client default"
                autoComplete="off"
                disabled={pending}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button>
              <button type="submit" disabled={pending}>{pending ? "Checking…" : "Review project"}</button>
            </div>
          </form>
        )}

        {(state.status === "confirming" || state.status === "creating") && (
          <div>
            <p className="dialog-intro">
              Preflight passed without changing the workspace. Confirm to create this project and Revision 1.
            </p>
            <dl className="confirmation-list">
              <div><dt>Client</dt><dd>{clients.find((client) => client.clientId === state.preview.clientId)?.clientName ?? state.preview.clientId}</dd></div>
              <div><dt>Project</dt><dd>{state.preview.projectName}</dd></div>
              <div><dt>Project ID</dt><dd><code>{state.preview.projectId}</code></dd></div>
              <div><dt>Artist</dt><dd>{state.preview.artist}</dd></div>
              <div><dt>Initial revision</dt><dd>Revision 1</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button>
              <button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button>
              <button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending}>
                {pending ? "Creating…" : "Create project"}
              </button>
            </div>
          </div>
        )}

        {state.status === "uncertain" && (
          <div>
            <div className="form-error" role="alert">{state.message}</div>
            <p className="dialog-intro">
              Do not submit the request again automatically. Close this message and use Refresh to inspect the workspace.
            </p>
            <div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [activeRoute, setActiveRoute] = useState<PrimaryRoute>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<{
    clientId: string;
    projectId: string;
    fromClient: boolean;
  } | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ResourceState<WorkspaceSnapshot>>({ status: "loading" });
  const [version, setVersion] = useState<ResourceState<VersionCheck>>({ status: "loading" });
  const [clientWorkflow, setClientWorkflow] = useState<ClientWorkflowState>({ status: "closed" });
  const [clientForm, setClientForm] = useState<ClientFormValues>(emptyClientForm);
  const [projectWorkflow, setProjectWorkflow] = useState<ProjectWorkflowState>({ status: "closed" });
  const [projectForm, setProjectForm] = useState<ProjectFormValues>(emptyProjectForm);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
  const [projectCreationNotice, setProjectCreationNotice] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(() => {
    const currentRequest = ++requestId.current;
    setWorkspace({ status: "loading" });
    setVersion({ status: "loading" });

    invoke<WorkspaceSnapshot>("discover_default_workspace")
      .then((value) => {
        if (requestId.current === currentRequest) setWorkspace({ status: "ready", value });
      })
      .catch((error: unknown) => {
        if (requestId.current === currentRequest) {
          setWorkspace({ status: "error", message: safeError(error, "Workspace discovery could not be completed.") });
        }
      });

    invoke<VersionCheck>("get_jl_mixing_version")
      .then((value) => {
        if (requestId.current === currentRequest) setVersion({ status: "ready", value });
      })
      .catch((error: unknown) => {
        if (requestId.current === currentRequest) {
          setVersion({ status: "error", message: safeError(error, "JL Mixing Automation could not be checked.") });
        }
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (workspace.status !== "ready") return;
    if (selectedProject) {
      const client = workspace.value.clients.find((item) => item.clientId === selectedProject.clientId);
      const project = client?.projects.find((item) => item.projectId === selectedProject.projectId);
      if (!client || !project) {
        setSelectedProject(null);
        setSelectedClientId(null);
        setActiveRoute("projects");
        setRouteNotice("The selected project is no longer available in the refreshed workspace.");
      }
      return;
    }
    if (selectedClientId && !workspace.value.clients.some((item) => item.clientId === selectedClientId)) {
      setSelectedClientId(null);
      setActiveRoute("clients");
      setRouteNotice("The selected client is no longer available in the refreshed workspace.");
    }
  }, [workspace, selectedClientId, selectedProject]);

  const loading = workspace.status === "loading" || version.status === "loading";
  const automationReady =
    version.status === "ready" &&
    version.value.available &&
    version.value.supported;
  const workspaceAllowsCreation =
    workspace.status === "ready" &&
    (workspace.value.status === "healthy" || workspace.value.status === "empty");
  const clientCreationAvailable =
    workspaceAllowsCreation &&
    version.status === "ready" &&
    version.value.clientCreationSupported;
  const workspaceAllowsProjectCreation =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    workspace.value.clients.length > 0;
  const projectCreationAvailable =
    workspaceAllowsProjectCreation &&
    version.status === "ready" &&
    version.value.projectCreationSupported;

  const clientCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (!workspaceAllowsCreation) {
      return "Resolve workspace issues before creating a client.";
    }
    if (!version.value.clientCreationSupported) {
      return version.value.message;
    }
    return "Preview and confirm a new client using JL Mixing Automation v1.2.0.";
  })();

  const projectCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (!workspaceAllowsProjectCreation) {
      return workspace.value.status === "empty"
        ? "Create a client before creating a project."
        : "Resolve workspace issues before creating a project.";
    }
    if (!version.value.projectCreationSupported) {
      return version.value.message;
    }
    return "Preview and confirm a new project using JL Mixing Automation v1.2.0.";
  })();

  const openClientWorkflow = () => {
    if (!clientCreationAvailable) return;
    setCreationNotice(null);
    setProjectWorkflow({ status: "closed" });
    setClientForm(emptyClientForm);
    setClientWorkflow({ status: "editing" });
  };

  const closeClientWorkflow = () => {
    if (clientWorkflow.status === "preflighting" || clientWorkflow.status === "creating") return;
    setClientWorkflow({ status: "closed" });
  };

  const openProjectWorkflow = (clientId: string | null, fromClient: boolean) => {
    if (!projectCreationAvailable) return;
    if (clientId && workspace.status === "ready" && !workspace.value.clients.some((client) => client.clientId === clientId)) return;
    setProjectCreationNotice(null);
    setClientWorkflow({ status: "closed" });
    setProjectForm({ ...emptyProjectForm, clientId: clientId ?? "" });
    setProjectWorkflow({ status: "editing", lockedClientId: clientId, fromClient });
  };

  const closeProjectWorkflow = () => {
    if (projectWorkflow.status === "preflighting" || projectWorkflow.status === "creating") return;
    setProjectWorkflow({ status: "closed" });
  };

  const preflightClient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (clientWorkflow.status !== "editing") return;

    const request: ClientCreationRequest = {
      clientId: clientForm.clientId.trim(),
      clientName: clientForm.clientName.trim(),
      defaultArtist: clientForm.defaultArtist.trim() || null,
    };
    if (!clientIdPattern.test(request.clientId)) {
      setClientWorkflow({
        status: "editing",
        error: "Client ID must use lowercase letters and numbers separated by single hyphens.",
      });
      return;
    }
    if (!request.clientName) {
      setClientWorkflow({ status: "editing", error: "Display name is required." });
      return;
    }

    setClientWorkflow({ status: "preflighting" });
    invoke<ClientOperationResult>("preflight_client_creation", { request })
      .then((result) => {
        if (result.ok && result.code === "ready" && result.client) {
          setClientWorkflow({ status: "confirming", request, preview: result.client });
        } else {
          setClientWorkflow({ status: "editing", error: result.message });
        }
      })
      .catch((error: unknown) => {
        setClientWorkflow({
          status: "editing",
          error: safeError(error, "Client preflight could not be completed."),
        });
      });
  };

  const confirmClientCreation = () => {
    if (clientWorkflow.status !== "confirming") return;
    const { request, preview } = clientWorkflow;
    setClientWorkflow({ status: "creating", request, preview });

    invoke<ClientOperationResult>("create_client", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created") {
          setClientWorkflow({ status: "editing", error: result.message });
          return;
        }

        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const discovered = refreshed.clients.some(
            (client) => client.clientId === request.clientId,
          );
          if (!discovered) {
            setClientWorkflow({
              status: "uncertain",
              message: "JL Mixing Automation reported success, but the new client was not found after refresh. The operation may have completed.",
            });
            return;
          }
          setCreationNotice(`${request.clientName} was created and added to the workspace.`);
          setClientWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setClientWorkflow({
            status: "uncertain",
            message: safeError(
              error,
              "JL Mixing Automation reported success, but the workspace could not be refreshed. The operation may have completed.",
            ),
          });
        }
      })
      .catch((error: unknown) => {
        setClientWorkflow({
          status: "editing",
          error: safeError(error, "Client creation could not be completed."),
        });
      });
  };

  const preflightProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectWorkflow.status !== "editing") return;
    const { lockedClientId, fromClient } = projectWorkflow;
    const request: ProjectCreationRequest = {
      clientId: projectForm.clientId.trim(),
      projectName: projectForm.projectName.trim(),
      artist: projectForm.artist.trim() || null,
    };
    const clientExists = workspace.status === "ready" && workspace.value.clients.some(
      (client) => client.clientId === request.clientId,
    );
    if (!clientExists) {
      setProjectWorkflow({ status: "editing", lockedClientId, fromClient, error: "Select a valid client." });
      return;
    }
    if (!request.projectName) {
      setProjectWorkflow({ status: "editing", lockedClientId, fromClient, error: "Project name is required." });
      return;
    }

    setProjectWorkflow({ status: "preflighting", lockedClientId, fromClient });
    invoke<ProjectOperationResult>("preflight_project_creation", { request })
      .then((result) => {
        if (result.ok && result.code === "ready" && result.project) {
          setProjectWorkflow({ status: "confirming", request, preview: result.project, fromClient });
        } else {
          setProjectWorkflow({ status: "editing", lockedClientId, fromClient, error: result.message });
        }
      })
      .catch((error: unknown) => {
        setProjectWorkflow({
          status: "editing",
          lockedClientId,
          fromClient,
          error: safeError(error, "Project preflight could not be completed."),
        });
      });
  };

  const confirmProjectCreation = () => {
    if (projectWorkflow.status !== "confirming") return;
    const { request, preview, fromClient } = projectWorkflow;
    setProjectWorkflow({ status: "creating", request, preview, fromClient });

    invoke<ProjectOperationResult>("create_project", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.project) {
          if (result.code === "uncertain") {
            setProjectWorkflow({ status: "uncertain", message: result.message });
          } else {
            setProjectWorkflow({
              status: "editing",
              lockedClientId: fromClient ? request.clientId : null,
              fromClient,
              error: result.message,
            });
          }
          return;
        }
        if (
          result.project.clientId !== preview.clientId ||
          result.project.projectId !== preview.projectId
        ) {
          setProjectWorkflow({
            status: "uncertain",
            message: "JL Mixing Automation reported success, but the created project identity did not match the preflight. The operation may have completed.",
          });
          return;
        }

        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === result.project?.clientId);
          const project = client?.projects.find((item) => item.projectId === result.project?.projectId);
          if (!client || !project) {
            setProjectWorkflow({
              status: "uncertain",
              message: "JL Mixing Automation reported success, but the new project was not found after refresh. The operation may have completed.",
            });
            return;
          }
          setProjectCreationNotice(`${project.projectName} was created with Revision 1.`);
          setSelectedClientId(null);
          setSelectedProject({ clientId: client.clientId, projectId: project.projectId, fromClient });
          setActiveRoute("projects");
          setRouteNotice(null);
          setProjectWorkflow({ status: "closed" });
        } catch (error: unknown) {
          const detail = safeError(error, "");
          setProjectWorkflow({
            status: "uncertain",
            message: `JL Mixing Automation reported success, but the workspace could not be refreshed. The operation may have completed.${detail ? ` ${detail}` : ""}`,
          });
        }
      })
      .catch((error: unknown) => {
        const detail = safeError(error, "");
        setProjectWorkflow({
          status: "uncertain",
          message: `The project creation result could not be confirmed. The operation may have completed.${detail ? ` ${detail}` : ""}`,
        });
      });
  };

  const navigate = (route: PrimaryRoute) => {
    setActiveRoute(route);
    setSelectedClientId(null);
    setSelectedProject(null);
    setRouteNotice(null);
  };

  const resolvedClient = workspace.status === "ready" && selectedClientId
    ? workspace.value.clients.find((client) => client.clientId === selectedClientId) ?? null
    : null;
  const resolvedProjectClient = workspace.status === "ready" && selectedProject
    ? workspace.value.clients.find((client) => client.clientId === selectedProject.clientId) ?? null
    : null;
  const resolvedProject = resolvedProjectClient && selectedProject
    ? resolvedProjectClient.projects.find((project) => project.projectId === selectedProject.projectId) ?? null
    : null;
  const baseRouteDefinition = routes.find((route) => route.id === activeRoute) ?? routes[0];
  const activeRouteDefinition: RouteDefinition = resolvedProject
    ? {
        id: "projects",
        label: "Projects",
        eyebrow: "Project overview",
        title: resolvedProject.projectName,
        description: `${resolvedProject.artist} · Read-only authoritative project state.`,
      }
    : resolvedClient
      ? {
          id: "clients",
          label: "Clients",
          eyebrow: "Client details",
          title: resolvedClient.clientName,
          description: "Validated client defaults and projects from the current workspace.",
        }
      : baseRouteDefinition;

  return (
    <div className="app-shell">
      <Sidebar activeRoute={activeRoute} onNavigate={navigate} workspace={workspace} />
      <main className="main-content" id="main-content">
        <RouteHeader route={activeRouteDefinition} />
        {routeNotice && <section className="notice warning" role="status"><strong>Selection changed</strong><span>{routeNotice}</span></section>}
        {creationNotice && (
          <section className="notice success" role="status">
            <strong>Client created</strong>
            <span>{creationNotice}</span>
          </section>
        )}
        {projectCreationNotice && (
          <section className="notice success" role="status">
            <strong>Project created</strong>
            <span>{projectCreationNotice}</span>
          </section>
        )}
        {activeRoute === "dashboard" && (
          <Dashboard
            workspace={workspace}
            version={version}
            automationReady={automationReady}
            loading={loading}
            clientCreationAvailable={clientCreationAvailable}
            clientCreationHelp={clientCreationHelp}
            onRefresh={refresh}
            onNewClient={openClientWorkflow}
          />
        )}
        {activeRoute === "clients" && (resolvedClient ? (
          <ClientDetails
            client={resolvedClient}
            onBack={() => { setSelectedClientId(null); setRouteNotice(null); }}
            onRefresh={refresh}
            loading={loading}
            onNewProject={() => openProjectWorkflow(resolvedClient.clientId, true)}
            projectCreationAvailable={projectCreationAvailable}
            projectCreationHelp={projectCreationHelp}
            onSelectProject={(projectId) => {
              setSelectedProject({ clientId: resolvedClient.clientId, projectId, fromClient: true });
              setActiveRoute("projects");
              setRouteNotice(null);
            }}
          />
        ) : (
          <ClientsRoute
            workspace={workspace}
            onSelectClient={(clientId) => { setSelectedClientId(clientId); setRouteNotice(null); }}
            onNewClient={openClientWorkflow}
            onRefresh={refresh}
            loading={loading}
            clientCreationAvailable={clientCreationAvailable}
            clientCreationHelp={clientCreationHelp}
          />
        ))}
        {activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject ? (
          <ProjectOverview
            client={resolvedProjectClient}
            project={resolvedProject}
            fromClient={selectedProject.fromClient}
            onProjects={() => { setSelectedProject(null); setSelectedClientId(null); setRouteNotice(null); }}
            onClient={() => {
              setSelectedProject(null);
              setSelectedClientId(resolvedProjectClient.clientId);
              setActiveRoute("clients");
              setRouteNotice(null);
            }}
            onRefresh={refresh}
            loading={loading}
          />
        ) : activeRoute === "projects" ? (
          <ProjectsRoute
            workspace={workspace}
            onRefresh={refresh}
            loading={loading}
            onNewProject={() => openProjectWorkflow(null, false)}
            projectCreationAvailable={projectCreationAvailable}
            projectCreationHelp={projectCreationHelp}
            onSelectProject={(clientId, projectId) => {
              setSelectedClientId(null);
              setSelectedProject({ clientId, projectId, fromClient: false });
              setRouteNotice(null);
            }}
          />
        ) : null}
        {activeRoute !== "dashboard" && activeRoute !== "clients" && activeRoute !== "projects" && (
          <PlannedRoute route={activeRoute} />
        )}
      </main>

      {clientWorkflow.status !== "closed" && (
        <ClientDialog
          state={clientWorkflow}
          values={clientForm}
          onChange={setClientForm}
          onPreflight={preflightClient}
          onConfirm={confirmClientCreation}
          onBack={() => setClientWorkflow({ status: "editing" })}
          onClose={closeClientWorkflow}
        />
      )}
      {projectWorkflow.status !== "closed" && (
        <ProjectDialog
          state={projectWorkflow}
          values={projectForm}
          clients={workspace.status === "ready" ? workspace.value.clients : []}
          onChange={setProjectForm}
          onPreflight={preflightProject}
          onConfirm={confirmProjectCreation}
          onBack={() => {
            if (projectWorkflow.status !== "confirming") return;
            setProjectWorkflow({
              status: "editing",
              lockedClientId: projectWorkflow.fromClient ? projectWorkflow.request.clientId : null,
              fromClient: projectWorkflow.fromClient,
            });
          }}
          onClose={closeProjectWorkflow}
        />
      )}
    </div>
  );
}
