/**
 * service-plan-hold.ts — WHICH SERVICES STAY ON. The pure half: no database, no `server-only`.
 *
 * ⚖ OWNER RULINGS (specs-repo DECISION_LOG, 2026-11-06):
 *   · 🧭 SERVICES LIFE CYCLE — many services at sign-up, all on through the first booking; then Free and Verified
 *     hold one, and the supplier upgrades or keeps one. The rest go ON HOLD (hidden, take no bookings, never deleted)
 *     and come back once the shop is verified AND upgraded. Same rules for every shop.
 *   · 📉 A DOWNGRADE PUTS EXTRA SERVICES ON HOLD — at the downgrade the supplier picks which stay on; when the lower
 *     plan starts the rest go on hold; upgrading again turns them back on.
 *   · 🧮 … A PLAN PICKER WITH SWAP — a ladder of plans, each showing what stays on and what goes on hold; tapping a
 *     service swaps it, refused when over the plan; then "Pick ‹plan› with these". Numbers from `TIER_CAPS`.
 *
 * 🔑 ONE FIT RULE, THE CREATE GATE'S. A card's create gate (`commitVendorService`, services/actions.ts) refuses a card
 * when (1) its kind already holds `servicesPerLeaf` cards, or (2) it would add a FAMILY beyond `parentCategories`,
 * families read by `parentsOfKind` (lib/vendor-category-parents.ts). `keptFits` below is that same rule applied to a
 * set: cards per `kind` (= `vendor_services.category`) ≤ servicesPerLeaf, distinct families ≤ parentCategories. The
 * server read (`service-plan-hold.server.ts`) computes each card's families WITH `parentsOfKind`, so the picker and
 * the create gate can never count two different things (the 6 Nov "do not let the meter and the gate disagree").
 * ⚠ Still open from the 6 Nov METER row: the owner's unit is the tier-2 Category; the shipped gate counts tier-1
 * families. This file follows the shipped gate on purpose and changes the moment the gate does.
 *
 * The database (migration 20271320474333) holds the state and acts on it when the plan changes; this file only
 * decides what fits.
 */

import { TIER_CAPS, TIER_LABEL, tierRank, type VendorTier } from '@/lib/vendor-tier-caps';

/** The plans the picker offers, bottom to top (the ruling's ladder; Custom is not marketed). */
export const PLAN_LADDER: readonly VendorTier[] = ['free', 'verified', 'solo', 'pro', 'enterprise'];

export type PlanHoldState = 'held' | 'scheduled' | null;

/** One service card as the picker sees it. */
export type PlanCard = {
  id: string;
  /** What the supplier calls it (title, else the kind's label). */
  name: string;
  /** `vendor_services.category` — the create gate's per-kind unit. */
  kind: string;
  /** Families this kind files under (`parentsOfKind`); [] = exempt, never counted. */
  families: string[];
  /** `is_active` today. */
  live: boolean;
  hold: PlanHoldState;
  /** For a scheduled card: the plan whose start puts it on hold. */
  holdStartsOn: VendorTier | null;
};

export type FitCaps = { parentCategories: number; servicesPerLeaf: number };

export type FitAnswer =
  | { ok: true }
  | { ok: false; why: 'kind_full'; kind: string; cap: number }
  | { ok: false; why: 'families_full'; cap: number };

export function capsOf(tier: VendorTier, founder = false): FitCaps {
  if (founder) return { parentCategories: Infinity, servicesPerLeaf: Infinity };
  const c = TIER_CAPS[tier];
  return { parentCategories: c.parentCategories, servicesPerLeaf: c.servicesPerLeaf };
}

/** Do these cards, all on together, fit the plan? The create gate's two refusals, on a set. */
export function keptFits(kept: readonly PlanCard[], caps: FitCaps): FitAnswer {
  const perKind = new Map<string, number>();
  for (const c of kept) perKind.set(c.kind, (perKind.get(c.kind) ?? 0) + 1);
  for (const [kind, n] of perKind) if (n > caps.servicesPerLeaf) return { ok: false, why: 'kind_full', kind, cap: caps.servicesPerLeaf };
  const families = new Set(kept.flatMap((c) => c.families));
  if (families.size > caps.parentCategories) return { ok: false, why: 'families_full', cap: caps.parentCategories };
  return { ok: true };
}

