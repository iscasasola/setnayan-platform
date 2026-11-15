import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { CLOSED_DAY_COUPLE_MESSAGE, civilDay, isClosedDay, monthOf } from '@/lib/closed-day';
import { checkDateToday, readShopDateFacts } from '@/lib/check-a-date.server';

/**
 * 🔒 A DAY THE SUPPLIER CLOSED TAKES NO ASK AND NO YES.
 *
 * The approved date sheet (`/v/[slug]/dates`, `lib/check-a-date.ts`) shows a couple every day the shop closed as
 * "Not bookable". Until this file, a card with NO time slots was not refused on such a day when the couple asked,
 * nor when the supplier said yes — only when the deposit was recorded (`acquire_schedule_pools`). The slot path was
 * already refused at the yes (`acquire_service_time_slot` → `blocked` / `locked`); this is the date-only twin.
 *
 * ONE SOURCE: the same six reads the date sheet draws from (`readShopDateFacts`) and the same month builder
 * (`checkDateAnswer`), never a second reading of the calendar. The rule — closed, not merely full; only blocks the
 * supplier chose; held days — is pure, in `lib/closed-day.ts`.
 *
 * ⚖ FAILS OPEN, LOGGED. A read the couple cannot act on must not block their ask (the same rule as every capacity read
 * in `finalizeVendor`); the deposit-time gate (`acquire_schedule_pools`) still refuses the closed day after.
 */

export { CLOSED_DAY_COUPLE_MESSAGE };

/**
 * Is `day` closed by the shop for this card? `'closed'` when it is, `null` when it is open, when the day is in the
 * past, when the ask books a time slot (the slot path answers that), or when the calendar could not be read.
 */
export async function closedDayRefusal(args: {
  vendorProfileId: string | null | undefined;
  /** The card on the couple's booking row (`event_vendors.service_id`). null = the shop as a whole. */
  serviceId: string | null | undefined;
  /** The event's day — only a day-precise event has one (a month-only event is stored as the 1st). */
  day: unknown;
  /** The ask carries a time slot: the slot path decides, not this. */
  slotted?: boolean;
  admin?: SupabaseClient;
  now?: Date;
}): Promise<'closed' | null> {
  const day = civilDay(args.day);
  if (!args.vendorProfileId || !day || args.slotted) return null;
  const today = checkDateToday(args.now);
  if (day < today) return null;

  const admin = args.admin ?? createAdminClient();
  const span = monthOf(day);
  const facts = await readShopDateFacts(admin, args.vendorProfileId, { today, from: span.from, to: span.to });
  if (facts.kind !== 'ok') {
    console.error('[closedDayRefusal] the calendar could not be read — not refused here', {
      vendor_profile_id: args.vendorProfileId,
      day,
    });
    return null;
  }

  return isClosedDay(facts, { serviceId: args.serviceId ?? null, day, today }) ? 'closed' : null;
}

/**
 * The supplier's yes (`vendorAgreeToLock`): is the day of THIS ask one the shop closed? The ask is read through the
 * supplier's OWN session — RLS answers whether it is theirs to answer, so a stranger's id reads nothing and is refused
 * nothing here (the RPC refuses it). Only then is the event's day read on the service role: a fact the supplier's
 * brief already carries for an ask, and it never leaves this function — only `'closed'` or `null` does.
 */
export async function closedDayOfAsk(
  supabase: SupabaseClient,
  eventVendorId: string,
  admin: SupabaseClient = createAdminClient(),
): Promise<'closed' | null> {
  const { data: ev, error } = await supabase
    .from('event_vendors')
    .select('event_id, marketplace_vendor_id, service_id, service_time_slot_id')
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  if (error || !ev) return null;
  const row = ev as { event_id: string; marketplace_vendor_id: string | null; service_id: string | null; service_time_slot_id: string | null };
  if (!row.marketplace_vendor_id) return null;
  const { data: e, error: eErr } = await admin
    .from('events')
    .select('event_date, event_date_precision')
    .eq('event_id', row.event_id)
    .maybeSingle();
  if (eErr) {
    console.error('[closedDayOfAsk] event day unreadable — not refused here', eventVendorId, eErr.message);
    return null;
  }
  const d = e as { event_date?: string | null; event_date_precision?: string | null } | null;
  if (d?.event_date_precision !== 'day') return null;
  return closedDayRefusal({
    vendorProfileId: row.marketplace_vendor_id,
    serviceId: row.service_id,
    day: d.event_date,
    slotted: !!row.service_time_slot_id,
    admin,
  });
}
