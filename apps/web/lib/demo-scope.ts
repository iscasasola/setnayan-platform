/**
 * DEMO SCOPE — which shops an event may find, and which it may book. Written ONCE.
 *
 * Owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS" / "DEMO CATALOGUE — scope" / "Demo catalogue — owner
 * clicks": demo shops (`vendor_profiles.is_demo`) and demo events (`events.is_sample`) show publicly beside real ones,
 * marked "(DEMO ONLY)" — but
 *   · *"a couple can never book or pay a demo shop"*,
 *   · real couples see demo shops on Explore and the front page *"but never inside their own event's supplier search"*,
 *   · *"The goal is the demo events can only see demo suppliers to try to run suppliers as well."*
 *
 * So the rule is one equality: **an event and a shop belong together only when `events.is_sample` equals
 * `vendor_profiles.is_demo`.** A real event finds and books only real shops; a demo event finds and books only demo
 * shops. The same equality is enforced in the database by `public.refuse_demo_cross_booking()` (trigger on every
 * book / pay / message table), so a write that forgets this helper still cannot land.
 *
 * 🔒 FAIL CLOSED, BOTH WAYS. An event whose `is_sample` cannot be read is treated as REAL (it then finds no demo shop —
 * the safe direction for a real couple). A write whose event or shop cannot be read is REFUSED ({@link
 * bookingScopeRefusal}); `actions.ts` deny-by-absence is correct here (CLAUDE.md).
 *
 * Held by `lib/demo-scope.test.ts` (the pure rule), `lib/a-real-event-never-finds-a-demo-shop.test.ts` (every
 * supplier-search reader asks this module), `lib/a-real-event-never-books-a-demo-shop.test.ts` (every write path asks
 * it) and `tests/db/a-real-event-never-books-a-demo-shop.db.test.ts` (the trigger).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** The one filter a supplier search applies: `.eq('is_demo', scope.is_demo)` on `vendor_profiles`. */
export type DemoScope = { is_demo: boolean };

/** What a refused write tells the couple (real event → demo shop). */
export const DEMO_SHOP_CANNOT_BE_BOOKED = "This is a demo shop — it can't be booked.";

/** What a refused write tells a demo event that reached for a real shop. */
export const DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY = 'This is a demo event — it can only book demo shops.';

/** The `RAISE` prefix `public.refuse_demo_cross_booking()` uses, so an action can translate the database's refusal. */
export const DEMO_CROSS_BOOKING_DB_MARKER = 'demo_cross_booking';

/** PURE. The scope an event searches in. Anything but a literal `true` is a real event. */
export function demoScopeOfEvent(event: { is_sample?: unknown } | null | undefined): DemoScope {
  return { is_demo: event?.is_sample === true };
}

/** PURE. May this event and this shop meet (search, message, book, pay)? */
export function eventMayMeetShop(
  event: { is_sample?: unknown } | null | undefined,
  shop: { is_demo?: unknown } | null | undefined,
): boolean {
  return demoScopeOfEvent(event).is_demo === (shop?.is_demo === true);
}

/**
 * PURE. Why a write between this event and this shop is refused, or `null` when it may go ahead.
 * An unread event or shop (null) is refused — never assumed real.
 */
export function bookingScopeRefusal(
  event: { is_sample?: unknown } | null | undefined,
  shop: { is_demo?: unknown } | null | undefined,
): string | null {
  if (!event || !shop) return DEMO_SHOP_CANNOT_BE_BOOKED;
  if (eventMayMeetShop(event, shop)) return null;
  return event.is_sample === true ? DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY : DEMO_SHOP_CANNOT_BE_BOOKED;
}

/** PURE. Turn the database trigger's refusal into the couple's line; `null` when the error is something else. */
export function demoRefusalFromDbError(error: { message?: string | null } | null | undefined): string | null {
  const m = error?.message ?? '';
  if (!m.includes(DEMO_CROSS_BOOKING_DB_MARKER)) return null;
  return m.includes('demo event') ? DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY : DEMO_SHOP_CANNOT_BE_BOOKED;
}

/**
 * The scope an event's supplier search uses. Reads `events.is_sample` with the client handed in (service role is
 * fine: one boolean, no row data). A failed read → `{ is_demo: false }` (a real event): a real couple must never be
 * shown a demo shop because a read failed.
 */
export async function demoScopeFor(admin: SupabaseClient, eventId: string | null | undefined): Promise<DemoScope> {
  if (!eventId) return { is_demo: false };
  try {
    const { data, error } = await admin.from('events').select('is_sample').eq('event_id', eventId).maybeSingle();
    if (error) {
      console.error('[supabase-error] lib/demo-scope.ts · from:events.select(is_sample)', error);
      return { is_demo: false };
    }
    return demoScopeOfEvent(data as { is_sample?: unknown } | null);
  } catch (err) {
    console.error('[supabase-error] lib/demo-scope.ts · from:events.select(is_sample) threw', err);
    return { is_demo: false };
  }
}

/**
 * The server-side half of the write rule: read the event's `is_sample` and the shop's `is_demo`, and return the line to
 * show when they do not belong together (or either cannot be read). `null` = the write may go ahead. The database
 * trigger is the other half; this one exists so the couple sees a sentence, not a database error.
 */
export async function demoBookingRefusal(
  admin: SupabaseClient,
  ids: { eventId: string | null | undefined; vendorProfileId: string | null | undefined },
): Promise<string | null> {
  // No event (a shop-level message with no event yet) or no shop: nothing to pair, nothing to refuse here.
  if (!ids.eventId || !ids.vendorProfileId) return null;
  try {
    const [ev, shop] = await Promise.all([
      admin.from('events').select('is_sample').eq('event_id', ids.eventId).maybeSingle(),
      admin.from('vendor_profiles').select('is_demo').eq('vendor_profile_id', ids.vendorProfileId).maybeSingle(),
    ]);
    if (ev.error || shop.error) {
      console.error('[supabase-error] lib/demo-scope.ts · demoBookingRefusal read', ev.error ?? shop.error);
      return DEMO_SHOP_CANNOT_BE_BOOKED;
    }
    return bookingScopeRefusal(
      ev.data as { is_sample?: unknown } | null,
      shop.data as { is_demo?: unknown } | null,
    );
  } catch (err) {
    console.error('[supabase-error] lib/demo-scope.ts · demoBookingRefusal threw', err);
    return DEMO_SHOP_CANNOT_BE_BOOKED;
  }
}
