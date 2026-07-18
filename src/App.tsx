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
  DiscoveryIssue,
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

const plannedRouteContent: Record<Exclude<PrimaryRoute, "dashboard">, {
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
  clients: {
    status: "Client directory is planned",
    sections: [
      { title: "Client directory", detail: "Searchable validated client metadata" },
      { title: "Client Details", detail: "Client defaults and that client’s projects" },
      { title: "Project selection", detail: "Opens the shared Project Overview route" },
    ],
    tableColumns: ["Client", "Default artist", "Projects", "Updated"],
    routeNote: "Client editing is unavailable because JL Mixing Automation v1.2.0 has no approved client-edit command.",
  },
  projects: {
    status: "Project directory is planned",
    sections: [
      { title: "Project Overview", detail: "Identity, lifecycle state, revisions, and recommended next step" },
      { title: "Workflow", detail: "Overview, Intake, Revisions, Delivery, Reports, Files, and Metadata" },
      { title: "Restricted actions", detail: "Folder and DAW actions require separately approved capabilities" },
    ],
    tableColumns: ["Project", "Client", "Current", "Approved", "Delivered"],
    routeNote: "Projects remains the active primary route for Project Overview and every project workflow screen.",
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

const clientIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const formatRevision = (revision: number | null) =>
  revision === null ? "Not set" : "Revision " + revision;

const safeError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : fallback;

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <article className="project-card">
      <div className="project-title">
        <div>
          <p className="kicker">Project</p>
          <h3>{project.projectName}</h3>
        </div>
        <span className="artist">{project.artist}</span>
      </div>
      <dl className="revision-grid">
        <div><dt>Current</dt><dd>{formatRevision(project.currentRevision)}</dd></div>
        <div><dt>Approved</dt><dd>{formatRevision(project.approvedRevision)}</dd></div>
        <div><dt>Delivered</dt><dd>{formatRevision(project.deliveredRevision)}</dd></div>
      </dl>
      <footer>
        <span>Schema {project.schemaVersion}</span>
        <span>Created with {project.createdWith}</span>
      </footer>
    </article>
  );
}

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

      {snapshot.clients.length > 0 && (
        <section className="clients" aria-labelledby="clients-heading">
          <div className="section-heading">
            <p className="kicker">Workspace contents</p>
            <h2 id="clients-heading">Clients and projects</h2>
          </div>
          {snapshot.clients.map((client) => (
            <section className="client-group" key={client.clientId}>
              <div className="client-heading">
                <div>
                  <h3>{client.clientName}</h3>
                  {client.defaultArtist && <p>Default artist: {client.defaultArtist}</p>}
                </div>
                <span>{client.projects.length} {client.projects.length === 1 ? "project" : "projects"}</span>
              </div>
              {client.projects.length === 0 ? (
                <p className="client-empty">No projects for this client.</p>
              ) : (
                <div className="project-list">
                  {client.projects.map((project) => (
                    <ProjectCard key={project.projectId} project={project} />
                  ))}
                </div>
              )}
            </section>
          ))}
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

      {snapshot && (
        <section className="workspace-section" aria-labelledby="workspace-contents-heading">
          <div className="section-heading">
            <p className="kicker">Authoritative workspace</p>
            <h2 id="workspace-contents-heading">Clients and projects</h2>
          </div>
          <WorkspaceContent snapshot={snapshot} />
        </section>
      )}
    </>
  );
}

function PlannedRoute({
  route,
  onNewClient,
  clientCreationAvailable,
  clientCreationHelp,
}: {
  route: Exclude<PrimaryRoute, "dashboard">;
  onNewClient: () => void;
  clientCreationAvailable: boolean;
  clientCreationHelp: string;
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
        {route === "clients" && (
          <button type="button" onClick={onNewClient} disabled={!clientCreationAvailable} aria-describedby="clients-new-client-help">
            New client
          </button>
        )}
      </div>
      {route === "clients" && <p id="clients-new-client-help" className="action-help">{clientCreationHelp}</p>}

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

export default function App() {
  const [activeRoute, setActiveRoute] = useState<PrimaryRoute>("dashboard");
  const [workspace, setWorkspace] = useState<ResourceState<WorkspaceSnapshot>>({ status: "loading" });
  const [version, setVersion] = useState<ResourceState<VersionCheck>>({ status: "loading" });
  const [clientWorkflow, setClientWorkflow] = useState<ClientWorkflowState>({ status: "closed" });
  const [clientForm, setClientForm] = useState<ClientFormValues>(emptyClientForm);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
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

  const openClientWorkflow = () => {
    if (!clientCreationAvailable) return;
    setCreationNotice(null);
    setClientForm(emptyClientForm);
    setClientWorkflow({ status: "editing" });
  };

  const closeClientWorkflow = () => {
    if (clientWorkflow.status === "preflighting" || clientWorkflow.status === "creating") return;
    setClientWorkflow({ status: "closed" });
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

  const activeRouteDefinition = routes.find((route) => route.id === activeRoute) ?? routes[0];

  return (
    <div className="app-shell">
      <Sidebar activeRoute={activeRoute} onNavigate={setActiveRoute} workspace={workspace} />
      <main className="main-content" id="main-content">
        <RouteHeader route={activeRouteDefinition} />
        {creationNotice && (
          <section className="notice success" role="status">
            <strong>Client created</strong>
            <span>{creationNotice}</span>
          </section>
        )}
        {activeRoute === "dashboard" ? (
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
        ) : (
          <PlannedRoute
            route={activeRoute}
            onNewClient={openClientWorkflow}
            clientCreationAvailable={clientCreationAvailable}
            clientCreationHelp={clientCreationHelp}
          />
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
    </div>
  );
}
