/**
 * Plan + Budget accordion — data model + pure builders.
 *
 * Hydrates the couple-side Vendors-tab accordion (the "Plan + Budget
 * accordion" design-locked in Vendors_Plan_Budget_Tab_Spec_2026-05-31.md)
 * from the couple's real event_vendors picks + their events row. Pure,
 * server-safe functions — no Supabase calls in here; the page fetches and
 * hands the rows in (per the spec §11 in-memory-store contract).
 *
 * 2026-05-31 — built on the 10-folder taxonomy shrink. The accordion groups
 * by WeddingFolder (10 parents); each folder stacks the PLAN_GROUPS whose
 * catalogFolder points at it (so e.g. the Look folder shows Attire + Hair &
 * Makeup + Rings cards together).
 *
 * BUDGET (spec §2A) — a booked vendor's true cost is 3 lines: Package +
 * Transportation + Crew Meal (iteration 0007). The couple enters those on
 * the vendor detail. For V1 the accordion rolls up `total_cost_php` (the
 * package price the couple recorded); `transport_php` + `crew_meal_php` are
 * threaded through the model as optional add-ons so the 3-line rollup drops
 * in without reshaping anything. Chosen / Range / meter all read the rolled
 * total via `pickCost()`.
 *
 * COMPETITION (spec §6a) — the "👀 N also eyeing this date" count. Real =
 * COUNT of other couples' soft-holds on (vendor, wedding_date) pre-downpayment,
 * aggregate-only, never identities (RA 10173), never fabricated. That needs a
 * cross-event query the page supplies via `eyeingByVendorId`; this lib just
 * carries the number. When the map is empty, no eyeing chip renders — we never
 * invent scarcity.
 */

import {
  PLAN_GROUPS,
  PLAN_GROUP_TIER_ORDER,
  HARD_SINGLE_PICK_GROUPS,
  bucketVendorsByGroup,
  type PlanGroup,
  type PlanGroupId,
  type PlanCardPick,
  type EventVendorRowInput,
} from '@/lib/wedding-plan-groups';
import type { ChatInquiryStatus } from '@/lib/chat';
import {
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
  type WeddingTile,
} from '@/lib/taxonomy';
import type { TaxonomySnapshot } from '@/lib/taxonomy-db';
import {
  resolveDependency,
  type DependencyState,
  type DependencyNodeId,
} from '@/lib/dependency-graph';

// ── Category timeline · START window + LOCK-BY floor ─────────────────────
// Two numbers per plan group, both in days-before-the-wedding, from the
// 2026-06-01 taxonomy-timeline deep-dive (CLAUDE.md row + that study; grounded
// in the locked Setnayan AI per-card hard-floor table + the Concierge Brain
// 04_Planning_Timelines.md windows + PH wedding reality):
//
//   START_DAYS — when the app STARTS recommending the couple begin shopping
//                this category (begin shortlisting). Surfaces a "Start now"
//                nudge in "What to lock next" + the per-child chip.
//   LEAD_DAYS  — the LOCK-BY hard floor. Past it with nothing locked = the
//                couple is warned "overdue" (first-choice options are gone /
//                lead-time can't be met).
//
// The gap between them is the research→decide→inquire window. Keyed by
// PlanGroupId so the accordion's "What to lock next" + per-child chips read
// one source. All render-time (no cron) — computed against daysUntilWedding.

// LOCK-BY hard floors (days before the wedding). venue / caterer / photo book
// earliest; day-of bits latest. 2026-06-01 reconcile: hair_makeup 95→165 +
// attire 130→165 — the deep-dive flags both as too late at the old values (a
// lead MUA + custom couture book out for peak Saturdays well before 3-4mo).
const LEAD_DAYS: Partial<Record<PlanGroupId, number>> = {
  reception_venue: 270,
  ceremony_venue: 270,
  coordinator: 200,
  catering: 240,
  photography: 240,
  cake: 75,
  attire: 165,
  hair_makeup: 165,
  florals_decor: 175,
  stylist: 175,
  live_band: 185,
  music_entertainment: 170,
  dance_instructor: 110,
  after_party_music: 45,
  host_mc: 110,
  lights_sound: 120,
  led_background: 60,
  cocktail_booths: 90,
  photobooth: 90,
  bridal_car: 50,
  guest_shuttle: 45,
  rings: 120,
  accommodation: 30,
  invitations_stationery: 90,
  officiant: 200,
  logistics: 60,
};
const DEFAULT_LEAD_DAYS = 90;

// START windows (days before the wedding) — when the app begins recommending
// the category. Every entry sits earlier than its LEAD_DAYS floor; the gap is
// the shop-around runway. For a 12-month engagement, the anchors (venue / photo
// / caterer) open at ~12mo, the day-of extras at ~3-4mo. Peak season (Ber +
// Apr/May) effectively pulls everything earlier — couples who set a peak date
// are already inside the start window the moment they create the event.
const START_DAYS: Partial<Record<PlanGroupId, number>> = {
  reception_venue: 360,
  ceremony_venue: 360,
  coordinator: 300,
  officiant: 270,
  catering: 330,
  photography: 360,
  attire: 240,
  hair_makeup: 285,
  florals_decor: 210,
  stylist: 270,
  live_band: 300,
  music_entertainment: 240,
  dance_instructor: 120,
  after_party_music: 60,
  host_mc: 180,
  lights_sound: 150,
  led_background: 120,
  cocktail_booths: 120,
  photobooth: 120,
  cake: 180,
  bridal_car: 120,
  guest_shuttle: 90,
  rings: 180,
  accommodation: 60,
  invitations_stationery: 150,
  logistics: 120,
};
const DEFAULT_START_DAYS = 150;

