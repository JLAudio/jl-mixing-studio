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
  ActivityEvent,
  ApprovalOperationResult,
  ClientCreationRequest,
  ClientCreationSummary,
  ClientOperationResult,
  ClientSummary,
  DeliveryCreationPreview,
  DeliveryCreationRequest,
  DeliveryOperationResult,
  DerivedTask,
  DiscoveryIssue,
  FolderLocation,
  FolderRequest,
  FolderResult,
  IntakeOperationResult,
  IntakeReport,
  IntakeRequest,
  ProjectCreationRequest,
  ProjectCreationSummary,
  ProjectOperationResult,
  ProjectSummary,
  RevisionApprovalRequest,
  RevisionApprovalSummary,
  RevisionCreationRequest,
  RevisionCreationSummary,
  RevisionOperationResult,
  RevisionSummary,
  StudioCreationRequest,
  StudioCreationSummary,
  StudioOperationResult,
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

type ProjectView = "overview" | "intake" | "revisions" | "delivery" | "reports" | "files" | "metadata";

type IntakeWorkflowState =
  | { status: "closed" }
  | { status: "preflighting" }
  | { status: "confirming"; preview: IntakeReport }
  | { status: "running"; preview: IntakeReport }
  | { status: "uncertain"; message: string };

type IntakeReportState = { status: "idle" } | ResourceState<IntakeOperationResult>;

type RevisionWorkflowState =
  | { status: "closed" }
  | { status: "editing"; error?: string }
  | { status: "preflighting" }
  | {
      status: "confirming";
      request: RevisionCreationRequest;
      preview: RevisionCreationSummary;
    }
  | {
      status: "creating";
      request: RevisionCreationRequest;
      preview: RevisionCreationSummary;
    }
  | { status: "uncertain"; message: string };

interface RevisionFormValues {
  description: string;
}

type ApprovalWorkflowState =
  | { status: "closed" }
  | { status: "editing"; revision: RevisionSummary; error?: string }
  | { status: "preflighting"; revision: RevisionSummary }
  | {
      status: "confirming";
      revision: RevisionSummary;
      request: RevisionApprovalRequest;
      preview: RevisionApprovalSummary;
    }
  | {
      status: "approving";
      revision: RevisionSummary;
      request: RevisionApprovalRequest;
      preview: RevisionApprovalSummary;
    }
  | { status: "uncertain"; revision: RevisionSummary; message: string };

interface ApprovalFormValues {
  approvedBy: string;
}

type DeliveryWorkflowState =
  | { status: "closed" }
  | { status: "preflighting" }
  | {
      status: "confirming";
      request: DeliveryCreationRequest;
      preview: DeliveryCreationPreview;
    }
  | {
      status: "creating";
      request: DeliveryCreationRequest;
      preview: DeliveryCreationPreview;
    }
  | { status: "uncertain"; message: string };

type StudioWorkflowState =
  | { status: "closed" }
  | { status: "editing"; error?: string }
  | { status: "preflighting" }
  | { status: "confirming"; request: StudioCreationRequest; preview: StudioCreationSummary }
  | { status: "creating"; request: StudioCreationRequest; preview: StudioCreationSummary }
  | { status: "uncertain"; message: string };

interface StudioFormValues {
  studioName: string;
  mixEngineer: string;
  sampleRate: string;
  bitDepth: string;
  fileFormat: string;
}

interface AppPreferences { compactLayout: boolean; reduceMotion: boolean; }
const defaultPreferences: AppPreferences = { compactLayout: false, reduceMotion: false };
const loadPreferences = (): AppPreferences => {
  try {
    const parsed = JSON.parse(localStorage.getItem("jl-mixing-studio.preferences") ?? "null") as Partial<AppPreferences> | null;
    return { compactLayout: parsed?.compactLayout === true, reduceMotion: parsed?.reduceMotion === true };
  } catch { return defaultPreferences; }
};

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

const emptyStudioForm: StudioFormValues = {
  studioName: "",
  mixEngineer: "",
  sampleRate: "48000",
  bitDepth: "24",
  fileFormat: "WAV",
};

