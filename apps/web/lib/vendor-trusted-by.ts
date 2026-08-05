import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveVendorDisplayName, isVendorNameRevealed } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { strongestPartnershipKind } from '@/lib/vendor-partnership-kinds';

export type TrustedByRelationship =
  | 'accredited'
  | 'sponsored_included'
  | 'sponsored_discounted'
  | 'general';

export type TrustedByVendor = {
  vendorProfileId: string;
  displayName: string;
  /**
   * Microsite link — set ONLY when the endorsing vendor's name is revealed. A
   * still-hidden vendor stays unlinked because its business_slug would leak the
   * real business name the hybrid-anonymity gate is withholding.
   */
  href: string | null;
  relationshipType: TrustedByRelationship;
};

/**
 * "Trusted by" — the vendors who have publicly endorsed THIS vendor through the
 * vendor↔vendor mutual-accept handshake (`vendor_partnerships`): another vendor
 * PROPOSED an endorsement and this vendor ACCEPTED it (status='accepted'). Only
 * accepted + active rows POINTING AT this vendor surface — peer consent is the
 * public gate (owner-locked 2026-07-02), not HQ verification.
 *
 * Names respect hybrid-anonymity via the shared resolveVendorDisplayName: a
 * still-hidden endorsing vendor shows its taxonomy+city placeholder and is not
 * linked. Founder-only marketplace → this returns [] today (honest empty state;
 * the section is hidden) until other vendors publish + endorse.
 */
export async function fetchTrustedByVendors(
  admin: SupabaseClient,
  recommendedVendorProfileId: string,
): Promise<TrustedByVendor[]> {
  const { data: rows, error } = await admin
    .from('vendor_partnerships')
    .select('recommending_vendor_id, relationship_type')
    .eq('recommended_vendor_id', recommendedVendorProfileId)
    .eq('status', 'accepted')
    .eq('is_active', true)
    // Stable read order only. The BADGE choice is made in code below, by
    // PARTNERSHIP_RANK — not by this ORDER BY.
    //
    // ⚠ It used to be made here, alphabetically, which meant `accredited` always
    // won. A directed pair (A→B) can hold two accepted+active rows of different
    // kinds (the UNIQUE is keyed with relationship_type), so a vendor who was
    // BOTH accredited and included-in-package showed the weaker badge here while
    // Explore ranked them by the stronger one. Same four kinds, two files,
    // opposite orders.
    .order('recommending_vendor_id', { ascending: true })
    .order('relationship_type', { ascending: true });
  if (error || !rows || rows.length === 0) return [];

  // One badge per endorsing vendor: the STRONGEST kind they hold, ranked by
  // what the couple actually gets (shared with Explore, so the two agree).
  const kindsByVendor = new Map<string, string[]>();
  for (const r of rows) {
    const vid = r.recommending_vendor_id as string;
    const list = kindsByVendor.get(vid);
    if (list) list.push(r.relationship_type as string);
    else kindsByVendor.set(vid, [r.relationship_type as string]);
  }
  const relByVendor = new Map<string, TrustedByRelationship>();
  for (const [vid, kinds] of kindsByVendor) {
    const best = strongestPartnershipKind(kinds);
    if (best) relByVendor.set(vid, best);
  }

  const { data: profiles, error: profErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,business_name,business_slug,location_city,services,name_revealed_at,screen_name,tier_state,verification_state',
    )
    .in('vendor_profile_id', [...relByVendor.keys()]);
  if (profErr || !profiles) return [];

  const out: TrustedByVendor[] = [];
  for (const p of profiles) {
    const services = (p.services as string[] | null) ?? null;
    const nameRevealedAt = (p.name_revealed_at as string | null) ?? null;
    const isPaidTier = isTrueNameTier((p.tier_state as string | null) ?? null);
    // Open-it-up lock: a VERIFIED vendor's name is never gated (any tier).
    const isVerified = (p.verification_state as string | null) === 'verified';
    const nameRevealed = isVendorNameRevealed({ name_revealed_at: nameRevealedAt, isPaidTier, is_verified: isVerified, services });
    const displayName = resolveVendorDisplayName({
      business_name: (p.business_name as string | null) ?? '',
      name_revealed_at: nameRevealedAt,
      primary_canonical_service: services?.[0] ?? null,
      location_city: (p.location_city as string | null) ?? null,
      services,
      screen_name: (p.screen_name as string | null) ?? null,
      isPaidTier,
      is_verified: isVerified,
    });
    const slug = p.business_slug as string | null;
    out.push({
      vendorProfileId: p.vendor_profile_id as string,
      displayName,
      href: nameRevealed && slug ? `/v/${slug}` : null,
      relationshipType: relByVendor.get(p.vendor_profile_id as string) ?? 'general',
    });
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
