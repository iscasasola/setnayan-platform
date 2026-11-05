import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * THE COUPLE HEARS "BOOKED" WHEN THE FEE SETTLES — the confirmation held back
 * at the supplier's yes because the fee was billed and unpaid (owner
 * 2026-10-07: "no handshake, no confirmation of the event being booked to them
 * · meaning. no booking fee paid to us"; 2026-10-12 #1; audit F6 / item 13).
 *
 * Called by the booking-fee settle hook (`lib/sku-activation.ts`) ONLY when the
 * charge flipped to paid just now, so it sends once. It says nothing about a
 * fee (R12, owner #14): to the couple, the supplier has finished saying yes.
 *
 * Only a PRIMARY lock charge on a booking the supplier AGREED to is a held-back
 * yes; an amendment top-up, or a booking confirmed some other way (a direct
 * lock while the handshake flag is off, a Locked-QR claim — whose couple was
 * told at the time), sends nothing here. Fully fail-soft: the payment approval
 * is committed and must not be undone by a notification.
 */
export async function tellCoupleTheBookingIsConfirmed(
  admin: SupabaseClient,
  chargeId: string,
): Promise<void> {
  try {
    const { data: charge, error } = await admin
      .from('booking_fee_charges')
      .select('event_vendor_id, kind, source')
      .eq('charge_id', chargeId)
      .maybeSingle();
    if (error) {
      logQueryError('couple-booking-confirmed.charge', error, { chargeId });
      return;
    }
    const c = charge as { event_vendor_id?: string | null; kind?: string; source?: string } | null;
    if (!c?.event_vendor_id || c.kind !== 'primary' || c.source !== 'lock') return;

    const { data: ev, error: evErr } = await admin
      .from('event_vendors')
      .select('event_id, vendor_name, lock_request_state, archived_at')
      .eq('vendor_id', c.event_vendor_id)
      .maybeSingle();
    if (evErr) {
      logQueryError('couple-booking-confirmed.booking', evErr, { chargeId });
      return;
    }
    const row = ev as {
      event_id?: string | null;
      vendor_name?: string | null;
      lock_request_state?: string | null;
      archived_at?: string | null;
    } | null;
    if (!row?.event_id || row.archived_at || row.lock_request_state !== 'agreed') return;

    const vendorName = row.vendor_name ?? 'Your supplier';
    const { data: members, error: mErr } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', row.event_id)
      .eq('member_type', 'couple');
    if (mErr) {
      logQueryError('couple-booking-confirmed.members', mErr, { chargeId });
      return;
    }
    for (const m of (members ?? []) as Array<{ user_id: string | null }>) {
      if (!m.user_id) continue;
      await emitNotification({
        userId: m.user_id,
        type: 'lock_request_agreed',
        title: `${vendorName} said yes`,
        body: `${vendorName} confirmed your booking. Open the workspace to see your payment plan and how to pay them.`,
        relatedUrl: `/dashboard/${row.event_id}/vendors/${c.event_vendor_id}/workspace#payments`,
      });
    }
  } catch (e) {
    console.warn(`[couple-booking-confirmed] notify failed for charge ${chargeId}:`, e);
  }
}
