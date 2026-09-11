/**
 * vendor-dayof-free-until.ts — the DATED END for the free "day-of tools" console
 * (owner ruling 2026-09-11, DECISION_LOG "SEVEN SUPPLIER-SIDE QUESTIONS" Q7:
 * *"Dated end, shown to shops"* — "an end date set now (e.g. three months after
 * public launch) and shops see 'free until …'").
 *
 * WHAT EXISTS TODAY (RULE 0). `app/vendor-dashboard/on-the-day/page.tsx` and its
 * `live/[eventId]/page.tsx` console are the shipped "day-of tools" — the generic
 * module kit (`lib/vendor-dayof-modules.ts`) that every booked vendor gets, at no
 * charge, with NO expiry anywhere: `lib/vendor-dayof-frame.ts`'s own invariant is
 * that the generic kit is passed through UNGATED on every access path ("Free-
 * during-launch is active and every production vendor is on a free tier").
 * That invariant is pinned by `lib/vendor-dayof-frame.test.ts` and is NOT touched
 * here. The separate, DB-driven `promo_free_windows` "all_vendors" mechanism
 * (`lib/promo-free-windows.ts`) already promotes vendor SUBSCRIPTION TIER for
 * free — a different lever (billing tiers), owner/admin-authored per window, and
 * out of scope for Q7's ask of "ONE config value" for the day-of console itself.
 *
 * THE DELTA. This module is the ONE new config value the launch date lives in.
 * The owner has not set the public-launch date yet, so this defaults to UNSET —
 * "no date yet" — never a guessed/hardcoded date. While unset, the day-of tools
 * behave exactly as they do today: always free, and the pages say nothing about
 * an end (no invented deadline is ever shown). Once the owner sets
 * `VENDOR_DAYOF_FREE_UNTIL` (an ISO date/datetime), shops see "Free until …" on
 * the day-of tools pages, and the console stops opening after that instant.
 *
 * NEXT_PUBLIC because the same date drives both the shop-facing copy and (when
 * this module is asked) the server gate — one value, both sides agree.
 *
 * PURE below `vendorDayOfFreeUntilIso`: `nowMs` is passed in by the caller
 * (`Date.now()` at the call site), so the decision logic unit-tests under
 * `tsx --test` with no clock, no I/O, no `server-only` import.
 */

/**
 * The configured end of the free day-of-tools window, as an ISO string, or
 * `null` when the owner has not set one yet (the default — never invented).
 * An unparseable value is treated the same as unset (fail open to "still
 * free", matching "while unset the tools stay free").
 */
export function vendorDayOfFreeUntilIso(): string | null {
  const raw = process.env.NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL;
  if (!raw || !raw.trim()) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

/**
 * Is the day-of tools console still free at `nowMs`? True whenever no end date
 * is configured (today's behaviour, unchanged) or `nowMs` is on/before the
 * configured end. Mirrors `isVendorLaunchFreeWindowActive`'s inclusive-end,
 * fail-open-on-unset shape from `lib/vendor-launch-free-window.ts`.
 */
export function isVendorDayOfStillFree(
  freeUntilIso: string | null,
  nowMs: number,
): boolean {
  if (!freeUntilIso) return true;
  const end = Date.parse(freeUntilIso);
  if (Number.isNaN(end)) return true;
  if (!Number.isFinite(nowMs)) return true;
  return nowMs <= end;
}

/**
 * The shop-facing copy: `null` while unset (the pages render nothing — "the
 * copy says nothing about an end"); once set, "Free until <date>" (Manila,
 * long month) whether or not the date has already passed — the ended state
 * shows its own past-tense copy built from the same date, see
 * `vendorDayOfFreeUntilEndedLabel`.
 */
export function vendorDayOfFreeUntilLabel(freeUntilIso: string | null): string | null {
  if (!freeUntilIso) return null;
  const d = new Date(freeUntilIso);
  if (Number.isNaN(d.getTime())) return null;
  return `Free until ${d.toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })}`;
}

/** The past-tense copy for the console's ended state, or `null` when unset. */
export function vendorDayOfFreeUntilEndedLabel(freeUntilIso: string | null): string | null {
  if (!freeUntilIso) return null;
  const d = new Date(freeUntilIso);
  if (Number.isNaN(d.getTime())) return null;
  return `Your free day-of tools window ended ${d.toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })}.`;
}
