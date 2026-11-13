/**
 * 🧾 A PRICE OR SERVICE CHANGE ON THE COUPLE'S PURCHASE IS A PROPOSAL, NEVER A SILENT EDIT
 * (DECISION_LOG 2026-11-07, "A SUPPLIER'S CORRECTION: CONTACT DETAILS ONLY NOTIFY; A PRICE OR SERVICE CHANGE NEEDS THE
 * COUPLE'S APPROVAL"). Owner, verbatim: *"couple only gets a price change, or service change on their purchase gets
 * changed, needs approval. changing name or number, address, just gets notified."*
 *
 * The contact half is `lib/supplier-corrections.ts` (notify only). This is the other half: at the claim door the
 * supplier confirms the couple's record — the services the couple booked and the price they recorded. When what the
 * supplier states differs, the difference goes to the couple through the SHIPPED amendment flow
 * (`proposal_amendments` + `proposal_amendment_items`, drawn by `chat-amendment-card.tsx`, answered by
 * `respondAmendmentFromChat`) — never a second mechanism, and the couple's own row keeps their price and services until
 * they accept.
 *
 * 🔒 SCOPE (owner, same day): *"if the supplier creates multiple services that is not included to the package is not
 * something the customer needs to approve."* Only the couple's RECORDED services are compared. A service the supplier
 * added on the door is their own card (`splitClaimCards` → `added`) and is never passed in here.
 *
 * Pure: no I/O, so the claim finish, the approval and the tests share one rule.
 */
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import { signedAmount, type AmendmentItemKind } from '@/lib/proposal-amendments';

/** One service the couple recorded under this supplier (`ClaimDoorService`, read on the server — never the post). */
export type RecordedService = { category: string; label: string };

/** One of the couple's cards as the supplier confirmed it on the door (`splitClaimCards` → `theirs`). */
export type ConfirmedCard = { category: string; price: number | null; bundled: boolean };

export type PurchaseChange = {
  /** The booking's price moved: the couple's recorded total → the supplier's stated total. Null when it did not. */
  price: { from: number; to: number } | null;
  /** Recorded services the supplier took off the couple's booking. */
  removed: RecordedService[];
};

const whole = (n: number | null | undefined): number | null =>
  n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null;

/**
 * What the supplier changed on the couple's purchase.
 *
 * · PRICE — the couple's recorded total against what the supplier states for it. The details slide's "Price"
 *   (`statedPrice`, the ONE bundle price) is the supplier's word when they moved it off the couple's figure; otherwise
 *   it is the sum of the couple's cards the supplier priced (a bundled card carries no price of its own; it is part of
 *   the first card's). Compared only when BOTH sides state a price: a couple who recorded none has no price to change
 *   — the supplier's price is then simply their price, never a proposal — and a supplier who left every card unpriced
 *   and the Price blank said nothing about it.
 * · SERVICES — a service the couple recorded that is no longer among the supplier's cards for them was removed. Renaming
 *   a card is not a service change (the category is the service).
 */
export function purchaseChange(args: {
  recordPrice: number | null;
  recorded: readonly RecordedService[];
  confirmed: readonly ConfirmedCard[];
  /** The details slide's bundle price as posted (`ClaimDoorAnswers.price`); absent/null = the supplier left it blank. */
  statedPrice?: number | null;
}): PurchaseChange {
  const kept = new Set(args.confirmed.map((c) => c.category));
  const seen = new Set<string>();
  const removed: RecordedService[] = [];
  for (const s of args.recorded) {
    if (!s.category || seen.has(s.category)) continue;
    seen.add(s.category);
    if (!kept.has(s.category)) removed.push({ category: s.category, label: s.label || s.category });
  }

  const from = whole(args.recordPrice);
  const priced = args.confirmed.filter((c) => !c.bundled).map((c) => whole(c.price));
  const fromCards = priced.some((p) => p != null) ? priced.reduce<number>((sum, p) => sum + (p ?? 0), 0) : null;
  const stated = whole(args.statedPrice);
  // The bundle price wins when the supplier moved it; left as the couple's figure, the cards say what changed.
  const to = stated != null && stated !== from ? stated : fromCards;
  const price = from != null && to != null && to !== from ? { from, to } : null;

  return { price, removed };
}

