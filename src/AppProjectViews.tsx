import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ClientSummary,
  DeliveryNotesDocument,
  DeliveryNotesRequest,
  DeliveryNotesUpdateRequest,
  IntakeOperationResult,
  IntakeReport,
  ProjectSummary,
  RevisionSummary,
  WorkspaceSnapshot,
} from "./types";
import {
  ContextSearch,
  FolderControl,
  RouteIssues,
  WorkspaceContent,
  safeError,
  type IntakeReportState,
  type ProjectView,
  type ResourceState,
} from "./AppShellViews";
import { copy as productCopy } from "./resources/copy";

const revisionLabel = (revision: number | null) =>
  revision === null ? productCopy.common.notSet : `${productCopy.projects.revisionPrefix} ${revision}`;

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
  if (workspace.status === "loading") return <section className="notice" aria-live="polite">{productCopy.clients.reading}</section>;
  if (workspace.status === "error") return <section className="notice error" role="alert"><strong>{productCopy.clients.loadFailed}</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;

  return (
    <>
      <section className="directory-toolbar" aria-labelledby="client-directory-heading">
        <div><p className="kicker">{productCopy.clients.studioKicker}</p><h2 id="client-directory-heading">{snapshot.counts.clients} {snapshot.counts.clients === 1 ? productCopy.clients.singular : productCopy.clients.plural}</h2></div>
        <div className="directory-actions"><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button><button type="button" onClick={onNewClient} disabled={!clientCreationAvailable} aria-describedby="clients-new-client-help">{productCopy.clients.newClient}</button></div>
      </section>
      <p id="clients-new-client-help" className="action-help directory-help">{clientCreationHelp}</p>
      <ContextSearch label={productCopy.clients.searchLabel} />

      {(snapshot.status === "unavailable" || snapshot.status === "invalid" || snapshot.status === "empty") && (
        <WorkspaceContent snapshot={snapshot} />
      )}
      {snapshot.clients.length > 0 && (
        <div className="table-scroll directory-table">
          <table>
            <thead><tr><th scope="col">{productCopy.clients.tableClient}</th><th scope="col">{productCopy.clients.tableClientId}</th><th scope="col">{productCopy.clients.tableDefaultArtist}</th><th scope="col">{productCopy.clients.tableProjects}</th></tr></thead>
            <tbody>
              {snapshot.clients.map((client) => (
                <tr key={client.clientId}>
                  <td><button type="button" className="table-link" onClick={() => onSelectClient(client.clientId)}>{client.clientName}</button></td>
                  <td><code>{client.clientId}</code></td>
                  <td>{client.defaultArtist || productCopy.common.notSet}</td>
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
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label={productCopy.common.breadcrumbLabel}>
        <button type="button" onClick={onBack}>Clients</button><span aria-hidden="true">/</span><span aria-current="page">{client.clientName}</span>
      </nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button></div>
      <section className="detail-summary" aria-label={productCopy.clients.detailsLabel}>
        <article><span>{productCopy.clients.tableClientId}</span><strong><code>{client.clientId}</code></strong></article>
        <article><span>{productCopy.clients.tableDefaultArtist}</span><strong>{client.defaultArtist || productCopy.common.notSet}</strong></article>
        <article><span>{productCopy.clients.tableProjects}</span><strong>{client.projects.length}</strong></article>
      </section>
      <aside className="route-note"><strong>{productCopy.clients.readOnly}</strong><span>{productCopy.clients.editingUnavailable}</span></aside>
      <section className="detail-section" aria-labelledby="client-projects-heading">
        <div className="panel-heading"><div><p className="kicker">{productCopy.clients.projectsKicker}</p><h2 id="client-projects-heading">{productCopy.clients.projectsFor} {client.clientName}</h2></div><div className="directory-actions"><button type="button" disabled className="planned-action">{productCopy.clients.editClient} <span>{productCopy.common.planned}</span></button><button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} aria-describedby="client-new-project-help">{productCopy.clients.newProject}</button></div></div>
        <p id="client-new-project-help" className="action-help directory-help">{projectCreationHelp}</p>
        {client.projects.length === 0 ? (
          <div className="planned-message compact"><strong>{productCopy.clients.noProjects}</strong><p>{productCopy.clients.createFirstProject}</p></div>
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
  if (workspace.status === "loading") return <section className="notice" aria-live="polite">{productCopy.projects.reading}</section>;
  if (workspace.status === "error") return <section className="notice error" role="alert"><strong>{productCopy.projects.loadFailed}</strong><span>{workspace.message}</span></section>;
  const snapshot = workspace.value;
  const entries: ProjectEntry[] = snapshot.clients.flatMap((client) => client.projects.map((project) => ({ client, project })));

  return (
    <>
      <section className="directory-toolbar" aria-labelledby="project-directory-heading">
        <div><p className="kicker">{productCopy.clients.studioKicker}</p><h2 id="project-directory-heading">{entries.length} {entries.length === 1 ? productCopy.projects.singular : productCopy.projects.plural}</h2></div>
        <div className="directory-actions"><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button><button type="button" onClick={onNewProject} disabled={!projectCreationAvailable} aria-describedby="projects-new-project-help">{productCopy.clients.newProject}</button></div>
      </section>
      <p id="projects-new-project-help" className="action-help directory-help">{projectCreationHelp}</p>
      <ContextSearch label={productCopy.projects.searchLabel} />
      {(snapshot.status === "unavailable" || snapshot.status === "invalid" || snapshot.status === "empty") && <WorkspaceContent snapshot={snapshot} />}
      {entries.length > 0 && (
        <div className="table-scroll directory-table">
          <table>
            <thead><tr><th scope="col">{productCopy.projects.tableProject}</th><th scope="col">{productCopy.projects.tableClient}</th><th scope="col">{productCopy.projects.tableArtist}</th><th scope="col">{productCopy.projects.current}</th><th scope="col">{productCopy.projects.approved}</th><th scope="col">{productCopy.projects.delivered}</th></tr></thead>
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
  const tabs: Array<[ProjectView, string]> = (["overview", "intake", "revisions", "delivery", "reports", "files", "metadata"] as const).map((view) => [view, productCopy.projects.tabs[view]]);
  return (
    <div className="workflow-tabs" aria-label={productCopy.projects.workflowLabel}>
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
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label={productCopy.common.breadcrumbLabel}>
        <button type="button" onClick={onProjects}>Projects</button><span aria-hidden="true">/</span>
        {fromClient && <><button type="button" onClick={onClient}>{client.clientName}</button><span aria-hidden="true">/</span></>}
        <span aria-current="page">{project.projectName}</span>
      </nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button></div>
      <ProjectWorkflowTabs active="overview" onSelect={onSelectView} />
      <section className="detail-summary project-revisions" aria-label={productCopy.projects.revisionStateLabel}>
        <article><span>{productCopy.projects.current}</span><strong>{revisionLabel(project.currentRevision)}</strong></article>
        <article><span>{productCopy.projects.approved}</span><strong>{revisionLabel(project.approvedRevision)}</strong></article>
        <article><span>{productCopy.projects.delivered}</span><strong>{revisionLabel(project.deliveredRevision)}</strong></article>
      </section>
      <div className="project-detail-grid">
        <section className="panel" aria-labelledby="project-information-heading">
          <div className="panel-heading"><div><p className="kicker">{productCopy.projects.informationKicker}</p><h2 id="project-information-heading">{productCopy.projects.detailsTitle}</h2></div></div>
          <dl className="metadata-list">
            <div><dt>{productCopy.projects.tableClient}</dt><dd>{client.clientName}</dd></div><div><dt>{productCopy.projects.projectId}</dt><dd><code>{project.projectId}</code></dd></div><div><dt>{productCopy.projects.tableArtist}</dt><dd>{project.artist}</dd></div><div><dt>{productCopy.projects.deadline}</dt><dd>{project.deadline ?? productCopy.common.notSet}</dd></div><div><dt>{productCopy.projects.audio}</dt><dd>{project.sampleRate / 1000} kHz / {project.bitDepth}-bit / {project.fileFormat}</dd></div><div><dt>{productCopy.projects.schema}</dt><dd>{project.schemaVersion}</dd></div><div><dt>{productCopy.projects.createdWith}</dt><dd>{project.createdWith}</dd></div>
          </dl>
        </section>
        <section className="panel" aria-labelledby="project-actions-heading">
          <div className="panel-heading"><div><p className="kicker">{productCopy.projects.actionsKicker}</p><h2 id="project-actions-heading">{productCopy.projects.actionsTitle}</h2></div></div>
          <div className="action-stack"><button type="button" disabled>{productCopy.projects.openDawPlanned}</button><button type="button" onClick={onIntake}>{productCopy.projects.validateIntake}</button><button type="button" onClick={onNewRevision} disabled={!revisionCreationAvailable || loading}>{productCopy.projects.newRevision}</button><button type="button" onClick={onRevisions}>{productCopy.projects.viewRevisions}</button></div>
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
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label={productCopy.common.breadcrumbLabel}><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Intake</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button></div>
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
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label={productCopy.common.breadcrumbLabel}><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Revisions</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button></div>
      <ProjectWorkflowTabs active="revisions" onSelect={onSelectView} />
      <section className="directory-toolbar revision-toolbar" aria-labelledby="revisions-heading">
        <div><p className="kicker">{client.clientName}</p><h2 id="revisions-heading">Revision history</h2></div>
        <div className="directory-actions"><button type="button" onClick={onNewRevision} disabled={!creationAvailable || loading}>{productCopy.projects.newRevision}</button><button type="button" onClick={() => { if (selected) onApprove(selected); }} disabled={!selected || !approvalAvailable || selected.number === project.approvedRevision || loading}>Approve revision</button></div>
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
    {active === "metadata" && <section className="panel"><dl className="metadata-list"><div><dt>Client ID</dt><dd><code>{client.clientId}</code></dd></div><div><dt>{productCopy.projects.projectId}</dt><dd><code>{project.projectId}</code></dd></div><div><dt>Project</dt><dd>{project.projectName}</dd></div><div><dt>{productCopy.projects.tableArtist}</dt><dd>{project.artist}</dd></div><div><dt>Created</dt><dd>{project.createdAt}</dd></div><div><dt>{productCopy.projects.schema}</dt><dd>{project.schemaVersion}</dd></div><div><dt>{productCopy.projects.audio}</dt><dd>{project.sampleRate} Hz · {project.bitDepth}-bit {project.fileFormat}</dd></div><div><dt>Delivery method</dt><dd>{project.deliveryMethod}</dd></div><div><dt>Current / approved / delivered</dt><dd>{project.currentRevision} / {project.approvedRevision ?? "—"} / {project.deliveredRevision ?? "—"}</dd></div></dl></section>}
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
    <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label={productCopy.common.breadcrumbLabel}><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Delivery</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button></div>
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
