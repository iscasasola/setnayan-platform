import sharp from 'sharp';
import { sniffPaperFile } from '@/lib/verification-paper-read';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import { pdfEmbeddedImages } from '@/lib/pdf-embedded-images';

/**
 * verification-paper-file.ts — a supplier's uploaded paper → the ONE content
 * block the model is shown. Split from `verification-paper-read.server.ts`
 * (which is `server-only`) so the guard can push a synthetic PDF and a synthetic
 * JPEG through the real conversion.
 *
 * The image half is the receipt reader's (`payment-receipt-read.server.ts`),
 * figure for figure: Anthropic takes jpeg/png/gif/webp, counts 5 MB per image
 * AFTER base64, and reads no better past 1568 px.
 */

const MAX_EDGE = 1568;
const MAX_JPEG_BYTES = 3_500_000;

/**
 * Anthropic's request limit is 32 MB and base64 inflates by ~4/3. The upload
 * form caps a paper well below this; this is the belt for a file that is not.
 */
const MAX_PDF_BYTES = 20_000_000;

export type ModelBlock =
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };

async function toModelImage(bytes: Uint8Array): Promise<string> {
  const jpeg = await sharp(bytes)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  if (jpeg.byteLength > MAX_JPEG_BYTES) {
    const smaller = await sharp(bytes)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return smaller.toString('base64');
  }
  return jpeg.toString('base64');
}

/**
 * PDF → a document block (the model reads the pages itself). JPEG / PNG / WebP /
 * HEIC → `sharp` → a downscaled JPEG. HEIC decodes only where `sharp` was built
 * with it; elsewhere this THROWS, and the caller turns that into "with a
 * person" — never an error on anybody's screen. Anything else throws too.
 */
export async function paperToModelBlock(bytes: Uint8Array): Promise<ModelBlock> {
  const kind = sniffPaperFile(bytes);
  if (kind === 'pdf') {
    if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('pdf too large to read');
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') },
    };
  }
  if (kind === 'unknown') throw new Error('not a pdf or a picture');
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: await toModelImage(bytes) },
  };
}

/**
 * 🔳 THE QR ON THE PAPER (owner "yes", DECISION_LOG "THE QR ON A VERIFICATION
 * PAPER IS READ AND ITS LINK SHOWN TO THE ADMIN"). The ONE decoder
 * (`lib/qr-decode.ts`) runs on the picture, or on each picture inside a PDF
 * (`lib/pdf-embedded-images.ts`). Only the decoded TEXT is kept: nothing here,
 * and nothing after it, opens the link — the admin taps it themselves.
 *
 * `qrUnreadable` is true when no QR came out. A paper with no QR at all reads
 * the same way, because the decoder cannot tell "none" from "could not": the
 * admin is told to check by hand either way, which is true either way.
 *
 * Never throws.
 */
export async function readPaperQr(
  bytes: Uint8Array,
): Promise<{ qrText: string | null; qrUnreadable: boolean }> {
  try {
    const kind = sniffPaperFile(bytes);
    const pictures =
      kind === 'pdf'
        ? await pdfEmbeddedImages(bytes)
        : kind === 'unknown'
          ? []
          : [bytes];
    for (const pic of pictures) {
      const text = await decodeQrPayloadFromImage(pic);
      if (text) return { qrText: text.slice(0, 2000), qrUnreadable: false };
    }
  } catch {
    // fall through — an unreadable QR, never an error
  }
  return { qrText: null, qrUnreadable: true };
}
