/**
 * lib/quote-line-structure.ts — 🧭 THE PRICING FACTS A QUOTE LINE CARRIES, kept through the send.
 *
 * Owner 12 Nov (quote money PR-1, plan `controller-2026-11-11/BUILD-PIECE1-QUOTE-NEGOTIATION.md` §2): *no new columns*
 * — the card a line came from, its basis and rate, and the offer a line is ride in the `line_items` JSON. The send path
 * rebuilds every line twice (`sanitizeCustomLineItems`, then `applyFreeTransportToQuote`), and both build fresh
 * `{label, detail, amount_centavos}` objects — so without this file the facts were dropped on the way into the row and
 * "a revised quote keeps its line's offer" could never be true.
 *
 *   · `lineStructureOf` — the facts, validated (never trusted from the wire: ids are short strings, amounts whole
 *     non-negative centavos, the basis one of three words);
 *   · `keepLineStructure` — puts them back on the enforced lines, matched IN ORDER by label + amount. The free-travel
 *     rule only ever replaces or adds a "Transportation" line, so every other line is still there, in order.
 *
 * PURE. 🔒 lib/quote-line-structure.test.ts
 */
import type { ProposalLineItem } from './vendor-proposals';

type Structure = Pick<ProposalLineItem, 'card_id' | 'basis' | 'rate_centavos' | 'incl_hours' | 'extra_hour_centavos' | 'offer_id'>;

const id = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null);
const whole = (v: unknown): number | null => {
  const n = Math.round(Number(v));
  return v != null && Number.isFinite(n) && n >= 0 ? n : null;
};

/** The structured facts on one line, validated. Only what is present and sane comes back. */
export function lineStructureOf(raw: unknown): Structure {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Structure = {};
  const card = id(r.card_id);
  if (card) out.card_id = card;
  if (r.basis === 'flat' || r.basis === 'per_pax' || r.basis === 'per_hour') out.basis = r.basis;
  const rate = whole(r.rate_centavos);
  if (rate != null) out.rate_centavos = rate;
  const incl = whole(r.incl_hours);
  if (incl != null) out.incl_hours = incl;
  const extra = whole(r.extra_hour_centavos);
  if (extra != null) out.extra_hour_centavos = extra;
  const offer = id(r.offer_id);
  if (offer) out.offer_id = offer;
  return out;
}

/** Re-attach each line's facts after enforcement rebuilt the lines (matched in order by label + amount). */
export function keepLineStructure<T extends ProposalLineItem>(before: readonly ProposalLineItem[], after: readonly T[]): Array<T & ProposalLineItem> {
  let i = 0;
  return after.map((li) => {
    for (let j = i; j < before.length; j++) {
      const b = before[j]!;
      if (b.label === li.label && b.amount_centavos === li.amount_centavos) {
        i = j + 1;
        const s = lineStructureOf(b);
        return Object.keys(s).length > 0 ? { ...li, ...s } : li;
      }
    }
    return li;
  });
}
