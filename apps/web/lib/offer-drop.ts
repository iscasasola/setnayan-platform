/**
 * 🏷 THE OFFER CARD IN THE CHAT — its rules, pure (Quote + negotiation · Piece 1 · PR-4, owner 2026-11-12;
 * approved design `Build_Quote_Negotiation_2026-11-12/quote-maker-polish.html` — the Offer drop sheet, the offer card).
 *
 * The supplier drops one of their OWN Offer Maker offers into the chat with a Good-until day
 * (`chat_messages.vendor_offer_id` + `offer_good_until`, migration 20271339379038); the couple taps Apply and the
 * quote gets a new version with the offer as its own named line.
 *
 * NOTHING HERE PRICES AN OFFER. What an offer takes off is `offersForQuote` (lib/quote-offer-door.ts) — the Offer
 * Maker's own answer through `pickBestDiscount`: % first, then ₱ off what is left (the 9 Nov rule, kept by the owner
 * 12 Nov). This file only decides WHICH lines it is asked about:
 *   · an offer comes off ITS OWN card(s) only (owner 12 Nov (2)): the anchor is the lines whose card the offer
 *     reaches, never the whole quote;
 *   · paid plan rows never change (owner 12 Nov (3)): they are frozen at their stored amount and the auto Final
 *     balance absorbs the difference;
 *   · the new version keeps the quote's status (owner 12 Nov (2)) — decided by the database writer, not here;
 *   · "Applied" is never stored: it is a LATER version whose `line_items[].offer_id` names the offer.
 * Money is whole CENTAVOS except where `offersForQuote` speaks pesos. No I/O. 🔒 lib/offer-drop.test.ts
 */
import { firstPaymentWords, hasFirstPayment, hasGift, hasPrice, offerStatus, priceWords, type Offer } from './offers';
import { offerLineItem, offersForQuote, type QuoteOfferFit } from './quote-offer-door';
import { resolveSchedule, isResolvedSchedule, type InstallmentDraft, type ResolvedSchedule } from './proposal-payment-schedule';
import { seedScheduleFromStored } from './quote-revision-seed';
import { formatCentavos } from './vendor-proposals';

/** One stored quote line, as `vendor_proposals.line_items` holds it (the extra keys ride along untouched). */
export type DropLine = {
  label: string;
  detail?: string | null;
  amount_centavos: number | null;
  card_id?: string | null;
  service_card_id?: string | null;
  offer_id?: string | null;
  [k: string]: unknown;
};

// ── Where a drop stands ────────────────────────────────────────────────────────

export type DropState =
  | { k: 'open'; daysLeft: number }
  | { k: 'applied'; version: number }
  | { k: 'expired'; goodUntil: string }
  | { k: 'ended' }
  | { k: 'gone' };

