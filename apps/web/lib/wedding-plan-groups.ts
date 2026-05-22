/**
 * 12-group wedding planning structure (owner-locked 2026-05-20).
 *
 * The couple home page (iteration 0021) groups every relevant Filipino
 * wedding decision into 12 logical buckets, each anchored to a typical
 * lead-time before the wedding date. Picked vendors from `event_vendors`
 * are bucketed by group via the `categories` array; each group also
 * advertises a target date computed from the event_date and
 * `monthsBefore`.
 *
 * Coverage: every value of the `vendor_category` enum (28 entries as of
 * migration 20260513100000) maps into exactly one group, so any vendor
 * the couple saves to their event surfaces on the home dashboard.
 *
 * Ceremony venue and Reception venue are kept disjoint by category so
 * the same saved vendor doesn't double-render in both cards (owner
 * direction 2026-05-21):
 *   • Ceremony venue   ← religious_venue · church_fees
 *   • Reception venue  ← venue
 * A combined-venue wedding (one place hosting both) requires adding the
 * vendor to BOTH cards manually — the Reception hint nudges couples to
 * do that. A follow-up schema change can introduce a 'reception_venue'
 * sub-category if we want venue-only browse filters cleaner, but the
 * disjoint coarse mapping fixes the double-render today.
 */

import type { VendorCategory } from '@/lib/vendors';
import type { WeddingFolder } from '@/lib/taxonomy';

export type PlanGroupId =
  | 'ceremony_venue'
  | 'reception_venue'
  | 'officiant'
  | 'catering'
  | 'photography'
  | 'attire'
  | 'hair_makeup'
  | 'florals_decor'
  | 'music_entertainment'
  | 'cake'
  | 'invitations_stationery'
  | 'logistics';

export type PlanGroup = {
  id: PlanGroupId;
  label: string;
  hint: string;
  /** vendor_category enum values that count toward this group. */
  categories: ReadonlyArray<VendorCategory>;
  /** How many months before the wedding date to aim to have this locked. */
  monthsBefore: number;
  /**
   * Which catalog folder the planner's [Search] button anchors into.
   * The marketplace's CatalogView renders each folder as a `<section
   * id={WEDDING_FOLDER_SLUG[folder]}>` so a URL like `/vendors#ceremony`
   * lands the couple on the rich PairedVenuePanel + CeremonyVenuesSection
   * directly — no filter applied, full curated browse view.
   */
  catalogFolder: WeddingFolder;
};

/**
 * Ceremony types the religion-adaptive copy layer recognizes. Mirrors the
 * `events.ceremony_type` CHECK constraint from migration 20260521000000.
 * `null` covers events without a picked ceremony type (early planning) —
 * those get the default `PlanGroup.hint`.
 */
export type CeremonyType =
  | 'catholic'
  | 'civil'
  | 'inc'
  | 'christian'
  | 'muslim'
  | 'cultural'
  | 'mixed';

/**
 * Religion-adaptive hint table — owner directive 2026-05-22.
 *
 * When the host has picked a `ceremony_type`, each plan-card surfaces a
 * faith-aware hint instead of the generic one. The copy table is keyed
 * `[PlanGroupId][CeremonyType]`; missing entries fall back to the static
 * `PlanGroup.hint` field. Anglo-Catholic-default scenarios that need no
 * adaptation are intentionally absent (e.g. cake for any ceremony type —
 * the generic hint already works).
 *
 * Brand voice rule [[feedback_setnayan_no_dev_text_post_launch]]: no
 * jargon, no inline parens, no "etc." soup. Each line reads like a wedding
 * planner speaking — concrete, polite, Filipino-aware.
 *
 * Coverage philosophy: ADAPT-COPY > HIDE-CARD. Every card stays visible
 * for every ceremony type (no card has been deemed truly inapplicable
 * across all 7 ceremony types). Hiding cards risks under-serving real
 * edge cases (e.g. a civil-only couple who still wants a coordinator);
 * adapting copy lets the host self-select.
 */
