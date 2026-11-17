/**
 * lib/payment-receipt-read.ts — turn a transcribed payment screenshot into the
 * one answer an admin wants: is the number this buyer typed actually on their
 * receipt, and is the amount right?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 THE MODEL TRANSCRIBES; THIS FILE DECIDES. That split is the whole design.
 *
 * The model is asked exactly one thing — "type out the words and numbers you
 * can see" — and is never asked whether anything matches. A model asked "does
 * 884213 appear on this receipt?" will sometimes answer yes when it does not,
 * and on a money screen that is the expensive direction to be wrong in. A model
 * asked to read aloud hands back TEXT, and the matching is then done here by
 * `scanPaymentProof` and `compareReferences` — both already shipped, both pure,
 * both covered by tests carrying real GCash and BDO receipts.
 *
 * So nothing in this file trusts the model's judgement, because it never asks
 * for any. Adding "and tell me if it matches" to the prompt would quietly move
 * the decision back into the model and undo this.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ ADVISORY, ALWAYS. Nothing here approves, rejects or promotes a payment.
 * The one-person admin plan (2026-07-11) binds it: the machine may prepare and
 * may hold back, it may never be the thing that lets money through.
 * `isDecisivePaymentMatch` — the predicate gating one-click approval — does not
 * import this module and must not start.
 *
 * ⚠ AND AGREEMENT PROVES LESS THAN IT LOOKS LIKE IT PROVES: that the buyer
 * copied their own receipt correctly. Not that money arrived. A screenshot is a
 * picture and pictures are made in seconds. Only the bank's own message settles
 * it, and an admin still opens it.
 *
 * 🔁 WHO TRANSCRIBES NOW (owner 17 Nov 2026, "Yes, swap it in"): the ON-PHONE
 * reader, Tesseract.js (lib/on-phone-reader.ts). The buyer's screenshot is read
 * on the buyer's own phone and only the TEXT is posted; no outside AI sees it.
 * The split above is unchanged — the reader transcribes, this file decides —
 * and so is every rule below. `RECEIPT_TRANSCRIBE_PROMPT` remains only for the
 * verification-paper reader, which still shares the old model seam.
 *
 * Pure and dependency-free so every rule below can be tested without a network,
 * a database or a key.
 */

import {
  scanPaymentProof,
  extractReceiptPaidAt,
  preferredReference,
  ocrDigitFix,
} from '@/lib/payment-proof-scan';
import {
  compareReferences,
  normalizeReference,
  MIN_CONTAINMENT_LENGTH,
} from '@/lib/payment-reference-match';
import { RECEIPT_FIELDS, type ReceiptFieldKey } from '@/lib/receipt-fields';

/**
 * What we ask the model for. Transcription only — no judgement, no summarising,
 * no "helpful" reformatting of a reference number into something tidier.
 *
 * 🔑 "VERBATIM, INCLUDING SPACING" IS LOAD-BEARING. GCash prints its reference
 * grouped ("0043 457 367694") and `scanPaymentProof` reads the label-then-value
 * shape off the line. A model that helpfully strips the label ("Ref No.") or
 * re-flows the columns hands the parser text it cannot match, and the failure
 * looks exactly like a receipt with no reference on it.
 */
export const RECEIPT_TRANSCRIBE_PROMPT = [
  'Transcribe this image. Write out every line of text you can see, in the order',
  'it appears, keeping each label together with its value on the same line',
  '(for example: "Ref No. 0043 457 367694").',
  '',
  'Rules:',
  '- Copy numbers and reference codes EXACTLY, including spaces and dashes.',
  '- Do not correct, tidy, reformat or explain anything.',
  '- Do not say whether anything matches or looks right. That is not your job.',
  '- If the image is not a payment or transfer receipt, reply with exactly:',
  '  NOT_A_RECEIPT',
  '- If you cannot make out the text at all, reply with exactly: UNREADABLE',
].join('\n');