function FolderControl({ location, clientId = null, projectId = null, label = "Open folder" }: { location: FolderLocation; clientId?: string | null; projectId?: string | null; label?: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const request: FolderRequest = { location, clientId, projectId };
  const resolve = () => invoke<FolderResult>("resolve_folder", { request }).then((result) => { setPath(result.path); setMessage(null); return result; });
  useEffect(() => {
    const currentRequest: FolderRequest = { location, clientId, projectId };
    void invoke<FolderResult>("resolve_folder", { request: currentRequest })
      .then((result) => setPath(result.path))
      .catch(() => setPath(null));
  }, [location, clientId, projectId]);
  const copy = () => resolve().then((result) => navigator.clipboard.writeText(result.path)).then(() => setMessage("Path copied.")).catch((error: unknown) => setMessage(safeError(error, "The path could not be copied.")));
  const open = () => invoke<FolderResult>("open_folder", { request }).then((result) => { setPath(result.path); setMessage("Folder opened."); }).catch((error: unknown) => setMessage(safeError(error, "The folder could not be opened.")));
  return <div className="folder-control"><code>{path ?? "Resolving folder…"}</code><div className="directory-actions"><button type="button" className="secondary" onClick={copy} disabled={!path}>Copy path</button><button type="button" onClick={open}>{label}</button></div>{message && <small role="status">{message}</small>}</div>;
}

const emptyRevisionForm: RevisionFormValues = { description: "" };
const emptyApprovalForm: ApprovalFormValues = { approvedBy: "Client" };

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

const sameDeliveryPlan = (
  left: DeliveryCreationPreview,
  right: DeliveryCreationPreview,
) =>
  left.clientId === right.clientId &&
  left.projectId === right.projectId &&
  left.projectName === right.projectName &&
  left.currentRevision === right.currentRevision &&
  left.approvedRevision === right.approvedRevision &&
  left.deliveryMethod === right.deliveryMethod &&
  left.selected.length === right.selected.length &&
  left.selected.every((file, index) => {
    const candidate = right.selected[index];
    return candidate &&
      file.sourceName === candidate.sourceName &&
      file.deliverableType === candidate.deliverableType &&
      file.path === candidate.path;
  });

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

const taskPriorityLabel: Record<DerivedTask["priority"], string> = { recovery: "Recovery", overdue: "Overdue", delivery: "Delivery", upcoming: "Upcoming", review: "Review" };
const activityEventLabel: Record<ActivityEvent["eventType"], string> = { clientCreated: "Client created", projectCreated: "Project created", revisionCreated: "Revision created", revisionApproved: "Revision approved", deliveryCreated: "Delivery created" };
const formatEventTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function TaskSummary({ task, onOpenProject }: { task: DerivedTask; onOpenProject: (clientId: string, projectId: string) => void }) {
  return <article className="derived-item"><span className={`priority-pill ${task.priority}`}>{taskPriorityLabel[task.priority]}</span><div><strong>{task.title}</strong><p>{task.reason}</p><small>{task.deadline ? `Deadline ${task.deadline} · ` : ""}{task.recommendedAction}</small></div>{task.clientId && task.projectId && <button type="button" className="table-link" onClick={() => onOpenProject(task.clientId!, task.projectId!)}>{task.projectName}</button>}</article>;
}
function ActivitySummary({ event, onOpenProject }: { event: ActivityEvent; onOpenProject: (clientId: string, projectId: string) => void }) {
  const label = event.revision === null ? activityEventLabel[event.eventType] : `${activityEventLabel[event.eventType]} · Revision ${event.revision}`;
  return <article className="derived-item activity-item"><time dateTime={event.timestamp}>{formatEventTimestamp(event.timestamp)}</time><div><strong>{label}</strong><small>{event.projectName ?? event.clientName}</small></div>{event.projectId && <button type="button" className="table-link" onClick={() => onOpenProject(event.clientId, event.projectId!)}>Open project</button>}</article>;
}

function Dashboard({
  workspace,
  version,
  automationReady,
  loading,
  clientCreationAvailable,
  clientCreationHelp,
  projectCreationAvailable,
  projectCreationHelp,
  onRefresh,
  onNewClient,
  onNewProject,
  onTasks,
  onActivity,
  onOpenProject,
}: {
  workspace: ResourceState<WorkspaceSnapshot>;
  version: ResourceState<VersionCheck>;
  automationReady: boolean;
  loading: boolean;
  clientCreationAvailable: boolean;
  clientCreationHelp: string;
  projectCreationAvailable: boolean;
  projectCreationHelp: string;
  onRefresh: () => void;
  onNewClient: () => void;
  onNewProject: () => void;
  onTasks: () => void;
  onActivity: () => void;
  onOpenProject: (clientId: string, projectId: string) => void;
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
            <button type="button" className="table-link" onClick={onTasks}>View all</button>
          </div>
          {snapshot && snapshot.tasks.length > 0 ? <div className="derived-list">{snapshot.tasks.slice(0, 4).map((task) => <TaskSummary key={task.id} task={task} onOpenProject={onOpenProject} />)}</div> : <div className="planned-message"><strong>No derived actions need attention.</strong><p>Refresh rebuilds priorities from authoritative state.</p></div>}
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
            <button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} title={projectCreationHelp}>New project</button>
            <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh workspace"}</button>
          </div>
          <p id="new-client-help" className="action-help">{clientCreationHelp}</p>
        </section>

        <section className="panel activity-panel" aria-labelledby="activity-heading">
          <div className="panel-heading"><div><p className="kicker">Recent activity</p><h2 id="activity-heading">Persisted project events</h2></div><button type="button" className="table-link" onClick={onActivity}>View all</button></div>
          {snapshot && snapshot.activity.length > 0 ? <div className="derived-list">{snapshot.activity.slice(0, 5).map((event) => <ActivitySummary key={event.id} event={event} onOpenProject={onOpenProject} />)}</div> : <div className="planned-message compact"><strong>No supported persisted events found.</strong><p>Only validated creation, revision, approval, and delivery timestamps appear here.</p></div>}
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

function TasksRoute({ workspace, loading, onRefresh, onOpenProject }: { workspace: ResourceState<WorkspaceSnapshot>; loading: boolean; onRefresh: () => void; onOpenProject: (clientId: string, projectId: string) => void }) {
  if (workspace.status === "loading") return <section className="notice">Deriving tasks…</section>;
  if (workspace.status === "error") return <section className="notice error"><strong>Tasks could not be derived</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;
  return <><section className="directory-toolbar"><div><p className="kicker">Authoritative workspace</p><h2>{snapshot.tasks.length} derived {snapshot.tasks.length === 1 ? "task" : "tasks"}</h2></div><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></section><ContextSearch label="Tasks" />{snapshot.tasks.length === 0 ? <section className="empty-state"><h2>No derived tasks</h2><p>No validated condition currently requires attention.</p></section> : <section className="panel"><div className="table-scroll"><table><thead><tr><th>Priority</th><th>Task</th><th>Project</th><th>Reason</th><th>Recommended action</th></tr></thead><tbody>{snapshot.tasks.map((task) => <tr key={task.id}><td><span className={`priority-pill ${task.priority}`}>{taskPriorityLabel[task.priority]}</span></td><td><strong>{task.title}</strong>{task.deadline && <small className="table-detail">Deadline {task.deadline}</small>}</td><td>{task.clientId && task.projectId ? <button type="button" className="table-link" onClick={() => onOpenProject(task.clientId!, task.projectId!)}>{task.projectName}</button> : task.projectName ?? "Workspace"}</td><td>{task.reason}</td><td>{task.recommendedAction}</td></tr>)}</tbody></table></div></section>}<aside className="route-note"><strong>Derived on refresh</strong><span>Tasks have no manual completion state or application-owned database.</span></aside></>;
}

function ActivityRoute({ workspace, loading, onRefresh, onOpenProject }: { workspace: ResourceState<WorkspaceSnapshot>; loading: boolean; onRefresh: () => void; onOpenProject: (clientId: string, projectId: string) => void }) {
  if (workspace.status === "loading") return <section className="notice">Deriving activity…</section>;
  if (workspace.status === "error") return <section className="notice error"><strong>Activity could not be derived</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;
  return <><section className="directory-toolbar"><div><p className="kicker">Persisted timestamps</p><h2>{snapshot.activity.length} derived {snapshot.activity.length === 1 ? "event" : "events"}</h2></div><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></section><ContextSearch label="Activity" />{snapshot.activity.length === 0 ? <section className="empty-state"><h2>No supported activity events</h2><p>No validated event timestamps are available.</p></section> : <section className="panel"><div className="table-scroll"><table><thead><tr><th>Timestamp</th><th>Event</th><th>Project or client</th><th>Persisted source</th></tr></thead><tbody>{snapshot.activity.map((event) => <tr key={event.id}><td><time dateTime={event.timestamp}>{formatEventTimestamp(event.timestamp)}</time></td><td>{activityEventLabel[event.eventType]}{event.revision !== null && <small className="table-detail">Revision {event.revision}</small>}</td><td>{event.projectId ? <button type="button" className="table-link" onClick={() => onOpenProject(event.clientId, event.projectId!)}>{event.projectName}</button> : event.clientName}</td><td><code>{event.persistedSource}</code></td></tr>)}</tbody></table></div></section>}<aside className="route-note"><strong>Derived event feed</strong><span>This is not a complete audit log. It includes only timestamps persisted by JL Mixing Automation.</span></aside></>;
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

function ProjectWorkflowTabs({
  active,
  onSelect,
}: {
  active: ProjectView;
  onSelect: (view: ProjectView) => void;
}) {
  const tabs: Array<[ProjectView, string]> = [["overview", "Overview"], ["intake", "Intake"], ["revisions", "Revisions"], ["delivery", "Delivery"], ["reports", "Reports"], ["files", "Files"], ["metadata", "Metadata"]];
  return (
    <div className="workflow-tabs" aria-label="Project workflow">
      {tabs.map(([view, label]) => active === view ? <span key={view} aria-current="page">{label}</span> : <button key={view} type="button" onClick={() => onSelect(view)}>{label}</button>)}
    </div>
  );
}

function ProjectOverview({
  client,
  project,
  fromClient,
  onProjects,
  onClient,
  onRefresh,
  onIntake,
  onRevisions,
  onSelectView,
  onNewRevision,
  revisionCreationAvailable,
  revisionCreationHelp,
  loading,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  fromClient: boolean;
  onProjects: () => void;
  onClient: () => void;
  onRefresh: () => void;
  onIntake: () => void;
  onRevisions: () => void;
  onSelectView: (view: ProjectView) => void;
  onNewRevision: () => void;
  revisionCreationAvailable: boolean;
  revisionCreationHelp: string;
  loading: boolean;
}) {
  return (
    <>
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label="Breadcrumb">
        <button type="button" onClick={onProjects}>Projects</button><span aria-hidden="true">/</span>
        {fromClient && <><button type="button" onClick={onClient}>{client.clientName}</button><span aria-hidden="true">/</span></>}
        <span aria-current="page">{project.projectName}</span>
      </nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      <ProjectWorkflowTabs active="overview" onSelect={onSelectView} />
      <section className="detail-summary project-revisions" aria-label="Project revision state">
        <article><span>Current</span><strong>{revisionLabel(project.currentRevision)}</strong></article>
        <article><span>Approved</span><strong>{revisionLabel(project.approvedRevision)}</strong></article>
        <article><span>Delivered</span><strong>{revisionLabel(project.deliveredRevision)}</strong></article>
      </section>
      <div className="project-detail-grid">
        <section className="panel" aria-labelledby="project-information-heading">
          <div className="panel-heading"><div><p className="kicker">Project information</p><h2 id="project-information-heading">Authoritative metadata</h2></div></div>
          <dl className="metadata-list">
            <div><dt>Client</dt><dd>{client.clientName}</dd></div><div><dt>Project ID</dt><dd><code>{project.projectId}</code></dd></div><div><dt>Artist</dt><dd>{project.artist}</dd></div><div><dt>Deadline</dt><dd>{project.deadline ?? "Not set"}</dd></div><div><dt>Audio</dt><dd>{project.sampleRate / 1000} kHz / {project.bitDepth}-bit / {project.fileFormat}</dd></div><div><dt>Schema</dt><dd>{project.schemaVersion}</dd></div><div><dt>Created with</dt><dd>{project.createdWith}</dd></div>
          </dl>
        </section>
        <section className="panel" aria-labelledby="project-actions-heading">
          <div className="panel-heading"><div><p className="kicker">Project actions</p><h2 id="project-actions-heading">Workflow controls</h2></div></div>
          <div className="action-stack"><button type="button" disabled>Open DAW — Planned</button><button type="button" onClick={onIntake}>Validate intake</button><button type="button" onClick={onNewRevision} disabled={!revisionCreationAvailable || loading}>New revision</button><button type="button" onClick={onRevisions}>View revisions</button></div>
          <FolderControl location="project" clientId={client.clientId} projectId={project.projectId} />
          <p className="action-help">{revisionCreationHelp}</p>
        </section>
      </div>
    </>
  );
}

function IntakeReportContent({ report, compact = false }: { report: IntakeReport; compact?: boolean }) {
  const findingGroups = [
    ["Critical errors", report.criticalErrors],
    ["Duplicate filenames", report.duplicateFilenames],
    ["Project-format mismatches", report.formatMismatches],
    ["Unsupported or non-audio files", report.unsupportedFiles],
    ["Skipped or unavailable checks", report.unavailableChecks],
  ] as const;
  return (
    <>
      <section className="detail-summary intake-summary" aria-label="Intake summary">
        <article><span>Files</span><strong>{report.filesDiscovered}</strong></article>
        <article><span>Blocking errors</span><strong>{report.blockingErrors}</strong></article>
        <article><span>Warnings</span><strong>{report.warnings}</strong></article>
      </section>
      <p className="intake-format">Expected format: {report.expectedSampleRate / 1000} kHz / {report.expectedBitDepth}-bit · Enhanced inspection {report.enhancedInspectionAvailable ? "available" : "unavailable"}</p>
      {!compact && (
        <>
          <div className="intake-findings">
            {findingGroups.map(([label, findings]) => (
              <section key={label} className="panel">
                <h3>{label}</h3>
                {findings.length > 0 ? <ul>{findings.map((finding) => <li key={finding}>{finding}</li>)}</ul> : <p>None.</p>}
              </section>
            ))}
          </div>
          <section className="panel intake-inventory" aria-labelledby="intake-inventory-heading">
            <div className="panel-heading"><div><p className="kicker">Source inventory</p><h2 id="intake-inventory-heading">{report.inventory.length} inspected {report.inventory.length === 1 ? "file" : "files"}</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th scope="col">File</th><th scope="col">Size</th><th scope="col">Technical details</th></tr></thead><tbody>
              {report.inventory.map((item) => <tr key={item.file}><td><code>{item.file}</code></td><td>{item.sizeBytes.toLocaleString()} bytes</td><td>{item.technicalDetails}</td></tr>)}
              {report.inventory.length === 0 && <tr><td colSpan={3}>No files discovered.</td></tr>}
            </tbody></table></div>
          </section>
          <section className="panel intake-recommendations"><p className="kicker">Preparation recommendations</p><ul>{report.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <p className="intake-source">Source: <code>{report.source}</code></p>
        </>
      )}
    </>
  );
}

function IntakeView({
  client,
  project,
  reportState,
  actionError,
  validationAvailable,
  validationHelp,
  loading,
  onOverview,
  onPreview,
  onRefresh,
  onSelectView,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  reportState: IntakeReportState;
  actionError: string | null;
  validationAvailable: boolean;
  validationHelp: string;
  loading: boolean;
  onOverview: () => void;
  onPreview: () => void;
  onRefresh: () => void;
  onSelectView: (view: ProjectView) => void;
}) {
  const result = reportState.status === "ready" ? reportState.value : null;
  return (
    <>
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Intake</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      <ProjectWorkflowTabs active="intake" onSelect={onSelectView} />
      <section className="directory-toolbar intake-toolbar" aria-labelledby="intake-heading">
        <div><p className="kicker">{client.clientName}</p><h2 id="intake-heading">Intake validation</h2></div>
        <button type="button" onClick={onPreview} disabled={!validationAvailable || loading}>Preview validation</button>
      </section>
      <p className="action-help directory-help">{validationHelp}</p>
      <FolderControl location="intake" clientId={client.clientId} projectId={project.projectId} label="Open intake folder" />
      {actionError && <div className="notice error" role="alert">{actionError}</div>}
      {(reportState.status === "idle" || reportState.status === "loading") && <section className="empty-state"><h2>Loading intake report</h2><p>Reading the Automation-managed report from the validated project.</p></section>}
      {reportState.status === "error" && <section className="notice error" role="alert"><strong>Report unavailable</strong><span>{reportState.message}</span></section>}
      {result && !result.ok && <section className="notice error" role="alert"><strong>Report unavailable</strong><span>{result.message}</span></section>}
      {result?.ok && !result.report && <section className="empty-state"><h2>Intake validation has not been run</h2><p>Preview the default Automation validation before updating the managed report section.</p></section>}
      {result?.ok && result.report && <IntakeReportContent report={result.report} />}
    </>
  );
}

const formatRevisionTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function RevisionBadges({ project, number, historicallyApproved }: { project: ProjectSummary; number: number; historicallyApproved: boolean }) {
  const badges: Array<[string, string]> = [];
  if (number === project.currentRevision) badges.push(["Current", "current"]);
  if (number === project.approvedRevision) badges.push(["Approved", "approved"]);
  if (number === project.deliveredRevision) badges.push(["Delivered", "delivered"]);
  if (historicallyApproved && number !== project.approvedRevision) badges.push(["Previously approved", "historical"]);
  if (badges.length === 0 && number < project.currentRevision) badges.push(["Superseded", "superseded"]);
  return <span className="revision-badges">{badges.map(([label, className]) => <span key={label} className={`revision-badge ${className}`}>{label}</span>)}</span>;
}

function RevisionsView({
  client,
  project,
  loading,
  actionError,
  creationAvailable,
  creationHelp,
  approvalAvailable,
  approvalHelp,
  onOverview,
  onRefresh,
  onNewRevision,
  onApprove,
  onSelectView,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  loading: boolean;
  actionError: string | null;
  creationAvailable: boolean;
  creationHelp: string;
  approvalAvailable: boolean;
  approvalHelp: string;
  onOverview: () => void;
  onRefresh: () => void;
  onNewRevision: () => void;
  onApprove: (revision: RevisionSummary) => void;
  onSelectView: (view: ProjectView) => void;
}) {
  const revisions = [...project.revisions].sort((left, right) => right.number - left.number);
  const [selectedNumber, setSelectedNumber] = useState(project.currentRevision);
  const selected = revisions.find((revision) => revision.number === selectedNumber) ?? revisions[0] ?? null;
  useEffect(() => setSelectedNumber(project.currentRevision), [project.currentRevision]);

  return (
    <>
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Revisions</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      <ProjectWorkflowTabs active="revisions" onSelect={onSelectView} />
      <section className="directory-toolbar revision-toolbar" aria-labelledby="revisions-heading">
        <div><p className="kicker">{client.clientName}</p><h2 id="revisions-heading">Revision history</h2></div>
        <div className="directory-actions"><button type="button" onClick={onNewRevision} disabled={!creationAvailable || loading}>New revision</button><button type="button" onClick={() => { if (selected) onApprove(selected); }} disabled={!selected || !approvalAvailable || selected.number === project.approvedRevision || loading}>Approve revision</button></div>
      </section>
      <p className="action-help directory-help">{creationHelp}</p>
      <p className="action-help directory-help">{selected?.number === project.approvedRevision ? "The selected revision is already approved." : approvalHelp}</p>
      <FolderControl location="revisions" clientId={client.clientId} projectId={project.projectId} label="Open revisions folder" />
      {actionError && <div className="notice error" role="alert">{actionError}</div>}
      {revisions.length === 0 ? (
        <section className="empty-state"><h2>No revisions recorded</h2><p>The project manifest does not contain a revision yet.</p></section>
      ) : (
        <div className="revision-history-layout">
          <nav className="revision-list panel" aria-label="Revision history">
            {revisions.map((revision) => (
              <button key={revision.revisionId} type="button" className="revision-list-item" aria-pressed={revision.number === selected?.number} onClick={() => setSelectedNumber(revision.number)}>
                <span><strong>Revision {revision.number}</strong><small>{formatRevisionTimestamp(revision.createdAt)}</small></span>
                <RevisionBadges project={project} number={revision.number} historicallyApproved={revision.approvedAt !== null} />
              </button>
            ))}
          </nav>
          {selected && (
            <section className="panel revision-detail" aria-labelledby="revision-detail-heading">
              <div className="panel-heading"><div><p className="kicker">Selected revision</p><h2 id="revision-detail-heading">Revision {selected.number}</h2></div><RevisionBadges project={project} number={selected.number} historicallyApproved={selected.approvedAt !== null} /></div>
              <dl className="metadata-list">
                <div><dt>Created</dt><dd><time dateTime={selected.createdAt}>{formatRevisionTimestamp(selected.createdAt)}</time></dd></div>
                <div><dt>Revision ID</dt><dd><code>{selected.revisionId}</code></dd></div>
                <div><dt>Manifest description</dt><dd>{selected.description}</dd></div>
                <div><dt>Approval</dt><dd>{selected.approvedAt && selected.approvedBy ? <><span>Approved by {selected.approvedBy}</span><small><time dateTime={selected.approvedAt}>{formatRevisionTimestamp(selected.approvedAt)}</time></small></> : "Not approved"}</dd></div>
              </dl>
              <aside className="route-note"><strong>Authoritative record</strong><span>Details come from <code>00_Admin/project-manifest.json</code>. No project files were scanned or changed.</span></aside>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function ProjectArtifactsView({ active, client, project, onSelectView }: { active: "reports" | "files" | "metadata"; client: ClientSummary; project: ProjectSummary; onSelectView: (view: ProjectView) => void }) {
  const [report, setReport] = useState<IntakeOperationResult | null>(null);
  useEffect(() => {
    let current = true;
    void invoke<IntakeOperationResult>("get_intake_report", { request: { clientId: client.clientId, projectId: project.projectId } })
      .then((result) => { if (current) setReport(result); })
      .catch(() => { if (current) setReport(null); });
    return () => { current = false; };
  }, [client.clientId, project.projectId]);
  const intake = report?.ok ? report.report : null;
  return <>
    <ProjectWorkflowTabs active={active} onSelect={onSelectView} />
    <section className="directory-toolbar"><div><p className="kicker">{client.clientName}</p><h2>{active === "reports" ? "Project reports" : active === "files" ? "Authoritative files" : "Project metadata"}</h2></div></section>
    {active === "reports" && <div className="project-detail-grid"><section className="panel"><h3>Intake validation report</h3><p>{intake ? `${intake.filesDiscovered} files · ${intake.blockingErrors} blocking errors · ${intake.warnings} warnings` : "No readable intake report is recorded."}</p>{intake && <code>{intake.source}</code>}</section><section className="panel"><h3>Delivery manifest</h3><p>{project.delivery ? `Revision ${project.delivery.revision} · ${project.delivery.files.length} files · ${project.delivery.method}` : "No validated delivery manifest is recorded."}</p>{project.delivery && <code>05_Final_Delivery/delivery-manifest.json</code>}</section></div>}
    {active === "files" && <section className="panel"><div className="table-scroll"><table><thead><tr><th>File</th><th>Source</th><th>Details</th></tr></thead><tbody>{intake?.inventory.map((file) => <tr key={`intake-${file.file}`}><td><code>{file.file}</code></td><td>Intake report</td><td>{file.technicalDetails}</td></tr>)}{project.delivery?.files.map((file) => <tr key={`delivery-${file.path}`}><td><code>{file.path}</code></td><td>Delivery manifest</td><td>{file.deliverableType.replace(/_/g, " ")} · {file.sizeBytes.toLocaleString()} bytes</td></tr>)}{!intake?.inventory.length && !project.delivery?.files.length && <tr><td colSpan={3}>No files are recorded by supported authoritative reports.</td></tr>}</tbody></table></div></section>}
    {active === "metadata" && <section className="panel"><dl className="metadata-list"><div><dt>Client ID</dt><dd><code>{client.clientId}</code></dd></div><div><dt>Project ID</dt><dd><code>{project.projectId}</code></dd></div><div><dt>Project</dt><dd>{project.projectName}</dd></div><div><dt>Artist</dt><dd>{project.artist}</dd></div><div><dt>Created</dt><dd>{project.createdAt}</dd></div><div><dt>Schema</dt><dd>{project.schemaVersion}</dd></div><div><dt>Audio</dt><dd>{project.sampleRate} Hz · {project.bitDepth}-bit {project.fileFormat}</dd></div><div><dt>Delivery method</dt><dd>{project.deliveryMethod}</dd></div><div><dt>Current / approved / delivered</dt><dd>{project.currentRevision} / {project.approvedRevision ?? "—"} / {project.deliveredRevision ?? "—"}</dd></div></dl></section>}
    <FolderControl location="project" clientId={client.clientId} projectId={project.projectId} />
  </>;
}

function ReportsRoute({ workspace, onOpenProject }: { workspace: ResourceState<WorkspaceSnapshot>; onOpenProject: (clientId: string, projectId: string) => void }) {
  if (workspace.status !== "ready") return <section className="empty-state"><h2>Loading reports</h2></section>;
  const deliveries = workspace.value.clients.flatMap((client) => client.projects.filter((project) => project.delivery).map((project) => ({ client, project })));
  return <section className="panel"><div className="panel-heading"><div><p className="kicker">Validated report index</p><h2>Reports</h2></div></div><p>Delivery manifests are indexed from validated workspace state. Intake reports remain available from each project's Reports tab.</p><div className="table-scroll"><table><thead><tr><th>Report</th><th>Project</th><th>Updated</th></tr></thead><tbody>{deliveries.map(({ client, project }) => <tr key={`${client.clientId}-${project.projectId}`}><td>Delivery manifest</td><td><button className="table-link" type="button" onClick={() => onOpenProject(client.clientId, project.projectId)}>{project.projectName}</button></td><td>{project.delivery!.createdAt}</td></tr>)}{deliveries.length === 0 && <tr><td colSpan={3}>No validated delivery reports are recorded.</td></tr>}</tbody></table></div></section>;
}

function DeliveryView({ clientId, project, loading, actionError, creationAvailable, creationHelp, onOverview, onCreate, onRefresh, onSelectView }: {
  clientId: string;
  project: ProjectSummary;
  loading: boolean;
  actionError: string | null;
  creationAvailable: boolean;
  creationHelp: string;
  onOverview: () => void;
  onCreate: () => void;
  onRefresh: () => void;
  onSelectView: (view: ProjectView) => void;
}) {
  const delivery = project.delivery;
  const totalBytes = delivery?.files.reduce((total, file) => total + file.sizeBytes, 0) ?? 0;
  const readiness = project.approvedRevision === null
    ? { title: "Approval required", detail: "Approve a revision before creating a delivery package." }
    : delivery === null
      ? { title: "Ready for first delivery", detail: `Approved Revision ${project.approvedRevision} can be packaged with the guided workflow.` }
      : project.approvedRevision === project.deliveredRevision
        ? { title: "Delivery is current", detail: `The recorded package represents approved Revision ${project.deliveredRevision}.` }
        : { title: "Replacement review required", detail: `The existing package represents Revision ${project.deliveredRevision}; approved Revision ${project.approvedRevision} requires an explicit replacement workflow.` };
  return <>
    <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Delivery</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
    <ProjectWorkflowTabs active="delivery" onSelect={onSelectView} />
    <section className="directory-toolbar" aria-labelledby="delivery-heading"><div><p className="kicker">Authoritative package state</p><h2 id="delivery-heading">Delivery</h2></div><button type="button" onClick={onCreate} disabled={!creationAvailable || loading}>{loading ? "Checking…" : "Create delivery"}</button></section>
    <p className="action-help">{creationHelp}</p>
    <FolderControl location="delivery" clientId={clientId} projectId={project.projectId} label="Open delivery folder" />
    {actionError && <div className="form-error" role="alert">{actionError}</div>}
    <section className="notice" role="status"><strong>{readiness.title}</strong><span>{readiness.detail}</span></section>
    {!delivery ? <section className="empty-state"><h2>No delivery package recorded</h2><p>Studio found no validated delivery manifest for this project.</p></section> : <>
      <section className="panel"><div className="panel-heading"><div><p className="kicker">Delivery manifest</p><h2>Revision {delivery.revision}</h2></div></div><dl className="metadata-list">
        <div><dt>Created</dt><dd><time dateTime={delivery.createdAt}>{formatRevisionTimestamp(delivery.createdAt)}</time></dd></div><div><dt>Method</dt><dd>{delivery.method}</dd></div><div><dt>Approved by</dt><dd>{delivery.approvedBy}</dd></div><div><dt>Files</dt><dd>{delivery.files.length}</dd></div><div><dt>Total bytes</dt><dd>{totalBytes.toLocaleString()}</dd></div><div><dt>Document ID</dt><dd><code>{delivery.documentId}</code></dd></div>
      </dl></section>
      <section className="panel"><div className="panel-heading"><div><p className="kicker">Recorded checksums</p><h2>{delivery.files.length} delivered {delivery.files.length === 1 ? "file" : "files"}</h2></div></div><div className="table-scroll"><table><thead><tr><th>Path</th><th>Type</th><th>Size</th><th>SHA-256</th></tr></thead><tbody>{delivery.files.map((file) => <tr key={file.path}><td><code>{file.path}</code></td><td>{file.deliverableType.replace(/_/g, " ")}</td><td>{file.sizeBytes.toLocaleString()}</td><td><code>{file.sha256}</code></td></tr>)}</tbody></table></div></section>
      <aside className="route-note"><strong>Manifest record</strong><span>Checksums are the values recorded and verified by JL Mixing Automation when this package was created. Studio did not re-hash delivery files.</span></aside>
    </>}
  </>;
}

function DeliveryDialog({
  state,
  onConfirm,
  onClose,
}: {
  state: Exclude<DeliveryWorkflowState, { status: "closed" } | { status: "preflighting" }>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const pending = state.status === "creating";
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.status === "confirming") confirmButton.current?.focus();
  }, [state.status]);
  return (
    <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}>
      <section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-dialog-title">
        <p className="kicker">Guided first delivery</p>
        <h2 id="delivery-dialog-title">{state.status === "uncertain" ? "Delivery needs verification" : "Confirm delivery package"}</h2>
        {state.status === "uncertain" ? <>
          <div className="form-error" role="alert">{state.message}</div>
          <p className="dialog-intro">Do not submit the request again automatically. Close this message and refresh the authoritative delivery state.</p>
          <div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div>
        </> : <>
          <p className="dialog-intro">Create the first final-delivery package for <strong>{state.preview.projectName}</strong>. Automation will verify every copied file with SHA-256 and update the delivered pointer transactionally.</p>
          <dl className="confirmation-list">
            <div><dt>Approved revision</dt><dd>Revision {state.preview.approvedRevision}</dd></div>
            <div><dt>Current revision</dt><dd>Revision {state.preview.currentRevision}</dd></div>
            <div><dt>Delivery method</dt><dd>{state.preview.deliveryMethod}</dd></div>
            <div><dt>Files</dt><dd>{state.preview.selected.length}</dd></div>
            <div><dt>Replacement mode</dt><dd>None — first package only</dd></div>
            <div><dt>ZIP</dt><dd>Not created</dd></div>
          </dl>
          <div className="table-scroll"><table><thead><tr><th>Source</th><th>Type</th><th>Destination</th></tr></thead><tbody>{state.preview.selected.map((file) => <tr key={`${file.sourceName}:${file.path}`}><td>{file.sourceName}</td><td>{file.deliverableType.replace(/_/g, " ")}</td><td><code>{file.path}</code></td></tr>)}</tbody></table></div>
          {state.preview.excluded.length > 0 && <section className="route-note"><strong>Excluded by Automation defaults</strong><span>{state.preview.excluded.map((file) => `${file.name} (${file.reason})`).join(", ")}</span></section>}
          <div className="notice warning" role="status"><strong>Workspace change</strong><span>This creates files in 05_Final_Delivery and changes state.delivered_revision from none to Revision {state.preview.approvedRevision}. Overwrite, clean replacement, filters, and ZIP are not enabled.</span></div>
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending}>{pending ? "Creating…" : "Create delivery"}</button></div>
        </>}
      </section>
    </div>
  );
}

function RevisionDialog({
  state,
  values,
  project,
  onChange,
  onPreflight,
  onConfirm,
  onBack,
  onClose,
}: {
  state: Exclude<RevisionWorkflowState, { status: "closed" }>;
  values: RevisionFormValues;
  project: ProjectSummary;
  onChange: (values: RevisionFormValues) => void;
  onPreflight: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const descriptionInput = useRef<HTMLInputElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const pending = state.status === "preflighting" || state.status === "creating";
  useEffect(() => {
    if (state.status === "editing") descriptionInput.current?.focus();
    if (state.status === "confirming") confirmButton.current?.focus();
  }, [state.status]);

  return (
    <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}>
      <section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="revision-dialog-title">
        <p className="kicker">Guided revision</p>
        <h2 id="revision-dialog-title">
          {state.status === "confirming" || state.status === "creating"
            ? "Confirm new revision"
            : state.status === "uncertain"
              ? "Creation needs verification"
              : "New revision"}
        </h2>
        {(state.status === "editing" || state.status === "preflighting") && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">Create the next revision for <strong>{project.projectName}</strong>. Automation will derive the number, ID, timestamp, folder, and notes template.</p>
            {state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}
            <label>
              Revision description <span>(optional)</span>
              <input ref={descriptionInput} name="revisionDescription" value={values.description} onChange={(event) => onChange({ description: event.target.value })} placeholder={`Revision ${project.currentRevision + 1}`} autoComplete="off" disabled={pending} />
              <small>Leave blank to use the Automation default. Source files are added manually in this milestone.</small>
            </label>
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="submit" disabled={pending}>{pending ? "Checking…" : "Review revision"}</button></div>
          </form>
        )}
        {(state.status === "confirming" || state.status === "creating") && (
          <div>
            <p className="dialog-intro">Preflight passed without changing the project. Confirm to create exactly one new revision. Existing approved and delivered pointers will be preserved.</p>
            <dl className="confirmation-list">
              <div><dt>Project</dt><dd>{project.projectName}</dd></div>
              <div><dt>Current revision</dt><dd>Revision {project.currentRevision}</dd></div>
              <div><dt>New revision</dt><dd>Revision {state.preview.number}</dd></div>
              <div><dt>Description</dt><dd>{state.preview.description}</dd></div>
            </dl>
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending}>{pending ? "Creating…" : "Create revision"}</button></div>
          </div>
        )}
        {state.status === "uncertain" && (
          <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">Do not submit the request again automatically. Close this message and refresh the authoritative revision history.</p><div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div></div>
        )}
      </section>
    </div>
  );
}

function ApprovalDialog({
  state,
  values,
  project,
  onChange,
  onPreflight,
  onConfirm,
  onBack,
  onClose,
}: {
  state: Exclude<ApprovalWorkflowState, { status: "closed" }>;
  values: ApprovalFormValues;
  project: ProjectSummary;
  onChange: (values: ApprovalFormValues) => void;
  onPreflight: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const approverInput = useRef<HTMLInputElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const pending = state.status === "preflighting" || state.status === "approving";
  const replacingHistoricalApproval = state.revision.approvedAt !== null;
  const olderThanCurrent = state.revision.number !== project.currentRevision;
  const deliveryWillDiffer = project.deliveredRevision !== null && project.deliveredRevision !== state.revision.number;
  useEffect(() => {
    if (state.status === "editing") approverInput.current?.focus();
    if (state.status === "confirming") confirmButton.current?.focus();
  }, [state.status]);

  return (
    <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}>
      <section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-dialog-title">
        <p className="kicker">Guided approval</p>
        <h2 id="approval-dialog-title">
          {state.status === "confirming" || state.status === "approving"
            ? "Confirm revision approval"
            : state.status === "uncertain"
              ? "Approval needs verification"
              : `Approve Revision ${state.revision.number}`}
        </h2>
        {(state.status === "editing" || state.status === "preflighting") && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">Record approval for <strong>Revision {state.revision.number}</strong> of <strong>{project.projectName}</strong>. Automation will use the current time when approval is confirmed.</p>
            {state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}
            <label>
              Approved by
              <input ref={approverInput} name="approvedBy" value={values.approvedBy} onChange={(event) => onChange({ approvedBy: event.target.value })} autoComplete="name" disabled={pending} />
              <small>This identity is written to the authoritative project manifest.</small>
            </label>
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="submit" disabled={pending}>{pending ? "Checking…" : "Review approval"}</button></div>
          </form>
        )}
        {(state.status === "confirming" || state.status === "approving") && (
          <div>
            <p className="dialog-intro">Preflight passed without changing the project. Confirm to move the approved pointer and record new approval metadata for the selected revision.</p>
            <dl className="confirmation-list">
              <div><dt>Project</dt><dd>{project.projectName}</dd></div>
              <div><dt>Selected revision</dt><dd>Revision {state.preview.revision}</dd></div>
              <div><dt>Current approved revision</dt><dd>{project.approvedRevision === null ? "None" : `Revision ${project.approvedRevision}`}</dd></div>
              <div><dt>Approved by</dt><dd>{state.preview.approvedBy}</dd></div>
              <div><dt>Approval time</dt><dd>Current time at execution</dd></div>
            </dl>
            {(replacingHistoricalApproval || olderThanCurrent || deliveryWillDiffer) && <div className="notice warning" role="status"><strong>Review lifecycle impact</strong><span>{[
              replacingHistoricalApproval ? `Revision ${state.revision.number} has historical approval metadata that will be replaced.` : null,
              olderThanCurrent ? `Revision ${state.revision.number} is older than current Revision ${project.currentRevision}.` : null,
              deliveryWillDiffer ? `The existing delivery remains on Revision ${project.deliveredRevision}.` : null,
            ].filter(Boolean).join(" ")}</span></div>}
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending}>{pending ? "Approving…" : "Approve revision"}</button></div>
          </div>
        )}
        {state.status === "uncertain" && (
          <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">Do not submit the approval again automatically. Close this message and refresh the authoritative revision history.</p><div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div></div>
        )}
      </section>
    </div>
  );
}

function IntakeDialog({
  state,
  onConfirm,
  onClose,
}: {
  state: Exclude<IntakeWorkflowState, { status: "closed" } | { status: "preflighting" }>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const pending = state.status === "running";
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.status === "confirming") confirmButton.current?.focus();
  }, [state.status]);
  return (
    <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}>
      <section className="client-dialog intake-dialog" role="dialog" aria-modal="true" aria-labelledby="intake-dialog-title">
        <p className="kicker">Guided validation</p>
        <h2 id="intake-dialog-title">{state.status === "uncertain" ? "Validation needs verification" : "Confirm intake report update"}</h2>
        {state.status === "uncertain" ? <><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">Do not run validation again automatically. Close this message and refresh the authoritative report.</p><div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div></> : <>
          <p className="dialog-intro">The dry-run preview below did not change the project. Confirm to replace only the Automation-managed section of <code>00_Admin/Intake_Report.md</code>. Intake source files will not be modified.</p>
          <IntakeReportContent report={state.preview} compact />
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending}>{pending ? "Updating report…" : "Update intake report"}</button></div>
        </>}
      </section>
    </div>
  );
}

