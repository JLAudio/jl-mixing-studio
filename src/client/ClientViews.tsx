import type { ClientSummary, WorkspaceSnapshot } from "../types";
import {
  ContextSearch,
  RouteIssues,
  WorkspaceContent,
  type ResourceState,
} from "../AppShellViews";
import { copy as productCopy } from "../resources/copy";

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
