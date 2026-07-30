import { type FormEvent, useEffect, useRef } from "react";
import type { ProjectSummary } from "../types";
import type { ApprovalFormValues, ApprovalWorkflowState } from "../AppWorkflowModels";
import { copy as productCopy } from "../resources/copy";

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
