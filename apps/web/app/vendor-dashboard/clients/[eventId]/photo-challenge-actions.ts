'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { eventPapicActive } from '@/lib/papic-seats';
import {
  VENDOR_PHOTO_CHALLENGE_SKU_CODE,
  resolveVendorPhotoChallengePricePhp,
  photoChallengeEligibility,
  fetchPhotoChallengeSponsored,
  PHOTO_CHALLENGE_DENY_MESSAGE,
} from '@/lib/vendor-photo-challenge';

/**
 * Photo Challenge add-on — a booked Pro/Enterprise vendor SPONSORS guest photo
 * challenges (the flag-dark Papic Games / missions feature) for one booked event
 * where Papic is active. Owner-locked 2026-07-22: FLAT ₱400 / EVENT (metered,
 * NOT a subscription → NO free first cycle; the owner set a trial only for the
 * AI + 3D add-ons). Guests + couple play free; the vendor pays ₱400.
 *
 * ── WHY the gate + price re-check is HERE, server-side ──────────────────────
 * Nothing else gates a vendor add-on on the orders spine. This action is the
 * ONLY gate: it rejects — BEFORE pricing — any of tier < Pro, unverified,
 * not-booked-on-the-event, Papic-not-active, or already-sponsored, then re-reads
 * the ₱400 authoritative price + the SKU's is_active flag from the admin-managed
 * vendor_billing_catalog (mirrors the AI-addon action). The client sends only
 * the event id + pay channel — never a price.
 *
 * Apply-then-pay: a 'submitted' order (event_id + vendor_profile_id set,
 * service_key='vendor_photo_challenge') + a pending 'payments' row that lands in
 * /admin/payments. On admin approval, the sku-activation hook
 * (lib/sku-activation.ts · 'vendor_photo_challenge') writes the
 * papic_photo_challenge_sponsorships entitlement, which the
 * papic_create_vendor_challenge RPC requires before a vendor may author a
 * challenge.
 */

export type PhotoChallengeActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** Apply-then-pay order created — pay by reference, activates on admin approval. */
  | { status: 'ordered'; referenceCode: string; amountPhp: number; message: string };

function err(message: string): PhotoChallengeActionState {
  return { status: 'error', message };
}

/** 'SN' + 8 uppercase hex — matches the branch / couple / AI-addon reference format. */
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

/** Booked = a contracted-or-further event_vendors row (mirrors the challenge RPC). */
const BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

export async function sponsorPhotoChallenge(
  _prev: PhotoChallengeActionState,
  formData: FormData,
): Promise<PhotoChallengeActionState> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return err('Missing event.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No vendor profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can sponsor a Photo Challenge.');
  }

  const admin = createAdminClient();

  // ── Gather the gate inputs (all reads BEFORE pricing) ──────────────────────
  // tier_state + verification_state are not in FULL_VENDOR_PROFILE_SELECT — soft
  // probe them together.
  const { data: gateRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (gateRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const verification =
    (gateRow as { verification_state?: string | null } | null)?.verification_state ?? null;

  // Booked on THIS event (admin-read: event_vendors is couple-scoped; we filter
  // by our own marketplace_vendor_id so this only ever matches our own booking).
  const { data: bookedRow } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', BOOKED_STATUSES as unknown as string[])
    .limit(1)
    .maybeSingle();
  const booked = bookedRow != null;

  // Papic active on the event (admin-read: paparazzi_seats + couple orders are
  // couple-RLS — the vendor can't see them under their own session).
  const papicActive = booked ? await eventPapicActive(admin, eventId) : false;

  // Already sponsored? (admin-read for authority.)
  const alreadySponsored = await fetchPhotoChallengeSponsored(admin, eventId, vendorProfileId);

  const eligibility = photoChallengeEligibility({
    tier,
    verification,
    booked,
    papicActive,
    alreadySponsored,
  });
  if (!eligibility.ok) {
    return err(PHOTO_CHALLENGE_DENY_MESSAGE[eligibility.reason]);
  }

  // ── Re-read the authoritative ₱400 price + is_active from the catalog ───────
  // (mirrors the AI-addon is_active guard.) A retired SKU (row exists,
  // is_active=false) blocks the sale; a missing row falls back to ₱400.
  const { data: skuRow } = await supabase
    .from('vendor_billing_catalog')
    .select('price_php, is_active')
    .eq('sku_code', VENDOR_PHOTO_CHALLENGE_SKU_CODE)
    .maybeSingle();
  if (skuRow && (skuRow as { is_active?: boolean | null }).is_active === false) {
    return err('Photo Challenge is temporarily unavailable. Please try again later.');
  }
  const cyclePricePhp =
    skuRow && (skuRow as { is_active?: boolean | null }).is_active !== false
      ? Number((skuRow as { price_php: number | string }).price_php)
      : null;
  const pricePhp = resolveVendorPhotoChallengePricePhp(cyclePricePhp);

  // ── Apply-then-pay: a submitted order + a pending payment row ───────────────
  const channel = parseChannel(formData.get('channel'));
  const referenceCode = generateReferenceCode();

  const { data: orderRow, error: oErr } = await supabase
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      vendor_profile_id: vendorProfileId,
      service_key: VENDOR_PHOTO_CHALLENGE_SKU_CODE,
      description: 'Photo Challenge (per event)',
      requested_total_php: pricePhp,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the Photo Challenge order. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount_php: pricePhp,
    channel,
    reference_number: null,
    screenshot_url: null,
    paid_at: new Date().toISOString().slice(0, 10),
  });
  if (pErr) {
    await supabase.from('orders').delete().eq('order_id', orderId);
    return err('Could not start the Photo Challenge payment. Please try again.');
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  return {
    status: 'ordered',
    referenceCode,
    amountPhp: pricePhp,
    message: `Order started. Pay ₱${pricePhp.toLocaleString('en-PH')} with reference ${referenceCode} — Photo Challenge unlocks once our team confirms your payment (within 24 hours).`,
  };
}
