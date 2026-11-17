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
import { InfoTip } from '@/app/_components/info-tip';

export type CoverRing = { covered: number; total: number };

type Ctx = { ring: CoverRing | null; setRing: (r: CoverRing | null) => void };

// 🛒 2026-11-17 (owner, "the find build book"; Q14): the count left the pinned row — `CoverCount` and `CoverBar` are
// gone with it. It is now ONE quiet line atop Build (`CoveredLine`, below), from the same published count.
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
/**
 * 📋 "Covered N of M categories ⓘ" — ONE quiet line atop Build, the cart (owner 2026-11-17, Q14: *"covered N of M"
 * stays as one quiet line in Build*). The SAME published count the row used to carry (`ringCoveredCount` over the
 * categories Find lists — booked or covered), never typed. Not published yet → no line, never a made-up 0.
 */
export function CoveredLine() {
  const ring = useContext(CoverRingContext)?.ring ?? null;
  if (!ring || ring.total <= 0) return null;
  return (
    <div data-covered-line="" className="mb-2 text-xs text-ink/60">
      <InfoTip
        align="start"
        label="Covered categories"
        labelNode={
          <span>
            Covered <Count value={ring.covered} id="sup-cart-covered" /> of <Count value={ring.total} id="sup-cart-total" />{' '}
            categories
          </span>
        }
        ariaLabel="About covered categories"
      >
        A category is covered when a supplier is booked there, or it comes with another booking, or you marked it done.
      </InfoTip>
    </div>
  );
}
