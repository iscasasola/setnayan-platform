'use client';

import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import { ImageDown, AlertTriangle } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { makeSmallCopiesOfOldPhotosAction } from './old-photos-actions';
import type { CopyRun } from '@/lib/old-photo-copies.server';
import { COPIES_PER_PRESS, formatBytes } from '@/lib/old-photo-copies';

/**
 * The press for "Make small copies of old photos". The count beside it is the dry run; nothing is written until this
 * is pressed. Safe to press again: what is done drops off the list. The button decides nothing — the action checks
 * the admin on the server.
 *
 * 🛑 IT ASKS FIRST (final check A8·P-B-22, Add 5 "Forgiving"): the press starts writing copies at once, so the house
 * confirm box says what runs before it runs.
 *
 * Drawn as the Insights "needs action" row: the dry run's sentence (handed in by the page) on the left, the ONE action
 * on the right. With nothing oversized the sentence stays and the button does not draw.
 */
export function OldPhotosButton({ oversized, children }: { oversized: number; children?: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CopyRun | null>(null);
  const showButton = !(oversized === 0 && !result);
  const { confirm, dialog } = useConfirm();

  async function run() {
    const ok = await confirm({
      title: 'Make small copies now?',
      body: `This starts as soon as you confirm. Up to ${COPIES_PER_PRESS} of the largest covers get a web-size copy beside the original, and the cover shows the copy. The original stays, and prints still use it.`,
      confirmLabel: 'Make copies',
    });
    if (!ok) return;
    startTransition(async () => {
      setResult(await makeSmallCopiesOfOldPhotosAction());
    });
  }
  return (
    <div className="border-t border-ink/10 py-2.5" data-old-photos-row="">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="min-w-0">
          {children}
          {showButton ? (
            <span className="mt-px block text-[13px] text-ink/65">
              Up to {COPIES_PER_PRESS} per press, largest first, after you confirm — press again if more remain
            </span>
          ) : null}
        </span>
        {showButton ? (
          <ActionButton
            tone="brand"
            main
            icon={ImageDown}
            label={isPending ? 'Making small copies…' : 'Make small copies of old photos'}
            disabled={isPending}
            onClick={run}
            data-old-photos-press=""
          />
        ) : null}
      </div>
      {result?.ok === false ? (
        <p className="mt-2 flex items-start gap-2 text-[13px] text-ink/70" role="alert">
          <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0 text-[color:var(--sn-warning)]" strokeWidth={1.75} />
          Could not finish: {result.error}
        </p>
      ) : null}
      {result?.ok ? (
        <p className="mt-2 text-[13px] text-ink/70" role="status">
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
