import { FIRST_BOOKING_ON_US } from '@/lib/booking-fee-lock';
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

/** The label every service after the first carries (the prototype's `UNLOCK_LABEL`, verbatim). */
export const FIRST_BOOKING_FREE_LABEL = 'Free until your first booking on Setnayan is done';

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
export function coverageLine(list: readonly MeterService[]): { counts: string; verdict: string; split: string | null } {
  const by = servicesPerCategory(list);
  const c = by.length;
  const n = list.length;
  const plan = firstPlanThatHolds(list);
  const top = METER_PLANS[METER_PLANS.length - 1]!;
  const verdict =
    plan === 'free'
      ? 'Free and Verified cover this'
      : plan === null
        ? `more than ${planWord(top)} holds — Custom plan (Talk to us)`
        : `${planWord(plan)} covers this — ${FIRST_BOOKING_FREE_LABEL.charAt(0).toLowerCase()}${FIRST_BOOKING_FREE_LABEL.slice(1)}`;
  return {
    counts: `${c} ${c === 1 ? 'category' : 'categories'} · ${n} ${n === 1 ? 'service' : 'services'}`,
    verdict,
    split: c > 1 || n > 1 ? by.map((x) => `${x.label} ${x.count}`).join(' · ') : null,
  };
}

/** Every service after the first carries the label while the list is more than Free and Verified hold. */
export function carriesFirstBookingLabel(list: readonly MeterService[]): boolean {
  return !planHolds('free', list);
}

/**
 * The ⓘ beside the line — "What each plan holds", composed from `TIER_CAPS` (the prototype's `unlockTip`).
 * Free and Verified: 1 service · Solo: 2 categories, 3 services each · Pro: 8 categories, 10 each · Ultra: …
 */
export function whatEachPlanHolds(): { title: string; plans: string; after: string; firstBooking: string; fine: string } {
  const parts: string[] = [];
  let first = true;
  for (const t of METER_PLANS) {
    const { parentCategories: c, servicesPerLeaf: v } = TIER_CAPS[t];
    const who = t === 'free' ? 'Free and Verified' : planWord(t);
    if (c === 1 && v === 1) {
      parts.push(`${who}: 1 service`);
      continue;
    }
    parts.push(`${who}: ${c} ${c === 1 ? 'category' : 'categories'}, ${v} ${first ? (v === 1 ? 'service each' : 'services each') : 'each'}`);
    first = false;
  }
  return {
    title: 'What each plan holds',
    plans: `${parts.join(' · ')}.`,
    after:
      'Everything you add stays on until your first booking on Setnayan. Then keep one free, or upgrade to keep them all. Nothing is deleted.',
    firstBooking: FIRST_BOOKING_ON_US,
    fine: 'No booking fee on it. One per business.',
  };
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
