import { type FormEvent, useEffect, useRef, useState } from "react";
import type {
  ClientSummary,
  DeliveryCreationRequest,
  ProjectSummary,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";
import { FolderControl, IntakeReportContent, RouteIssues, type ResourceState } from "./AppViews";
import { copy as productCopy } from "./resources/copy";
import type {
  ApprovalFormValues,
  ApprovalWorkflowState,
  AppPreferences,
  ClientFormValues,
  ClientWorkflowState,
  DeliveryWorkflowState,
  IntakeWorkflowState,
  ProjectFormValues,
  ProjectWorkflowState,
  RevisionFormValues,
  RevisionWorkflowState,
  StudioFormValues,
  StudioWorkflowState,
} from "./AppWorkflowModels";

export function DeliveryOptionsDialog({ request, projectName, onChange, onPreview, onClose }: {
  request: DeliveryCreationRequest;
  projectName: string;
  onChange: (request: DeliveryCreationRequest) => void;
  onPreview: () => void;
  onClose: () => void;
}) {
  const replacing = request.replacementMode === "overwrite";
  const cleaning = request.replacementMode === "clean";
  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}><section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="delivery-options-title"><p className="kicker">{productCopy.delivery.guided}</p><h2 id="delivery-options-title">{request.replacementMode === "default" ? productCopy.delivery.createPackage : productCopy.delivery.rebuildPackage}</h2><p className="dialog-intro">Choose how to package <strong>{projectName}</strong>. You’ll review the exact files and changes before anything happens.</p>
    {request.replacementMode !== "default" && <fieldset className="delivery-mode"><legend>{productCopy.delivery.replacementMode}</legend><label><input type="radio" name="delivery-mode" checked={replacing} onChange={() => onChange({ ...request, replacementMode: "overwrite", confirmedDeletions: [] })} /><span><strong>{productCopy.delivery.samePathOverwrite}</strong><small>Replaces only the same delivered file paths and keeps Delivery Notes and unrelated files. If the delivered path set changed, the rebuild stops.</small></span></label><label><input type="radio" name="delivery-mode" checked={cleaning} onChange={() => onChange({ ...request, replacementMode: "clean", confirmedDeletions: [] })} /><span><strong>{productCopy.delivery.cleanReplacement}</strong><small>Deletes everything currently inside 05_Final_Delivery before creating the new delivery.</small></span></label></fieldset>}
    <dl className="confirmation-list"><div><dt>{productCopy.delivery.replacementMode}</dt><dd>{cleaning ? productCopy.delivery.cleanModeSummary : replacing ? productCopy.delivery.overwriteModeSummary : productCopy.delivery.firstPackageSummary}</dd></div><div><dt>{productCopy.delivery.deliveryNotes}</dt><dd>{cleaning ? productCopy.delivery.notesDeleted : replacing ? productCopy.delivery.notesPreserved : productCopy.delivery.notesCreated}</dd></div></dl>
    <label className="setting-row"><span><strong>{productCopy.delivery.createZip}</strong><small>Create a revisioned, local-time-stamped <code>{request.projectId}-rev-NN-YYYYMMDDHHMMSS.zip</code> archive. Rebuilding includes the current edited Delivery Notes.</small></span><input type="checkbox" checked={request.createZip} onChange={(event) => onChange({ ...request, createZip: event.target.checked })} /></label>
    {replacing && <div className="notice warning" role="status"><strong>{productCopy.delivery.nonDestructiveReplacement}</strong><span>Only the same delivered file paths will be replaced. Delivery Notes and unrelated files stay in place. If the delivered paths changed, nothing is replaced.</span></div>}
    {cleaning && <div className="form-error" role="alert"><strong>{productCopy.delivery.destructiveReplacement}</strong> Everything currently inside 05_Final_Delivery—including files, folders, edited Delivery Notes, ZIPs, and unrelated items—will be deleted before the new delivery is created. The next screen lists every item.</div>}
    <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>{productCopy.common.cancel}</button><button type="button" onClick={onPreview}>{productCopy.delivery.previewPackage}</button></div>
  </section></div>;
}

