import type { FormEvent } from "react";
import type { VersionCheck, WorkspaceSnapshot } from "../types";
import { FolderControl, RouteIssues, type ResourceState } from "../AppViews";
import { copy as productCopy } from "../resources/copy";
import type { StudioFormValues, StudioWorkflowState } from "../AppWorkflowModels";

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