function StudioRoute({ workspace, version, loading, setupAvailable, setupHelp, onSetup, onRefresh }: {
  workspace: ResourceState<WorkspaceSnapshot>;
  version: ResourceState<VersionCheck>;
  loading: boolean;
  setupAvailable: boolean;
  setupHelp: string;
  onSetup: () => void;
  onRefresh: () => void;
}) {
  if (workspace.status === "loading") return <section className="state-panel"><h2>Reading studio workspace…</h2></section>;
  if (workspace.status === "error") return <section className="state-panel error"><h2>Studio workspace unavailable</h2><p>{workspace.message}</p><button type="button" onClick={onRefresh}>Try again</button></section>;
  const snapshot = workspace.value;
  if (!snapshot.studio) {
    const unavailable = snapshot.status === "unavailable";
    return <section className="planned-route" aria-labelledby="studio-state-heading">
      <div className="planned-banner"><div><span className="status-pill warning">{unavailable ? "Not configured" : "Recovery required"}</span><h2 id="studio-state-heading">{unavailable ? "Create the default studio workspace" : "Studio configuration is not readable"}</h2><p>{unavailable ? "Use the guided JL Mixing Automation v1.2.0 workflow to create ~/Music/Mixes." : "Review the validated discovery issues below before changing the workspace."}</p></div><button type="button" onClick={onSetup} disabled={!setupAvailable || loading} aria-describedby="studio-setup-help">New studio</button></div>
      <p id="studio-setup-help" className="action-help">{setupHelp}</p>
      {snapshot.issues.length > 0 && <RouteIssues snapshot={snapshot} />}
    </section>;
  }
  const studio = snapshot.studio;
  return <section className="planned-route" aria-labelledby="studio-details-heading">
    <div className="panel-heading"><div><p className="kicker">Validated studio</p><h2 id="studio-details-heading">{studio.studioName}</h2></div><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>Refresh</button></div>
    <div className="planned-section-grid">
      <article className="planned-section"><h3>Identity</h3><dl className="confirmation-list"><div><dt>Studio ID</dt><dd><code>{studio.studioId}</code></dd></div><div><dt>Mix engineer</dt><dd>{studio.mixEngineer || "Not set"}</dd></div><div><dt>Created</dt><dd>{studio.createdAt}</dd></div></dl></article>
      <article className="planned-section"><h3>Audio defaults</h3><dl className="confirmation-list"><div><dt>Sample rate</dt><dd>{studio.sampleRate.toLocaleString()} Hz</dd></div><div><dt>Bit depth</dt><dd>{studio.bitDepth}-bit</dd></div><div><dt>Format</dt><dd>{studio.fileFormat}</dd></div></dl></article>
      <article className="planned-section"><h3>Delivery defaults</h3><dl className="confirmation-list"><div><dt>Method</dt><dd>{studio.deliveryMethod}</dd></div><div><dt>Deliverables</dt><dd>{studio.requestedDeliverables.join(", ") || "None"}</dd></div></dl></article>
      <article className="planned-section"><h3>Workspace & tools</h3><dl className="confirmation-list"><div><dt>Workspace</dt><dd><code>{snapshot.workspacePath}</code></dd></div><div><dt>Configured root</dt><dd><code>{studio.rootPath}</code></dd></div><div><dt>Schema</dt><dd>{studio.schemaVersion}</dd></div><div><dt>Created with</dt><dd>{studio.createdWith}</dd></div><div><dt>Automation</dt><dd>{version.status === "ready" ? version.value.message : "Check unavailable"}</dd></div></dl></article>
    </div>
    <FolderControl location="workspace" label="Open workspace" />
    {snapshot.issues.length > 0 && <RouteIssues snapshot={snapshot} />}
  </section>;
}

