/**
 * apps/web/lib/quote-detection.ts
 *
 * Vendor-authored quote detection — the read-only, advisory half of the
 * "log a vendor quote into your build" bridge (host-search improvement #1).
 *
 * Vendors routinely quote a ₱ figure inline in the couple↔vendor chat (or in a
 * structured proposal). Today the couple re-types that number by hand into the
 * workspace Costing form. These helpers SCAN vendor-authored text for plausible
 * peso amounts so the UI can offer a one-tap "log it to your build?" affordance
 * — pre-filling the confirm modal the couple still edits + approves.
 *
 * HARD CONTRACT (the money-safety reviewer checks these):
 *   • Pure + fail-soft. No I/O, no throw. Bad/empty input → `[]`.
 *   • ADVISORY ONLY. Nothing here writes a cost — it only surfaces candidates.
 *     The stored cost is only ever changed by the couple confirming the
 *     (editable) modal, which posts to updateVendorCosts.
 *   • Returns amounts in PESOS (not centavos) so the caller can drop them
 *     straight into the peso-denominated Costing inputs.
 *
 * Tolerant on input, conservative on output: we accept ₱ / PHP / P prefixes,
 * thousands separators, and optional decimals, but drop noise (tiny values,
 * absurd values, duplicates) so the chip never nags about a "5" in "table 5".
 */

/** Smallest peso amount we treat as a real quote (filters "P5", years, etc.). */
const MIN_PLAUSIBLE_PESOS = 100;
/** Largest peso amount we'll surface (a sanity ceiling; ₱50M covers any event). */
const MAX_PLAUSIBLE_PESOS = 50_000_000;

/**
 * Matches a peso figure with a currency cue so we don't grab every bare number.
 * Accepts:  ₱12,500   ₱ 12,500.50   PHP 8000   Php8,000   P 15,000   15,000 pesos
 *
 * The currency cue is required (prefix ₱/PHP/Php/P OR a trailing "peso"/"pesos")
 * — a naked "5,000" with no cue is intentionally ignored to keep the detector
 * advisory + low-noise. The numeric core allows comma OR space grouping and an
 * optional 1–2 digit decimal tail.
 */
const QUOTE_PATTERN =
  /(?:(?:₱|php|p)\s*)(\d{1,3}(?:[ ,]\d{3})+|\d{3,9})(?:\.(\d{1,2}))?|(\d{1,3}(?:[ ,]\d{3})+|\d{3,9})(?:\.(\d{1,2}))?\s*(?:pesos?|php)\b/gi;

function normalizeToPesos(intPart: string, decPart: string | undefined): number | null {
  const digits = intPart.replace(/[ ,]/g, '');
  if (digits.length === 0) return null;
  const whole = Number(digits);
  if (!Number.isFinite(whole)) return null;
  const frac = decPart ? Number(`0.${decPart}`) : 0;
  const pesos = whole + (Number.isFinite(frac) ? frac : 0);
  return Math.round(pesos * 100) / 100;
}

/**
 * Pull every plausible peso amount out of one block of free text, in order of
 * first appearance, de-duplicated. Returns `[]` for null/blank/non-string.
 */
export function detectAmountsInText(text: string | null | undefined): number[] {
  if (typeof text !== 'string' || text.trim().length === 0) return [];

  const out: number[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  // Fresh lastIndex each call — the regex is module-level + /g.
  QUOTE_PATTERN.lastIndex = 0;
  let guard = 0;
  while ((m = QUOTE_PATTERN.exec(text)) !== null && guard < 200) {
    guard += 1;
    // Two alternatives in the pattern → two capture-group pairs.
    const intPart = m[1] ?? m[3];
    const decPart = m[2] ?? m[4];
    if (intPart == null) continue;
    const pesos = normalizeToPesos(intPart, decPart);
    if (pesos == null) continue;
    if (pesos < MIN_PLAUSIBLE_PESOS || pesos > MAX_PLAUSIBLE_PESOS) continue;
    if (seen.has(pesos)) continue;
    seen.add(pesos);
    out.push(pesos);
  }
  return out;
}

export type VendorMessageLike = {
  sender_role: string | null;
  body: string | null;
  created_at: string | null;
};

/**
 * Scan the most-recent vendor-authored chat messages for plausible quote
 * amounts. Only messages whose sender_role is 'vendor' are considered (the
 * couple's own typed numbers never feed their own quote chip). Newest messages
 * are scanned first so the freshest quote leads; results stay de-duplicated and
 * capped so the chip surfaces a tight set, not a wall of numbers.
 *
 * Fail-soft: a null/empty list, or rows missing body, yield `[]`.
 *
 * @param messages   chat rows (any order; we sort newest-first internally)
 * @param scanLimit  how many recent vendor messages to scan (default 8)
 * @param maxAmounts cap on distinct amounts returned (default 4)
 */
export function detectAmountsFromVendorMessages(
  messages: ReadonlyArray<VendorMessageLike> | null | undefined,
  scanLimit = 8,
  maxAmounts = 4,
): number[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const vendorMsgs = messages
    .filter((row) => row && row.sender_role === 'vendor' && typeof row.body === 'string')
    .slice()
    .sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    })
    .slice(0, Math.max(0, scanLimit));

  const out: number[] = [];
  const seen = new Set<number>();
  for (const row of vendorMsgs) {
    for (const amt of detectAmountsInText(row.body)) {
      if (seen.has(amt)) continue;
      seen.add(amt);
      out.push(amt);
      if (out.length >= maxAmounts) return out;
    }
  }
  return out;
}

