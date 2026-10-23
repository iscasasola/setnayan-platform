'use client';

import { useState, useTransition } from 'react';
import { ImageDown, AlertTriangle } from 'lucide-react';

import { makeSmallCopiesOfOldPhotosAction } from './old-photos-actions';
import type { CopyRun } from '@/lib/old-photo-copies.server';
import { COPIES_PER_PRESS, formatBytes } from '@/lib/old-photo-copies';

/**
 * The press for "Make small copies of old photos". The count above it is the dry run; nothing is written until this
 * is pressed. Safe to press again: what is done drops off the list. The button decides nothing — the action checks
 * the admin on the server.
 */
export function OldPhotosButton({ oversized }: { oversized: number }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CopyRun | null>(null);
  if (oversized === 0 && !result) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(await makeSmallCopiesOfOldPhotosAction());
          })
        }
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
      >
        <ImageDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {isPending ? 'Making small copies…' : 'Make small copies of old photos'}
      </button>
      <p className="mt-2 text-xs text-ink/55">Up to {COPIES_PER_PRESS} per press, largest first — press again if more remain.</p>
      {result?.ok === false ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70">
          <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0 text-[color:var(--sn-warning)]" strokeWidth={1.75} />
          Could not finish: {result.error}
        </p>
      ) : null}
      {result?.ok ? (
        <p className="mt-2 rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70">
          Made {result.made} small cop{result.made === 1 ? 'y' : 'ies'}
          {result.skipped > 0 ? `, skipped ${result.skipped}` : ''}
          {result.savedBytes > 0 ? ` — ${formatBytes(result.savedBytes)} lighter` : ''}.{' '}
          {result.remaining == null
            ? 'How many remain could not be measured — reopen the page to re-check.'
            : result.remaining > 0
              ? `${result.remaining} still to go.`
              : 'Nothing left to do.'}
        </p>
      ) : null}
    </div>
  );
}
