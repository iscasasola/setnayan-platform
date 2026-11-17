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

// Where a reference ENDS. GCash prints the reference and the date on ONE line
// ("Ref No. 4012345678901 Nov 16, 2026 8:10 PM"), so "end of line" alone found
// nothing on every GCash-layout receipt (live fault, 2026-11-17). The body is
// lazy, so it stops at the FIRST of:
//   • end of line, a newline, or a run of 2+ spaces (the original rules);
//   • a space then a word of letters only — "Nov", "PHP", "Sent" — which no
//     reference group is (grouped references are "0043 457 367694");
//   • a space then a time or numeric date — "8:10", "16/11/2026", "2026-11-16";
//   • any character a reference cannot contain — ",", "₱", "(", "|".
const REF_END =
  '(?=\\s*$|\\s{2,}|\\n|\\s+[A-Z]{2,}(?![A-Z0-9])|\\s+\\d{1,4}[/:.]\\d|\\s+\\d{4}-\\d{2}-\\d{2}|\\s*[^A-Z0-9\\s\\-])';

const PATTERNS: { re: RegExp; kind: ProofReferenceKind; label: string }[] = [
  // Most specific first — "InstaPay Invoice No." would otherwise be eaten by
  // the generic reference matcher and mis-tagged.
  {
    re: new RegExp(`instapay\\s*invoice\\s*(?:no\\.?|number|#)?\\s*[:.]?\\s*${REF_BODY}${REF_END}`, 'gim'),
    kind: 'instapay_invoice',
    label: 'InstaPay Invoice No.',
  },
  {
    re: new RegExp(`\\bref(?:erence)?\\.?\\s*(?:no\\.?|number|#)?\\s*[:.]?\\s*${REF_BODY}${REF_END}`, 'gim'),
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

/* ────────────────────────────────────────────────────────────────────────────
 * WHEN THE TRANSFER WAS MADE — the date and clock time printed on the receipt.
 *
 * ⚖ Owner 2026-11-17, verbatim: *"the don't have to type. we detect after they
 * sent it and log the data for the admin to send his counterpart screenshot"*.
 * The admin matches a payment against the bank's OWN record, which is keyed by
 * amount and time; reading the time off the payer's picture is what lets the
 * payer type nothing.
 *
 * Shapes seen on Philippine receipts:
 *   GCash   "Nov 17, 2026 3:04 PM"           (month name first, 12-hour)
 *   BDO     "17 Nov 2026 15:04:22"           (day first, 24-hour)
 *   others  "2026-11-17 15:04" · "11/17/2026 03:04 PM"
 *
 * ⚠ ADVISORY LIKE EVERYTHING HERE. A date that cannot be read is NULL, never a
 * guess (and never "today"): a wrong date on the admin's card is worse than none.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ReceiptPaidAt = {
  /** `YYYY-MM-DD`, or null when no real calendar date was printed. */
  date: string | null;
  /** `HH:MM` or `HH:MM:SS`, 24-hour, as printed (Manila wall time), or null. */
  time: string | null;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

function isoDate(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null; // 31 Feb is not a date
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

/** The first real calendar date printed on the receipt, in reading order. */
function extractDate(text: string): string | null {
  type Hit = { at: number; iso: string | null };
  const hits: Hit[] = [];
  const add = (re: RegExp, f: (m: RegExpExecArray) => string | null) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) hits.push({ at: m.index, iso: f(m) });
  };
  // "Nov 17, 2026" / "November 17 2026"
  add(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi'), (m) =>
    isoDate(Number(m[3]), monthIndex(m[1]!), Number(m[2])),
  );
  // "17 Nov 2026" / "17-Nov-2026"
  add(new RegExp(`\\b(\\d{1,2})[\\s\\-]+${MONTH_RE}[\\s\\-,]+(\\d{4})\\b`, 'gi'), (m) =>
    isoDate(Number(m[3]), monthIndex(m[2]!), Number(m[1])),
  );
  // "2026-11-17"
  add(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => isoDate(Number(m[1]), Number(m[2]), Number(m[3])));
  // "11/17/2026" — month first, as PH banking apps print it; day first only
  // when the first number cannot be a month.
  add(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m) => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a > 12 ? isoDate(Number(m[3]), b, a) : isoDate(Number(m[3]), a, b);
  });
  hits.sort((x, y) => x.at - y.at);
  return hits.find((h) => h.iso)?.iso ?? null;
}

/** The first clock time printed on the receipt, normalised to 24-hour. */
function extractTime(text: string): string | null {
  const re = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*(m\.?)?(?![a-z])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const sec = m[3] == null ? null : Number(m[3]);
    const ap = m[4] && m[5] ? m[4].toLowerCase() : null;
    if (min > 59 || (sec != null && sec > 59)) continue;
    if (ap) {
      if (h < 1 || h > 12) continue;
      if (ap === 'p' && h !== 12) h += 12;
      if (ap === 'a' && h === 12) h = 0;
    } else if (h > 23) continue;
    const hh = String(h).padStart(2, '0');
    const mm = String(min).padStart(2, '0');
    return sec == null ? `${hh}:${mm}` : `${hh}:${mm}:${String(sec).padStart(2, '0')}`;
  }
  return null;
}

/** Read when the transfer was made off a transcribed receipt. Never throws. */
export function extractReceiptPaidAt(text: string): ReceiptPaidAt {
  return { date: extractDate(text), time: extractTime(text) };
}