const CEREMONY_HINTS: Partial<Record<PlanGroupId, Partial<Record<CeremonyType, string>>>> = {
  ceremony_venue: {
    catholic: 'The Catholic church or chapel for your sacrament. Pre-Cana paperwork starts here.',
    civil: "Civil registrar's office or judge's chambers. Often combined with reception.",
    inc: 'Your local INC chapel. Local administration handles the booking.',
    christian: 'The Christian church for the wedding rite.',
    muslim: 'Mosque, ballroom, or family compound for the akad nikah.',
    cultural: 'Cultural ceremony site — Singkil pavilion, ancestral home, tribal ground.',
    mixed: 'The venue for your primary ceremony. Add the second below if needed.',
  },
  reception_venue: {
    civil: 'Where you celebrate after — often the same place as the civil ceremony.',
    muslim: 'Reception venue. Confirm halal-friendly catering policy before signing.',
    mixed: 'Reception venue — the celebration after both ceremonies.',
  },
  officiant: {
    catholic: 'Priest. Pre-Cana required 4-5 months before the wedding day.',
    civil: 'Judge or civil registrar to officiate the civil ceremony.',
    inc: 'INC minister, assigned through your local administration.',
    christian: 'Pastor or minister from your church.',
    muslim: 'Imam to officiate the akad nikah.',
    cultural: 'Cultural elder, datu, or babaylan per your tradition.',
    mixed: 'Two officiants — one per ceremony.',
  },
  catering: {
    inc: 'Food and service for guests. INC weddings are alcohol-free — confirm with caterer.',
    muslim: 'Food and service — halal-certified caterer for a Muslim ceremony.',
    cultural: 'Food and service — include cultural dishes per your tradition.',
    mixed: 'Food and service. Clear both ceremonies’ dietary needs with the caterer.',
  },
  photography: {
    muslim: 'Photo and video team. Confirm gender-respect protocols with the team.',
  },
  attire: {
    civil: 'Outfit and rings. Civil weddings are dressier than couples expect — plan ahead.',
    muslim: 'Modest attire and rings. Hijab-friendly designers tagged in the directory.',
    cultural: 'Filipiniana, Barong Tagalog, or tribal attire per your tradition.',
    mixed: 'Both ceremonies’ attire — sometimes two outfits, sometimes one.',
  },
  hair_makeup: {
    muslim: 'Bridal and entourage glam. Hijab-compatible stylists tagged in the directory.',
  },
  florals_decor: {
    cultural: 'Bouquets, aisle, reception styling — traditional motifs per your tradition.',
  },
  music_entertainment: {
    inc: 'Host, band, DJ, choir, photobooth. No alcohol bar at INC receptions.',
    muslim: 'Host, kulintang ensemble, photobooth. No-alcohol mobile bar.',
    cultural: 'Host, traditional ensemble (kulintang, rondalla, folk), photobooth.',
  },
  cake: {
    muslim: 'Tastings 3-4 months out. Confirm halal ingredients with the cake maker.',
  },
};

/**
 * Resolve the hint copy for a plan group given the host's picked
 * `events.ceremony_type`. Falls back to the static `PlanGroup.hint` when
 * the ceremony type has no faith-specific copy registered.
 *
 * Pass `null` for early-planning events (no ceremony_type yet) — the host
 * gets the generic Filipino-wedding-default copy.
 */
export function resolvePlanGroupHint(
  group: PlanGroup,
  ceremonyType: CeremonyType | null,
): string {
  if (ceremonyType === null) return group.hint;
  return CEREMONY_HINTS[group.id]?.[ceremonyType] ?? group.hint;
}

/**
 * Type guard for `events.ceremony_type` string columns coming off the
 * Supabase client. Keeps the upstream `unknown` strings from leaking
 * into the typed copy resolver.
 */
export function isCeremonyType(value: unknown): value is CeremonyType {
  return (
    value === 'catholic' ||
    value === 'civil' ||
    value === 'inc' ||
    value === 'christian' ||
    value === 'muslim' ||
    value === 'cultural' ||
    value === 'mixed'
  );
}

