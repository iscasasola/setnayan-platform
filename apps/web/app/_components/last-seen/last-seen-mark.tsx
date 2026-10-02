'use client';

import type { ReactNode } from 'react';

/**
 * 💾 The quiet mark over a last-seen page, and the shared moment between the
 * two halves (loading screen → fresh page). One place, so "Updating…" and
 * "Updated just now" sit in the SAME spot and the swap reads as one pill
 * changing its word, not two things appearing.
 *
 * Fixed under the top bar, phone first. `data-last-seen-skip` keeps it out of
 * any snapshot.
 */
export type LastSeenPhase = 'updating' | 'failed' | 'updated';

/** How long the loading screen may show old data before it says the refresh did not come. */
export const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Where the refresh stands while old data is on screen. Offline, or still
 * waiting after `REFRESH_TIMEOUT_MS`, is a refresh that did NOT come — and the
 * screen must say so rather than keep claiming "Updating…".
 */
export function refreshPhase({ online, waitedMs }: { online: boolean; waitedMs: number }): 'updating' | 'failed' {
  return !online || waitedMs >= REFRESH_TIMEOUT_MS ? 'failed' : 'updating';
}

export function lastSeenWhen(savedAt: number): string {
  return new Date(savedAt).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function LastSeenMark({ phase, savedAt }: { phase: LastSeenPhase; savedAt?: number }) {
  let body: ReactNode;
  if (phase === 'failed') {
    body = (
      <>
        <span>
          Couldn&rsquo;t refresh — this is what you saw{savedAt ? ` ${lastSeenWhen(savedAt)}` : ''}, and it
          may be out of date.
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex-none rounded-full bg-ink px-2.5 py-0.5 font-semibold text-cream"
        >
          Try again
        </button>
      </>
    );
  } else {
    body = (
      <>
        <span
          aria-hidden
          className={`h-1.5 w-1.5 flex-none rounded-full ${phase === 'updating' ? 'animate-pulse bg-ink/45' : 'bg-success-600'}`}
        />
        <span>{phase === 'updating' ? 'Updating…' : 'Updated just now'}</span>
      </>
    );
  }
  return (
    <p
      role="status"
      aria-live="polite"
      data-last-seen-skip=""
      data-last-seen-mark={phase}
      className={`pointer-events-auto fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-2xl px-3 py-1 text-[12px] text-ink/70 shadow-sm sn-glass-bare ${phase === 'failed' ? 'text-ink' : ''}`}
    >
      {body}
    </p>
  );
}

// ── The hand-off between the loading screen and the page ────────────────────
// The loading screen notes that it showed old data for a page; the fresh page,
// when it mounts, takes that note and says "Updated just now" for a moment.
let shownFor: { page: string; at: number } | null = null;

export function noteLastSeenShown(page: string): void {
  shownFor = { page, at: Date.now() };
}

export function takeLastSeenShown(page: string): boolean {
  const hit = shownFor !== null && shownFor.page === page && Date.now() - shownFor.at < 60_000;
  shownFor = null;
  return hit;
}
