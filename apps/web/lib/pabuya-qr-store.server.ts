import 'server-only';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { r2Upload, R2_BUCKETS } from '@/lib/r2';
import { encodeR2Ref } from '@/lib/uploads';
import { redrawQrPhPayload } from '@/lib/pabuya-qr-render';

/**
 * lib/pabuya-qr-store.server.ts — store the redrawn gift QR.
 *
 * The I/O half of the redraw: `lib/pabuya-qr-render.ts` decides WHAT the image
 * is (and proves it by decoding it back); this writes it and hands back a ref.
 * Nothing here decides anything — a policy change is a change to the pure
 * module, which a test can execute.
 */

/**
 * Redraw the couple's QR from its payload and store it beside their upload.
 *
 * Returns the new `r2://` ref, or null when the redraw was refused (not a QR Ph
 * payload, or the round trip did not reproduce it) or the write failed. Null
 * always means "keep the couple's original" — never "they have no QR".
 *
 * ⚠ THE SAME HOME AND THE SAME POLICY AS AN UPLOAD. The key is written under
 * `pabuya-qr/<eventId>/` in the private bucket, so a redraw is indistinguishable
 * from an upload to every reader, every cleanup scope and the serving route's
 * `parseClientRef`. A redraw that landed anywhere else would be a fourth home
 * for the same class of object, and the route would refuse to serve it.
 *
 * ⚠ FAIL-SOFT. A couple who uploaded a working QR must never be blocked because
 * our beautifier had a bad day; the caller keeps their image and the save
 * proceeds. Reported so a silent stop is findable.
 */
export async function storeRedrawnPabuyaQr(args: {
  payload: string | null;
  eventId: string;
}): Promise<string | null> {
  const drawn = await redrawQrPhPayload(args.payload);
  if (!drawn) return null;

  try {
    // A fresh object name, never the uploaded one: overwriting the couple's own
    // file in place would destroy the only copy of their original before the
    // row has been updated to point anywhere else.
    const key = `pabuya-qr/${args.eventId}/${randomUUID()}-redrawn.png`;
    await r2Upload({
      bucket: R2_BUCKETS.threadFiles,
      key,
      body: drawn.png,
      contentType: 'image/png',
    });
    return encodeR2Ref(R2_BUCKETS.threadFiles, key);
  } catch (err) {
    Sentry.captureException(err, {
      extra: { call_site: 'storeRedrawnPabuyaQr', event_id: args.eventId },
    });
    return null;
  }
}