/**
 * Decide whether the "log this quote?" chip should show, given the detected
 * amounts and the cost the couple has ALREADY stored for this vendor.
 *
 * Advisory rule (intentionally calm — never nags once the couple has matched
 * the quote):
 *   • no detected amounts          → hidden
 *   • no stored service cost yet    → shown (nothing logged; offer to log)
 *   • a detected amount differs from the stored service cost → shown
 *   • the stored cost already equals a detected amount → hidden
 *
 * `storedServicePesos` is the couple's current event_vendors.total_cost_php
 * (pesos); null/0 means "not logged yet".
 */
export function shouldOfferQuoteLog(
  detectedPesos: ReadonlyArray<number>,
  storedServicePesos: number | null | undefined,
): boolean {
  if (!Array.isArray(detectedPesos) || detectedPesos.length === 0) return false;
  const stored =
    typeof storedServicePesos === 'number' && Number.isFinite(storedServicePesos)
      ? storedServicePesos
      : 0;
  if (stored <= 0) return true;
  // Already logged — only nudge if NONE of the detected amounts match it
  // (small epsilon for float-cents safety).
  return !detectedPesos.some((a) => Math.abs(a - stored) < 0.005);
}

/**
 * Split a structured proposal's total + line items into the three Costing
 * fields (all pesos) for modal pre-fill.
 *
 * Granular line items are bucketed by a loose label match — "transport" /
 * "travel" → transport; "food" / "meal" / "crew meal" → food; everything else
 * (incl. unlabeled) rolls into the service price. If no line item carries a
 * recognizable transport/food label, the whole total goes to service so the
 * couple just sees one number to confirm.
 *
 * Returns pesos with `service + transport + food === totalPesos` (modulo cents).
 * Fail-soft: bad input → all-zero split.
 */
export type ProposalCostSplit = {
  servicePesos: number;
  transportPesos: number;
  foodPesos: number;
};

export function splitProposalToCosting(
  totalCentavos: number | null | undefined,
  lineItems: ReadonlyArray<{ label?: string | null; amount_centavos?: number | null }> | null | undefined,
): ProposalCostSplit {
  const toPesos = (c: number) => Math.round((c / 100) * 100) / 100;
  const totalC =
    typeof totalCentavos === 'number' && Number.isFinite(totalCentavos) && totalCentavos > 0
      ? Math.round(totalCentavos)
      : 0;

  let transportC = 0;
  let foodC = 0;
  let bucketedServiceC = 0;
  let sawGranular = false;

  if (Array.isArray(lineItems)) {
    for (const li of lineItems) {
      const amt =
        typeof li?.amount_centavos === 'number' && Number.isFinite(li.amount_centavos)
          ? Math.round(li.amount_centavos)
          : 0;
      if (amt <= 0) continue;
      const label = typeof li?.label === 'string' ? li.label.toLowerCase() : '';
      if (/transport|travel|mileage|gas|fuel/.test(label)) {
        transportC += amt;
        sawGranular = true;
      } else if (/food|meal|crew\s*meal|catering\s*crew|baon/.test(label)) {
        foodC += amt;
        sawGranular = true;
      } else {
        bucketedServiceC += amt;
      }
    }
  }

  // If we never found a transport/food line, don't carve up the total — just
  // surface the single number as the service price (least-surprise pre-fill).
  if (!sawGranular) {
    return { servicePesos: toPesos(totalC), transportPesos: 0, foodPesos: 0 };
  }

  // Service = whatever's left after transport + food. Prefer the proposal total
  // as the source of truth (line items may not sum exactly); fall back to the
  // bucketed service sum when the total is missing.
  const serviceC =
    totalC > 0 ? Math.max(0, totalC - transportC - foodC) : Math.max(0, bucketedServiceC);

  return {
    servicePesos: toPesos(serviceC),
    transportPesos: toPesos(transportC),
    foodPesos: toPesos(foodC),
  };
}