// Locked statuses = a pick the couple has committed to (drives "Chosen").
const LOCKED_STATUSES = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export type ChildState = 'empty' | 'considering' | 'finalized';

/**
 * Where a category sits on the planning clock, derived from the wedding date
 * vs START_DAYS + LEAD_DAYS. Drives the per-child chip + the "What to lock
 * next" nudge.
 *   upcoming  — too early; the app stays quiet (no chip).
 *   start_now — the START window is open: "Start now / Time to start".
 *   due_soon  — within 20 days of the lock-by floor: "Nd left".
 *   overdue   — past the floor with nothing locked: WARN "Nd overdue".
 *   locked    — the couple has finalized a pick here.
 */
export type TimelineStatus =
  | 'upcoming'
  | 'start_now'
  | 'due_soon'
  | 'overdue'
  | 'locked';

/** One pick row inside the accordion, enriched with budget + competition. */
export type AccordionPick = PlanCardPick & {
  /** Rolled cost used by Chosen / Range: Package + Transport + Crew Meal. */
  rolled_cost_php: number | null;
  /** Same-date competition count (aggregate, never identities). 0 = none. */
  eyeing: number;
  /**
   * Is THIS vendor the category's "build pick" — the one the couple slotted
   * into their working build (event_build_picks · Shortlist "Add to build")?
   * One pick per category, so at most one pick in a rail is true. Reversible,
   * distinct from locked. Drives the card's "Add to build" ↔ "In your build".
   */
  isBuildPick: boolean;
  /**
   * Optional card-enrichment — populated only once the page fetch joins
   * vendor_profiles for picked marketplace vendors (spec §13, post-pilot).
   * The 300px card renders each of these ONLY when present, never
   * fabricated — so on the current build they stay undefined and the
   * stars / verified+Setnayan badges / linked-vendor rows simply don't
   * appear until the join lands.
   */
  rating?: number | null;
  review_count?: number | null;
  is_verified?: boolean;
  is_setnayan_service?: boolean;
  recommended_reason?: string | null;
  /** Back-compat single-name linked label (joined "X · Y" for CompareSheet). */
  linked_to_name?: string | null;
  /**
   * Linked-services-on-card (locked spec): categories the picked service
   * auto-covers — card shows "comes with X · Y · Z". Populated from
   * vendor_service_links for the picked event_vendors.service_id (marketplace)
   * or host-authored covers_plan_groups (manual vendors, PR #1274). Absent →
   * no linked row renders. `groupId` (2026-06-12) = the covered plan group,
   * when resolvable — feeds category-satisfaction; label-only entries still
   * render as chips but can't mark a category covered.
   */
  linked_services?: { label: string; groupId?: string | null }[];
  /**
   * Haversine distance (km) from the couple's reception venue. Renders
   * "Xkm from reception" in the card's distance slot; absent → the card
   * falls back to the city line. Populated from the vendor_market_stats
   * hq coords vs the events venue coords (page fetch).
   */
  distance_km?: number | null;
  /**
   * Accept-gate state (CLAUDE.md 2026-06-02 · #1c). The chat thread for this
   * marketplace vendor: 'pending' = the couple's auto-inquiry is waiting for
   * the vendor to accept; 'accepted' = chat open; 'declined' = vendor not
   * available. Absent when the pick has no thread yet (off-platform / custom
   * picks, or a marketplace pick whose inquiry hasn't been created). Drives a
   * status badge on the accordion card.
   */
  inquiry_status?: ChatInquiryStatus | null;
};

/**
 * Per-vendor card enrichment from the marketplace join (vendor_market_stats
 * + vendor_profiles), keyed by event_vendors.vendor_id. Every field is
 * optional + rendered only when present — the card never fabricates a
 * rating / badge / distance it wasn't handed.
 */
export type VendorEnrichment = {
  rating?: number | null;
  review_count?: number | null;
  is_verified?: boolean;
  is_setnayan_service?: boolean;
  distance_km?: number | null;
  /** Accept-gate state for this vendor's chat thread (#1c). */
  inquiry_status?: ChatInquiryStatus | null;
  /** Linked-services-on-card labels for this vendor's picked service.
   *  groupId (2026-06-12) = covered plan group when resolvable — feeds
   *  category-satisfaction. */
  linked_services?: { label: string; groupId?: string | null }[];
};

