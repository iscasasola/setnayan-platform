/**
 * lib/receipt-read-on-phone.ts — read ONE buyer receipt on the buyer's phone and
 * turn it into the four fields they confirm (amount · date · time · reference).
 *
 * Reached ONLY through a dynamic `import()` from
 * `app/_components/payment/receipt-read-fields.tsx`, so neither Tesseract nor
 * the parser lands in /pay's or the checkout drawer's first-load bundle.
 *
 * The reader is the shared one (lib/on-phone-reader.ts, from #7924) and the
 * parser is the shared one (lib/payment-receipt-read.ts → payment-proof-scan).
 * Nothing is forked. ⛔ Advisory only: nothing here approves money.
 */
import { readOnePictureOnThisPhone, warmOnPhoneReader } from '@/lib/on-phone-reader';

/** Start the engine download as soon as the proof step is on screen. */
export const warmReceiptReader = warmOnPhoneReader;
import { prefillFromReceipt, type ReceiptPrefill } from '@/lib/payment-receipt-read';

export type BuyerReceiptRead = {
  status: 'ok' | 'failed';
  /** The transcript, posted for the server to parse again — never stored. */
  text: string;
  /** Wall time on THIS phone, reader load included. */
  ms: number;
  prefill: ReceiptPrefill;
};

const NOTHING: ReceiptPrefill = { amountPhp: null, paidOn: null, paidTime: null, reference: null };

export async function readReceiptOnThisPhone(
  picture: File | Blob,
  expectedPhp: number | null,
  channel: string | null,
): Promise<BuyerReceiptRead> {
  const read = await readOnePictureOnThisPhone(picture);
  if (read.status === 'failed') return { status: 'failed', text: '', ms: read.ms, prefill: NOTHING };
  return {
    status: 'ok',
    text: read.text,
    ms: read.ms,
    prefill: prefillFromReceipt({ transcript: read.text, expectedPhp, channel }),
  };
}
