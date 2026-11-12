/**
 * downgrade-limits.ts — THE LIMITS SHEET, the pure half (ruling 5683, supplier downgrade · November rulings).
 *
 * When a supplier opens or picks a LOWER plan, the Plan sheet lists — limit by limit — what the shop has today that
 * the lower plan does not hold, each with a Fix that goes to the page that fixes it. The scheduled change itself is
 * already built (b826b24b5 "moving down waits for the term already paid for"); this file only says what does not fit.
 *
 * READ, NEVER TYPED — every number comes from the plan table through the ONE reader the Plan sheet already uses:
 *   · services   → `keptFits` / `defaultKeep` (`lib/service-plan-hold.ts`) — the create gate's own fit rule, the same
 *                  one "Which services stay on" applies, so the sheet and the picker cannot count two different things.
 *                  What does not fit GOES ON HOLD when the lower plan starts (owner 2026-11-06, "A DOWNGRADE PUTS EXTRA
 *                  SERVICES ON HOLD"), and the supplier picks which stay on.
 *   · bookings a day per card · team seats · branches · reach → `limitOf` (`lib/plan-sheet.ts`), i.e. `TIER_CAPS`
 *                  (branches 0/0/0/3/6 by plan — Free and Verified have none). Seats and included branches over a lower
 *                  plan are KEPT, never removed — the shop "can't add more" (owner 2026-11-04 "BRANCHES PER PLAN";
 *                  `canSeat` in lib/vendor-free-helper.ts: "a shop already over its seats after a downgrade … just
 *                  cannot grow"). Paid extra seats only count on a plan that may buy them (`canBuyExtraSeats`).
 *   · storage    → THE FLOOR: a plan whose storage holds less than the shop already stores cannot be picked until some
 *                  is removed. The plan's allowance is the CALLER's (`storageAllowanceBytes`); no plan storage
 *                  allowance exists in code yet (the storage rows in `vendor_billing_catalog` are priced and inactive,
 *                  migration 20271308555594 §2b), so today the caller passes null and the row is not drawn — a guessed
 *                  number would tell a supplier to delete their work.
 *   · the Verified badge → it does not follow the plan. It reads `hasVerifiedBadge` / `badgeDeadline`
 *                  (`lib/verified-badge.ts`) and stays to its own day — 30 March for the shops verified before the
 *                  papers check (`EARLY_SHOPS_PAPERS_DUE_ISO`, the one renewal day). The sheet says so, so a supplier
 *                  moving down is never afraid of losing it.
 *
 * 🔑 HONEST READS: a fact the server could not read is `null`, and its row says "Couldn't read" — never "fits".
 *
 * PURE — no I/O, no env, no clock of its own. 🔒 lib/downgrade-limits.test.ts
 */
import { formatCount } from './format-number';
import { capsOf, defaultKeep, keptFits, planHoldsWords, type PlanCard } from './service-plan-hold';
import { limitOf, limitWords } from './plan-sheet';
import { badgeDeadline, deadlineLabel, hasVerifiedBadge, type BadgeFacts } from './verified-badge';
import { canBuyExtraSeats, tierRank, type VendorTier } from './vendor-tier-caps';
import { planWord } from './vendor-plan-change-words';
import type { TeamSeats } from './vendor-free-helper';

/** Where each Fix lands — the page that fixes that limit (every one an existing supplier page). */
export const FIX_HREF = {
  services: '/vendor-dashboard/services',
  dailyBookings: '/vendor-dashboard/services',
  teamSeats: '/vendor-dashboard/team',
  branches: '/vendor-dashboard/profile#where',
  reach: '/vendor-dashboard/profile#where',
  /** A supplier's stored files sit with the bookings they were filed for (Piece 3b, `event_supplier_files`). */
  storage: '/vendor-dashboard/clients',
  badge: '/vendor-dashboard/profile#docs',
} as const;

export type FitKey = keyof typeof FIX_HREF;

/** One service card for the sheet: the picker's card plus its bookings a day (`vendor_services.daily_capacity`). */
export type FitCard = PlanCard & { daily: number | null };

