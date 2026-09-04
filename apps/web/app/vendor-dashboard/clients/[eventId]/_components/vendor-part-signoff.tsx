'use client';

/**
 * MB12 · the SUPPLIER's side of the per-part finalization handshake, on the
 * read-only mood board they already open to align their styling.
 *
 * 🔑 IT LIVES ON THE MOOD BOARD, NOT ON THE ANSWERS DESK, AND THAT IS THE
 * POINT. The question is "will you build THIS?" — it cannot honestly be
 * answered from a list of rows. The palette, the reception design and the
 * inspiration photos are already on this page; the answer belongs beside them.
 * (The Answers Desk is where a supplier notices they have been asked; the
 * notification's `relatedUrl` points here, where they can actually look.)
 *
 * ⚠ AGREEING IS NOT REVERSIBLE FROM THIS SCREEN, AND THE COPY SAYS SO. Once
 * agreed the part is frozen for the couple too, and it re-opens only if the
 * couple asks and this supplier says yes. A button that quietly meant
 * "provisionally yes" would make the freeze a lie.
 */

import { useState, useTransition } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { lockRequestFuseLabel } from '@/lib/lock-request-state';

export type VendorSignoffRow = {
  finalizationId: string;
  partLabel: string;
  state: string;
  expiresAt: string | null;
  reopenState: string | null;
  reopenExpiresAt: string | null;
};

type Result = { status: string };

export function VendorPartSignoff({
  rows,
  agreeAction,
  declineAction,
  answerReopenAction,
}: {
  rows: readonly VendorSignoffRow[];
  agreeAction: (finalizationId: string) => Promise<Result>;
  declineAction: (finalizationId: string, reason: string) => Promise<Result>;
  answerReopenAction: (
    finalizationId: string,
    agree: boolean,
    reason: string,
  ) => Promise<Result>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const asks = rows.filter((r) => r.state === 'pending');
  const reopens = rows.filter((r) => r.state === 'agreed' && r.reopenState === 'pending');
  const settled = rows.filter((r) => r.state === 'agreed' && r.reopenState !== 'pending');

  if (rows.length === 0) return null;

  function run(id: string, fn: () => Promise<Result>) {
    setBusy(id);
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await fn();
        // 🔑 `expired` IS REPORTED, NOT SWALLOWED. The window lapses lazily, on
        // this very call — so the first a supplier can learn that they are too
        // late is when they press the button. A silent no-op would look exactly
        // like a successful answer.
        if (r.status === 'expired') {
          setMessage('That request had already run out of time. The couple can ask again.');
        } else if (r.status !== 'ok') {
          setMessage('Somebody already answered that one. Reload to see where it stands.');
        } else {
          setReasonFor(null);
          setReason('');
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <section className="sn-tile p-5 sm:p-6">
      <h2 className="mb-1 text-lg font-semibold">Sign-off</h2>
      <p className="mb-4 text-sm text-ink/55">
        The couple has asked you to agree to part of this design. Agreeing freezes it — they
        cannot change it afterwards without asking you first.
      </p>

      {message ? (
        <p
          role="status"
          className="mb-3 rounded-lg border border-warn-400/40 bg-warn-50 px-3 py-2 text-xs text-warn-900"
        >
          {message}
        </p>
      ) : null}

      <ul className="divide-y divide-ink/10">
        {asks.map((row) => (
          <li key={row.finalizationId} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="flex-1 text-sm font-medium text-ink">{row.partLabel}</span>
              <span className="text-[11px] text-warn-900">
                {lockRequestFuseLabel(row.expiresAt) ?? 'no deadline recorded'}
              </span>
              <button
                type="button"
                disabled={busy === row.finalizationId}
                onClick={() => run(row.finalizationId, () => agreeAction(row.finalizationId))}
                className="inline-flex items-center gap-1 rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-white hover:bg-terracotta-700 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                I&rsquo;ll build this
              </button>
              <button
                type="button"
                disabled={busy === row.finalizationId}
                onClick={() =>
                  setReasonFor(reasonFor === row.finalizationId ? null : row.finalizationId)
                }
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Not as designed
              </button>
            </div>
            {reasonFor === row.finalizationId ? (
              <div className="space-y-1.5 rounded-lg border border-ink/10 bg-cream/60 p-3">
                <label
                  className="block text-xs text-ink/70"
                  htmlFor={`reason-${row.finalizationId}`}
                >
                  Tell them why — they will see your words, and it is the only way they learn
                  what to change.
                </label>
                <textarea
                  id={`reason-${row.finalizationId}`}
                  value={reason}
                  maxLength={240}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-sm"
                  placeholder="We cannot source that shade of peony in November."
                />
                <button
                  type="button"
                  disabled={busy === row.finalizationId}
                  onClick={() =>
                    run(row.finalizationId, () => declineAction(row.finalizationId, reason))
                  }
                  className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            ) : null}
          </li>
        ))}

        {reopens.map((row) => (
          <li key={row.finalizationId} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="flex-1 text-sm font-medium text-ink">
                {row.partLabel}
                <span className="ml-2 font-normal text-ink/60">
                  — they want to change this after you agreed
                </span>
              </span>
              <span className="text-[11px] text-warn-900">
                {lockRequestFuseLabel(row.reopenExpiresAt) ?? 'no deadline recorded'}
              </span>
              <button
                type="button"
                disabled={busy === row.finalizationId}
                onClick={() =>
                  run(row.finalizationId, () =>
                    answerReopenAction(row.finalizationId, true, ''),
                  )
                }
                className="rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-white hover:bg-terracotta-700 disabled:opacity-50"
              >
                Go ahead, change it
              </button>
              <button
                type="button"
                disabled={busy === row.finalizationId}
                onClick={() =>
                  run(row.finalizationId, () =>
                    answerReopenAction(row.finalizationId, false, reason),
                  )
                }
                className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
              >
                Keep it as agreed
              </button>
            </div>
            {/* ⚠ IF NOBODY ANSWERS, THE PART STAYS AS AGREED. Said here rather
                than left to be discovered: silence is not consent in either
                direction, and a supplier who ignores this is not accidentally
                releasing work they planned around. */}
            <p className="text-[11px] text-ink/50">
              If you do not answer, it stays exactly as you agreed it.
            </p>
          </li>
        ))}

        {settled.map((row) => (
          <li key={row.finalizationId} className="flex items-center gap-2 py-2.5">
            <Lock className="h-3.5 w-3.5 text-success-700" aria-hidden />
            <span className="text-sm text-ink/70">{row.partLabel}</span>
            <span className="text-[11px] text-ink/50">agreed — the couple cannot change it</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
