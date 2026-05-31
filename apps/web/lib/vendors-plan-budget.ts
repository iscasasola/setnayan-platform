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
  bucketVendorsByGroup,
  type PlanGroup,
  type PlanGroupId,
  type PlanCardPick,
  type EventVendorRowInput,
} from '@/lib/wedding-plan-groups';
import {
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SLUG,
  type WeddingFolder,
} from '@/lib/taxonomy';

// ── Category timeline · START window + LOCK-BY floor ─────────────────────
// Two numbers per plan group, both in days-before-the-wedding, from the
// 2026-06-01 taxonomy-timeline deep-dive (CLAUDE.md row + that study; grounded
// in the locked Today's Focus per-card hard-floor table + the Concierge Brain
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
  linked_to_name?: string | null;
  /**
   * Haversine distance (km) from the couple's reception venue. Renders
   * "Xkm from reception" in the card's distance slot; absent → the card
   * falls back to the city line. Populated from the vendor_market_stats
   * hq coords vs the events venue coords (page fetch).
   */
  distance_km?: number | null;
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
};

/** One plan-group rail inside a folder (e.g. "Attire" inside Look). */
export type AccordionChild = {
  groupId: PlanGroupId;
  label: string;
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
  recap: RecapStats;
};

const PESO = 100; // centavos per peso

/** Roll a pick's full cost (Package + Transport + Crew Meal) in centavos. */
function pickCostCentavos(pick: AccordionPick): number {
  // total_cost_php is stored in PESOS on event_vendors (the couple types
  // whole pesos). Convert to centavos for a single internal unit.
  const pkg = pick.rolled_cost_php ?? 0;
  return Math.round(pkg * PESO);
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
  } = args;

  // Bucket raw rows into the 26 plan groups (reuses the canonical bucketer
  // so compatibility chips + status all stay consistent with event-home).
  const bucketed = bucketVendorsByGroup(vendorRows, ceremonyType, venueSetting);

  const hardSingleIds = new Set(
    PLAN_GROUPS.filter((g) =>
      (
        [
          'ceremony_venue',
          'reception_venue',
          'officiant',
          'coordinator',
          'host_mc',
          'led_background',
        ] as PlanGroupId[]
      ).includes(g.id),
    ).map((g) => g.id),
  );

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
      // Card-enrichment from the marketplace join. Each field is set ONLY
      // when the map actually carries it — absent → the card renders bare
      // for that field, never a fabricated rating / badge / distance.
      ...(ext?.rating != null ? { rating: ext.rating } : {}),
      ...(ext?.review_count != null ? { review_count: ext.review_count } : {}),
      ...(ext?.is_verified ? { is_verified: true } : {}),
      ...(ext?.is_setnayan_service ? { is_setnayan_service: true } : {}),
      ...(ext?.distance_km != null ? { distance_km: ext.distance_km } : {}),
    };
  };

  // Group PLAN_GROUPS by their catalogFolder → one AccordionFolder each.
  const childrenByFolder = new Map<WeddingFolder, AccordionChild[]>();
  for (const folder of WEDDING_FOLDER_ORDER) childrenByFolder.set(folder, []);

  // Preserve tier order within a folder so cards read foundation→paper.
  const tierRank = new Map<string, number>(
    PLAN_GROUP_TIER_ORDER.map((t, i) => [t, i]),
  );
  const orderedGroups = [...PLAN_GROUPS].sort((a, b) => {
    const ra = tierRank.get(a.tier) ?? 99;
    const rb = tierRank.get(b.tier) ?? 99;
    return ra - rb;
  });

  for (const group of orderedGroups) {
    const rawPicks = bucketed.get(group.id) ?? [];
    const picks = rawPicks.map(enrich);
    // Skip groups that are entry-point-only (countsTowardLockable false) AND
    // have no picks — they'd render as noise. Keep them if the couple has
    // picks (rare, but possible via direct category match).
    const isEntryPoint = group.countsTowardLockable === false;
    if (isEntryPoint && picks.length === 0) continue;

    const hardSingle = hardSingleIds.has(group.id);
    const state = childStateOf(picks, hardSingle);
    const lockedTotal = picks
      .filter((p) => p.raw_status && LOCKED_STATUSES.has(p.raw_status))
      .reduce((s, p) => s + pickCostCentavos(p), 0);

    const child: AccordionChild = {
      groupId: group.id,
      label: group.label,
      hint: group.hint,
      picks,
      state,
      daysLeft: deadlineFor(group.id, daysUntilWedding),
      timelineStatus: timelineStatusOf(group.id, daysUntilWedding, state),
      lockedTotal,
      hardSingle,
    };
    childrenByFolder.get(group.catalogFolder)?.push(child);
  }

  // Venue folder reads Reception → Ceremony → Accommodation (owner 2026-06-01):
  // the couple locks the reception first (it anchors the day), then the
  // ceremony venue (the officiant rides its package — usually not its own
  // card), then guest accommodation. Any other venue-folder entry sorts after.
  // Children otherwise order by tier; this is a targeted per-folder override.
  const VENUE_CHILD_ORDER: Partial<Record<PlanGroupId, number>> = {
    reception_venue: 0,
    ceremony_venue: 1,
    accommodation: 2,
  };
  const venueChildren = childrenByFolder.get('venue');
  if (venueChildren) {
    venueChildren.sort(
      (a, b) =>
        (VENUE_CHILD_ORDER[a.groupId] ?? 99) -
        (VENUE_CHILD_ORDER[b.groupId] ?? 99),
    );
  }

  const folders: AccordionFolder[] = WEDDING_FOLDER_ORDER.map((folder) => {
    const children = childrenByFolder.get(folder) ?? [];
    const lockedTotal = children.reduce((s, c) => s + c.lockedTotal, 0);
    const pickCount = children.reduce((s, c) => s + c.picks.length, 0);
    return {
      folder,
      label: WEDDING_FOLDER_LABEL[folder],
      slug: WEDDING_FOLDER_SLUG[folder],
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
      const costs = child.picks
        .map(pickCostCentavos)
        .filter((c) => c > 0);
      if (costs.length === 0) continue;
      const lockedCosts = child.picks
        .filter((p) => p.raw_status && LOCKED_STATUSES.has(p.raw_status))
        .map(pickCostCentavos);
      if (lockedCosts.length > 0 && child.hardSingle) {
        // Hard-single + locked → fixed point.
        const fixed = lockedCosts.reduce((s, c) => s + c, 0);
        rangeLo += fixed;
        rangeHi += fixed;
      } else if (child.hardSingle) {
        // Hard-single, undecided → cheapest..priciest of the options.
        rangeLo += Math.min(...costs);
        rangeHi += Math.max(...costs);
      } else {
        // Multi-pick → all shortlisted picks contribute (couple may keep many).
        const sum = costs.reduce((s, c) => s + c, 0);
        rangeLo += sum;
        rangeHi += sum;
      }
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
  const dueList = actionable.slice(0, 3);
  const upNext = actionable.length === 0 && due.length > 0 ? (due[0] ?? null) : null;

  // ── Recap ──────────────────────────────────────────────────────────────
  // shortlisted = Σ vendor cards. searched/hours are a transparent, tunable
  // estimate (spec §6: replace with a real benchmark before public launch).
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
  const searched = shortlisted * 6 + 12;
  const hoursSaved = Math.round(searched * 0.25 + shortlisted * 1.5);

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
    recap: { shortlisted, searched, finalized, touched, hoursSaved },
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
