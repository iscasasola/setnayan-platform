'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { payPath } from '@/lib/pay-path';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { seating3dEnabled } from '@/lib/seating-3d-flag';
import { BOOTH_BRANDING_MIN_TIER } from '@/lib/seating-3d';
import { isVendor3dBoothActive } from '@/lib/vendor-3d-booth-pricing';
import {
  VENDOR_3D_BOOTH_EVENT_SKU_CODE,
  fetchVendor3dBoothEventPricePhp,
  fetchVendorBoothEventOrderState,
} from '@/lib/vendor-3d-booth-event-pricing';

/**
 * "Brand your booth at THIS wedding" — the ₱500 per-event 3D Booth (owner
 * 2026-09-05: "500 per event. or 3000/4 week cycle."). Mints an apply-then-pay
 * order scoped to (vendor, event) and sends the vendor to the one payment page.
 * The paid order row IS the grant (lib/vendor-3d-booth-event-pricing.ts) —
 * there is no window to stamp on approval, so nothing to forget.
 *
 * ── EVERY GATE THE CYCLE HAS, PLUS THE ONE A PER-EVENT SALE NEEDS ──────────
 *   1. signed in → their OWN shop (server-resolved) → owner/admin of it
 *   2. the 3D Plan kill-switch — if 3D is off there is nowhere to brand; never
 *      take money for it
 *   3. BOOKED ON THIS EVENT — `get_vendor_event_brief` is the SAME SECURITY
 *      DEFINER gate the client page mounts on; a shop with only an inquiry
 *      cannot brand a booth the couple has not placed
 *   4. the floor, owner verbatim: "unverified vendors cannot purchase here and
 *      free. only paid vendors (solo, pro and enterprise)" —
 *      BOOTH_BRANDING_MIN_TIER + verification_state = 'verified'
 *   5. the catalogue row is on sale; price re-read server-side
 *   6. NOT ALREADY BRANDED HERE — a live cycle covers this event already, and a
 *      paid or pending per-event order must not be sold twice
 */

export type BoothEventActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string };

function err(message: string): BoothEventActionState {
  return { status: 'error', message };
}

/** 'SN' + 8 uppercase hex — the branch / couple / cycle checkout reference format. */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function parseChannel(raw: FormDataEntryValue | null): 'bdo' | 'gcash' {
  return String(raw ?? '').trim() === 'gcash' ? 'gcash' : 'bdo';
}

export async function buyBoothBrandingForEvent(
  _prev: BoothEventActionState,
  formData: FormData,
): Promise<BoothEventActionState> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) return err('Invalid input');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 1 · own shop, and may manage it
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No shop found for this account.');
  const vendorProfileId = profile.vendor_profile_id;
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can buy 3D Booth branding.');
  }

  // 2 · feature backstop
  if (!seating3dEnabled()) {
    return err('The 3D Plan is switched off right now, so the booth can’t brand — you won’t be charged.');
  }

  // 3 · booked on THIS event — the same RPC the client page mounts on
  const { data: brief, error: briefErr } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  const stage = (brief as { stage?: string } | null)?.stage ?? null;
  if (briefErr || stage !== 'booked') {
    return err('You can brand a booth once the couple has booked you for this celebration.');
  }

  // 4 · the floor — paid plan AND verified
  const { data: gateRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state, booth_addon_expires_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const gate = gateRow as {
    tier_state?: string | null;
    verification_state?: string | null;
    booth_addon_expires_at?: string | null;
  } | null;
  if (!isTierAtLeast(gate?.tier_state ?? null, BOOTH_BRANDING_MIN_TIER)) {
    return err('3D Booth branding comes with a paid plan — Solo, Pro, Enterprise or Custom. Move up to add it.');
  }
  if (gate?.verification_state !== 'verified') {
    return err('Get your shop verified first — 3D Booth branding unlocks once you’re verified.');
  }

  // 5 · on sale, and the authoritative price
  const pricePhp = await fetchVendor3dBoothEventPricePhp(supabase);
  if (pricePhp == null) {
    return err('Per-event booth branding is temporarily unavailable. Please try again later.');
  }

  // 6 · not already branded here — read with the ADMIN client so a teammate's
  //     earlier order (a different user_id) is still seen
  const admin = createAdminClient();
  if (isVendor3dBoothActive(gate?.booth_addon_expires_at ?? null)) {
    return err('Your 3D Booth cycle already covers this celebration — nothing more to buy here.');
  }
  const existing = await fetchVendorBoothEventOrderState(admin, vendorProfileId, eventId);
  if (existing === 'active') return err('Your booth is already branded at this celebration.');
  if (existing === 'pending') {
    return err('Your payment for this celebration is still being checked — no need to pay again.');
  }

  // ── apply-then-pay: the order is the grant once the admin confirms it ──────
  const channel = parseChannel(formData.get('channel'));
  const referenceCode = generateReferenceCode();
  // SEC-4b · service-role mint. `orders` + `payments` INSERT are revoked from
  // `authenticated`; authorization is the six gates above, unchanged in order.
  // `eventId` IS set on this row — that scope is the whole product.
  const moneyWriter = createMoneyWriterClient();
  const { data: orderRow, error: oErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId, vendorProfileId },
        {
          service_key: VENDOR_3D_BOOTH_EVENT_SKU_CODE,
          description: '3D Booth — Branded at one event',
          requested_total_php: pricePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) return err('Could not start the booth branding order. Please try again.');
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await moneyWriter.from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: orderId },
      {
        amount_php: pricePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    // Same client that minted it — a mixed-client compensation silently stops rolling back.
    await moneyWriter.from('orders').delete().eq('order_id', orderId);
    return err('Could not start the booth branding payment. Please try again.');
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(payPath(referenceCode));
}
