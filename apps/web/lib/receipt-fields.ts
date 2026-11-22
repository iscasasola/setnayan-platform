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
