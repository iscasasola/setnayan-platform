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
   * 🤝 Why the shop is trusted — the ⓘ tag (Invite a supplier v3, owner 16 Nov; drawing v7, 21 Nov): `worked_together`
   * (served an event together, completed and paid) · `added` (added by hand, then served together) · `invited` (a new
   * shop made through the link).
   */
  origin: PartnershipOrigin;
  /** Who made the tie: this page's shop (`this_shop`) or the partner. */
  direction: 'this_shop' | 'partner';
  /** Past events served together, completed and paid — null for a new shop trusted before its first. */
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
 * A read behind "Trusted by" was REFUSED (the trust reader, the hidden rows, or the `vendor_profiles` half) —
 * distinct from `[]` so
 * the "Trusted by" section never renders as "nobody endorsed this shop" for a
 * shop that other vendors HAVE endorsed. This is a trust signal shown on a
 * shop's own public profile (and their own dashboard, via callers of
 * {@link fetchTrustedByVendors}) — a refused read must not read the same as a
 * genuine zero (S41, reads-are-honest).
 */
export const TRUSTED_BY_UNREADABLE = 'unreadable' as const;

/**
 * 🤝 ONE LIVE PARTNER OF A SHOP, as THE ONE READER answers (`public.shop_trust`, migration 20271361607663).
 *
 * Owner, 21 Nov 2026 (specs DECISION_LOG): "TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER",
 * "TRUSTED SHOPS RANK HIGHER IN SEARCH", and drawing v7 with the controller's call on its flagged risk:
 *   · `trusted` — the two shops served the SAME event, completed and paid through Setnayan (the ONE definition,
 *     `vendor_served_together_rows`), or the partner is a NEW shop made through the link. Otherwise the partner is
 *     WAITING ("Waiting for your first event together"), shown on the shop's own Partnerships page only.
 *   · `counts` — what search and the badges count: trusted by a verified, published, non-demo, non-internal shop that
 *     is not the same business or the same people; a new shop only after its first completed, paid booking.
 * Every surface that shows or counts trust reads it through THIS file — "Trusted by" on the shop page, the Partners
 * list, the Invites badge and supplier search. `lib/trust-has-one-reader.test.ts` fails on a second derivation.
 */
export type TrustTie = {
  /** The shop asked about. */
  vendorProfileId: string;
  /** Its partner. */
  otherVendorProfileId: string;
  relationshipTypes: string[];
  origins: PartnershipOrigin[];
  /** This shop made the tie (it proposed, added or invited). */
  madeByThisShop: boolean;
  /** This shop's link created the partner (`brought_new_shop`) — the Invites record. */
  broughtNewShop: boolean;
  /** Events the two served together, completed and paid. */
  eventsTogether: number;
  /** Trusted · otherwise Waiting for your first event together. */
  trusted: boolean;
  /** Counted by search and the badges. */
  counts: boolean;
};

