import { type FormEvent, useEffect, useRef } from "react";
import type {
  ClientSummary,
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
  IntakeWorkflowState,
  ProjectFormValues,
  ProjectWorkflowState,
  RevisionFormValues,
  RevisionWorkflowState,
  StudioFormValues,
  StudioWorkflowState,
} from "./AppWorkflowModels";

export { DeliveryDialog, DeliveryOptionsDialog } from "./delivery";

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
        <p className="kicker">{productCopy.intake.guided}</p>
        <h2 id="intake-dialog-title">{state.status === "uncertain" ? productCopy.intake.verificationTitle : productCopy.intake.confirmTitle}</h2>
        {state.status === "uncertain" ? <><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">{productCopy.intake.uncertainHelp}</p><div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div></> : <>
          <p className="dialog-intro">{productCopy.intake.previewIntroPrefix} <code>00_Admin/Intake_Report.md</code>. {productCopy.intake.previewIntroSuffix}</p>
          <IntakeReportContent report={state.preview} compact />
          <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? productCopy.intake.updating : productCopy.intake.update}</button></div>
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
  if (workspace.status === "loading") return <section className="state-panel"><h2>{productCopy.studio.readingWorkspace}</h2></section>;
  if (workspace.status === "error") return <section className="state-panel error"><h2>{productCopy.studio.workspaceUnavailable}</h2><p>{workspace.message}</p><button type="button" onClick={onRefresh}>{productCopy.studio.tryAgain}</button></section>;
  const snapshot = workspace.value;
  if (!snapshot.studio) {
    const unavailable = snapshot.status === "unavailable";
    return <section className="planned-route" aria-labelledby="studio-state-heading">
      <div className="planned-banner"><div><span className="status-pill warning">{unavailable ? productCopy.studio.notConfigured : productCopy.studio.recoveryRequired}</span><h2 id="studio-state-heading">{unavailable ? productCopy.studio.createDefaultWorkspace : productCopy.studio.configurationUnreadable}</h2><p>{unavailable ? <>{productCopy.studio.guidedSetupPrefix} ~/Music/Mixes.</> : productCopy.studio.checkSetupIssues}</p></div><button type="button" onClick={onSetup} disabled={!setupAvailable || loading} aria-describedby="studio-setup-help">{productCopy.studio.newStudio}</button></div>
      <p id="studio-setup-help" className="action-help">{setupHelp}</p>
      {snapshot.issues.length > 0 && <RouteIssues snapshot={snapshot} />}
    </section>;
  }
  const studio = snapshot.studio;
  return <section className="planned-route" aria-labelledby="studio-details-heading">
    <div className="panel-heading"><div><p className="kicker">{productCopy.studio.yourStudio}</p><h2 id="studio-details-heading">{studio.studioName}</h2></div><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{productCopy.common.refresh}</button></div>
    <div className="planned-section-grid">
      <article className="planned-section"><h3>{productCopy.studio.identity}</h3><dl className="confirmation-list"><div><dt>{productCopy.studio.studioId}</dt><dd><code>{studio.studioId}</code></dd></div><div><dt>{productCopy.studio.mixEngineer}</dt><dd>{studio.mixEngineer || productCopy.common.notSet}</dd></div><div><dt>{productCopy.studio.created}</dt><dd>{studio.createdAt}</dd></div></dl></article>
      <article className="planned-section"><h3>{productCopy.studio.audioDefaults}</h3><dl className="confirmation-list"><div><dt>{productCopy.studio.sampleRate}</dt><dd>{studio.sampleRate.toLocaleString()} Hz</dd></div><div><dt>{productCopy.studio.bitDepth}</dt><dd>{studio.bitDepth}-bit</dd></div><div><dt>{productCopy.studio.format}</dt><dd>{studio.fileFormat}</dd></div></dl></article>
      <article className="planned-section"><h3>{productCopy.studio.deliveryDefaults}</h3><dl className="confirmation-list"><div><dt>{productCopy.studio.method}</dt><dd>{studio.deliveryMethod}</dd></div><div><dt>{productCopy.studio.deliverables}</dt><dd>{studio.requestedDeliverables.join(", ") || productCopy.studio.none}</dd></div></dl></article>
      <article className="planned-section"><h3>{productCopy.studio.workspaceTools}</h3><dl className="confirmation-list"><div><dt>{productCopy.studio.workspace}</dt><dd><code>{snapshot.workspacePath}</code></dd></div><div><dt>{productCopy.studio.configuredRoot}</dt><dd><code>{studio.rootPath}</code></dd></div><div><dt>{productCopy.studio.schema}</dt><dd>{studio.schemaVersion}</dd></div><div><dt>{productCopy.studio.createdWith}</dt><dd>{studio.createdWith}</dd></div><div><dt>{productCopy.studio.automation}</dt><dd>{version.status === "ready" ? version.value.message : productCopy.studio.checkUnavailable}</dd></div></dl></article>
    </div>
    <FolderControl location="workspace" label={productCopy.studio.openWorkspace} />
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
  return <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape" && !pending) onClose(); }}><section className="client-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-dialog-title"><p className="kicker">{productCopy.studio.guidedSetup}</p><h2 id="studio-dialog-title">{state.status === "confirming" || state.status === "creating" ? productCopy.studio.confirmNewStudio : state.status === "uncertain" ? productCopy.studio.creationVerification : productCopy.studio.newStudioTitle}</h2>
    {(state.status === "editing" || state.status === "preflighting") && <form onSubmit={onPreflight} noValidate><p className="dialog-intro">{productCopy.studio.createWorkspacePrefix} <code>~/Music/Mixes</code>. {productCopy.studio.standardLocationSuffix}</p>{state.status === "editing" && state.error && <div className="form-error" role="alert">{state.error}</div>}<label>{productCopy.studio.studioName}<input aria-label={productCopy.studio.studioName} value={values.studioName} onChange={(e) => onChange({...values, studioName:e.target.value})} required disabled={pending}/></label><label>{productCopy.studio.mixEngineer} <span>{productCopy.studio.optional}</span><input aria-label={productCopy.studio.mixEngineer} value={values.mixEngineer} onChange={(e) => onChange({...values, mixEngineer:e.target.value})} disabled={pending}/></label><label>{productCopy.studio.sampleRate}<select aria-label={productCopy.studio.sampleRate} value={values.sampleRate} onChange={(e) => onChange({...values, sampleRate:e.target.value})} disabled={pending}>{[44100,48000,88200,96000,176400,192000].map(v=><option key={v} value={v}>{v.toLocaleString()} Hz</option>)}</select></label><label>{productCopy.studio.bitDepth}<select aria-label={productCopy.studio.bitDepth} value={values.bitDepth} onChange={(e) => onChange({...values, bitDepth:e.target.value})} disabled={pending}>{[16,24,32].map(v=><option key={v} value={v}>{v}-bit</option>)}</select></label><label>{productCopy.studio.fileFormat}<select aria-label={productCopy.studio.fileFormat} value={values.fileFormat} onChange={(e) => onChange({...values, fileFormat:e.target.value})} disabled={pending}><option>WAV</option><option>AIFF</option></select></label><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="submit" disabled={pending} aria-busy={pending}>{pending ? productCopy.common.checking : productCopy.studio.reviewStudio}</button></div></form>}
    {(state.status === "confirming" || state.status === "creating") && <div><p className="dialog-intro">{productCopy.studio.confirmationIntro}</p><dl className="confirmation-list"><div><dt>{productCopy.studio.studioLabel}</dt><dd>{state.preview.studioName}</dd></div><div><dt>{productCopy.studio.engineer}</dt><dd>{state.preview.mixEngineer ?? productCopy.common.notSet}</dd></div><div><dt>{productCopy.studio.audio}</dt><dd>{state.preview.sampleRate.toLocaleString()} Hz · {state.preview.bitDepth}-bit {state.preview.fileFormat}</dd></div><div><dt>{productCopy.studio.location}</dt><dd><code>~/Music/Mixes</code></dd></div></dl><div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button><button type="button" className="secondary" onClick={onBack} disabled={pending}>{productCopy.common.back}</button><button type="button" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? productCopy.studio.creating : productCopy.studio.createStudio}</button></div></div>}
    {state.status === "uncertain" && <div><div className="form-error" role="alert">{state.message}</div><p className="dialog-intro">{productCopy.studio.uncertainHelp}</p><div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div></div>}
  </section></div>;
}

