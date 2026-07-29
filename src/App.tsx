import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ApprovalOperationResult,
  ClientCreationRequest,
  ClientCreationSummary,
  ClientOperationResult,
  ClientSummary,
  DeliveryCreationPreview,
  DeliveryCreationRequest,
  DeliveryOperationResult,
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
import {
  ActivityRoute,
  ClientDetails,
  ClientsRoute,
  Dashboard,
  DeliveryView,
  FolderControl,
  IntakeReportContent,
  IntakeView,
  ProjectArtifactsView,
  ProjectOverview,
  ProjectsRoute,
  ReportsRoute,
  RevisionsView,
  RouteHeader,
  RouteIssues,
  Sidebar,
  TasksRoute,
  safeError,
  type IntakeReportState,
  type ProjectView,
  type ResourceState,
} from "./AppViews";
import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";
import "./App.css";

/**
 * Lets React commit a busy state and gives the WebView a paint opportunity
 * before native or CLI work begins.
 */
function yieldToBrowserPaint(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

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


type IntakeWorkflowState =
  | { status: "closed" }
  | { status: "preflighting" }
  | { status: "confirming"; preview: IntakeReport }
  | { status: "running"; preview: IntakeReport }
  | { status: "uncertain"; message: string };


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
  | { status: "options"; request: DeliveryCreationRequest }
  | { status: "preflighting"; request: DeliveryCreationRequest }
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

const emptyRevisionForm: RevisionFormValues = { description: "" };
const emptyApprovalForm: ApprovalFormValues = { approvedBy: "Client" };

const clientIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  left.replacementMode === right.replacementMode &&
  left.createZip === right.createZip &&
  left.deletions.length === right.deletions.length &&
  left.deletions.every((path, index) => path === right.deletions[index]) &&
  left.selected.length === right.selected.length &&
  left.selected.every((file, index) => {
    const candidate = right.selected[index];
    return candidate &&
      file.sourceName === candidate.sourceName &&
      file.deliverableType === candidate.deliverableType &&
      file.path === candidate.path;
  });

function DeliveryOptionsDialog({ request, projectName, onChange, onPreview, onClose }: {
  request: DeliveryCreationRequest;
  projectName: string;
  onChange: (request: DeliveryCreationRequest) => void;
  onPreview: () => void;
  onClose: () => void;
}) {
  const replacing = request.replacementMode === "overwrite";
  const cleaning = request.replacementMode === "clean";
  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}><section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-options-title"><p className="kicker">Guided delivery</p><h2 id="delivery-options-title">{request.replacementMode === "default" ? "Create delivery package" : "Rebuild delivery package"}</h2><p className="dialog-intro">Choose the supported package output for <strong>{projectName}</strong>. Studio will preview the exact Automation plan before making changes.</p>
    {request.replacementMode !== "default" && <fieldset className="delivery-mode"><legend>Replacement mode</legend><label><input type="radio" name="delivery-mode" checked={replacing} onChange={() => onChange({ ...request, replacementMode: "overwrite", confirmedDeletions: [] })} /><span><strong>Same-path overwrite</strong><small>Preserves Delivery Notes and unrelated files; rejects a changed delivered path set.</small></span></label><label><input type="radio" name="delivery-mode" checked={cleaning} onChange={() => onChange({ ...request, replacementMode: "clean", confirmedDeletions: [] })} /><span><strong>Clean replacement</strong><small>Deletes every existing item in 05_Final_Delivery before rebuilding it.</small></span></label></fieldset>}
    <dl className="confirmation-list"><div><dt>Replacement mode</dt><dd>{cleaning ? "Clean — delete all existing contents" : replacing ? "Overwrite — same delivered path set only" : "None — first package"}</dd></div><div><dt>Delivery Notes</dt><dd>{cleaning ? "Deleted and recreated from template" : replacing ? "Preserved" : "Created from the Automation template"}</dd></div></dl>
    <label className="setting-row"><span><strong>Create delivery ZIP</strong><small>Create a revisioned, local-time-stamped <code>{request.projectId}-rev-NN-YYYYMMDDHHMMSS.zip</code> archive. Rebuilding includes the current edited Delivery Notes.</small></span><input type="checkbox" checked={request.createZip} onChange={(event) => onChange({ ...request, createZip: event.target.checked })} /></label>
    {replacing && <div className="notice warning" role="status"><strong>Non-destructive replacement</strong><span>Automation will replace only the same manifest-recorded delivery paths and preserve Delivery Notes and unrelated package files. A changed path set is rejected.</span></div>}
    {cleaning && <div className="form-error" role="alert"><strong>Destructive replacement.</strong> Every file, folder, edited note, ZIP, and unrelated item currently inside 05_Final_Delivery will be deleted. The next screen lists the exact deletion preview.</div>}
    <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="button" onClick={onPreview}>Preview package</button></div>
  </section></div>;
}

