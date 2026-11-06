import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * Does this SHOP hold a confirmed booking on this EVENT? (owner 2026-11-04, "Viber and phone call booked suppliers").
 *
 * The existing source of truth, not a new one: `event_vendors.status` in `CONFIRMED_VENDOR_STATUSES` (contracted ·
 * deposit_paid · delivered · complete) for the row whose `marketplace_vendor_id` is the shop — the same set the
 * database's `current_vendor_booked_event_ids()` uses for "a booked vendor" (and which gates a supplier's appointment
 * insert). A marketplace shop reaches it only through the lock handshake, never by a couple's hand-recorded payment.
 *
 * Read with the service client because a SUPPLIER cannot read `event_vendors` under RLS; every caller has already
 * proved the caller belongs to this (event, shop) pair — a thread they are a party to, or an appointment RLS let them
 * read — and this answers one yes/no about that pair. FAILS CLOSED: any error reads as "not booked".
 */
export async function shopIsBookedOnEvent(
  eventId: string | null | undefined,
  vendorProfileId: string | null | undefined,
): Promise<boolean> {
  if (!eventId || !vendorProfileId) return false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', vendorProfileId)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
      .limit(1);
    if (error) {
      logQueryError('shopIsBookedOnEvent', error, { event_id: eventId, vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return false;
    }
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/**
 * The phone the OTHER side of a booked thread can be called on. Null unless booked — the number is never even read
 * before the booking (a value never fetched cannot leak).
 *   • viewer = couple → the shop's own `vendor_profiles.contact_phone`;
 *   • viewer = shop   → the couple's own saved phone (`users.phone` of the event's couple members), first one saved.
 */
export async function bookedCounterpartyPhone(opts: {
  booked: boolean;
  viewer: 'couple' | 'vendor';
  eventId: string;
  vendorProfileId: string;
}): Promise<string | null> {
  if (opts.booked !== true) return null;
  // A refused read still answers null (no buttons), but it is logged — so "refused" and "no number saved" are no
  // longer the same silent null (same pattern as shopIsBookedOnEvent above).
  const ctx = { event_id: opts.eventId, vendor_profile_id: opts.vendorProfileId };
  try {
    const admin = createAdminClient();
    if (opts.viewer === 'couple') {
      const { data, error } = await admin
        .from('vendor_profiles')
        .select('contact_phone')
        .eq('vendor_profile_id', opts.vendorProfileId)
        .maybeSingle();
      if (error) {
        logQueryError('bookedCounterpartyPhone.shop', error, ctx, 'graceful_degrade');
        return null;
      }
      return ((data as { contact_phone?: string | null } | null)?.contact_phone ?? '').trim() || null;
    }
    const { data: members, error: membersError } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', opts.eventId)
      .eq('member_type', 'couple');
    if (membersError) {
      logQueryError('bookedCounterpartyPhone.couple', membersError, ctx, 'graceful_degrade');
      return null;
    }
    const ids = ((members ?? []) as Array<{ user_id: string | null }>).map((m) => m.user_id).filter((x): x is string => !!x);
    if (ids.length === 0) return null;
    const { data: users, error: usersError } = await admin.from('users').select('user_id, phone').in('user_id', ids);
    if (usersError) {
      logQueryError('bookedCounterpartyPhone.couplePhone', usersError, ctx, 'graceful_degrade');
      return null;
    }
    for (const u of (users ?? []) as Array<{ phone: string | null }>) {
      if (u.phone?.trim()) return u.phone.trim();
    }
    return null;
  } catch (err) {
    logQueryError('bookedCounterpartyPhone', err, ctx, 'graceful_degrade');
    return null;
  }
}