function StudioDialog({ state, values, onChange, onPreflight, onConfirm, onBack, onClose }: {
  state: Exclude<StudioWorkflowState, { status: "closed" }>;
  values: StudioFormValues;
  onChange: (values: StudioFormValues) => void;
  onPreflight: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const pending = state.status === "preflighting" || state.status === "creating";
  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}><section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-dialog-title"><p className="kicker">Guided setup</p><h2 id="studio-dialog-title">{state.status === "confirming" || state.status === "creating" ? "Confirm new studio" : state.status === "uncertain" ? "Creation needs verification" : "New studio"}</h2>
    {(state.status === "editing" || state.status === "preflighting") && <form onSubmit={onPreflight} noValidate><p className="dialog-intro">Creates the default workspace at <code>~/Music/Mixes</code>. No custom path or command options are accepted.</p>{state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}<label>Studio name<input aria-label="Studio name" value={values.studioName} onChange={(e) => onChange({...values, studioName:e.target.value})} required disabled={pending}/></label><label>Mix engineer <span>(optional)</span><input aria-label="Mix engineer" value={values.mixEngineer} onChange={(e) => onChange({...values, mixEngineer:e.target.value})} disabled={pending}/></label><label>Sample rate<select aria-label="Sample rate" value={values.sampleRate} onChange={(e) => onChange({...values, sampleRate:e.target.value})} disabled={pending}>{[44100,48000,88200,96000,176400,192000].map(v=><option key={v} value={v}>{v.toLocaleString()} Hz</option>)}</select></label><label>Bit depth<select aria-label="Bit depth" value={values.bitDepth} onChange={(e) => onChange({...values, bitDepth:e.target.value})} disabled={pending}>{[16,24,32].map(v=><option key={v} value={v}>{v}-bit</option>)}</select></label><label>File format<select aria-label="File format" value={values.fileFormat} onChange={(e) => onChange({...values, fileFormat:e.target.value})} disabled={pending}><option>WAV</option><option>AIFF</option></select></label><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="submit" disabled={pending}>{pending ? "Checking…" : "Review studio"}</button></div></form>}
    {(state.status === "confirming" || state.status === "creating") && <div><p className="dialog-intro">Preflight passed without changing the filesystem. Confirm to create the default workspace.</p><dl className="confirmation-list"><div><dt>Studio</dt><dd>{state.preview.studioName}</dd></div><div><dt>Engineer</dt><dd>{state.preview.mixEngineer ?? "Not set"}</dd></div><div><dt>Audio</dt><dd>{state.preview.sampleRate.toLocaleString()} Hz · {state.preview.bitDepth}-bit {state.preview.fileFormat}</dd></div><div><dt>Location</dt><dd><code>~/Music/Mixes</code></dd></div></dl><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button><button type="button" onClick={onConfirm} disabled={pending}>{pending ? "Creating…" : "Create studio"}</button></div></div>}
    {state.status === "uncertain" && <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">Do not submit again automatically. Close and refresh the authoritative workspace.</p><div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div></div>}
  </section></div>;
}

function SettingsRoute({ preferences, onChange, workspace, version }: { preferences: AppPreferences; onChange: (value: AppPreferences) => void; workspace: ResourceState<WorkspaceSnapshot>; version: ResourceState<VersionCheck> }) {
  const update = (value: AppPreferences) => {
    localStorage.setItem("jl-mixing-studio.preferences", JSON.stringify(value));
    onChange(value);
  };
  return <section className="planned-route" aria-labelledby="settings-heading"><div className="panel-heading"><div><p className="kicker">Studio-owned preferences</p><h2 id="settings-heading">Settings</h2></div></div>
    <div className="project-detail-grid"><section className="panel"><h3>Appearance</h3><label className="setting-row"><span><strong>Compact layout</strong><small>Reduce spacing in the application shell and data panels.</small></span><input type="checkbox" checked={preferences.compactLayout} onChange={(event) => update({...preferences, compactLayout:event.target.checked})} /></label><label className="setting-row"><span><strong>Reduce motion</strong><small>Disable interface scrolling and transition animation.</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => update({...preferences, reduceMotion:event.target.checked})} /></label></section>
      <section className="panel"><h3>Read-only diagnostics</h3><dl className="metadata-list"><div><dt>Workspace</dt><dd>{workspace.status === "ready" ? <code>{workspace.value.workspacePath}</code> : workspace.status}</dd></div><div><dt>Workspace status</dt><dd>{workspace.status === "ready" ? workspace.value.status : "Unavailable"}</dd></div><div><dt>Automation</dt><dd>{version.status === "ready" ? version.value.message : "Check unavailable"}</dd></div><div><dt>Supported contract</dt><dd>JL Mixing Automation 1.2.0</dd></div></dl></section></div>
    <aside className="route-note"><strong>Settings boundary</strong><span>These preferences are local to JL Mixing Studio. They do not edit <code>studio.json</code>, client or project metadata, delivery defaults, or JL Mixing Automation.</span></aside>
  </section>;
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
  const [preferences, setPreferences] = useState<AppPreferences>(loadPreferences);
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
  const [studioWorkflow, setStudioWorkflow] = useState<StudioWorkflowState>({ status: "closed" });
  const [studioForm, setStudioForm] = useState<StudioFormValues>(emptyStudioForm);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const [clientWorkflow, setClientWorkflow] = useState<ClientWorkflowState>({ status: "closed" });
  const [clientForm, setClientForm] = useState<ClientFormValues>(emptyClientForm);
  const [projectWorkflow, setProjectWorkflow] = useState<ProjectWorkflowState>({ status: "closed" });
  const [projectForm, setProjectForm] = useState<ProjectFormValues>(emptyProjectForm);
  const [projectView, setProjectView] = useState<ProjectView>("overview");
  const [intakeReport, setIntakeReport] = useState<IntakeReportState>({ status: "idle" });
  const [intakeWorkflow, setIntakeWorkflow] = useState<IntakeWorkflowState>({ status: "closed" });
  const [intakeActionError, setIntakeActionError] = useState<string | null>(null);
  const [revisionWorkflow, setRevisionWorkflow] = useState<RevisionWorkflowState>({ status: "closed" });
  const [revisionForm, setRevisionForm] = useState<RevisionFormValues>(emptyRevisionForm);
  const [revisionActionError, setRevisionActionError] = useState<string | null>(null);
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalWorkflowState>({ status: "closed" });
  const [approvalForm, setApprovalForm] = useState<ApprovalFormValues>(emptyApprovalForm);
  const [approvalActionError, setApprovalActionError] = useState<string | null>(null);
  const [deliveryWorkflow, setDeliveryWorkflow] = useState<DeliveryWorkflowState>({ status: "closed" });
  const [deliveryActionError, setDeliveryActionError] = useState<string | null>(null);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
  const [projectCreationNotice, setProjectCreationNotice] = useState<string | null>(null);
  const [intakeNotice, setIntakeNotice] = useState<string | null>(null);
  const [revisionNotice, setRevisionNotice] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
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
        setProjectView("overview");
        setIntakeReport({ status: "idle" });
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
  const intakeValidationAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.intakeValidationSupported;
  const revisionCreationAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.revisionCreationSupported;
  const revisionApprovalAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.revisionApprovalSupported;
  const deliveryCreationSupported =
    workspace.status === "ready" &&
    workspace.value.status === "healthy" &&
    version.status === "ready" &&
    version.value.deliveryCreationSupported;
  const studioCreationAvailable =
    workspace.status === "ready" &&
    workspace.value.status === "unavailable" &&
    version.status === "ready" &&
    version.value.studioCreationSupported;
  const studioCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") return "Workspace and automation checks must finish first.";
    if (workspace.value.status !== "unavailable") return workspace.value.studio ? "The validated studio workspace already exists." : "Resolve the existing workspace issue before setup.";
    if (!version.value.studioCreationSupported) return version.value.message;
    return "Preview and confirm creation of the default ~/Music/Mixes workspace.";
  })();

  const openStudioWorkflow = () => {
    if (!studioCreationAvailable) return;
    setStudioNotice(null);
    setStudioForm(emptyStudioForm);
    setStudioWorkflow({ status: "editing" });
  };
  const closeStudioWorkflow = () => {
    if (studioWorkflow.status === "preflighting" || studioWorkflow.status === "creating") return;
    setStudioWorkflow({ status: "closed" });
  };
  const preflightStudio = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (studioWorkflow.status !== "editing") return;
    const request: StudioCreationRequest = { studioName: studioForm.studioName.trim(), mixEngineer: studioForm.mixEngineer.trim() || null, sampleRate: Number(studioForm.sampleRate), bitDepth: Number(studioForm.bitDepth), fileFormat: studioForm.fileFormat };
    if (!request.studioName) { setStudioWorkflow({ status: "editing", error: "Studio name is required." }); return; }
    setStudioWorkflow({ status: "preflighting" });
    invoke<StudioOperationResult>("preflight_studio_creation", { request }).then((result) => {
      if (result.ok && result.code === "ready" && result.studio) setStudioWorkflow({ status: "confirming", request, preview: result.studio });
      else setStudioWorkflow({ status: "editing", error: result.message });
    }).catch((error: unknown) => setStudioWorkflow({ status: "editing", error: safeError(error, "Studio preflight could not be completed.") }));
  };
  const confirmStudioCreation = () => {
    if (studioWorkflow.status !== "confirming") return;
    const { request, preview } = studioWorkflow;
    setStudioWorkflow({ status: "creating", request, preview });
    invoke<StudioOperationResult>("create_studio", { request }).then(async (result) => {
      if (!result.ok || result.code !== "created") {
        if (result.code === "uncertain") setStudioWorkflow({ status: "uncertain", message: result.message });
        else setStudioWorkflow({ status: "editing", error: result.message });
        return;
      }
      try {
        const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
        setWorkspace({ status: "ready", value: refreshed });
        if (!refreshed.studio || refreshed.studio.studioName !== preview.studioName) { setStudioWorkflow({ status: "uncertain", message: "Creation succeeded, but the refreshed studio did not match the confirmed preview. Do not retry automatically." }); return; }
        setStudioNotice(`${refreshed.studio.studioName} was created and verified.`);
        setStudioWorkflow({ status: "closed" });
      } catch (error: unknown) { setStudioWorkflow({ status: "uncertain", message: safeError(error, "Creation succeeded, but the workspace could not be refreshed. Do not retry automatically.") }); }
    }).catch((error: unknown) => setStudioWorkflow({ status: "uncertain", message: safeError(error, "The studio-creation result could not be confirmed. Do not retry automatically.") }));
  };

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

  const intakeValidationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (workspace.value.status !== "healthy") {
      return "The existing report remains readable, but workspace issues must be resolved before validation can run.";
    }
    if (!version.value.intakeValidationSupported) return version.value.message;
    return "Preview the Automation v1.2.0 defaults, then confirm the managed report update.";
  })();

  const revisionCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (workspace.value.status !== "healthy") {
      return "Revision history remains readable, but workspace issues must be resolved before creating a revision.";
    }
    if (!version.value.revisionCreationSupported) return version.value.message;
    return "Preview and confirm the next revision using JL Mixing Automation v1.2.0.";
  })();

  const revisionApprovalHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (workspace.value.status !== "healthy") {
      return "Revision history remains readable, but workspace issues must be resolved before recording approval.";
    }
    if (!version.value.revisionApprovalSupported) return version.value.message;
    return "Select a revision, review the lifecycle impact, and confirm its approval through JL Mixing Automation v1.2.0.";
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

  const loadIntakeReport = (request: IntakeRequest) => {
    setIntakeReport({ status: "loading" });
    invoke<IntakeOperationResult>("get_intake_report", { request })
      .then((result) => setIntakeReport({ status: "ready", value: result }))
      .catch((error: unknown) => {
        setIntakeReport({ status: "error", message: safeError(error, "The intake report could not be read.") });
      });
  };

  const openIntake = () => {
    if (!resolvedProjectClient || !resolvedProject) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    setProjectView("intake");
    setIntakeWorkflow({ status: "closed" });
    setIntakeActionError(null);
    setIntakeNotice(null);
    setRevisionWorkflow({ status: "closed" });
    setApprovalWorkflow({ status: "closed" });
    loadIntakeReport(request);
  };

  const openRevisions = () => {
    if (!resolvedProjectClient || !resolvedProject) return;
    setProjectView("revisions");
    setIntakeWorkflow({ status: "closed" });
    setIntakeActionError(null);
  };

  const selectProjectView = (view: ProjectView) => {
    if (view === "intake") { openIntake(); return; }
    if (view === "revisions") { openRevisions(); return; }
    setProjectView(view);
    setIntakeWorkflow({ status: "closed" });
    setRevisionWorkflow({ status: "closed" });
    setApprovalWorkflow({ status: "closed" });
  };

  const openDeliveryWorkflow = () => {
    if (!resolvedProjectClient || !resolvedProject || !deliveryCreationAvailable) return;
    const request: DeliveryCreationRequest = {
      clientId: resolvedProjectClient.clientId,
      projectId: resolvedProject.projectId,
    };
    setDeliveryNotice(null);
    setDeliveryActionError(null);
    setDeliveryWorkflow({ status: "preflighting" });
    invoke<DeliveryOperationResult>("preflight_delivery_creation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.delivery &&
          result.delivery.clientId === request.clientId &&
          result.delivery.projectId === request.projectId &&
          result.delivery.projectName === resolvedProject.projectName &&
          result.delivery.currentRevision === resolvedProject.currentRevision &&
          result.delivery.approvedRevision === resolvedProject.approvedRevision &&
          result.delivery.deliveredRevision === null &&
          result.delivery.deliveryMethod === resolvedProject.deliveryMethod &&
          result.delivery.selected.length > 0
        ) {
          setDeliveryWorkflow({ status: "confirming", request, preview: result.delivery });
        } else {
          setDeliveryWorkflow({ status: "closed" });
          setDeliveryActionError(result.ok ? "The delivery preview did not match the authoritative project state." : result.message);
        }
      })
      .catch((error: unknown) => {
        setDeliveryWorkflow({ status: "closed" });
        setDeliveryActionError(safeError(error, "The delivery preview could not be completed."));
      });
  };

  const closeDeliveryWorkflow = () => {
    if (deliveryWorkflow.status === "creating") return;
    setDeliveryWorkflow({ status: "closed" });
  };

  const confirmDelivery = () => {
    if (deliveryWorkflow.status !== "confirming") return;
    const { request, preview } = deliveryWorkflow;
    setDeliveryWorkflow({ status: "creating", request, preview });
    invoke<DeliveryOperationResult>("create_delivery", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.delivery) {
          if (result.code === "uncertain") setDeliveryWorkflow({ status: "uncertain", message: result.message });
          else {
            setDeliveryWorkflow({ status: "closed" });
            setDeliveryActionError(result.message);
          }
          return;
        }
        if (!sameDeliveryPlan(preview, result.delivery) || result.delivery.deliveredRevision !== preview.approvedRevision) {
          setDeliveryWorkflow({ status: "uncertain", message: "JL Mixing Automation reported success, but the created delivery did not match the confirmed preview. The operation may have completed; do not retry automatically." });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const project = client?.projects.find((item) => item.projectId === request.projectId);
          if (!project?.delivery || project.deliveredRevision !== preview.approvedRevision) {
            setDeliveryWorkflow({ status: "uncertain", message: "The delivery command succeeded, but the refreshed authoritative package did not match the preview. The operation may have completed; do not retry automatically." });
            return;
          }
          setDeliveryNotice(`Revision ${project.deliveredRevision} was packaged and verified with ${project.delivery.files.length} delivered ${project.delivery.files.length === 1 ? "file" : "files"}.`);
          setDeliveryWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setDeliveryWorkflow({ status: "uncertain", message: safeError(error, "The delivery command succeeded, but the workspace could not be refreshed. The operation may have completed; do not retry automatically.") });
        }
      })
      .catch((error: unknown) => {
        setDeliveryWorkflow({ status: "uncertain", message: safeError(error, "The delivery-creation result could not be confirmed. The operation may have completed; do not retry automatically.") });
      });
  };

  const openRevisionWorkflow = () => {
    if (!resolvedProjectClient || !resolvedProject || !revisionCreationAvailable) return;
    setRevisionNotice(null);
    setRevisionActionError(null);
    setIntakeWorkflow({ status: "closed" });
    setRevisionForm(emptyRevisionForm);
    setRevisionWorkflow({ status: "editing" });
    setApprovalWorkflow({ status: "closed" });
  };

  const closeRevisionWorkflow = () => {
    if (revisionWorkflow.status === "preflighting" || revisionWorkflow.status === "creating") return;
    setRevisionWorkflow({ status: "closed" });
  };

  const preflightRevision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (revisionWorkflow.status !== "editing" || !resolvedProjectClient || !resolvedProject) return;
    const request: RevisionCreationRequest = {
      clientId: resolvedProjectClient.clientId,
      projectId: resolvedProject.projectId,
      description: revisionForm.description.trim() || null,
    };
    setRevisionWorkflow({ status: "preflighting" });
    invoke<RevisionOperationResult>("preflight_revision_creation", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.revision &&
          result.revision.clientId === request.clientId &&
          result.revision.projectId === request.projectId &&
          result.revision.number === resolvedProject.currentRevision + 1
        ) {
          setRevisionWorkflow({ status: "confirming", request, preview: result.revision });
        } else {
          setRevisionWorkflow({ status: "editing", error: result.ok ? "The revision preview did not match the authoritative project state." : result.message });
        }
      })
      .catch((error: unknown) => {
        setRevisionWorkflow({ status: "editing", error: safeError(error, "The revision preview could not be completed.") });
      });
  };

  const confirmRevision = () => {
    if (revisionWorkflow.status !== "confirming") return;
    const { request, preview } = revisionWorkflow;
    setRevisionWorkflow({ status: "creating", request, preview });
    invoke<RevisionOperationResult>("create_revision", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "created" || !result.revision) {
          if (result.code === "uncertain") setRevisionWorkflow({ status: "uncertain", message: result.message });
          else setRevisionWorkflow({ status: "editing", error: result.message });
          return;
        }
        if (
          result.revision.clientId !== preview.clientId ||
          result.revision.projectId !== preview.projectId ||
          result.revision.number !== preview.number ||
          result.revision.description !== preview.description
        ) {
          setRevisionWorkflow({ status: "uncertain", message: "JL Mixing Automation reported success, but the created revision did not match the preview. The operation may have completed; do not retry automatically." });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const project = client?.projects.find((item) => item.projectId === request.projectId);
          const revision = project?.revisions.find((item) => item.number === preview.number);
          if (!project || project.currentRevision !== preview.number || !revision || revision.description !== preview.description) {
            setRevisionWorkflow({ status: "uncertain", message: "The revision command succeeded, but the refreshed authoritative history did not match the preview. The operation may have completed; do not retry automatically." });
            return;
          }
          setProjectView("revisions");
          setRevisionNotice(`Revision ${revision.number} was created and verified.`);
          setRevisionWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setRevisionWorkflow({ status: "uncertain", message: safeError(error, "The revision command succeeded, but the workspace could not be refreshed. The operation may have completed; do not retry automatically.") });
        }
      })
      .catch((error: unknown) => {
        setRevisionWorkflow({ status: "uncertain", message: safeError(error, "The revision-creation result could not be confirmed. The operation may have completed; do not retry automatically.") });
      });
  };

  const openApprovalWorkflow = (revision: RevisionSummary) => {
    if (!resolvedProject || !revisionApprovalAvailable || revision.number === resolvedProject.approvedRevision) return;
    setApprovalNotice(null);
    setApprovalActionError(null);
    setRevisionWorkflow({ status: "closed" });
    setApprovalForm(emptyApprovalForm);
    setApprovalWorkflow({ status: "editing", revision });
  };

  const closeApprovalWorkflow = () => {
    if (approvalWorkflow.status === "preflighting" || approvalWorkflow.status === "approving") return;
    setApprovalWorkflow({ status: "closed" });
  };

  const preflightApproval = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (approvalWorkflow.status !== "editing" || !resolvedProjectClient || !resolvedProject) return;
    const revision = approvalWorkflow.revision;
    const request: RevisionApprovalRequest = {
      clientId: resolvedProjectClient.clientId,
      projectId: resolvedProject.projectId,
      revision: revision.number,
      approvedBy: approvalForm.approvedBy.trim(),
    };
    if (!request.approvedBy) {
      setApprovalWorkflow({ status: "editing", revision, error: "Enter the approver identity." });
      return;
    }
    setApprovalWorkflow({ status: "preflighting", revision });
    invoke<ApprovalOperationResult>("preflight_revision_approval", { request })
      .then((result) => {
        if (
          result.ok &&
          result.code === "ready" &&
          result.approval &&
          result.approval.clientId === request.clientId &&
          result.approval.projectId === request.projectId &&
          result.approval.revision === request.revision &&
          result.approval.approvedBy === request.approvedBy &&
          result.approval.approvedAt === null
        ) {
          setApprovalWorkflow({ status: "confirming", revision, request, preview: result.approval });
        } else {
          setApprovalWorkflow({ status: "editing", revision, error: result.ok ? "The approval preview did not match the authoritative revision state." : result.message });
        }
      })
      .catch((error: unknown) => {
        setApprovalWorkflow({ status: "editing", revision, error: safeError(error, "The approval preview could not be completed.") });
      });
  };

  const confirmApproval = () => {
    if (approvalWorkflow.status !== "confirming") return;
    const { revision, request, preview } = approvalWorkflow;
    setApprovalWorkflow({ status: "approving", revision, request, preview });
    invoke<ApprovalOperationResult>("approve_revision", { request })
      .then(async (result) => {
        if (!result.ok || result.code !== "approved" || !result.approval) {
          if (result.code === "uncertain") setApprovalWorkflow({ status: "uncertain", revision, message: result.message });
          else setApprovalWorkflow({ status: "editing", revision, error: result.message });
          return;
        }
        if (
          result.approval.clientId !== preview.clientId ||
          result.approval.projectId !== preview.projectId ||
          result.approval.revision !== preview.revision ||
          result.approval.approvedBy !== preview.approvedBy ||
          !result.approval.approvedAt
        ) {
          setApprovalWorkflow({ status: "uncertain", revision, message: "JL Mixing Automation reported success, but the approval did not match the preview. The operation may have completed; do not retry automatically." });
          return;
        }
        try {
          const refreshed = await invoke<WorkspaceSnapshot>("discover_default_workspace");
          setWorkspace({ status: "ready", value: refreshed });
          const client = refreshed.clients.find((item) => item.clientId === request.clientId);
          const project = client?.projects.find((item) => item.projectId === request.projectId);
          const approved = project?.revisions.find((item) => item.number === request.revision);
          if (
            !project ||
            project.approvedRevision !== request.revision ||
            !approved ||
            approved.approvedBy !== result.approval.approvedBy ||
            approved.approvedAt !== result.approval.approvedAt
          ) {
            setApprovalWorkflow({ status: "uncertain", revision, message: "The approval command succeeded, but the refreshed authoritative state did not match its result. The operation may have completed; do not retry automatically." });
            return;
          }
          setApprovalNotice(`Revision ${approved.number} was approved by ${approved.approvedBy} and verified.`);
          setApprovalWorkflow({ status: "closed" });
        } catch (error: unknown) {
          setApprovalWorkflow({ status: "uncertain", revision, message: safeError(error, "The approval command succeeded, but the workspace could not be refreshed. The operation may have completed; do not retry automatically.") });
        }
      })
      .catch((error: unknown) => {
        setApprovalWorkflow({ status: "uncertain", revision, message: safeError(error, "The revision-approval result could not be confirmed. The operation may have completed; do not retry automatically.") });
      });
  };

  const preflightIntake = () => {
    if (!resolvedProjectClient || !resolvedProject || !intakeValidationAvailable) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    setIntakeActionError(null);
    setIntakeNotice(null);
    setIntakeWorkflow({ status: "preflighting" });
    invoke<IntakeOperationResult>("preflight_intake_validation", { request })
      .then((result) => {
        if (result.ok && result.report && (result.code === "ready" || result.code === "blockingFindings")) {
          setIntakeWorkflow({ status: "confirming", preview: result.report });
        } else {
          setIntakeWorkflow({ status: "closed" });
          setIntakeActionError(result.message);
        }
      })
      .catch((error: unknown) => {
        setIntakeWorkflow({ status: "closed" });
        setIntakeActionError(safeError(error, "The intake preview could not be completed."));
      });
  };

  const confirmIntake = () => {
    if (intakeWorkflow.status !== "confirming" || !resolvedProjectClient || !resolvedProject) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    const preview = intakeWorkflow.preview;
    setIntakeWorkflow({ status: "running", preview });
    invoke<IntakeOperationResult>("run_intake_validation", { request })
      .then((result) => {
        if (result.code === "uncertain") {
          setIntakeWorkflow({ status: "uncertain", message: result.message });
          return;
        }
        if (!result.ok || !result.report || (result.code !== "validated" && result.code !== "blockingFindings")) {
          setIntakeWorkflow({ status: "closed" });
          setIntakeActionError(result.message);
          return;
        }
        if (result.report.clientId !== request.clientId || result.report.projectId !== request.projectId) {
          setIntakeWorkflow({ status: "uncertain", message: "The intake report was updated, but its project identity could not be verified. Do not retry automatically." });
          return;
        }
        setIntakeReport({ status: "ready", value: result });
        setIntakeWorkflow({ status: "closed" });
        setIntakeNotice(result.report.blockingErrors > 0 ? "The intake report was updated with blocking findings." : "The intake report was updated and verified.");
      })
      .catch((error: unknown) => {
        setIntakeWorkflow({ status: "uncertain", message: safeError(error, "The intake-validation result could not be confirmed. The report may have been updated; do not retry automatically.") });
      });
  };

  const navigate = (route: PrimaryRoute) => {
    setActiveRoute(route);
    setSelectedClientId(null);
    setSelectedProject(null);
    setProjectView("overview");
    setIntakeReport({ status: "idle" });
    setRevisionWorkflow({ status: "closed" });
    setRevisionActionError(null);
    setApprovalWorkflow({ status: "closed" });
    setApprovalActionError(null);
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
  const openDerivedProject = (clientId: string, projectId: string) => {
    setSelectedClientId(null); setSelectedProject({ clientId, projectId, fromClient: false });
    setProjectView("overview"); setActiveRoute("projects"); setRouteNotice(null);
  };
  const deliveryCreationAvailable =
    deliveryCreationSupported &&
    resolvedProject !== null &&
    resolvedProject.approvedRevision !== null &&
    resolvedProject.deliveredRevision === null &&
    resolvedProject.delivery === null;
  const deliveryCreationHelp = (() => {
    if (!resolvedProject) return "Select a project before creating a delivery.";
    if (workspace.status !== "ready" || version.status !== "ready") return "Workspace and automation checks must finish first.";
    if (workspace.value.status !== "healthy") return "Delivery history remains readable, but workspace issues must be resolved before creating a package.";
    if (!version.value.deliveryCreationSupported) return version.value.message;
    if (resolvedProject.approvedRevision === null) return "Approve a revision before creating the first delivery package.";
    if (resolvedProject.deliveredRevision !== null || resolvedProject.delivery !== null) return "The existing package remains read-only; replacement requires a separate reviewed workflow.";
    return "Preview and confirm the first package using Automation defaults with mandatory SHA-256 verification.";
  })();
  const baseRouteDefinition = routes.find((route) => route.id === activeRoute) ?? routes[0];
  const activeRouteDefinition: RouteDefinition = resolvedProject
    ? {
        id: "projects",
        label: "Projects",
        eyebrow: projectView === "intake" ? "Project intake" : projectView === "revisions" ? "Project revisions" : projectView === "delivery" ? "Project delivery" : "Project overview",
        title: resolvedProject.projectName,
        description: projectView === "intake" ? `${resolvedProject.artist} · Automation-managed intake validation.` : projectView === "revisions" ? `${resolvedProject.artist} · Authoritative revision history.` : projectView === "delivery" ? `${resolvedProject.artist} · Authoritative delivery state.` : `${resolvedProject.artist} · Authoritative project state.`,
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
    <div className={`app-shell${preferences.compactLayout ? " compact-layout" : ""}${preferences.reduceMotion ? " reduce-motion" : ""}`}>
      <Sidebar activeRoute={activeRoute} onNavigate={navigate} workspace={workspace} />
      <main className="main-content" id="main-content">
        <RouteHeader route={activeRouteDefinition} />
        {routeNotice && <section className="notice warning" role="status"><strong>Selection changed</strong><span>{routeNotice}</span></section>}
        {studioNotice && <section className="notice success" role="status"><strong>Studio created</strong><span>{studioNotice}</span></section>}
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
        {intakeNotice && (
          <section className="notice success" role="status"><strong>Intake report updated</strong><span>{intakeNotice}</span></section>
        )}
        {revisionNotice && (
          <section className="notice success" role="status"><strong>Revision created</strong><span>{revisionNotice}</span></section>
        )}
        {approvalNotice && (
          <section className="notice success" role="status"><strong>Revision approved</strong><span>{approvalNotice}</span></section>
        )}
        {deliveryNotice && (
          <section className="notice success" role="status"><strong>Delivery created</strong><span>{deliveryNotice}</span></section>
        )}
        {activeRoute === "dashboard" && (
          <Dashboard
            workspace={workspace}
            version={version}
            automationReady={automationReady}
            loading={loading}
            clientCreationAvailable={clientCreationAvailable}
            clientCreationHelp={clientCreationHelp}
            projectCreationAvailable={projectCreationAvailable}
            projectCreationHelp={projectCreationHelp}
            onRefresh={refresh}
            onNewClient={openClientWorkflow}
            onNewProject={() => openProjectWorkflow(null, false)}
            onTasks={() => navigate("tasks")}
            onActivity={() => navigate("activity")}
            onOpenProject={openDerivedProject}
          />
        )}
        {activeRoute === "studio" && <StudioRoute workspace={workspace} version={version} loading={loading} setupAvailable={studioCreationAvailable} setupHelp={studioCreationHelp} onSetup={openStudioWorkflow} onRefresh={refresh} />}
        {activeRoute === "tasks" && <TasksRoute workspace={workspace} loading={loading} onRefresh={refresh} onOpenProject={openDerivedProject} />}
        {activeRoute === "activity" && <ActivityRoute workspace={workspace} loading={loading} onRefresh={refresh} onOpenProject={openDerivedProject} />}
        {activeRoute === "reports" && <ReportsRoute workspace={workspace} onOpenProject={(clientId, projectId) => { openDerivedProject(clientId, projectId); setProjectView("reports"); }} />}
        {activeRoute === "settings" && <SettingsRoute preferences={preferences} onChange={setPreferences} workspace={workspace} version={version} />}
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
              setProjectView("overview");
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
        {activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject && (projectView === "reports" || projectView === "files" || projectView === "metadata") ? (
          <ProjectArtifactsView active={projectView} client={resolvedProjectClient} project={resolvedProject} onSelectView={selectProjectView} />
        ) : activeRoute === "projects" && resolvedProject && selectedProject && projectView === "delivery" ? (
          <DeliveryView clientId={resolvedProjectClient?.clientId ?? ""} project={resolvedProject} loading={loading || deliveryWorkflow.status === "preflighting" || deliveryWorkflow.status === "creating"} actionError={deliveryActionError} creationAvailable={deliveryCreationAvailable} creationHelp={deliveryCreationHelp} onOverview={() => setProjectView("overview")} onCreate={openDeliveryWorkflow} onRefresh={refresh} onSelectView={selectProjectView} />
        ) : activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject && projectView === "revisions" ? (
          <RevisionsView
            client={resolvedProjectClient}
            project={resolvedProject}
            loading={loading}
            actionError={revisionActionError ?? approvalActionError}
            creationAvailable={revisionCreationAvailable}
            creationHelp={revisionCreationHelp}
            approvalAvailable={revisionApprovalAvailable}
            approvalHelp={revisionApprovalHelp}
            onOverview={() => setProjectView("overview")}
            onRefresh={refresh}
            onNewRevision={openRevisionWorkflow}
            onApprove={openApprovalWorkflow}
            onSelectView={selectProjectView}
          />
        ) : activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject && projectView === "intake" ? (
          <IntakeView
            client={resolvedProjectClient}
            project={resolvedProject}
            reportState={intakeReport}
            actionError={intakeActionError}
            validationAvailable={intakeValidationAvailable}
            validationHelp={intakeValidationHelp}
            loading={loading || intakeWorkflow.status === "preflighting"}
            onOverview={() => { setProjectView("overview"); setIntakeWorkflow({ status: "closed" }); setIntakeActionError(null); }}
            onPreview={preflightIntake}
            onRefresh={() => {
              refresh();
              loadIntakeReport({ clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId });
            }}
            onSelectView={selectProjectView}
          />
        ) : activeRoute === "projects" && resolvedProjectClient && resolvedProject && selectedProject ? (
          <ProjectOverview
            client={resolvedProjectClient}
            project={resolvedProject}
            fromClient={selectedProject.fromClient}
            onProjects={() => { setSelectedProject(null); setSelectedClientId(null); setProjectView("overview"); setRouteNotice(null); }}
            onClient={() => {
              setSelectedProject(null);
              setProjectView("overview");
              setSelectedClientId(resolvedProjectClient.clientId);
              setActiveRoute("clients");
              setRouteNotice(null);
            }}
            onRefresh={refresh}
            onIntake={openIntake}
            onRevisions={openRevisions}
            onNewRevision={openRevisionWorkflow}
            revisionCreationAvailable={revisionCreationAvailable}
            revisionCreationHelp={revisionCreationHelp}
            loading={loading}
            onSelectView={selectProjectView}
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
              setProjectView("overview");
              setRouteNotice(null);
            }}
          />
        ) : null}
      </main>

      {studioWorkflow.status !== "closed" && <StudioDialog state={studioWorkflow} values={studioForm} onChange={setStudioForm} onPreflight={preflightStudio} onConfirm={confirmStudioCreation} onBack={() => setStudioWorkflow({ status: "editing" })} onClose={closeStudioWorkflow} />}

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
      {intakeWorkflow.status !== "closed" && intakeWorkflow.status !== "preflighting" && (
        <IntakeDialog
          state={intakeWorkflow}
          onConfirm={confirmIntake}
          onClose={() => {
            if (intakeWorkflow.status === "running") return;
            setIntakeWorkflow({ status: "closed" });
            if (resolvedProjectClient && resolvedProject) {
              loadIntakeReport({ clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId });
            }
          }}
        />
      )}
      {revisionWorkflow.status !== "closed" && resolvedProject && (
        <RevisionDialog
          state={revisionWorkflow}
          values={revisionForm}
          project={resolvedProject}
          onChange={setRevisionForm}
          onPreflight={preflightRevision}
          onConfirm={confirmRevision}
          onBack={() => {
            if (revisionWorkflow.status !== "confirming") return;
            setRevisionWorkflow({ status: "editing" });
          }}
          onClose={closeRevisionWorkflow}
        />
      )}
      {approvalWorkflow.status !== "closed" && resolvedProject && (
        <ApprovalDialog
          state={approvalWorkflow}
          values={approvalForm}
          project={resolvedProject}
          onChange={setApprovalForm}
          onPreflight={preflightApproval}
          onConfirm={confirmApproval}
          onBack={() => {
            if (approvalWorkflow.status !== "confirming") return;
            setApprovalWorkflow({ status: "editing", revision: approvalWorkflow.revision });
          }}
          onClose={closeApprovalWorkflow}
        />
      )}
      {deliveryWorkflow.status !== "closed" && deliveryWorkflow.status !== "preflighting" && (
        <DeliveryDialog
          state={deliveryWorkflow}
          onConfirm={confirmDelivery}
          onClose={() => {
            closeDeliveryWorkflow();
            if (deliveryWorkflow.status === "uncertain") refresh();
          }}
        />
      )}
    </div>
  );
}
