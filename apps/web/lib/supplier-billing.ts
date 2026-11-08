import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { rewardSourceWords, rewardWords, FALLBACK_REWARD_NAMES, type BadgeRewardKind, type RewardNames } from '@/lib/badge-rewards';
import type { Purchase } from '@/lib/billing';

/**
 * 🧾 BILLING & RECEIPTS — THE SUPPLIER'S OWN LISTS (Build 2 #39, prototype v118; owner 8 Nov: *"Add them to purchases
 * and receipts"*). The shipped page (`/dashboard/billing`, `lib/billing.ts`) keeps its Purchases list for everyone; a
 * login standing in a shop also sees, for THAT shop (the active shop, `lib/active-shop.ts`):
 *
 *   · GIFTS GIVEN — every gift line on the shop's quotes (`vendor_proposal_shop_gifts`): the client, the gift, what it
 *     is worth at the couple's price, and where it stands — held (the quote is live, nothing given yet) · given (a
 *     `shop_gift_stock_entries` 'given' row for that quote's event) · refunded (the quote ended and nothing was given —
 *     the stock is free again). A badge-reward line says so. Tap → that client on Quotation.
 *   · PAYMENTS RECEIVED — every payment a client logged to the shop (`event_vendor_payments`): confirmed · proof to
 *     check · not received. Tap → that client on Payment (where "Their receipt" and the answer live).
 *   · REFUNDS — the shop's own Setnayan orders that were refunded (plan, booking fee, gift pack — they are all `orders`
 *     rows, read once by the shipped Purchases read). Tap → the slip it reverses.
 *   · REWARDS EARNED — `shop_badge_rewards` (RULE 0: the badge rewards already have their table; nothing new). The badge,
 *     what it gave, and where it stands. Tap → the shop's badges.
 *
 * 🔑 READS ARE HONEST. Each list carries its own `measured`: a refused read draws "didn't load", never the empty line.
 * Pure — the reads are `lib/supplier-billing.server.ts`.
 */

export type GiftState = 'held' | 'given' | 'refunded';

export type GiftGivenRow = {
  lineId: string;
  eventId: string | null;
  /** The client — the event's own name; null when it could not be read ("A client", never a wrong name). */
  client: string | null;
  eventDate: string | null;
  gift: string;
  /** What the gift is worth at the couple's price, frozen on the quote when it was sent. */
  amountPhp: number;
  state: GiftState;
  fromBadgeReward: boolean;
  createdAt: string;
};

export type PaymentState = 'confirmed' | 'proof_to_check' | 'not_received';

export type PaymentReceivedRow = {
  paymentId: string;
  eventId: string;
  client: string | null;
  eventDate: string | null;
  amountPhp: number;
  /** 'YYYY-MM-DD' — a Postgres DATE, formatted from its string (never through `new Date`). */
  paidOn: string | null;
  method: string | null;
  isDeposit: boolean;
  state: PaymentState;
};

export type RewardEarnedRow = {
  rewardId: string;
  /** "SETNAYAN Verified" · "50 events · Silver" — `rewardSourceWords`. */
  badge: string;
  /** "Papic 150" · "Free booking fee · your next customer" — `rewardWords`. */
  reward: string;
  kind: BadgeRewardKind;
  grantedAt: string;
  /** "in your gift stock" · "used <date>" · "not used yet" · "taken back" — never a guess about which quote spent it. */
  where: string;
  open: boolean;
};

/** One supplier list as read: `measured: false` = the read was refused and `rows` means nothing. */
export type Measured<T> = { measured: boolean; rows: T[] };

export type SupplierBillingRead = {
  gifts: Measured<GiftGivenRow>;
  payments: Measured<PaymentReceivedRow>;
  rewards: Measured<RewardEarnedRow>;
};

export { BILLING_SECTIONS, BILLING_SECTION_LABEL, billingShowOf, type BillingSection, type BillingShow } from '@/lib/billing-sections';
import type { BillingSection } from '@/lib/billing-sections';

/* ── shaping ─────────────────────────────────────────────────────────────────────────────────────────────────── */

const LIVE_QUOTE = new Set(['sent', 'viewed', 'accepted']);

/**
 * Where a quote's gift stands. `given` = this shop's stock moved into that event for that kind of gift (a `given`
 * entry); else `held` while the quote is live; else `refunded` (the quote ended and nothing left the stock).
 */
export function giftStateOf(args: { proposalStatus: string | null; givenToEvent: boolean }): GiftState {
  if (args.givenToEvent) return 'given';
  return args.proposalStatus && LIVE_QUOTE.has(args.proposalStatus) ? 'held' : 'refunded';
}