export type DowngradeFacts = {
  founder: boolean;
  /** Every card of the shop; null = unread. */
  cards: readonly FitCard[] | null;
  /** Live branches included in the plan (`included_in_plan`, not cancelled); null = unread. Paid branches are their own. */
  includedBranches: number | null;
  /** `teamSeats(...)` of the shop's team; null = unread. */
  seats: TeamSeats | null;
  /** Paid extra seats the shop holds today. */
  extraSeats: number;
  /** `vendor_profiles.outer_radius_km`; null = not set or unread (no row — nothing to compare). */
  reachKm: number | null;
  /** Bytes the shop stores (`supplier_media.size_bytes`); null = unread. */
  storedBytes: number | null;
  /** The badge facts; null = unread. */
  badge: BadgeFacts | null;
};

export type FitState =
  /** Does not fit the lower plan — the line says what happens. */
  | 'over'
  /** Must be fixed BEFORE this plan can be picked (the storage floor). */
  | 'blocks'
  /** Good news that would otherwise be feared (the badge stays). */
  | 'keeps'
  /** Could not be read — never drawn as "fits". */
  | 'unread';

export type FitRow = {
  key: FitKey;
  title: string;
  line: string;
  state: FitState;
  fix: { label: string; href: string } | null;
};

export type DowngradeFit = {
  plan: VendorTier;
  rows: FitRow[];
  /** True while a 'blocks' row stands — the switch waits for it. */
  blocked: boolean;
  /** Nothing over, nothing blocking, nothing unread. */
  fits: boolean;
};

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** "12.4 GB" · "800 MB" — storage in the words a supplier reads. */
export function storageWords(bytes: number): string {
  if (bytes >= 1e9) return `${formatCount(Math.round(bytes / 1e8) / 10, 1)} GB`;
  return `${formatCount(Math.max(1, Math.round(bytes / 1e6)))} MB`;
}

/** THE STORAGE FLOOR: may the shop land on a plan whose storage holds `allowanceBytes`? null allowance = no limit known. */
export function storageFloor(storedBytes: number, allowanceBytes: number | null): { fits: true } | { fits: false; overBytes: number } {
  if (allowanceBytes === null || !Number.isFinite(allowanceBytes)) return { fits: true };
  const over = storedBytes - allowanceBytes;
  return over > 0 ? { fits: false, overBytes: over } : { fits: true };
}

/**
 * What does not fit `plan`, limit by limit. `plan` is expected to be LOWER than the shop's own; for a plan at or above
 * it the answer is simply everything fits (nothing is drawn).
 */
