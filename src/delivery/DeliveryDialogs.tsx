import { useEffect, useRef, useState } from "react";
import type { DeliveryCreationRequest } from "../types";
import type { DeliveryWorkflowState } from "../AppWorkflowModels";
import { copy as productCopy } from "../resources/copy";

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
