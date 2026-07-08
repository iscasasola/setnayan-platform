'use client';

/**
 * Life Story · scroll reel (PR-3) — the everyday, explorable rendering.
 *
 * Default order is BY SIGNIFICANCE (the life-review model); "By time" is a
 * client-side toggle. Clips reuse ClipFrame from the editorial living-moments
 * module, which carries the shared page-wide playback registry (≤3 concurrent,
 * one audible) and its reduced-motion behavior — no re-implementation.
 *
 * Tiles with a null url (fixtures, or a signing miss) render a deterministic
 * gradient placeholder instead of a broken image — the reel never looks like
 * an error for having imperfect data.
 */

import { useMemo, useState } from 'react';
import {
  ClipFrame,
  useReducedMotion,
} from '@/app/[slug]/_components/editorial/living-moments';
import { placeholderBackground } from './placeholder';
import { captureLifeFlash } from './life-flash-analytics';

export type ReelMoment = {
  id: string;
  url: string | null;
  type: 'photo' | 'clip';
  eventName: string;
  year: string;
  capturedAt: string;
  significance: number;
  byName: string | null;
  bySelf: boolean;
  byGuest: boolean;
  peopleNames: string[];
  peopleCount: number;
  memoriam: boolean;
};

function byLine(m: ReelMoment): string {
  if (m.bySelf) return 'Your camera';
  if (!m.byName) return 'A Papic camera';
  return `${m.byName}’s camera${m.byGuest ? ' · guest' : ' · Papic'}`;
}

export function ScrollReel({ moments }: { moments: ReelMoment[] }) {
  const [order, setOrder] = useState<'significance' | 'time'>('significance');
  const reducedMotion = useReducedMotion();

  const ordered = useMemo(() => {
    if (order === 'significance') return moments; // server order IS significance order
    return [...moments].sort(
      (a, b) => b.capturedAt.localeCompare(a.capturedAt) || a.id.localeCompare(b.id),
    );
  }, [moments, order]);

  const maxSignificance = useMemo(
    () => Math.max(...moments.map((m) => m.significance), 0.0001),
    [moments],
  );

  if (moments.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-ink">Your moments</h2>
          <span className="text-xs text-ink/40">{moments.length}</span>
        </div>
        <div
          role="group"
          aria-label="Order the reel"
          className="flex rounded-full border border-ink/15 p-0.5 text-xs"
        >
          <button
            type="button"
            aria-pressed={order === 'significance'}
            onClick={() => setOrder('significance')}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              order === 'significance' ? 'bg-ink/10 text-ink' : 'text-ink/55 hover:text-ink'
            }`}
          >
            By significance
          </button>
          <button
            type="button"
            aria-pressed={order === 'time'}
            onClick={() => {
              setOrder('time');
              void captureLifeFlash('life_flash_reel_reordered', { order: 'time' });
            }}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              order === 'time' ? 'bg-ink/10 text-ink' : 'text-ink/55 hover:text-ink'
            }`}
          >
            By time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((m) => (
          <article
            key={m.id}
            className="relative flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-ink/5">
              {m.url && m.type === 'clip' ? (
                <ClipFrame
                  media={{ type: 'clip', url: m.url, id: m.id }}
                  names={m.peopleNames.join(', ')}
                  className="h-full w-full"
                  reducedMotion={reducedMotion}
                />
              ) : m.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL isn't in the next/image allowlist
                <img
                  src={m.url}
                  alt={`${m.eventName} — ${m.peopleNames.join(', ') || 'a moment'}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="h-full w-full"
                  style={{ background: placeholderBackground(m.id) }}
                />
              )}
              {/* significance weight bar */}
              <div className="absolute left-3 top-3 h-1 w-11 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-terracotta"
                  style={{ width: `${Math.round((m.significance / maxSignificance) * 100)}%` }}
                />
              </div>
              {m.memoriam ? (
                <span aria-hidden className="absolute right-3 top-3 text-sm text-white/90">
                  ✦
                </span>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="truncate text-sm font-medium text-ink">
                {m.eventName} <span className="font-normal text-ink/40">· {m.year}</span>
              </p>
              <p className="truncate text-xs text-ink/55">
                {byLine(m)}
                {m.peopleCount > 0
                  ? ` · ${m.peopleCount} ${m.peopleCount === 1 ? 'person' : 'people'}`
                  : ''}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
