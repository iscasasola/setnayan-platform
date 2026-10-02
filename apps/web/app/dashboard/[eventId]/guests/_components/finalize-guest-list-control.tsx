'use client';

/**
 * finalize-guest-list-control.tsx: the ONLY way a guest list becomes final.
 *
 * ⚖ Owner, 2026-09-30: *"i must click a finalize to finalize it."* Until the
 * host presses Finalize here and confirms, the list stays open: names can be
 * added and guests can reply. A finalized list shows why it is closed and
 * offers Reopen, so a mistaken press is never a dead end.
 *
 * A refused press is SAID, never swallowed: the server's sentence renders
 * under the button (a failure must never look like nothing happened).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { formatCount } from '@/lib/format-number';
import { setGuestListFinalized } from '../finalize-actions';

export function FinalizeGuestListControl({
  eventId,
  locked,
  finalPax,
}: {
  eventId: string;
  locked: boolean;
  /** The frozen head count suppliers price for (null = nothing to anchor on). */
  finalPax: number | null;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = async (finalize: boolean) => {
    const ok = await confirm(
      finalize
        ? {
            title: 'Finalize your guest list?',
            body:
              'Your head count is frozen at today’s number, suppliers price for it, and guests can no longer reply on your event page. You can reopen it later.',
            confirmLabel: 'Finalize',
          }
        : {
            title: 'Reopen your guest list?',
            body: 'You can add and change names again, and guests can reply again. The head count goes back to following your list.',
            confirmLabel: 'Reopen',
          },
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await setGuestListFinalized(eventId, finalize);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      data-guest-list-finalize={locked ? 'finalized' : 'open'}
      /* ⚖ ONE ROW (owner 2026-10-03, "also fix the spacing here"): the
         sentence left, the button right, both centred on one line; on a phone
         the sentence, then a full-width button. No padding of its own — the
         page's one gap spaces it. The button is a 44 px pill, the Filter ▾'s
         shape, so the controls under the title read as one family. */
      className={
        locked
          ? 'text-sm text-ink/70'
          : 'flex flex-col gap-3 text-sm text-ink/60 sm:flex-row sm:items-center sm:justify-between'
      }
    >
      {dialog}
      {locked ? (
        /*
          The frozen figure is `max(estimated_pax, headcount)`, so on a list with
          nobody on it it is the head count typed at sign-up. It is said as what
          it IS FOR (what suppliers price against), never as "guests locked in".
        */
        <p>
          <span className="font-semibold text-ink">Guest list finalized</span>
          {finalPax
            ? ` · your suppliers price for ${formatCount(finalPax)} ${finalPax === 1 ? 'head' : 'heads'}`
            : ''}
          . Guests can no longer reply on your event page.{' '}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(false)}
            className="font-medium text-mulberry-700 underline underline-offset-4 disabled:opacity-50"
          >
            {pending ? 'Reopening…' : 'Reopen'}
          </button>
        </p>
      ) : (
        <>
          <span>Guests can reply until you finalize.</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(true)}
            data-guest-list-finalize-button=""
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50 sm:w-auto"
          >
            {pending ? 'Finalizing…' : 'Finalize guest list'}
          </button>
        </>
      )}
      {error ? (
        <p role="alert" className="w-full text-sm text-mulberry-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