export function hasPurchaseChange(c: PurchaseChange | null | undefined): c is PurchaseChange {
  return !!c && (c.price != null || c.removed.length > 0);
}

/** The amendment's lines, in the shape `proposal_amendment_items` stores (signed pesos through `signedAmount`). */
export function purchaseChangeItems(
  c: PurchaseChange,
  opts: { quoted?: boolean } = {},
): { kind: AmendmentItemKind; label: string; amount_php: number | null }[] {
  const out: { kind: AmendmentItemKind; label: string; amount_php: number | null }[] = [];
  if (c.price) {
    const label = `New price ${formatPhp(c.price.to)} (you recorded ${formatPhp(c.price.from)})`.slice(0, 200);
    if (opts.quoted) {
      // 🔒 The Deal's base quote (`claimChangeQuote`) already IS the new price — the line says so and adds nothing,
      // or the lock would book the change twice.
      out.push({ kind: 'request', label, amount_php: null });
    } else {
      const delta = c.price.to - c.price.from;
      const kind: AmendmentItemKind = delta > 0 ? 'addon' : 'discount';
      out.push({ kind, label, amount_php: signedAmount(kind, Math.abs(delta)) });
    }
  }
  for (const s of c.removed) {
    // A removed service carries no amount of its own (the couple's price is one bundle); it is a line the couple says
    // yes or no to, which is what a 'request' line is on the card.
    out.push({ kind: 'request', label: `Remove from your booking: ${s.label}`.slice(0, 200), amount_php: null });
  }
  return out;
}

/** The amendment's note — the couple reads it on the card. Nothing on their booking moves until they accept. */
export function purchaseChangeNote(shopName: string | null | undefined): string {
  const who = (shopName ?? '').replace(/\s+/g, ' ').trim() || 'Your supplier';
  return `${who} joined from your link and updated your booking. Nothing changes until you accept.`.slice(0, 2000);
}

/** The card's chat line (`chat_messages.body`), the same shape `createAmendmentFromChat` posts. */
export function purchaseChangeCardBody(n: number): string {
  return `🧾 Deal — ${formatCount(n)} item${n === 1 ? '' : 's'}`;
}

/** The couple's in-app notice when the proposal reaches their chat. */
export function purchaseChangeNotice(args: { eventId: string; threadId: string; shopName: string | null }): {
  title: string;
  body: string;
  relatedUrl: string;
} {
  const who = (args.shopName ?? '').replace(/\s+/g, ' ').trim() || 'Your supplier';
  return {
    title: `${who} asks to change your booking`.slice(0, 120),
    body: 'Open the chat to accept or decline. Your booking stays as it is until you do.',
    relatedUrl: `/dashboard/${args.eventId}/messages/${args.threadId}`,
  };
}

/**
 * 🔒 AN APPROVED CLAIM CHANGE IS LOCKABLE (DECISION_LOG 2026-11-13, owner: *"yes lockable."*). The shipped `lockDeal`
 * books a Deal at its BASE QUOTE + the Deal's lines, and refuses a Deal with no base quote ("no price, no lock"). So the
 * claim change carries a REAL quote, built from the couple's record (the guests / hours they agreed) and the pricing the
 * supplier confirmed on the claim door (basis · per-guest rate · base + extra-hour rate · one price) — the deliberate
 * exception to migration 20271328327292's "no quote made up from the Total alone": every line here is a rate times an
 * agreed count, or a price the supplier typed, never a bare total.
 *
 * The quote IS the new price, so the Deal's price line then carries no amount of its own (`purchaseChangeItems` with
 * `quoted`) — base + lines = the quote, never the quote twice.
 *
 * Null (no quote — the Deal stays unlockable, exactly as before) when:
 *   · a card the couple keeps has no price the door can work out (Per guest / Per hour with no agreed count on the
 *     record, or a missing rate);
 *   · the lines do not add up to the price the couple is asked to accept (`lockPrice`) — e.g. a rate rounded from
 *     ₱100,000 ÷ 120. The couple accepted a number; the lock may only ever book that number.
 */
