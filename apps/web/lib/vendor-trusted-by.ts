import { shopPath } from '@/lib/shop-address';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveVendorDisplayName, isVendorNameRevealed } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { strongestPartnershipKind, PARTNERSHIP_RANK } from '@/lib/vendor-partnership-kinds';
import { originOf, type PartnershipOrigin } from '@/lib/supplier-invite';

export type TrustedByRelationship =
  | 'accredited'
  | 'included_in_package'
  | 'discounted_together'
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
  /**
   * 🤝 Where the tie came from — the ⓘ tag (Invite a supplier v3, owner 16 Nov): `worked_together` (automatic, from a
   * shared past event, or the shipped propose) · `added` (by hand) · `invited` (joined through a link).
   */
  origin: PartnershipOrigin;
  /** Who made the tie: this page's shop (`this_shop`) or the partner. Automatic worked-together ties are `partner`. */
  direction: 'this_shop' | 'partner';
  /** Past events served together (the served-together read) — null when not known. */
  events: number | null;
  /**
   * 🖼 The endorser's STORED logo (`vendor_profiles.logo_url` — an `r2://` tag, not an address) for its round shop
   * profile photo, the same logo circle as the shop card (owner 2026-11-14, "make trusted by the shop profile
   * photos?"). The page signs it (`resolveDisplayUrl`); null → the circle shows initials. ALSO null for a still-hidden
   * endorser: a logo would name the shop the hybrid-anonymity gate is withholding — the same reason `href` is null.
   */
  logoRef: string | null;
};

/**
 * A read behind "Trusted by" was REFUSED (the partnerships, the worked-together shops, or the `vendor_profiles`
 * half) — distinct from `[]` so
 * the "Trusted by" section never renders as "nobody endorsed this shop" for a
 * shop that other vendors HAVE endorsed. This is a trust signal shown on a
 * shop's own public profile (and their own dashboard, via callers of
 * {@link fetchTrustedByVendors}) — a refused read must not read the same as a
 * genuine zero (S41, reads-are-honest).
 */
export const TRUSTED_BY_UNREADABLE = 'unreadable' as const;

/**
 * "Trusted by" — the suppliers THIS shop works with (owner 16 Nov 2026, Invite a supplier v3): every accepted
 * `vendor_partnerships` tie in either direction (peer consent stays the public gate, owner-locked 2026-07-02 — the
 * other shop accepted, or joined through this shop's link), this shop's own pending hand adds, and the shops it served
 * a past event with. Each carries its origin, the ⓘ tag (Worked together · Added · Invited).
 *
 * Names respect hybrid-anonymity via the shared resolveVendorDisplayName: a
 * still-hidden endorsing vendor shows its taxonomy+city placeholder and is not
 * linked. Founder-only marketplace → this returns [] today (honest empty state;
 * the section is hidden) until other vendors publish + endorse.
 */
