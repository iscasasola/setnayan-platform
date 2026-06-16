/**
 * 22-group wedding planning structure (owner directive 2026-05-22).
 *
 * The couple home page (iteration 0021) groups every relevant Filipino
 * wedding decision into 22 logical buckets, rendered in 5 tiers (Foundation
 * / Big bookings / Style + program / Extras / Paper), each anchored to a
 * typical lead-time before the wedding date. Picked vendors from
 * `event_vendors` are bucketed by group via the `categories` array; each
 * group also advertises a target date computed from the event_date and
 * `monthsBefore`.
 *
 * Coverage: every value of the `vendor_category` enum (28 entries as of
 * migration 20260513100000) maps into exactly one VENDOR-BUCKETING group,
 * so any vendor the couple saves to their event surfaces on the home
 * dashboard. Cards flagged `countsTowardLockable: false` are entry-point
 * cards — they don't bucket-receive picks and don't count in the locked /
 * left math; they exist purely as marketplace deep-link entry points
 * (Live band, Bridal car, Guest shuttle share their underlying
 * VendorCategory with another card).
 *
 * Ceremony venue and Reception venue are kept disjoint by category so
 * the same saved vendor doesn't double-render in both cards (owner
 * direction 2026-05-21):
 *   • Ceremony venue   ← religious_venue · church_fees
 *   • Reception venue  ← venue
 * A combined-venue wedding (one place hosting both) requires adding the
 * vendor to BOTH cards manually — the Reception hint nudges couples to
 * do that.
 *
 * 22-card expansion (2026-05-22) — owner directive verbatim: "where are the
 * cocktail booths, band, host, coordinator and other vendor affiliated
 * services, shouldn't they be here as well?" The prior 12-card grid was
 * too compressed: coordinator was buried in "Logistics" but is the most
 * important Filipino-wedding role; live band buried in "Music &
 * Entertainment"; host/MC, cocktail booths, LED background, lights &
 * sound, bridal car, photobooth, rings, guest shuttle, photobooth — all
 * needed first-class cards.
 */

import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import {
  TAXONOMY_MAP,
  WEDDING_TILE_SLUG,
  type WeddingFolder,
  type WeddingTile,
} from '@/lib/taxonomy';

export type PlanGroupId =
  // Foundation tier
  | 'ceremony_venue'
  | 'reception_venue'
  | 'coordinator'
  // Big bookings tier
  | 'officiant'
  | 'catering'
  | 'photography'
  | 'attire'
  | 'hair_makeup'
  // Style + program tier
  | 'florals_decor'
  | 'stylist'
  | 'live_band'
  | 'music_entertainment'
  | 'dance_instructor'
  // 2026-05-25 owner directive ("finding after party band/dj is gone").
  // Late-night DJ for the after-party block · separate from
  // music_entertainment (which covers the formal reception program).
  | 'after_party_music'
  | 'host_mc'
  | 'lights_sound'
  | 'led_background'
  // Extras tier
  | 'cocktail_booths'
  | 'photobooth'
  | 'cake'
  | 'bridal_car'
  | 'guest_shuttle'
  | 'rings'
  | 'accommodation'
  // Paper tier
  | 'invitations_stationery'
  | 'logistics';

/**
 * Tier groupings for the 5-section card render (owner directive
 * 2026-05-22). Each tier renders as a labeled subsection with cards
 * grouped underneath. Order within a tier matches PLAN_GROUPS order.
 */
export type PlanGroupTier =
  | 'foundation'
  | 'big_bookings'
  | 'style_program'
  | 'extras'
  | 'paper'
  // DIY tier · added 2026-05-30 · holds dynamic plan cells spawned from
  // Add A Category picks (lib/wedding-plan-groups.ts getCustomPlanGroups
  // helper). Renders at the END of the planning grid as a separate
  // subsection · keeps the 12 baseline tiers untouched.
  | 'custom_picks';

export const PLAN_GROUP_TIER_ORDER: ReadonlyArray<PlanGroupTier> = [
  'foundation',
  'big_bookings',
  'style_program',
  'extras',
  'paper',
  // Custom DIY picks render after the canonical 5 tiers so the host walks
  // through the locked structure first, then sees their personal additions.
  'custom_picks',
];

export const PLAN_GROUP_TIER_LABEL: Record<PlanGroupTier, string> = {
  foundation: 'Foundation',
  big_bookings: 'Big bookings',
  style_program: 'Style + program',
  extras: 'Extras',
  paper: 'Paper',
  custom_picks: 'Your additions',
};

/**
 * Optional one-line subtitle rendered under each tier heading. Short,
 * brand-voice — sets context for the cards underneath without being
 * preachy. Empty strings render no subtitle.
 */
export const PLAN_GROUP_TIER_HINT: Record<PlanGroupTier, string> = {
  foundation: 'Locks the date and unblocks everything else. Book first.',
  big_bookings: 'The largest line items. Top suppliers fill 6-12 months out.',
  style_program: 'Sets the vibe of the day. Pin the palette before locking.',
  extras: 'The atmosphere makers. Most are 2-4 months out.',
  paper: 'Stationery and the small choices that round out the day.',
  custom_picks:
    'Categories you added from Add A Category — browse vendors at your own pace.',
};

