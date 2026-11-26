'use client';

import { useState, useTransition } from 'react';
import { ImageDown, AlertTriangle } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { TILES_PER_PRESS } from '@/lib/papic-tile-backfill';
import { backfillTileDerivativesAction, type BackfillResult } from './actions';

/**
 * "Make Memory lane copies" — the doorway for the tile backfill.
 *
 * 🛑 IT ASKS FIRST, AND IS NAMED FOR WHAT IT DOES (final check A8·P-B-22, Add 5 "Forgiving"). It was "Fill in missing
 * Memory lane copies": a word for a repair, on a press that starts a job of up to {@link TILES_PER_PRESS} photos at
 * once with nothing saying so. Now the word is the job, and the house confirm box says what runs before it runs.
 *
 * 🚪 THE ACTION SHIPPED WITHOUT ONE. It existed as an API route with no caller
 * and no button, which is a mechanism never proven reachable — and it was
 * written in the same session that quoted that rule twice. A page ships with
 * its doorway.
 *
 * Safe to press repeatedly and safe to press when there is nothing to do: the
 * work is idempotent and batched, so the plain confirm box is enough, not the
 * typed-confirmation the media cleaner uses. That control guards a DELETE; this
 * one only adds a smaller copy of a photo that already exists.
 *
 * The button decides nothing — `requireAdmin()` runs server-side in the action.
 * This is a control, not a permission.
 *
 * Drawn as the Insights "needs action" row (admin_pub/insights.html › Papic
 * storage): the sentence on the left, its ONE action on the right, a hairline
 * above — no card around it.
 */
export function BackfillTilesButton({ pending }: { pending: number | null }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BackfillResult | null>(null);
  const { confirm, dialog } = useConfirm();

  async function run() {
    const ok = await confirm({
      title: 'Make Memory lane copies now?',
      body: `This starts as soon as you confirm. Up to ${TILES_PER_PRESS} photos without one get a 640px Memory lane copy. The photos themselves are not changed.`,
      confirmLabel: 'Make copies',
    });
    if (!ok) return;
    startTransition(async () => {
      setResult(await backfillTileDerivativesAction());
    });
  }

  return (
    <div className="border-t border-ink/10 py-2.5" data-backfill-tiles="">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* Two separate facts, never collapsed: how many still need one, and
            whether we could find out. `null` is NOT MEASURED, not zero. */}
        <span className="min-w-0">
          <span
            className={`block text-[15px] font-semibold leading-tight ${pending == null ? 'text-[var(--sn-warning-deep)]' : 'text-ink'}`}
          >
            {pending == null
              ? 'How many still need one could not be measured just now.'
              : pending === 0
                ? 'Every photo already has its Memory lane copy.'
                : `${pending} photo${pending === 1 ? '' : 's'} still without one`}
          </span>
          <span className="mt-px block text-[13px] text-ink/65">
            Up to {TILES_PER_PRESS} per press, after you confirm — press again if more remain
          </span>
        </span>
        <ActionButton
          tone="brand"
          main
          icon={ImageDown}
          label={isPending ? 'Making Memory lane copies…' : 'Make Memory lane copies'}
          disabled={isPending}
          onClick={run}
          data-backfill-tiles-press=""
        />
      </div>

      {result?.ok === false ? (
        <p role="alert" className="mt-2 flex items-start gap-2 text-[13px] text-ink/70">
          <AlertTriangle
            aria-hidden
            className="mt-px h-4 w-4 shrink-0 text-[color:var(--sn-warning)]"
            strokeWidth={1.75}
          />
          Could not finish: {result.error}
        </p>
      ) : null}

      {result?.ok ? (
        <p role="status" className="mt-2 text-[13px] text-ink/70">
          Made {result.filled} {result.filled === 1 ? 'copy' : 'copies'}
          {result.skipped > 0 ? `, skipped ${result.skipped}` : ''}.{' '}
          {result.remaining == null
            ? 'How many remain could not be measured — press again and re-check.'
            : result.remaining > 0
              ? `${result.remaining} still to go.`
              : 'Nothing left to do.'}
        </p>
      ) : null}
    </div>
  );
}
