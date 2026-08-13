'use client';

import { useState, useTransition } from 'react';
import { ImageDown, AlertTriangle } from 'lucide-react';

import { backfillTileDerivativesAction, type BackfillResult } from './actions';

/**
 * "Fill in missing wall-size copies" — the doorway for the tile backfill.
 *
 * 🚪 THE ACTION SHIPPED WITHOUT ONE. It existed as an API route with no caller
 * and no button, which is a mechanism never proven reachable — and it was
 * written in the same session that quoted that rule twice. A page ships with
 * its doorway.
 *
 * Safe to press repeatedly and safe to press when there is nothing to do: the
 * work is idempotent and batched, so this is a plain button rather than the
 * typed-confirmation the media cleaner uses. That control guards a DELETE; this
 * one only adds a smaller copy of a photo that already exists.
 *
 * The button decides nothing — `requireAdmin()` runs server-side in the action.
 * This is a control, not a permission.
 */
export function BackfillTilesButton({ pending }: { pending: number | null }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BackfillResult | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(await backfillTileDerivativesAction());
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
      >
        <ImageDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {isPending ? 'Making wall-size copies…' : 'Fill in missing wall-size copies'}
      </button>

      {/* Two separate facts, never collapsed: how many still need one, and
          whether we could find out. `null` is NOT MEASURED, not zero. */}
      <p className="mt-2 text-xs text-ink/55">
        {pending == null
          ? 'How many still need one could not be measured just now.'
          : pending === 0
            ? 'Every photo already has its wall-size copy.'
            : `${pending} photo${pending === 1 ? '' : 's'} still without one. Runs up to 40 per press — press again if more remain.`}
      </p>

      {result?.ok === false ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70">
          <AlertTriangle
            aria-hidden
            className="mt-px h-4 w-4 shrink-0 text-[color:var(--sn-warning)]"
            strokeWidth={1.75}
          />
          Could not finish: {result.error}
        </p>
      ) : null}

      {result?.ok ? (
        <p className="mt-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70">
          Made {result.filled} copy{result.filled === 1 ? '' : 's'}
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
