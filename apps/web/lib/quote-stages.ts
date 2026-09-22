/**
 * quote-stages.ts — THE FIVE STEPS OF WRITING A QUOTE, as one pure rule.
 *
 * ── WHY (owner, 2026-09-22) ────────────────────────────────────────────────
 * *"create evident separation for different brain processes. how can they see
 * the information, then what next, and so on. build a clean continuity."*
 * The builder held every control in one scroll — guests, lines, crew, money,
 * schedule, rails, note, send — and a supplier read it as a wall. The approved
 * prototype walks it as five steps on one spine:
 *
 *   1 Know the event      read    — what Setnayan can tell them (the brief)
 *   2 Choose what to offer decide — their cards, guests & hours
 *   3 Set the price       price   — lines, crew & travel, total, fee, Papic
 *   4 Terms               agree   — schedule, how to pay, title/valid/note
 *   5 Review & send       send
 *
 * A done step folds to ONE TRUE LINE written from the live draft; the current
 * step is open; later steps are visible but folded ("Up next"). Every step
 * ends in the next. Nothing is locked — a header reopens its step.
 *
 * 🔑 PURE, so the order, the opening step and the five summaries are executed
 * by `quote-stages.test.ts` rather than read off JSX. The builder only draws
 * what this file hands it.
 */

import { formatCentavos } from '@/lib/vendor-proposals';

export type QuoteStageId = 'know' | 'offer' | 'price' | 'terms' | 'send';
export type QuoteStageState = 'done' | 'cur' | 'later';

export type QuoteStageDef = {
  id: QuoteStageId;
  n: 1 | 2 | 3 | 4 | 5;
  title: string;
  /** The one line under the Next button — why the next step follows. Null on the last step. */
  lead: string | null;
};

export const QUOTE_STAGES: readonly QuoteStageDef[] = [
  { id: 'know', n: 1, title: 'Know the event', lead: 'Everything Setnayan has on this event. Price from it.' },
  { id: 'offer', n: 2, title: 'Choose what to offer', lead: 'Your cards set the lines, the terms and the day.' },
  { id: 'price', n: 3, title: 'Set the price', lead: 'Money once — and what Setnayan charges and gives.' },
  { id: 'terms', n: 4, title: 'Terms', lead: 'How they pay you, and until when this stands.' },
  { id: 'send', n: 5, title: 'Review & send', lead: null },
] as const;

export const QUOTE_STAGE_COUNT = QUOTE_STAGES.length;

export function stageIndex(id: QuoteStageId): number {
  return QUOTE_STAGES.findIndex((s) => s.id === id);
}

/** The step after `id`, or null on the last one. */
export function nextStage(id: QuoteStageId): QuoteStageId | null {
  const i = stageIndex(id);
  return i >= 0 && i < QUOTE_STAGES.length - 1 ? QUOTE_STAGES[i + 1]!.id : null;
}

/**
 * WHERE THE BUILDER OPENS. A fresh quote starts at step 1. "Update this
 * quote" (S5, 2026-09-18) arrives with the lines already seeded from the quote
 * being replaced — the supplier came to change the PRICE, so it opens there.
 */
export function openingStage(opts: { revision: boolean }): QuoteStageId {
  return opts.revision ? 'price' : 'know';
}

/** done / cur / later for every step, given the current one. */
export function stageStates(current: QuoteStageId): Record<QuoteStageId, QuoteStageState> {
  const cur = stageIndex(current);
  const out = {} as Record<QuoteStageId, QuoteStageState>;
  QUOTE_STAGES.forEach((s, i) => {
    out[s.id] = i < cur ? 'done' : i === cur ? 'cur' : 'later';
  });
  return out;
}

/** The facts each folded step is summarised from — all from the live draft, none invented. */
export type QuoteStageFacts = {
  /** The event, as step 1 shows it: "Wedding · 13 March 2027 · Calabarzon". Null → "Their event". */
  eventLine: string | null;
  pax: number;
  hours: number;
  /** "Live band + Host / MC", or null when no card is loaded. */
  cardsLine: string | null;
  netPayableCentavos: number;
  /** "₱1,788" or null when the fee cannot be stated (silent standing). */
  feeText: string | null;
  /** "1,021 photos" / "off" / null when nothing can be said. */
  papicText: string | null;
  /** Manual installments + the auto balance when it is > 0. */
  paymentsCount: number;
  railLabels: readonly string[];
  /** YYYY-MM-DD or ''. */
  validUntil: string;
};

/**
 * ONE TRUE LINE PER FOLDED STEP. Money is printed through `formatCentavos`,
 * the same formatter the lines and the total use, so a folded step can never
 * show a figure the open step does not.
 */
export function stageSummaries(f: QuoteStageFacts): Record<QuoteStageId, string> {
  const money = formatCentavos(f.netPayableCentavos);
  return {
    know: f.eventLine ?? 'Their event',
    offer: `${f.cardsLine ?? 'No card loaded'} · ${f.pax} guests · ${f.hours} h`,
    price: `${money}${f.feeText ? ` · fee ${f.feeText}` : ''}${f.papicText ? ` · Papic ${f.papicText}` : ''}`,
    terms: `${f.paymentsCount} payment${f.paymentsCount === 1 ? '' : 's'} · ${
      f.railLabels.length ? f.railLabels.join(' · ') : 'every approved method'
    }${f.validUntil ? ` · until ${f.validUntil}` : ''}`,
    send: `Send · ${money}`,
  };
}