/** One plan-group rail inside a folder (e.g. "Attire" inside Look). */
export type AccordionChild = {
  groupId: PlanGroupId;
  label: string;
  /** The primary VendorCategory enum for this group (group.categories[0]), or
   *  null for entry-point groups with no backing category. Lets the empty-state
   *  "Add manually" affordance scope the manual-vendor modal to the right
   *  category. Kept a plain string to avoid enum import churn downstream. */
  primaryCategory: string | null;
  hint: string;
  picks: AccordionPick[];
  state: ChildState;
  /** Days until this group should be locked (LEAD_DAYS floor). <0 overdue. */
  daysLeft: number | null;
  /** Where this category sits on the planning clock (drives chip + nudge). */
  timelineStatus: TimelineStatus;
  /** Σ of locked picks in this child. */
  lockedTotal: number;
  /** Whether the group is hard-single (one pick max). */
  hardSingle: boolean;
  /** The vendor_id pinned to the build for this category (event_build_picks),
   *  or null. Lets a card tell when ANOTHER vendor is already the build pick
   *  (→ the Replace/Add-both popup). */
  buildPickVendorId: string | null;
  /** ALL build picks for this category (multi-pick Look/Booths/Prints can have
   *  several; single-pick groups have ≤1). `buildPickVendorId` is the first. */
  buildPickVendorIds: string[];
  /** Setnayan Assist on? (event `planning_mode` !== 'manual'). When false the
   *  vendor cards drop the "% match" pill — Manual mode browses neutrally. */
  personalizationEnabled: boolean;
  /**
   * Dependency-awareness nudge (Setnayan AI §4B). `blocked` = a prerequisite
   * (e.g. the reception venue, the mood board) should be finalized first;
   * `ready` = prerequisites met, go; null = no nudge (no edges / done / AI off /
   * too early). Always SOFT — advisory copy, never a gate. Surfaced only when
   * the category is in its action window + Setnayan AI is on.
   */
  dependency: DependencyState;
  /**
   * Category-satisfaction (2026-06-12): set when this EMPTY category is
   * already covered by a COMMITTED pick elsewhere (in the build, or locked)
   * whose package "comes with" it — marketplace `vendor_service_links` or
   * host-authored covers (manual vendors, PR #1274), both arriving through
   * the enrichment's linked_services groupIds. Informational, never a gate:
   * Find/Add stay available; Build's Flag/Compute exclude covered categories.
   */
  coveredBy: { vendorName: string; fromGroupLabel: string } | null;
};

/** One folder section (the sticky accordion header + its child rails). */
export type AccordionFolder = {
  folder: WeddingFolder;
  label: string;
  slug: string;
  children: AccordionChild[];
  /** Σ of every locked pick under this folder (shown on the sticky header). */
  lockedTotal: number;
  /** Total shortlisted picks (drives the "N considering" subline). */
  pickCount: number;
};

/** A "what to lock next" row for the landing overview. */
export type DueItem = {
  groupId: PlanGroupId;
  label: string;
  daysLeft: number;
  state: ChildState;
  timelineStatus: TimelineStatus;
  optionCount: number;
  maxEyeing: number;
};

export type RecapStats = {
  shortlisted: number;
  searched: number;
  finalized: number;
  touched: number;
  hoursSaved: number;
};

export type PlanBudgetModel = {
  folders: AccordionFolder[];
  /** Σ of all locked picks (the bold top-bar headline). */
  chosenCentavos: number;
  /** Cheapest→priciest span of the whole shortlist (top-bar muted figure). */
  rangeLoCentavos: number;
  rangeHiCentavos: number;
  /** events.estimated_budget_centavos — null if the couple hasn't set one. */
  targetCentavos: number | null;
  /** Range-high vs target → the meter + status word track THIS. */
  budgetStatus: 'no_target' | 'within' | 'near' | 'over';
  /** 0..1 meter fill (rangeHi / target, capped at 1). */
  meterFill: number;
  dueList: DueItem[];
  upNext: DueItem | null;
  /** Setnayan Assist on? (planning_mode !== 'manual'). Gates the NextAction
   *  "Do this next" hero; the per-child flag mirrors it for the % match pills. */
  personalizationEnabled: boolean;
  recap: RecapStats;
  /**
   * How many addable categories the couple has NOT added yet (active-
   * categories model, owner 2026-06-02). The Vendors page shows only
   * categories with ≥1 vendor; this drives the "Unlock N more categories"
   * affordance under the recap → the Unlock-more page.
   */
  inactiveCategoryCount: number;
};

const PESO = 100; // centavos per peso

/** Roll a pick's full cost (Package + Transport + Crew Meal) in centavos. */
function pickCostCentavos(pick: AccordionPick): number {
  // total_cost_php is stored in PESOS on event_vendors (the couple types
  // whole pesos). Convert to centavos for a single internal unit.
  const pkg = pick.rolled_cost_php ?? 0;
  return Math.round(pkg * PESO);
}

/**
 * Range (cheapest→priciest) contribution for ONE plan-group child, in centavos.
 *
 * The couple makes ONE decision per distinct service — but a single plan group
 * legitimately holds SEVERAL distinct services they keep TOGETHER (Documentary
 * = photographer + videographer; Look = gown + suit; Design = florist + stylist;
 * Catering = main caterer + dessert bar — see lib/wedding-plan-groups.ts lines
 * 735-748). So we sub-bucket by canonical service (`pick.category`): WITHIN a
 * service the couple picks ONE (its cheapest→priciest option span, or the
 * locked price once decided), and we SUM ACROSS the distinct services.
 *
 * This is correct for BOTH shapes the old code got wrong:
 *   • "3 competing photographers → pick one" → one `photographer` bucket →
 *     min..max  (the old code summed all 3, over-counting by ~2×).
 *   • "photographer + videographer → keep both" → two buckets → summed
 *     (unchanged — still correct).
 * The hard-single groups (one canonical service each) fall out naturally:
 * a single bucket → min..max, or fixed once locked. No special-casing needed.
 *
 * Picks with no recorded price (cost ≤ 0) drop out of the span — same as the
 * prior `costs.filter(c => c > 0)` guard.
 */
