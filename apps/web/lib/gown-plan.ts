/**
 * 👗 gown-plan — who may use the Attire Maker, and how much of it (owner 2026-11-28, DECISION_LOG "Attire Maker plans").
 *
 * Owner (amounts left out on purpose; they live only in the catalog rows): purchasable by suppliers with a service
 * card for gown designing; no five-use trial, a 30-day free trial; a monthly "use and save" plan; and a monthly plan
 * "with templates and print and quotation".
 *
 *   · Only a supplier whose shop has a service card in custom gown design (taxonomy `bridal_gown_custom`, the
 *     Attire Maker's own `GOWN_KINDS`). Never sold to a client or a host.
 *   · A 30-day free trial from the first time the shop opens it: no cap, no card, once per shop.
 *   · "Use and save" — the maker with her clients, measurements, designs and every record kept.
 *   · "Full" — everything in Use and save plus the pattern work (blocks, allowances, cutting list, design lines), the
 *     full-size pages and plotter sheet, and the gown estimate, costing and quote pre-fill.
 *   · When the trial or plan ends the maker PAUSES: her saved work stays and can be read; nothing new is made.
 * Prices come only from the catalog rows (`GOWN_PLAN_SKUS`); none is typed here. The server asks this ONE function
 * (`gownPlanAllows`) before every `gown_tool` op; the screens read the same answer.
 * 🔒 lib/gown-plan.test.ts
 */

/** The trial's length (owner: "just 30 days free trial"). Time, not money. */
export const GOWN_TRIAL_DAYS = 30;
/** One paid month extends the plan by this many days, from today or from where it ends, whichever is later. */
export const GOWN_PLAN_DAYS = 30;

export type GownPlanTier = 'use' | 'full';
/** The two catalog rows (vendor_billing_catalog). Their prices are the admin's; the code only names them. */
export const GOWN_PLAN_SKUS: Record<GownPlanTier, string> = { use: 'vendor_tool_attire_use', full: 'vendor_tool_attire_full' };
export function gownPlanTierOfSku(sku: string | null | undefined): GownPlanTier | null {
  return sku === GOWN_PLAN_SKUS.use ? 'use' : sku === GOWN_PLAN_SKUS.full ? 'full' : null;
}

/** What the server reads about the shop. `null` on a fact = it could not be read. */
export type GownPlanFacts = {
  /** The shop has a live service card in custom gown design. */
  eligible: boolean | null;
  /** When the shop first opened the Attire Maker (the trial's start), or null = never. */
  trialStartedAt: string | null;
  /** The paid plan: its tier and the moment it ends (null = never paid). */
  plan: { tier: GownPlanTier; until: string } | null;
};

export type GownPlanState =
  | { s: 'unread' }
  | { s: 'not_eligible' }
  /** Never opened: the trial starts on the first open. */
  | { s: 'fresh' }
  | { s: 'trial'; endsAt: string; daysLeft: number }
  | { s: 'paid'; tier: GownPlanTier; until: string; daysLeft: number }
  /** The trial or the plan ended. Her work is kept; nothing new is made. `was` says which. */
  | { s: 'paused'; was: 'trial' | GownPlanTier };

const DAY = 86_400_000;
const daysLeft = (endMs: number, nowMs: number) => Math.max(0, Math.ceil((endMs - nowMs) / DAY));

export function gownPlanState(f: GownPlanFacts, nowMs: number): GownPlanState {
  if (f.eligible === null) return { s: 'unread' };
  if (!f.eligible) return { s: 'not_eligible' };
  const planEnd = f.plan ? Date.parse(f.plan.until) : Number.NaN;
  if (f.plan && planEnd > nowMs) return { s: 'paid', tier: f.plan.tier, until: f.plan.until, daysLeft: daysLeft(planEnd, nowMs) };
  if (!f.trialStartedAt) return f.plan ? { s: 'paused', was: f.plan.tier } : { s: 'fresh' };
  const trialEnd = Date.parse(f.trialStartedAt) + GOWN_TRIAL_DAYS * DAY;
  if (!Number.isFinite(trialEnd)) return { s: 'unread' };
  if (trialEnd > nowMs) return { s: 'trial', endsAt: new Date(trialEnd).toISOString(), daysLeft: daysLeft(trialEnd, nowMs) };
  return { s: 'paused', was: f.plan ? f.plan.tier : 'trial' };
}

