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
 * 🤝 THE ONE READER OF TRUST (owner 21 Nov 2026, specs DECISION_LOG "A SHOP SHOWS AS YOUR TRUSTED SHOP ONLY AFTER ONE
 * COMPLETED, PAID BOOKING" + "TRUSTED SHOPS RANK HIGHER IN SEARCH"). Every surface that shows or counts trust reads the
 * SQL function `shop_qualified_trust` (migration 20271356577600) through THIS module, and nothing else derives it:
 *   · "Trusted by" on the public shop page — {@link fetchTrustedByVendors};
 *   · the supplier's Partners list ("Waiting for their first completed booking") — {@link fetchQualifiedTrustedIds};
 *   · the search / Explore / Find trust count — {@link fetchQualifiedTrustCounts}.
 * `lib/trust-has-one-reader.test.ts` fails if a second derivation appears.
 *
 * A shop QUALIFIES (the SQL says it once): a live two-way partnership (accepted + active, either direction); the other
 * shop verified, published, papers current, not demo, owner not internal; not the same business (its own branches) or
 * the same people; and at least one completed booking with its payment received through Setnayan (never refunded,
 * cancelled, internal or test). Each shop once. Mutual: each side is answered by the same rule.
 */
export const QUALIFIED_TRUST_RPC = 'shop_qualified_trust' as const;
export const QUALIFIED_TRUST_COUNTS_RPC = 'shop_qualified_trust_counts' as const;

type QualifiedTrustRow = {
  vendor_profile_id: string;
  trusting_vendor_profile_id: string;
  relationship_types: string[] | null;
  origins: string[] | null;
  made_by_this_shop: boolean | null;
};

/**
 * The QUALIFIED shops trusting `shopId` — the set the Partners list compares its linked shops against. A linked shop
 * not in this set reads "Waiting for their first completed booking" (and is never shown publicly). A refused read is
 * {@link TRUSTED_BY_UNREADABLE}, never an empty set (an empty set would mark every partner as waiting).
 */
export async function fetchQualifiedTrustedIds(
  admin: SupabaseClient,
  shopId: string,
): Promise<Set<string> | typeof TRUSTED_BY_UNREADABLE> {
  const { data, error } = await admin.rpc(QUALIFIED_TRUST_RPC, { p_vendor_profile_ids: [shopId] });
  if (error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · rpc:shop_qualified_trust', error);
    return TRUSTED_BY_UNREADABLE;
  }
  return new Set(((data ?? []) as QualifiedTrustRow[]).map((r) => r.trusting_vendor_profile_id));
}

/**
 * The search trust signal: per shop, how many DISTINCT qualified shops trust it (counted by
 * `shop_qualified_trust_counts`, which reads `shop_qualified_trust` — never beside it). A shop with none is absent from
 * the map (0). A refused read is {@link TRUSTED_BY_UNREADABLE}: the caller leaves its order exactly as it was (no shop
 * is lifted and none is sunk by a count nobody read).
 */
export async function fetchQualifiedTrustCounts(
  admin: SupabaseClient,
  shopIds: readonly string[],
): Promise<Map<string, number> | typeof TRUSTED_BY_UNREADABLE> {
  const ids = [...new Set(shopIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await admin.rpc(QUALIFIED_TRUST_COUNTS_RPC, { p_vendor_profile_ids: ids });
  if (error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · rpc:shop_qualified_trust_counts', error);
    return TRUSTED_BY_UNREADABLE;
  }
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { vendor_profile_id: string; trusted_by: number | string }[]) {
    const n = Number(r.trusted_by);
    if (r.vendor_profile_id && Number.isFinite(n) && n > 0) out.set(r.vendor_profile_id, n);
  }
  return out;
}

/**
 * "Trusted by" — the QUALIFIED shops that trust this one ({@link QUALIFIED_TRUST_RPC}). Since 21 Nov 2026 a linked
 * shop shows here only once it has a completed, paid booking; a pending hand add or a shop only served with is a link,
 * not trust, and is not drawn. Each row carries its origin, the ⓘ tag (Worked together · Added · Invited), and the
 * events served together (`shop_worked_with_counts`, a caption only — it never adds a shop).
 *
 * Names respect hybrid-anonymity via the shared resolveVendorDisplayName: a
 * still-hidden endorsing vendor shows its taxonomy+city placeholder and is not
 * linked. Founder-only marketplace → this returns [] today (honest empty state;
 * the section is hidden) until other vendors publish, book and endorse.
 */
export async function fetchTrustedByVendors(
  admin: SupabaseClient,
  recommendedVendorProfileId: string,
): Promise<TrustedByVendor[] | typeof TRUSTED_BY_UNREADABLE> {
  const me = recommendedVendorProfileId;
  const [{ data: rows, error }, worked, hiddenRead] = await Promise.all([
    admin.rpc(QUALIFIED_TRUST_RPC, { p_vendor_profile_ids: [me] }),
    admin.rpc('shop_worked_with_counts', { p_vendor: me }),
    // 🙈 Owner Q5 (16 Nov): the rows this shop has hidden from its own Trusted by.
    admin.from('vendor_trusted_by_hidden').select('hidden_vendor_profile_id').eq('vendor_profile_id', me),
  ]);
  if (error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · rpc:shop_qualified_trust', error);
    return TRUSTED_BY_UNREADABLE;
  }
  // ⚠ A REFUSED CAPTION READ IS NOT "NEVER WORKED TOGETHER" (reads-are-honest, S41): the ⓘ line would say a different
  // thing than the truth, so a refused half answers UNREADABLE and the page says it couldn't load.
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
  const ORIGIN_WEIGHT: Record<PartnershipOrigin, number> = { invited: 3, added: 2, worked_together: 1 };
  const relByVendor = new Map<string, TrustedByRelationship>();
  const tieByVendor = new Map<string, { origin: PartnershipOrigin; direction: 'this_shop' | 'partner' }>();
  for (const r of (rows ?? []) as QualifiedTrustRow[]) {
    const vid = r.trusting_vendor_profile_id;
    if (!vid || vid === me || hidden.has(vid)) continue;
    relByVendor.set(vid, strongestPartnershipKind(r.relationship_types ?? []) ?? 'general');
    let origin: PartnershipOrigin = 'worked_together';
    for (const o of r.origins ?? []) {
      const oo = originOf(o);
      if (ORIGIN_WEIGHT[oo] > ORIGIN_WEIGHT[origin]) origin = oo;
    }
    tieByVendor.set(vid, { origin, direction: r.made_by_this_shop ? 'this_shop' : 'partner' });
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
