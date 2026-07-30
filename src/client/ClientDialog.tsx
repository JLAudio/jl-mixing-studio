import { type FormEvent, useEffect, useRef } from "react";
import type { ClientFormValues, ClientWorkflowState } from "../AppWorkflowModels";
import { copy as productCopy } from "../resources/copy";

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
