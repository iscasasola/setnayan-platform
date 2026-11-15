import { formatCount } from '@/lib/format-number';
import { TIER_CAPS, TIER_LABEL, type VendorTier } from '@/lib/vendor-tier-caps';

/**
 * 🧺 MORE THAN ONE SERVICE AT SIGN-UP — the rules the /open-shop step 2 list runs (owner 2026-11-06, DECISION_LOG
 * "SERVICES SIT TOGETHER, A METER NAMES THE PLAN…" and "THE PLAN METER COUNTS CATEGORIES AND SERVICES PER CATEGORY —
 * NOT GROUPS"; prototype `open_shop_redesign_2026-11-06` v8, `planFits` / `coverLine`).
 *
 * Pure — no database, no `server-only` — so the wizard draws the meter with it and the tests run it.
 *
 * 🔑 A "CATEGORY" HERE IS THE TIER-2 CATEGORY (Reception, Accommodation…): the picker tree's BRANCH, whose `tileId`
 * is the one `canonical_service_taxonomy.tile_id` points to. NOT the group (the tree's parent folder) — counting groups
 * is what the owner called "the rule is wrong" on v7 (four Reception venues read "1 category · 4 services — Free and
 * Verified cover this").
 *
 * ⚠ THIS IS A METER, NOT A GATE. Every service added here stays on until the first booking on Setnayan is done
 * ("Free until your first booking on Setnayan is done"), so the door never refuses one for the plan. The shipped
 * enforcement in `vendor-dashboard/services/actions.ts` counts a DIFFERENT unit (`parentsOfKind`, the "parents of the
 * 10", and cards per `vendor_services.category`) — reconciling the two belongs to the hold build, not this file.
 */

/**
 * The unlock line (the prototype's `UNLOCK_LABEL`, verbatim — v16, owner 6 Nov: *"their first booking free once
 * verified"*). Said once under the cards when the picks are more than Free holds, and as the lead of the plan sheet.
 */
export const FIRST_BOOKING_FREE_LABEL = 'Your first booking is free once you’re verified';

/** The plans the meter walks, smallest first. Verified holds what Free holds (`TIER_CAPS`), so Free stands for both. */
const METER_PLANS: readonly VendorTier[] = ['free', 'solo', 'pro', 'enterprise'];

/** The words a person reads for a plan (`TIER_LABEL`; Verified's own word, as `categoryLadder` says it). */
const planWord = (t: VendorTier) => (t === 'verified' ? 'Verified' : TIER_LABEL[t]);

/** One service on the list: its tier-2 category's id (count key) and name (what the split line prints). */
export type MeterService = { categoryId: string; categoryLabel: string };

/** Services per category, in the order the categories first appear on the list. */
export function servicesPerCategory(list: readonly MeterService[]): { id: string; label: string; count: number }[] {
  const out: { id: string; label: string; count: number }[] = [];
  for (const s of list) {
    const hit = out.find((c) => c.id === s.categoryId);
    if (hit) hit.count += 1;
    else out.push({ id: s.categoryId, label: s.categoryLabel, count: 1 });
  }
  return out;
}

/** Does `tier` hold this list — categories ≤ `parentCategories` AND every category's services ≤ `servicesPerLeaf`? */
export function planHolds(tier: VendorTier, list: readonly MeterService[]): boolean {
  const caps = TIER_CAPS[tier];
  const by = servicesPerCategory(list);
  return by.length <= caps.parentCategories && by.every((c) => c.count <= caps.servicesPerLeaf);
}

/** The first plan that holds the list, or null — more than the top plan holds (Custom). */
export function firstPlanThatHolds(list: readonly MeterService[]): VendorTier | null {
  return METER_PLANS.find((t) => planHolds(t, list)) ?? null;
}