export function DeliveryDialog({
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
        <p className="kicker">{productCopy.delivery.guided}</p>
        <h2 id="delivery-dialog-title">{state.status === "uncertain" ? productCopy.delivery.needsVerification : productCopy.delivery.confirmPackage}</h2>
        {state.status === "uncertain" ? <>
          <div className="form-error" role="alert">{state.message}</div>
          <p className="dialog-intro">Do not run delivery again automatically. Close this message, refresh Delivery, and verify the result before trying again.</p>
          <div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div>
        </> : <>
          <p className="dialog-intro">{state.preview.replacementMode === "overwrite" ? "Rebuild" : "Create"} the final-delivery package for <strong>{state.preview.projectName}</strong>. Each copied file will be verified with SHA-256 before the project’s delivery status is updated.</p>
          <dl className="confirmation-list">
            <div><dt>{productCopy.delivery.approvedRevision}</dt><dd>Revision {state.preview.approvedRevision}</dd></div>
            <div><dt>{productCopy.common.currentRevision}</dt><dd>Revision {state.preview.currentRevision}</dd></div>
            <div><dt>{productCopy.delivery.deliveryMethod}</dt><dd>{state.preview.deliveryMethod}</dd></div>
            <div><dt>{productCopy.delivery.files}</dt><dd>{state.preview.selected.length}</dd></div>
            <div><dt>{productCopy.delivery.replacementMode}</dt><dd>{state.preview.replacementMode === "clean" ? productCopy.delivery.cleanModeSummary : state.preview.replacementMode === "overwrite" ? productCopy.delivery.overwriteModeShort : productCopy.delivery.firstPackageSummary}</dd></div>
            <div><dt>{productCopy.delivery.zip}</dt><dd>{state.preview.createZip ? `${state.preview.projectId}-rev-${String(state.preview.approvedRevision).padStart(2, "0")}-YYYYMMDDHHMMSS.zip` : productCopy.delivery.zipNotCreated}</dd></div>
          </dl>
          <div className="table-scroll"><table><thead><tr><th>{productCopy.delivery.source}</th><th>{productCopy.delivery.type}</th><th>{productCopy.delivery.destination}</th></tr></thead><tbody>{state.preview.selected.map((file) => <tr key={`${file.sourceName}:${file.path}`}><td>{file.sourceName}</td><td>{file.deliverableType.replace(/_/g, " ")}</td><td><code>{file.path}</code></td></tr>)}</tbody></table></div>
          {state.preview.excluded.length > 0 && <section className="route-note"><strong>{productCopy.delivery.notIncluded}</strong><span>{state.preview.excluded.map((file) => `${file.name} (${file.reason})`).join(", ")}</span></section>}
          {state.preview.replacementMode === "clean" && <section className="panel"><h3>{productCopy.delivery.deleteItems}</h3><ul className="plain-list">{state.preview.deletions.map((path) => <li key={path}><code>{path}</code></li>)}</ul><label className="field"><span>Type <strong>{cleanPhrase}</strong> to authorize this destructive replacement</span><input aria-label={productCopy.delivery.cleanConfirmationLabel} value={cleanConfirmation} onChange={(event) => setCleanConfirmation(event.target.value)} autoComplete="off" /></label></section>}
          <div className="notice warning" role="status"><strong>{productCopy.delivery.whatWillChange}</strong><span>This {state.preview.replacementMode === "clean" ? "deletes every item listed above, then rebuilds" : state.preview.replacementMode === "overwrite" ? "rebuilds" : "creates"} the files in 05_Final_Delivery and marks Revision {state.preview.approvedRevision} as delivered.{state.preview.replacementMode === "overwrite" ? " Edited Delivery Notes and unrelated files are preserved." : state.preview.replacementMode === "clean" ? " Delivery Notes are recreated from the standard template." : ""} Custom filters are not enabled.</span></div>
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending || (state.preview.replacementMode === "clean" && cleanConfirmation !== cleanPhrase)}>{pending ? productCopy.delivery.creating : state.preview.replacementMode === "clean" ? productCopy.delivery.cleanAndRebuild : state.preview.replacementMode === "overwrite" ? productCopy.delivery.rebuildDelivery : productCopy.delivery.createDelivery}</button></div>
        </>}
      </section>
    </div>
  );
}