export async function fetchTrustedByVendors(
  admin: SupabaseClient,
  recommendedVendorProfileId: string,
): Promise<TrustedByVendor[] | typeof TRUSTED_BY_UNREADABLE> {
  const me = recommendedVendorProfileId;
  // 🤝 TRUSTED BY GATHERS EVERY SUPPLIER TIE (owner 16 Nov, "INVITE A SUPPLIER — THREE ANSWERS" (1) + v3 APPROVED):
  //   · every ACCEPTED tie, in EITHER direction — a handshake is a two-way recommendation (owner 15 Nov), and the
  //     schema holds one row per pair (vendor_partnerships_unordered_pair_uidx), so both pages read that one row;
  //   · this shop's OWN pending hand adds ("on the adder's own Trusted by at once"; the other shop's page only after
  //     Accept; a decline removes it from both);
  //   · and, automatically, every shop it served a past event with (`shop_worked_with_counts`).
  const [{ data: rows, error }, worked, hiddenRead] = await Promise.all([
    admin
      .from('vendor_partnerships')
      .select('recommending_vendor_id, recommended_vendor_id, relationship_type, status, origin')
      .or(`recommending_vendor_id.eq.${me},recommended_vendor_id.eq.${me}`)
      .in('status', ['accepted', 'proposed'])
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
      .order('relationship_type', { ascending: true }),
    admin.rpc('shop_worked_with_counts', { p_vendor: me }),
    // 🙈 Owner Q5 (16 Nov): the rows this shop has hidden from its own Trusted by.
    admin.from('vendor_trusted_by_hidden').select('hidden_vendor_profile_id').eq('vendor_profile_id', me),
  ]);
  if (error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · from:vendor_partnerships.select', error);
    return TRUSTED_BY_UNREADABLE;
  }
  // ⚠ THE AUTOMATIC HALF REFUSED IS NOT "NOBODY WORKED WITH THEM" (reads-are-honest, S41). Logged alone, a shop whose
  // only ties are worked-together ones would fall through to `relByVendor.size === 0 → []` and the page would draw
  // the list as empty — byte-identical to a shop nobody has ever worked with. A list missing a whole kind cannot be
  // told apart from a complete one either, so any refused half answers UNREADABLE and the page says it couldn't load.
  if (worked.error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · rpc:shop_worked_with_counts', worked.error);
    return TRUSTED_BY_UNREADABLE;
  }
  // A refused hidden-rows read must not publish a row the shop chose to hide — and must not read as "nobody" either.
  if (hiddenRead.error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · from:vendor_trusted_by_hidden.select', hiddenRead.error);
    return TRUSTED_BY_UNREADABLE;
  }
  const hidden = new Set(
    ((hiddenRead.data ?? []) as { hidden_vendor_profile_id: string }[]).map((h) => h.hidden_vendor_profile_id),
  );
  const eventsWith = new Map<string, number>();
  for (const w of ((worked.data ?? []) as { other_vendor_profile_id: string; events: number | string }[])) {
    const n = Number(w.events);
    if (w.other_vendor_profile_id && Number.isFinite(n) && n > 0) eventsWith.set(w.other_vendor_profile_id, n);
  }

  // One badge per partner: the STRONGEST kind they hold, ranked by what the couple actually gets (shared with Explore,
  // so the two agree). The tag is the tie's own origin; an invite or a hand add says so over a worked-together one.
  const kindsByVendor = new Map<string, string[]>();
  const tieByVendor = new Map<string, { origin: PartnershipOrigin; direction: 'this_shop' | 'partner' }>();
  const ORIGIN_WEIGHT: Record<PartnershipOrigin, number> = { invited: 3, added: 2, worked_together: 1 };
  for (const r of (rows ?? []) as {
    recommending_vendor_id: string;
    recommended_vendor_id: string;
    relationship_type: string;
    status?: string;
    origin?: string;
  }[]) {
    const iMade = r.recommending_vendor_id === me;
    // A pending tie shows only on the page of the shop that made it.
    if (r.status === 'proposed' && !iMade) continue;
    const vid = iMade ? r.recommended_vendor_id : r.recommending_vendor_id;
    if (!vid || vid === me) continue;
    const list = kindsByVendor.get(vid);
    if (list) list.push(r.relationship_type);
    else kindsByVendor.set(vid, [r.relationship_type]);
    const origin = originOf(r.origin);
    const had = tieByVendor.get(vid);
    if (!had || ORIGIN_WEIGHT[origin] > ORIGIN_WEIGHT[had.origin]) {
      tieByVendor.set(vid, { origin, direction: iMade ? 'this_shop' : 'partner' });
    }
  }
  const relByVendor = new Map<string, TrustedByRelationship>();
  for (const [vid, kinds] of kindsByVendor) {
    const best = strongestPartnershipKind(kinds);
    if (best) relByVendor.set(vid, best);
  }
  // Worked together, automatically: a shop served with and not already tied.
  for (const vid of eventsWith.keys()) {
    if (vid === me || relByVendor.has(vid)) continue;
    relByVendor.set(vid, 'general');
    tieByVendor.set(vid, { origin: 'worked_together', direction: 'partner' });
  }
  for (const vid of hidden) {
    relByVendor.delete(vid);
    tieByVendor.delete(vid);
  }
  if (relByVendor.size === 0) return [];

  const { data: profiles, error: profErr } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,business_name,business_slug,location_city,services,name_revealed_at,screen_name,tier_state,verification_state,logo_url',
    )
    .in('vendor_profile_id', [...relByVendor.keys()]);
  if (profErr) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · from:vendor_profiles.select', profErr);
    return TRUSTED_BY_UNREADABLE;
  }
  if (!profiles) return [];

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
      href: nameRevealed && slug ? `${shopPath(slug)}` : null,
      relationshipType: relByVendor.get(p.vendor_profile_id as string) ?? 'general',
      origin: tieByVendor.get(p.vendor_profile_id as string)?.origin ?? 'worked_together',
      direction: tieByVendor.get(p.vendor_profile_id as string)?.direction ?? 'partner',
      events: eventsWith.get(p.vendor_profile_id as string) ?? null,
      logoRef: nameRevealed ? ((p.logo_url as string | null) ?? null) : null,
    });
  }
  // 🔢 STRONGEST FIRST (owner 2026-11-14, "A SHOP PAGE ENDS WITH ITS PARTNERS"): by what the couple gets —
  // `PARTNERSHIP_RANK`, the one order every surface reads — then by name, so two partners of one kind keep a stable
  // order. Was: by name alone.
  return out.sort(
    (a, b) =>
      PARTNERSHIP_RANK[b.relationshipType] - PARTNERSHIP_RANK[a.relationshipType] ||
      a.displayName.localeCompare(b.displayName),
  );
}
