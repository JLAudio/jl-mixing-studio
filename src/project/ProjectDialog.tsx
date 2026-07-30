import { type FormEvent, useEffect, useRef } from "react";
import type { ClientSummary } from "../types";
import type { ProjectFormValues, ProjectWorkflowState } from "../AppWorkflowModels";
import { copy as productCopy } from "../resources/copy";

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
