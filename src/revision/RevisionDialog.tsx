import { type FormEvent, useEffect, useRef } from "react";
import type { ProjectSummary } from "../types";
import type { RevisionFormValues, RevisionWorkflowState } from "../AppWorkflowModels";
import { copy as productCopy } from "../resources/copy";

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