export type PlanGroup = {
  id: PlanGroupId;
  label: string;
  hint: string;
  tier: PlanGroupTier;
  /** vendor_category enum values that count toward this group. */
  categories: ReadonlyArray<VendorCategory>;
  /** How many months before the wedding date to aim to have this locked. */
  monthsBefore: number;
  /**
   * Which catalog folder the planner's [Search] button anchors into.
   * The marketplace's CatalogView renders each folder as a `<section
   * id={WEDDING_FOLDER_SLUG[folder]}>` so a URL like `/explore#ceremony`
   * lands the couple on the rich PairedVenuePanel + CeremonyVenuesSection
   * directly — no filter applied, full curated browse view.
   */
  catalogFolder: WeddingFolder;
  /**
   * Optional tile (10-parent model, 2026-05-31). When set, the planner
   * card's [Search] button deep-links to `/explore?tile=<tile-slug>` —
   * the tile-scoped vendor grid (overlaps the tile's canonical set). Takes
   * precedence over `subcategoryHint`. Omit for cards that should browse
   * the whole parent (e.g. Attire → all LOOK tiles).
   */
  catalogTile?: WeddingTile;
  /**
   * Optional canonical_service hint (from the taxonomy at
   * `TAXONOMY_MAP` in apps/web/lib/taxonomy.ts). When set, the planner
   * card's [Search] button deep-links to
   * `/explore?folder=<slug>&category=<hint>` — vendor-grid mode filtered
   * to that specific canonical_service. When omitted, falls back to
   * `/explore?folder=<slug>#<slug>` — catalog mode scoped to the folder.
   *
   * Used for sub-category cards (Live band, Host/MC, Cocktail Booths,
   * LED Background, etc.) so the host's discovery jump lands on the
   * specific service slice instead of the broader folder. Per CLAUDE.md
   * 2026-05-22 22-card grid expansion.
   */
  subcategoryHint?: string;
  /**
   * When false, this card is an entry-point card only — it doesn't
   * bucket-receive vendor picks (its `categories` array is empty), and
   * it's excluded from the lockedCards / leftToLock counter math.
   *
   * Used for the 3 sub-category cards whose underlying VendorCategory is
   * already owned by another card (Live band shares `band_dj` with
   * Music; Bridal car + Guest shuttle share `transportation` with
   * Logistics). Including them as full bucketing groups would
   * double-count a single band vendor toward both Live band AND Music,
   * inflating the locked count. The entry-point pattern keeps them as
   * marketplace discovery jumps without polluting the math.
   *
   * Default `true` (counts toward locked / left). Omit on regular cards.
   */
  countsTowardLockable?: boolean;
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
    inc: 'DJ, choir, music for the program. No alcohol bar at INC receptions.',
    muslim: 'DJ or kulintang ensemble. No-alcohol mobile bar.',
    cultural: 'Traditional ensemble — kulintang, rondalla, folk — alongside DJ.',
  },
  host_mc: {
    inc: 'Your emcee carries the program. Brief them on INC-specific protocols and dry reception.',
    muslim: 'Emcee for the akad nikah celebration. Coordinate cultural cues + bilingual delivery.',
    cultural: 'Host who can carry cultural protocols and bilingual or trilingual delivery.',
  },
  cocktail_booths: {
    inc: 'Mocktail bar, coffee, juice. INC receptions are alcohol-free — book non-alcoholic booths.',
    muslim: 'Non-alcoholic booths — coffee, mocktails, juice. Halal-friendly only.',
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
 * MULTI-PICK folders (owner 2026-06-09): categories under these parents can hold
 * MORE THAN ONE service in the build (a couple may book several booths, prints,
 * or attire pieces). Every other folder is single-pick — adding a second vendor
 * replaces the first. Keyed by `catalogFolder` so it tracks the taxonomy.
 */
export const MULTI_PICK_FOLDERS: ReadonlySet<WeddingFolder> = new Set<WeddingFolder>([
  'look',
  'booths',
  'prints',
]);

/** Does this plan group allow multiple build picks? (catalogFolder ∈ multi-pick) */
export function isMultiPickGroup(groupId: string): boolean {
  const g = PLAN_GROUPS.find((x) => x.id === groupId);
  return g ? MULTI_PICK_FOLDERS.has(g.catalogFolder) : false;
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
  // ════════ Foundation tier ════════
  {
    id: 'ceremony_venue',
    label: 'Ceremony venue',
    hint: 'Where you say I do — book early, the best places fill 12 months out.',
    tier: 'foundation',
    // 'venue' deliberately NOT here — it lives in reception_venue so a
    // saved hotel/garden doesn't surface in both cards. Combined-venue
    // weddings add their pick to BOTH groups manually per the
    // reception-side hint.
    categories: ['religious_venue', 'church_fees'],
    monthsBefore: 12,
    catalogFolder: 'venue',
    catalogTile: 'ceremony_venue',
  },
  {
    id: 'reception_venue',
    label: 'Reception venue',
    hint: 'Where you celebrate after. Same place as ceremony? Add it under both.',
    tier: 'foundation',
    categories: ['venue'],
    monthsBefore: 12,
    catalogFolder: 'venue',
    catalogTile: 'reception',
  },
  {
    id: 'coordinator',
    label: 'Wedding coordinator',
    hint: 'Your day-of conductor. Top coordinators book 9-12 months out.',
    tier: 'foundation',
    categories: ['planner_coordinator'],
    monthsBefore: 12,
    catalogFolder: 'planning',
    catalogTile: 'coordinator',
    subcategoryHint: 'wedding_coordination',
  },

  // ════════ Big bookings tier ════════
  {
    id: 'officiant',
    label: 'Officiant',
    hint: 'Priest, pastor, or judge. Civil ceremonies need them booked early too.',
    tier: 'big_bookings',
    categories: ['officiant'],
    monthsBefore: 9,
    catalogFolder: 'venue',
    catalogTile: 'ceremony_venue',
    subcategoryHint: 'officiant_priest_minister',
  },
  {
    id: 'catering',
    label: 'Catering',
    hint: 'Food + service. Tastings happen 4-6 months out; book the team earlier.',
    tier: 'big_bookings',
    categories: ['catering'],
    monthsBefore: 9,
    catalogFolder: 'feast',
    catalogTile: 'catering',
    subcategoryHint: 'catering',
  },
  {
    id: 'photography',
    label: 'Photography & Video',
    hint: 'Photo + video team for the day. Often booked together.',
    tier: 'big_bookings',
    categories: ['photographer', 'videographer'],
    monthsBefore: 9,
    catalogFolder: 'documentary',
    catalogTile: 'photo_video',
  },
  {
    id: 'attire',
    label: 'Attire',
    hint: 'Gown, suit, and the rings. Designers need fitting time.',
    tier: 'big_bookings',
    // 'rings' moved to its own card in 22-card grid expansion (2026-05-22);
    // attire now owns gown + suit + designers only.
    categories: ['gown_designer', 'suit_designer'],
    monthsBefore: 8,
    catalogFolder: 'look',
  },
  {
    id: 'hair_makeup',
    label: 'Hair & Makeup',
    hint: 'Bridal + entourage glam. Trials happen 1-2 months before the day.',
    tier: 'big_bookings',
    categories: ['makeup_artist', 'hair_stylist'],
    monthsBefore: 6,
    catalogFolder: 'look',
    catalogTile: 'hmua',
    subcategoryHint: 'bridal_hmua',
  },

  // ════════ Style + program tier ════════
  {
    id: 'florals_decor',
    label: 'Florals & Decor',
    hint: 'Bouquets, aisle, reception styling. Pin colors first, then book.',
    tier: 'style_program',
    categories: ['florist', 'reception_decor'],
    monthsBefore: 6,
    catalogFolder: 'design',
    catalogTile: 'florist',
    subcategoryHint: 'florals',
  },
  {
    // Added 2026-05-24 (owner directive · "update things to lock in")
    // to mirror the wizard's `stylist` card at position 16. Filipino
    // weddings often hire a stylist umbrella vendor who coordinates
    // florals + decor + signage + table styling — a layer above the
    // individual florist + decor picks. Entry-point card · the host's
    // actual pick links to the broader Decor/Florals/Sound marketplace
    // folder filtered to stylist sub-tag. Doesn't double-count against
    // florals_decor (countsTowardLockable: false).
    id: 'stylist',
    label: 'Stylist',
    hint: 'Stylist umbrella — coordinates florals + decor + signage + tablescapes to your mood board.',
    tier: 'style_program',
    categories: [],
    monthsBefore: 6,
    catalogFolder: 'design',
    catalogTile: 'stylist_decorator',
    subcategoryHint: 'stylist',
    countsTowardLockable: false,
  },
  {
    id: 'live_band',
    label: 'Live band',
    hint: 'Sets the energy of your reception. Top bands book 6-9 months ahead.',
    tier: 'style_program',
    // Entry-point card — picks bucket under music_entertainment.
    categories: [],
    monthsBefore: 6,
    catalogFolder: 'program',
    catalogTile: 'live_band',
    subcategoryHint: 'live_band',
    countsTowardLockable: false,
  },
  {
    id: 'music_entertainment',
    // 2026-05-24 owner directive · matches wizard rename "Lock your DJ
    // + music" → "Band / DJ / Performer". The card already covers
    // band_dj + string_quartet + choir; label now matches the breadth.
    label: 'Band / DJ / Performer',
    hint: 'Band, DJ, string quartet, choir, acoustic duo — whichever performer carries your program.',
    tier: 'style_program',
    // host_emcee broken out to its own card in 22-card grid expansion
    // (2026-05-22). Mobile bar moved to cocktail_booths. Photobooth
    // moved to its own card.
    categories: ['band_dj', 'string_quartet', 'choir'],
    monthsBefore: 6,
    catalogFolder: 'program',
    subcategoryHint: 'dj',
  },
  {
    // Added 2026-05-24 (owner directive · "also add Dance Instructor")
    // to mirror the wizard's `dance_instructor` card at position 20.
    // Filipino weddings hire choreographers for first dance + entourage
    // dance + parents-and-couple dance. Lessons run T-2 to T-3 months.
    // Entry-point card · marketplace surface filters Music & Program
    // folder to choreographer sub-tag. No VendorCategory enum entry
    // yet · uses entry-point pattern (countsTowardLockable: false).
    id: 'dance_instructor',
    label: 'Dance instructor',
    hint: 'First dance + parents-and-couple dance + entourage choreography. Lessons run 2-3 months before the day.',
    tier: 'style_program',
    categories: [],
    monthsBefore: 4,
    catalogFolder: 'program',
    catalogTile: 'choreographer',
    subcategoryHint: 'choreographer',
    countsTowardLockable: false,
  },
  {
    // Added 2026-05-25 (owner directive · "finding after party band/dj
    // is gone"). PH weddings increasingly run a late-night after-party
    // block once the formal reception ends — separate DJ, different
    // playlist, distinct from the primary band/DJ booked under
    // music_entertainment. Marketplace surface filters Music & Program
    // folder to the `dj` sub-tag so vendors who self-tag both reception
    // + after-party slots show up consistently. Picks bucket against
    // the `band_dj` legacy enum so locked picks aggregate correctly in
    // the plan-grid display (the wizard card's canonical filter on
    // vendor_profiles.services narrows to `dj` only).
    id: 'after_party_music',
    label: 'After-party DJ',
    hint: 'Late-night dance floor DJ for the after-party block. Lock 4-6 weeks pre-wedding once the reception program is set.',
    tier: 'style_program',
    // Entry-point pattern (empty categories) · mirrors live_band +
    // dance_instructor. Picks locked via this wizard card write
    // event_vendors.category='band_dj' (per VENDOR_PICK_CATEGORY map
    // in wizard-actions.ts) and bucket onto the music_entertainment
    // plan-grid cell along with the primary band/DJ. Differentiating
    // visual cells per wizard-task source requires adding source_task_id
    // to event_vendors — V1.x follow-up. For V1, the wizard card itself
    // is the canonical surface; the plan-grid cell aggregates.
    categories: [],
    monthsBefore: 1,
    catalogFolder: 'program',
    catalogTile: 'dj',
    subcategoryHint: 'dj',
    countsTowardLockable: false,
  },
  {
    id: 'host_mc',
    label: 'Host / MC',
    hint: 'Carries the program from cocktail hour through send-off. Book 4-6 months out.',
    tier: 'style_program',
    categories: ['host_emcee'],
    monthsBefore: 5,
    catalogFolder: 'program',
    catalogTile: 'host_mc',
    subcategoryHint: 'host_emcee',
  },
  {
    id: 'lights_sound',
    label: 'Lights & Sound',
    hint: 'Reception PA + lights setup. Confirm the venue power supply.',
    tier: 'style_program',
    categories: ['lights_and_sound'],
    monthsBefore: 5,
    catalogFolder: 'design',
    catalogTile: 'lights_sound',
    subcategoryHint: 'lights_sound',
  },
  {
    id: 'led_background',
    label: 'LED Background',
    hint: 'Brings your monogram + theme to the stage. Setnayan can render 8K loops.',
    tier: 'style_program',
    categories: ['led_screens'],
    monthsBefore: 3,
    catalogFolder: 'design',
    catalogTile: 'led_wall',
    subcategoryHint: 'setnayan_pailaw',
  },

  // ════════ Extras tier ════════
  {
    id: 'cocktail_booths',
    label: 'Cocktail Booths',
    hint: 'Mobile bar, coffee, tea, cocktail station — the social glue of cocktail hour.',
    tier: 'extras',
    categories: ['mobile_bar'],
    monthsBefore: 4,
    catalogFolder: 'booths',
    catalogTile: 'mobile_bar',
    subcategoryHint: 'mobile_bar',
  },
  {
    id: 'photobooth',
    label: 'Photobooth',
    hint: 'Classic, mirror, 360, slow-mo, polaroid — pick the style that fits your vibe.',
    tier: 'extras',
    categories: ['photobooth'],
    monthsBefore: 3,
    catalogFolder: 'booths',
    catalogTile: 'photo_booth',
    subcategoryHint: 'photo_booth',
  },
  {
    id: 'cake',
    label: 'Cake',
    hint: 'Tastings 3-4 months out. Order locks 1 month before.',
    tier: 'extras',
    categories: ['cake_maker'],
    monthsBefore: 4,
    catalogFolder: 'feast',
    catalogTile: 'cake',
    subcategoryHint: 'wedding_cake',
  },
  {
    id: 'bridal_car',
    label: 'Bridal Car',
    hint: 'Your wedding-day arrival vehicle. Vintage, luxury, or classic.',
    tier: 'extras',
    // 2026-05-24 fix · PLAN_GROUPS.bridal_car.categories was empty until
    // this PR, causing every 'transportation' pick (e.g., bridal-car-card.tsx
    // which surfaces canonical='transportation' vendors) to fall through to
    // the `logistics` catch-all PLAN_GROUP instead of bucketing into this
    // dedicated Bridal Car cell. Per CLAUDE.md 2026-05-24 tenth row's "PR
    // follow-1 · 1-line fix" acknowledgement — assigning 'transportation'
    // here closes the orphan-cell loop without touching the VendorCategory
    // enum or any migration. Guest shuttle stays orphan-cell until the
    // V1.x split into 'transportation_bridal_car' + 'transportation_guest_shuttle'
    // sub-categories lands (separate PR · needs new enum values + migration
    // on event_vendors.category CHECK constraint per CLAUDE.md tenth row's
    // PR follow-3).
    categories: ['transportation'],
    monthsBefore: 2,
    catalogFolder: 'transport',
    catalogTile: 'bridal_car',
    subcategoryHint: 'transportation_bridal_car',
    countsTowardLockable: false,
  },
  {
    id: 'guest_shuttle',
    label: 'Guest Shuttle',
    hint: 'Keeps far-venue guests stress-free. Book once you have an approximate headcount.',
    tier: 'extras',
    // Entry-point card — picks bucket under logistics.
    categories: [],
    monthsBefore: 2,
    catalogFolder: 'transport',
    catalogTile: 'guest_shuttle',
    subcategoryHint: 'transportation_guest_shuttle',
    countsTowardLockable: false,
  },
  {
    id: 'rings',
    label: 'Rings',
    hint: 'Most-photographed object of your wedding. Custom takes 6-8 weeks.',
    tier: 'extras',
    categories: ['rings'],
    monthsBefore: 3,
    catalogFolder: 'look',
    catalogTile: 'jewelleries_accessories',
    subcategoryHint: 'wedding_ring',
  },
  {
    id: 'accommodation',
    label: 'Accommodation',
    // 23rd vendor card (2026-05-22, owner directive verbatim): "also add
    // accommodation. sometime this will be dedicated to places where people
    // need to rest for their wedding. sometimes hotel includes this on their
    // package." Where you and your wedding party rest the night before /
    // night of — sometimes included in your reception hotel package via the
    // vendor_packages cascade (see migration 20260604110000 + the 6 hotel
    // package seeds in 20260604150000). Sits in the Extras tier alongside
    // Cocktail Booths · Photobooth · Cake · Bridal Car · Guest Shuttle ·
    // Rings — none of these block the booking on their own, but each
    // shapes the day. Folder = planning_logistics_travel because hotels +
    // venue-affiliated room blocks live alongside transportation and
    // travel logistics.
    hint: 'Where you and your wedding party rest the night before. Sometimes bundled with your reception hotel package — book 1-2 months out before room blocks fill.',
    tier: 'extras',
    categories: ['accommodation'],
    monthsBefore: 2,
    catalogFolder: 'venue',
    catalogTile: 'reception',
    subcategoryHint: 'accommodation',
  },

  // ════════ Paper tier ════════
  {
    id: 'invitations_stationery',
    label: 'Invitations & Stationery',
    hint: 'Save-the-dates, invites, monogram, table cards, menus.',
    tier: 'paper',
    categories: ['invitations_stationery'],
    monthsBefore: 4,
    catalogFolder: 'prints',
    catalogTile: 'printing',
    subcategoryHint: 'invitation_print',
  },
  {
    id: 'logistics',
    label: 'Logistics & Misc',
    hint: 'Transportation, security, giveaways, and the rest.',
    tier: 'paper',
    categories: [
      'transportation',
      'security',
      'gifts_and_giveaways',
      'misc',
    ],
    monthsBefore: 2,
    catalogFolder: 'transport',
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

/**
 * Saturation rules per CLAUDE.md 2026-05-09 lock + 2026-05-20 row 470
 * (12-folder marketplace remap) + 2026-05-22 22-card grid expansion.
 *
 * Hard-single groups: only one vendor can be locked at any time. A
 * second lock attempt surfaces a Switch / Cancel modal so the host can
 * either swap the existing lock OR cancel the new attempt.
 *
 * Soft-single + multi-uncapped groups: lock proceeds without confirm.
 * (Soft-single warning UX is V1.1 — for V1 we don't gate beyond the
 * hard-single set because the multi-pick reality is common across
 * Filipino weddings — e.g. two principal officiants, three photo teams.)
 *
 * Hard-single across the 22-card grid:
 *   • ceremony_venue   — 1 church/chapel only
 *   • reception_venue  — 1 venue only
 *   • officiant        — 1 officiant. Mixed-faith weddings override via Switch.
 *   • coordinator      — 1 coordinator. Partial-coordinator splits handle
 *     via the Logistics card multi-pick.
 *   • host_mc          — 1 emcee. Co-hosts handled via Switch + custom
 *     vendor add to the secondary slot.
 *   • led_background   — 1 LED supplier. Multi-screen events go via
 *     Logistics multi-pick.
 *
 * Other groups have legitimate multi-lock scenarios:
 *   • catering: 1 main caterer is common but specialty caterers (cake,
 *     dessert bar, signature drinks) are routinely co-locked.
 *   • photography: photo + video are separate categories often booked
 *     separately as 2 different vendors.
 *   • attire: gown + suit are 2 separate vendors.
 *   • hair_makeup: bridal MUA + hair + family MUA all separately booked.
 *   • florals_decor: florist + stylist often separate.
 *   • music_entertainment: DJ + string quartet + choir all separable.
 *   • cocktail_booths: multiple booth types co-locked (mobile bar +
 *     coffee + cocktail station).
 *   • photobooth: classic + 360 + mirror sometimes co-booked.
 *   • logistics: transportation + security + giveaways all separate.
 */
export const HARD_SINGLE_PICK_GROUPS: ReadonlySet<PlanGroupId> = new Set([
  'ceremony_venue',
  'reception_venue',
  'officiant',
  'coordinator',
  'host_mc',
  'led_background',
]);
// after_party_music NOT in HARD_SINGLE — it's an entry-point card
// (countsTowardLockable: false). Picks locked via this card aggregate
// into the music_entertainment plan-grid cell where the existing
// non-hard-single semantics apply (multiple band_dj picks allowed).

export function isHardSinglePickGroup(groupId: PlanGroupId): boolean {
  return HARD_SINGLE_PICK_GROUPS.has(groupId);
}

/**
 * Look up which PlanGroupId a vendor category belongs to, or null if the
 * category isn't part of any planning group. Mirrors the
 * `bucketVendorsByGroup` logic but returns just the bucket key — used
 * by the finalize server action to gate hard-single conflict checks
 * against the canonical group definition.
 *
 * Entry-point cards (countsTowardLockable: false) are skipped because
 * their categories array is empty by definition; vendor rows with
 * shared VendorCategory enum values resolve to the primary card.
 */
export function planGroupForCategory(
  category: VendorCategory,
): PlanGroupId | null {
  for (const g of PLAN_GROUPS) {
    if (g.categories.includes(category)) return g.id;
  }
  return null;
}

/**
 * Resolve a canonical service string (from vendor_services.category) to its
 * target PlanGroupId. Used by the auto-add cascade in finalizeVendor (CLAUDE.md
 * 2026-05-22) — when a vendor is locked in category X, their OTHER services
 * (rows in vendor_services with different categories) auto-appear as
 * considering picks in the corresponding target PlanGroups.
 *
 * Lightweight wrapper around `planGroupForCategory` that accepts the raw
 * string from the DB (vendor_services.category is TEXT, not the enum type)
 * and validates it's a known VendorCategory before resolving. Returns null
 * for unknown / future canonical services so the cascade silently skips
 * rows it can't bucket — never crashes, never inserts orphan rows.
 *
 * If Task #26's cross-category recommendations land first with a richer
 * version of this helper, this file's helper will be replaced by an
 * import from there (same signature). Until then this is the canonical
 * resolver for canonical_service → PlanGroupId.
 */
export function canonicalServiceToPlanGroupId(
  canonicalService: string,
): PlanGroupId | null {
  // VendorCategory is the enum that backs event_vendors.category AND
  // vendor_services.category. Validate by membership in PLAN_GROUPS'
  // declared category sets (which collectively cover the full enum).
  for (const g of PLAN_GROUPS) {
    if ((g.categories as readonly string[]).includes(canonicalService)) {
      return g.id;
    }
  }
  return null;
}

/**
 * Compatibility issue surfaced on a pick when the host's
 * `events.ceremony_type` OR `events.venue_setting` has drifted away
 * from a previously-picked vendor's tagged compatibility set.
 *
 * Three kinds (one pick can only have one — religion takes precedence
 * because it's the more semantically severe mismatch):
 *   • religion — vendor's compatible_ceremony_types[] doesn't include
 *     the host's current ceremony_type.
 *   • venue_setting — vendor's compatible_venue_settings[] doesn't
 *     include the host's current venue_setting.
 *   • directory — for picks linked via source_venue_directory_id only,
 *     the venue_directory.compatible_ceremony_types check (no
 *     venue_setting on directory rows).
 *
 * `kind: 'none'` is intentionally omitted — null on PlanCardPick means
 * "no mismatch surfaced" so the chip just doesn't render. Saves a
 * truthiness check at every consumer site.
 */
export type PlanCardCompatibilityIssue =
  | {
      kind: 'religion';
      /** Human-readable: the picked vendor doesn't match the host's faith. */
      label: string;
    }
  | {
      kind: 'venue_setting';
      label: string;
    }
  | {
      kind: 'directory';
      label: string;
    };

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
  /**
   * DIY parity (2026-06-11): host-authored "what's included" lines for a
   * manual vendor's package. Flows to Compare's expandable inclusions. Absent
   * (undefined/null) on marketplace rows + callers that don't select it.
   */
  host_inclusions?: string[] | null;
  /**
   * Compatibility issue, if any, with the host's current
   * events.ceremony_type / events.venue_setting. Surfaced as an inline
   * chip + Remove action on the planning-card pick row. `null` when the
   * vendor is compatible OR when the pick has no compatibility data
   * (off-platform / custom row with no marketplace_vendor_id and no
   * source_venue_directory_id — we can't check what we don't know).
   */
  compatibility_issue: PlanCardCompatibilityIssue | null;
  /**
   * Finalized-vendor-photo-card (2026-05-22, owner directive).
   *
   * For marketplace-linked picks (vendor_profiles join via
   * marketplace_vendor_id), carries the vendor's canonical logo URL +
   * business name + city so the locked-state Home surfaces can render
   * a photo/logo card instead of just a text chip. All three are null
   * for off-platform / custom rows where the host typed the vendor
   * name themselves (no vendor_profiles row to read from). Consumers
   * fall back to initials-on-terracotta + `vendor_name` in that case.
   *
   * Existing surfaces that don't care about the marketplace identity
   * (the considering/shortlisted compare drawer, the vendor tracker
   * status chips) simply ignore these fields — they're additive.
   */
  marketplace_logo_url: string | null;
  marketplace_business_name: string | null;
  marketplace_city: string | null;
  /**
   * Finalized-card-service-photo refinement (2026-05-22, follow-up on
   * PR #341). Resolved public URL for the booked service's primary
   * photo. Renders as PRIORITY 2 on FinalizedChipStrip + LockedCard
   * avatars (after manual_vendor_photo_url); falls back to
   * `marketplace_logo_url`, then initials. See
   * EventVendorRowInput.service_primary_photo_url for the source-side
   * doc.
   */
  service_primary_photo_url: string | null;
  /**
   * 2026-05-22 owner directive — manual vendor photo URL takes PRIORITY 1
   * when the host attached a manual contact. Photo source is
   * `event_manual_vendors.photo_r2_key` → r2PublicUrl(). NULL on
   * marketplace picks (no manual_vendor link) and on manual picks
   * where the host skipped the photo upload. Falls through to
   * service_primary_photo_url → marketplace_logo_url → initials.
   */
  manual_vendor_photo_url: string | null;
  /**
   * Auto-add-cascade-on-finalize source tracking (2026-05-22, owner
   * directive). When `source === 'auto_cascade_from_finalize'`, this
   * pick was inserted by the cascade — the host locked the SAME vendor
   * in a different category and the cascade brought their other
   * services in as considering picks. The planning-card UI renders a
   * small Sparkles badge on these rows reading "Auto-added because
   * they're handling your {source_category}".
   *
   * `null` for legacy rows (pre-2026-05-22) — UI treats null as no
   * badge. 'host_manual' for createVendor / addCustomVendor inserts;
   * UI treats this the same as null (no badge — the host added it
   * themselves, no need to explain).
   */
  source: string | null;
  /**
   * Only set when source === 'auto_cascade_from_finalize'. Stores the
   * source VendorCategory the cascade fired from so the badge can
   * render the human-readable label (e.g. "your Catering pick").
   * NULL otherwise.
   */
  source_category: VendorCategory | null;
  /**
   * Vendor packages back-link (owner directive 2026-05-22 — vendor
   * packages + cascade-lock). When the event_vendors row was cascade-
   * created from a locked vendor package, these carry the booking ID
   * + package name. Powers the "Included in <package name>" badge on
   * the LockedCard variant.
   *
   * Both are null on standalone (non-package) event_vendors rows.
   * Consumers fall back to the normal locked-card render in that case.
   */
  event_vendor_package_id: string | null;
  package_name: string | null;
  /**
   * Adaptive Pax Pricing (migration 20261211000000). The vendor-confirmed
   * per-pax surcharge baked into total_cost_php + the counts that explain it,
   * for the read-only "+₱X for Y guests over the Z-guest package" card
   * footnote. NULL/0 surcharge → nothing renders (the common case).
   */
  pax_surcharge_php?: number | null;
  pax_quote_base?: number | null;
  cost_basis_pax?: number | null;
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

/**
 * Input shape for `bucketVendorsByGroup`. Wider than the pre-PR-B
 * payload — adds the marketplace + directory link columns + the joined
 * compatibility arrays so the compat-mismatch check runs entirely in
 * memory (no extra DB roundtrip).
 *
 * The `*_compatible_ceremony_types` / `*_compatible_venue_settings`
 * fields come from a Supabase nested-select join on `vendor_profiles`
 * + `venue_directory` from the same `event_vendors` query — see
 * `apps/web/app/dashboard/[eventId]/page.tsx`. `null` covers three
 * shapes: column-not-set (open to all), join-missed (link FK is NULL),
 * or schema-pre-iteration-0043 (legacy rows without the columns).
 *
 * Behavior per [[feedback_setnayan_senior_dev_persona]]: null array = "open
 * to all" (same convention used by /vendors religion-default-on
 * filter, PR #305, so the dashboard side reads from the same source
 * of truth).
 */
export type EventVendorRowInput = {
  vendor_id: string;
  vendor_name: string;
  category: VendorCategory;
  status: string | null;
  total_cost_php?: number | string | null;
  deposit_paid_php?: number | string | null;
  notes?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  /** Optional link to a real vendor_profiles row — if set, we use its compat arrays. */
  marketplace_vendor_id?: string | null;
  /** Optional link to a venue_directory row — if set AND there's no marketplace link, we use its compat array. */
  source_venue_directory_id?: string | null;
  /**
   * Optional link to an event_manual_vendors row (2026-05-22 owner
   * directive). When set, the host attached a manual contact (Photo +
   * Name + Contact Person + Phone) to this category. The contact info
   * lives on the linked row + propagates across every event_vendors
   * row that shares the same manual_vendor_id. NULL on marketplace
   * picks (use marketplace_vendor_id instead) and on pre-2026-05-22
   * freeform rows.
   */
  manual_vendor_id?: string | null;
  /**
   * DIY parity (2026-06-11): host-authored package description for manual
   * vendors — inclusions lines + "also covers" plan-group ids. The covers
   * render through the same linked-services chips as marketplace links
   * (merged into the enrichment map by the page fetch).
   */
  host_inclusions?: string[] | null;
  covers_plan_groups?: string[] | null;
  /**
   * Resolved public URL for the linked manual vendor's photo (when
   * the host uploaded one at create-time). Source path is
   * `event_manual_vendors.photo_r2_key` → `r2PublicUrl()` in the
   * dashboard page.tsx data fetch (NOT a raw R2 key, so consumers can
   * hand it straight to next/image). NULL when no photo OR when the
   * row is not manual-vendor-linked.
   *
   * Renders as PRIORITY 1 on the LockedVendorAvatar + FinalizedChipStrip
   * avatars when the row has a manual_vendor link. See the upgraded
   * 4-tier ladder in those components for the full fallback order.
   */
  manual_vendor_photo_url?: string | null;
  /** From vendor_profiles JOIN (when marketplace_vendor_id is set). */
  marketplace_compatible_ceremony_types?: string[] | null;
  marketplace_compatible_venue_settings?: string[] | null;
  /** From venue_directory JOIN (when source_venue_directory_id is set). */
  directory_compatible_ceremony_types?: string[] | null;
  /**
   * Finalized-vendor-photo-card (2026-05-22). Carries the marketplace
   * vendor's logo URL + canonical business name + city from the same
   * vendor_profiles join used for the compat arrays. `null` for
   * off-platform rows. See PlanCardPick.marketplace_* for consumer
   * fallback behavior.
   */
  marketplace_logo_url?: string | null;
  marketplace_business_name?: string | null;
  marketplace_city?: string | null;
  /**
   * Finalized-card-service-photo refinement (2026-05-22, follow-up on PR
   * #341). Public URL for `vendor_services.primary_photo_r2_key` —
   * resolved via `r2PublicUrl()` in the dashboard page.tsx data fetch
   * (NOT a raw R2 key, so consumers can hand it straight to next/image).
   *
   * Priority 1 on the locked-state avatars. `null` when (a) the
   * event_vendors row has no `service_id`, (b) the linked
   * vendor_services row has no `primary_photo_r2_key`, OR (c) the row is
   * off-platform / custom. Falls through to `marketplace_logo_url`
   * (PR #341 baseline), then initials placeholder.
   */
  service_primary_photo_url?: string | null;
  /**
   * Auto-add-cascade-on-finalize source tracking (2026-05-22, owner
   * directive). From event_vendors.source. See PlanCardPick.source for
   * full doc. `null` for legacy rows + when the source column isn't
   * selected.
   */
  source?: string | null;
  /**
   * From event_vendors.source_category. Only set when
   * source === 'auto_cascade_from_finalize'.
   */
  source_category?: VendorCategory | null;
  /**
   * Vendor packages back-link (owner directive 2026-05-22 — vendor
   * packages + cascade-lock). When set, this event_vendors row was
   * cascade-created from a locked package. The dashboard fetch joins
   * event_vendor_packages → vendor_packages to resolve the
   * package_name for the "Included in <package>" badge.
   */
  event_vendor_package_id?: string | null;
  package_name?: string | null;
  /**
   * Adaptive Pax Pricing (migration 20261211000000). The vendor-confirmed
   * per-pax surcharge already baked into total_cost_php + the counts that
   * explain it. pax_surcharge_php NULL/0 → no surcharge (most rows). Optional;
   * absent when the caller doesn't select them.
   */
  pax_surcharge_php?: number | null;
  pax_quote_base?: number | null;
  cost_basis_pax?: number | null;
};

/**
 * Ceremony-type readable label for the inline compat-mismatch chip
 * copy. Matches the wording in ceremony-type-chip.tsx so the host sees
 * consistent terminology across the dashboard.
 */
const CEREMONY_TYPE_READABLE_LABEL: Record<string, string> = {
  catholic: 'Catholic',
  civil: 'Civil',
  inc: 'INC',
  christian: 'Christian',
  muslim: 'Muslim',
  cultural: 'Cultural',
  mixed: 'Mixed',
};

/**
 * Venue setting readable label — matches /vendors VENUE_SETTING_LABEL.
 * Both maps drift apart safely (catch-all fallback in the consumer).
 */
const VENUE_SETTING_READABLE_LABEL: Record<string, string> = {
  banquet_hall: 'banquet hall',
  garden: 'garden',
  beach: 'beach',
  destination: 'destination resort',
  heritage: 'heritage venue',
  outdoor_tent: 'outdoor tent',
  civil_registrar: 'civil registrar',
};

function readableCeremonyType(value: string | null): string {
  if (!value) return 'wedding';
  return CEREMONY_TYPE_READABLE_LABEL[value] ?? value;
}

function readableVenueSetting(value: string | null): string {
  if (!value) return 'venue';
  return VENUE_SETTING_READABLE_LABEL[value] ?? value.replace(/_/g, ' ');
}

/**
 * Compute a single PlanCardCompatibilityIssue for a vendor row against
 * the host's current ceremony_type / venue_setting.
 *
 * Algorithm (religion > venue_setting > directory, by severity):
 *   1. If `marketplace_vendor_id` is set + compat arrays are populated:
 *      a. Religion mismatch: ceremony_type not in
 *         marketplace_compatible_ceremony_types[] → emit religion issue.
 *      b. Venue mismatch: venue_setting not in
 *         marketplace_compatible_venue_settings[] → emit venue_setting.
 *   2. If `source_venue_directory_id` is set (no marketplace link):
 *      a. Religion mismatch via directory_compatible_ceremony_types →
 *         emit directory issue (same shape as religion but tagged for
 *         consumer to know the data source).
 *   3. Otherwise (off-platform / custom row): return null.
 *
 * Returns null when:
 *   • no event ceremony_type AND no event venue_setting (nothing to check)
 *   • compat arrays are null (open-to-all convention)
 *   • compat arrays explicitly include the host's value (compatible)
 *
 * Mirrors the OR-pattern in /vendors page.tsx lines 634-656 where NULL
 * compatible_ceremony_types means "open to all" — defensive against
 * legacy / pre-iteration-0043 vendor rows.
 */
export function computeCompatibilityIssue(
  row: EventVendorRowInput,
  eventCeremonyType: string | null,
  eventVenueSetting: string | null,
): PlanCardCompatibilityIssue | null {
  // No event context = can't check anything.
  if (!eventCeremonyType && !eventVenueSetting) return null;

  // Marketplace-linked path (richest data).
  if (row.marketplace_vendor_id) {
    if (
      eventCeremonyType &&
      Array.isArray(row.marketplace_compatible_ceremony_types) &&
      row.marketplace_compatible_ceremony_types.length > 0 &&
      !row.marketplace_compatible_ceremony_types.includes(eventCeremonyType)
    ) {
      return {
        kind: 'religion',
        label: `Your wedding is now ${readableCeremonyType(eventCeremonyType)} — this vendor doesn't match.`,
      };
    }
    if (
      eventVenueSetting &&
      Array.isArray(row.marketplace_compatible_venue_settings) &&
      row.marketplace_compatible_venue_settings.length > 0 &&
      !row.marketplace_compatible_venue_settings.includes(eventVenueSetting)
    ) {
      return {
        kind: 'venue_setting',
        label: `Your reception is now a ${readableVenueSetting(eventVenueSetting)} — this vendor doesn't cover that setting.`,
      };
    }
    return null;
  }

  // Directory-linked path (venue_directory has ceremony_type only).
  if (row.source_venue_directory_id) {
    if (
      eventCeremonyType &&
      Array.isArray(row.directory_compatible_ceremony_types) &&
      row.directory_compatible_ceremony_types.length > 0 &&
      !row.directory_compatible_ceremony_types.includes(eventCeremonyType)
    ) {
      return {
        kind: 'directory',
        label: `Your wedding is now ${readableCeremonyType(eventCeremonyType)} — this venue doesn't host that ceremony.`,
      };
    }
    return null;
  }

  // Off-platform / custom row — no compat data to check.
  return null;
}

/**
 * Bucket event_vendors rows into the 22-group structure.
 *
 * `eventCeremonyType` + `eventVenueSetting` enable per-pick
 * compatibility checks. Pass `null`/`null` to skip the check (pre-PR-B
 * callers, or events with no ceremony_type / venue_setting picked).
 *
 * Entry-point cards (countsTowardLockable: false, e.g. live_band,
 * bridal_car, guest_shuttle) have empty `categories` arrays so they
 * never bucket-receive picks. Picks for those VendorCategory enum
 * values fall through to the primary card that owns the category.
 */
export function bucketVendorsByGroup(
  vendors: ReadonlyArray<EventVendorRowInput>,
  eventCeremonyType: string | null = null,
  eventVenueSetting: string | null = null,
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
      host_inclusions: v.host_inclusions ?? null,
      compatibility_issue: computeCompatibilityIssue(
        v,
        eventCeremonyType,
        eventVenueSetting,
      ),
      marketplace_logo_url: v.marketplace_logo_url ?? null,
      marketplace_business_name: v.marketplace_business_name ?? null,
      marketplace_city: v.marketplace_city ?? null,
      service_primary_photo_url: v.service_primary_photo_url ?? null,
      manual_vendor_photo_url: v.manual_vendor_photo_url ?? null,
      source: v.source ?? null,
      source_category: (v.source_category ?? null) as VendorCategory | null,
      event_vendor_package_id: v.event_vendor_package_id ?? null,
      package_name: v.package_name ?? null,
      pax_surcharge_php: toNum(v.pax_surcharge_php ?? null),
      pax_quote_base: toNum(v.pax_quote_base ?? null),
      cost_basis_pax: toNum(v.cost_basis_pax ?? null),
    };
    for (const g of PLAN_GROUPS) {
      if (g.categories.includes(v.category)) {
        out.get(g.id)!.push(pick);
      }
    }
  }
  return out as Map<PlanGroupId, GroupedPicks['picks']>;
}

// ============================================================================
// Cross-category vendor recommendations · CLAUDE.md 2026-05-22 owner directive.
//
// Owner verbatim: "when a vendor is picked and finalized or listed on something,
// they will be added as a recommended vendor for other services that they also
// provide. when the vendor is finalized, the other vendors there will be
// removed from the recommended vendors."
//
// THE PATTERN:
//   1. Host picks Vendor A in Catering (considering OR locked).
//   2. Vendor A also offers Cake + Mobile Bar services (via vendor_services
//      rows the vendor added to their profile).
//   3. Cake card + Mobile Bar card now show Vendor A as RECOMMENDED with badge
//      "also doing your catering."
//   4. Host finalizes Vendor A in any category → all OTHER considering picks
//      in THAT category auto-archive (host has committed). Cross-category
//      recommendations remain available across other cards.
//
// Compute strategy: server-side in page.tsx, no new storage table. Reads
// vendor_services for every picked vendor's marketplace_vendor_id, maps each
// vendor_services.category onto its PlanGroupId via planGroupForCategory(),
// then exposes a Map<PlanGroupId, CrossCategoryRecommendation[]> for the
// planning-groups renderer to consume.
//
// Graceful degradation: if vendor_services has 0 rows for picked vendors
// (V1 marketplace not yet populated, vendor onboarding incomplete), the
// recommendations map is empty and no RECOMMENDED sub-section renders.
// Feature is purely additive — never breaks the existing card flow.
//
// Don't recommend self: if Vendor A is already in the Catering card (the
// source group), we skip surfacing them as recommended FOR Catering. Only
// other groups they cover see the recommendation.
// ============================================================================

export type CrossCategoryRecommendation = {
  /** marketplace_vendor_id from event_vendors (== vendor_profile_id on vendor_profiles). */
  vendor_id: string;
  /** Display name from vendor_profiles.business_name OR vendor_name fallback. */
  vendor_name: string;
  /** Vendor's resolved logo URL (priority 1 service photo OR vendor_profiles.logo_url). */
  vendor_logo_url: string | null;
  /** vendor_services.category — what the vendor offers in the target group. */
  target_category: VendorCategory;
  /** Source group label — "also doing your catering," "also doing your photography," etc. */
  source_group_label: string;
  /** Source group ID for cross-reference in UI logic. */
  source_group_id: PlanGroupId;
  /** Locked/picked status from the source pick — UI may surface this differently. */
  source_status: VendorPickStatus;
  /** vendor_services.vendor_service_id — passed back into addRecommendedVendorToCategory. */
  service_id: string;
};

/**
 * Input shape for `buildCrossCategoryRecommendations`. Mirrors the
 * EventVendorRowInput shape used by bucketVendorsByGroup but adds the
 * pre-fetched vendor_services rows so the build step stays pure (no
 * Supabase calls inside the lib helper).
 */
export type CrossCategoryInput = {
  /** Subset of EventVendorRowInput — only what cross-cat recommendations need. */
  picks: ReadonlyArray<{
    /** marketplace_vendor_id (NOT event_vendors.vendor_id PK). NULL for off-platform. */
    marketplace_vendor_id: string | null;
    category: VendorCategory;
    status: string | null;
    marketplace_business_name: string | null;
    marketplace_logo_url: string | null;
    vendor_name: string;
  }>;
  /** vendor_services rows for every marketplace_vendor_id present in `picks`. */
  vendor_services: ReadonlyArray<{
    vendor_service_id: string;
    vendor_profile_id: string;
    category: string;
    is_active: boolean;
  }>;
};

/**
 * Build the Map<PlanGroupId, CrossCategoryRecommendation[]> from the host's
 * picks + the vendor_services rows of every picked marketplace vendor.
 *
 * Behavior:
 *   - Skips off-platform picks (no marketplace_vendor_id → no vendor_services).
 *   - Skips inactive services (is_active=false on vendor_services).
 *   - Skips invalid categories (vendor_services.category is a free-form TEXT,
 *     not the VendorCategory enum — we validate before mapping).
 *   - Skips services whose canonical_service maps to a PlanGroupId the vendor
 *     is ALREADY picked in (don't recommend to self).
 *   - De-dupes: if the same vendor offers two distinct services that fall
 *     into the same target group (e.g. catering + cake_maker both → cake
 *     group's catalogFolder), only the first cross-recommendation surfaces.
 *
 * Returns an empty Map (per PlanGroupId, empty array) when input is empty,
 * so consumers can call `.get(groupId) ?? []` without null-checking.
 */
export function buildCrossCategoryRecommendations(
  input: CrossCategoryInput,
): Map<PlanGroupId, CrossCategoryRecommendation[]> {
  const out = new Map<PlanGroupId, CrossCategoryRecommendation[]>();
  for (const g of PLAN_GROUPS) out.set(g.id, []);

  // Resolve the GROUPS each picked vendor is already in — so we can skip
  // recommending them to a group they're already a pick in.
  const vendorGroupMembership = new Map<string, Set<PlanGroupId>>();
  for (const p of input.picks) {
    if (!p.marketplace_vendor_id) continue;
    const groupId = planGroupForCategory(p.category);
    if (!groupId) continue;
    if (!vendorGroupMembership.has(p.marketplace_vendor_id)) {
      vendorGroupMembership.set(p.marketplace_vendor_id, new Set());
    }
    vendorGroupMembership.get(p.marketplace_vendor_id)!.add(groupId);
  }

  // Build a per-vendor lookup for display data + source group (the first
  // picked group surfaces as the "also doing your X" label). When a vendor
  // appears in multiple source groups, prefer the LOCKED one (more
  // commitment signal) over considering; tied locks pick the first by
  // iteration order. That keeps the badge copy concrete ("also doing
  // your catering" — the host knows it's a locked pick, not just a
  // shortlist hopeful).
  const vendorMeta = new Map<
    string,
    {
      vendor_name: string;
      vendor_logo_url: string | null;
      source_group_id: PlanGroupId;
      source_status: VendorPickStatus;
    }
  >();
  // First pass: prefer locked picks
  for (const p of input.picks) {
    if (!p.marketplace_vendor_id) continue;
    const groupId = planGroupForCategory(p.category);
    if (!groupId) continue;
    const status = statusOfVendor(p.status);
    if (status !== 'locked') continue;
    if (vendorMeta.has(p.marketplace_vendor_id)) continue;
    vendorMeta.set(p.marketplace_vendor_id, {
      vendor_name: p.marketplace_business_name ?? p.vendor_name,
      vendor_logo_url: p.marketplace_logo_url ?? null,
      source_group_id: groupId,
      source_status: 'locked',
    });
  }
  // Second pass: fill in considering picks where no locked entry exists.
  for (const p of input.picks) {
    if (!p.marketplace_vendor_id) continue;
    const groupId = planGroupForCategory(p.category);
    if (!groupId) continue;
    if (vendorMeta.has(p.marketplace_vendor_id)) continue;
    vendorMeta.set(p.marketplace_vendor_id, {
      vendor_name: p.marketplace_business_name ?? p.vendor_name,
      vendor_logo_url: p.marketplace_logo_url ?? null,
      source_group_id: groupId,
      source_status: 'picked',
    });
  }

  // Walk the vendor_services rows. For each, check (a) is_active, (b)
  // category maps to a valid VendorCategory, (c) the target group isn't
  // the source group, (d) the target group isn't already in the vendor's
  // membership set (skip "already a pick" cases).
  const dedupeKey = new Set<string>(); // `${vendorId}:${targetGroupId}`
  for (const svc of input.vendor_services) {
    if (!svc.is_active) continue;
    const meta = vendorMeta.get(svc.vendor_profile_id);
    if (!meta) continue;
    const targetCategory = svc.category as VendorCategory;
    if (!isVendorCategory(targetCategory)) continue;
    const targetGroupId = planGroupForCategory(targetCategory);
    if (!targetGroupId) continue;
    // Don't recommend self — vendor is already a pick in this group.
    const membership = vendorGroupMembership.get(svc.vendor_profile_id);
    if (membership && membership.has(targetGroupId)) continue;
    // Don't recommend within the source group (defensive — the
    // membership check above should already cover this, but the source
    // group is always covered by the vendor's existing pick).
    if (targetGroupId === meta.source_group_id) continue;
    // De-dupe: same vendor → same target group only surfaces once.
    const dedupe = `${svc.vendor_profile_id}:${targetGroupId}`;
    if (dedupeKey.has(dedupe)) continue;
    dedupeKey.add(dedupe);

    const sourceGroup = PLAN_GROUPS.find((g) => g.id === meta.source_group_id);
    if (!sourceGroup) continue;

    out.get(targetGroupId)!.push({
      vendor_id: svc.vendor_profile_id,
      vendor_name: meta.vendor_name,
      vendor_logo_url: meta.vendor_logo_url,
      target_category: targetCategory,
      source_group_label: sourceGroup.label.toLowerCase(),
      source_group_id: meta.source_group_id,
      source_status: meta.source_status,
      service_id: svc.vendor_service_id,
    });
  }

  return out;
}

/**
 * Defensive runtime check that a raw TEXT from vendor_services.category
 * matches the canonical VendorCategory enum. Mirrors the structural
 * check from vendor-services.ts but enforces against the exact enum
 * list — vendor_services.category is free-form on the DB side but
 * downstream consumers expect a known enum value.
 */
function isVendorCategory(value: string): value is VendorCategory {
  return (VENDOR_CATEGORIES as readonly string[]).includes(value);
}

// ============================================================================
// (end cross-category recommendations)
// ============================================================================

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

/**
 * Build the marketplace deep-link URL for a plan group's [Search] button.
 *
 * When the group has a `subcategoryHint` (e.g. live_band, host_emcee,
 * mobile_bar, photo_booth), returns
 * `/explore?folder=<slug>&category=<canonical>&from=plan` — vendor-grid
 * mode filtered to that specific canonical_service in the 192-row taxonomy.
 *
 * Otherwise returns `/explore?folder=<slug>&from=plan#<slug>` — catalog
 * mode scoped to the folder, smooth-scroll-anchored to the section header.
 *
 * Consumed by planning-groups.tsx (the [Search] button) and todays-one-
 * thing.ts (the CTA URL on the hero). The next-steps.ts consumer was
 * removed 2026-05-24 alongside the Next 15 Steps surface. Keeps URL
 * construction in one place so both surfaces stay in lock-step.
 *
 * `from=plan` (owner directive 2026-05-22) — flips the marketplace into
 * focused-mode chrome: hides the "MARKETPLACE / Browse Filipino wedding
 * vendors" headline + paragraph + "Browse all 192 categories" back-link
 * + "SHOWING:" pill + city/sort/verified/match/apply filters. The host
 * is already in "find a vendor for this category" flow from event home,
 * so the filter chrome is noise on top of the silently-applied folder /
 * category. Vendor list + search input + pagination stay; filter logic
 * still narrows the query — only the UI surface is hidden. Direct
 * visits to /vendors (top-nav Browse, sitemap, etc.) never set
 * `from=plan` so they render the full chrome unchanged.
 */
export function buildPlanGroupSearchHref(
  group: PlanGroup,
  folderSlug: string,
): string {
  // 10-parent model (2026-05-31): when the group maps to a single tile,
  // land the host on exactly that tile's vendor grid (`?tile=`). Takes
  // precedence over the legacy `subcategoryHint` canonical filter.
  if (group.catalogTile) {
    // Venue tiles (Reception · Ceremony) are venue_directory / venue_setting
    // backed — they have no vendor-grid canonicals, so route them to the
    // catalog Venue section anchored to the right sub-block instead of an
    // empty `?tile=` grid.
    if (
      group.catalogTile === 'reception' ||
      group.catalogTile === 'ceremony_venue'
    ) {
      return `/explore?folder=venue&from=plan#${WEDDING_TILE_SLUG[group.catalogTile]}`;
    }
    return `/explore?tile=${WEDDING_TILE_SLUG[group.catalogTile]}&from=plan`;
  }
  if (group.subcategoryHint) {
    return `/explore?folder=${folderSlug}&category=${encodeURIComponent(group.subcategoryHint)}&from=plan`;
  }
  return `/explore?folder=${folderSlug}&from=plan#${folderSlug}`;
}

// ============================================================================
// DIY (Free) tier · dynamic plan groups from Add A Category picks (2026-05-30)
// ============================================================================
//
// Per CLAUDE.md 2026-05-30 DIY/Paid bifurcation lock · DIY couples can add
// arbitrary canonicals to their plan via the Add A Category wizard card
// (apps/web/app/dashboard/[eventId]/_components/wizard-cards/add-a-category-card.tsx).
// Each canonical pick lands in events.wizard_state.add_a_category.picks
// (TEXT[]) and spawns:
//   - A dynamic `custom_<canonical>` wizard task (per lib/wizard.ts
//     getBaseSequenceForTier line 1665+)
//   - A dynamic plan-grid cell · via the helper below.
//
// The plan-grid cell is intentionally an entry-point card:
//   - categories: [] → resolveDefaultCategoryForCard returns 'misc' so the
//     custom-vendor row store has a home.
//   - countsTowardLockable: false → doesn't pollute the locked / total
//     count math in planning-groups.tsx (same pattern live_band +
//     bridal_car + guest_shuttle use).
//   - tier: 'custom_picks' → renders in its own subsection at the end
//     of the planning grid · clear separation from the 12 baseline cards.
//
// V1.x can swap the entry-point pattern to a full bucketing card once
// the canonical → VendorCategory mapping is wired (the canonical_service
// taxonomy in TAXONOMY_MAP doesn't directly map to event_vendors
// category enum today).

/** Shape of events.wizard_state.add_a_category we read from. */
type AddACategoryEntry = {
  picks?: unknown;
};

/**
 * Returns dynamic PlanGroup cells for each canonical the host added via
 * the Add A Category wizard card. Append result AFTER the static
 * PLAN_GROUPS array · custom cells render in their own 'custom_picks'
 * tier subsection.
 *
 * Safe to call with `null` / `undefined` / malformed wizard_state · always
 * returns `[]` in that case.
 */
export function getCustomPlanGroups(
  wizardState: unknown,
): ReadonlyArray<PlanGroup> {
  if (!wizardState || typeof wizardState !== 'object') return [];
  const addCategoryEntry = (wizardState as Record<string, unknown>)
    .add_a_category as AddACategoryEntry | undefined;
  if (!addCategoryEntry || typeof addCategoryEntry !== 'object') return [];
  const rawPicks = addCategoryEntry.picks;
  if (!Array.isArray(rawPicks)) return [];
  const picks = rawPicks.filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  if (picks.length === 0) return [];

  return picks.map((canonical) => {
    const displayName = canonical
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      // Widen via `as unknown as PlanGroupId` because PlanGroupId is a
      // strict literal union · adding `\`custom_${string}\`` to the union
      // would force ~50 callsites to type-narrow every read of group.id.
      // Per [[feedback_setnayan_orphan_prevention]] the affected
      // downstream readers (resolveDefaultCategoryForCard switch · the
      // ceremony_venue / officiant inline checks in planning-groups.tsx)
      // all either default-branch safely OR check for specific literal IDs
      // we know custom cells aren't.
      id: `custom_${canonical}` as unknown as PlanGroupId,
      label: displayName,
      hint: `You added ${displayName} to your plan. Browse vendors when you're ready — locking is optional and you can mark this done from your wizard whenever it fits.`,
      tier: 'custom_picks' as PlanGroupTier,
      // Empty categories → resolveDefaultCategoryForCard defaults to
      // 'misc' so any manual-added vendor row attached here still buckets
      // back into this group. countsTowardLockable: false keeps the math
      // unaffected.
      categories: [] as ReadonlyArray<VendorCategory>,
      monthsBefore: 6,
      catalogFolder: (TAXONOMY_MAP[canonical]?.folder ?? 'planning') satisfies WeddingFolder,
      catalogTile: TAXONOMY_MAP[canonical]?.tile,
      countsTowardLockable: false,
    };
  });
}