function rangeForChild(picks: ReadonlyArray<AccordionPick>): {
  lo: number;
  hi: number;
} {
  const byService = new Map<string, AccordionPick[]>();
  for (const p of picks) {
    if (pickCostCentavos(p) <= 0) continue;
    const arr = byService.get(p.category);
    if (arr) arr.push(p);
    else byService.set(p.category, [p]);
  }
  let lo = 0;
  let hi = 0;
  for (const group of byService.values()) {
    const lockedCosts = group
      .filter((p) => p.raw_status && LOCKED_STATUSES.has(p.raw_status))
      .map(pickCostCentavos);
    if (lockedCosts.length > 0) {
      // Decided within this service → fixed point (sum the locked picks;
      // normally one, but a couple could lock two complementary picks).
      const fixed = lockedCosts.reduce((s, c) => s + c, 0);
      lo += fixed;
      hi += fixed;
    } else {
      const costs = group.map(pickCostCentavos);
      lo += Math.min(...costs);
      hi += Math.max(...costs);
    }
  }
  return { lo, hi };
}

/** Days until the lock-by floor (negative = overdue). */
function deadlineFor(groupId: PlanGroupId, daysUntilWedding: number | null): number | null {
  if (daysUntilWedding === null) return null;
  const lead = LEAD_DAYS[groupId] ?? DEFAULT_LEAD_DAYS;
  return daysUntilWedding - lead;
}

/**
 * Place a category on the planning clock. Past the floor with nothing locked =
 * overdue (warn); inside the START window but not yet near the floor =
 * start_now (the app's recommend-to-begin signal); before the START window =
 * upcoming (quiet). No date set yet → upcoming (nothing to warn about).
 */
function timelineStatusOf(
  groupId: PlanGroupId,
  daysUntilWedding: number | null,
  state: ChildState,
): TimelineStatus {
  if (state === 'finalized') return 'locked';
  if (daysUntilWedding === null) return 'upcoming';
  const floor = LEAD_DAYS[groupId] ?? DEFAULT_LEAD_DAYS;
  const start = START_DAYS[groupId] ?? DEFAULT_START_DAYS;
  const daysToFloor = daysUntilWedding - floor;
  if (daysToFloor < 0) return 'overdue';
  if (daysToFloor <= 20) return 'due_soon';
  if (daysUntilWedding <= start) return 'start_now';
  return 'upcoming';
}

function childStateOf(picks: AccordionPick[], hardSingle: boolean): ChildState {
  if (picks.length === 0) return 'empty';
  const hasLocked = picks.some((p) => p.raw_status && LOCKED_STATUSES.has(p.raw_status));
  if (hasLocked) return 'finalized';
  // Multi-pick groups are "finalized" only when at least one is locked; a
  // shortlist with no lock is still "considering".
  return 'considering';
}

/**
 * Build the full accordion + budget model from the couple's event_vendors
 * rows + their event context. Pure — call from the server page.
 */