/**
 * The coverage line under "Your services": "‹N› categories · ‹M› services — ‹plan› covers this — free until your first
 * booking on Setnayan is done", and the per-category split ("Reception 3 · Accommodation 1") once there is more than
 * one service. Every number is counted or read from `TIER_CAPS`; none is typed.
 */
export function coverageLine(list: readonly MeterService[]): {
  tally: string;
  verdict: string;
  split: string | null;
  /** The two numbers in `tally`, for the page to COUNT to (BUTTON_RULE rule 2, prototype v19 `num('cov-c')`). */
  categories: number;
  services: number;
} {
  const by = servicesPerCategory(list);
  const c = by.length;
  const n = list.length;
  const plan = firstPlanThatHolds(list);
  const top = METER_PLANS[METER_PLANS.length - 1]!;
  // v14.4 (owner 6 Nov: "we should allow them to keep adding another category"): no cap at sign-up, and the Custom
  // plan is retired from the app — so past Ultra the line says what happens after the first booking, never "Talk to us".
  const topCats = TIER_CAPS[top].parentCategories;
  const verdict =
    plan === 'free'
      ? 'Free and Verified cover this'
      : plan === null
        ? `more than ${planWord(top)} holds — all on until your first booking, then ${planWord(top)} keeps ${formatCount(topCats)} categories you choose`
        : `${planWord(plan)} covers this`;
  return {
    tally: `${formatCount(c)} ${c === 1 ? 'category' : 'categories'} · ${formatCount(n)} ${n === 1 ? 'service' : 'services'}`,
    verdict,
    split: c > 1 || n > 1 ? by.map((x) => `${x.label} ${formatCount(x.count)}`).join(' · ') : null,
    categories: c,
    services: n,
  };
}

/** Every service after the first carries the label while the list is more than Free and Verified hold. */
export function carriesFirstBookingLabel(list: readonly MeterService[]): boolean {
  return !planHolds('free', list);
}

/** Search-listing words per `seoLevel` — the prototype's ladder (`LADDER`, v14–v16), one per level, never a price. */
const SEARCH_WORDS: Record<(typeof TIER_CAPS)[VendorTier]['seoLevel'], string> = {
  basic: 'basic search listing',
  enhanced: 'enhanced search',
  aeo: 'AI answers can quote your offers',
  priority: 'top search priority',
};

/** Reach in words: "reach 20 km" · "nationwide" (Ultra's `Infinity`). */
const reachWords = (km: number) => (Number.isFinite(km) ? `reach ${formatCount(km)} km` : 'nationwide');

/**
 * 🪜 THE LADDER THE PLAN SHEET SHOWS — "Free · Verified → Supplier Plus adds → Pro adds → Ultra adds" (prototype v16 `LADDER`,
 * the shape of `for-suppliers/_components/vendor-tier-deltas.tsx`: each plan says what it ADDS, once). Every number
 * is read from `TIER_CAPS`; Free's reach is Verified's (Free is not searchable until verified). No peso anywhere.
 */
export function planLadder(): { name: string; caps: string }[] {
  const rung = (t: VendorTier, first: boolean) => {
    const c = TIER_CAPS[t];
    const cats = `${formatCount(c.parentCategories)} ${c.parentCategories === 1 ? 'category' : 'categories'}`;
    const per = first
      ? `${formatCount(c.servicesPerLeaf)} ${c.servicesPerLeaf === 1 ? 'service' : 'services'}`
      : `${formatCount(c.servicesPerLeaf)} per category`;
    const reach = first ? reachWords(TIER_CAPS.verified.serviceRadiusKm) : reachWords(c.serviceRadiusKm);
    return [cats, per, reach, SEARCH_WORDS[c.seoLevel]].join(' · ');
  };
  return [
    { name: 'Free · Verified', caps: rung('free', true) },
    ...(['solo', 'pro', 'enterprise'] as const).map((t) => ({ name: `${planWord(t)} adds`, caps: rung(t, false) })),
  ];
}

