/**
 * 🔕 THE QUIET REFRESH OF A GUEST'S SAVED SCHEDULE — owner-approved 5 Nov 2026, item 1 of the "Your schedule saved for
 * no signal" follow-up: *Home and the Event Hub quietly refresh the guest's saved copy of the Schedule, at most every
 * 30 minutes, around event days. Only the Schedule page itself shows freshness.*
 *
 * It is NOT a second saving mechanism. The copy is the one EV3 keeps (`lib/offline-copies.ts`, `public/sw.js` "THE
 * SAVED COPY FOR A NO-SIGNAL VENUE"); the guest's copy is Event Hub › Me (`/<slug>?tab=me`), first saved when the guest
 * opens Me. Home (`/dashboard`) and the Hub's other tabs only ask the worker to re-render THAT copy (`OFFLINE_SAVE`,
 * never forced) — with no mark, no line, no spinner. The freshness line ("Saved for offline · updated …", amber
 * "No signal · showing the copy from …") stays on Me alone (`ScheduleSavedMark`).
 *
 * THE RULES (each held by `lib/quiet-schedule-refresh.test.ts`):
 *   1. AT MOST EVERY 30 MINUTES — the same ceiling the worker already uses (`AUTO_REFRESH_AFTER_MS`, one number, never
 *      a second constant): not while the copy is younger than that, and not within that of the last quiet TRY (a try
 *      that failed counts — a server that is down is not asked again on every page open).
 *   2. ONLY AROUND EVENT DAYS — the window copies are kept in at all (`offlineSavingOpen`: T-3 days → the day after,
 *      Philippine time). Outside it nothing is asked; a dateless event never.
 *   3. A REFRESH, NEVER A FIRST SAVE — only a copy THIS viewer already holds (`savedAtFor` is null for none, another
 *      viewer's, or an expired one). So it can never wipe somebody else's copies on a shared phone (the worker's
 *      one-viewer rule erases on a different viewer) and never renders Me for a guest who has not opened it.
 *   4. NO LIVE CONNECTION — one message to the worker per due copy, from the page's mount; nothing polls.
 *
 * PURE — no I/O. Client-safe. Kept out of `lib/offline-copies.ts` so the shared bundle (bytes of room) never carries it.
 */

import { AUTO_REFRESH_AFTER_MS, offlineSavingOpen } from '@/lib/offline-copies';

/** The ceiling — the worker's own 30 minutes. */
export const QUIET_REFRESH_EVERY_MS = AUTO_REFRESH_AFTER_MS;

/** Where a page remembers its last quiet try of one copy (per-browser convenience; the worker's skip is the backstop). */
export const QUIET_TRIED_KEY_PREFIX = 'sn-quiet-schedule:';

/** At most this many copies are asked for from one page (a guest has one or two events around any day). */
export const QUIET_MAX_COPIES = 4;

export type QuietCopy = {
  /** The registry key — for a guest's Me, the slug. */
  eventKey: string;
  eventDate: string | null;
  eventEndDate?: string | null;
  /** `/<slug>?tab=me` (`guestMePath`). */
  path: string;
};

export function quietRefreshDue(input: {
  now: number;
  eventDate: string | null;
  eventEndDate?: string | null;
  /** When THIS viewer's copy was saved (`savedAtFor`), or null — none, another viewer's, or expired. */
  savedAt: number | null;
  /** The last quiet try of this copy from this browser, or null. */
  lastTriedAt: number | null;
}): boolean {
  const { now, eventDate, eventEndDate = null, savedAt, lastTriedAt } = input;
  if (!offlineSavingOpen(eventDate, now, eventEndDate)) return false;
  if (savedAt === null || !Number.isFinite(savedAt)) return false;
  if (now - savedAt < QUIET_REFRESH_EVERY_MS) return false;
  if (lastTriedAt !== null && Number.isFinite(lastTriedAt) && lastTriedAt <= now && now - lastTriedAt < QUIET_REFRESH_EVERY_MS) {
    return false;
  }
  return true;
}
