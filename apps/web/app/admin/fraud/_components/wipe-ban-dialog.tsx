'use client';

import { useState, useId } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { initiateFraudWipeBan } from '../actions';

/**
 * Wipe + Ban INITIATION dialog (anti-fraud § 5). The irreversible action is
 * NEVER performed directly — this opens a two-admin approval request. The dialog
 * carries a TYPED-CONFIRMATION guard (retype the exact business name) so a
 * mis-click can't even open the request, mirroring the "type to confirm"
 * destructive-action pattern.
 *
 * On submit it calls `initiateFraudWipeBan`, which validates the typed name
 * server-side too and creates the pending admin_approval_requests row. A
 * DIFFERENT admin then confirms it in /admin/approvals.
 */
export function WipeBanDialog({
  vendorProfileId,
  businessName,
}: {
  vendorProfileId: string;
  businessName: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const matches = typed.trim() === businessName.trim() && businessName.trim().length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-terracotta/50 bg-white px-3 py-1.5 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50"
      >
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        Confirm fraud → wipe + ban
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="m-card w-full max-w-lg overflow-hidden p-0">
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-terracotta-50/50 px-5 py-4">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-700" aria-hidden="true" />
                <div>
                  <h2 id={titleId} className="text-base font-bold text-ink">
                    Wipe + permanently ban this vendor?
                  </h2>
                  <p className="mt-0.5 text-xs text-ink/60">
                    Irreversible. Requires a SECOND admin to confirm.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form action={initiateFraudWipeBan} className="space-y-4 px-5 py-4">
              <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />

              <div className="space-y-2 rounded-lg bg-terracotta-50/40 p-3 text-xs text-ink/75">
                <p>Confirming will, once a second admin approves:</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Void every review + booking this vendor accrued (removed from all public stats).</li>
                  <li>Permanently ban + tombstone the account, hide it from the marketplace.</li>
                  <li>Open a help-center appeal ticket the vendor can respond to.</li>
                </ul>
                <p className="font-semibold text-terracotta-700">
                  This does NOT execute now — it opens a two-admin request. A different admin must confirm.
                </p>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">Why (rationale — recorded in the audit trail)</span>
                <textarea
                  name="rationale"
                  required
                  minLength={3}
                  rows={2}
                  placeholder="What the investigation found…"
                  className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink">
                  Type the business name to confirm:{' '}
                  <span className="font-mono text-terracotta-700">{businessName}</span>
                </span>
                <input
                  type="text"
                  name="confirm_name"
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={businessName}
                  className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-ink/5"
                >
                  Cancel
                </button>
                <SubmitButton
                  pendingLabel="Opening request…"
                  disabled={!matches}
                  className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-terracotta-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Open two-admin wipe + ban request
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