export const PLAN_GROUPS: ReadonlyArray<PlanGroup> = [
  {
    id: 'ceremony_venue',
    label: 'Ceremony venue',
    hint: 'Where you say I do — book early, the best places fill 12 months out.',
    // 'venue' deliberately NOT here — it lives in reception_venue so a
    // saved hotel/garden doesn't surface in both cards. Combined-venue
    // weddings add their pick to BOTH groups manually per the
    // reception-side hint.
    categories: ['religious_venue', 'church_fees'],
    monthsBefore: 12,
    catalogFolder: 'ceremony',
  },
  {
    id: 'reception_venue',
    label: 'Reception venue',
    hint: 'Where you celebrate after. Same place as ceremony? Add it under both.',
    categories: ['venue'],
    monthsBefore: 12,
    catalogFolder: 'reception',
  },
  {
    id: 'officiant',
    label: 'Officiant',
    hint: 'Priest, pastor, or judge. Civil ceremonies need them booked early too.',
    categories: ['officiant'],
    monthsBefore: 9,
    catalogFolder: 'ceremony',
  },
  {
    id: 'catering',
    label: 'Catering',
    hint: 'Food + service. Tastings happen 4-6 months out; book the team earlier.',
    categories: ['catering'],
    monthsBefore: 9,
    catalogFolder: 'catering',
  },
  {
    id: 'photography',
    label: 'Photography & Video',
    hint: 'Photo + video team for the day. Often booked together.',
    categories: ['photographer', 'videographer'],
    monthsBefore: 9,
    catalogFolder: 'photo_video',
  },
  {
    id: 'attire',
    label: 'Attire & Rings',
    hint: 'Gown, suit, and the rings. Designers need fitting time.',
    categories: ['gown_designer', 'suit_designer', 'rings'],
    monthsBefore: 8,
    catalogFolder: 'attire',
  },
  {
    id: 'hair_makeup',
    label: 'Hair & Makeup',
    hint: 'Bridal + entourage glam. Trials happen 1-2 months before the day.',
    categories: ['makeup_artist', 'hair_stylist'],
    monthsBefore: 6,
    catalogFolder: 'hair_makeup',
  },
  {
    id: 'florals_decor',
    label: 'Florals & Decor',
    hint: 'Bouquets, aisle, reception styling. Pin colors first, then book.',
    categories: ['florist', 'reception_decor'],
    monthsBefore: 6,
    catalogFolder: 'decor_florals_sound',
  },
  {
    id: 'music_entertainment',
    label: 'Music & Entertainment',
    hint: 'Host, band, DJ, choir, mobile bar, photobooth.',
    categories: [
      'host_emcee',
      'band_dj',
      'string_quartet',
      'choir',
      'photobooth',
      'mobile_bar',
    ],
    monthsBefore: 6,
    catalogFolder: 'music_program',
  },
  {
    id: 'cake',
    label: 'Cake',
    hint: 'Tastings 3-4 months out. Order locks 1 month before.',
    categories: ['cake_maker'],
    monthsBefore: 4,
    catalogFolder: 'catering',
  },
  {
    id: 'invitations_stationery',
    label: 'Invitations & Stationery',
    hint: 'Save-the-dates, invites, monogram, table cards, menus.',
    categories: ['invitations_stationery'],
    monthsBefore: 4,
    catalogFolder: 'invitations_keepsakes',
  },
  {
    id: 'logistics',
    label: 'Logistics',
    hint: 'Transportation, lights & sound, LED, security, planner, giveaways.',
    categories: [
      'transportation',
      'lights_and_sound',
      'led_screens',
      'security',
      'planner_coordinator',
      'gifts_and_giveaways',
      'misc',
    ],
    monthsBefore: 2,
    catalogFolder: 'planning_logistics_travel',
  },
];

/** Status the badge surfaces for a vendor row. */
export type VendorPickStatus = 'picked' | 'locked';

