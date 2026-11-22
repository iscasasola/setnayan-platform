/**
 * 🧾 MAKE A QUOTE IN THE CHAT (owner-approved supplier cut 7, 2026-11-14 — DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE
 * APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 7). The words and arithmetic of
 * the short card the chat's ＋ drops before any quote is out: pick cards, the offer, Good until (filled, 14 days, never
 * hidden), a note. It lands as the quote card the chat already shows; "Full quotation" opens today's builder.
 *
 * Pure: no I/O, no clock of its own (today is handed in, Manila's, as the send path counts it).
 */
import { addDaysIso, validUntilRefusal } from './quote-valid-until';

/** How long a quote made here is good for unless the supplier changes it (owner's cut 7: "14 days"). */
export const MAKE_A_QUOTE_GOOD_FOR_DAYS = 14;

/** A shop card as the short card lists it — its own name and its own "from" price. */
export type MakeQuoteCardOption = { id: string; name: string; fromCentavos: number | null };

/**
 * The Good until the card opens on: 14 days from today — or the event day, when that comes sooner (a quote is good
 * until the event day at the latest). Null when no day after today is allowed (the event is today or past): the
 * supplier then picks, and the send refuses with the shipped sentence.
 */
export function makeQuoteGoodUntil(todayIso: string, eventDate: string | null): string | null {
  const in14 = addDaysIso(todayIso, MAKE_A_QUOTE_GOOD_FOR_DAYS);
  const pick = eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && eventDate < in14 ? eventDate : in14;
  return validUntilRefusal(pick, todayIso, eventDate) ? null : pick;
}

/** "Dec 26 · 14 days" — the date and how many days that is, so the default is SEEN, never hidden. */
export function goodUntilWords(validUntil: string, todayIso: string): string {
  const day = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.parse(`${validUntil}T00:00:00Z`));
  const n = Math.round((Date.parse(`${validUntil}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);
  return `${day} · ${n} ${n === 1 ? 'day' : 'days'}`;
}

/** What the offer starts at: the picked cards' own "from" prices added up (a card with none adds nothing). */
export function makeQuoteOfferStart(picked: readonly MakeQuoteCardOption[]): number {
  return picked.reduce((sum, c) => sum + Math.max(0, c.fromCentavos ?? 0), 0);
}

/** A priced line a design adds after the card's own line (🎂 a cake design: one line per priced pick). */
export type MakeQuoteExtraLine = { label: string; centavos: number };

/**
 * The quote the card sends: ONE line at the offer, named for the picked cards (the server re-sums the total from the
 * lines, so the lines ARE the offer). A single card is named as the line's card, so a revision re-opens it from it.
 *
 * 🎂 With `extras` (a cake design's priced picks, Cake Maker v6 §03): the card's line is the offer LESS the extras, then
 * one line per extra — so the total is still exactly the offer the supplier typed.
 */
export function makeQuoteLines(
  picked: readonly MakeQuoteCardOption[],
  offerCentavos: number,
  extras: readonly MakeQuoteExtraLine[] = [],
): { label: string; detail: null; amount_centavos: number; card_id?: string }[] {
  const label = picked.map((c) => c.name.trim()).filter(Boolean).join(' · ').slice(0, 160) || 'Your offer';
  const extra = extras.filter((x) => x.centavos > 0).map((x) => ({ label: x.label.slice(0, 160), detail: null, amount_centavos: Math.round(x.centavos) }));
  const rest = extra.reduce((a, x) => a + x.amount_centavos, 0);
  const line = { label, detail: null, amount_centavos: Math.max(0, Math.round(offerCentavos) - rest) };
  return [picked.length === 1 ? { ...line, card_id: picked[0]!.id } : line, ...extra];
}

/** The extras alone — what the offer can't go below. */
export const makeQuoteExtrasCentavos = (extras: readonly MakeQuoteExtraLine[]) => extras.reduce((a, x) => a + Math.max(0, Math.round(x.centavos)), 0);

/** Null = it may be sent. Otherwise the one sentence the card shows (the shipped Good-until words for the date). */
export function makeQuoteRefusal(input: { picked: number; offerCentavos: number; validUntil: string | null; todayIso: string; eventDate: string | null; extrasCentavos?: number }): string | null {
  if (input.picked === 0) return 'Pick at least one of your cards.';
  if (!(input.offerCentavos > 0)) return 'Type your offer.';
  if (input.extrasCentavos && input.offerCentavos < input.extrasCentavos) return 'Your offer can’t be less than the extras listed.';
  return validUntilRefusal(input.validUntil, input.todayIso, input.eventDate);
}
