import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import { isQrPhPayload } from '@/lib/emv-qr';

/**
 * lib/pabuya-qr-render.ts — REDRAW a couple's payment QR from its own payload.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * A couple does not upload bare QR modules. They upload what their banking app
 * hands them: a phone screenshot wrapped in the bank's logo, their name, a
 * masked account number and a footnote — sometimes photographed off a second
 * screen, at an angle, with glare. The measured case: a 1194×1565 JPEG in which
 * the code itself was roughly a third of the frame, so the card's 112px QR slot
 * held about 25px of real code. Unscannable, through no fault of theirs.
 *
 * 🔑 THE PAYLOAD IS THE VALUABLE PART, NOT THE PIXELS. Once the image decodes to
 * a valid QR Ph string, that string IS the couple's payment instruction —
 * merchant identifier, bank BIC, account number, currency, CRC. Everything else
 * in their screenshot is packaging. So we keep the payload and redraw the code
 * from it: full-bleed modules, true black on true white, generous quiet zone.
 *
 * ⚠ WE ARE NOT MINTING AN IDENTIFIER. This cannot invent an account — it can
 * only re-encode one the couple already proved they hold by uploading it. The
 * bytes change; the instruction does not.
 *
 * ── THE ROUND TRIP IS THE SAFETY PROPERTY ──────────────────────────────────
 * Every redraw is decoded again and compared to the source payload BYTE FOR
 * BYTE. Anything other than an exact match returns null and the caller keeps
 * the couple's original. An image that "looks like a QR" is not evidence: the
 * only proof that we drew the same instruction is reading it back.
 */

/**
 * Rendering parameters, fixed deliberately rather than tuned per image.
 *
 * ⚠ ERROR CORRECTION 'M', NOT 'H'. Higher correction is not better here — it
 * adds modules, so at a fixed pixel width each module gets SMALLER, which is
 * the opposite of the problem being solved. 'M' is what QR Ph codes are
 * ordinarily printed at, and nothing is being overlaid on this code that would
 * need the redundancy. (The invitation QR carries a monogram and is a different
 * case — see lib/qr-monogram-raster.ts.)
 *
 * ⚠ TRUE BLACK ON TRUE WHITE, not the brand palette. A scanner thresholds
 * luminance, and a cream ground with mulberry modules narrows that margin for
 * the sake of a code most guests see for four seconds on someone else's phone.
 * Brand the CARD, never the code.
 */
export const PABUYA_QR_RENDER = {
  width: 1400,
  margin: 4,
  errorCorrectionLevel: 'M',
  dark: '#000000',
  light: '#FFFFFF',
} as const;

export type RedrawResult = {
  png: Uint8Array;
  /** The payload both the source and the redraw decode to. */
  payload: string;
};

/**
 * Redraw a QR Ph payload as a clean PNG, or return null.
 *
 * Null is returned — and the caller must keep the original — when:
 *   · the payload is not a valid QR Ph string (we only redraw what we
 *     understand; a PayPal URL QR or an unknown rail keeps its own image);
 *   · the rendered image does not decode back to the identical payload.
 *
 * @param payload the decoded QR Ph string from the couple's upload
 */
export async function redrawQrPhPayload(
  payload: string | null | undefined,
): Promise<RedrawResult | null> {
  if (!payload || !isQrPhPayload(payload)) return null;

  let png: Uint8Array;
  try {
    const QR = (await import('qrcode')).default;
    png = new Uint8Array(
      await QR.toBuffer(payload, {
        type: 'png',
        width: PABUYA_QR_RENDER.width,
        margin: PABUYA_QR_RENDER.margin,
        errorCorrectionLevel: PABUYA_QR_RENDER.errorCorrectionLevel,
        color: { dark: PABUYA_QR_RENDER.dark, light: PABUYA_QR_RENDER.light },
      }),
    );
  } catch {
    return null;
  }

  /*
    🔑 READ IT BACK. Through the SAME shared decoder the upload check used, so
    the two cannot disagree about what the image says. A redraw that renders
    something subtly different — a truncated payload, a mangled CRC, the wrong
    character set — would look perfectly like a QR code to a human reviewer and
    would fail in a guest's banking app at the reception. Only the decode proves
    it.
  */
  let back: string | null;
  try {
    back = await decodeQrPayloadFromImage(png);
  } catch {
    return null;
  }
  if (back !== payload) return null;

  return { png, payload };
}
