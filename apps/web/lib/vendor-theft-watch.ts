/**
 * Vendor-facing reverse-image theft watch (Wave 1 · spec A,
 * VENDOR_TIERS_AND_BENEFITS.md §8).
 *
 * The detection engine (`lib/vendor-image-repost-watch.ts`) already ships — it
 * perceptual-hashes vendor images and writes `vendor_image_flags`. That table is
 * an internal-integrity table RLS-blocks vendors from reading, and only admins
 * see it (`/admin/repost-watch`). This module gives a vendor a SCOPED, read-only
 * view of reposts OF THEIR OWN work: flags where they are the `source_vendor_id`
 * (the earlier/original owner whose image a later upload matched).
 *
 * Privacy: we deliberately do NOT expose the accused reposter's identity
 * (`flagged_vendor_id`). Flags can be `open` (unconfirmed), so naming a vendor
 * would risk defamation — adjudication stays with admins. The victim vendor just
 * sees which of their own images were flagged, and the review status.
 */
import { createAdminClient } from '@/lib/supabase/admin';

export type RepostFlagStatus = 'open' | 'dismissed' | 'confirmed_theft' | 'escalated';
export type RepostSurface = 'service_primary' | 'portfolio';

export type VendorRepostFlag = {
  publicId: string;
  /** The vendor's OWN surface that was copied. */
  surface: RepostSurface;
  /** The vendor's own R2 image key (setnayan media bucket). */
  r2Ref: string;
  status: RepostFlagStatus;
  /** 0–64 pHash bit difference; lower = closer match. */
  hammingDistance: number;
  createdAt: string;
};

type FlagRow = {
  public_id: string;
  source_surface: RepostSurface;
  source_r2_ref: string;
  status: RepostFlagStatus;
  hamming_distance: number;
  created_at: string;
};

/**
 * Reposts of THIS vendor's portfolio, newest first. Admin-client read (the
 * table is RLS-blocked from vendors); the caller must pass the session vendor's
 * own profile id — never a caller-supplied one. Returns [] on any error / when
 * the service-role key is unavailable (CI), matching the app's read-safe pattern.
 */
export async function fetchVendorReposts(
  vendorProfileId: string,
): Promise<VendorRepostFlag[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('vendor_image_flags')
    .select('public_id, source_surface, source_r2_ref, status, hamming_distance, created_at')
    .eq('source_vendor_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return (data as FlagRow[]).map((r) => ({
    publicId: r.public_id,
    surface: r.source_surface,
    r2Ref: r.source_r2_ref,
    status: r.status,
    hammingDistance: r.hamming_distance,
    createdAt: r.created_at,
  }));
}
