/**
 * WHAT A SUPPLIER'S MARK SAYS — derived on the SERVER from the shop's own row,
 * never from anything a browser sent (controller audit 2026-11-04, item 6).
 *
 *   verified  `hasVerifiedBadge` — THE one predicate for the Verified badge
 *             (verification_state = 'verified' and its deadline not passed),
 *             so the mark and the badge can never disagree.
 *   shopName  vendor_profiles.business_name
 *   slug      vendor_profiles.business_slug — the /v/<slug> address on the plate
 *   logo      vendor_profiles.logo_url — read as bytes here and handed to the
 *             painter as a PNG (a presigned cross-origin URL would taint the
 *             browser canvas and make `toBlob` throw).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MarkSpec } from './photo-mark-geometry';
import { hasVerifiedBadge } from './verified-badge';

export type ShopMarkFacts = {
  spec: Extract<MarkSpec, { kind: 'supplier' }>;
  /** the stored logo ref (r2:// or legacy URL), or null */
  logoRef: string | null;
};

type Row = {
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
  verification_state: string | null;
  next_renewal_due_at: string | null;
};

/** Pure — the spec from the row. Exported for the guard. */
export function shopMarkFromRow(row: Row, now: Date = new Date()): ShopMarkFacts {
  const verified = hasVerifiedBadge(row, now) && !!row.business_slug;
  const logoRef = row.logo_url?.trim() || null;
  return {
    spec: {
      kind: 'supplier',
      verified,
      shopName: row.business_name?.trim() || null,
      slug: row.business_slug?.trim().toLowerCase() || null,
      hasLogo: verified && !!logoRef,
    },
    logoRef,
  };
}

/** Read the shop and derive its mark. Throws when the row cannot be read — the upload then refuses. */
export async function shopMarkFacts(supabase: SupabaseClient, vendorProfileId: string): Promise<ShopMarkFacts> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('business_name, business_slug, logo_url, verification_state, next_renewal_due_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`shop mark: vendor_profiles ${vendorProfileId} unreadable: ${error?.message ?? 'no row'}`);
  }
  return shopMarkFromRow(data as Row);
}

/** The logo's bytes for the coin, or null (no logo, a legacy URL, or an unreadable object — the coin is then omitted). */
export async function shopLogoBytes(logoRef: string | null): Promise<Uint8Array | null> {
  const { parseStoredAsset } = await import('./uploads');
  const parsed = parseStoredAsset(logoRef);
  if (!parsed || parsed.kind !== 'r2') return null;
  try {
    const { r2GetBytes } = await import('./r2');
    return (await r2GetBytes({ bucket: parsed.bucket, key: parsed.key })).bytes;
  } catch {
    return null;
  }
}

/** The vendor id a `vendors/<id>/…` media key belongs to, or null. */
export function vendorIdOfMediaKey(key: string): string | null {
  const m = /^vendors\/([^/]+)\//.exec(key);
  return m ? m[1]! : null;
}