export function SettingsRoute({ preferences, onChange, workspace, version }: { preferences: AppPreferences; onChange: (value: AppPreferences) => void; workspace: ResourceState<WorkspaceSnapshot>; version: ResourceState<VersionCheck> }) {
  const update = (value: AppPreferences) => {
    localStorage.setItem("jl-mixing-studio.preferences", JSON.stringify(value));
    onChange(value);
  };
  return <section className="planned-route" aria-labelledby="settings-heading"><div className="panel-heading"><div><p className="kicker">{productCopy.settings.kicker}</p><h2 id="settings-heading">{productCopy.settings.title}</h2></div></div>
    <div className="project-detail-grid"><section className="panel"><h3>{productCopy.settings.appearance}</h3><label className="setting-row"><span><strong>{productCopy.settings.compactLayout}</strong><small>{productCopy.settings.compactLayoutHelp}</small></span><input type="checkbox" checked={preferences.compactLayout} onChange={(event) => update({...preferences, compactLayout:event.target.checked})} /></label><label className="setting-row"><span><strong>{productCopy.settings.reduceMotion}</strong><small>{productCopy.settings.reduceMotionHelp}</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => update({...preferences, reduceMotion:event.target.checked})} /></label></section>
      <section className="panel"><h3>{productCopy.settings.diagnostics}</h3><dl className="metadata-list"><div><dt>{productCopy.settings.workspace}</dt><dd>{workspace.status === "ready" ? <code>{workspace.value.workspacePath}</code> : workspace.status}</dd></div><div><dt>{productCopy.settings.workspaceStatus}</dt><dd>{workspace.status === "ready" ? workspace.value.status : productCopy.settings.unavailable}</dd></div><div><dt>{productCopy.settings.automation}</dt><dd>{version.status === "ready" ? version.value.message : productCopy.settings.checkUnavailable}</dd></div><div><dt>{productCopy.settings.supportedContract}</dt><dd>JL Mixing Automation 1.3.1</dd></div></dl></section></div>
    <aside className="route-note"><strong>{productCopy.settings.boundary}</strong><span>{productCopy.settings.boundaryPrefix} <code>studio.json</code>, {productCopy.settings.boundarySuffix}</span></aside>
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
        <p className="kicker">{productCopy.clients.guidedSetup}</p>
        <h2 id="client-dialog-title">
          {state.status === "confirming" || state.status === "creating"
            ? productCopy.clients.confirmNewClient
            : state.status === "uncertain"
              ? productCopy.clients.creationVerification
              : productCopy.clients.newClient}
        </h2>

        {(state.status === "editing" || state.status === "preflighting") && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">{productCopy.clients.inheritDefaults}</p>
            {state.status === "editing" && state.error && (
              <div className="form-error" role="alert">{state.error}</div>
            )}
            <label>
              {productCopy.clients.clientId}
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
              <small>{productCopy.clients.clientIdHelp}</small>
            </label>
            <label>
              {productCopy.clients.displayName}
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
              {productCopy.clients.defaultArtist} <span>{productCopy.clients.optional}</span>
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
                {productCopy.common.cancel}
              </button>
              <button type="submit" disabled={pending}>
                {pending ? productCopy.common.checking : productCopy.clients.reviewClient}
              </button>
            </div>
          </form>
        )}

        {(state.status === "confirming" || state.status === "creating") && (
          <div>
            <p className="dialog-intro">{productCopy.clients.confirmationIntro}</p>
            <dl className="confirmation-list">
              <div><dt>{productCopy.clients.clientId}</dt><dd>{state.preview.clientId}</dd></div>
              <div><dt>{productCopy.clients.displayName}</dt><dd>{state.preview.clientName}</dd></div>
              <div><dt>{productCopy.clients.defaultArtist}</dt><dd>{state.preview.defaultArtist ?? productCopy.common.notSet}</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>
                {productCopy.common.cancel}
              </button>
              <button type="button" className="secondary" onClick={onBack} disabled={pending}>
                {productCopy.common.back}
              </button>
              <button
                ref={confirmButton}
                type="button"
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? productCopy.clients.creating : productCopy.clients.createClient}
              </button>
            </div>
          </div>
        )}

        {state.status === "uncertain" && (
          <div>
            <div className="form-error" role="alert">{state.message}</div>
            <p className="dialog-intro">{productCopy.clients.uncertainHelp}</p>
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
        <p className="kicker">{productCopy.projects.guidedSetup}</p>
        <h2 id="project-dialog-title">
          {state.status === "confirming" || state.status === "creating"
            ? productCopy.projects.confirmNewProject
            : state.status === "uncertain"
              ? productCopy.projects.creationVerification
              : productCopy.projects.newProject}
        </h2>

        {editing && (
          <form onSubmit={onPreflight} noValidate>
            <p className="dialog-intro">{productCopy.projects.inheritDefaults}</p>
            {state.status === "editing" && state.error && (
              <div className="form-error" role="alert">{state.error}</div>
            )}
            <label>
              {productCopy.projects.client}
              <select
                ref={clientSelect}
                aria-label={productCopy.projects.client}
                name="clientId"
                value={values.clientId}
                onChange={(event) => onChange({ ...values, clientId: event.target.value })}
                disabled={pending || lockedClientId !== null}
                required
              >
                <option value="">{productCopy.projects.selectClient}</option>
                {clients.map((client) => (
                  <option key={client.clientId} value={client.clientId}>{client.clientName}</option>
                ))}
              </select>
              {lockedClientId && <small>{productCopy.projects.currentClientHelp}</small>}
            </label>
            <label>
              {productCopy.projects.projectName}
              <input
                ref={projectNameInput}
                aria-label={productCopy.projects.projectName}
                name="projectName"
                value={values.projectName}
                onChange={(event) => onChange({ ...values, projectName: event.target.value })}
                placeholder="Blue Sky"
                autoComplete="off"
                disabled={pending}
                required
              />
              <small>{productCopy.projects.projectIdHelp}</small>
            </label>
            <label>
              {productCopy.projects.artist} <span>{productCopy.projects.optional}</span>
              <input
                name="artist"
                aria-label={productCopy.projects.artist}
                value={values.artist}
                onChange={(event) => onChange({ ...values, artist: event.target.value })}
                placeholder={productCopy.projects.useClientDefault}
                autoComplete="off"
                disabled={pending}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button>
              <button type="submit" disabled={pending}>{pending ? productCopy.common.checking : productCopy.projects.reviewProject}</button>
            </div>
          </form>
        )}

        {(state.status === "confirming" || state.status === "creating") && (
          <div>
            <p className="dialog-intro">{productCopy.projects.confirmationIntro}</p>
            <dl className="confirmation-list">
              <div><dt>{productCopy.projects.client}</dt><dd>{clients.find((client) => client.clientId === state.preview.clientId)?.clientName ?? state.preview.clientId}</dd></div>
              <div><dt>{productCopy.common.project}</dt><dd>{state.preview.projectName}</dd></div>
              <div><dt>{productCopy.projects.projectId}</dt><dd><code>{state.preview.projectId}</code></dd></div>
              <div><dt>{productCopy.projects.artist}</dt><dd>{state.preview.artist}</dd></div>
              <div><dt>{productCopy.projects.initialRevision}</dt><dd>Revision 1</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={onClose} disabled={pending}>{productCopy.common.cancel}</button>
              <button type="button" className="secondary" onClick={onBack} disabled={pending}>{productCopy.common.back}</button>
              <button ref={confirmButton} type="button" onClick={onConfirm} disabled={pending}>
                {pending ? productCopy.projects.creating : productCopy.projects.createProject}
              </button>
            </div>
          </div>
        )}

        {state.status === "uncertain" && (
          <div>
            <div className="form-error" role="alert">{state.message}</div>
            <p className="dialog-intro">{productCopy.projects.uncertainHelp}</p>
            <div className="dialog-actions"><button type="button" onClick={onClose}>{productCopy.common.close}</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
