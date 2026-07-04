'use client';

import { useState, useTransition } from 'react';
import { Images, Film, Newspaper, EyeOff, Eye } from 'lucide-react';
import {
  hideMyStoryItem,
  unhideMyStoryItem,
  optOutOfEventStory,
} from '../people/life-stories';

/**
 * Person-spine · Phase 2 · LIFE STORIES — participant "Your Story" surface
 * (STAGED / flag-off / counsel-gated).
 *
 * ⚠ This component only renders when `personLifeStoriesEnabled()` is true, which
 * is decided on the server (account home page.tsx). It is production-inert until
 * PH counsel clears Phase 2 and the owner sets NEXT_PUBLIC_PERSON_LIFE_STORIES=1.
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
  const cls = 'h-4 w-4 shrink-0 text-ink/60';
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
        <p className="rounded-xl border border-ink/10 bg-white/40 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {groups.map((group) => (
        <div
          key={group.eventId}
          className="rounded-xl border border-ink/10 bg-white/40 p-4"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {group.eventName ?? 'An event'}
              </p>
              <p className="text-xs text-ink/60">{countSummary(group.items)}</p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => optOutOfEventStory(group.eventId))}
              className="button-secondary shrink-0 text-xs disabled:opacity-50"
            >
              Hide all from this event
            </button>
          </div>

          <ul className="space-y-1.5">
            {group.items.map((item) => {
              const hidden = item.hiddenAt !== null;
              return (
                <li
                  key={item.storyItemId}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-3 py-2 ${
                    hidden ? 'opacity-50' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <KindIcon kind={item.itemKind} />
                    <span className="truncate text-sm text-ink">
                      {kindLabel(item.itemKind)}
                    </span>
                    {hidden ? (
                      <span className="shrink-0 text-xs text-ink/60">Hidden</span>
                    ) : null}
                  </span>
                  {hidden ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => unhideMyStoryItem(item.storyItemId))}
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-ink disabled:opacity-50"
                    >
                      <Eye aria-hidden className="h-4 w-4" />
                      Unhide
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => hideMyStoryItem(item.storyItemId))}
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-ink disabled:opacity-50"
                    >
                      <EyeOff aria-hidden className="h-4 w-4" />
                      Hide
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