export function RevisionDialog({
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
        <p className="kicker">{productCopy.revision.guided}</p>
        <h2 id="revision-dialog-title">
          {state.status === "confirming" || state.status === "creating"
            ? productCopy.revision.confirmTitle
            : state.status === "uncertain"
              ? productCopy.revision.verificationTitle
              : productCopy.revision.newTitle}
        </h2>
        {(state.status === "editing" || state.status === "preflighting") && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">{productCopy.revision.introPrefix} <strong>{project.projectName}</strong>. {productCopy.revision.introSuffix}</p>
            {state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}
            <label>
              {productCopy.revision.description} <span>{productCopy.revision.optional}</span>
              <input ref={descriptionInput} name="revisionDescription" value={values.description} onChange={(event) => onChange({ description: event.target.value })} placeholder={`Revision ${project.currentRevision + 1}`} autoComplete="off" disabled={pending} />
              <small>{productCopy.revision.descriptionHelp}</small>
            </label>
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="submit" disabled={pending} aria-busy={pending}>{pending ? productCopy.common.checking : productCopy.revision.review}</button></div>
          </form>
        )}
        {(state.status === "confirming" || state.status === "creating") && (
          <div>
            <p className="dialog-intro">{productCopy.revision.confirmationIntro}</p>
            <dl className="confirmation-list">
              <div><dt>{productCopy.common.project}</dt><dd>{project.projectName}</dd></div>
              <div><dt>{productCopy.common.currentRevision}</dt><dd>Revision {project.currentRevision}</dd></div>
              <div><dt>{productCopy.revision.newRevision}</dt><dd>Revision {state.preview.number}</dd></div>
              <div><dt>{productCopy.revision.descriptionLabel}</dt><dd>{state.preview.description}</dd></div>
            </dl>
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>{productCopy.common.back}</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? productCopy.revision.creating : productCopy.revision.create}</button></div>
          </div>
        )}
        {state.status === "uncertain" && (
          <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">{productCopy.revision.uncertainHelp}</p><div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div></div>
        )}
      </section>
    </div>
  );
}

export function ApprovalDialog({
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
        <p className="kicker">{productCopy.approval.guided}</p>
        <h2 id="approval-dialog-title">
          {state.status === "confirming" || state.status === "approving"
            ? productCopy.approval.confirmTitle
            : state.status === "uncertain"
              ? productCopy.approval.verificationTitle
              : `${productCopy.approval.approvePrefix} ${state.revision.number}`}
        </h2>
        {(state.status === "editing" || state.status === "preflighting") && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">{productCopy.approval.introPrefix} <strong>Revision {state.revision.number}</strong> {productCopy.approval.introConnector} <strong>{project.projectName}</strong>. {productCopy.approval.introSuffix}</p>
            {state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}
            <label>
              {productCopy.approval.approvedBy}
              <input ref={approverInput} name="approvedBy" value={values.approvedBy} onChange={(event) => onChange({ approvedBy: event.target.value })} autoComplete="name" disabled={pending} />
              <small>{productCopy.approval.approvedByHelp}</small>
            </label>
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="submit" disabled={pending} aria-busy={pending}>{pending ? productCopy.common.checking : productCopy.approval.review}</button></div>
          </form>
        )}
        {(state.status === "confirming" || state.status === "approving") && (
          <div>
            <p className="dialog-intro">{productCopy.approval.confirmationIntro}</p>
            <dl className="confirmation-list">
              <div><dt>{productCopy.common.project}</dt><dd>{project.projectName}</dd></div>
              <div><dt>{productCopy.approval.selectedRevision}</dt><dd>Revision {state.preview.revision}</dd></div>
              <div><dt>{productCopy.approval.currentApprovedRevision}</dt><dd>{project.approvedRevision === null ? productCopy.approval.none : `Revision ${project.approvedRevision}`}</dd></div>
              <div><dt>{productCopy.approval.approvedBy}</dt><dd>{state.preview.approvedBy}</dd></div>
              <div><dt>{productCopy.approval.approvalTime}</dt><dd>{productCopy.approval.currentTimeAtExecution}</dd></div>
            </dl>
            {(replacingHistoricalApproval || olderThanCurrent || deliveryWillDiffer) && <div className="notice warning" role="status"><strong>{productCopy.approval.checkChanges}</strong><span>{[
              replacingHistoricalApproval ? `${productCopy.projects.revisionPrefix} ${state.revision.number} ${productCopy.approval.existingApprovalSuffix}` : null,
              olderThanCurrent ? `${productCopy.projects.revisionPrefix} ${state.revision.number} ${productCopy.approval.olderThanCurrentConnector} ${productCopy.projects.revisionPrefix} ${project.currentRevision}.` : null,
              deliveryWillDiffer ? `${productCopy.approval.deliveryRemainsPrefix} ${productCopy.projects.revisionPrefix} ${project.deliveredRevision}.` : null,
            ].filter(Boolean).join(" ")}</span></div>}
            <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>{productCopy.common.back}</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? productCopy.approval.approving : productCopy.approval.approve}</button></div>
          </div>
        )}
        {state.status === "uncertain" && (
          <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">{productCopy.approval.uncertainHelp}</p><div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div></div>
        )}
      </section>
    </div>
  );
}

