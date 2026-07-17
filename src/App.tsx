import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
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
  const statusLabel = {
    healthy: "Healthy",
    empty: "Ready",
    partial: "Needs attention",
    unavailable: "Not found",
    invalid: "Invalid",
  }[snapshot.status];

  return (
    <>
      <div className="status-grid">
        <section className="metric-card" aria-labelledby="workspace-health">
          <p className="kicker">Workspace</p>
          <h2 id="workspace-health">{statusLabel}</h2>
          <p>{snapshot.studio?.studioName ?? "Default JL Mixing workspace"}</p>
        </section>
        <section className="metric-card" aria-label="Client count">
          <p className="kicker">Clients</p>
          <strong>{snapshot.counts.clients}</strong>
        </section>
        <section className="metric-card" aria-label="Project count">
          <p className="kicker">Projects</p>
          <strong>{snapshot.counts.projects}</strong>
        </section>
      </div>

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
          <p>Create the first client with JL Mixing Automation, then refresh.</p>
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

export default function App() {
  const [workspace, setWorkspace] = useState<ResourceState<WorkspaceSnapshot>>({ status: "loading" });
  const [version, setVersion] = useState<ResourceState<VersionCheck>>({ status: "loading" });
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
  const automationAvailable = version.status === "ready" && version.value.available;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1>JL Mixing Studio</h1>
          <p className="lede">A clear view of your clients, projects, and mix lifecycle.</p>
          {workspace.status === "ready" && <code className="workspace-path">{workspace.value.workspacePath}</code>}
        </div>
        <button type="button" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="automation-card" aria-labelledby="automation-heading">
        <div>
          <p className="kicker">JL Mixing Automation</p>
          <h2 id="automation-heading">
            {version.status === "loading" ? "Checking…" : automationAvailable ? "Detected" : "Needs attention"}
          </h2>
        </div>
        <p className={"automation-status " + (automationAvailable ? "success" : "warning")}>
          {version.status === "loading"
            ? "Checking the fixed jl-mixing --version operation."
            : version.status === "ready"
              ? version.value.message
              : version.message}
        </p>
      </section>

      {workspace.status === "loading" && (
        <section className="notice" aria-live="polite">Reading the default workspace…</section>
      )}
      {workspace.status === "error" && (
        <section className="notice error" role="alert">
          <strong>Workspace discovery failed</strong>
          <span>{workspace.message}</span>
          <button type="button" onClick={refresh}>Try again</button>
        </section>
      )}
      {workspace.status === "ready" && <WorkspaceContent snapshot={workspace.value} />}
    </main>
  );
}
