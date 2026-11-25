'use client';

/**
 * A7-27 (final check 25 Nov): "Save costs" and "Save crew" were bare `<form action={updateVendorCosts}>`. The action
 * throws on a refused write or quote read, and with no error boundary under the event the whole screen was replaced by
 * the root error page. This form calls the SAME action (no new server action) and keeps the row on screen with the
 * house failure line (HOUSE F4). A redirect (signed out) still goes through: `unstable_rethrow` re-throws Next's own
 * control errors, the same as the guest reply form.
 */
import { useState, type ReactNode } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { updateVendorCosts } from '../../../actions';

export const COSTS_NOT_SAVED = 'That did not save. Nothing changed — please try again.';

export function CostsForm({ className, children }: { className?: string; children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return (
    <form
      className={className}
      action={async (formData) => {
        setFailed(false);
        try {
          await updateVendorCosts(formData);
        } catch (err) {
          unstable_rethrow(err);
          setFailed(true);
        }
      }}
    >
      {children}
      {failed ? (
        <p role="alert" className="text-sm font-medium text-ink" data-costs-not-saved="">
          {COSTS_NOT_SAVED}
        </p>
      ) : null}
    </form>
  );
}
