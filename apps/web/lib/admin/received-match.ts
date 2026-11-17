/**
 * lib/admin/received-match.ts — what a RECEIVED screenshot from our own BDO app
 * says, and which waiting buyer payments it could be.
 *
 * Owner 2026-11-17 (DECISION_LOG "ADMIN PAYMENT VERIFY — BATCH OF RECEIVED
 * SCREENSHOTS"; drawn in specs prototypes/admin_payment_verify_2026-11-17/):
 * the admin drops many screenshots at once, each becomes one received row, and
 * every row is shown beside the buyer payments it could settle.
 *
 * Pure string + number work — no model, no database — so the fixtures in the
 * test file are the contract. The model only TRANSCRIBES (lib/payment-receipt-
 * read.server.ts); everything below is plain code deciding what the text says.
 *
 * ⛔ PHASE 1 MATCHES NOTHING BY ITSELF. {@link AUTO_MATCH_ENABLED} is false and
 * no caller in this PR reads `strong` to write anything: a strong candidate is
 * drawn FIRST and labelled, and the admin presses Match. Auto-match ships with
 * the BDO pay flow, whose buyer side carries the whole reference, behind the
 * owner's 30-minute hold (owner 2026-11-17: "Hold 30 min, then pay" · "Wait for
 * the BDO pay flow").
 */
import { scanPaymentProof } from '@/lib/payment-proof-scan';
import { normalizeReference, MIN_CONTAINMENT_LENGTH } from '@/lib/payment-reference-match';
import { NOT_A_RECEIPT, UNREADABLE } from '@/lib/payment-receipt-read';

/** Off until the BDO pay flow + 30-minute hold ship (phase 2). */
export const AUTO_MATCH_ENABLED = false;

