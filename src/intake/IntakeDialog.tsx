import { useEffect, useRef } from "react";
import { IntakeReportContent } from "../AppViews";
import type { IntakeWorkflowState } from "../AppWorkflowModels";
import { copy as productCopy } from "../resources/copy";

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
