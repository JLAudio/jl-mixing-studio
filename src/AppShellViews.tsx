import { type ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type {
  ActivityEvent,
  DerivedTask,
  DiscoveryIssue,
  FolderLocation,
  FolderRequest,
  FolderResult,
  IntakeOperationResult,
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
