'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { hasPaidUnliUpgrade } from '@/lib/vendor-papic-grants';
import {
  VENDOR_PAPIC_UNLI_UPGRADE_PHP,
  VENDOR_PAPIC_UNLI_UPGRADE_SKU,
} from '@/lib/vendor-papic-tier';
import { mintPapicReferenceCode } from '@/lib/papic-cameras';

/**
 * Start the +₱50 event-scoped Papic Unli upgrade for the vendor's on-the-day
 * capture (owner-locked 2026-07-18). Apply-then-pay: creates a 'submitted' order
 * the Setnayan team reconciles; approval fires the VENDOR_PAPIC_UNLI_UPGRADE hook
 * in lib/sku-activation.ts, which upserts the (vendor,event) grant to tier='unli'.
 *
 * Idempotent: returns `alreadyUnli` when a paid upgrade exists, and re-uses a
 * still-pending order instead of minting duplicate reference codes.
 *
 * Counsel-gated — refuses while isVendorPapicCaptureEnabled() is off.
 */
export type StartUnliUpgradeResult =
  | { ok: true; alreadyUnli: true }
  | {
      ok: true;
      alreadyUnli?: false;
      referenceCode: string;
      orderPublicId: string;
      amountPhp: number;
      pending: boolean;
    }
  | { ok: false; error: string };

export async function startVendorPapicUnliUpgrade(
  eventId: string,
): Promise<StartUnliUpgradeResult> {
  if (!eventId) return { ok: false, error: 'no_event' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  if (!(await isVendorPapicCaptureEnabled())) {
    return { ok: false, error: 'disabled' };
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'no_vendor' };
  const vendorProfileId = profile.vendor_profile_id;

  const admin = createAdminClient();

  // Already upgraded (a paid Unli grant) → nothing to buy.
  if (await hasPaidUnliUpgrade(admin, vendorProfileId, eventId)) {
    return { ok: true, alreadyUnli: true };
  }

  // Re-use a still-pending upgrade order rather than minting duplicates.
  const { data: existing } = await admin
    .from('orders')
    .select('public_id, reference_code')
    .eq('service_key', VENDOR_PAPIC_UNLI_UPGRADE_SKU)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('event_id', eventId)
    .in('status', ['submitted', 'awaiting_payment'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const row = existing as { public_id: string; reference_code: string };
    return {
      ok: true,
      referenceCode: row.reference_code,
      orderPublicId: row.public_id,
      amountPhp: VENDOR_PAPIC_UNLI_UPGRADE_PHP,
      pending: true,
    };
  }

  const referenceCode = mintPapicReferenceCode();
  const { data: order, error } = await admin
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      vendor_profile_id: vendorProfileId,
      service_key: VENDOR_PAPIC_UNLI_UPGRADE_SKU,
      description: 'Papic Unli upgrade — on-the-day capture',
      requested_total_php: VENDOR_PAPIC_UNLI_UPGRADE_PHP,
      reference_code: referenceCode,
      status: 'submitted',
      platform: 'web',
    })
    .select('order_id, public_id')
    .maybeSingle();
  if (error || !order) {
    return { ok: false, error: (error?.message ?? 'order_failed').slice(0, 80) };
  }

  return {
    ok: true,
    referenceCode,
    orderPublicId: (order as { public_id: string }).public_id,
    amountPhp: VENDOR_PAPIC_UNLI_UPGRADE_PHP,
    pending: false,
  };
}