export function IntakeDialog({
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
        {state.status === "uncertain" ? <><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">Do not run intake validation again automatically. Close this message, refresh Intake, and verify the report before trying again.</p><div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div></> : <>
          <p className="dialog-intro">The preview below did not change the project. Confirm to update only the generated section of <code>00_Admin/Intake_Report.md</code>. Your intake source files will not be changed.</p>
          <IntakeReportContent report={state.preview} compact />
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Updating report…" : "Update intake report"}</button></div>
        </>}
      </section>
    </div>
  );
}

export function StudioRoute({ workspace, version, loading, setupAvailable, setupHelp, onSetup, onRefresh }: {
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
      <div className="planned-banner"><div><span className="status-pill warning">{unavailable ? "Not configured" : "Recovery required"}</span><h2 id="studio-state-heading">{unavailable ? "Create the default studio workspace" : "Studio configuration is not readable"}</h2><p>{unavailable ? "Use guided setup to create your studio workspace at ~/Music/Mixes." : "Check the setup issues below before making changes."}</p></div><button type="button" onClick={onSetup} disabled={!setupAvailable || loading} aria-describedby="studio-setup-help">New studio</button></div>
      <p id="studio-setup-help" className="action-help">{setupHelp}</p>
      {snapshot.issues.length > 0 && <RouteIssues snapshot={snapshot} />}
    </section>;
  }
  const studio = snapshot.studio;
  return <section className="planned-route" aria-labelledby="studio-details-heading">
    <div className="panel-heading"><div><p className="kicker">Your studio</p><h2 id="studio-details-heading">{studio.studioName}</h2></div><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>Refresh</button></div>
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

export function StudioDialog({ state, values, onChange, onPreflight, onConfirm, onBack, onClose }: {
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
    {(state.status === "editing" || state.status === "preflighting") && <form onSubmit={onPreflight} noValidate><p className="dialog-intro">Creates your studio workspace at <code>~/Music/Mixes</code>. This setup uses the standard location.</p>{state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}<label>Studio name<input aria-label="Studio name" value={values.studioName} onChange={(e) => onChange({...values, studioName:e.target.value})} required disabled={pending}/></label><label>Mix engineer <span>(optional)</span><input aria-label="Mix engineer" value={values.mixEngineer} onChange={(e) => onChange({...values, mixEngineer:e.target.value})} disabled={pending}/></label><label>Sample rate<select aria-label="Sample rate" value={values.sampleRate} onChange={(e) => onChange({...values, sampleRate:e.target.value})} disabled={pending}>{[44100,48000,88200,96000,176400,192000].map(v=><option key={v} value={v}>{v.toLocaleString()} Hz</option>)}</select></label><label>Bit depth<select aria-label="Bit depth" value={values.bitDepth} onChange={(e) => onChange({...values, bitDepth:e.target.value})} disabled={pending}>{[16,24,32].map(v=><option key={v} value={v}>{v}-bit</option>)}</select></label><label>File format<select aria-label="File format" value={values.fileFormat} onChange={(e) => onChange({...values, fileFormat:e.target.value})} disabled={pending}><option>WAV</option><option>AIFF</option></select></label><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Checking…" : "Review studio"}</button></div></form>}
    {(state.status === "confirming" || state.status === "creating") && <div><p className="dialog-intro">Nothing has been created yet. Confirm to create your studio workspace at the standard location.</p><dl className="confirmation-list"><div><dt>Studio</dt><dd>{state.preview.studioName}</dd></div><div><dt>Engineer</dt><dd>{state.preview.mixEngineer ?? "Not set"}</dd></div><div><dt>Audio</dt><dd>{state.preview.sampleRate.toLocaleString()} Hz · {state.preview.bitDepth}-bit {state.preview.fileFormat}</dd></div><div><dt>Location</dt><dd><code>~/Music/Mixes</code></dd></div></dl><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>Back</button><button type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? "Creating…" : "Create studio"}</button></div></div>}
    {state.status === "uncertain" && <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">Do not create the studio again automatically. Close this message, refresh Studio, and verify the workspace before trying again.</p><div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div></div>}
  </section></div>;
}

export function SettingsRoute({ preferences, onChange, workspace, version }: { preferences: AppPreferences; onChange: (value: AppPreferences) => void; workspace: ResourceState<WorkspaceSnapshot>; version: ResourceState<VersionCheck> }) {
  const update = (value: AppPreferences) => {
    localStorage.setItem("jl-mixing-studio.preferences", JSON.stringify(value));
    onChange(value);
  };
  return <section className="planned-route" aria-labelledby="settings-heading"><div className="panel-heading"><div><p className="kicker">Studio preferences</p><h2 id="settings-heading">Settings</h2></div></div>
    <div className="project-detail-grid"><section className="panel"><h3>Appearance</h3><label className="setting-row"><span><strong>Compact layout</strong><small>Reduce spacing in the application shell and data panels.</small></span><input type="checkbox" checked={preferences.compactLayout} onChange={(event) => update({...preferences, compactLayout:event.target.checked})} /></label><label className="setting-row"><span><strong>Reduce motion</strong><small>Disable interface scrolling and transition animation.</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => update({...preferences, reduceMotion:event.target.checked})} /></label></section>
      <section className="panel"><h3>Read-only diagnostics</h3><dl className="metadata-list"><div><dt>Workspace</dt><dd>{workspace.status === "ready" ? <code>{workspace.value.workspacePath}</code> : workspace.status}</dd></div><div><dt>Workspace status</dt><dd>{workspace.status === "ready" ? workspace.value.status : "Unavailable"}</dd></div><div><dt>Automation</dt><dd>{version.status === "ready" ? version.value.message : "Check unavailable"}</dd></div><div><dt>Supported contract</dt><dd>JL Mixing Automation 1.3.1</dd></div></dl></section></div>
    <aside className="route-note"><strong>Settings boundary</strong><span>These preferences are local to JL Mixing Studio. They do not edit <code>studio.json</code>, client or project metadata, delivery defaults, or JL Mixing Automation.</span></aside>
  </section>;
}

export interface ClientDialogProps {
  state: Exclude<ClientWorkflowState, { status: "closed" }>;
  values: ClientFormValues;
  onChange: (values: ClientFormValues) => void;
  onPreflight: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function ClientDialog({
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
              <button type="button" onClick={onClose}>{productCopy.common.close}</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export interface ProjectDialogProps {
  state: Exclude<ProjectWorkflowState, { status: "closed" }>;
  values: ProjectFormValues;
  clients: ClientSummary[];
  onChange: (values: ProjectFormValues) => void;
  onPreflight: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function ProjectDialog({
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
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button>
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
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button>
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
            <div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
