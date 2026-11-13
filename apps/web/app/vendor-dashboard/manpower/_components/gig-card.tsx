'use client';

import { useState, useTransition } from 'react';
import { Banknote, HandCoins, Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_MONEY, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import {
  acceptManpowerGig,
  completeGig,
  cancelGig,
  type ManpowerGigRow,
} from '../actions';
import { useSaveLoader } from '@/components/sd-loader';

/**
 * V2 Phase F · GigCard
 *
 * Renders a single manpower gig in one of three modes:
 *   - open      → vendor can accept (free · token retirement 2026-07-22)
 *   - accepted  → vendor can mark complete or cancel
 *   - wrapped   → read-only display
 *
 * Accepting a gig is free — there is no wallet gate. Per
 * [[feedback_setnayan_no_dev_text_post_launch]] copy is brand-voice editorial
 * register. No engineering jargon · no "ERROR" strings.
 */

type Mode = 'open' | 'accepted' | 'wrapped';

function formatPhp(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  })}`;
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-PH', {
      // 🕐 Manila, not the server's UTC (walk 13 Nov 2026, F-W1-61) — the same wall clock on the server and the phone.
      timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function GigCard({
  gig,
  mode,
  statusLabel,
  statusStyle,
}: {
  gig: ManpowerGigRow;
  mode: Mode;
  statusLabel: string;
  statusStyle: string;
}) {
  const [banner, setBanner] = useState<
    | { kind: 'success'; msg: string }
    | { kind: 'error'; msg: string }
    | { kind: 'cancel-form' }
    | null
  >(null);
  const [cancelReason, setCancelReason] = useState('');
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();

  function handleAccept() {
    setBanner(null);
    startTransition(async () => {
      const result = await save.run(() => acceptManpowerGig(gig.gig_id), {
        steps: ['Accepting the gig'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setBanner({
          kind: 'success',
          msg: 'Gig accepted. The host will be notified.',
        });
      } else if (result.status === 'already_claimed') {
        setBanner({
          kind: 'error',
          msg: 'Another supplier already claimed this gig.',
        });
      } else if (result.status === 'race_lost') {
        setBanner({
          kind: 'error',
          msg: 'Another supplier claimed this gig at the same moment. Try another open gig.',
        });
      } else if (result.status === 'no_vendor_profile') {
        setBanner({
          kind: 'error',
          msg: 'Finish supplier verification before claiming gigs.',
        });
      } else {
        setBanner({
          kind: 'error',
          msg: 'message' in result ? result.message : 'Could not accept this gig.',
        });
      }
    });
  }

  function handleComplete() {
    setBanner(null);
    startTransition(async () => {
      const result = await save.run(() => completeGig(gig.gig_id), {
        steps: ['Marking complete'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setBanner({ kind: 'success', msg: 'Marked as wrapped.' });
      } else {
        setBanner({
          kind: 'error',
          msg: 'message' in result ? result.message : 'Could not mark complete.',
        });
      }
    });
  }

  function handleCancel() {
    setBanner(null);
    if (cancelReason.trim().length < 4) {
      setBanner({ kind: 'error', msg: 'Add a short cancellation reason.' });
      return;
    }
    startTransition(async () => {
      const result = await save.run(() => cancelGig(gig.gig_id, cancelReason.trim()), {
        steps: ['Cancelling the gig'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setBanner({ kind: 'success', msg: 'Cancelled.' });
      } else {
        setBanner({
          kind: 'error',
          msg: 'message' in result ? result.message : 'Could not cancel.',
        });
      }
    });
  }

  return (
    <article className="border-t border-[color:var(--m-line)] py-3 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{gig.gig_label}</p>
          <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>
            <Banknote
              aria-hidden
              className="-mt-0.5 mr-1 inline-block h-4 w-4"
              strokeWidth={1.75}
            />
            <span className={TEMPLATE_MONEY}>{formatPhp(gig.cash_amount_php_centavos)}</span> · paid to your crew direct
          </p>
          {mode !== 'open' ? (
            <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>
              Accepted {formatRelative(gig.accepted_at) ?? '—'}
              {gig.completed_at
                ? ` · Wrapped ${formatRelative(gig.completed_at) ?? ''}`
                : null}
            </p>
          ) : null}
          {gig.notes ? (
            <p className={`mt-2 whitespace-pre-line ${TEMPLATE_SUBLINE}`}>
              {gig.notes}
            </p>
          ) : null}
          {gig.cancellation_reason ? (
            <p className="mt-2 text-[14px]" style={{ color: 'rgb(var(--color-danger))' }}>
              Cancellation reason: {gig.cancellation_reason}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[13px] ring-1 ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>

      {banner && 'msg' in banner ? (
        <p
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className="mt-2 text-[14px] font-semibold"
          style={{ color: banner.kind === 'error' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-ok))' }}
        >
          {banner.msg}
        </p>
      ) : null}

      {mode === 'open' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton
            tone="brand"
            icon={HandCoins}
            label={pending ? 'Accepting…' : 'Accept gig'}
            waiting={pending}
            onClick={handleAccept}
          />
        </div>
      ) : null}

      {mode === 'accepted' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton
            tone="ok"
            icon={Check}
            label={pending ? 'Wrapping…' : 'Mark wrapped'}
            waiting={pending}
            onClick={handleComplete}
          />

          {banner?.kind === 'cancel-form' ? (
            <div className="flex w-full flex-wrap items-end gap-2 rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] p-3">
              <label className="min-w-[180px] flex-1">
                <span className={`mb-1 block ${TEMPLATE_SUBLINE}`}>Reason</span>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling?"
                  minLength={4}
                  maxLength={500}
                  className="min-h-11 w-full rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] text-ink placeholder:text-[color:var(--m-slate-2)] focus:border-mulberry focus:outline-none" // no-card-ok: the reason input's own outline
                />
              </label>
              <ActionButton
                tone="danger"
                icon={X}
                label={pending ? 'Cancelling…' : 'Confirm cancel'}
                waiting={pending}
                onClick={handleCancel}
              />
              <ActionButton
                tone="neutral"
                quiet
                iconOnly
                icon={X}
                label="Close cancel form"
                onClick={() => {
                  setBanner(null);
                  setCancelReason('');
                }}
              />
            </div>
          ) : (
            <ActionButton
              tone="danger"
              icon={X}
              label="Cancel gig"
              onClick={() => setBanner({ kind: 'cancel-form' })}
            />
          )}
        </div>
      ) : null}
    </article>
  );
}
