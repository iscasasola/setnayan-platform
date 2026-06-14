/**
 * apps/web/lib/social/governor.ts
 *
 * Cadence governor for the social auto-publish pipeline (canonical: corpus
 * `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8.3b — "automatic but
 * substantial"). Pure functions, no I/O, no env — unit-testable in isolation.
 *
 * The doctrine: the page should feel hand-run, not bot-run. Three rules:
 *   1. Per-platform daily caps (FB ≤3 · IG ≤2 · TT ≤1) per PH calendar day.
 *   2. ≥3 hours between any two posts on the same platform.
 *   3. Posts land only inside PH prime windows — 11:00–13:00 (lunch scroll)
 *      and 18:00–21:00 (evening scroll), Asia/Manila.
 *
 * TIMEZONE NOTE: the Philippines has never observed DST and PHT is pinned at
 * UTC+08:00 (PSA/PAGASA standard time), so a fixed +08:00 offset is correct
 * year-round — no Intl/timezone-db dependency needed. If PH ever reintroduced
 * DST (last seen 1990) this file is the single place to revisit.
 */

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok';

/** Max posts per platform per PH calendar day (§ 8.3b). */
export const PLATFORM_DAILY_CAPS: Record<SocialPlatform, number> = {
  facebook: 3,
  instagram: 2,
  tiktok: 1,
};

/** Minimum spacing between two posts on the same platform — 3 hours. */
export const MIN_SPACING_MS = 3 * 60 * 60 * 1000;

/** PH prime windows in PHT wall-clock hours: [start, end) — 11–13 & 18–21. */
export const PH_PRIME_WINDOWS: ReadonlyArray<{ startHour: number; endHour: number }> = [
  { startHour: 11, endHour: 13 },
  { startHour: 18, endHour: 21 },
];

/** Fixed PHT offset — see the timezone note above (PH has no DST). */
const PH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The PH calendar day (YYYY-MM-DD) an instant falls on. */
export function phDayKey(instant: Date): string {
  return new Date(instant.getTime() + PH_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** Prime-window instants (UTC Dates) for a given PH calendar day. */
function windowsForPhDay(dayKey: string): Array<{ start: Date; end: Date }> {
  return PH_PRIME_WINDOWS.map((w) => ({
    start: new Date(`${dayKey}T${String(w.startHour).padStart(2, '0')}:00:00+08:00`),
    end: new Date(`${dayKey}T${String(w.endHour).padStart(2, '0')}:00:00+08:00`),
  }));
}

/**
 * The earliest instant ≥ `now` that:
 *   • falls inside a PH prime window,
 *   • keeps the platform under its daily cap for that PH calendar day
 *     (counting `takenSlots` already on that day), and
 *   • sits ≥3h away from every slot in `takenSlots`.
 *
 * If `now` is already inside a window and the slot is free, returns `now`
 * itself; otherwise rolls forward — next window, next day — until a slot
 * fits. `takenSlots` should be the platform's already-scheduled + recently
 * published instants (the caller assembles them; see lib/social/flush.ts).
 */
export function nextAvailableSlot(
  platform: SocialPlatform,
  takenSlots: Date[],
  now: Date,
): Date {
  const cap = PLATFORM_DAILY_CAPS[platform];

  // 400-day scan guard — unreachable in practice (a day with zero taken
  // slots always admits a slot), but keeps a logic bug from spinning forever.
  for (let dayOffset = 0; dayOffset < 400; dayOffset += 1) {
    const dayKey = phDayKey(new Date(now.getTime() + dayOffset * DAY_MS));
    const takenThatDay = takenSlots.filter((s) => phDayKey(s) === dayKey).length;
    if (takenThatDay >= cap) continue;

    for (const { start, end } of windowsForPhDay(dayKey)) {
      if (end.getTime() <= now.getTime()) continue;

      // Earliest viable instant in this window ("if now is already inside
      // a window … return now").
      let candidate = Math.max(start.getTime(), now.getTime());

      // Spacing — push the candidate past any taken slot within 3h, looping
      // to a fixpoint because each push can collide with the next slot.
      let moved = true;
      while (moved) {
        moved = false;
        for (const taken of takenSlots) {
          if (Math.abs(candidate - taken.getTime()) < MIN_SPACING_MS) {
            candidate = taken.getTime() + MIN_SPACING_MS;
            moved = true;
          }
        }
      }

      // Still inside this window? (A push can shove it past the window end —
      // then the next window / next day takes over.)
      if (candidate < end.getTime()) return new Date(candidate);
    }
  }

  // Unreachable fallback (see the scan-guard comment) — tomorrow's first window.
  const fallbackDay = phDayKey(new Date(now.getTime() + DAY_MS));
  const firstWindow = windowsForPhDay(fallbackDay)[0];
  return firstWindow ? firstWindow.start : new Date(now.getTime() + DAY_MS);
}
