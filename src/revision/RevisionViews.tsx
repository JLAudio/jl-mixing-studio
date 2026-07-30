import { useEffect, useState } from "react";
import type { ClientSummary, ProjectSummary, RevisionSummary } from "../types";
import { FolderControl, type ProjectView } from "../AppShellViews";
import { ProjectWorkflowTabs } from "../project";
import { copy as productCopy } from "../resources/copy";

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