/**
 * The `gown_tool` ops in three kinds:
 *   · read   — her saved work: open her designs, read her clients' numbers (kept even when paused).
 *   · make   — anything that makes or changes something (Use and save and up, and the trial).
 *   · full   — the pattern work, the pages, the costing and the quote pre-fill (Full, and the trial).
 */
export type GownPlanUse = 'read' | 'make' | 'full';

/** May the shop do this, in this state? The ONE answer, asked by the server before every op. */
export function gownPlanAllows(state: GownPlanState, use: GownPlanUse): boolean {
  switch (state.s) {
    case 'trial':
      return true;
    case 'paid':
      return use !== 'full' || state.tier === 'full';
    case 'fresh':
      // The first open starts the trial; until then only the open itself (a `make`, which stamps the start) runs.
      return use !== 'full';
    case 'paused':
      return use === 'read';
    default:
      return false;
  }
}

/** What a refused op says, by state. Plain, and it names the way back. */
export function gownPlanRefusal(state: GownPlanState, use: GownPlanUse): string {
  if (state.s === 'unread') return 'Couldn’t check your Attire Maker plan just now. Try again.';
  if (state.s === 'not_eligible') return 'The Attire Maker is for shops with a custom gown design service card.';
  if (state.s === 'paused') return state.was === 'trial' ? 'Your free trial has ended. Your work is kept: pick a plan to carry on.' : 'Your Attire Maker plan has ended. Your work is kept: renew to carry on.';
  if (use === 'full') return 'Patterns, full-size printing and quotations are on the Full plan.';
  return 'Couldn’t do that on your Attire Maker plan.';
}

/** The panel's one line about where she stands. Days are counted, never a price. */
export function gownPlanLine(state: GownPlanState): string {
  switch (state.s) {
    case 'trial':
      return `Free trial · ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'} left`;
    case 'paid':
      return `${state.tier === 'full' ? 'Full' : 'Use and save'} · renews by hand in ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'}`;
    case 'fresh':
      return `Free for ${GOWN_TRIAL_DAYS} days from your first design.`;
    case 'paused':
      return 'Paused · your work is kept';
    case 'not_eligible':
      return 'For shops with a custom gown design service card.';
    default:
      return 'Couldn’t read your plan.';
  }
}

/** The plan after a paid month: its tier, and 30 days on from today or from where the current plan ends. */
export function gownPlanAfterPayment(current: GownPlanFacts['plan'], tier: GownPlanTier, nowMs: number): { tier: GownPlanTier; until: string } {
  const end = current ? Date.parse(current.until) : Number.NaN;
  const from = Number.isFinite(end) && end > nowMs ? end : nowMs;
  return { tier, until: new Date(from + GOWN_PLAN_DAYS * DAY).toISOString() };
}

/**
 * The plan after a refunded or rejected month: 30 days wound back, never below now (a refund never reads as "never
 * paid") and never later than it was (a reversal never extends). The tier stays: the shop keeps what it still has.
 */
export function gownPlanAfterRefund(current: GownPlanFacts['plan'], nowMs: number): GownPlanFacts['plan'] {
  if (!current) return null;
  const cur = Date.parse(current.until);
  if (!Number.isFinite(cur)) return current;
  return { tier: current.tier, until: new Date(Math.min(Math.max(cur - GOWN_PLAN_DAYS * DAY, nowMs), cur)).toISOString() };
}

/** The two plans as the panel names them (owner 2026-11-28). Prices are the catalog's, worded by lib/php.ts. */
export const GOWN_PLAN_WORDS: Record<GownPlanTier, { name: string; line: string }> = {
  use: { name: 'Use and save', line: 'Your clients, their measurements and designs, all kept.' },
  full: { name: 'Full', line: 'Plus pattern templates, full-size printing and the gown quotation.' },
};