export type ClaimQuoteCard = {
  name: string;
  price: number | null;
  bundled: boolean;
  inclusions: readonly string[];
  pricing?: {
    basis: 'fixed' | 'per_pax' | 'per_hour';
    perPax: number | null;
    minPax: number | null;
    minHours: number | null;
    hourBase: number | null;
    extraHour: number | null;
  };
};

export type ClaimQuoteLine = {
  label: string;
  detail: string | null;
  amount_centavos: number | null;
  basis?: 'flat' | 'per_pax' | 'per_hour';
  rate_centavos?: number;
  incl_hours?: number;
  extra_hour_centavos?: number;
};

export function claimChangeQuote(args: {
  /** How the couple said the price works, and the guests / hours they agreed (`ClaimDoorRecord`). */
  recordBasis: 'fixed' | 'per_pax' | 'per_hour' | null | undefined;
  agreedCount: number | null | undefined;
  /** The couple's cards as the supplier confirmed them (`splitClaimCards` → `theirs`). */
  confirmed: readonly ClaimQuoteCard[];
  /** The price the couple is asked to accept — `change.price.to`, or their recorded price when it did not move. */
  lockPrice: number | null;
}): { lines: ClaimQuoteLine[]; totalCentavos: number } | null {
  const lock = whole(args.lockPrice);
  if (lock == null || args.confirmed.length === 0) return null;
  const agreed = args.agreedCount != null && Number.isFinite(args.agreedCount) && args.agreedCount > 0 ? args.agreedCount : null;
  const cents = (php: number) => Math.round(php * 100);
  const incl = (c: ClaimQuoteCard) => {
    const words = c.inclusions.map((s) => s.trim()).filter(Boolean);
    return words.length ? `Includes ${words.join(' · ')}`.slice(0, 500) : null;
  };

  const lines: ClaimQuoteLine[] = [];
  for (const c of args.confirmed) {
    const label = (c.name.trim() || 'Your booking').slice(0, 200);
    if (c.bundled) {
      // Part of the first card's price — a line of the quote with no amount of its own.
      lines.push({ label, detail: incl(c) ?? 'Part of the bundle price', amount_centavos: null });
      continue;
    }
    const p = c.pricing;
    if (p?.basis === 'per_pax') {
      const rate = whole(p.perPax);
      if (rate == null || args.recordBasis !== 'per_pax' || agreed == null) return null;
      const billed = Math.max(Math.round(agreed), whole(p.minPax) ?? 0);
      lines.push({
        label,
        detail: [`${formatPhp(rate)} × ${formatCount(billed)} guests agreed`, incl(c)].filter(Boolean).join(' · ').slice(0, 500),
        amount_centavos: cents(rate * billed),
        basis: 'per_pax',
        rate_centavos: cents(rate),
      });
    } else if (p?.basis === 'per_hour') {
      const base = whole(p.hourBase);
      if (base == null || args.recordBasis !== 'per_hour' || agreed == null) return null;
      const inHours = p.minHours != null && p.minHours > 0 ? p.minHours : 0;
      const extraHours = Math.max(0, agreed - inHours);
      const extraRate = whole(p.extraHour);
      if (extraHours > 0 && extraRate == null) return null;
      const extra = extraHours > 0 && extraRate != null ? extraHours * extraRate : 0;
      lines.push({
        label,
        detail: [
          extraHours > 0 && extraRate != null
            ? `${formatPhp(base)} for ${formatCount(inHours)} hours + ${formatCount(extraHours)} extra × ${formatPhp(extraRate)}`
            : `${formatPhp(base)} for ${formatCount(agreed)} hours agreed`,
          incl(c),
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 500),
        amount_centavos: cents(base + extra),
        basis: 'per_hour',
        rate_centavos: cents(base),
        ...(inHours > 0 ? { incl_hours: inHours } : {}),
        ...(extraRate != null ? { extra_hour_centavos: cents(extraRate) } : {}),
      });
    } else {
      const price = whole(c.price);
      if (price == null) return null;
      lines.push({ label, detail: incl(c), amount_centavos: cents(price), basis: 'flat' });
    }
  }
  const totalCentavos = lines.reduce((s, l) => s + (l.amount_centavos ?? 0), 0);
  if (totalCentavos <= 0 || totalCentavos !== cents(lock)) return null;
  return { lines, totalCentavos };
}
