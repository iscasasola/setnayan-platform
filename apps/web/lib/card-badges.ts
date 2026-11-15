/**
 * 🏅 THE SERVICE-CARD BADGES — the rules, ONCE (badge build J3; owner-approved prototypes 15 Nov,
 * specs `prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html` · `badge-flow-walkthrough_v5.html`).
 *
 * Each service card earns its own medals from Setnayan activity in the last 30 days — ON while true, OFF the moment it
 * is not (DECISION_LOG "card badges", rows 7d6c8129 · 4b8cc3a3 · 068c8ed4). Six medals, in THIS order (the controller's
 * order, which is v86's `AW` order with Verified appended — always last):
 *   Hot Booking · Quick Responder · Trending Now · Rave Reviews · Generous Giver · Setnayan Verified.
 * Setnayan Verified is the SHOP's (ruling 50566f42): every card of a verified shop shows it, its time runs from the
 * date the shop was verified, and the blue check by the shop name stays.
 *
 * The database gathers the raw numbers (`service_card_badge_facts`); THIS module decides. Pure — no I/O — so the
 * thresholds are tested here and nowhere else holds a second copy.
 */

export const CARD_BADGE_KEYS = ['book', 'quick', 'trend', 'rave', 'gift'] as const;
export type EarnedCardBadgeKey = (typeof CARD_BADGE_KEYS)[number];
/** `partner` is the shop's Verified Partner seal, drawn in Verified's slot IN PLACE of it (DECISION_LOG 11d044c0). */
export type CardBadgeKey = EarnedCardBadgeKey | 'verified' | 'partner';

/**
 * The display order — and the QUEUE order of the rotating label and award pop-ups (owner, DECISION_LOG 7fbff0cd): the
 * row's order, Setnayan Verified (or Verified Partner in its place) always last. Never sorted by anything else.
 */
export const CARD_BADGE_ORDER: readonly Exclude<CardBadgeKey, 'partner'>[] = ['book', 'quick', 'trend', 'rave', 'gift', 'verified'];

export type CardBadgeDef = { key: CardBadgeKey; name: string; rule: string };

/** The names and rules, word for word from v86 (`AW` · `VBo`). */
export const CARD_BADGES: Record<CardBadgeKey, CardBadgeDef> = {
  book: {
    key: 'book',
    name: 'Hot Booking',
    rule: 'At least 5 paid bookings of this one service card in the last 30 days, from 5 different couples. Bookings of the shop’s other cards do not add up; a cancelled or refunded booking stops counting.',
  },
  quick: {
    key: 'quick',
    name: 'Quick Responder',
    rule: 'Every inquiry answered within 1 hour, at least 10 inquiries in the last 30 days. The clock runs 7am to 7pm Manila time, every day: an inquiry after 7pm is timed from 7am. Only the shop’s own reply counts, not an automatic one; an inquiry the couple withdraws before the hour is skipped.',
  },
  trend: {
    key: 'trend',
    name: 'Trending Now',
    rule: 'At least 30 inquiries from different couples in the last 30 days, and at least 10 more than in the 30 days before.',
  },
  rave: {
    key: 'rave',
    name: 'Rave Reviews',
    rule: 'At least 5 five-star reviews in the last 30 days, at most 2 counted from any one event, and no review under 4 stars in that time. Only reviews from completed bookings count.',
  },
  gift: {
    key: 'gift',
    name: 'Generous Giver',
    rule: 'Every paid booking of this card in the last 30 days received a gift from the shop, with at least 5 bookings. One booking without a gift and it comes off.',
  },
  verified: {
    key: 'verified',
    name: 'Setnayan Verified',
    rule: 'Setnayan checked the owner, the business papers and the work. A real business stands behind this name. It belongs to the shop, so every one of its cards shows it.',
  },
  partner: {
    key: 'partner',
    name: 'Verified Partner',
    rule: 'A verified shop that has used every part of Setnayan and made it work. It is kept for life and takes the place of Setnayan Verified. It belongs to the shop, so every one of its cards shows it.',
  },
};

/** The words a held time is replaced with on a Verified Partner medal — it is kept for life (DECISION_LOG 11d044c0). */
export const PARTNER_HELD_WORDS = 'for life';

