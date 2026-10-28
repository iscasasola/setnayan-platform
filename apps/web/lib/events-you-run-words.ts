/**
 * The coordinator door's words and address, with NO imports — so the client bar and rail can name the Events tab
 * without pulling the access rule (`events-you-run.ts`) into the browser bundle. Owner "approved", 2026-10-28.
 */

/** The tab's and the list's room. */
export const EVENTS_YOU_RUN_HREF = '/vendor-dashboard/events';

/** The ⓘ under the list (prototype frame B, owner-approved words). */
export const EVENTS_YOU_RUN_TIP = 'An event leaves this list when its hosts turn your access off, or after the event.';

/** The line under the Events page's heading (prototype frame B). */
export const EVENTS_YOU_RUN_LEDE = 'Events where the hosts made you their coordinator.';