/** Whole days from `today` to `day` (both YYYY-MM-DD, Manila). */
export function daysBetween(today: string, day: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The card's one state. Applied wins (it already happened, whatever the date is now); then the offer itself
 * (deleted → gone; off / past its day / all taken → ended); then the drop's own Good-until day.
 */
export function dropState(input: {
  /** The message still names an offer (the FK sets it NULL when the offer is deleted). */
  markerPresent: boolean;
  /** The offer, when the reader may read it — a couple reads only a switched-on offer of a published shop. */
  offer: Offer | null;
  goodUntil: string | null;
  today: string;
  /** The first version after the drop that carries this offer — `appliedVersion`. */
  appliedIn: number | null;
}): DropState {
  if (input.appliedIn != null) return { k: 'applied', version: input.appliedIn };
  if (!input.markerPresent) return { k: 'gone' };
  if (!input.offer) return { k: 'ended' };
  if (offerStatus(input.offer, input.today).k !== 'run') return { k: 'ended' };
  if (!input.goodUntil || input.goodUntil < input.today) return { k: 'expired', goodUntil: input.goodUntil ?? input.today };
  return { k: 'open', daysLeft: daysBetween(input.today, input.goodUntil) };
}

/** "Good until 18 Nov · 6 days left" — the design's `untilLine`. */
export function goodUntilWords(goodUntil: string, today: string): string {
  const n = daysBetween(today, goodUntil);
  const left = n <= 0 ? 'last day' : `${n} day${n === 1 ? '' : 's'} left`;
  return `Good until ${dayWords(goodUntil)} · ${left}`;
}

/** "18 Nov" (the design's short day). */
export function dayWords(day: string): string {
  const d = new Date(`${day}T00:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}

/**
 * The words BEFORE the tap — the same two refusals the database makes (OFFER_DROP_EXPIRED · OFFER_ENDED), so the
 * couple is told on the card instead of after a round trip. Null = Apply may be pressed.
 */
export function applyRefusal(input: { offer: Offer | null; goodUntil: string | null; today: string }): string | null {
  if (!input.offer || offerStatus(input.offer, input.today).k !== 'run') return 'This offer has ended — ask the supplier for a new one.';
  if (!input.goodUntil || input.goodUntil < input.today) return `This offer was good until ${input.goodUntil ? dayWords(input.goodUntil) : 'an earlier day'} — ask again.`;
  return null;
}

/** The database's named refusals → what the card says. Unknown → a plain retry line, never the raw error. */
export function applyRefusalWords(message: string | null | undefined): string {
  const m = message ?? '';
  if (m.includes('OFFER_DROP_EXPIRED')) return 'This offer’s Good-until day has passed — ask again.';
  if (m.includes('OFFER_ENDED')) return 'This offer has ended — ask the supplier for a new one.';
  if (m.includes('NOT_THE_COUPLE')) return 'Only the couple applies an offer to their quote.';
  if (m.includes('NO_LIVE_QUOTE')) return 'There is no quote to apply it to yet.';
  if (m.includes('QUOTE_EXPIRED')) return 'Your quote’s Valid until has passed — ask for a new quote first.';
  if (m.includes('DEAL_LOCKED')) return 'This booking is confirmed — changes go through a change request now.';
  if (m.includes('ALREADY_APPLIED')) return 'This offer is already on your quote.';
  if (m.includes('ANOTHER_OFFER')) return 'Your quote already carries an offer — offers don’t stack.';
  if (m.includes('PAID_ROW_CHANGED') || m.includes('QUOTE_BELOW_PAID_FLOOR')) return 'A paid payment never changes, so this offer can’t apply here.';
  if (m.includes('NO_FIT')) return 'This offer doesn’t reach any line on your quote.';
  return 'Couldn’t apply that. Try again.';
}

/** "10% + ₱5,000 off · ₱5,000 first payment · 1 gift" — every part the offer gives, in the Offer Maker's words. */
export function priceWordsFor(o: Offer): string {
  const parts: string[] = [];
  if (hasPrice(o)) parts.push(priceWords(o));
  if (hasFirstPayment(o)) parts.push(firstPaymentWords(o));
  if (hasGift(o)) parts.push(`${o.gifts.length} gift${o.gifts.length === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'An offer';
}

// ── Applied: derived, never stored ─────────────────────────────────────────────

export type VersionForApplied = { version: number; at: string; lines: readonly { offer_id?: string | null }[] };

/** The first version made AT OR AFTER the drop whose lines name this offer — null while none does. */
export function appliedVersion(versions: readonly VersionForApplied[], offerPublicId: string, droppedAt: string): number | null {
  const t = Date.parse(droppedAt);
  const hit = [...versions]
    .sort((a, b) => a.version - b.version)
    .find((v) => (Number.isFinite(t) ? Date.parse(v.at) >= t : true) && v.lines.some((l) => l.offer_id === offerPublicId));
  return hit ? hit.version : null;
}

// ── Its own card only ──────────────────────────────────────────────────────────

/** A line's service card: its own id, else the quote's one card when the quote was built from exactly one. */
export function lineCardId(line: DropLine, quoteCardIds: readonly string[] | null): string | null {
  const own = String(line.card_id ?? line.service_card_id ?? '').trim();
  if (own) return own;
  return quoteCardIds && quoteCardIds.length === 1 ? quoteCardIds[0]! : null;
}

/**
 * The lines this offer comes off: priced lines (a positive amount, never a discount or a gift) on a card the offer
 * reaches. A line with no card is reached only by an All-cards offer.
 */
export function reachedLines(lines: readonly DropLine[], offer: Pick<Offer, 'reachesAll' | 'cards'>, quoteCardIds: readonly string[] | null): DropLine[] {
  return lines.filter((l) => {
    if (typeof l.amount_centavos !== 'number' || !(l.amount_centavos > 0) || l.offer_id) return false;
    const card = lineCardId(l, quoteCardIds);
    return offer.reachesAll || (card != null && offer.cards.includes(card));
  });
}

// ── The next version ──────────────────────────────────────────────────────────

export type OfferVersion = {
  lineItems: DropLine[];
  totalCentavos: number;
  paymentSchedule: ResolvedSchedule | null;
  fit: QuoteOfferFit;
};

/**
 * The quote's next version with this offer: the old lines UNCHANGED + one named line (`offer_id` = the offer's
 * public id), the total less exactly that line, and the plan re-split with every paid row frozen. Priced by
 * `offersForQuote` alone, against the reached lines only. A refusal comes back as words.
 */
export function offerVersion(input: {
  offer: Offer;
  lines: readonly DropLine[];
  totalCentavos: number;
  quoteCardIds: readonly string[] | null;
  paymentSchedule: unknown;
  paidSeqs: ReadonlySet<number>;
  today: string;
  eventDate: string | null;
  now: Date;
}): { ok: true; version: OfferVersion } | { ok: false; reason: string } {
  if (input.lines.some((l) => l.offer_id === input.offer.id)) return { ok: false, reason: applyRefusalWords('ALREADY_APPLIED') };
  if (input.lines.some((l) => typeof l.offer_id === 'string' && l.offer_id.length > 0)) return { ok: false, reason: applyRefusalWords('ANOTHER_OFFER') };
  const reached = reachedLines(input.lines, input.offer, input.quoteCardIds);
  const anchorCentavos = reached.reduce((s, l) => s + (l.amount_centavos ?? 0), 0);
  const cardIds = [...new Set(reached.map((l) => lineCardId(l, input.quoteCardIds)).filter((c): c is string => !!c))];
  const fit = offersForQuote({
    offers: [input.offer],
    cardIds,
    anchorPhp: anchorCentavos / 100,
    today: input.today,
    eventDate: input.eventDate,
    now: input.now,
  })[0];
  if (!fit) return { ok: false, reason: applyRefusalWords('NO_FIT') };
  const named = offerLineItem(fit);
  const offerLine: DropLine = { ...named, offer_id: input.offer.id, card_ids: cardIds };
  const lineItems: DropLine[] = [...input.lines.map((l) => ({ ...l })), offerLine];
  const totalCentavos = input.totalCentavos + (named.amount_centavos ?? 0);
  if (totalCentavos < 0) return { ok: false, reason: applyRefusalWords('NO_FIT') };
  const plan = resplitPlan(input.paymentSchedule, totalCentavos, input.paidSeqs);
  if (!plan.ok) return plan;
  return { ok: true, version: { lineItems, totalCentavos, paymentSchedule: plan.schedule, fit } };
}

/**
 * The stored plan at a new total: each PAID row keeps its stored amount (a percent row becomes that fixed amount),
 * every open row resolves as it was written, and the auto Final balance takes what is left. No plan → none.
 */
export function resplitPlan(
  stored: unknown,
  totalCentavos: number,
  paidSeqs: ReadonlySet<number>,
): { ok: true; schedule: ResolvedSchedule | null } | { ok: false; reason: string } {
  if (!isResolvedSchedule(stored)) return { ok: true, schedule: null };
  const seed = seedScheduleFromStored(stored);
  if (!seed) return { ok: true, schedule: null };
  const credit = Math.max(0, Math.round(Number((stored as ResolvedSchedule).credit_centavos) || 0));
  const manualRows = [...(stored as ResolvedSchedule).installments].filter((r) => !r.is_auto_balance).sort((a, b) => a.seq - b.seq);
  const manual: InstallmentDraft[] = seed.manual.map((d, i) => {
    const row = manualRows[i];
    if (!row || !paidSeqs.has(row.seq)) return d;
    return { ...d, kind: 'fixed', percent: null, amountPhp: Math.round(Number(row.raw_centavos ?? row.amount_centavos) || 0) / 100 };
  });
  const schedule = resolveSchedule({
    manual,
    autoBalance: seed.autoBalance ?? { label: 'Final balance', due: 'before_event', offsetDays: 0 },
    baseCentavos: totalCentavos + credit,
    creditCentavos: credit,
  });
  for (const row of (stored as ResolvedSchedule).installments) {
    if (!paidSeqs.has(row.seq)) continue;
    const now = schedule.installments.find((r) => r.seq === row.seq);
    if (!now || now.amount_centavos !== row.amount_centavos) return { ok: false, reason: applyRefusalWords('PAID_ROW_CHANGED') };
  }
  if (!schedule.balances || schedule.over_by_centavos > 0) return { ok: false, reason: applyRefusalWords('PAID_ROW_CHANGED') };
  return { ok: true, schedule };
}

/** "−₱6,000 · on your quote's Garden buffet line only" style caption for the card ("on <card> only", owner 12 Nov). */
export function offerTakesWords(fit: QuoteOfferFit, reachedLabels: readonly string[]): string {
  const off = `−${formatCentavos(Math.round(fit.offPhp * 100))}`;
  if (reachedLabels.length === 0) return off;
  return `${off} · on ${reachedLabels.join(' · ')} only`;
}