export function paymentStateOf(p: { vendor_confirmed_at: string | null; payment_refused_at: string | null }): PaymentState {
  if (p.payment_refused_at) return 'not_received';
  return p.vendor_confirmed_at ? 'confirmed' : 'proof_to_check';
}

export const PAYMENT_STATE_WORD: Readonly<Record<PaymentState, string>> = {
  confirmed: 'confirmed',
  proof_to_check: 'proof to check',
  not_received: 'not received',
};

/** The reward row's "where it stands", from what the row itself records. */
export function rewardRowOf(
  r: {
    reward_id: string;
    reward_key: string;
    reward_kind: BadgeRewardKind;
    units: number;
    granted_at: string;
    revoked_at: string | null;
    used_at: string | null;
    returned_at: string | null;
  },
  names: RewardNames = FALLBACK_REWARD_NAMES,
): RewardEarnedRow {
  let where: string;
  let open = false;
  if (r.revoked_at) where = 'taken back by Setnayan';
  else if (r.reward_kind !== 'fee_waiver') where = 'in your gift stock';
  else if (r.used_at && !r.returned_at) where = `used ${manilaDay(r.used_at)}`;
  else {
    where = r.returned_at ? 'given back · not used yet' : 'not used yet';
    open = true;
  }
  return {
    rewardId: r.reward_id,
    badge: rewardSourceWords(r.reward_key),
    reward: rewardWords({ kind: r.reward_kind, units: r.units }, names),
    kind: r.reward_kind,
    grantedAt: r.granted_at,
    where,
    open,
  };
}

/** Refunds = the login's own shop orders whose money went back. From the shipped Purchases read, never re-read. */
export function refundsOf(purchases: readonly Purchase[]): Purchase[] {
  return purchases.filter((p) => p.status === 'refunded' && p.isSupplierBilling);
}

/* ── doors ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** A gift opens that client on Quotation; without an event there is no client to open. */
export function giftHref(g: Pick<GiftGivenRow, 'eventId'>): string | null {
  return g.eventId ? customerCardHref(g.eventId, 'quote') : null;
}

/** A payment opens that client on Payment — "Their receipt" and Confirm / Not received live there. */
export function paymentHref(p: Pick<PaymentReceivedRow, 'eventId'>): string {
  return customerCardHref(p.eventId, 'payments');
}

/** A reward opens the shop's badges. */
export const REWARDS_HREF = '/vendor-dashboard/shop#badges';

/* ── words ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** "Nov 8" in Manila from a timestamp; a bare 'YYYY-MM-DD' is read as that day (never shifted through UTC). */
export function manilaDay(iso: string | null): string {
  if (!iso) return '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00+08:00`) : new Date(iso);
  return Number.isNaN(day.getTime()) ? '' : day.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

const PESO = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

/** The one short line under each heading (v118 `BLDEF` sub). Never a figure from an unread list. */
export function sectionSummary(section: Exclude<BillingSection, 'purchases'>, read: SupplierBillingRead, refunds: readonly Purchase[]): string {
  if (section === 'refunds') {
    return refunds.length === 0
      ? 'Nothing has gone back'
      : `${refunds.length} refund${refunds.length > 1 ? 's' : ''} · ${PESO(refunds.reduce((n, r) => n + r.grossPhp, 0))} back to you`;
  }
  if (section === 'gifts') {
    if (!read.gifts.measured) return 'Couldn’t load';
    const kept = read.gifts.rows.filter((g) => g.state !== 'refunded');
    const held = read.gifts.rows.filter((g) => g.state === 'held').length;
    return `${kept.length} gift${kept.length === 1 ? '' : 's'} · ${PESO(kept.reduce((n, g) => n + g.amountPhp, 0))}${held ? ` · ${held} held` : ''}`;
  }
  if (section === 'payments') {
    if (!read.payments.measured) return 'Couldn’t load';
    const conf = read.payments.rows.filter((p) => p.state === 'confirmed').reduce((n, p) => n + p.amountPhp, 0);
    const check = read.payments.rows.filter((p) => p.state === 'proof_to_check').reduce((n, p) => n + p.amountPhp, 0);
    return `${PESO(conf)} confirmed${check ? ` · ${PESO(check)} proof to check` : ''}`;
  }
  if (!read.rewards.measured) return 'Couldn’t load';
  const open = read.rewards.rows.filter((r) => r.open).length;
  const n = read.rewards.rows.length;
  return `${n} reward${n === 1 ? '' : 's'}${open ? ` · ${open} not used yet` : ''}`;
}
