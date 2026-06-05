/**
 * Server-only companion to lib/vendor-payment-methods.ts.
 *
 * Holds the couple-facing fetch, which presigns R2 display URLs for QR images
 * (displayUrlForStoredAsset → AWS SDK). Importing this module from a client
 * component is a build error by design — keep it server-side only.
 */
import 'server-only';
import jsQR from 'jsqr';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  isVendorProActive,
  type CoupleFacingMethod,
  type VendorPaymentMethodRow,
} from '@/lib/vendor-payment-methods';

/**
 * A booked vendor's PUBLISHED + APPROVED + tier-allowed payment methods.
 * Security model:
 *   • `authedClient` (couple RLS) proves the couple owns this event_vendor row;
 *   • `adminClient` reads vendor_payment_methods (owner-RLS'd — couples cannot
 *     read it directly), but only AFTER ownership is proven above.
 * Returns [] for off-platform/manual vendors (no marketplace profile) or when
 * the couple doesn't own the event_vendor row.
 */
export async function fetchPublishedMethodsForCouple(opts: {
  authedClient: SupabaseClient;
  adminClient: SupabaseClient;
  eventId: string;
  eventVendorId: string;
}): Promise<CoupleFacingMethod[]> {
  const { authedClient, adminClient, eventId, eventVendorId } = opts;

  // 1. Prove the couple owns this event_vendor (RLS-scoped read).
  const { data: ev } = await authedClient
    .from('event_vendors')
    .select('vendor_id, event_id, marketplace_vendor_id')
    .eq('vendor_id', eventVendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const marketplaceVendorId =
    (ev as { marketplace_vendor_id: string | null } | null)?.marketplace_vendor_id ?? null;
  if (!marketplaceVendorId) return []; // off-platform/manual vendor → coordinate in chat

  // 2. Resolve the vendor's auth user (for the pro-tier check).
  const { data: vp } = await adminClient
    .from('vendor_profiles')
    .select('vendor_profile_id, user_id')
    .eq('vendor_profile_id', marketplaceVendorId)
    .maybeSingle();
  const vendorUserId = (vp as { user_id: string } | null)?.user_id ?? null;
  if (!vendorUserId) return [];

  const proActive = await isVendorProActive(adminClient, vendorUserId);

  // 3. Read published + approved methods (admin client bypasses owner RLS).
  const { data: rows } = await adminClient
    .from('vendor_payment_methods')
    .select('*')
    .eq('vendor_profile_id', marketplaceVendorId)
    .eq('is_shown', true)
    .eq('moderation_status', 'approved')
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  // 4. Tier gate: links only surface for active pro-tier vendors.
  const list = ((rows ?? []) as VendorPaymentMethodRow[]).filter(
    (m) => m.method_type !== 'link' || proActive,
  );

  const out: CoupleFacingMethod[] = [];
  for (const m of list) {
    out.push({
      payment_method_id: m.payment_method_id,
      method_type: m.method_type,
      label: m.label,
      provider: m.provider,
      account_name: m.account_name,
      account_number: m.account_number,
      decoded_destination: m.decoded_destination,
      link_url: m.link_url,
      link_domain: m.link_domain,
      note: m.note,
      is_primary: m.is_primary,
      qr_display_url:
        m.method_type === 'qr' ? await displayUrlForStoredAsset(m.qr_r2_key) : null,
    });
  }
  return out;
}

/**
 * Decode what an uploaded QR image ACTUALLY encodes — server-side, so the
 * stored `decoded_destination` is Setnayan-verified (anti-swap), not the
 * vendor's typed claim. Fetches the image from R2, rasterises to RGBA via
 * sharp, runs jsQR. Best-effort: returns null on an unreadable image and never
 * throws (callers fall back to the vendor-declared value + admin review).
 */
export async function decodeQrFromR2(r2Ref: string): Promise<string | null> {
  try {
    const url = await displayUrlForStoredAsset(r2Ref);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const result = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      info.width,
      info.height,
    );
    const text = result?.data?.trim();
    return text && text.length > 0 ? text.slice(0, 256) : null;
  } catch {
    return null;
  }
}
