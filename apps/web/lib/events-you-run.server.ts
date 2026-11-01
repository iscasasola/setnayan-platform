import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActiveShop } from '@/lib/active-shop';
import { manilaToday } from '@/lib/std-views';
import { RUN_SEAT_ROLES, eventsYouRun, withNeeds, type CoordinatorSeatRow, type EventYouRun } from './events-you-run';
import { readEventDecisionCounts, readEventUnreadCounts, summarizeEventDecisions, type EventDecisionSummary } from './event-decisions';
import { checklistOverdueCount, readChecklistItems } from './checklist';

/**
 * events-you-run.server.ts — the ONE read behind the coordinator's door (owner "approved", 2026-10-28).
 *
 * The signed-in person's own coordinator AND co-host seats (owner 2026-10-29 — `RUN_SEAT_ROLES`), as THEMSELVES (the user client, their RLS — the same row
 * `app/dashboard/[eventId]/layout.tsx` reads to admit them), with the event's name, date and place embedded. The rule
 * that turns a row into a door is pure and lives in `events-you-run.ts`.
 *
 * `cache()` per request: the supplier layout (the Events tab), Today ("Events you run"), the Events page and the
 * customer card ("Open their event") all ask, and pay one trip between them.
 *
 * 🛑 …AND ONLY ON EVENTS THIS SHOP SERVES (fixed 2026-10-29 — the owner's own wedding was listed under his shop as
 * "Co-host"). Rule (a) in `events-you-run.ts`: the seat's event must carry a live `event_vendors` row whose
 * `marketplace_vendor_id` is the person's ACTIVE shop (`resolveActiveShop` — the one resolver every shop-scoped read
 * asks, on their own session). `event_vendors` has NO vendor SELECT policy (a shop's session reads 0 rows of its own
 * booking — `app/vendor-dashboard/a-shop-cannot-read-its-own-booking.test.ts`), so that one column is read with the
 * admin client, SCOPED BY THE SESSION-RESOLVED SHOP ID and to the seat read's own event ids, selecting `event_id`
 * alone — the sanctioned shape. The seats themselves are still read as the person.
 *
 * ⛔ FAILS CLOSED. A refused read — the seats, the active shop, or the shop's rows — is `{ events: [], measured:
 * false }`: no tab, no row, no button. A door drawn from a read that did not happen is a dead tab, which the owner ruled
 * out; and none of these is the coordinator's only way in (the events board's helper cards —
 * `fetchUserEvents(…, 'coordinator')` — still list the event). No shop at all is a MEASURED nothing: no event is one
 * "this shop" serves.
 */
export const readEventsYouRun = cache(
  async (supabase: SupabaseClient, userId: string): Promise<{ events: EventYouRun[]; measured: boolean }> => {
    const { data, error } = await supabase
      .from('event_moderators')
      .select(
        `event_id, role_subtype, permissions_json, accepted_at, removed_at,
         events:event_id ( event_id, display_name, event_type, event_date, event_end_date, event_date_precision, venue_name, date_candidates, date_window_start, created_at )`,
      )
      .eq('user_id', userId)
      .in('role_subtype', [...RUN_SEAT_ROLES])
      .not('accepted_at', 'is', null)
      .is('removed_at', null);
    if (error) {
      logQueryError('readEventsYouRun', error, { user_id: userId }, 'graceful_degrade');
      return { events: [], measured: false };
    }
    const seats = (data ?? []) as unknown as CoordinatorSeatRow[];
    if (seats.length === 0) return { events: [], measured: true };
    const served = await readShopEventIds(supabase, userId, [...new Set(seats.map((r) => r.event_id))]);
    if (served === null) return { events: [], measured: false };
    return { events: eventsYouRun(seats, new Date(), manilaToday(), served), measured: true };
  },
);

/**
 * (a) Of these events, the ones THIS SHOP is on: a live (`archived_at` null) `event_vendors` row whose
 * `marketplace_vendor_id` is the person's active shop. `null` = a read was refused (the caller fails closed); an empty
 * set = measured, none (or no shop at all).
 */
async function readShopEventIds(
  supabase: SupabaseClient,
  userId: string,
  eventIds: string[],
): Promise<ReadonlySet<string> | null> {
  let shopId: string | null;
  try {
    shopId = (await resolveActiveShop(supabase, userId))?.vendorProfileId ?? null;
  } catch (e) {
    logQueryError('readEventsYouRun.activeShop', e, { user_id: userId }, 'graceful_degrade');
    return null;
  }
  if (!shopId || eventIds.length === 0) return new Set();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_vendors')
    .select('event_id')
    .eq('marketplace_vendor_id', shopId)
    .in('event_id', eventIds)
    .is('archived_at', null);
  if (error) {
    logQueryError('readEventsYouRun.shopEvents', error, { user_id: userId, vendor_profile_id: shopId }, 'graceful_degrade');
    return null;
  }
  return new Set(((data ?? []) as Array<{ event_id: string }>).map((r) => r.event_id));
}

/**
 * The same rows WITH what needs them — for the two surfaces that print it (Today's "Events you run" and the Events
 * tab). The layout's tab and the customer card's door only ask WHETHER, so they read `readEventsYouRun` and pay for
 * none of the attention reads.
 */
export const readEventsYouRunWithNeeds = cache(
  async (supabase: SupabaseClient, userId: string): Promise<{ events: EventYouRun[]; measured: boolean }> => {
    const base = await readEventsYouRun(supabase, userId);
    if (!base.measured || base.events.length === 0) return base;
    return { events: await attachNeeds(supabase, base.events, manilaToday()), measured: true };
  },
);

/**
 * 🔔 WHAT NEEDS THEM, per row (owner 2026-10-28) — the events board's OWN attention read, reused as it ships: the
 * batched pay + approve counts (`readEventDecisionCounts`, two queries for every row), the person's unread chats by
 * event (`readEventUnreadCounts`, one RPC), and each event's overdue tasks (`readChecklistItems` →
 * `checklistOverdueCount`, the same anchor and runway the board and the checklist page use; none after the event, as
 * on the board). Folded by the board's own `summarizeEventDecisions`.
 *
 * ⛔ A REFUSED READ IS SAID. Any of the three refused → that row's summary is `null` → "Couldn’t load what needs you",
 * never "Nothing needs you right now". Asked only when there is a row (nobody else pays for it).
 */
async function attachNeeds(supabase: SupabaseClient, events: EventYouRun[], todayIso: string): Promise<EventYouRun[]> {
  if (events.length === 0) return events;
  const ids = events.map((e) => e.eventId);
  const [counts, unread, lists] = await Promise.all([
    readEventDecisionCounts(supabase, ids).catch(() => null),
    readEventUnreadCounts(supabase).catch(() => null),
    Promise.all(events.map((e) => (e.rank === 2 ? Promise.resolve([]) : readChecklistItems(supabase, e.eventId).catch(() => null)))),
  ]);
  const summaries = new Map<string, EventDecisionSummary | null>();
  events.forEach((e, i) => {
    const items = lists[i];
    if (counts === null || unread === null || items === null || items === undefined) {
      summaries.set(e.eventId, null);
      return;
    }
    const c = counts.get(e.eventId) ?? { pay: 0, approve: 0 };
    summaries.set(
      e.eventId,
      summarizeEventDecisions({
        pay: c.pay,
        approve: c.approve,
        message: unread.get(e.eventId) ?? 0,
        overdue: e.rank === 2 ? 0 : checklistOverdueCount(items, e.anchor, todayIso),
      }),
    );
  });
  return withNeeds(events, summaries);
}
