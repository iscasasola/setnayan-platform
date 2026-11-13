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
import { Check, Lock, Send, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE, TemplateSection } from '@/app/_components/template-rows';
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
    <TemplateSection
      label="Sign-off"
      tip="The couple asked you to agree to part of this design. Agreeing freezes it until you say yes to a change."
      data="part-signoff"
    >
      {message ? (
        <p role="status" className="py-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
          {message}
        </p>
      ) : null}

      <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
        {asks.map((row) => (
          <li key={row.finalizationId} className="space-y-2 py-3">
            <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold text-ink">{row.partLabel}</b>
                <span className={`block ${TEMPLATE_SUBLINE}`}>
                  {lockRequestFuseLabel(row.expiresAt) ?? 'no deadline recorded'}
                </span>
              </span>
              <ActionButton
                tone="brand"
                icon={Check}
                label="I’ll build this"
                disabled={busy === row.finalizationId}
                onClick={() => run(row.finalizationId, () => agreeAction(row.finalizationId))}
              />
              <ActionButton
                tone="neutral"
                icon={X}
                label="Not as designed"
                disabled={busy === row.finalizationId}
                aria-expanded={reasonFor === row.finalizationId}
                onClick={() =>
                  setReasonFor(reasonFor === row.finalizationId ? null : row.finalizationId)
                }
              />
            </div>
            {reasonFor === row.finalizationId ? (
              <div className="space-y-2 rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] p-3">
                <label
                  className={`block ${TEMPLATE_SUBLINE}`}
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
                  className="w-full rounded-xl border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-[15px] text-ink"
                  placeholder="We cannot source that shade of peony in November."
                />
                <ActionButton
                  tone="brand"
                  icon={Send}
                  label="Send"
                  disabled={busy === row.finalizationId}
                  onClick={() =>
                    run(row.finalizationId, () => declineAction(row.finalizationId, reason))
                  }
                />
              </div>
            ) : null}
          </li>
        ))}

        {reopens.map((row) => (
          <li key={row.finalizationId} className="space-y-2 py-3">
            <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold text-ink">{row.partLabel}</b>
                <span className={`block ${TEMPLATE_SUBLINE}`}>
                  They want to change this after you agreed ·{' '}
                  {lockRequestFuseLabel(row.reopenExpiresAt) ?? 'no deadline recorded'}
                </span>
              </span>
              <ActionButton
                tone="brand"
                icon={Check}
                label="Go ahead, change it"
                disabled={busy === row.finalizationId}
                onClick={() =>
                  run(row.finalizationId, () =>
                    answerReopenAction(row.finalizationId, true, ''),
                  )
                }
              />
              <ActionButton
                tone="neutral"
                icon={Lock}
                label="Keep it as agreed"
                disabled={busy === row.finalizationId}
                onClick={() =>
                  run(row.finalizationId, () =>
                    answerReopenAction(row.finalizationId, false, reason),
                  )
                }
              />
            </div>
            {/* ⚠ IF NOBODY ANSWERS, THE PART STAYS AS AGREED. Said here rather
                than left to be discovered: silence is not consent in either
                direction, and a supplier who ignores this is not accidentally
                releasing work they planned around. */}
            <p className={TEMPLATE_SUBLINE}>
              If you do not answer, it stays exactly as you agreed it.
            </p>
          </li>
        ))}

        {settled.map((row) => (
          <li key={row.finalizationId} className="flex min-h-14 items-center gap-2.5 py-2">
            <Lock className="h-4 w-4 flex-none" style={{ color: 'rgb(var(--color-ok))' }} aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold text-ink">{row.partLabel}</b>
              <span className={`block ${TEMPLATE_SUBLINE}`}>Agreed — the couple cannot change it</span>
            </span>
          </li>
        ))}
      </ul>
    </TemplateSection>
  );
}
