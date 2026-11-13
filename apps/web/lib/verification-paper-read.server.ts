import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseClientRef, vendorVerificationDocPolicy } from '@/lib/r2-client-ref';
import { r2GetBytes } from '@/lib/r2';
import { RECEIPT_READ_MODEL, receiptReaderConfigured } from '@/lib/payment-receipt-read.server';
import type { PaperRead } from '@/lib/verification-pairs';
import { paperToModelBlock, readPaperQr, type ModelBlock } from '@/lib/verification-paper-file';
import {
  PAPER_READ_PROMPT,
  isReadableSlotKey,
  mergeReadIntoDocUploads,
  parseModelPaperJson,
  slotR2Key,
  toPaperRead,
  wordsNotReadPaperRead,
  type ReadableSlotKey,
} from '@/lib/verification-paper-read';

/**
 * lib/verification-paper-read.server.ts — the ONE seam that shows a supplier's
 * verification paper to a model (owner 2026-11-14: *"it will try to read their
 * pdf/jpeg file"*).
 *
 * Copied from `payment-receipt-read.server.ts` on purpose — the same client, the
 * same model constant, the same downscale, the same NON-FATAL contract — so the
 * app reads a picture one way.
 *
 * Two callers:
 *   • the supplier's upload (`inline-docs-actions.ts · updateDocUploadInline`),
 *     inside `after()` — the upload has already succeeded and returned before
 *     this starts, so a slow or failed read costs the supplier nothing.
 *   • the admin's "Read it again" (`app/admin/verify/actions.ts`).
 *
 * ⛔ IT DECIDES NOTHING. It writes `doc_uploads[slot].read` and NOTHING ELSE —
 * never a `vendor_profiles` column, never `status`, never `docs_complete`. The
 * 2026-09-09 lock: a read is evidence; the supplier picks on a mismatch; the
 * admin approves. `verification-paper-read.test.ts` fails if this file grows a
 * second write.
 *
 * ⚠ NON-FATAL BY CONTRACT. No key, a model error, an undecodable file, a
 * timeout: the upload is already saved and stays saved; nothing throws out of
 * here. With no key or a failed model, only the QR is written (a words block
 * that says nothing); if the file cannot even be fetched, nothing is written.
 *
 * 🔳 THE QR'S LINK IS NEVER OPENED HERE. Its text is stored; the ADMIN taps it
 * (`classifyPaperQr` labels it). The server fetching a URL a supplier printed
 * would be a request forged on their behalf.
 */

/**
 * Nobody waits on this one — it runs after the response — but a hung model must
 * still end so the function does not burn its whole lifetime on one paper.
 */
const READ_TIMEOUT_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`paper read timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Ask the model for the words. Null on ANY failure (logged, never thrown). */
async function transcribe(bytes: Uint8Array): Promise<string | null> {
  let block: ModelBlock;
  try {
    block = await paperToModelBlock(bytes);
  } catch (e) {
    console.error('[readVerificationPaper] file', e instanceof Error ? e.message : String(e));
    return null;
  }
  try {
    const client = new Anthropic();
    const res = await withTimeout(
      client.messages.create({
        model: RECEIPT_READ_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: [block, { type: 'text', text: PAPER_READ_PROMPT }] }],
      }),
      READ_TIMEOUT_MS,
    );
    return res.content
      .filter((b): b is { type: 'text'; text: string } & typeof b => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  } catch (e) {
    console.error('[readVerificationPaper] model', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export type PaperReadOutcome =
  | { ok: true; read: PaperRead }
  | { ok: false; reason: 'not_configured' | 'not_readable_slot' | 'no_file' | 'file' | 'model' | 'unparsed' | 'superseded' | 'write' };

/**
 * Read one slot's paper and write the `read` block beside its `r2_key`.
 *
 * 🔒 The file is fetched ONLY from this shop's own `vendors/<id>/verification/`
 * folder — the shop id comes from the APPLICATION ROW, never from the stored
 * value (the N5 lesson from the receipt reader).
 *
 * NEVER THROWS.
 */
export async function readVerificationPaper(args: {
  /** Service-role client — this runs after the request, with no session. */
  admin: SupabaseClient;
  applicationId: string;
  slotKey: string;
}): Promise<PaperReadOutcome> {
  try {
    if (!isReadableSlotKey(args.slotKey)) return { ok: false, reason: 'not_readable_slot' };
    const slotKey: ReadableSlotKey = args.slotKey;

    const { data: app, error: appErr } = await args.admin
      .from('vendor_verification_applications')
      .select('vendor_profile_id,doc_uploads')
      .eq('application_id', args.applicationId)
      .maybeSingle();
    if (appErr) console.error('[readVerificationPaper] application read failed', appErr.message);
    const row = app as { vendor_profile_id: string; doc_uploads: unknown } | null;
    const r2Key = row ? slotR2Key(row.doc_uploads, slotKey) : null;
    if (!row || !r2Key) return { ok: false, reason: 'no_file' };

    const asset = parseClientRef(r2Key, vendorVerificationDocPolicy(row.vendor_profile_id));
    if (!asset) return { ok: false, reason: 'no_file' };

    let bytes: Uint8Array;
    try {
      ({ bytes } = await withTimeout(r2GetBytes({ bucket: asset.bucket, key: asset.key }), READ_TIMEOUT_MS));
    } catch (e) {
      console.error('[readVerificationPaper] file', e instanceof Error ? e.message : String(e));
      return { ok: false, reason: 'file' };
    }

    // 🔳 The QR first — it needs no key and no model. Only its TEXT is kept;
    // the link is never opened here (the admin taps it).
    const qr = await readPaperQr(bytes);

    // The words — only when the reader is configured. A missing key or a model
    // error is not a failure of the upload: the QR is still written, the words
    // block says nothing, and the admin reads the paper themselves.
    const now = new Date().toISOString();
    let read: PaperRead = wordsNotReadPaperRead(now);
    if (receiptReaderConfigured()) {
      const transcript = await transcribe(bytes);
      const model = transcript ? parseModelPaperJson(transcript) : null;
      if (model) read = toPaperRead(slotKey, model, now);
    }
    read = { ...read, qrText: qr.qrText, qrUnreadable: qr.qrUnreadable };

    // Re-read just before writing: the model took seconds, and the supplier may
    // have replaced this paper or uploaded another one meanwhile. The merge
    // refuses a slot whose file changed, and keeps every other slot as it is NOW.
    const { data: fresh, error: freshErr } = await args.admin
      .from('vendor_verification_applications')
      .select('doc_uploads')
      .eq('application_id', args.applicationId)
      .maybeSingle();
    if (freshErr || !fresh) return { ok: false, reason: 'write' };
    const next = mergeReadIntoDocUploads(
      (fresh as { doc_uploads: unknown }).doc_uploads,
      slotKey,
      r2Key,
      read,
    );
    if (!next) return { ok: false, reason: 'superseded' };

    // 🔒 THE ONE WRITE: doc_uploads, with only `[slot].read` changed.
    const { error: writeErr } = await args.admin
      .from('vendor_verification_applications')
      .update({ doc_uploads: next })
      .eq('application_id', args.applicationId);
    if (writeErr) {
      console.error('[readVerificationPaper] write failed', writeErr.message);
      return { ok: false, reason: 'write' };
    }
    return { ok: true, read };
  } catch (e) {
    console.error('[readVerificationPaper] unexpected', e instanceof Error ? e.message : String(e));
    return { ok: false, reason: 'model' };
  }
}