export function downgradeFit(
  facts: DowngradeFacts,
  currentRaw: VendorTier,
  plan: VendorTier,
  opts: { paywallOn: boolean; storageAllowanceBytes: number | null; now: Date },
): DowngradeFit {
  const name = planWord(plan);
  const rows: FitRow[] = [];
  if (tierRank(plan) >= tierRank(currentRaw)) return { plan, rows, blocked: false, fits: true };

  // ── Services — the create gate's fit rule; what does not fit goes on hold when the plan starts ──
  if (facts.cards === null) {
    rows.push({ key: 'services', title: 'Services', line: 'Couldn’t read your services just now', state: 'unread', fix: null });
  } else {
    const on = facts.cards.filter((c) => c.hold !== 'held');
    const caps = capsOf(plan, facts.founder);
    if (!keptFits(on, caps).ok) {
      const stay = defaultKeep(on, caps).length;
      const goes = on.length - stay;
      rows.push({
        key: 'services',
        title: 'Services',
        line: `${plural(on.length, 'service', 'services')} on · ${name} holds ${planHoldsWords(plan)}. ${plural(goes, 'goes', 'go')} on hold when ${name} starts — you pick which stay on.`,
        state: 'over',
        fix: { label: 'Pick which stay on', href: FIX_HREF.services },
      });
    }
    // ── Bookings a day per card ──
    const perDay = limitOf(plan, 'bookingsPerDate', opts.paywallOn);
    const overDaily = on.filter((c) => c.daily !== null && c.daily > perDay);
    if (Number.isFinite(perDay) && overDaily.length > 0) {
      rows.push({
        key: 'dailyBookings',
        title: 'Bookings a day per card',
        line: `${plural(overDaily.length, 'service takes', 'services take')} more than ${name}’s ${limitWords('bookingsPerDate', perDay)} a day.`,
        state: 'over',
        fix: { label: 'Set bookings a day', href: FIX_HREF.dailyBookings },
      });
    }
  }

  // ── Team seats — kept over a lower plan; the team just cannot grow ──
  if (facts.seats === null) {
    rows.push({ key: 'teamSeats', title: 'Team seats', line: 'Couldn’t read your team just now', state: 'unread', fix: null });
  } else {
    const base = limitOf(plan, 'teamSeats', opts.paywallOn);
    const cap = base + (canBuyExtraSeats(plan) ? Math.max(0, facts.extraSeats) : 0);
    if (Number.isFinite(cap) && facts.seats.counted > cap) {
      rows.push({
        key: 'teamSeats',
        title: 'Team seats',
        line: `${plural(facts.seats.counted, 'person', 'people')} with you · ${name} holds ${cap <= 0 ? 'no team seats' : plural(cap, 'seat', 'seats')}. Everyone stays; you can’t add more.`,
        state: 'over',
        fix: { label: 'Open your team', href: FIX_HREF.teamSeats },
      });
    }
  }

  // ── Branches — included ones are kept over a lower plan; none can be added ──
  if (facts.includedBranches === null) {
    rows.push({ key: 'branches', title: 'Branches', line: 'Couldn’t read your branches just now', state: 'unread', fix: null });
  } else {
    const cap = limitOf(plan, 'branches', opts.paywallOn);
    if (Number.isFinite(cap) && facts.includedBranches > cap) {
      rows.push({
        key: 'branches',
        title: 'Branches',
        line: `${plural(facts.includedBranches, 'branch', 'branches')} in your plan · ${name} includes ${cap <= 0 ? 'none' : formatCount(cap)}. You keep them; you can’t add more.`,
        state: 'over',
        fix: { label: 'Open your branches', href: FIX_HREF.branches },
      });
    }
  }

  // ── Reach — the shop's own radius against the plan's ──
  const reach = limitOf(plan, 'reach', opts.paywallOn);
  if (facts.reachKm !== null && Number.isFinite(reach) && facts.reachKm > reach) {
    rows.push({
      key: 'reach',
      title: 'Reach',
      line: `You reach ${limitWords('reach', facts.reachKm)} · ${name}: ${limitWords('reach', reach)}.`,
      state: 'over',
      fix: { label: 'Set your reach', href: FIX_HREF.reach },
    });
  }

  // ── Storage — THE FLOOR: never below what the shop already stores ──
  if (opts.storageAllowanceBytes !== null) {
    if (facts.storedBytes === null) {
      rows.push({ key: 'storage', title: 'Storage', line: 'Couldn’t read what you store just now', state: 'unread', fix: null });
    } else {
      const floor = storageFloor(facts.storedBytes, opts.storageAllowanceBytes);
      if (!floor.fits) {
        rows.push({
          key: 'storage',
          title: 'Storage',
          line: `You store ${storageWords(facts.storedBytes)} · ${name} holds ${storageWords(opts.storageAllowanceBytes)}. Remove ${storageWords(floor.overBytes)} first.`,
          state: 'blocks',
          fix: { label: 'Remove files', href: FIX_HREF.storage },
        });
      }
    }
  }

  // ── The Verified badge — it follows its own day, never the plan ──
  if (facts.badge !== null && hasVerifiedBadge(facts.badge, opts.now)) {
    const due = facts.badge.next_renewal_due_at ?? null;
    const d = badgeDeadline(facts.badge, opts.now);
    rows.push({
      key: 'badge',
      title: 'Verified badge',
      line: due && d.kind !== 'none' ? `Stays on ${name} — until ${deadlineLabel(due)}, your papers’ renewal day.` : `Stays on ${name}.`,
      state: 'keeps',
      fix: d.kind === 'reminder' ? { label: 'Send renewed papers', href: FIX_HREF.badge } : null,
    });
  }

  const blocked = rows.some((r) => r.state === 'blocks');
  const fits = rows.every((r) => r.state === 'keeps');
  return { plan, rows, blocked, fits };
}