/** The sentinels the prompt above asks for, so the caller and the tests agree. */
export const NOT_A_RECEIPT = 'NOT_A_RECEIPT';
export const UNREADABLE = 'UNREADABLE';

export type ReceiptReadStatus = 'ok' | 'unreadable' | 'failed';

export type PaymentReceiptRead = {
  status: ReceiptReadStatus;
  /**
   * Did the digits the buyer typed appear in a reference on the picture?
   *
   * 🔑 NULL IS A REAL ANSWER AND IS NOT THE SAME AS FALSE. FALSE renders on
   * screen as "that number is not on their receipt" — an accusation about a
   * person — so it is only ever set when we genuinely read references and the
   * typed one was not among them. Blurry picture, nothing typed, or a typed
   * value too short to compare all give NULL.
   */
  referenceMatches: boolean | null;
  /** Same discipline: NULL when no peso figure could be read, or none is owed. */
  amountMatches: boolean | null;
  seenReferences: string[];
  seenAmounts: number[];
  /**
   * The ONE reference to log on the payment when the payer typed none (owner
   * 2026-11-17: "the don't have to type") — the rail's own matching key, so on
   * BDO the InstaPay invoice number before the decoy "Ref No." (see
   * `preferredReference`). NULL when none was read. Advisory: it is a lookup
   * key for the admin, never a verdict.
   */
  readReference: string | null;
  /** The transfer date on the receipt, `YYYY-MM-DD`, or NULL. */
  seenPaidOn: string | null;
  /** The transfer clock time on the receipt, `HH:MM[:SS]` 24-hour, or NULL. */
  seenPaidTime: string | null;
  /** One plain sentence for the admin. */
  summary: string;
  error: string | null;
};

/**
 * Compare the typed value against everything the receipt showed.
 *
 * 🪤 THE TRAP THIS EXISTS TO AVOID. `compareReferences` refuses to judge a
 * string shorter than {@link MIN_CONTAINMENT_LENGTH} (6) — short codes collide
 * by accident, and a false accusation on a money screen costs the admin's trust
 * in every later warning. But the pay form's own field accepts FOUR characters
 * (`pattern="[A-Za-z0-9]{4,6}"`), so a buyer who typed four digits would come
 * back 'none' — and reading 'none' as "no match" would print that accusation
 * about somebody the rule had explicitly declined to judge.
 *
 * "Too short to compare" is therefore NULL, not FALSE. It is the same
 * distinction `scanPaymentProof.matchesExpected` already draws, one level up.
 */
function referenceVerdict(
  typed: string | null | undefined,
  seen: string[],
): { matches: boolean | null; reason: 'none-typed' | 'too-short' | 'no-refs' | 'compared' } {
  const needle = normalizeReference(typed);
  if (needle === '') return { matches: null, reason: 'none-typed' };
  if (needle.length < MIN_CONTAINMENT_LENGTH) return { matches: null, reason: 'too-short' };
  if (seen.length === 0) return { matches: null, reason: 'no-refs' };
  const hit = seen.some((s) => compareReferences(needle, s) !== 'none');
  return { matches: hit, reason: 'compared' };
}

