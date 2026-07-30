import type { ClientSummary, ProjectSummary, WorkspaceSnapshot } from "../types";
import {
  ContextSearch,
  FolderControl,
  RouteIssues,
  WorkspaceContent,
  type ProjectView,
  type ResourceState,
} from "../AppShellViews";
import { copy as productCopy } from "../resources/copy";

const revisionLabel = (revision: number | null) =>
  revision === null ? productCopy.common.notSet : `${productCopy.projects.revisionPrefix} ${revision}`;

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
