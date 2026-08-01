/**
 * lib/payment-proof-scan.ts — pull the payer's reference and amounts out of
 * OCR'd text from a payment-confirmation screenshot.
 *
 * Pure string work, no DOM: the caller supplies receipt text — an admin
 * pasting a bank notification, a couple pasting their confirmation — and this
 * decides what in it is a reference and what is money. Keeping it pure is the
 * point: the real receipts in the test file are the fixtures, so a GCash or
 * BDO layout change breaks CI rather than a live reconciliation.
 *
 * (Deliberately NOT an OCR reader. Both GCash and BDO put a one-tap COPY
 * button beside the reference, so shipping an OCR engine would trade that tap
 * for a ~6.5 MB download on Philippine mobile data. If real couples turn out
 * to struggle with copy-paste, an engine can feed text into this same
 * function without changing anything here.)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY TWO KINDS OF REFERENCE — this is the subtle part, learned from live
 * transfers on 2026-07-31:
 *
 *   • GCash → GCash (same rail): payer and recipient see the SAME reference
 *     number (both `0043457367694`). Match on `reference`.
 *   • Any bank → BDO (InstaPay): the payer's `Ref No.` is GCash's own and
 *     appears NOWHERE on our side. What links the two is the *InstaPay Invoice
 *     No.* — the payer saw `6991560`, and our BDO record read
 *     `GXCHPHM2XXXB00000000` + `6991560`. Match on `instapay_invoice`.
 *
 * So on a BDO payment the prominent "Ref No." is a DECOY: it looks like the
 * answer and is useless for reconciliation. We return every candidate tagged
 * with its kind and let the caller prefer by channel, rather than guessing.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * This is a TRANSCRIPTION aid, never evidence. A screenshot is a picture and
 * pictures are forged in seconds; nothing here may gate an approval on its own.
 */

export type ProofReferenceKind = 'reference' | 'instapay_invoice';

export type ProofReference = {
  /** Normalised — spaces and dashes stripped, upper-cased. */
  value: string;
  kind: ProofReferenceKind;
  /** The label as it appeared, for showing the couple what we read. */
  label: string;
};

export type PaymentProofScan = {
  references: ProofReference[];
  /** Every peso figure on the receipt, de-duplicated, ascending. */
  amounts: number[];
  /**
   * Does `expectedPhp` appear among the amounts?
   *
   *   true  — found it; the couple paid the right figure
   *   false — read amounts, and the expected one is NOT among them
   *   null  — read NO amounts at all, so we cannot judge either way
   *
   * The null case is deliberate and load-bearing. "I could not read this" and
   * "this is wrong" are different facts, and collapsing them would show a
   * scary mismatch warning to someone whose receipt merely OCR'd badly.
   */
  matchesExpected: boolean | null;
};

/** Strip the grouping GCash renders into references ("0043 457 367694"). */
function normalise(raw: string): string {
  return raw.replace(/[\s\-–—]/g, '').toUpperCase();
}

// A reference is 6–32 chars of A–Z/0–9, optionally grouped by spaces or dashes.
// Bounded on both sides so a run of prose cannot be swallowed whole.
const REF_BODY = '([A-Z0-9][A-Z0-9\\s\\-]{4,40}?)';

const PATTERNS: { re: RegExp; kind: ProofReferenceKind; label: string }[] = [
  // Most specific first — "InstaPay Invoice No." would otherwise be eaten by
  // the generic reference matcher and mis-tagged.
  {
    re: new RegExp(`instapay\\s*invoice\\s*(?:no\\.?|number|#)?\\s*[:.]?\\s*${REF_BODY}(?=\\s*$|\\s{2,}|\\n)`, 'gim'),
    kind: 'instapay_invoice',
    label: 'InstaPay Invoice No.',
  },
  {
    re: new RegExp(`\\bref(?:erence)?\\.?\\s*(?:no\\.?|number|#)?\\s*[:.]?\\s*${REF_BODY}(?=\\s*$|\\s{2,}|\\n)`, 'gim'),
    kind: 'reference',
    label: 'Reference number',
  },
];

