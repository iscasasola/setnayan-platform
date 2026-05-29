'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Banknote, HandCoins, Check, X } from 'lucide-react';
import {
  acceptManpowerGig,
  completeGig,
  cancelGig,
  type ManpowerGigRow,
} from '../actions';

/**
 * V2 Phase F · GigCard
 *
 * Renders a single manpower gig in one of three modes:
 *   - open      → vendor can accept (2-token handshake)
 *   - accepted  → vendor can mark complete or cancel
 *   - wrapped   → read-only display
 *
 * The accept CTA shows an insufficient-tokens fallback banner when the
 * vendor wallet < 2. Polite brand voice — surfaces a deep link to the
 * redeem-code page where the vendor can top up.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] copy is brand-voice
 * editorial register. No engineering jargon · no "ERROR" strings.
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
  insufficientTokens = false,
}: {
  gig: ManpowerGigRow;
  mode: Mode;
  statusLabel: string;
  statusStyle: string;
  insufficientTokens?: boolean;
}) {
  const [banner, setBanner] = useState<
    | { kind: 'success'; msg: string }
    | { kind: 'error'; msg: string }
    | { kind: 'cancel-form' }
    | null
  >(null);
  const [cancelReason, setCancelReason] = useState('');
  const [pending, startTransition] = useTransition();

  function handleAccept() {
    setBanner(null);
    startTransition(async () => {
      const result = await acceptManpowerGig(gig.gig_id);
      if (result.status === 'ok') {
        setBanner({
          kind: 'success',
          msg: 'Gig accepted · 2 tokens spent. The host will be notified.',
        });
      } else if (result.status === 'insufficient_tokens') {
        setBanner({ kind: 'error', msg: result.message });
      } else if (result.status === 'already_claimed') {
        setBanner({
          kind: 'error',
          msg: 'Another vendor already claimed this gig.',
        });
      } else if (result.status === 'race_lost') {
        setBanner({
          kind: 'error',
          msg: 'Another vendor claimed this gig at the same moment. Your tokens were spent · please contact support if you believe this is in error.',
        });
      } else if (result.status === 'no_vendor_profile') {
        setBanner({
          kind: 'error',
          msg: 'Finish vendor verification before claiming gigs.',
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
      const result = await completeGig(gig.gig_id);
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
      const result = await cancelGig(gig.gig_id, cancelReason.trim());
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
    <article
      className="rounded-lg border border-slate-200/60 bg-white p-4"
      style={{ boxShadow: 'var(--m-shadow-sm)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{gig.gig_label}</p>
          <p className="mt-1 text-sm text-slate-600">
            <Banknote
              className="-mt-0.5 mr-1 inline-block h-4 w-4 text-slate-500"
              strokeWidth={1.75}
            />
            {formatPhp(gig.cash_amount_php_centavos)} · paid to your crew direct
          </p>
          {mode !== 'open' ? (
            <p className="mt-1 text-xs text-slate-500">
              Accepted {formatRelative(gig.accepted_at) ?? '—'}
              {gig.completed_at
                ? ` · Wrapped ${formatRelative(gig.completed_at) ?? ''}`
                : null}
            </p>
          ) : null}
          {gig.notes ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {gig.notes}
            </p>
          ) : null}
          {gig.cancellation_reason ? (
            <p className="mt-2 text-sm text-rose-700">
              Cancellation reason: {gig.cancellation_reason}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs ring-1 ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>

      {banner ? (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            banner.kind === 'error'
              ? 'border border-rose-300/50 bg-rose-50 text-rose-900'
              : 'border border-emerald-300/50 bg-emerald-50 text-emerald-900'
          }`}
        >
          {'msg' in banner ? banner.msg : null}
        </div>
      ) : null}

      {mode === 'open' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {insufficientTokens ? (
            <div
              role="alert"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <span>
                You need 2 tokens to accept. Top up to claim this gig.
              </span>
              <Link
                href="/vendor-dashboard/redeem-code"
                className="text-xs font-medium text-amber-800 underline"
              >
                Redeem code →
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAccept}
              disabled={pending}
              className="m-btn inline-flex items-center gap-1.5 disabled:opacity-60"
              style={{
                background: 'var(--m-orange)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 'var(--m-radius-md)',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <HandCoins className="h-4 w-4" strokeWidth={1.75} />
              {pending ? 'Accepting…' : 'Accept · 2 tokens'}
            </button>
          )}
        </div>
      ) : null}

      {mode === 'accepted' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleComplete}
            disabled={pending}
            className="m-btn inline-flex items-center gap-1.5 disabled:opacity-60"
            style={{
              background: 'var(--m-orange)',
              color: 'white',
              padding: '8px 14px',
              borderRadius: 'var(--m-radius-md)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
            Mark wrapped
          </button>

          {banner?.kind === 'cancel-form' ? (
            <div className="flex w-full flex-wrap items-end gap-2 rounded-md border border-slate-200/60 bg-slate-50 p-3">
              <label className="flex-1 min-w-[180px]">
                <span
                  className="m-label-mono mb-1 block uppercase text-slate-500"
                  style={{ letterSpacing: '0.2em', fontSize: '11px' }}
                >
                  Reason
                </span>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling?"
                  minLength={4}
                  maxLength={500}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={handleCancel}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                Confirm cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setBanner(null);
                  setCancelReason('');
                }}
                className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close cancel form"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBanner({ kind: 'cancel-form' })}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel gig
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}