/**
 * The ⓘ beside the coverage line — "What each plan adds" (the prototype's `unlockTip`, v16): the ladder once, then
 * what happens to the services after the first booking. Composed from `TIER_CAPS` via `planLadder`.
 */
export function whatEachPlanHolds(): {
  title: string;
  lead: string;
  ladder: { name: string; caps: string }[];
  listing: string;
  after: string;
  firstBooking: string;
  fine: string;
} {
  return {
    title: 'What each plan adds',
    lead: 'Each plan says what it adds. Once.',
    ladder: planLadder(),
    listing:
      'Each service is its own listing in its category — more services means you appear in more couples’ searches. Reach is how far from you couples search.',
    after:
      'Everything you add stays on until your first booking on Setnayan is done. Then keep one free, or pick a plan to keep them all. Nothing is deleted.',
    firstBooking: `${FIRST_BOOKING_FREE_LABEL}.`,
    fine: 'No booking fee on it. One per business — checked when Setnayan verifies you.',
  };
}

/**
 * ② v19 — "BEFORE YOU CONTINUE" IN TWO COLUMNS (owner 7 Nov: *"a better explanation and simpler to show what is deemed
 * free, and the others will be part of pro. Your first booking is free so you can experience our app."*; prototype v19
 * `planSheetBody` · `holderPlan` · `capLine`). THEIR picks, split: what stays Free (`TIER_CAPS.free` — the main service)
 * and the plan that holds the rest — the first of Supplier Plus · Pro · Ultra that holds EVERY pick (usually Pro); past Ultra,
 * Ultra with "you choose which". Every number is `TIER_CAPS`'; the four-plan ladder lives in the ⓘ.
 */
export function planSplit(list: readonly MeterService[]): {
  free: { name: string; caps: string };
  held: { name: string; caps: string; choose: boolean };
} {
  const capsOf = (t: VendorTier) => {
    const c = TIER_CAPS[t];
    const cats = `${formatCount(c.parentCategories)} ${c.parentCategories === 1 ? 'category' : 'categories'}`;
    const per =
      c.parentCategories === 1
        ? `${formatCount(c.servicesPerLeaf)} ${c.servicesPerLeaf === 1 ? 'service' : 'services'}`
        : `${formatCount(c.servicesPerLeaf)} per category`;
    return `${cats} · ${per}`;
  };
  const paid = (['solo', 'pro', 'enterprise'] as const).find((t) => planHolds(t, list)) ?? null;
  const holder = paid ?? 'enterprise';
  return {
    free: { name: planWord('free'), caps: capsOf('free') },
    held: { name: planWord(holder), caps: capsOf(holder), choose: paid === null },
  };
}

/**
 * The plan explainer is due — the picks hold more than Free does (prototype v16 `overFree`). Continue then opens the
 * "Before you continue" sheet until its box is ticked.
 */
export function holdsMoreThanFree(list: readonly MeterService[]): boolean {
  return list.length > 0 && !planHolds('free', list);
}

/* ── EVENTS YOU SERVE · WHAT YOU OFFER AT EACH EVENT (prototype v16 `zXEv`) ──────────────────────────────────────── */

/**
 * Is `service` offered for `event` at all? Its leaf's `allowedEventTypes` — null or EMPTY = no restriction, the ONE
 * rule `lib/coverage-allowed-events.ts` and the server's `parseEventTypes` both run.
 */
export function offeredAt(allowed: readonly string[] | null | undefined, event: string): boolean {
  return !allowed || allowed.length === 0 || allowed.includes(event);
}

/**
 * The events one service is ON for: every ticked event where it is offered and the supplier did not untick it
 * (`off[event]` = the services unticked under that event). Order = the ticked order.
 */
export function eventsForService(
  service: string,
  allowed: readonly string[] | null | undefined,
  ticked: readonly string[],
  off: Readonly<Record<string, readonly string[]>>,
): string[] {
  return ticked.filter((k) => offeredAt(allowed, k) && !(off[k] ?? []).includes(service));
}

