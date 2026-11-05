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
 *   3. A FIRST SAVE ONLY ON A PHONE THAT HOLDS NOBODY ELSE'S COPY — owner, 5 Nov 2026: *"Yes to both"* (Home also saves
 *      the first copy for a guest who never opened Me, so the schedule opens with no signal for everyone). A copy THIS
 *      viewer already holds is refreshed; with none (`savedAtFor` null), a first save is asked ONLY when the phone
 *      keeps no unexpired copy of another viewer's (`holdsAnotherViewersCopies`) — the worker's one-viewer rule erases
 *      on a different viewer, so a quiet save must never replace somebody else's copies on a shared phone.
 *   4. NO LIVE CONNECTION — one message to the worker per due copy, from the page's mount; nothing polls.
 *
 * PURE — no I/O. Client-safe. Kept out of `lib/offline-copies.ts` so the shared bundle (bytes of room) never carries it.
 */

import { AUTO_REFRESH_AFTER_MS, offlineSavingOpen, type OfflineRegistry } from '@/lib/offline-copies';

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
  /** The phone keeps an unexpired copy of ANOTHER viewer's (`holdsAnotherViewersCopies`) — a first save would erase it. */
  anotherViewersCopies: boolean;
}): boolean {
  const { now, eventDate, eventEndDate = null, savedAt, lastTriedAt, anotherViewersCopies } = input;
  if (!offlineSavingOpen(eventDate, now, eventEndDate)) return false;
  const hasCopy = savedAt !== null && Number.isFinite(savedAt);
  // No copy of this viewer's: a FIRST save — only when it can erase nobody else's copies.
  if (!hasCopy && anotherViewersCopies !== false) return false;
  if (hasCopy && now - (savedAt as number) < QUIET_REFRESH_EVERY_MS) return false;
  if (lastTriedAt !== null && Number.isFinite(lastTriedAt) && lastTriedAt <= now && now - lastTriedAt < QUIET_REFRESH_EVERY_MS) {
    return false;
  }
  return true;
}

/**
 * Does the phone keep an unexpired copy belonging to somebody OTHER than `viewer`? A save by `viewer` would erase it
 * (the worker's one-viewer rule), so the quiet first save is not asked. Unreadable → true (when unsure, never erase).
 */
export function holdsAnotherViewersCopies(reg: OfflineRegistry | null, viewer: string, now: number, unreadable = false): boolean {
  if (unreadable) return true;
  if (!reg || reg.viewer === viewer) return false;
  return Object.values(reg.events).some((ev) => ev && ev.until > now && Object.keys(ev.pages ?? {}).length > 0);
}