export type ReceivedRead = {
  reference: string | null;
  referenceNorm: string | null;
  amountPhp: number | null;
  /** ISO string, Manila time read off the picture. NULL when none was shown. */
  receivedAt: string | null;
  readStatus: 'read' | 'unreadable';
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "10:42 PM" / "22:42" / "10:42:07 am" → [hour24, minute] or null. */
function readClock(raw: string | undefined): [number, number] | null {
  if (!raw) return null;
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return [h, min];
}

function manilaIso(y: number, mo: number, d: number, clock: [number, number] | null): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2020 || y > 2100) return null;
  const [h, mi] = clock ?? [0, 0];
  const iso = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+08:00`;
  return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
}

/**
 * The on-phone reader (Tesseract) misreads a zero as the letter O inside long
 * digit runs — measured 2026-11-17 on a drawn BDO screen: "B000…" came back
 * "B0O00…". An O touching a digit is read as 0. Only the received side is
 * fixed; it can only make a true suffix match visible, never invent one, and
 * the admin still presses Match.
 */
export function ocrDigitFix(norm: string): string {
  return norm.replace(/O(?=\d)|(?<=\d)O/g, '0');
}

/**
 * The date + time a bank screen prints. Manila time, because that is the only
 * clock our BDO app shows. Handles the shapes BDO and InstaPay use:
 *   "Nov 17, 2026 10:42 AM" · "17 Nov 2026, 22:42" · "11/17/2026 10:42 AM" ·
 *   "2026-11-17 10:42".
 * Returns NULL rather than guessing — a wrong time could pass the
 * "received before the order" check that is there to catch a reused picture.
 */
export function readReceivedTime(text: string): string | null {
  const time = '((?:\\s*,?\\s*(?:at\\s+)?)\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:am|pm)?)?';
  let m = new RegExp(`\\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]{0,6})\\.?\\s+(\\d{1,2})\\s*,?\\s*(\\d{4})${time}`, 'i').exec(text);
  if (m && MONTHS[m[1]!.slice(0, 3).toLowerCase()]) {
    return manilaIso(Number(m[3]), MONTHS[m[1]!.slice(0, 3).toLowerCase()]!, Number(m[2]), readClock(m[4]));
  }
  m = new RegExp(`\\b(\\d{1,2})\\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]{0,6})\\.?,?\\s+(\\d{4})${time}`, 'i').exec(text);
  if (m && MONTHS[m[2]!.slice(0, 3).toLowerCase()]) {
    return manilaIso(Number(m[3]), MONTHS[m[2]!.slice(0, 3).toLowerCase()]!, Number(m[1]), readClock(m[4]));
  }
  m = new RegExp(`\\b(\\d{4})-(\\d{2})-(\\d{2})${time}`, 'i').exec(text);
  if (m) return manilaIso(Number(m[1]), Number(m[2]), Number(m[3]), readClock(m[4]));
  // Month first: BDO and PH phones print US-order numeric dates.
  m = new RegExp(`\\b(\\d{1,2})/(\\d{1,2})/(\\d{4})${time}`, 'i').exec(text);
  if (m) return manilaIso(Number(m[3]), Number(m[1]), Number(m[2]), readClock(m[4]));
  return null;
}

/**
 * One received screenshot's transcript → one received row.
 *
 * Reference: the LONGEST one found. On our side the BDO record is the long
 * `GXCHPHM2XXXB0000…` + invoice string, and the short codes beside it are not
 * what links the two sides.
 *
 * Amount: kept only when the picture shows exactly ONE peso figure. Two
 * figures (amount and balance, say) is a guess we do not make; NULL draws as
 * "amount not read" and matches nothing.
 */
export function readReceivedTranscript(transcript: string): ReceivedRead {
  const t = transcript.trim();
  const empty: ReceivedRead = {
    reference: null,
    referenceNorm: null,
    amountPhp: null,
    receivedAt: null,
    readStatus: 'unreadable',
  };
  if (t === '' || t === NOT_A_RECEIPT || t === UNREADABLE) return empty;

  const scan = scanPaymentProof(t);
  const longest = [...scan.references].sort((a, b) => b.value.length - a.value.length)[0];
  const reference = longest?.value ?? null;
  const amountPhp = scan.amounts.length === 1 ? scan.amounts[0]! : null;
  const receivedAt = readReceivedTime(t);
  if (reference === null && amountPhp === null) return { ...empty, receivedAt };
  return {
    reference,
    referenceNorm: reference ? ocrDigitFix(normalizeReference(reference)) : null,
    amountPhp,
    receivedAt,
    readStatus: 'read',
  };
}

export type WaitingPayment = {
  payment_id: string;
  amount_php: number;
  /** What the buyer typed — often only the last digits. */
  reference_number: string | null;
  /** When the ORDER was placed (ISO). */
  order_created_at: string | null;
  label: string;
};

export type ReceivedRow = {
  reference_norm: string | null;
  amount_php: number | null;
  received_at: string | null;
};

export type Candidate = {
  payment: WaitingPayment;
  /** Plain reasons, in the order the admin reads them. */
  reasons: string[];
  /** The transfer arrived BEFORE the order existed — a reused picture, or not theirs. */
  receivedBeforeOrder: boolean;
  /**
   * Whole reference (or the full BDO invoice suffix, ruled the same) + exact
   * centavos + arrived after the order. Drawn first; NEVER acted on in phase 1.
   */
  strong: boolean;
};

const cents = (n: number) => Math.round(n * 100);

/**
 * Does the buyer's reference name this transfer as a WHOLE reference?
 * Equal, or our BDO record ENDS WITH it (the InstaPay invoice — ruled to count
 * as the whole reference). A short typed tail never counts.
 */
export function referenceNamesTransfer(receivedNorm: string | null, typed: string | null): boolean {
  const y = normalizeReference(typed);
  if (!receivedNorm || y.length < MIN_CONTAINMENT_LENGTH) return false;
  return receivedNorm === y || receivedNorm.endsWith(y);
}

/**
 * The waiting payments one received row could settle: same amount to the
 * centavo, strong ones first. An unread amount gives no candidates — the admin
 * sees the row and matches from the payment card instead.
 */
export function candidatesFor(row: ReceivedRow, waiting: WaitingPayment[]): Candidate[] {
  if (row.amount_php == null) return [];
  const want = cents(row.amount_php);
  const out: Candidate[] = [];
  for (const p of waiting) {
    if (cents(p.amount_php) !== want) continue;
    const refHit = referenceNamesTransfer(row.reference_norm, p.reference_number);
    const tail = normalizeReference(p.reference_number);
    const tailHit =
      !refHit && tail.length > 0 && !!row.reference_norm && row.reference_norm.endsWith(tail);
    const before =
      !!row.received_at &&
      !!p.order_created_at &&
      Date.parse(row.received_at) < Date.parse(p.order_created_at);
    const reasons = ['Same amount'];
    if (refHit) reasons.push('Reference matches');
    else if (tailHit) reasons.push(`Ends in ${tail}`);
    if (before) reasons.push('Arrived before the order was placed');
    out.push({ payment: p, reasons, receivedBeforeOrder: before, strong: refHit && !before });
  }
  return out.sort(
    (a, b) =>
      Number(b.strong) - Number(a.strong) ||
      b.reasons.length - Number(b.receivedBeforeOrder) - (a.reasons.length - Number(a.receivedBeforeOrder)),
  );
}

/**
 * Buyers who say they paid but whose money no received row accounts for —
 * the "not in your BDO screenshots yet" count. A payment counts as accounted
 * for when an OPEN received row carries its amount.
 */
export function waitingWithoutReceived(waiting: WaitingPayment[], open: ReceivedRow[]): WaitingPayment[] {
  const amounts = new Set(open.filter((r) => r.amount_php != null).map((r) => cents(r.amount_php!)));
  return waiting.filter((p) => !amounts.has(cents(p.amount_php)));
}