/* ── THE POSTED FIELD ──────────────────────────────────────────────────────────────────────────────────────────── */

/** The hidden field the wizard posts: `[{ service, events }]`, `events: null` = the same events as the main. */
export const EXTRA_SERVICES_FIELD = 'extra_services';

export type PostedExtra = { service: string; events: string[] | null };

/**
 * Read the posted list. Shape only — the SERVER re-resolves every key against the picker's tree and filters every
 * event against the roster; this never trusts a value. Malformed → empty (a hand-rolled POST adds nothing).
 */
export function parseExtraServicesField(raw: unknown): PostedExtra[] {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 20_000) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: PostedExtra[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const service = (item as { service?: unknown }).service;
    const events = (item as { events?: unknown }).events;
    if (typeof service !== 'string' || !service.trim()) continue;
    out.push({
      service: service.trim().slice(0, 64),
      events: Array.isArray(events) ? events.filter((e): e is string => typeof e === 'string').map((e) => e.trim()) : null,
    });
  }
  return out;
}

/**
 * One added service's events, as the coverage editor reads them (`parseEventTypes` in services/coverage-actions.ts):
 * the roster ∩ the service's own allowed set. `null` when the supplier ticked NOTHING the roster knows — the door
 * refuses that ("Pick at least one event for each added service."). If the allowed set removes everything ticked,
 * the service's first allowed event stands in, as the coverage editor does.
 */
export function eventsForAddedService(
  ticked: readonly string[],
  roster: ReadonlySet<string>,
  allowed: readonly string[] | null,
): string[] | null {
  const known = Array.from(new Set(ticked)).filter((k) => roster.has(k));
  if (known.length === 0) return null;
  const allowSet = allowed && allowed.length ? new Set(allowed) : null;
  const fit = known.filter((k) => !allowSet || allowSet.has(k));
  if (fit.length) return fit;
  return allowed && allowed[0] ? [allowed[0]] : known;
}

/**
 * The main service's OWN events (v16, per event): the ticked events it is on for. Posted beside `extra_services` so
 * the server writes the same per-service set the screen showed. Shape only — the server filters against the roster,
 * the ticked set and the leaf's allowed set. Absent / malformed → null (the server then reads the ticked events).
 */
export const MAIN_SERVICE_EVENTS_FIELD = 'primary_service_events';

export function parseEventListField(raw: unknown): string[] | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 4_000) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data.filter((e): e is string => typeof e === 'string').map((e) => e.trim().slice(0, 64));
  } catch {
    return null;
  }
}

/**
 * 🏷 THE SPECIALTIES PICKED AT SIGN-UP (v14.2 → v16 "specialties compile"): `{ service: { field: [values] } }`, the
 * chip-shaped refinements of each service's own schema (`canonical_service_schemas`, read by
 * `fetchCategoryChipRefinementsMany`). Shape only; the server writes them through THE ONE refinement merge
 * (`mergeServiceRefinements`), which re-validates every key and value against the live schema. Optional — nothing
 * here ever blocks Continue.
 */
export const SPECIALTIES_FIELD = 'service_specialties';

export type PostedSpecialties = Record<string, Record<string, string[]>>;

export function parseSpecialtiesField(raw: unknown): PostedSpecialties {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 20_000) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: PostedSpecialties = {};
  for (const [svc, fields] of Object.entries(data as Record<string, unknown>).slice(0, 64)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    const kept: Record<string, string[]> = {};
    for (const [key, vals] of Object.entries(fields as Record<string, unknown>).slice(0, 32)) {
      if (!Array.isArray(vals)) continue;
      const v = vals.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 128)).slice(0, 64);
      if (v.length) kept[key.slice(0, 64)] = v;
    }
    if (Object.keys(kept).length) out[svc.slice(0, 64)] = kept;
  }
  return out;
}