export function buildPlanBudgetModel(args: {
  vendorRows: ReadonlyArray<EventVendorRowInput>;
  estimatedBudgetCentavos: number | null;
  daysUntilWedding: number | null;
  ceremonyType: string | null;
  venueSetting: string | null;
  /** vendor_id → transport fee (pesos) from iteration 0007 budget lines. */
  transportByVendorId?: ReadonlyMap<string, number>;
  /** vendor_id → crew-meal total (pesos) from iteration 0007. */
  crewMealByVendorId?: ReadonlyMap<string, number>;
  /** vendor_id → same-date soft-hold count (aggregate, real). */
  eyeingByVendorId?: ReadonlyMap<string, number>;
  /** vendor_id → card enrichment (reviews / badges / distance) from the join. */
  enrichmentByVendorId?: ReadonlyMap<string, VendorEnrichment>;
  /**
   * Real count of marketplace-published vendors (verified + coming_soon)
   * across the couple's ACTIVE categories — the recap's "Searched" stat + the
   * basis for hoursSaved (spec §6 + Time & Money Saved model, 2026-06-02). The
   * page computes it (re-bucket → active folders → canonical services →
   * distinct count); 0 when unknown → the recap never fabricates a number.
   */
  marketPoolCount?: number;
  /** Setnayan Assist toggle (event `planning_mode`). Default true (Guided).
   *  When false (Manual), every child is flagged so its vendor cards drop the
   *  "% match" pill and the couple browses in a neutral order. */
  personalizationEnabled?: boolean;
  /** Has the couple set/locked their mood board (events.mood_board_updated_at)?
   *  Feeds the dependency engine (florals/cake/LED/invites design from it). */
  moodBoardSet?: boolean;
  /**
   * DB-driven taxonomy snapshot (from `getTaxonomy()`). When present, the 10
   * folder headers' order + labels + slugs come from the `service_categories`
   * table, so an admin edit in `/admin/taxonomy` flows to ALL 5 plan-builder
   * tabs that read this model. Omitted/undefined → the TS constants are used
   * (behavior-preserving fallback). Planning metadata (tier, deadlines) stays in
   * `PLAN_GROUPS` — that's scheduling, not taxonomy.
   */
  taxonomy?: TaxonomySnapshot;
  /** plan_group_id → vendor_ids pinned to the build (event_build_picks). One per
   *  category for single-pick groups; several for multi-pick (Look/Booths/Prints).
   *  Absent / empty → no build pick. */
  buildPicksByGroup?: ReadonlyMap<string, string[]>;
}): PlanBudgetModel {
  const {
    vendorRows,
    estimatedBudgetCentavos,
    daysUntilWedding,
    ceremonyType,
    venueSetting,
    transportByVendorId,
    crewMealByVendorId,
    eyeingByVendorId,
    enrichmentByVendorId,
    marketPoolCount = 0,
    personalizationEnabled = true,
    moodBoardSet = false,
    taxonomy,
    buildPicksByGroup,
  } = args;

  // Folder headers (order · label · slug) come from the DB taxonomy when a
  // snapshot is passed, else the TS constants. Per-key `?? constant` so a
  // partial snapshot still resolves every folder. (Children keep PLAN_GROUP
  // labels — planning cards, not taxonomy nodes.)
  const folderOrder = taxonomy?.folderOrder ?? WEDDING_FOLDER_ORDER;
  const folderLabelMap = taxonomy?.folderLabel ?? WEDDING_FOLDER_LABEL;
  const folderSlugMap = taxonomy?.folderSlug ?? WEDDING_FOLDER_SLUG;

  // Bucket raw rows into the 26 plan groups (reuses the canonical bucketer
  // so compatibility chips + status all stay consistent with event-home).
  const bucketed = bucketVendorsByGroup(vendorRows, ceremonyType, venueSetting);

  // Canonical hard-single set (lib/wedding-plan-groups.ts) — one pick max
  // (ceremony/reception venue, officiant, coordinator, host/MC, LED). Drives
  // ONLY the per-child `hardSingle` display flag now; the Range math keys off
  // the canonical-service sub-bucketing in rangeForChild() instead (so
  // multi-service groups like Documentary/Look/Catering are handled correctly).

  // Enrich every pick with rolled cost + eyeing.
  const enrich = (pick: PlanCardPick): AccordionPick => {
    const transport = transportByVendorId?.get(pick.vendor_id) ?? 0;
    const crew = crewMealByVendorId?.get(pick.vendor_id) ?? 0;
    const pkg = pick.total_cost_php ?? 0;
    const rolled = pick.total_cost_php === null && transport === 0 && crew === 0
      ? null
      : pkg + transport + crew;
    const ext = enrichmentByVendorId?.get(pick.vendor_id);
    return {
      ...pick,
      rolled_cost_php: rolled,
      eyeing: eyeingByVendorId?.get(pick.vendor_id) ?? 0,
      // Overridden per-group below once we know the category's build pick.
      isBuildPick: false,
      // Card-enrichment from the marketplace join. Each field is set ONLY
      // when the map actually carries it — absent → the card renders bare
      // for that field, never a fabricated rating / badge / distance.
      ...(ext?.rating != null ? { rating: ext.rating } : {}),
      ...(ext?.review_count != null ? { review_count: ext.review_count } : {}),
      ...(ext?.is_verified ? { is_verified: true } : {}),
      ...(ext?.is_setnayan_service ? { is_setnayan_service: true } : {}),
      ...(ext?.distance_km != null ? { distance_km: ext.distance_km } : {}),
      ...(ext?.inquiry_status != null ? { inquiry_status: ext.inquiry_status } : {}),
      ...(ext?.linked_services?.length
        ? {
            linked_services: ext.linked_services,
            linked_to_name: ext.linked_services.map((l) => l.label).join(' · '),
          }
        : {}),
    };
  };

  // Group PLAN_GROUPS by their catalogFolder → one AccordionFolder each.
  const childrenByFolder = new Map<WeddingFolder, AccordionChild[]>();
  for (const folder of folderOrder) childrenByFolder.set(folder, []);

  // Preserve tier order within a folder so cards read foundation→paper.
  const tierRank = new Map<string, number>(
    PLAN_GROUP_TIER_ORDER.map((t, i) => [t, i]),
  );
  const orderedGroups = [...PLAN_GROUPS].sort((a, b) => {
    const ra = tierRank.get(a.tier) ?? 99;
    const rb = tierRank.get(b.tier) ?? 99;
    return ra - rb;
  });

  // Full-pile model (owner 2026-06-02 evening — restores the signature
  // vertical accordion). The Services tab renders cover → drag-up → ALL
  // categories pile up → summary. Picked categories show their carousel of
  // vendor cards; empty categories show a slim "Find {category}" add-row
  // (ChildRail branches on child.picks.length). Earlier today the
  // active-categories model (PR #774) skipped empty categories with
  // `continue`, which collapsed the pile to a short stub whenever few picks
  // existed — the owner asked for the full pile back, so every category is
  // included again. Nothing is "inactive" now: inactiveCategoryCount stays 0
  // so the recap's "Unlock N more categories" CTA no longer shows (the
  // Unlock-more page route remains but is simply no longer linked from here).
  const inactiveCategoryCount = 0;

  // ── Dependency-awareness satisfied-set (Setnayan AI §4B) ─────────────────
  // A node is "satisfied" when its prerequisite is finalized. Vendor categories:
  // a group with ≥1 locked pick. Decision nodes we can read cheaply here:
  // wedding_date (a date is set) + mood_board (events.mood_board_updated_at).
  // The remaining guest/seating decision nodes live on other surfaces this page
  // doesn't load, so they FAIL OPEN (added as satisfied) → the engine never
  // shows a wrong nudge for them. (Wiring real detection is a follow-up.)
  const satisfiedNodes = new Set<DependencyNodeId>();
  for (const group of orderedGroups) {
    const raw = bucketed.get(group.id) ?? [];
    if (raw.some((p) => p.raw_status && LOCKED_STATUSES.has(p.raw_status))) {
      satisfiedNodes.add(group.id as DependencyNodeId);
    }
  }
  if (daysUntilWedding !== null) satisfiedNodes.add('wedding_date');
  if (moodBoardSet) satisfiedNodes.add('mood_board');
  satisfiedNodes.add('sponsors_confirmed');
  satisfiedNodes.add('invitations_sent');
  satisfiedNodes.add('rsvp_headcount');
  satisfiedNodes.add('seating_chart');

  // Child-label propagation from the DB taxonomy (2026-06-09). The folder
  // headers already follow `/admin/taxonomy` renames (folderLabel above); we
  // extend that to each child card's label when it maps 1:1 to a tile. Count
  // how many PLAN_GROUPS share each catalogTile — only a single-use tile is
  // safe to rename from, because two groups on one tile (officiant +
  // ceremony_venue → `ceremony_venue`; accommodation + reception_venue →
  // `reception`) need their distinct hardcoded labels to stay distinguishable.
  const tileUseCount = new Map<WeddingTile, number>();
  for (const group of PLAN_GROUPS) {
    if (!group.catalogTile) continue;
    tileUseCount.set(
      group.catalogTile,
      (tileUseCount.get(group.catalogTile) ?? 0) + 1,
    );
  }
  // Resolve a child's label: a single-use tile with a live DB label wins
  // (so an admin tile rename flows through); otherwise the hardcoded
  // PLAN_GROUP label (collision tiles + entry-point groups + no snapshot).
  const resolveChildLabel = (group: PlanGroup): string => {
    if (group.catalogTile && tileUseCount.get(group.catalogTile) === 1) {
      const tileLabel = taxonomy?.tileLabel[group.catalogTile];
      if (typeof tileLabel === 'string' && tileLabel.length > 0) return tileLabel;
    }
    return group.label;
  };

  // ── DB-driven taxonomy (owner 2026-06-09: "the taxonomy is DB-driven") ──────
  // The Shortlist's folder→child structure follows the admin DB tree
  // (service_categories via getTaxonomy), not the hardcoded catalogFolder map:
  //   1. A child's FOLDER is its tile's DB parent (taxonomy.tileParent), so an
  //      admin move of a tile to another parent flows straight through.
  //   2. When several PLAN_GROUPS share one DB tile (the only cases today:
  //      officiant + ceremony_venue → `ceremony_venue`; accommodation +
  //      reception_venue → `reception`), only the FIRST (in PLAN_GROUPS order)
  //      is kept — the others are DROPPED. That retires Officiant + Accommodation
  //      from the couple Shortlist (owner 2026-06-09: they aren't DB tiles; the
  //      admin Venue parent has exactly Reception + Ceremony).
  //   3. Children sort by their tile's position in the DB parent (tilesByParent),
  //      so the order matches the admin tree.
  // Falls back to the hardcoded catalogFolder / tier order whenever the DB
  // snapshot is absent (taxonomy undefined) or a group has no catalogTile.
  const primaryGroupByTile = new Map<WeddingTile, PlanGroupId>();
  for (const group of PLAN_GROUPS) {
    if (group.catalogTile && !primaryGroupByTile.has(group.catalogTile)) {
      primaryGroupByTile.set(group.catalogTile, group.id);
    }
  }
  const isDroppedBorrower = (group: PlanGroup): boolean =>
    !!group.catalogTile &&
    (tileUseCount.get(group.catalogTile) ?? 0) > 1 &&
    primaryGroupByTile.get(group.catalogTile) !== group.id;
  const dbFolderOf = (group: PlanGroup): WeddingFolder => {
    if (group.catalogTile && taxonomy) {
      const parent = taxonomy.tileParent[group.catalogTile];
      if (parent) return parent;
    }
    return group.catalogFolder;
  };

  for (const group of orderedGroups) {
    // Drop the secondary group that borrows another group's DB tile (Officiant,
    // Accommodation) — the DB parent owns exactly one card per tile.
    if (isDroppedBorrower(group)) continue;
    const rawPicks = bucketed.get(group.id) ?? [];
    const picks = rawPicks.map(enrich);

    // The build picks for this category (event_build_picks) — only the ones whose
    // vendor is still on the shortlist (a removed vendor's pick FK-cascades away,
    // but guard anyway). Multi-pick categories (Look/Booths/Prints) can hold
    // several; single-pick categories hold at most one. Mark every matching pick
    // "In your build"; `buildPickVendorId` stays the FIRST (back-compat singular).
    const shortlistedVendorIds = new Set(picks.map((p) => p.vendor_id));
    const buildPickVendorIds = (buildPicksByGroup?.get(group.id) ?? []).filter((vid) =>
      shortlistedVendorIds.has(vid),
    );
    const buildPickSet = new Set(buildPickVendorIds);
    const buildPickVendorId = buildPickVendorIds[0] ?? null;
    if (buildPickSet.size > 0) {
      for (const p of picks) p.isBuildPick = buildPickSet.has(p.vendor_id);
    }

    const hardSingle = HARD_SINGLE_PICK_GROUPS.has(group.id);
    const state = childStateOf(picks, hardSingle);
    const timelineStatus = timelineStatusOf(group.id, daysUntilWedding, state);
    const lockedTotal = picks
      .filter((p) => p.raw_status && LOCKED_STATUSES.has(p.raw_status))
      .reduce((s, p) => s + pickCostCentavos(p), 0);

    // Surface the dependency nudge only when Setnayan AI is on AND the category
    // is in its action window (start_now / due_soon / overdue) — quiet while
    // it's too early ('upcoming') or done ('locked'), so we never blanket every
    // category at once.
    const actionable =
      timelineStatus === 'start_now' ||
      timelineStatus === 'due_soon' ||
      timelineStatus === 'overdue';
    const dependency: DependencyState =
      personalizationEnabled && actionable
        ? resolveDependency(group.id, satisfiedNodes, state === 'finalized')
        : null;

    const child: AccordionChild = {
      groupId: group.id,
      label: resolveChildLabel(group),
      primaryCategory: group.categories[0] ?? null,
      hint: group.hint,
      picks,
      state,
      daysLeft: deadlineFor(group.id, daysUntilWedding),
      timelineStatus,
      lockedTotal,
      hardSingle,
      buildPickVendorId,
      buildPickVendorIds,
      personalizationEnabled,
      dependency,
      coveredBy: null,
    };
    childrenByFolder.get(dbFolderOf(group))?.push(child);
  }

  // ── Category-satisfaction (2026-06-12) ────────────────────────────────────
  // A COMMITTED pick (in the build, or locked) whose package "comes with"
  // another category covers it — marketplace vendor_service_links and
  // host-authored covers (manual vendors) both arrive as linked_services
  // entries carrying the target groupId. Only EMPTY categories get the badge
  // (own candidates win over coverage), and it is informational, never a
  // gate: the couple can still search/add there. First committed coverer wins
  // (deterministic: folder/children order).
  {
    const coverage = new Map<string, { vendorName: string; fromGroupLabel: string }>();
    for (const children of childrenByFolder.values()) {
      for (const c of children) {
        for (const p of c.picks) {
          const committed =
            p.isBuildPick || (p.raw_status != null && LOCKED_STATUSES.has(p.raw_status));
          if (!committed) continue;
          for (const ls of p.linked_services ?? []) {
            if (!ls.groupId || coverage.has(ls.groupId)) continue;
            coverage.set(ls.groupId, {
              vendorName: p.marketplace_business_name ?? p.vendor_name ?? 'your vendor',
              fromGroupLabel: c.label,
            });
          }
        }
      }
    }
    if (coverage.size > 0) {
      for (const children of childrenByFolder.values()) {
        for (const c of children) {
          if (c.state === 'empty') c.coveredBy = coverage.get(c.groupId) ?? null;
        }
      }
    }
  }

  // Order each folder's children by their tile's position in the DB parent
  // (taxonomy.tilesByParent), so the Shortlist order matches the admin tree.
  // Entry-point / no-tile groups (and any tile missing from the snapshot) sort
  // last, preserving their incoming tier order. No-op when the snapshot is absent.
  if (taxonomy) {
    const groupById = new Map<PlanGroupId, PlanGroup>(PLAN_GROUPS.map((g) => [g.id, g]));
    for (const [folder, children] of childrenByFolder) {
      const tileSeq = taxonomy.tilesByParent[folder] ?? [];
      const tileRank = new Map<WeddingTile, number>(tileSeq.map((t, i) => [t, i]));
      children.sort((a, b) => {
        const ta = groupById.get(a.groupId)?.catalogTile;
        const tb = groupById.get(b.groupId)?.catalogTile;
        const ra = ta != null ? (tileRank.get(ta) ?? 999) : 999;
        const rb = tb != null ? (tileRank.get(tb) ?? 999) : 999;
        return ra - rb;
      });
    }
  }

  const folders: AccordionFolder[] = folderOrder.map((folder) => {
    const children = childrenByFolder.get(folder) ?? [];
    const lockedTotal = children.reduce((s, c) => s + c.lockedTotal, 0);
    const pickCount = children.reduce((s, c) => s + c.picks.length, 0);
    return {
      folder,
      label: folderLabelMap[folder] ?? WEDDING_FOLDER_LABEL[folder],
      slug: folderSlugMap[folder] ?? WEDDING_FOLDER_SLUG[folder],
      children,
      lockedTotal,
      pickCount,
    };
  });

  // ── Budget rollup ──────────────────────────────────────────────────────
  // Chosen = Σ locked picks. Range = cheapest→priciest across the shortlist:
  // a finalized/locked pick is a fixed point; an undecided single-pick group
  // contributes its cheapest..priciest option span; a multi-pick group sums
  // its kept picks.
  let chosenCentavos = 0;
  let rangeLo = 0;
  let rangeHi = 0;
  for (const folder of folders) {
    for (const child of folder.children) {
      chosenCentavos += child.lockedTotal;
      // Range = Σ over children of each child's per-service span. rangeForChild
      // sub-buckets by canonical service so competing options (pick one) give a
      // cheapest→priciest span while genuinely-distinct services (kept together)
      // sum — see rangeForChild() for the full reasoning.
      const { lo, hi } = rangeForChild(child.picks);
      rangeLo += lo;
      rangeHi += hi;
    }
  }

  // Budget status tracks Range-HIGH vs target (the "will my plan fit?" guard).
  let budgetStatus: PlanBudgetModel['budgetStatus'] = 'no_target';
  let meterFill = 0;
  if (estimatedBudgetCentavos && estimatedBudgetCentavos > 0) {
    meterFill = Math.min(1, rangeHi / estimatedBudgetCentavos);
    if (rangeHi > estimatedBudgetCentavos) budgetStatus = 'over';
    else if (rangeHi > estimatedBudgetCentavos * 0.85) budgetStatus = 'near';
    else budgetStatus = 'within';
  }

  // ── What to lock next ──────────────────────────────────────────────────
  // Every non-finalized child with a deadline, ordered overdue-first then
  // soonest floor. "Actionable" = the app actively recommends moving on it now:
  // overdue (warn) → due_soon → start_now (its START window has opened). Top 3
  // surface in the overview; a "Next up" fallback covers the calm case where
  // nothing's actionable yet (everything still 'upcoming').
  const due: DueItem[] = [];
  for (const folder of folders) {
    for (const child of folder.children) {
      if (child.state === 'finalized') continue;
      if (child.daysLeft === null) continue;
      due.push({
        groupId: child.groupId,
        label: child.label,
        daysLeft: child.daysLeft,
        state: child.state,
        timelineStatus: child.timelineStatus,
        optionCount: child.picks.length,
        maxEyeing: child.picks.reduce((m, p) => Math.max(m, p.eyeing), 0),
      });
    }
  }
  due.sort((a, b) => a.daysLeft - b.daysLeft);
  const actionable = due.filter(
    (d) =>
      d.timelineStatus === 'overdue' ||
      d.timelineStatus === 'due_soon' ||
      d.timelineStatus === 'start_now',
  );
  // Manual mode (Setnayan Assist OFF) suppresses the "what to lock next" /
  // "Do this next" deadline nudges entirely (owner 2026-06-05). The per-child
  // timeline math is untouched; only these aggregate prompts go quiet.
  const dueList = personalizationEnabled ? actionable.slice(0, 3) : [];
  const upNext = personalizationEnabled
    ? actionable.length === 0 && due.length > 0
      ? (due[0] ?? null)
      : null
    : null;

  // ── Recap ──────────────────────────────────────────────────────────────
  // Real numbers (2026-06-02 · owner "no mockups" · spec §6 resolved via the
  // Time & Money Saved model). shortlisted/finalized/touched = live from the
  // picks. searched = the page-supplied real count of marketplace-published
  // vendors across the couple's ACTIVE categories (what Setnayan combed so
  // they didn't have to). hoursSaved keys off the model's vendor-search
  // terms: filtering 3h/active-category + comparison 3h/shortlisted + market
  // search 24h per ~50-vendor "expo" (capped at 5). No fabricated figure —
  // 0 in, 0 out.
  let shortlisted = 0;
  let finalized = 0;
  let touched = 0;
  for (const folder of folders) {
    for (const child of folder.children) {
      shortlisted += child.picks.length;
      if (child.state !== 'empty') touched += 1;
      if (child.state === 'finalized') finalized += 1;
    }
  }
  const searched = marketPoolCount;
  const exposEquivalent =
    marketPoolCount > 0 ? Math.min(5, Math.ceil(marketPoolCount / 50)) : 0;
  const hoursSaved = Math.round(
    3 * touched + 3 * shortlisted + 24 * exposEquivalent,
  );

  return {
    folders,
    chosenCentavos,
    rangeLoCentavos: rangeLo,
    rangeHiCentavos: rangeHi,
    targetCentavos: estimatedBudgetCentavos,
    budgetStatus,
    meterFill,
    dueList,
    upNext,
    personalizationEnabled,
    recap: { shortlisted, searched, finalized, touched, hoursSaved },
    inactiveCategoryCount,
  };
}

/** Format centavos as a compact peso string for the top bar (₱840K). */
export function formatPesoCompact(centavos: number): string {
  const pesos = centavos / PESO;
  if (pesos >= 1_000_000) {
    const m = pesos / 1_000_000;
    return `₱${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (pesos >= 1_000) {
    return `₱${Math.round(pesos / 1_000)}K`;
  }
  return `₱${Math.round(pesos).toLocaleString('en-PH')}`;
}

/** Format centavos as a precise peso string for the overview (₱840,000). */
export function formatPesoPrecise(centavos: number): string {
  return `₱${Math.round(centavos / PESO).toLocaleString('en-PH')}`;
}