/** A plausible reference: long enough, and not obviously a date or a word. */
function plausibleReference(value: string): boolean {
  if (value.length < 6 || value.length > 32) return false;
  // Must carry at least 5 digits — every PH wallet reference does, and this
  // rejects captured prose like "SENTVIAGCASH".
  const digits = (value.match(/\d/g) ?? []).length;
  return digits >= 5;
}

/**
 * Peso amounts. Matches `PHP 2.17`, `₱12.17`, `+ PHP 2.17`, `1,234.56` and the
 * bare `2.17` that GCash prints beside "Transfer Amount".
 *
 * Two decimals are REQUIRED, which is what keeps dates and times out: `03:00`
 * has a colon, and `Jul 31, 2026` has no decimal point.
 */
function extractAmounts(text: string): number[] {
  const out = new Set<number>();
  const re = /(?:php|₱|p)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const captured = m[1];
    if (!captured) continue;
    const n = Number(captured.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0 && n < 10_000_000) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Scan OCR'd receipt text.
 *
 * @param text        whatever the OCR engine produced
 * @param expectedPhp the order's gross, when known — enables the amount check
 */
export function scanPaymentProof(
  text: string,
  expectedPhp?: number,
): PaymentProofScan {
  const references: ProofReference[] = [];
  const seen = new Set<string>();

  for (const { re, kind, label } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = normalise(m[1] ?? '');
      if (!plausibleReference(value) || seen.has(value)) continue;
      seen.add(value);
      references.push({ value, kind, label });
    }
  }

  const amounts = extractAmounts(text);

  let matchesExpected: boolean | null = null;
  if (expectedPhp != null && Number.isFinite(expectedPhp) && amounts.length > 0) {
    // Compare in centavos — 2999.43 as a float is not reliably equal to itself
    // after a parse round-trip.
    const wanted = Math.round(expectedPhp * 100);
    matchesExpected = amounts.some((a) => Math.round(a * 100) === wanted);
  }

  return { references, amounts, matchesExpected };
}

/**
 * Do two references describe the same transaction?
 *
 * Used to compare what the COUPLE submitted at checkout against what the ADMIN
 * copied out of their own bank/GCash app. Those are independent sources, which
 * is what makes agreement meaningful — either one alone is just a claim.
 *
 * Two shapes, both from live transfers on 2026-07-31:
 *   • GCash → GCash — payer and recipient see the IDENTICAL reference, so
 *     equality is enough.
 *   • Any bank → BDO — our BDO reference ENDS WITH the payer's InstaPay
 *     invoice number (`GXCHPHM2XXXB00000000` + `6991560`). Equality alone
 *     would miss every cross-rail payment; `endsWith` is the rule that works.
 *
 * ⚠ Agreement is CORROBORATION, never proof of receipt. The couple's half is
 * self-reported and a screenshot is a picture. This may rank a match; it may
 * not approve one.
 */
export function referencesAgree(a: string, b: string): boolean {
  const x = a.replace(/[\s\-–—]/g, '').toUpperCase();
  const y = b.replace(/[\s\-–—]/g, '').toUpperCase();
  // Below 6 characters a token is short enough to agree with things it has
  // nothing to do with — a 4-digit tail matches roughly one in ten thousand
  // references by chance, which is far too loose to surface as a match.
  if (x.length < 6 || y.length < 6) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

/**
 * The reference to pre-fill, given the rail the couple used.
 *
 * BDO is reached over InstaPay, where only the invoice number appears on both
 * sides — see the header note. GCash-to-GCash shares the reference itself.
 * Falls back to whatever else was found rather than returning nothing.
 */
export function preferredReference(
  scan: PaymentProofScan,
  channel: 'gcash' | 'bdo',
): ProofReference | null {
  const wanted: ProofReferenceKind =
    channel === 'bdo' ? 'instapay_invoice' : 'reference';
  return (
    scan.references.find((r) => r.kind === wanted) ?? scan.references[0] ?? null
  );
}
