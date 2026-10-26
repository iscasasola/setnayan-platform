'use client';

/**
 * The two interactive bits of Integrity watch › Cards (approved prototype frames 2–3): the bulk-approve bar that
 * counts ticked rows, and the verdict panel (Approve · Ask to fix · Reject). Everything else on the tab is a server
 * component. The forms post to the server actions in `../card-actions.ts`, which re-check every rule — the
 * disabled states here are courtesy, not the fence.
 */
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { SubmitButton } from '@/app/_components/submit-button';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { approveServiceCard, askToFixServiceCard, bulkApproveServiceCards, rejectServiceCard } from '../card-actions';
import { REJECT_REASONS } from './cards-types';

export const BULK_FORM_ID = 'cards-bulk';

const BRAND = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold';
const brandOutline = { borderColor: 'var(--m-line)', background: 'var(--m-paper)' } as const;

export function BulkApproveBar() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const count = () =>
      setN(document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM_ID}"]:checked`).length);
    count();
    document.addEventListener('change', count);
    return () => document.removeEventListener('change', count);
  }, []);
  return (
    <form id={BULK_FORM_ID} action={bulkApproveServiceCards} className="flex items-center gap-3" data-cards-bulk="">
      <span className="text-[13px] text-ink/60">
        <span data-cards-selected="">{n}</span> selected
      </span>
      <SubmitButton
        disabled={n === 0}
        className={`${BRAND} text-sn-accent disabled:opacity-45`}
        pendingLabel="Approving…"
      >
        Approve selected
      </SubmitButton>
      <InfoTip label="" ariaLabel="About bulk approve" align="end">
        <span className="block">
          Bulk approve is for the obvious ones. A row can be ticked only when its sole reason is a claim word — a
          photo match, a price far outside the band and a wrong service each need the evidence opened.
        </span>
        <span className="mt-2 block">Each approve is written as its own audit row, the same as a single click.</span>
      </InfoTip>
    </form>
  );
}

export function VerdictPanel({ flagId, canApprove }: { flagId: number; canApprove: boolean }) {
  const [open, setOpen] = useState<'ask' | 'reject' | null>(null);
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  return (
    <div data-card-verdicts="">
      <div className="flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: 'var(--m-line)' }}>
        <form action={approveServiceCard}>
          <input type="hidden" name="flag_id" value={flagId} />
          <SubmitButton
            disabled={!canApprove}
            className={`${BRAND} border-transparent bg-sn-accent text-sn-on-accent disabled:opacity-45`}
            pendingLabel="Approving…"
          >
            <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} /> Approve · goes live
          </SubmitButton>
        </form>
        <button
          type="button"
          aria-expanded={open === 'ask'}
          onClick={() => setOpen((o) => (o === 'ask' ? null : 'ask'))}
          className={`${BRAND} sn-press text-sn-accent`}
          style={brandOutline}
        >
          Ask to fix
        </button>
        <button
          type="button"
          aria-expanded={open === 'reject'}
          onClick={() => setOpen((o) => (o === 'reject' ? null : 'reject'))}
          className={`${BRAND} sn-press`}
          style={{ ...brandOutline, color: 'rgb(var(--color-danger))' }}
        >
          Reject
        </button>
        <InfoTip label="" ariaLabel="What each verdict does" align="end">
          <span className="block"><b>Approve</b> — the card goes live now; the flag closes; the supplier gets an in-app notice.</span>
          <span className="mt-2 block">
            <b>Ask to fix</b> — your message reaches the supplier in-app; the card stays out of Explore; the row stays
            here until they resave. A resave that passes goes live by itself.
          </span>
          <span className="mt-2 block">
            <b>Reject</b> — the card stays out of Explore with your reason; the supplier can still edit it, but the next
            save comes back here instead of going live by itself.
          </span>
          <span className="mt-2 block">Every verdict writes one admin audit row.</span>
        </InfoTip>
      </div>

      {open === 'ask' ? (
        <form action={askToFixServiceCard} className="mt-4 border-t pt-4" style={{ borderColor: 'var(--m-line)' }}>
          <input type="hidden" name="flag_id" value={flagId} />
          <label htmlFor="card-ask" className="block text-sm font-semibold text-ink">Message to the supplier</label>
          <p className="mb-2 mt-0.5 text-[13px] text-ink/55">Plain words. They read it in-app on the card.</p>
          <textarea
            id="card-ask"
            name="message"
            required
            maxLength={800}
            rows={4}
            className="input-field w-full"
          />
          <div className="mt-3">
            <SubmitButton className={`${BRAND} border-transparent bg-sn-accent text-sn-on-accent`} pendingLabel="Sending…">
              Send · card stays held
            </SubmitButton>
          </div>
        </form>
      ) : null}

      {open === 'reject' ? (
        <form action={rejectServiceCard} className="mt-4 border-t pt-4" style={{ borderColor: 'var(--m-line)' }}>
          <input type="hidden" name="flag_id" value={flagId} />
          <input type="hidden" name="reason" value={reason} />
          <p className="mb-2 text-sm font-semibold text-ink">Reason</p>
          <PickMenu
            label="Reject reason"
            value={reason}
            options={REJECT_REASONS.map((r) => ({ key: r, label: r }))}
            onPick={(k) => setReason(k)}
          />
          {reason === REJECT_REASONS[REJECT_REASONS.length - 1] ? (
            <textarea name="words" required maxLength={500} rows={3} className="input-field mt-3 w-full" aria-label="Your reason" />
          ) : (
            <textarea name="words" maxLength={500} rows={2} className="input-field mt-3 w-full" aria-label="Anything to add (optional)" placeholder="Anything to add (optional)" />
          )}
          <p className="mt-2 text-[13px] text-ink/55">The supplier sees the reason on the card and in their notices. Nothing is deleted.</p>
          <div className="mt-3">
            <SubmitButton className={BRAND} pendingLabel="Rejecting…" style={{ borderColor: 'rgb(var(--color-danger))', color: 'rgb(var(--color-danger))', background: 'var(--m-paper)' }}>
              Reject · stays hidden
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
