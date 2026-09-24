/**
 * quote-event-brief.ts — WHAT SETNAYAN TELLS A SUPPLIER ABOUT THE EVENT WHILE
 * THEY PRICE IT: step 1 of the quote, "Know the event". PURE.
 *
 * ── WHY (owner, 2026-09-22) ────────────────────────────────────────────────
 * *"when creating a quotation, the vendor must see the basic information we
 * can provide to them to help them build for the event as well."* The brief
 * existed in two other places — the customer rail beside the chat
 * (`lib/customer-event-summary.ts`) and the client page — and the quote tool
 * itself showed only pax and hours. The facts were not beside the quote.
 *
 * ── WHAT MAY BE SHOWN, AND WHEN (owner, 2026-09-20 — not re-decided here) ──
 * Stage 1 (quoting, free): event type, date, the AREA, guest count, the service
 * asked for, the couple's palette/preferences, the budget band
 * (`SHOW_BUDGET_BAND_WHILE_QUOTING`), plus the locked CATEGORIES (2026-09-08).
 * Withheld until the fee is settled: the exact venue and address, meal counts,
 * the day-of timeline, the seat plan, the monogram — and the screen NAMES each
 * one it withholds (`WITHHELD_FIELD_LABEL`, sentence from `feeLockCopy`).
 *
 * 🔑 THE ROWS ARE THE RAIL'S ROWS. `buildCustomerEventSummary` already decides
 * how a target date, a guest count with its provenance, a location and the
 * locked count read — including the honest "Not set yet" when a fact is
 * missing. This file APPENDS the stage-1 facts the rail does not carry and
 * never rewrites the ones it does; two builders of "how many guests" would
 * drift, and the quote is priced against that number.
 *
 * ⚠ THE WITHHELD LINE FOLLOWS THE STAGE, WHICH FOLLOWS THE FLAG. With
 * `NEXT_PUBLIC_FEE_UNLOCKS_EVENT` unset (production, 2026-09-22) every stage
 * resolves `unlocked` and nothing is withheld — so this prints NOTHING about
 * withholding. It must never announce a lock that is not enforced.
 */

import type { CustomerFactRow } from '@/lib/customer-event-summary';
import {
  SHOW_BUDGET_BAND_WHILE_QUOTING,
  STAGE_THREE_ONLY_BRIEF_FIELDS,
  feeLockCopy,
  type EventAccessStage,
} from '@/lib/event-access-stage';
import { formatPhpRounded } from '@/lib/php';

export type QuoteBriefRow = { label: string; value: string; unknown?: boolean; note?: string | null };

export type QuoteEventBrief = {
  /** "Wedding · Saturday, 13 March 2027 · Calabarzon" — the folded step's line. Null when nothing is known. */
  eventLine: string | null;
  rows: QuoteBriefRow[];
  /** The named withheld fields, ONLY while quoting under an enforced fee. */
  withheld: { headline: string; detail: string } | null;
  fullBriefHref: string;
};

export type QuoteEventBriefInput = {
  eventId: string;
  eventTypeLabel: string | null;
  /** Already formatted by the caller (`formatLongDate`), or null. */
  targetDateLabel: string | null;
  /** `regionLabel(events.region)` — the AREA, never the venue while quoting. */
  area: string | null;
  /** The rail's own rows, verbatim (`buildCustomerEventSummary(...).facts`). */
  facts: readonly CustomerFactRow[];
  /** The service the inquiry is about (the first interest chip's label). */
  askedFor: string | null;
  /** The couple's opt-in band and its live per-head median, when the event states one. */
  budgetBand: { label: string; perHeadPhp: number | null } | null;
  /** Mood + ceremony, already labelled. Empty when the couple set neither. */
  styleLabels: readonly string[];
  /** Locked CATEGORIES (never the other shops' names). */
  lockedCategories: readonly string[];
  stage: EventAccessStage;
};

const clean = (v: string | null | undefined): string | null => v?.trim() || null;

export function briefForQuote(input: QuoteEventBriefInput): QuoteEventBrief {
  const rows: QuoteBriefRow[] = input.facts.map((f) => ({
    label: f.label,
    value: f.value,
    unknown: f.unknown,
    note: f.noteIsPrivate ? null : (f.note ?? null),
  }));

  const area = clean(input.area);
  if (area) rows.push({ label: 'Area', value: area });

  const asked = clean(input.askedFor);
  if (asked) rows.push({ label: 'Asked for', value: asked });

  // The band is a stage-1 fact by the owner's own call — unless that constant
  // is ever flipped, in which case it is withheld while quoting.
  if (input.budgetBand && (input.stage !== 'quoting' || SHOW_BUDGET_BAND_WHILE_QUOTING)) {
    const med = input.budgetBand.perHeadPhp;
    rows.push({
      label: 'Budget band',
      value: med != null && med > 0 ? `${input.budgetBand.label} · ~${formatPhpRounded(med)} a head` : input.budgetBand.label,
    });
  }

  const style = input.styleLabels.map(clean).filter((s): s is string => Boolean(s));
  if (style.length) rows.push({ label: 'Style', value: style.join(' · ') });

  const locked = input.lockedCategories.map(clean).filter((s): s is string => Boolean(s));
  if (locked.length) rows.push({ label: 'Already locked', value: Array.from(new Set(locked)).sort().join(' · ') });

  const line = [clean(input.eventTypeLabel), clean(input.targetDateLabel), area].filter(Boolean).join(' · ');

  const withheld =
    input.stage === 'quoting'
      ? (() => {
          const copy = feeLockCopy({ stage: 'quoting', owed: null, withheld: STAGE_THREE_ONLY_BRIEF_FIELDS });
          return { headline: copy.headline, detail: copy.detail };
        })()
      : null;

  return {
    eventLine: line || null,
    rows,
    withheld,
    fullBriefHref: `/vendor-dashboard/clients/${input.eventId}`,
  };
}
