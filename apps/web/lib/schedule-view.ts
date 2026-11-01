/**
 * lib/schedule-view.ts — 🧭 the Schedule's views and the one that is gone.
 *
 * Owner 2026-11-01: *"i don't think we need journey anymore? since everything from event created can be a chapter"*
 * (DECISION_LOG "JOURNEY IS REMOVED"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §6b). The Schedule keeps Planning Stage and
 * Event Day (chapters arrive inside them). Journey held nothing of its own — it was "PURE AGGREGATION" over the
 * Preparation agenda, `events` and `event_recaps` — so nothing is lost: the story stays on Post Event.
 *
 * Every door is kept (owner 2026-10-28: all mapping is kept): an address that still says `?view=journey` — a
 * bookmark, an old notice, a link not yet changed — lands on Planning Stage. The page calls this BEFORE it forwards
 * its view on to Suppliers › Booked or the Maker, so every one of those doors lands there too.
 *
 * 🔒 lib/journey-is-gone.test.ts
 */

/** The views the Schedule still has. */
export const SCHEDULE_VIEWS = ['preparation', 'event-day'] as const;
export type ScheduleView = (typeof SCHEDULE_VIEWS)[number];

/** Views that no longer exist, and the view each one now lands on. */
export const RETIRED_SCHEDULE_VIEWS: Readonly<Record<string, ScheduleView>> = { journey: 'preparation' };

/** `?view=` as asked, with a retired view forwarded to the view that replaced it. Anything else passes through. */
export function forwardScheduleView(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return Object.prototype.hasOwnProperty.call(RETIRED_SCHEDULE_VIEWS, raw) ? RETIRED_SCHEDULE_VIEWS[raw] : raw;
}
