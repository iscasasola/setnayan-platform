'use client';

import { useState, useTransition } from 'react';
import { Images, Film, Newspaper, EyeOff, Eye } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import {
  hideMyStoryItem,
  unhideMyStoryItem,
  optOutOfEventStory,
} from '../people/life-stories';

/**
 * Person-spine · Phase 2 · LIFE STORIES — participant "Your Story" surface
 * (STAGED / flag-off).
 *
 * ⚠ This component only renders when `personLifeStoriesEnabled()` is true, which
 * is decided on the server (account home page.tsx). It is production-inert until
 * the owner sets NEXT_PUBLIC_PERSON_LIFE_STORIES=1.
 * ⚖ ONE CONDITION, NOT TWO — corrected 2026-08-13. This said "until PH counsel
 * clears Phase 2 AND …"; the owner discharged that half himself as registered
 * DPO. No external counsel opinion exists — see the authority note on
 * personLifeStoriesEnabled() in lib/person-life-stories.ts.
 *
 * Story items are REFERENCES (source_table + source_id), NOT media — so we never
 * render thumbnails / R2 images here. We present the person's story grouped by
 * event with counts + kind + per-item hide/unhide controls and a per-event
 * opt-out ("Hide all from this event"). All mutations call the existing,
 * flag-guarded server actions; this surface only READS + invokes them.
 */

export type LifeStoryGroup = {
  eventId: string;
  eventName: string | null;
  items: Array<{
    storyItemId: string;
    itemKind: 'photo' | 'clip' | 'editorial';
    hiddenAt: string | null;
  }>;
};

/** "4 photos · 1 clip · 1 editorial" — omits zero counts, pluralizes. */
function countSummary(items: LifeStoryGroup['items']): string {
  const counts = { photo: 0, clip: 0, editorial: 0 };
  for (const it of items) counts[it.itemKind] += 1;
  const label = (n: number, singular: string) =>
    `${n} ${singular}${n === 1 ? '' : 's'}`;
  const parts: string[] = [];
  if (counts.photo) parts.push(label(counts.photo, 'photo'));
  if (counts.clip) parts.push(label(counts.clip, 'clip'));
  if (counts.editorial) parts.push(label(counts.editorial, 'editorial'));
  return parts.join(' · ');
}

function KindIcon({ kind }: { kind: 'photo' | 'clip' | 'editorial' }) {
  const cls = 'h-4 w-4 shrink-0 text-ink/70';
  if (kind === 'clip') return <Film aria-hidden className={cls} />;
  if (kind === 'editorial') return <Newspaper aria-hidden className={cls} />;
  return <Images aria-hidden className={cls} />;
}

function kindLabel(kind: 'photo' | 'clip' | 'editorial'): string {
  if (kind === 'clip') return 'Clip';
  if (kind === 'editorial') return 'Editorial';
  return 'Photo';
}

export function LifeStorySection({ groups }: { groups: LifeStoryGroup[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-[rgb(var(--color-danger))]">
          {error}
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.eventId}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {group.eventName ?? 'An event'}
              </p>
              <p className="text-xs text-ink/70">{countSummary(group.items)}</p>
            </div>
            <ActionButton
              tone="neutral"
              icon={EyeOff}
              label="Hide all from this event"
              disabled={pending}
              onClick={() => run(() => optOutOfEventStory(group.eventId))}
            />
          </div>

          <ul className="divide-y divide-ink/10">
            {group.items.map((item) => {
              const hidden = item.hiddenAt !== null;
              return (
                <li
                  key={item.storyItemId}
                  className="flex min-h-14 items-center justify-between gap-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <KindIcon kind={item.itemKind} />
                    <span className="truncate text-sm text-ink">
                      {kindLabel(item.itemKind)}
                    </span>
                    {hidden ? (
                      <Badge tone="quiet">Hidden</Badge>
                    ) : null}
                  </span>
                  {hidden ? (
                    <ActionButton
                      tone="neutral"
                      icon={Eye}
                      label="Unhide"
                      disabled={pending}
                      onClick={() => run(() => unhideMyStoryItem(item.storyItemId))}
                    />
                  ) : (
                    <ActionButton
                      tone="neutral"
                      icon={EyeOff}
                      label="Hide"
                      disabled={pending}
                      onClick={() => run(() => hideMyStoryItem(item.storyItemId))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