/** The trust of each given shop's live partners — THE ONE READER. `UNREADABLE` when the read was refused, never []. */
export async function fetchShopTrust(
  admin: SupabaseClient,
  vendorProfileIds: readonly string[],
): Promise<TrustTie[] | typeof TRUSTED_BY_UNREADABLE> {
  const ids = [...new Set(vendorProfileIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await admin.rpc('shop_trust', { p_vendor_profile_ids: ids });
  if (error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · rpc:shop_trust', error);
    return TRUSTED_BY_UNREADABLE;
  }
  return ((data ?? []) as Array<{
    vendor_profile_id: string;
    other_vendor_profile_id: string;
    relationship_types: string[] | null;
    origins: string[] | null;
    made_by_this_shop: boolean | null;
    brought_new_shop: boolean | null;
    events_together: number | string | null;
    trusted: boolean | null;
    counts: boolean | null;
  }>).map((r) => ({
    vendorProfileId: r.vendor_profile_id,
    otherVendorProfileId: r.other_vendor_profile_id,
    relationshipTypes: r.relationship_types ?? [],
    origins: (r.origins ?? []).map(originOf),
    madeByThisShop: r.made_by_this_shop === true,
    broughtNewShop: r.brought_new_shop === true,
    eventsTogether: Number.isFinite(Number(r.events_together)) ? Number(r.events_together) : 0,
    trusted: r.trusted === true,
    counts: r.counts === true,
  }));
}

/** Per shop: trusted and waiting partners, the counted trust, and its search step (0 until the owner sets the step). */
export type TrustCounts = { trusted: number; waiting: number; counted: number; searchStep: number };

/**
 * The counts, derived in the database FROM the one reader (`public.shop_trust_counts`). A shop with no partner is
 * absent (read it as zero). `UNREADABLE` when refused — search then leaves its order exactly as it was.
 */
export async function fetchTrustCounts(
  admin: SupabaseClient,
  vendorProfileIds: readonly string[],
): Promise<Map<string, TrustCounts> | typeof TRUSTED_BY_UNREADABLE> {
  const ids = [...new Set(vendorProfileIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await admin.rpc('shop_trust_counts', { p_vendor_profile_ids: ids });
  if (error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · rpc:shop_trust_counts', error);
    return TRUSTED_BY_UNREADABLE;
  }
  const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.trunc(Number(v)) : 0);
  const out = new Map<string, TrustCounts>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    out.set(String(r.vendor_profile_id), {
      trusted: n(r.trusted),
      waiting: n(r.waiting),
      counted: n(r.counted),
      searchStep: n(r.search_step),
    });
  }
  return out;
}

/**
 * 🔎 Each shop's TRUST STEP for supplier search (owner 21 Nov 2026, "TRUSTED SHOPS RANK HIGHER IN SEARCH"): how many
 * of 1 · b · b² · … its counted trust reaches, b being the owner's admin number (`platform_settings.trust_search_step`;
 * blank → every step is 0 and the order stays as it was). `lib/trust-rank.ts` sorts by it.
 */
export async function fetchTrustSearchSteps(
  admin: SupabaseClient,
  vendorProfileIds: readonly string[],
): Promise<Map<string, number> | typeof TRUSTED_BY_UNREADABLE> {
  const counts = await fetchTrustCounts(admin, vendorProfileIds);
  if (counts === TRUSTED_BY_UNREADABLE) return counts;
  return new Map([...counts].map(([id, c]) => [id, c.searchStep]));
}

/**
 * "Trusted by" — the suppliers THIS shop works with that are TRUSTED (owner 21 Nov 2026 + drawing v7 "Trusted by row:
 * shows only trusted shops; a waiting shop never shows on either page"): a live partner it served an event with,
 * completed and paid, or a new shop made through the link. A waiting partner, a pending hand add and a shop served
 * with but never partnered are not here. Each carries the ⓘ tag (Worked together · Added · Invited).
 *
 * Names respect hybrid-anonymity via the shared resolveVendorDisplayName: a
 * still-hidden endorsing vendor shows its taxonomy+city placeholder and is not
 * linked.
 */
export async function fetchTrustedByVendors(
  admin: SupabaseClient,
  recommendedVendorProfileId: string,
): Promise<TrustedByVendor[] | typeof TRUSTED_BY_UNREADABLE> {
  const me = recommendedVendorProfileId;
  const [ties, hiddenRead] = await Promise.all([
    fetchShopTrust(admin, [me]),
    // 🙈 Owner Q5 (16 Nov): the rows this shop has hidden from its own Trusted by.
    admin.from('vendor_trusted_by_hidden').select('hidden_vendor_profile_id').eq('vendor_profile_id', me),
  ]);
  // ⚠ A refused read is not "nobody trusts this shop" (reads-are-honest, S41): the page says it couldn't load.
  if (ties === TRUSTED_BY_UNREADABLE) return TRUSTED_BY_UNREADABLE;
  // A refused hidden-rows read must not publish a row the shop chose to hide — and must not read as "nobody" either.
  if (hiddenRead.error) {
    console.error('[supabase-error] lib/vendor-trusted-by.ts · from:vendor_trusted_by_hidden.select', hiddenRead.error);
    return TRUSTED_BY_UNREADABLE;
  }
  const hidden = new Set(
    ((hiddenRead.data ?? []) as { hidden_vendor_profile_id: string }[]).map((h) => h.hidden_vendor_profile_id),
  );

  // One badge per partner: the STRONGEST kind they hold, ranked by what the couple actually gets (shared with Explore,
  // so the two agree). The tag says why the shop is trusted: a new shop made through the link is Invited; a shop
  // served with is Worked together, or Added when it was added by hand (drawing v7: "Hiraya … Worked together").
  const relByVendor = new Map<string, TrustedByRelationship>();
  const tieByVendor = new Map<string, { origin: PartnershipOrigin; direction: 'this_shop' | 'partner' }>();
  const eventsWith = new Map<string, number>();
  for (const t of ties) {
    if (t.vendorProfileId !== me || !t.trusted) continue;
    const vid = t.otherVendorProfileId;
    if (!vid || vid === me || hidden.has(vid)) continue;
    relByVendor.set(vid, strongestPartnershipKind(t.relationshipTypes) ?? 'general');
    const origin: PartnershipOrigin =
      t.eventsTogether === 0 ? 'invited' : t.origins.includes('added') ? 'added' : 'worked_together';
    tieByVendor.set(vid, { origin, direction: t.madeByThisShop ? 'this_shop' : 'partner' });
    if (t.eventsTogether > 0) eventsWith.set(vid, t.eventsTogether);
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