/** The lowest plan on the ladder that holds every card — "the plan that holds them all". Null when none does. */
export function planThatHoldsAll(cards: readonly PlanCard[], founder = false): VendorTier | null {
  for (const t of PLAN_LADDER) if (keptFits(cards, capsOf(t, founder)).ok) return t;
  return null;
}

/**
 * The plans offered, from the lowest the shop can land on: its scheduled lower plan when one is waiting, else its
 * own plan. Free and Verified hold the same (one service), so a Free shop is offered Free, not both.
 */
export function ladderFor(current: VendorTier, pending: VendorTier | null): VendorTier[] {
  const base = pending && tierRank(pending) < tierRank(current) ? pending : current;
  return PLAN_LADDER.filter((t) => tierRank(t) >= tierRank(base) && !(base === 'free' && t === 'verified'));
}

export type PickMode = 'now' | 'upgrade' | 'at_plan_change';

/** When a pick for `plan` takes effect — the same three answers `apply_service_plan_pick` gives from the shop row. */
export function pickModeFor(plan: VendorTier, current: VendorTier, pending: VendorTier | null): PickMode | null {
  if (plan === current) return 'now';
  if (tierRank(plan) > tierRank(current)) return 'upgrade';
  if (pending && plan === pending) return 'at_plan_change';
  return null;
}

/**
 * The picker's starting choice for a plan: what the supplier already chose first, then what is on today, then the
 * rest in their order — each kept only while it still fits. Never empty when a card exists: one always fits a plan
 * that holds one service (an exempt kind or one family).
 */
export function defaultKeep(cards: readonly PlanCard[], caps: FitCaps, preferred: readonly string[] = []): string[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const order: PlanCard[] = [];
  const seen = new Set<string>();
  const push = (c: PlanCard | undefined) => {
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      order.push(c);
    }
  };
  preferred.forEach((id) => push(byId.get(id)));
  cards.filter((c) => c.hold !== 'held' && c.hold !== 'scheduled' && c.live).forEach(push);
  cards.forEach(push);
  const kept: PlanCard[] = [];
  for (const c of order) if (keptFits([...kept, c], caps).ok) kept.push(c);
  return kept.map((c) => c.id);
}

export type ToggleAnswer = { keep: string[]; refused: string | null };

/**
 * One tap on a service row. On → off always. Off → on when it fits; when it does not and the plan holds a single
 * card, it SWAPS with the one on (the ruling's "tapping a service swaps it"); otherwise it is refused with why.
 */
export function toggleKeep(keep: readonly string[], id: string, cards: readonly PlanCard[], caps: FitCaps, plan: VendorTier): ToggleAnswer {
  if (keep.includes(id)) return { keep: keep.filter((k) => k !== id), refused: null };
  const byId = new Map(cards.map((c) => [c.id, c]));
  const card = byId.get(id);
  if (!card) return { keep: [...keep], refused: null };
  const now = keep.map((k) => byId.get(k)).filter((c): c is PlanCard => Boolean(c));
  const fit = keptFits([...now, card], caps);
  if (fit.ok) return { keep: [...keep, id], refused: null };
  if (now.length === 1 && keptFits([card], caps).ok) return { keep: [id], refused: null };
  return { keep: [...keep], refused: overPlanWords(fit, plan) };
}

/** Why a tap was refused, in the supplier's words. */
export function overPlanWords(fit: Exclude<FitAnswer, { ok: true }>, plan: VendorTier): string {
  const name = TIER_LABEL[plan];
  if (fit.why === 'kind_full') return `${name} holds ${fit.cap} of this kind. Turn one off first.`;
  return `${name} holds ${fit.cap} ${fit.cap === 1 ? 'category' : 'categories'}. Turn one off first.`;
}

/** The meter line: "2 categories · 4 services — Supplier Plus holds this". */
export function meterWords(kept: readonly PlanCard[], plan: VendorTier): string {
  const families = new Set(kept.flatMap((c) => c.families)).size;
  const n = kept.length;
  return `${families} ${families === 1 ? 'category' : 'categories'} · ${n} ${n === 1 ? 'service' : 'services'} — ${TIER_LABEL[plan]} holds this`;
}

/** What a plan holds, read from `TIER_CAPS`: "1 category × 1 service". */
export function planHoldsWords(plan: VendorTier): string {
  const c = TIER_CAPS[plan];
  const f = Number.isFinite(c.parentCategories) ? `${c.parentCategories} ${c.parentCategories === 1 ? 'category' : 'categories'}` : 'Every category';
  const s = Number.isFinite(c.servicesPerLeaf) ? `${c.servicesPerLeaf} ${c.servicesPerLeaf === 1 ? 'service' : 'services'} each` : 'any number each';
  return `${f} × ${s}`;
}

