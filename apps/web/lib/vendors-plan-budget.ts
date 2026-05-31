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

// ── Finalize deadlines ──────────────────────────────────────────────────
// Days-before-the-wedding each plan group should be locked. Grounded in the
// locked Today's Focus per-card hard-floor table (CLAUDE.md 2026-05-24
// "Today's Focus SKU lock" + "Home is the guide"): venue / caterer / photo
// book earliest; day-of bits latest. Keyed by PlanGroupId so the accordion's
// "What to lock next" list + per-child deadline chips read one source.
const LEAD_DAYS: Partial<Record<PlanGroupId, number>> = {
  reception_venue: 270,
  ceremony_venue: 270,
  coordinator: 200,
  catering: 240,
  photography: 240,
  cake: 75,
  attire: 130,
  hair_makeup: 95,
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

// Locked statuses = a pick the couple has committed to (drives "Chosen").
const LOCKED_STATUSES = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export type ChildState = 'empty' | 'considering' | 'finalized';

/** One pick row inside the accordion, enriched with budget + competition. */
export type AccordionPick = PlanCardPick & {
  /** Rolled cost used by Chosen / Range: Package + Transport + Crew Meal. */
  rolled_cost_php: number | null;
  /** Same-date competition count (aggregate, never identities). 0 = none. */
  eyeing: number;
};

/** One plan-group rail inside a folder (e.g. "Attire" inside Look). */
export type AccordionChild = {
  groupId: PlanGroupId;
  label: string;
  hint: string;
  picks: AccordionPick[];
  state: ChildState;
  /** Days until this group should be locked. <0 overdue · 0-20 soon · >20 upcoming. */
  daysLeft: number | null;
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

/** Build the deadline list helper. */
function deadlineFor(groupId: PlanGroupId, daysUntilWedding: number | null): number | null {
  if (daysUntilWedding === null) return null;
  const lead = LEAD_DAYS[groupId] ?? DEFAULT_LEAD_DAYS;
  return daysUntilWedding - lead;
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
    return {
      ...pick,
      rolled_cost_php: rolled,
      eyeing: eyeingByVendorId?.get(pick.vendor_id) ?? 0,
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
      lockedTotal,
      hardSingle,
    };
    childrenByFolder.get(group.catalogFolder)?.push(child);
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
  // soonest. Top 3 surface in the overview; a "Next up" fallback covers the
  // calm case (nothing overdue/soon).
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
        optionCount: child.picks.length,
        maxEyeing: child.picks.reduce((m, p) => Math.max(m, p.eyeing), 0),
      });
    }
  }
  due.sort((a, b) => a.daysLeft - b.daysLeft);
  const urgent = due.filter((d) => d.daysLeft <= 20);
  const dueList = urgent.slice(0, 3);
  const upNext = urgent.length === 0 && due.length > 0 ? (due[0] ?? null) : null;

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