/** Peso, the way the rest of the console writes it. */
function php(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The sentence the admin reads.
 *
 * Plain English, and it never overstates: the strongest thing it is allowed to
 * say is that the number the buyer typed is on their receipt — never that the
 * payment is good, confirmed, verified or received.
 */
export function summariseReceiptRead(args: {
  referenceMatches: boolean | null;
  referenceReason: 'none-typed' | 'too-short' | 'no-refs' | 'compared';
  amountMatches: boolean | null;
  typed: string | null | undefined;
  seenReferences: string[];
  seenAmounts: number[];
  expectedPhp: number | null;
}): string {
  const parts: string[] = [];

  if (args.referenceMatches === true) {
    parts.push(`The number they typed is on the receipt (${args.seenReferences[0]}).`);
  } else if (args.referenceMatches === false) {
    parts.push(
      args.seenReferences.length === 1
        ? `The receipt shows ${args.seenReferences[0]}, which is not what they typed.`
        : `The receipt shows ${args.seenReferences.join(' and ')} — none of them is what they typed.`,
    );
  } else if (args.referenceReason === 'none-typed') {
    parts.push(
      args.seenReferences.length > 0
        ? `They typed no reference. The receipt shows ${args.seenReferences.join(' and ')}.`
        : 'They typed no reference, and none could be read off the picture.',
    );
  } else if (args.referenceReason === 'too-short') {
    parts.push('They typed too few characters to check against the receipt.');
  } else {
    parts.push('No reference number could be read off the picture.');
  }

  if (args.amountMatches === true && args.expectedPhp != null) {
    parts.push(`The amount on it matches the ${php(args.expectedPhp)} owed.`);
  } else if (args.amountMatches === false && args.expectedPhp != null) {
    parts.push(
      args.seenAmounts.length > 0
        ? `The receipt shows ${args.seenAmounts.map(php).join(', ')} — none of them is the ${php(args.expectedPhp)} owed.`
        : `No amount on it matches the ${php(args.expectedPhp)} owed.`,
    );
  }

  // ⚠ NEVER TRIMMED, EVEN WHEN IT READS AS BOILERPLATE. Without it the card
  // above the approve button says "the number they typed is on the receipt" and
  // full stop, which an admin under time pressure reads as "this is confirmed".
  // It is the only sentence on the card that says what this is NOT.
  parts.push('Still check your bank app — a screenshot is not proof the money arrived.');

  return parts.join(' ');
}

/**
 * Read a transcribed receipt — the references, the amounts, and (owner
 * 2026-11-17) the date and time of the transfer, so the payer types nothing.
 *
 * @param transcript  whatever the model typed out (or a sentinel)
 * @param typed       the reference the buyer entered on the pay page
 * @param expectedPhp what the order owes, when known
 */
export function readPaymentReceipt(args: {
  transcript: string;
  typed: string | null | undefined;
  expectedPhp: number | null;
  /** The rail it was paid to — picks which reference is the matching key. Default BDO. */
  channel?: string | null;
  /**
   * TRUE when the transcript came from the on-phone reader, which reads a zero
   * as the letter O inside digit runs — `ocrDigitFix` is applied to every
   * reference it found. Never applied to free text.
   */
  ocr?: boolean;
}): PaymentReceiptRead {
  const text = args.transcript.trim();

  if (text === '' || text.toUpperCase() === UNREADABLE) {
    return {
      status: 'unreadable',
      referenceMatches: null,
      amountMatches: null,
      seenReferences: [],
      seenAmounts: [],
      readReference: null,
      seenPaidOn: null,
      seenPaidTime: null,
      summary: 'The picture could not be read. Open it yourself.',
      error: null,
    };
  }

  if (text.toUpperCase() === NOT_A_RECEIPT) {
    return {
      status: 'unreadable',
      referenceMatches: null,
      amountMatches: null,
      seenReferences: [],
      seenAmounts: [],
      readReference: null,
      seenPaidOn: null,
      seenPaidTime: null,
      summary: 'That picture does not look like a payment receipt. Open it yourself.',
      error: null,
    };
  }

  const raw = scanPaymentProof(text, args.expectedPhp ?? undefined);
  const scan = args.ocr
    ? { ...raw, references: raw.references.map((r) => ({ ...r, value: ocrDigitFix(r.value) })) }
    : raw;
  const seenReferences = scan.references.map((r) => r.value);
  const { matches, reason } = referenceVerdict(args.typed, seenReferences);
  const paidAt = extractReceiptPaidAt(text);

  return {
    status: 'ok',
    referenceMatches: matches,
    amountMatches: scan.matchesExpected,
    seenReferences,
    seenAmounts: scan.amounts,
    // Every payment enters BDO (owner 2026-11-17), so BDO's key leads.
    readReference: preferredReference(scan, args.channel === 'gcash' ? 'gcash' : 'bdo')?.value ?? null,
    seenPaidOn: paidAt.date,
    seenPaidTime: paidAt.time,
    summary: summariseReceiptRead({
      referenceMatches: matches,
      referenceReason: reason,
      amountMatches: scan.matchesExpected,
      typed: args.typed,
      seenReferences,
      seenAmounts: scan.amounts,
      expectedPhp: args.expectedPhp,
    }),
    error: null,
  };
}

/**
 * The shape the admin card renders. Kept here so the tone rules above travel
 * with the words rather than living in JSX.
 */
export type ReceiptReadTone = 'agrees' | 'disagrees' | 'unknown';

export function receiptReadTone(read: {
  status: ReceiptReadStatus;
  referenceMatches: boolean | null;
  amountMatches: boolean | null;
}): ReceiptReadTone {
  if (read.status !== 'ok') return 'unknown';
  // 🔑 ONE DISAGREEMENT IS ENOUGH TO DROP THE TONE. A receipt whose reference
  // matches but whose amount does not is the shape of a screenshot pasted from
  // a different, smaller transfer — the case worth catching.
  if (read.referenceMatches === false || read.amountMatches === false) return 'disagrees';
  if (read.referenceMatches === true) return 'agrees';
  return 'unknown';
}

/**
 * Should we hand this back to the buyer to fix?
 *
 * Owner, 2026-08-28: *"if the reference code did not match, please type again or
 * upload a cleaner photo."*
 *
 * 🔑 ONLY A DEFINITE NO. `referenceMatches === false` means we read references
 * off the picture and theirs was not among them. Every other outcome —
 * unreadable, not a receipt, no key, timed out, nothing typed, too short to
 * compare — is NULL, and NULL must never send anybody back. Sending a person who
 * has already paid back to the start because our own reader had a bad minute is
 * the one failure this feature could cause that is WORSE THAN THE PROBLEM IT
 * SOLVES, and it is the failure a `!== true` test would produce.
 *
 * ⚠ AND AN AMOUNT MISMATCH DELIBERATELY DOES NOT ASK. Retyping cannot fix a
 * receipt for a different figure, and a part payment is a real thing. That one
 * goes to the admin's card, where a person can look at it.
 */
export function shouldAskBuyerToFix(
  read: { status: ReceiptReadStatus; referenceMatches: boolean | null } | null | undefined,
): boolean {
  return read?.status === 'ok' && read.referenceMatches === false;
}

/* ────────────────────────────────────────────────────────────────────────────
 * THE BUYER'S SIDE OF THE ON-PHONE READ (owner 17 Nov 2026)
 *
 * "Upload Payment Receipt" on /pay (gift store orders included) and in the
 * couple checkout drawer: the picture is read on the buyer's phone, the four
 * fields below are FILLED from it, and the buyer may correct any of them before
 * sending. Then the server re-runs the same pure parser on the posted text for
 * the admin's card, and notes anything the buyer changed.
 *
 * ⛔ STILL ADVISORY. A filled or corrected field is a lookup key beside the
 * admin's own BDO record. Nothing here sets a status.
 * ──────────────────────────────────────────────────────────────────────────── */

/** What the four "we read this" fields start as. NULL = we could not read it. */
export type ReceiptPrefill = {
  amountPhp: number | null;
  /** `YYYY-MM-DD` */
  paidOn: string | null;
  /** `HH:MM` 24-hour */
  paidTime: string | null;
  reference: string | null;
};

/**
 * The peso figure to pre-fill. NEVER A GUESS: the owed amount when it is on the
 * receipt; else the one figure when there is exactly one; else nothing, and
 * the buyer types it. A receipt with an amount, a fee and a total would
 * otherwise pre-fill whichever came first.
 */
function prefillAmount(amounts: number[], expectedPhp: number | null): number | null {
  if (expectedPhp != null && Number.isFinite(expectedPhp)) {
    const wanted = Math.round(expectedPhp * 100);
    const hit = amounts.find((a) => Math.round(a * 100) === wanted);
    if (hit != null) return hit;
  }
  return amounts.length === 1 ? amounts[0]! : null;
}

/**
 * Turn the on-phone transcript into the four fields the buyer sees.
 * Same parser as the admin's card (`readPaymentReceipt`), so what the buyer is
 * shown and what the admin is told can never disagree.
 */
export function prefillFromReceipt(args: {
  transcript: string;
  expectedPhp: number | null;
  channel?: string | null;
}): ReceiptPrefill {
  const read = readPaymentReceipt({
    transcript: args.transcript,
    typed: null,
    expectedPhp: args.expectedPhp,
    channel: args.channel,
    ocr: true,
  });
  return {
    amountPhp: prefillAmount(read.seenAmounts, args.expectedPhp),
    paidOn: read.seenPaidOn,
    // The time field is minutes-only; seconds are dropped, never rounded.
    paidTime: read.seenPaidTime ? read.seenPaidTime.slice(0, 5) : null,
    reference: read.readReference,
  };
}

/* ── What the form posts, and how the server reads it back ─────────────────── */

// The posted field names live in a tiny module (lib/receipt-fields.ts) so the
// FORM can name them without pulling this parser into its first load.
export { RECEIPT_FIELDS, type ReceiptFieldKey };

function touchedFromForm(form: FormData): Set<ReceiptFieldKey> {
  const raw = (form.get(RECEIPT_FIELDS.touched) ?? '').toString();
  const keys: ReceiptFieldKey[] = ['amount', 'paidOn', 'paidTime', 'reference'];
  return new Set(keys.filter((k) => raw.split(',').map((x) => x.trim()).includes(k)));
}

const TEXT_MAX = 4000;

function field(form: FormData, name: string): string | null {
  const v = form.get(name);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** What the buyer left in the four fields — validated, never trusted further. */
export type ReceiptConfirmed = ReceiptPrefill;

/**
 * Read the buyer-confirmed fields off a posted form. Anything malformed is
 * NULL (dropped), never coerced: a bad date is no date.
 */
export function confirmedFromForm(form: FormData): ReceiptConfirmed {
  const amountRaw = field(form, RECEIPT_FIELDS.amount)?.replace(/[₱,\s]|php/gi, '') ?? null;
  const amount = amountRaw != null && /^\d{1,9}(\.\d{1,2})?$/.test(amountRaw) ? Number(amountRaw) : null;
  const on = field(form, RECEIPT_FIELDS.paidOn);
  const at = field(form, RECEIPT_FIELDS.paidTime);
  const ref = field(form, RECEIPT_FIELDS.reference)?.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 64) ?? null;
  const validDate =
    on != null && /^\d{4}-\d{2}-\d{2}$/.test(on) && !Number.isNaN(Date.parse(`${on}T00:00:00Z`)) &&
    new Date(`${on}T00:00:00Z`).toISOString().slice(0, 10) === on;
  return {
    amountPhp: amount != null && amount > 0 ? amount : null,
    paidOn: validDate ? on : null,
    paidTime: at != null && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(at) ? at.slice(0, 5) : null,
    reference: ref && ref.length > 0 ? ref : null,
  };
}

/**
 * The admin's advisory read, from what the buyer's phone posted.
 *
 * Returns NULL when the reader never ran (JavaScript off, or sent before the
 * read finished) — "nobody has read this", exactly as before, and the admin can
 * press Read it. A reader that RAN AND FAILED is a 'failed' read, drawn as a
 * failure, never as an empty receipt.
 *
 * 🔑 THE SERVER PARSES THE TEXT ITSELF. The buyer's four fields are what they
 * confirm; the card says what the picture said. When the two differ the card
 * says so in words, so a corrected field is visible rather than silently
 * replacing what was read.
 */
export function phoneReceiptRead(args: {
  form: FormData;
  /** A reference typed on an old tab (`reference_last6`), never the confirmed one. */
  typed: string | null;
  expectedPhp: number | null;
  channel?: string | null;
}): PaymentReceiptRead | null {
  const status = field(args.form, RECEIPT_FIELDS.status);
  if (status === 'failed') {
    return {
      status: 'failed',
      referenceMatches: null,
      amountMatches: null,
      seenReferences: [],
      seenAmounts: [],
      readReference: null,
      seenPaidOn: null,
      seenPaidTime: null,
      summary: 'The reader on their phone could not run. Open the picture yourself.',
      error: 'on-phone reader failed to load or read',
    };
  }
  if (status !== 'ok') return null;

  const transcript = (args.form.get(RECEIPT_FIELDS.text) ?? '').toString().slice(0, TEXT_MAX);
  const read = readPaymentReceipt({
    transcript,
    typed: args.typed,
    expectedPhp: args.expectedPhp,
    channel: args.channel,
    ocr: true,
  });
  if (read.status !== 'ok') return read;

  const confirmed = confirmedFromForm(args.form);
  const changed = buyerCorrections(read, confirmed, touchedFromForm(args.form), args.expectedPhp);
  if (changed.length === 0) return read;
  // Before the closing "Still check your bank app" sentence, which stays last.
  const tail = 'Still check your bank app';
  const at = read.summary.lastIndexOf(tail);
  const note = `They corrected ${changed.join(', ')}.`;
  return {
    ...read,
    summary: at >= 0 ? `${read.summary.slice(0, at)}${note} ${read.summary.slice(at)}` : `${read.summary} ${note}`,
  };
}

function buyerCorrections(
  read: PaymentReceiptRead,
  c: ReceiptConfirmed,
  touched: Set<ReceiptFieldKey>,
  expectedPhp: number | null,
): string[] {
  const out: string[] = [];
  const pre = {
    amountPhp: prefillAmount(read.seenAmounts, expectedPhp),
    paidOn: read.seenPaidOn,
    paidTime: read.seenPaidTime?.slice(0, 5) ?? null,
    reference: read.readReference,
  };
  // Only a field the buyer actually changed counts — a pre-filled value posted
  // back untouched is the reader's, not a correction (the amount field keeps
  // whole pesos, so ₱2,499.50 posts as 2499 without anybody touching it).
  if (touched.has('reference') && c.reference && c.reference !== pre.reference) out.push(`the reference to ${c.reference}`);
  if (
    touched.has('amount') &&
    c.amountPhp != null &&
    (pre.amountPhp == null || Math.round(c.amountPhp * 100) !== Math.round(pre.amountPhp * 100))
  ) {
    out.push(`the amount to ${php(c.amountPhp)}`);
  }
  if (touched.has('paidOn') && c.paidOn && c.paidOn !== pre.paidOn) out.push(`the date to ${c.paidOn}`);
  if (touched.has('paidTime') && c.paidTime && c.paidTime !== pre.paidTime) out.push(`the time to ${c.paidTime}`);
  return out;
}

/**
 * What to LOG on the payment row: a field the buyer changed wins; otherwise
 * what the reader read. (A read that failed leaves only what they typed.)
 * Advisory lookup keys for the admin — never a status.
 */
export function loggedFromPhone(
  form: FormData,
  read: PaymentReceiptRead | null,
): { reference: string | null; paidOn: string | null } {
  const c = confirmedFromForm(form);
  const touched = touchedFromForm(form);
  return {
    reference: (touched.has('reference') ? c.reference : null) ?? read?.readReference ?? null,
    paidOn: (touched.has('paidOn') ? c.paidOn : null) ?? read?.seenPaidOn ?? null,
  };
}