/** Are the cards that are on today more than the plan holds? */
export function overThePlan(cards: readonly PlanCard[], caps: FitCaps): boolean {
  return !keptFits(cards.filter((c) => c.hold !== 'held'), caps).ok;
}

/**
 * WHEN "Which services stay on" shows, and what it may do — one decision, read by My Shop's services list
 * (`StayOnSection`) and Today's line (`StayOnTodayLine`), so the two can never disagree about whether the shop must choose.
 *
 *   · a card is already on hold, or picked to go on hold                       → show (to swap or undo)
 *   · Free / Verified, more on than the plan holds, FIRST BOOKING DONE          → show (the life-cycle ruling)
 *   · a lower plan is scheduled and what is on does not fit it                  → show (the downgrade ruling)
 *   · Free / Verified, more on than the plan holds, first booking not yet       → a line only: everything stays on
 *   · a read that failed                                                        → nothing, never a claim
 */
export type StayOnNeed =
  | { show: false; line: string | null }
  | { show: true; reason: 'holding' | 'first_booking' | 'downgrade'; startPlan: VendorTier };

export type StayOnFacts =
  | { status: 'ok'; shop: { tier: VendorTier; pending: VendorTier | null; founder: boolean }; cards: readonly PlanCard[]; firstBooking: 'done' | 'not_yet' | 'unreadable' }
  | { status: 'unreadable' };

export function stayOnNeed(read: StayOnFacts): StayOnNeed {
  if (read.status !== 'ok') return { show: false, line: null };
  const { shop, cards, firstBooking } = read;
  if (cards.length === 0) return { show: false, line: null };
  const freeTier = tierRank(shop.tier) <= tierRank('verified');
  const pendingLower = shop.pending && tierRank(shop.pending) < tierRank(shop.tier) ? shop.pending : null;
  if (cards.some((c) => c.hold !== null)) return { show: true, reason: 'holding', startPlan: pendingLower ?? shop.tier };
  if (pendingLower && overThePlan(cards, capsOf(pendingLower, shop.founder))) {
    return { show: true, reason: 'downgrade', startPlan: pendingLower };
  }
  if (overThePlan(cards, capsOf(shop.tier, shop.founder))) {
    if (!freeTier) return { show: true, reason: 'holding', startPlan: shop.tier };
    if (firstBooking === 'done') return { show: true, reason: 'first_booking', startPlan: shop.tier };
    if (firstBooking === 'not_yet') return { show: false, line: HOLD_WORDS.beforeFirstBooking };
  }
  return { show: false, line: null };
}

// ── THE SENTENCES (one place) ──────────────────────────────────────────────

export const HOLD_WORDS = {
  tag: 'On hold',
  /** Under a held card on the supplier's own list. */
  rowLine: 'On hold — couples can’t see or book it.',
  /** Under a card that goes on hold when a picked plan starts. */
  scheduledLine: (plan: VendorTier) => `Goes on hold when ${TIER_LABEL[plan]} starts.`,
  /** The ⓘ behind the tag. */
  tip: 'Your plan holds fewer services than you have. A service on hold is hidden from couples and takes no bookings. Nothing is deleted, and it comes back on when you are verified and on a plan that holds it.',
  door: 'Which services stay on',
  /** Today, once the first booking is done and the shop has more than Free / Verified hold. */
  todayFirstBooking: 'Your first booking is done. Free and Verified hold one service — pick which stays on, or upgrade to keep them all.',
  /** Today, when a lower plan is scheduled and what is on does not fit it. */
  todayDowngrade: (plan: VendorTier, when: string | null) =>
    `${TIER_LABEL[plan]} starts${when ? ` on ${when}` : ' when your plan ends'} and holds fewer services. Pick which stay on.`,
  /** The screen, before the first booking. */
  beforeFirstBooking: 'Every service stays on until your first booking on Setnayan is done.',
  /** The supplier's refused yes — names the service when it is known. */
  refusedYes: (service?: string | null) =>
    `Upgrade to accept this booking — ${service?.trim() ? service.trim() : 'the service they asked for'} is on hold on your plan. The couple sees it as waiting on you.`,
  /** The forward pill that takes the place of Agree while the asked-for service is on hold. */
  pickPill: 'Pick which stay on',
} as const;
