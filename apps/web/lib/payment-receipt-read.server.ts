import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { phoneReceiptRead, type PaymentReceiptRead } from '@/lib/payment-receipt-read';
import { ON_PHONE_READER_NAME } from '@/lib/on-phone-reader';

/**
 * lib/payment-receipt-read.server.ts — files what the receipt reader saw.
 *
 * 🔁 NO OUTSIDE AI READS A RECEIPT ANY MORE (owner 17 Nov 2026: *"can we create
 * our own in app reader so we do not need ai to run?"* → *"Yes, swap it in"*).
 * This file used to fetch the buyer's screenshot from R2 and show it to a model.
 * That call is GONE. The screenshot is now read ON THE PHONE that holds it —
 * the buyer's on /pay and in the checkout drawer, the admin's for "Read it
 * again" — by the in-app reader (`lib/on-phone-reader.ts`, Tesseract.js), and
 * only the text is posted; `lib/payment-receipt-read.ts` turns that text into
 * the advisory read. What is left here is the database half.
 *
 * ⛔ NOTHING HERE DECIDES ANYTHING. One advisory row per read. It never touches
 * `payments.status`, never promotes an order, and is not imported by
 * `isDecisivePaymentMatch`. The one-person admin plan (2026-07-11): the machine
 * may prepare and may hold back, it may never be the thing that lets money
 * through.
 */

/**
 * ⚠ NOT A RECEIPT READER ANY MORE. Kept ONLY because the verification-paper
 * reader (`lib/verification-paper-read.server.ts`, `lib/paper-intake.server.ts`)
 * shares this model name and key check; receipts no longer use either. Moving
 * them is that reader's change, not this one.
 */
export const RECEIPT_READ_MODEL = 'claude-sonnet-5';

/** Is the verification-paper model configured? (Receipts never ask.) */
export function receiptReaderConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ReceiptReadRecord = PaymentReceiptRead & { model: string | null };

/**
 * File what was read against a payment row.
 *
 * ⚠ A FAILURE TO WRITE THE ADVICE IS NOT A FAILURE OF THE PAYMENT. Logged and
 * swallowed — throwing here would propagate into the buyer's submit and lose a
 * payment over a note about it.
 */
export async function recordPaymentReceiptRead(
  admin: SupabaseClient,
  paymentId: string,
  read: ReceiptReadRecord,
): Promise<void> {
  const { error } = await admin.from('payment_receipt_reads').insert({
    payment_id: paymentId,
    status: read.status,
    reference_matches: read.referenceMatches,
    amount_matches: read.amountMatches,
    seen_references: read.seenReferences,
    seen_amounts: read.seenAmounts,
    // The date and time on the receipt (owner 2026-11-17) — for the admin to
    // match against the bank's own record. Advisory, like every column here.
    seen_paid_on: read.seenPaidOn,
    seen_paid_time: read.seenPaidTime,
    summary: read.summary,
    error: read.error,
    model: read.model,
  });
  if (error) console.error('payment_receipt_reads insert failed', error.message);
}

/**
 * The admin "Read it again" path: the admin's phone posted the text; parse it
 * and file it, in one call. Goes through this seam so the money-gate file
 * (app/admin/payments/actions.ts) never imports the advisory parser itself
 * (`an-ai-may-not-approve-money.test.ts`). Never throws.
 */
export async function recordPhoneReceiptRead(
  admin: SupabaseClient,
  paymentId: string,
  args: { form: FormData; typed: string | null; expectedPhp: number | null; channel: string | null },
): Promise<void> {
  const read = phoneReceiptRead(args);
  if (!read) return;
  await recordPaymentReceiptRead(admin, paymentId, { ...read, model: ON_PHONE_READER_NAME });
}

// `shouldAskBuyerToFix` lives in the PURE module and is re-exported here so old
// imports keep working. See lib/payment-receipt-read.ts.
export { shouldAskBuyerToFix } from '@/lib/payment-receipt-read';
