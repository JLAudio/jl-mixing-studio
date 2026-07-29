import { type ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type {
  ActivityEvent,
  ClientSummary,
  DeliveryNotesDocument,
  DeliveryNotesRequest,
  DeliveryNotesUpdateRequest,
  DerivedTask,
  DiscoveryIssue,
  FolderLocation,
  FolderRequest,
  FolderResult,
  IntakeOperationResult,
  IntakeReport,
  ProjectSummary,
  RevisionSummary,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";
import appIcon from "../src-tauri/icons/128x128.png";
import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; message: string };

export type ProjectView =
  | "overview"
  | "intake"
  | "revisions"
  | "delivery"
  | "reports"
  | "files"
  | "metadata";

export type IntakeReportState = { status: "idle" } | ResourceState<IntakeOperationResult>;

export function FolderControl({ location, clientId = null, projectId = null, label = "Open folder" }: { location: FolderLocation; clientId?: string | null; projectId?: string | null; label?: string }) {
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
  const copy = () => resolve().then((result) => writeText(result.path)).then(() => setMessage("Path copied.")).catch((error: unknown) => setMessage(safeError(error, "The path could not be copied.")));
  const open = () => invoke<FolderResult>("open_folder", { request }).then((result) => { setPath(result.path); setMessage("Folder opened."); }).catch((error: unknown) => setMessage(safeError(error, "The folder could not be opened.")));
  return <div className="folder-control"><code>{path ?? "Resolving folder…"}</code><div className="directory-actions"><button type="button" className="secondary" onClick={copy} disabled={!path}>Copy path</button><button type="button" onClick={open}>{label}</button></div>{message && <small role="status">{message}</small>}</div>;
}

const displayWorkspacePath = (path: string) =>
  path
    .replace(/^\/Users\/[^/]+(?=\/)/, "~")
    .replace(/^\/home\/[^/]+(?=\/)/, "~")
    .replace(/^[A-Za-z]:\\Users\\[^\\]+(?=\\)/, "~");

export const safeError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;

export function IssueDetail({ issue }: { issue: DiscoveryIssue }) {
  return (
    <li>
      <strong>{issue.displayName ?? "Workspace"}</strong>
      <span>{issue.message}</span>
      {issue.relativePath && <code>{issue.relativePath}</code>}
      <small>{issue.recovery}</small>
    </li>
  );
}

export function WorkspaceContent({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  return (
    <>
      {snapshot.status === "partial" && (
        <section className="notice warning" role="status">
          <strong>
            {snapshot.counts.issues} workspace{" "}
            {snapshot.counts.issues === 1 ? "item needs" : "items need"} attention
          </strong>
          <span>Your available clients and projects are still here below.</span>
          <a href="#workspace-issues">Review issues</a>
        </section>
      )}

      {snapshot.status === "unavailable" && (
        <section className="empty-state">
          <p className="kicker">Setup required</p>
          <h2>Your studio workspace isn’t ready yet</h2>
          <p>Set up your studio workspace to get started.</p>
        </section>
      )}

      {snapshot.status === "invalid" && (
        <section className="empty-state error">
          <p className="kicker">Something doesn’t look right</p>
          <h2>We can’t read this studio setup yet</h2>
          <p>Check the details below, then try again.</p>
        </section>
      )}

      {snapshot.status === "empty" && (
        <section className="empty-state">
          <p className="kicker">You’re ready to go</p>
          <h2>Your studio is ready for its first client</h2>
          <p>Choose <strong>New client</strong> when you’re ready to get started.</p>
        </section>
      )}

      {snapshot.issues.length > 0 && (
        <section className="issues" id="workspace-issues" aria-labelledby="issues-heading">
          <p className="kicker">A few things to check</p>
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

export function NavIcon({ route }: { route: PrimaryRoute }) {
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

export function Sidebar({
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
        <span className="brand-mark" aria-hidden="true"><img src={appIcon} alt="" /></span>
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

export function GlobalSearch() {
  return (
    <div className="global-search" aria-label="Global search" aria-disabled="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <span>Search everything</span>
      <span className="planned-pill">Planned</span>
    </div>
  );
}

export function RouteHeader({ route }: { route: RouteDefinition }) {
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

export function TaskSummary({ task, onOpenProject }: { task: DerivedTask; onOpenProject: (clientId: string, projectId: string) => void }) {
  return <article className="derived-item"><span className={`priority-pill ${task.priority}`}>{taskPriorityLabel[task.priority]}</span><div><strong>{task.title}</strong><p>{task.reason}</p><small>{task.deadline ? `Deadline ${task.deadline} · ` : ""}{task.recommendedAction}</small></div>{task.clientId && task.projectId && <button type="button" className="table-link" onClick={() => onOpenProject(task.clientId!, task.projectId!)}>{task.projectName}</button>}</article>;
}
export function ActivitySummary({ event, onOpenProject }: { event: ActivityEvent; onOpenProject: (clientId: string, projectId: string) => void }) {
  const label = event.revision === null ? activityEventLabel[event.eventType] : `${activityEventLabel[event.eventType]} · Revision ${event.revision}`;
  return <article className="derived-item activity-item"><time dateTime={event.timestamp}>{formatEventTimestamp(event.timestamp)}</time><div><strong>{label}</strong><small>{event.projectName ?? event.clientName}</small></div>{event.projectId && <button type="button" className="table-link" onClick={() => onOpenProject(event.clientId, event.projectId!)}>Open project</button>}</article>;
}

export function Dashboard({
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
          <span>Clients</span><strong>{snapshot?.counts.clients ?? "—"}</strong><small>Clients in your studio</small>
        </article>
        <article className="summary-card accent-violet">
          <span>Projects</span><strong>{snapshot?.counts.projects ?? "—"}</strong><small>Projects in your studio</small>
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
          <strong>We couldn’t open your studio workspace</strong>
          <span>{workspace.message}</span>
          <button type="button" onClick={onRefresh}>Try again</button>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="panel today-panel" aria-labelledby="today-heading">
          <div className="panel-heading">
            <div><p className="kicker">On deck</p><h2 id="today-heading">What needs your attention</h2></div>
            <button type="button" className="table-link" onClick={onTasks}>View all</button>
          </div>
          {snapshot && snapshot.tasks.length > 0 ? <div className="derived-list">{snapshot.tasks.slice(0, 4).map((task) => <TaskSummary key={task.id} task={task} onOpenProject={onOpenProject} />)}</div> : <div className="planned-message"><strong>Nothing needs your attention right now.</strong><p>Refresh anytime to check for new work.</p></div>}
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
          <div className="panel-heading"><div><p className="kicker">Quick actions</p><h2 id="actions-heading">Start something new</h2></div></div>
          <div className="action-grid">
            <button type="button" onClick={onNewClient} disabled={!clientCreationAvailable} aria-describedby="new-client-help">New client</button>
            <button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} title={projectCreationHelp}>New project</button>
            <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh workspace"}</button>
          </div>
          <p id="new-client-help" className="action-help">{clientCreationHelp}</p>
        </section>

        <section className="panel activity-panel" aria-labelledby="activity-heading">
          <div className="panel-heading"><div><p className="kicker">Recent activity</p><h2 id="activity-heading">What’s been happening</h2></div><button type="button" className="table-link" onClick={onActivity}>View all</button></div>
          {snapshot && snapshot.activity.length > 0 ? <div className="derived-list">{snapshot.activity.slice(0, 5).map((event) => <ActivitySummary key={event.id} event={event} onOpenProject={onOpenProject} />)}</div> : <div className="planned-message compact"><strong>No recent project activity yet.</strong><p>New clients, projects, revisions, approvals, and deliveries will show up here.</p></div>}
        </section>
      </div>

      {snapshot && <WorkspaceContent snapshot={snapshot} />}
    </>
  );
}

const revisionLabel = (revision: number | null) =>
  revision === null ? "Not set" : `Revision ${revision}`;

export function ContextSearch({ label }: { label: string }) {
  return (
    <div className="context-search" aria-label={`${label} search`} aria-disabled="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <span>Search {label.toLowerCase()}</span><span className="planned-pill">Planned</span>
    </div>
  );
}

export function RouteIssues({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  if (snapshot.issues.length === 0) return null;
  return (
    <section className="issues route-issues" aria-labelledby="route-issues-heading">
      <p className="kicker">A few things to check</p>
      <h2 id="route-issues-heading">Some workspace data is unavailable</h2>
      <p className="route-supporting-copy">The clients and projects we can read are still available.</p>
      <ul>
        {snapshot.issues.map((issue, index) => (
          <IssueDetail key={[issue.relativePath ?? issue.scope, issue.code, index].join("-")} issue={issue} />
        ))}
      </ul>
    </section>
  );
}

export function TasksRoute({ workspace, loading, onRefresh, onOpenProject }: { workspace: ResourceState<WorkspaceSnapshot>; loading: boolean; onRefresh: () => void; onOpenProject: (clientId: string, projectId: string) => void }) {
  if (workspace.status === "loading") return <section className="notice">Checking what needs attention…</section>;
  if (workspace.status === "error") return <section className="notice error"><strong>We couldn’t load your tasks</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;
  return <><section className="directory-toolbar"><div><p className="kicker">Studio work</p><h2>{snapshot.tasks.length} {snapshot.tasks.length === 1 ? "task" : "tasks"}</h2></div><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></section><ContextSearch label="Tasks" />{snapshot.tasks.length === 0 ? <section className="empty-state"><h2>Nothing needs your attention</h2><p>You’re all caught up for now.</p></section> : <section className="panel"><div className="table-scroll"><table><thead><tr><th>Priority</th><th>Task</th><th>Project</th><th>Reason</th><th>Recommended action</th></tr></thead><tbody>{snapshot.tasks.map((task) => <tr key={task.id}><td><span className={`priority-pill ${task.priority}`}>{taskPriorityLabel[task.priority]}</span></td><td><strong>{task.title}</strong>{task.deadline && <small className="table-detail">Deadline {task.deadline}</small>}</td><td>{task.clientId && task.projectId ? <button type="button" className="table-link" onClick={() => onOpenProject(task.clientId!, task.projectId!)}>{task.projectName}</button> : task.projectName ?? "Workspace"}</td><td>{task.reason}</td><td>{task.recommendedAction}</td></tr>)}</tbody></table></div></section>}<aside className="route-note"><strong>Updated when you refresh</strong><span>Tasks are based on the current state of your studio and projects.</span></aside></>;
}

export function ActivityRoute({ workspace, loading, onRefresh, onOpenProject }: { workspace: ResourceState<WorkspaceSnapshot>; loading: boolean; onRefresh: () => void; onOpenProject: (clientId: string, projectId: string) => void }) {
  if (workspace.status === "loading") return <section className="notice">Loading recent activity…</section>;
  if (workspace.status === "error") return <section className="notice error"><strong>We couldn’t load recent activity</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;
  return <><section className="directory-toolbar"><div><p className="kicker">Recent studio activity</p><h2>{snapshot.activity.length} {snapshot.activity.length === 1 ? "event" : "events"}</h2></div><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></section><ContextSearch label="Activity" />{snapshot.activity.length === 0 ? <section className="empty-state"><h2>No recent activity yet</h2><p>Project activity will appear here as work moves forward.</p></section> : <section className="panel"><div className="table-scroll"><table><thead><tr><th>Timestamp</th><th>Event</th><th>Project or client</th><th>Source</th></tr></thead><tbody>{snapshot.activity.map((event) => <tr key={event.id}><td><time dateTime={event.timestamp}>{formatEventTimestamp(event.timestamp)}</time></td><td>{activityEventLabel[event.eventType]}{event.revision !== null && <small className="table-detail">Revision {event.revision}</small>}</td><td>{event.projectId ? <button type="button" className="table-link" onClick={() => onOpenProject(event.clientId, event.projectId!)}>{event.projectName}</button> : event.clientName}</td><td><code>{event.persistedSource}</code></td></tr>)}</tbody></table></div></section>}<aside className="route-note"><strong>Activity history</strong><span>This view shows supported project milestones recorded by JL Mixing Automation.</span></aside></>;
}

export function ClientsRoute({
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
        <div><p className="kicker">Your studio</p><h2 id="client-directory-heading">{snapshot.counts.clients} {snapshot.counts.clients === 1 ? "client" : "clients"}</h2></div>
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

export function ClientDetails({
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
      <aside className="route-note"><strong>Read only</strong><span>Client editing isn’t available yet.</span></aside>
      <section className="detail-section" aria-labelledby="client-projects-heading">
        <div className="panel-heading"><div><p className="kicker">Client projects</p><h2 id="client-projects-heading">Projects for {client.clientName}</h2></div><div className="directory-actions"><button type="button" disabled className="planned-action">Edit client <span>Planned</span></button><button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} aria-describedby="client-new-project-help">New project</button></div></div>
        <p id="client-new-project-help" className="action-help directory-help">{projectCreationHelp}</p>
        {client.projects.length === 0 ? (
          <div className="planned-message compact"><strong>No projects for this client.</strong><p>Create the first project when you’re ready.</p></div>
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

export function ProjectsRoute({
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
        <div><p className="kicker">Your studio</p><h2 id="project-directory-heading">{entries.length} {entries.length === 1 ? "project" : "projects"}</h2></div>
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

export function ProjectWorkflowTabs({
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

export function ProjectOverview({
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
          <div className="panel-heading"><div><p className="kicker">Project information</p><h2 id="project-information-heading">Project details</h2></div></div>
          <dl className="metadata-list">
            <div><dt>Client</dt><dd>{client.clientName}</dd></div><div><dt>Project ID</dt><dd><code>{project.projectId}</code></dd></div><div><dt>Artist</dt><dd>{project.artist}</dd></div><div><dt>Deadline</dt><dd>{project.deadline ?? "Not set"}</dd></div><div><dt>Audio</dt><dd>{project.sampleRate / 1000} kHz / {project.bitDepth}-bit / {project.fileFormat}</dd></div><div><dt>Schema</dt><dd>{project.schemaVersion}</dd></div><div><dt>Created with</dt><dd>{project.createdWith}</dd></div>
          </dl>
        </section>
        <section className="panel" aria-labelledby="project-actions-heading">
          <div className="panel-heading"><div><p className="kicker">Project actions</p><h2 id="project-actions-heading">Keep the project moving</h2></div></div>
          <div className="action-stack"><button type="button" disabled>Open DAW — Planned</button><button type="button" onClick={onIntake}>Validate intake</button><button type="button" onClick={onNewRevision} disabled={!revisionCreationAvailable || loading}>New revision</button><button type="button" onClick={onRevisions}>View revisions</button></div>
          <FolderControl location="project" clientId={client.clientId} projectId={project.projectId} />
          <p className="action-help">{revisionCreationHelp}</p>
        </section>
      </div>
    </>
  );
}

export function IntakeReportContent({ report, compact = false }: { report: IntakeReport; compact?: boolean }) {
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

export function IntakeView({
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
      {(reportState.status === "idle" || reportState.status === "loading") && <section className="empty-state"><h2>Loading intake report</h2><p>Reading the latest intake report for this project.</p></section>}
      {reportState.status === "error" && <section className="notice error" role="alert"><strong>Report unavailable</strong><span>{reportState.message}</span></section>}
      {result && !result.ok && <section className="notice error" role="alert"><strong>Report unavailable</strong><span>{result.message}</span></section>}
      {result?.ok && !result.report && <section className="empty-state"><h2>Intake validation has not been run</h2><p>Preview the intake check before updating the report.</p></section>}
      {result?.ok && result.report && <IntakeReportContent report={result.report} />}
    </>
  );
}

const formatRevisionTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function RevisionBadges({ project, number, historicallyApproved }: { project: ProjectSummary; number: number; historicallyApproved: boolean }) {
  const badges: Array<[string, string]> = [];
  if (number === project.currentRevision) badges.push(["Current", "current"]);
  if (number === project.approvedRevision) badges.push(["Approved", "approved"]);
  if (number === project.deliveredRevision) badges.push(["Delivered", "delivered"]);
  if (historicallyApproved && number !== project.approvedRevision) badges.push(["Previously approved", "historical"]);
  if (badges.length === 0 && number < project.currentRevision) badges.push(["Superseded", "superseded"]);
  return <span className="revision-badges">{badges.map(([label, className]) => <span key={label} className={`revision-badge ${className}`}>{label}</span>)}</span>;
}

export function RevisionsView({
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
        <section className="empty-state"><h2>No revisions recorded</h2><p>This project doesn’t have a revision yet.</p></section>
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
                <div><dt>Description</dt><dd>{selected.description}</dd></div>
                <div><dt>Approval</dt><dd>{selected.approvedAt && selected.approvedBy ? <><span>Approved by {selected.approvedBy}</span><small><time dateTime={selected.approvedAt}>{formatRevisionTimestamp(selected.approvedAt)}</time></small></> : "Not approved"}</dd></div>
              </dl>
              <aside className="route-note"><strong>Revision details</strong><span>These details come from the project record. No project files were scanned or changed.</span></aside>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export function ProjectArtifactsView({ active, client, project, onSelectView }: { active: "reports" | "files" | "metadata"; client: ClientSummary; project: ProjectSummary; onSelectView: (view: ProjectView) => void }) {
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
    <section className="directory-toolbar"><div><p className="kicker">{client.clientName}</p><h2>{active === "reports" ? "Project reports" : active === "files" ? "Project files" : "Project metadata"}</h2></div></section>
    {active === "reports" && <div className="project-detail-grid"><section className="panel"><h3>Intake validation report</h3><p>{intake ? `${intake.filesDiscovered} files · ${intake.blockingErrors} blocking errors · ${intake.warnings} warnings` : "No readable intake report is recorded."}</p>{intake && <code>{intake.source}</code>}</section><section className="panel"><h3>Delivery details</h3><p>{project.delivery ? `Revision ${project.delivery.revision} · ${project.delivery.files.length} files · ${project.delivery.method}` : "No delivery package has been recorded yet."}</p>{project.delivery && <code>05_Final_Delivery/delivery-manifest.json</code>}</section></div>}
    {active === "files" && <section className="panel"><div className="table-scroll"><table><thead><tr><th>File</th><th>Source</th><th>Details</th></tr></thead><tbody>{intake?.inventory.map((file) => <tr key={`intake-${file.file}`}><td><code>{file.file}</code></td><td>Intake report</td><td>{file.technicalDetails}</td></tr>)}{project.delivery?.files.map((file) => <tr key={`delivery-${file.path}`}><td><code>{file.path}</code></td><td>Delivery details</td><td>{file.deliverableType.replace(/_/g, " ")} · {file.sizeBytes.toLocaleString()} bytes</td></tr>)}{!intake?.inventory.length && !project.delivery?.files.length && <tr><td colSpan={3}>No files are recorded in the available project reports.</td></tr>}</tbody></table></div></section>}
    {active === "metadata" && <section className="panel"><dl className="metadata-list"><div><dt>Client ID</dt><dd><code>{client.clientId}</code></dd></div><div><dt>Project ID</dt><dd><code>{project.projectId}</code></dd></div><div><dt>Project</dt><dd>{project.projectName}</dd></div><div><dt>Artist</dt><dd>{project.artist}</dd></div><div><dt>Created</dt><dd>{project.createdAt}</dd></div><div><dt>Schema</dt><dd>{project.schemaVersion}</dd></div><div><dt>Audio</dt><dd>{project.sampleRate} Hz · {project.bitDepth}-bit {project.fileFormat}</dd></div><div><dt>Delivery method</dt><dd>{project.deliveryMethod}</dd></div><div><dt>Current / approved / delivered</dt><dd>{project.currentRevision} / {project.approvedRevision ?? "—"} / {project.deliveredRevision ?? "—"}</dd></div></dl></section>}
    <FolderControl location="project" clientId={client.clientId} projectId={project.projectId} />
  </>;
}

export function ReportsRoute({ workspace, onOpenProject }: { workspace: ResourceState<WorkspaceSnapshot>; onOpenProject: (clientId: string, projectId: string) => void }) {
  if (workspace.status !== "ready") return <section className="empty-state"><h2>Loading reports</h2></section>;
  const deliveries = workspace.value.clients.flatMap((client) => client.projects.filter((project) => project.delivery).map((project) => ({ client, project })));
  return <section className="panel"><div className="panel-heading"><div><p className="kicker">Studio reports</p><h2>Reports</h2></div></div><p>Delivery reports are collected here. Intake reports are available from each project’s Reports tab.</p><div className="table-scroll"><table><thead><tr><th>Report</th><th>Project</th><th>Updated</th></tr></thead><tbody>{deliveries.map(({ client, project }) => <tr key={`${client.clientId}-${project.projectId}`}><td>Delivery details</td><td><button className="table-link" type="button" onClick={() => onOpenProject(client.clientId, project.projectId)}>{project.projectName}</button></td><td>{project.delivery!.createdAt}</td></tr>)}{deliveries.length === 0 && <tr><td colSpan={3}>No delivery reports yet.</td></tr>}</tbody></table></div></section>;
}

export function DeliveryView({ clientId, project, loading, actionError, creationAvailable, creationHelp, onOverview, onCreate, onRefresh, onSelectView }: {
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
  const deliveryDocumentId = delivery?.documentId;
  const [notes, setNotes] = useState<ResourceState<DeliveryNotesDocument>>({ status: "loading" });
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!deliveryDocumentId) return;
    setNotes({ status: "loading" });
    setNotesMessage(null);
    const request: DeliveryNotesRequest = { clientId, projectId: project.projectId };
    void invoke<DeliveryNotesDocument>("get_delivery_notes", { request })
      .then((document) => {
        setNotes({ status: "ready", value: document });
        setNotesDraft(document.content);
      })
      .catch((error: unknown) => setNotes({
        status: "error",
        message: safeError(error, "Delivery Notes could not be read."),
      }));
  }, [clientId, project.projectId, deliveryDocumentId]);
  const saveNotes = () => {
    if (notes.status !== "ready" || notesSaving || notesDraft === notes.value.content) return;
    setNotesSaving(true);
    setNotesMessage(null);
    const request: DeliveryNotesUpdateRequest = { clientId, projectId: project.projectId, content: notesDraft };
    void invoke<DeliveryNotesDocument>("update_delivery_notes", { request })
      .then((document) => {
        setNotes({ status: "ready", value: document });
        setNotesDraft(document.content);
        setNotesMessage("Delivery Notes saved and verified.");
      })
      .catch((error: unknown) => setNotesMessage(safeError(error, "Delivery Notes could not be saved.")))
      .finally(() => setNotesSaving(false));
  };
  const totalBytes = delivery?.files.reduce((total, file) => total + file.sizeBytes, 0) ?? 0;
  const readiness = project.approvedRevision === null
    ? { title: "Approval required", detail: "Approve a revision before creating a delivery package." }
    : delivery === null
      ? { title: "Ready for first delivery", detail: `Approved Revision ${project.approvedRevision} is ready to package.` }
      : project.approvedRevision === project.deliveredRevision
        ? { title: "Delivery is current", detail: `The current package contains approved Revision ${project.deliveredRevision}.` }
        : { title: "New delivery available", detail: `The current package contains Revision ${project.deliveredRevision}; approved Revision ${project.approvedRevision} is ready for a replacement delivery.` };
  return <>
    <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Delivery</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
    <ProjectWorkflowTabs active="delivery" onSelect={onSelectView} />
    <section className="directory-toolbar" aria-labelledby="delivery-heading"><div><p className="kicker">Delivery status</p><h2 id="delivery-heading">Delivery</h2></div><button type="button" onClick={onCreate} disabled={!creationAvailable || loading}>{loading ? "Checking…" : delivery ? "Rebuild delivery" : "Create delivery"}</button></section>
    <p className="action-help">{creationHelp}</p>
    <FolderControl location="delivery" clientId={clientId} projectId={project.projectId} label="Open delivery folder" />
    {actionError && <div className="form-error" role="alert">{actionError}</div>}
    <section className="notice" role="status"><strong>{readiness.title}</strong><span>{readiness.detail}</span></section>
    {!delivery ? <section className="empty-state"><h2>No delivery package yet</h2><p>No delivery package has been created for this project yet.</p></section> : <>
      <section className="panel"><div className="panel-heading"><div><p className="kicker">Delivery details</p><h2>Revision {delivery.revision}</h2></div></div><dl className="metadata-list">
        <div><dt>Created</dt><dd><time dateTime={delivery.createdAt}>{formatRevisionTimestamp(delivery.createdAt)}</time></dd></div><div><dt>Method</dt><dd>{delivery.method}</dd></div><div><dt>Approved by</dt><dd>{delivery.approvedBy}</dd></div><div><dt>Files</dt><dd>{delivery.files.length}</dd></div><div><dt>Total bytes</dt><dd>{totalBytes.toLocaleString()}</dd></div><div><dt>Document ID</dt><dd><code>{delivery.documentId}</code></dd></div>
      </dl></section>
      <section className="panel"><div className="panel-heading"><div><p className="kicker">File verification</p><h2>{delivery.files.length} delivered {delivery.files.length === 1 ? "file" : "files"}</h2></div></div><div className="table-scroll"><table><thead><tr><th>Path</th><th>Type</th><th>Size</th><th>SHA-256</th></tr></thead><tbody>{delivery.files.map((file) => <tr key={file.path}><td><code>{file.path}</code></td><td>{file.deliverableType.replace(/_/g, " ")}</td><td>{file.sizeBytes.toLocaleString()}</td><td><code>{file.sha256}</code></td></tr>)}</tbody></table></div></section>
      <section className="panel"><div className="panel-heading"><div><p className="kicker">Package document</p><h2>Delivery Notes</h2></div>{notes.status === "ready" && <span>{new TextEncoder().encode(notesDraft).length.toLocaleString()} / {notes.value.maxBytes.toLocaleString()} bytes</span>}</div>
        {notes.status === "loading" && <p>Reading <code>Delivery_Notes.md</code>…</p>}
        {notes.status === "error" && <div className="form-error" role="alert">{notes.message}</div>}
        {notes.status === "ready" && <><label className="field"><span>Markdown content</span><textarea aria-label="Delivery Notes Markdown content" rows={12} value={notesDraft} onChange={(event) => { setNotesDraft(event.target.value); setNotesMessage(null); }} /></label><div className="dialog-actions"><button type="button" onClick={saveNotes} disabled={notesSaving || notesDraft === notes.value.content || new TextEncoder().encode(notesDraft).length > notes.value.maxBytes} aria-busy={notesSaving}>{notesSaving ? "Saving…" : "Save Delivery Notes"}</button></div></>}
        {notesMessage && <p role="status">{notesMessage}</p>}
      </section>
      <aside className="route-note"><strong>Delivery details</strong><span>JL Mixing Automation recorded and verified these checksums when the package was created. Studio did not re-check the delivery files.</span></aside>
    </>}
  </>;
}