const LOCKED_STATUSES = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export function statusOfVendor(rawStatus: string | null | undefined): VendorPickStatus {
  return rawStatus && LOCKED_STATUSES.has(rawStatus) ? 'locked' : 'picked';
}

export type PlanCardPick = {
  vendor_id: string;
  vendor_name: string;
  category: VendorCategory;
  status: VendorPickStatus;
  /** Raw event_vendors.status (e.g. 'considering', 'inquiring', 'contracted') for finer-grained chips. */
  raw_status: string | null;
  total_cost_php: number | null;
  deposit_paid_php: number | null;
  notes: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type GroupedPicks = {
  groupId: PlanGroupId;
  picks: ReadonlyArray<PlanCardPick>;
};

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Bucket event_vendors rows into the 12-group structure. */
export function bucketVendorsByGroup(
  vendors: ReadonlyArray<{
    vendor_id: string;
    vendor_name: string;
    category: VendorCategory;
    status: string | null;
    total_cost_php?: number | string | null;
    deposit_paid_php?: number | string | null;
    notes?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  }>,
): Map<PlanGroupId, GroupedPicks['picks']> {
  const out = new Map<PlanGroupId, Array<GroupedPicks['picks'][number]>>();
  for (const g of PLAN_GROUPS) out.set(g.id, []);

  for (const v of vendors) {
    const pick: PlanCardPick = {
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      category: v.category,
      status: statusOfVendor(v.status),
      raw_status: v.status ?? null,
      total_cost_php: toNum(v.total_cost_php ?? null),
      deposit_paid_php: toNum(v.deposit_paid_php ?? null),
      notes: v.notes ?? null,
      contact_email: v.contact_email ?? null,
      contact_phone: v.contact_phone ?? null,
    };
    for (const g of PLAN_GROUPS) {
      if (g.categories.includes(v.category)) {
        out.get(g.id)!.push(pick);
      }
    }
  }
  return out as Map<PlanGroupId, GroupedPicks['picks']>;
}

/**
 * Compute the target lock-by date for a group given the wedding date.
 * Returns null if event_date is missing.
 */
export function computeTargetDate(
  weddingDateIso: string | null,
  monthsBefore: number,
): Date | null {
  if (!weddingDateIso) return null;
  const wedding = new Date(weddingDateIso);
  if (Number.isNaN(wedding.getTime())) return null;
  const target = new Date(wedding);
  target.setMonth(target.getMonth() - monthsBefore);
  return target;
}

export type TargetDateStatus =
  | { tone: 'none'; label: string }
  | { tone: 'overdue'; label: string; daysOverdue: number }
  | { tone: 'soon'; label: string; daysOut: number }
  | { tone: 'fine'; label: string; daysOut: number };

/**
 * Format the target date with a status tone the card can color-key against.
 *   - none    → no wedding date set yet
 *   - overdue → past the target
 *   - soon    → within 30 days of the target
 *   - fine    → comfortable lead time still
 */
export function targetDateStatus(
  weddingDateIso: string | null,
  monthsBefore: number,
  hasAtLeastOneLocked: boolean,
): TargetDateStatus {
  const target = computeTargetDate(weddingDateIso, monthsBefore);
  if (!target) {
    return { tone: 'none', label: 'Set a wedding date to see your timeline' };
  }
  if (hasAtLeastOneLocked) {
    return {
      tone: 'fine',
      label: formatTargetDate(target),
      daysOut: 0,
    };
  }
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return {
      tone: 'overdue',
      label: `Overdue by ${-diffDays} day${diffDays === -1 ? '' : 's'}`,
      daysOverdue: -diffDays,
    };
  }
  if (diffDays <= 30) {
    return {
      tone: 'soon',
      label: `Lock by ${formatTargetDate(target)} · ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      daysOut: diffDays,
    };
  }
  return {
    tone: 'fine',
    label: `Lock by ${formatTargetDate(target)}`,
    daysOut: diffDays,
  };
}

function formatTargetDate(d: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}