/** The thresholds, named — the guard reads these, the rules above say them in words. */
export const CARD_BADGE_THRESHOLDS = {
  book: { bookings: 5, couples: 5 },
  quick: { inquiries: 10, minutes: 60 },
  trend: { couples: 30, more: 10 },
  rave: { fiveStars: 5, perEvent: 2, floorStars: 4 },
  gift: { bookings: 5 },
} as const;

/** One inquiry about a card: when it was raised, the shop's first own reply after it, and whether it was withdrawn. */
export type CardInquiry = { asked_at: string; replied_at: string | null; withdrawn: boolean };

/** One card's raw 30-day numbers — the shape `service_card_badge_facts` returns per card. */
export type CardBadgeFacts = {
  id: string;
  published: boolean;
  paid_bookings: number;
  paid_couples: number;
  paid_with_gift: number;
  five_star_capped: number;
  under_four: number;
  couples_now: number;
  couples_before: number;
  inquiries: CardInquiry[];
};

export type ShopCardBadgeFacts = {
  verified_since: string | null;
  good_standing: boolean;
  cards: CardBadgeFacts[];
};

// ── The Quick Responder clock: 7am → 7pm Manila, every day (Manila is UTC+8 all year, no daylight saving). ──────────
const MANILA_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;
const OPEN_MS = 7 * 3_600_000;
const CLOSE_MS = 19 * 3_600_000;

/** Minutes of the 7am–7pm Manila clock that ran between two instants (0 when `to` ≤ `from`). */
export function clockMinutesBetween(fromMs: number, toMs: number): number {
  if (!(toMs > fromMs)) return 0;
  let total = 0;
  // Walk Manila calendar days from the one `from` falls on.
  let dayStart = Math.floor((fromMs + MANILA_OFFSET_MS) / DAY_MS) * DAY_MS - MANILA_OFFSET_MS;
  while (dayStart < toMs) {
    const open = dayStart + OPEN_MS;
    const close = dayStart + CLOSE_MS;
    const a = Math.max(fromMs, open);
    const b = Math.min(toMs, close);
    if (b > a) total += b - a;
    dayStart += DAY_MS;
  }
  return total / 60_000;
}

/** 'on_time' · 'late' · 'pending' (the hour has not run out yet, unanswered) · 'skipped' (withdrawn). */
export function inquiryVerdict(q: CardInquiry, nowMs: number): 'on_time' | 'late' | 'pending' | 'skipped' {
  if (q.withdrawn) return 'skipped';
  const asked = Date.parse(q.asked_at);
  if (!Number.isFinite(asked)) return 'late';
  const limit = CARD_BADGE_THRESHOLDS.quick.minutes;
  if (q.replied_at) {
    const replied = Date.parse(q.replied_at);
    return Number.isFinite(replied) && clockMinutesBetween(asked, replied) <= limit ? 'on_time' : 'late';
  }
  return clockMinutesBetween(asked, nowMs) > limit ? 'late' : 'pending';
}

/** Which of the five card-earned badges this card passes NOW. Unpublished cards and shops not in good standing earn none. */
export function passingCardBadges(card: CardBadgeFacts, goodStanding: boolean, nowMs: number): EarnedCardBadgeKey[] {
  if (!card.published || !goodStanding) return [];
  const t = CARD_BADGE_THRESHOLDS;
  const out: EarnedCardBadgeKey[] = [];
  if (card.paid_bookings >= t.book.bookings && card.paid_couples >= t.book.couples) out.push('book');

  const verdicts = card.inquiries.map((q) => inquiryVerdict(q, nowMs));
  const counted = verdicts.filter((v) => v === 'on_time' || v === 'late');
  if (counted.length >= t.quick.inquiries && counted.every((v) => v === 'on_time')) out.push('quick');

  if (card.couples_now >= t.trend.couples && card.couples_now - card.couples_before >= t.trend.more) out.push('trend');
  if (card.five_star_capped >= t.rave.fiveStars && card.under_four === 0) out.push('rave');
  if (card.paid_bookings >= t.gift.bookings && card.paid_with_gift === card.paid_bookings) out.push('gift');
  return out;
}

