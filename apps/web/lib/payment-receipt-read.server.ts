import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStoredAsset } from '@/lib/uploads';
import { r2GetBytes } from '@/lib/r2';
import {
  RECEIPT_TRANSCRIBE_PROMPT,
  readPaymentReceipt,
  type PaymentReceiptRead,
} from '@/lib/payment-receipt-read';

/**
 * lib/payment-receipt-read.server.ts — the ONE seam that shows a payment
 * screenshot to a model, so a receipt is only ever read one way.
 *
 * Two callers:
 *   • the buyer's proof submission (app/pay/[reference]/actions.ts) — reads the
 *     picture BEFORE accepting, so a mistyped reference is caught while the
 *     person who can fix it is still on the screen.
 *   • the admin's "Read it again" button (app/admin/payments/actions.ts) — for
 *     rows submitted before this shipped, and for retrying a failed read.
 *
 * ⛔ NEITHER CALLER MAY LET THIS DECIDE ANYTHING. It produces advice. It never
 * touches `payments.status`, never promotes an order, and is not imported by
 * `isDecisivePaymentMatch`. The one-person admin plan (2026-07-11): the machine
 * may prepare and may hold back, it may never be the thing that lets money
 * through.
 *
 * ⚠ AND IT IS NON-FATAL BY CONTRACT — the part that matters most now that it
 * sits in the buyer's request path. A model outage, a missing key, a slow call
 * or a picture we cannot decode must NEVER stop somebody logging a payment they
 * have already sent. Every failure path returns a 'failed' verdict, which the
 * pay action treats as "let them through". Nothing throws out of
 * `readPaymentReceiptFromR2`.
 */

/**
 * Sonnet, not Opus. This is transcription — the hardest thing asked of it is
 * reading a grouped reference number off a phone screenshot — and the judgement
 * that follows is done in plain TypeScript. Paying Opus rates per payment for
 * OCR would be spending the margin on nothing.
 */
export const RECEIPT_READ_MODEL = 'claude-sonnet-5';

/**
 * Anthropic accepts jpeg / png / gif / webp only, and counts an image against
 * a 5 MB per-image limit AFTER base64 (which inflates by ~4/3). The upload form
 * accepts up to 5 MB and HEIC besides, so every picture is normalised here
 * rather than hoping.
 *
 * 1568px on the long edge is Anthropic's own "no benefit beyond this" figure —
 * a bigger image costs more tokens and reads no better.
 */
const MAX_EDGE = 1568;

/** Below this the JPEG is small enough that base64 cannot breach the limit. */
const MAX_JPEG_BYTES = 3_500_000;

/**
 * A HARD CEILING ON THE BUYER'S WAIT.
 *
 * This call now happens while somebody is looking at a spinner having already
 * sent us money. A model that hangs must cost them twenty seconds and then get
 * out of the way — never the request. Read this as a promise to the buyer, not
 * as a tuning knob: raising it raises how long a stranger stares at a spinner
 * on the screen where giving up costs a sale.
 */
const READ_TIMEOUT_MS = 20_000;

async function toModelImage(bytes: Uint8Array): Promise<string> {
  const jpeg = await sharp(bytes)
    .rotate() // honour EXIF orientation — a sideways receipt transcribes badly
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  if (jpeg.byteLength > MAX_JPEG_BYTES) {
    // Only reachable on a pathological image; re-encode harder rather than
    // failing, because a refused read tells the admin nothing useful.
    const smaller = await sharp(bytes)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return smaller.toString('base64');
  }
  return jpeg.toString('base64');
}

/** Is the reader configured at all? FALSE ⇒ every caller skips silently. */
export function receiptReaderConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ReceiptReadRecord = PaymentReceiptRead & { model: string | null };

const failed = (summary: string, error: string): ReceiptReadRecord => ({
  status: 'failed',
  referenceMatches: null,
  amountMatches: null,
  seenReferences: [],
  seenAmounts: [],
  summary,
  error,
  model: null,
});

/** Reject after {@link READ_TIMEOUT_MS} rather than making a buyer wait forever. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`receipt read timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Read one screenshot and say what is on it. Records nothing, decides nothing.
 *
 * Returns `null` when there is nothing to read — no key, no picture, or a legacy
 * plain-URL value we do not fetch. NULL IS NOT A MISMATCH: the caller must treat
 * it as "carry on", because a buyer who sent a reference number and no picture
 * has done nothing wrong and the form allows it.
 *
 * NEVER THROWS.
 */
export async function readPaymentReceiptFromR2(args: {
  screenshotRef: string | null;
  typedReference: string | null;
  expectedPhp: number | null;
}): Promise<ReceiptReadRecord | null> {
  if (!receiptReaderConfigured()) return null;

  const asset = parseStoredAsset(args.screenshotRef);
  if (!asset || asset.kind !== 'r2') return null;

  let base64: string;
  try {
    const { bytes } = await withTimeout(
      r2GetBytes({ bucket: asset.bucket, key: asset.key }),
      READ_TIMEOUT_MS,
    );
    base64 = await toModelImage(bytes);
  } catch (e) {
    return failed(
      'We could not open the picture to read it. Open it yourself.',
      `image: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let transcript: string;
  try {
    const client = new Anthropic();
    const res = await withTimeout(
      client.messages.create({
        model: RECEIPT_READ_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
              },
              { type: 'text', text: RECEIPT_TRANSCRIBE_PROMPT },
            ],
          },
        ],
      }),
      READ_TIMEOUT_MS,
    );
    transcript = res.content
      .filter((b): b is { type: 'text'; text: string } & typeof b => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  } catch (e) {
    return failed(
      'The reader could not run just now. Open the picture yourself.',
      `model: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const read = readPaymentReceipt({
    transcript,
    typed: args.typedReference,
    expectedPhp: args.expectedPhp,
  });
  return { ...read, model: RECEIPT_READ_MODEL };
}

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
    summary: read.summary,
    error: read.error,
    model: read.model,
  });
  if (error) console.error('payment_receipt_reads insert failed', error.message);
}

/**
 * Read a payment's screenshot and file the result. The admin "Read it again"
 * path — one call, because there is no buyer waiting on the answer.
 *
 * Never throws.
 */
export async function runPaymentReceiptRead(args: {
  /** Service-role client — `payment_receipt_reads` has RLS on and no policy. */
  admin: SupabaseClient;
  paymentId: string;
  screenshotRef: string | null;
  typedReference: string | null;
  expectedPhp: number | null;
}): Promise<ReceiptReadRecord | null> {
  const read = await readPaymentReceiptFromR2({
    screenshotRef: args.screenshotRef,
    typedReference: args.typedReference,
    expectedPhp: args.expectedPhp,
  });
  if (!read) return null;
  await recordPaymentReceiptRead(args.admin, args.paymentId, read);
  return read;
}

// `shouldAskBuyerToFix` lives in the PURE module and is re-exported here so both
// callers import from one place. It is the rule that can send a person who has
// already paid back to the start, so it must be testable without a key, a
// network or `server-only` — see lib/payment-receipt-read.ts.
export { shouldAskBuyerToFix } from '@/lib/payment-receipt-read';
