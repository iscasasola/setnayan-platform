'use client';

/**
 * A7-27 (final check 25 Nov): "Save costs" and "Save crew" were bare `<form action={updateVendorCosts}>`. The action
 * throws on a refused write or quote read, and with no error boundary under the event the whole screen was replaced by
 * the root error page. This form calls the SAME action (no new server action) from `onSubmit` with `preventDefault` and
 * a transition — never as a form `action`, which React resets as "done" even after a caught failure — so on a failure
 * the typed values stay in the fields and the house line says so (HOUSE F4). A redirect (signed out) still goes
 * through: `unstable_rethrow` re-throws Next's own control errors, as the guest reply form does. The pending state is
 * handed to the form's button through `CostsFormPending` (SubmitButton's `pending`).
 */
import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { SubmitButton } from '@/app/_components/submit-button';
import { updateVendorCosts } from '../../../actions';

export const COSTS_NOT_SAVED = 'That did not save. Nothing changed — please try again.';

/** True while this form's save is running — read by its SubmitButton (`pending`), since `useFormStatus` sees no action. */
export const CostsFormPending = createContext(false);

export function CostsForm({ className, children }: { className?: string; children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFailed(false);
    start(async () => {
      try {
        await updateVendorCosts(formData);
        router.refresh();
      } catch (err) {
        unstable_rethrow(err);
        setFailed(true);
      }
    });
  };
  return (
    <form className={className} onSubmit={onSubmit} aria-busy={pending}>
      <CostsFormPending.Provider value={pending}>{children}</CostsFormPending.Provider>
      {failed ? (
        <p role="alert" className="text-sm font-medium text-ink" data-costs-not-saved="">
          {COSTS_NOT_SAVED}
        </p>
      ) : null}
    </form>
  );
}

/** The form's save button: the shared SubmitButton, told it is pending by the form (no form action to read). */
export function CostsSubmit({ className, children }: { className?: string; children: ReactNode }) {
  const pending = useContext(CostsFormPending);
  return (
    <SubmitButton pendingLabel="Saving…" pending={pending} className={className}>
      {children}
    </SubmitButton>
  );
}
