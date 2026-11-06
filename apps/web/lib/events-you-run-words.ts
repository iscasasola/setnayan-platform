/**
 * The coordinator door's words and address, with NO imports — so the client bar and rail can name the Events tab
 * without pulling the access rule (`events-you-run.ts`) into the browser bundle. Owner "approved", 2026-10-28.
 */

/** Where "Events you run" lives — the Hub, since "Events" folded into it (owner 2026-10-29). */
export const EVENTS_YOU_RUN_HREF = '/vendor-dashboard/on-the-day';

/** The ⓘ under the list (prototype frame B, owner-approved words). */
export const EVENTS_YOU_RUN_TIP = 'An event leaves this list when its hosts turn your access off, or after the event.';

/** The line under the Events page's heading (prototype frame B). */
/** …or a co-host (owner 2026-10-29: "similar to adding them as a cohost"). */
export const EVENTS_YOU_RUN_LEDE = 'Events where the hosts made you their coordinator or a co-host.';
