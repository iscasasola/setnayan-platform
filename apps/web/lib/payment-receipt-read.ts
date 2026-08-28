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
 * Pure and dependency-free so every rule below can be tested without a network,
 * a database or a key.
 */

import { scanPaymentProof } from '@/lib/payment-proof-scan';
import {
  compareReferences,
  normalizeReference,
  MIN_CONTAINMENT_LENGTH,
} from '@/lib/payment-reference-match';

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
 * Read a transcribed receipt.
 *
 * @param transcript  whatever the model typed out (or a sentinel)
 * @param typed       the reference the buyer entered on the pay page
 * @param expectedPhp what the order owes, when known
 */
export function readPaymentReceipt(args: {
  transcript: string;
  typed: string | null | undefined;
  expectedPhp: number | null;
}): PaymentReceiptRead {
  const text = args.transcript.trim();

  if (text === '' || text.toUpperCase() === UNREADABLE) {
    return {
      status: 'unreadable',
      referenceMatches: null,
      amountMatches: null,
      seenReferences: [],
      seenAmounts: [],
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
      summary: 'That picture does not look like a payment receipt. Open it yourself.',
      error: null,
    };
  }

  const scan = scanPaymentProof(text, args.expectedPhp ?? undefined);
  const seenReferences = scan.references.map((r) => r.value);
  const { matches, reason } = referenceVerdict(args.typed, seenReferences);

  return {
    status: 'ok',
    referenceMatches: matches,
    amountMatches: scan.matchesExpected,
    seenReferences,
    seenAmounts: scan.amounts,
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
