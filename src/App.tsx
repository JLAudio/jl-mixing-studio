import {
  type FormEvent,
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

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1>JL Mixing Studio</h1>
          <p className="lede">A clear view of your clients, projects, and mix lifecycle.</p>
          {workspace.status === "ready" && <code className="workspace-path">{workspace.value.workspacePath}</code>}
        </div>
        <div className="hero-actions">
          <button type="button" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={openClientWorkflow}
            disabled={!clientCreationAvailable}
            aria-describedby="new-client-help"
          >
            New client
          </button>
          <p id="new-client-help">{clientCreationHelp}</p>
        </div>
      </header>

      <section className="automation-card" aria-labelledby="automation-heading">
        <div>
          <p className="kicker">JL Mixing Automation</p>
          <h2 id="automation-heading">
            {version.status === "loading" ? "Checking…" : automationReady ? "Detected" : "Needs attention"}
          </h2>
        </div>
        <p className={"automation-status " + (automationReady ? "success" : "warning")}>
          {version.status === "loading"
            ? "Checking the installed JL Mixing Automation release."
            : version.status === "ready"
              ? version.value.message
              : version.message}
        </p>
      </section>

      {creationNotice && (
        <section className="notice success" role="status">
          <strong>Client created</strong>
          <span>{creationNotice}</span>
        </section>
      )}

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
    </main>
  );
}
