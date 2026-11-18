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
import { ActionButton } from '@/components/action-button';

export function SpotlightRecomputeButton() {
  const [pending, start] = useTransition();
  const save = useSaveLoader();
  return (
    <ActionButton
      tone="brand"
      main
      disabled={pending}
      onClick={() =>
        start(() =>
          save.run(() => recomputeSpotlightAwards(), {
            steps: ['Recomputing awards'],
            hint: 'Saving',
          }),
        )
      }
      icon={pending ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : RefreshCw}
      label={pending ? 'Recomputing…' : 'Run now'}
    />
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
      <ActionButton
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
        tone={isFeatured ? 'ok' : 'neutral'}
        aria-pressed={isFeatured}
        icon={
          pending ? (
            <Loader2 className="animate-spin" strokeWidth={1.9} aria-hidden />
          ) : isFeatured ? (
            <Star className="fill-current" strokeWidth={1.9} aria-hidden />
          ) : (
            StarOff
          )
        }
        label={isFeatured ? 'Featured' : 'Feature'}
      />

      <ActionButton
        tone="danger"
        iconOnly
        icon={Trash2}
        label="Remove award"
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
      />
    </div>
  );
}
