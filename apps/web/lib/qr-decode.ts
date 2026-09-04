// NOTE: deliberately NOT 'server-only'. `sharp` and `jsqr` are DYNAMIC imports
// inside the function (nothing server-native leaks toward a client bundle),
// which also lets `tsx --test` decode a REAL generated QR code and prove the
// detector works — mirroring lib/perceptual-hash.ts, which is not server-only
// for exactly that reason.

/**
 * lib/qr-decode.ts — decode a QR payload out of encoded image bytes.
 *
 * EXTRACTED (MB11, 2026-09-04) from lib/vendor-qr-media-guard.ts, where it had
 * been a private function since 2026-07-03. The logic is unchanged; it moved so
 * that TWO callers can share ONE decoder rather than growing a second copy:
 *
 *   · lib/vendor-qr-media-guard.ts — the WEBSITE guard. Rejects only payloads
 *     that hit Setnayan's own import-funnel paths, and deliberately allows any
 *     other QR: genuine wedding portfolio photos are full of guest and table
 *     QR codes (Papic is QR-heavy) and invalidating those would be wrong.
 *   · lib/moodboard-gallery-screen.server.ts — the MOOD-BOARD GALLERY screen.
 *     Rejects ANY decodable QR, because an inspiration photo shown to somebody
 *     else's couple has no legitimate reason to carry one.
 *
 * 🔑 THE TWO RULES DISAGREE ON PURPOSE, AND THAT IS WHY THE DECODER IS SHARED
 * AND THE VERDICT IS NOT. The expensive, easy-to-get-wrong half (two-scale
 * decode, EXIF baking, inversion attempts) lives here once; what counts as a
 * violation stays with the surface that owns the question.
 */

/**
 * Decode a QR payload from encoded image bytes. Two scales — a QR printed into
 * a large photo often decodes better downscaled, while a small corner QR needs
 * the larger pass. Returns the first decoded payload, or null.
 */
export async function decodeQrPayloadFromImage(
  bytes: Uint8Array,
): Promise<string | null> {
  const sharp = (await import('sharp')).default;
  const { default: jsQR } = await import('jsqr');
  for (const edge of [1600, 800]) {
    try {
      const { data, info } = await sharp(Buffer.from(bytes))
        .rotate() // bake EXIF orientation
        .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const code = jsQR(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        info.width,
        info.height,
        { inversionAttempts: 'attemptBoth' },
      );
      const payload = code?.data?.trim();
      if (payload) return payload;
    } catch {
      // undecodable at this scale → try the next / give up
    }
  }
  return null;
}
