'use client';

/**
 * Client controls for /admin/spotlight-awards.
 *
 *   • SpotlightRecomputeButton — fires the cron-free "Run now" recompute with a
 *     pending spinner. The work is a server action (recomputeSpotlightAwards);
 *     this is purely the busy-state affordance.
 *   • SpotlightAwardRowActions — per-row Feature toggle + Remove (with a
 *     confirm). Both are server-action <form> submits wrapped in useTransition
 *     so the row shows pending state.
 */

import { useTransition } from 'react';
import { Loader2, RefreshCw, Star, StarOff, Trash2 } from 'lucide-react';
import {
  recomputeSpotlightAwards,
  toggleHomepageFeatured,
  removeAward,
} from '../actions';
import { useSaveLoader } from '@/components/sd-loader';

export function SpotlightRecomputeButton() {
  const [pending, start] = useTransition();
  const save = useSaveLoader();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(() =>
          save.run(() => recomputeSpotlightAwards(), {
            steps: ['Recomputing awards'],
            hint: 'Saving',
          }),
        )
      }
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-terracotta/90 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
      ) : (
        <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
      )}
      {pending ? 'Recomputing…' : 'Run now'}
    </button>
  );
}

export function SpotlightAwardRowActions({
  awardId,
  isFeatured,
}: {
  awardId: string;
  isFeatured: boolean;
}) {
  const [pending, start] = useTransition();
  const save = useSaveLoader();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set('award_id', awardId);
            fd.set('next', String(!isFeatured));
            await save.run(() => toggleHomepageFeatured(fd), {
              steps: ['Updating the feature'],
              hint: 'Saving',
            });
          })
        }
        className={
          isFeatured
            ? 'inline-flex items-center gap-1.5 rounded-lg border border-success-300 bg-success-50 px-3 py-2 text-sm font-medium text-success-700 transition-colors hover:bg-success-100 disabled:opacity-60'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-ink/[0.04] disabled:opacity-60'
        }
        aria-pressed={isFeatured}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
        ) : isFeatured ? (
          <Star className="h-3.5 w-3.5 fill-current" strokeWidth={2} aria-hidden />
        ) : (
          <StarOff className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        )}
        {isFeatured ? 'Featured' : 'Feature'}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Remove this award?')) return;
          start(async () => {
            const fd = new FormData();
            fd.set('award_id', awardId);
            await save.run(() => removeAward(fd), {
              steps: ['Removing the award'],
              hint: 'Saving',
            });
          });
        }}
        className="inline-flex items-center justify-center rounded-lg border border-ink/15 bg-white p-2 text-ink/55 transition-colors hover:border-terracotta/40 hover:text-terracotta disabled:opacity-60"
        aria-label="Remove award"
        title="Remove award"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