function DeliveryDialog({
  state,
  onConfirm,
  onClose,
}: {
  state: Exclude<DeliveryWorkflowState, { status: "closed" } | { status: "options" } | { status: "preflighting" }>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const pending = state.status === "creating";
  const confirmButton = useRef<HTMLButtonElement>(null);
  const [cleanConfirmation, setCleanConfirmation] = useState("");
  const cleanPhrase = state.status === "uncertain" ? "" : `CLEAN ${state.preview.projectId}`;
  useEffect(() => {
    if (state.status === "confirming") confirmButton.current?.focus();
  }, [state.status]);
  return (
    <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}>
      <section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-dialog-title">
        <p className="kicker">Guided delivery</p>
        <h2 id="delivery-dialog-title">{state.status === "uncertain" ? "Delivery needs verification" : "Confirm delivery package"}</h2>
        {state.status === "uncertain" ? <>
          <div className="form-error" role="alert">{state.message}</div>
          <p className="dialog-intro">Do not submit the request again automatically. Close this message and refresh the authoritative delivery state.</p>
          <div className="dialog-actions"><button type="button" onClick={onClose}>Close</button></div>
        </> : <>
          <p className="dialog-intro">{state.preview.replacementMode === "overwrite" ? "Rebuild" : "Create"} the final-delivery package for <strong>{state.preview.projectName}</strong>. Automation will verify every copied file with SHA-256 and update the delivered pointer transactionally.</p>
          <dl className="confirmation-list">
            <div><dt>Approved revision</dt><dd>Revision {state.preview.approvedRevision}</dd></div>
            <div><dt>Current revision</dt><dd>Revision {state.preview.currentRevision}</dd></div>
            <div><dt>Delivery method</dt><dd>{state.preview.deliveryMethod}</dd></div>
            <div><dt>Files</dt><dd>{state.preview.selected.length}</dd></div>
            <div><dt>Replacement mode</dt><dd>{state.preview.replacementMode === "clean" ? "Clean — delete all existing contents" : state.preview.replacementMode === "overwrite" ? "Overwrite — same path set" : "None — first package"}</dd></div>
            <div><dt>ZIP</dt><dd>{state.preview.createZip ? `${state.preview.projectId}-rev-${String(state.preview.approvedRevision).padStart(2, "0")}-YYYYMMDDHHMMSS.zip` : "Not created"}</dd></div>
          </dl>
          <div className="table-scroll"><table><thead><tr><th>Source</th><th>Type</th><th>Destination</th></tr></thead><tbody>{state.preview.selected.map((file) => <tr key={`${file.sourceName}:${file.path}`}><td>{file.sourceName}</td><td>{file.deliverableType.replace(/_/g, " ")}</td><td><code>{file.path}</code></td></tr>)}</tbody></table></div>
          {state.preview.excluded.length > 0 && <section className="route-note"><strong>Excluded by Automation defaults</strong><span>{state.preview.excluded.map((file) => `${file.name} (${file.reason})`).join(", ")}</span></section>}
          {state.preview.replacementMode === "clean" && <section className="panel"><h3>Every existing item Automation will delete</h3><ul className="plain-list">{state.preview.deletions.map((path) => <li key={path}><code>{path}</code></li>)}</ul><label className="field"><span>Type <strong>{cleanPhrase}</strong> to authorize this destructive replacement</span><input aria-label="Clean replacement confirmation" value={cleanConfirmation} onChange={(event) => setCleanConfirmation(event.target.value)} autoComplete="off" /></label></section>}
          <div className="notice warning" role="status"><strong>Workspace change</strong><span>This {state.preview.replacementMode === "clean" ? "deletes every previewed item and rebuilds" : state.preview.replacementMode === "overwrite" ? "rebuilds" : "creates"} files in 05_Final_Delivery and sets state.delivered_revision to Revision {state.preview.approvedRevision}.{state.preview.replacementMode === "overwrite" ? " Edited Delivery Notes and unrelated files are preserved." : state.preview.replacementMode === "clean" ? " Delivery Notes are recreated from the Automation template." : ""} Custom filters are not enabled.</span></div>
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending || (state.preview.replacementMode === "clean" && cleanConfirmation !== cleanPhrase)}>{pending ? "Creating…" : state.preview.replacementMode === "clean" ? "Clean and rebuild delivery" : state.preview.replacementMode === "overwrite" ? "Rebuild delivery" : "Create delivery"}</button></div>
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
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Checking…" : "Review revision"}</button></div>
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
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Creating…" : "Create revision"}</button></div>
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
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Checking…" : "Review approval"}</button></div>
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
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Approving…" : "Approve revision"}</button></div>
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
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Updating report…" : "Update intake report"}</button></div>
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
      <div className="planned-banner"><div><span className="status-pill warning">{unavailable ? "Not configured" : "Recovery required"}</span><h2 id="studio-state-heading">{unavailable ? "Create the default studio workspace" : "Studio configuration is not readable"}</h2><p>{unavailable ? "Use the guided JL Mixing Automation v1.3.1 workflow to create ~/Music/Mixes." : "Review the validated discovery issues below before changing the workspace."}</p></div><button type="button" onClick={onSetup} disabled={!setupAvailable || loading} aria-describedby="studio-setup-help">New studio</button></div>
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
    {(state.status === "editing" || state.status === "preflighting") && <form onSubmit={onPreflight} noValidate><p className="dialog-intro">Creates the default workspace at <code>~/Music/Mixes</code>. No custom path or command options are accepted.</p>{state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}<label>Studio name<input aria-label="Studio name" value={values.studioName} onChange={(e) => onChange({...values, studioName:e.target.value})} required disabled={pending}/></label><label>Mix engineer <span>(optional)</span><input aria-label="Mix engineer" value={values.mixEngineer} onChange={(e) => onChange({...values, mixEngineer:e.target.value})} disabled={pending}/></label><label>Sample rate<select aria-label="Sample rate" value={values.sampleRate} onChange={(e) => onChange({...values, sampleRate:e.target.value})} disabled={pending}>{[44100,48000,88200,96000,176400,192000].map(v=><option key={v} value={v}>{v.toLocaleString()} Hz</option>)}</select></label><label>Bit depth<select aria-label="Bit depth" value={values.bitDepth} onChange={(e) => onChange({...values, bitDepth:e.target.value})} disabled={pending}>{[16,24,32].map(v=><option key={v} value={v}>{v}-bit</option>)}</select></label><label>File format<select aria-label="File format" value={values.fileFormat} onChange={(e) => onChange({...values, fileFormat:e.target.value})} disabled={pending}><option>WAV</option><option>AIFF</option></select></label><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Checking…" : "Review studio"}</button></div></form>}
    {(state.status === "confirming" || state.status === "creating") && <div><p className="dialog-intro">Preflight passed without changing the filesystem. Confirm to create the default workspace.</p><dl className="confirmation-list"><div><dt>Studio</dt><dd>{state.preview.studioName}</dd></div><div><dt>Engineer</dt><dd>{state.preview.mixEngineer ?? "Not set"}</dd></div><div><dt>Audio</dt><dd>{state.preview.sampleRate.toLocaleString()} Hz · {state.preview.bitDepth}-bit {state.preview.fileFormat}</dd></div><div><dt>Location</dt><dd><code>~/Music/Mixes</code></dd></div></dl><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>Cancel</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button><button type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Creating…" : "Create studio"}</button></div></div>}
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
      <section className="panel"><h3>Read-only diagnostics</h3><dl className="metadata-list"><div><dt>Workspace</dt><dd>{workspace.status === "ready" ? <code>{workspace.value.workspacePath}</code> : workspace.status}</dd></div><div><dt>Workspace status</dt><dd>{workspace.status === "ready" ? workspace.value.status : "Unavailable"}</dd></div><div><dt>Automation</dt><dd>{version.status === "ready" ? version.value.message : "Check unavailable"}</dd></div><div><dt>Supported contract</dt><dd>JL Mixing Automation 1.3.1</dd></div></dl></section></div>
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

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setWorkspace({ status: "loading" });
    setVersion({ status: "loading" });
    await yieldToBrowserPaint();

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
  const preflightStudio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (studioWorkflow.status !== "editing") return;
    const request: StudioCreationRequest = { studioName: studioForm.studioName.trim(), mixEngineer: studioForm.mixEngineer.trim() || null, sampleRate: Number(studioForm.sampleRate), bitDepth: Number(studioForm.bitDepth), fileFormat: studioForm.fileFormat };
    if (!request.studioName) { setStudioWorkflow({ status: "editing", error: "Studio name is required." }); return; }
    setStudioWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
    invoke<StudioOperationResult>("preflight_studio_creation", { request }).then((result) => {
      if (result.ok && result.code === "ready" && result.studio) setStudioWorkflow({ status: "confirming", request, preview: result.studio });
      else setStudioWorkflow({ status: "editing", error: result.message });
    }).catch((error: unknown) => setStudioWorkflow({ status: "editing", error: safeError(error, "Studio preflight could not be completed.") }));
  };
  const confirmStudioCreation = async () => {
    if (studioWorkflow.status !== "confirming") return;
    const { request, preview } = studioWorkflow;
    setStudioWorkflow({ status: "creating", request, preview });
    await yieldToBrowserPaint();
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
    return "Preview and confirm a new client using JL Mixing Automation v1.3.1.";
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
    return "Preview and confirm a new project using JL Mixing Automation v1.3.1.";
  })();

  const intakeValidationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (workspace.value.status !== "healthy") {
      return "The existing report remains readable, but workspace issues must be resolved before validation can run.";
    }
    if (!version.value.intakeValidationSupported) return version.value.message;
    return "Preview the Automation v1.3.1 defaults, then confirm the managed report update.";
  })();

  const revisionCreationHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (workspace.value.status !== "healthy") {
      return "Revision history remains readable, but workspace issues must be resolved before creating a revision.";
    }
    if (!version.value.revisionCreationSupported) return version.value.message;
    return "Preview and confirm the next revision using JL Mixing Automation v1.3.1.";
  })();

  const revisionApprovalHelp = (() => {
    if (workspace.status !== "ready" || version.status !== "ready") {
      return "Workspace and automation checks must finish first.";
    }
    if (workspace.value.status !== "healthy") {
      return "Revision history remains readable, but workspace issues must be resolved before recording approval.";
    }
    if (!version.value.revisionApprovalSupported) return version.value.message;
    return "Select a revision, review the lifecycle impact, and confirm its approval through JL Mixing Automation v1.3.1.";
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

  const preflightClient = async (event: FormEvent<HTMLFormElement>) => {
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
    await yieldToBrowserPaint();
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

  const confirmClientCreation = async () => {
    if (clientWorkflow.status !== "confirming") return;
    const { request, preview } = clientWorkflow;
    setClientWorkflow({ status: "creating", request, preview });
    await yieldToBrowserPaint();

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

  const preflightProject = async (event: FormEvent<HTMLFormElement>) => {
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
    await yieldToBrowserPaint();
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

  const confirmProjectCreation = async () => {
    if (projectWorkflow.status !== "confirming") return;
    const { request, preview, fromClient } = projectWorkflow;
    setProjectWorkflow({ status: "creating", request, preview, fromClient });
    await yieldToBrowserPaint();

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
      replacementMode: resolvedProject.delivery ? "overwrite" : "default",
      createZip: resolvedProject.delivery !== null,
      confirmedDeletions: [],
    };
    setDeliveryNotice(null);
    setDeliveryActionError(null);
    setDeliveryWorkflow({ status: "options", request });
  };

  const preflightDelivery = async () => {
    if (deliveryWorkflow.status !== "options" || !resolvedProject) return;
    const { request } = deliveryWorkflow;
    setDeliveryWorkflow({ status: "preflighting", request });
    await yieldToBrowserPaint();
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
          result.delivery.deliveredRevision === resolvedProject.deliveredRevision &&
          result.delivery.deliveryMethod === resolvedProject.deliveryMethod &&
          result.delivery.replacementMode === request.replacementMode &&
          result.delivery.createZip === request.createZip &&
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

  const confirmDelivery = async () => {
    if (deliveryWorkflow.status !== "confirming") return;
    const { request, preview } = deliveryWorkflow;
    const executionRequest: DeliveryCreationRequest = {
      ...request,
      confirmedDeletions: preview.replacementMode === "clean" ? preview.deletions : [],
    };
    setDeliveryWorkflow({ status: "creating", request: executionRequest, preview });
    await yieldToBrowserPaint();
    invoke<DeliveryOperationResult>("create_delivery", { request: executionRequest })
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

  const preflightRevision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (revisionWorkflow.status !== "editing" || !resolvedProjectClient || !resolvedProject) return;
    const request: RevisionCreationRequest = {
      clientId: resolvedProjectClient.clientId,
      projectId: resolvedProject.projectId,
      description: revisionForm.description.trim() || null,
    };
    setRevisionWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
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

  const confirmRevision = async () => {
    if (revisionWorkflow.status !== "confirming") return;
    const { request, preview } = revisionWorkflow;
    setRevisionWorkflow({ status: "creating", request, preview });
    await yieldToBrowserPaint();
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

  const preflightApproval = async (event: FormEvent<HTMLFormElement>) => {
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
    await yieldToBrowserPaint();
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

  const confirmApproval = async () => {
    if (approvalWorkflow.status !== "confirming") return;
    const { revision, request, preview } = approvalWorkflow;
    setApprovalWorkflow({ status: "approving", revision, request, preview });
    await yieldToBrowserPaint();
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

  const preflightIntake = async () => {
    if (!resolvedProjectClient || !resolvedProject || !intakeValidationAvailable) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    setIntakeActionError(null);
    setIntakeNotice(null);
    setIntakeWorkflow({ status: "preflighting" });
    await yieldToBrowserPaint();
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

  const confirmIntake = async () => {
    if (intakeWorkflow.status !== "confirming" || !resolvedProjectClient || !resolvedProject) return;
    const request = { clientId: resolvedProjectClient.clientId, projectId: resolvedProject.projectId };
    const preview = intakeWorkflow.preview;
    setIntakeWorkflow({ status: "running", preview });
    await yieldToBrowserPaint();
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
    ((resolvedProject.deliveredRevision === null && resolvedProject.delivery === null) ||
      (resolvedProject.deliveredRevision !== null && resolvedProject.delivery !== null));
  const deliveryCreationHelp = (() => {
    if (!resolvedProject) return "Select a project before creating a delivery.";
    if (workspace.status !== "ready" || version.status !== "ready") return "Workspace and automation checks must finish first.";
    if (workspace.value.status !== "healthy") return "Delivery history remains readable, but workspace issues must be resolved before creating a package.";
    if (!version.value.deliveryCreationSupported) return version.value.message;
    if (resolvedProject.approvedRevision === null) return "Approve a revision before creating the first delivery package.";
    if (resolvedProject.deliveredRevision !== null && resolvedProject.delivery !== null) return "Preview a same-path overwrite that preserves edited Delivery Notes and unrelated package files; optionally rebuild the ZIP.";
    return "Preview and confirm the first package using Automation defaults with mandatory SHA-256 verification and optional ZIP output.";
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
      {deliveryWorkflow.status === "options" && resolvedProject && (
        <DeliveryOptionsDialog
          request={deliveryWorkflow.request}
          projectName={resolvedProject.projectName}
          onChange={(request) => setDeliveryWorkflow({ status: "options", request })}
          onPreview={preflightDelivery}
          onClose={closeDeliveryWorkflow}
        />
      )}
      {deliveryWorkflow.status !== "closed" && deliveryWorkflow.status !== "options" && deliveryWorkflow.status !== "preflighting" && (
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
