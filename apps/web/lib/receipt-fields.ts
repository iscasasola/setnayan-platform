/**
 * lib/receipt-fields.ts — the names the receipt-read fields are POSTED under.
 * Dependency-free on purpose: the buyer's form imports it statically, and
 * anything heavier would land in /pay's first-load bundle (the reader and the
 * parser load only on the proof step — lib/receipt-read-on-phone.ts).
 */

/** The form field names, in one place so the form and the action agree. */
export const RECEIPT_FIELDS = {
  /** 'ok' | 'failed' — absent when the reader never ran (no JS, or sent first). */
  status: 'receipt_read',
  /** The on-phone transcript. Parsed on the server, NEVER stored. */
  text: 'receipt_text',
  amount: 'paid_amount',
  paidOn: 'paid_on',
  paidTime: 'paid_time',
  reference: 'paid_reference',
  /** Which of the four the BUYER changed: a comma list of amount,paidOn,paidTime,reference. */
  touched: 'receipt_touched',
} as const;

export type ReceiptFieldKey = 'amount' | 'paidOn' | 'paidTime' | 'reference';

/**
 * 🚦 WHO READS A BUYER'S RECEIPT — ONE SWITCH, AND IT IS OFF.
 *
 * OFF (the default): the EXISTING reader — the server reads the uploaded
 * screenshot (`lib/payment-receipt-read.server.ts`), exactly as before this PR.
 * A 17 Nov 2026 ruling says buyer receipts "keep the existing reader".
 *
 * ON: the buyer's phone reads the picture (Tesseract.js, `lib/on-phone-reader.ts`),
 * fills amount · date · time · reference for them to correct, and posts only the
 * TEXT; the admin's "Read it again" reads on the admin's phone too. Nothing is
 * sent to an outside AI for a buyer receipt.
 *
 * ⛔ The owner has NOT ruled on swapping the buyer receipt reader. Do not flip
 * this without his answer — and flipping it also needs the privacy notice and
 * the Anthropic subprocessor entry reworded (they describe the OFF state).
 * Dependency-free on purpose: the buyer's form and the server actions both read it.
 */
export const BUYER_RECEIPTS_READ_ON_PHONE = false;
