'use client';

/**
 * 🧭 THE CALMER "COVER YOUR EVENT" HEADER (owner 2026-10-26, verbatim: *"Yes — build the new Suppliers header as
 * shown."* — on `shots-2026-10-25/thumb-room/header-after-{390,1280}.png`, after his 2026-10-25 *"this can also have
 * a better presentation"* on "Cover your event ⓘ · Covered 6 of 14 · 📅 Your date is set: … · Every card below shows
 * whether that supplier is free that day.").
 *
 *     Cover your event ⓘ                         6 of 14 covered
 *     ▬▬▬▬▬▬▬▬▬▬▬▬▬────────────────────────────────────────────   ← a thin bar, the same count
 *
 * One title, one quiet count on its right, the bar under it — the bench's "Covered N of M" line is gone, and a
 * settled date's banner (tone 'anchored', "Your date is set…" — the date is already on the date · place line above)
 * is gone too; what it explained ("free that day") lives in the ⓘ. A date CONFLICT still draws its banner (a warning
 * is not a detail), and so do a narrowing build and "Booking these suppliers sets your date".
 *
 * WHO KNOWS WHAT. The title is the shell's (`ServiceSection` in services-takeover.tsx); the count is the bench's
 * (`ShortlistCategories` — it is the one that knows what is covered, and it changes the count as the couple adds or
 * removes a category). The shell PROVIDES this context and draws `CoverCount` + `CoverBar`; the bench PUBLISHES its
 * count (`usePublishCoverRing`). With no provider (the pre-replan bench) the bench keeps its own line.
 * The bar's track is drawn on the server so nothing moves when the count arrives; the fill grows into place.
 *
 * 🔒 Held by `app/dashboard/[eventId]/vendors/the-cover-header-is-calm.test.ts`.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Count } from '@/components/count';

export type CoverRing = { covered: number; total: number };

type Ctx = { ring: CoverRing | null; setRing: (r: CoverRing | null) => void };

const CoverRingContext = createContext<Ctx | null>(null);

/** The shell's side: holds the bench's published count for the header. */
export function CoverRingProvider({ children }: { children: ReactNode }) {
  const [ring, setRing] = useState<CoverRing | null>(null);
  const value = useMemo(() => ({ ring, setRing }), [ring]);
  return <CoverRingContext.Provider value={value}>{children}</CoverRingContext.Provider>;
}

/** True under the calm header — the bench then draws neither its count line nor a settled-date banner. */
export function useCoverHeaderOwnsTheCount(): boolean {
  return useContext(CoverRingContext) !== null;
}

/** The bench's side: publish the count (and take it back on unmount). */
export function usePublishCoverRing(covered: number, total: number, on: boolean): void {
  const ctx = useContext(CoverRingContext);
  const setRing = ctx?.setRing;
  useLayoutEffect(() => {
    if (!setRing) return;
    // 📋 An empty list is published too (owner 2026-11-12): the pinned row then says "nothing added yet" — never a
    // blank that reads as still loading. Off (the pre-replan bench) → nothing published.
    setRing(on ? { covered, total } : null);
  }, [setRing, covered, total, on]);
  useLayoutEffect(() => () => setRing?.(null), [setRing]);
}

/** The bar's fill, in percent (pure — 0…100, never NaN). */
export function coverPercent(r: CoverRing | null): number {
  if (!r || r.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((r.covered / r.total) * 100)));
}

/** The words while Find lists nothing (a brand-new event). */
export const COVER_NOTHING_YET = 'nothing added yet';

/** "6 of 14 covered" — quiet, beside Find ▾ in the pinned row (owner 2026-11-12). Read, never pressed. */
export function CoverCount() {
  const ring = useContext(CoverRingContext)?.ring ?? null;
  if (!ring) return null;
  if (ring.total <= 0) {
    return (
      <span data-cover-count="" data-cover-empty="" className="font-sans text-[13px] tracking-normal text-ink/70">
        {COVER_NOTHING_YET}
      </span>
    );
  }
  return (
    <span data-cover-count="" className="font-sans text-[13px] font-medium tracking-normal text-ink/70">
      <Count value={ring.covered} id="sup-ring-covered" /> of <Count value={ring.total} id="sup-ring-total" />
      {/* At 320 the row keeps "6 of 12" and lets the word go — Find ▾, the next page and ⚙ never wrap (2026-11-12). */}
      <span className="max-[359px]:sr-only"> covered</span>
    </span>
  );
}

/** The thin bar along the pinned row's foot — the same count, drawn. Nothing listed → no bar. */
export function CoverBar() {
  const ring = useContext(CoverRingContext)?.ring ?? null;
  const pct = coverPercent(ring);
  if (ring && ring.total <= 0) return null;
  return (
    <div
      data-cover-bar=""
      role="progressbar"
      aria-label="Categories covered"
      aria-valuemin={0}
      aria-valuemax={ring?.total ?? 0}
      aria-valuenow={ring?.covered ?? 0}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-ink/10"
    >
      <div
        className="h-full rounded-full bg-[rgb(var(--color-ok))] transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