// ── Time held: weeks under a month, then months, then years (v86 `HELD`; DECISION_LOG row "time held"). ─────────────
export function heldWords(days: number): string {
  const d = Math.max(0, days);
  if (d < 30) {
    const n = Math.max(1, Math.floor(d / 7));
    return `${n} ${n === 1 ? 'wk' : 'wks'}`;
  }
  if (d < 365) {
    const n = Math.floor(d / 30);
    return `${n} ${n === 1 ? 'mo' : 'mos'}`;
  }
  const n = Math.floor((d / 365) * 10) / 10;
  return `${n} ${n === 1 ? 'yr' : 'yrs'}`;
}

/** "15 Nov 2026" in Manila — the pop-up's "since". */
export function sinceWords(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });
}

/** One medal as the card draws it — serializable, so the server hands it to the client gallery. */
export type CardBadgeView = { key: CardBadgeKey; since: string | null };

/** The card's row, in display order, Verified last when the shop is verified. */
export function cardBadgeRow(
  holds: ReadonlyArray<{ badge: EarnedCardBadgeKey; held_since: string }>,
  verified: { on: boolean; since: string | null; partner?: boolean },
): CardBadgeView[] {
  const byKey = new Map(holds.map((h) => [h.badge, h.held_since]));
  const row: CardBadgeView[] = [];
  for (const k of CARD_BADGE_ORDER) {
    if (k === 'verified') {
      // A Verified Partner shop's 6th medal is the Partner seal, in place of Setnayan Verified (rule 8: it replaces it).
      if (verified.partner) row.push({ key: 'partner', since: null });
      else if (verified.on) row.push({ key: 'verified', since: verified.since });
    } else if (byKey.has(k)) {
      row.push({ key: k, since: byKey.get(k) ?? null });
    }
  }
  return row;
}

/** "Hot Booking · 4 mos" — or the name alone when the start is unknown. */
export function badgeLabel(b: CardBadgeView, nowMs: number): string {
  const name = CARD_BADGES[b.key].name;
  if (b.key === 'partner') return `${name} · ${PARTNER_HELD_WORDS}`;
  if (!b.since) return name;
  const t = Date.parse(b.since);
  if (!Number.isFinite(t)) return name;
  return `${name} · ${heldWords((nowMs - t) / DAY_MS)}`;
}

/** The whole page's answer: per card, its row — or a read that failed, which is never "no badges". */
export type CardBadgesRead = { kind: 'ok'; byCard: Record<string, CardBadgeView[]> } | { kind: 'unreadable' };

/** Parse the facts function's JSON defensively: anything malformed is a failed read, never zero. */
export function parseShopBadgeFacts(raw: unknown): ShopCardBadgeFacts | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.cards) || typeof r.good_standing !== 'boolean') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const cards: CardBadgeFacts[] = [];
  for (const c of r.cards as unknown[]) {
    if (!c || typeof c !== 'object') return null;
    const o = c as Record<string, unknown>;
    const n = {
      paid_bookings: num(o.paid_bookings),
      paid_couples: num(o.paid_couples),
      paid_with_gift: num(o.paid_with_gift),
      five_star_capped: num(o.five_star_capped),
      under_four: num(o.under_four),
      couples_now: num(o.couples_now),
      couples_before: num(o.couples_before),
    };
    if (typeof o.id !== 'string' || typeof o.published !== 'boolean' || Object.values(n).some(Number.isNaN)) return null;
    if (!Array.isArray(o.inquiries)) return null;
    const inquiries: CardInquiry[] = [];
    for (const q of o.inquiries as unknown[]) {
      const x = (q ?? {}) as Record<string, unknown>;
      if (typeof x.asked_at !== 'string') return null;
      inquiries.push({
        asked_at: x.asked_at,
        replied_at: typeof x.replied_at === 'string' ? x.replied_at : null,
        withdrawn: x.withdrawn === true,
      });
    }
    cards.push({ id: o.id, published: o.published, ...n, inquiries });
  }
  return {
    verified_since: typeof r.verified_since === 'string' ? r.verified_since : null,
    good_standing: r.good_standing,
    cards,
  };
}
