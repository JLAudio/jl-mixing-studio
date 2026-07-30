import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  DeliveryNotesDocument,
  DeliveryNotesRequest,
  DeliveryNotesUpdateRequest,
  ProjectSummary,
} from "../types";
import { FolderControl, safeError, type ProjectView, type ResourceState } from "../AppShellViews";
import { ProjectWorkflowTabs } from "../project";
import { copy as productCopy } from "../resources/copy";

const formatRevisionTimestamp = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

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
