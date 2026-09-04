import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import * as Sentry from '@sentry/nextjs';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import { computePHash, hammingDistance } from '@/lib/perceptual-hash';
import {
  contentRejectionMessage,
  findOwnContactHits,
  ownContactNeedles,
  ownLogoHit,
  qrHit,
  type ContentHit,
  type OwnContactSource,
} from '@/lib/moodboard-gallery-upload';

/**
 * lib/moodboard-gallery-screen.server.ts — THE THREE CONTENT CHECKS (MB11).
 *
 * Owner directive 2026-09-03: a supplier may not put their own logo, their own
 * contact information, or a QR code into a photo that goes onto somebody's
 * mood board. That boundary is what keeps discovery running THROUGH Setnayan
 * rather than around it — the credit line under every gallery photo already
 * names the shop, so a phone number printed into the picture buys the vendor
 * nothing except a way to take the couple off-platform.
 *
 * Owner correction, same day: these are HARD BLOCKS AT UPLOAD, not an admin
 * review queue. The vendor is told what was found and fixes it in a minute.
 *
 * ── WHAT EACH CHECK COSTS IF IT IS WRONG, AND WHY EACH IS SHAPED THIS WAY ───
 *
 *   1. QR CODE — near-deterministic. A QR is either machine-decodable or it is
 *      not; there is no confidence score to tune. ANY decodable QR blocks.
 *      ⚠ THIS IS A DIFFERENT RULE FROM lib/vendor-qr-media-guard.ts, on
 *      purpose. That guard protects the vendor's OWN website, where a real
 *      wedding photo legitimately contains guest and table QR codes (Papic is
 *      QR-heavy), so it rejects only Setnayan-funnel payloads. Here the photo
 *      is being published into a STRANGER'S mood board as inspiration, and no
 *      QR belongs in one. Shared decoder, different verdict — see lib/qr-decode.
 *
 *   2. THE VENDOR'S OWN CONTACT INFO — a targeted match against KNOWN VALUES
 *      read from this shop's own vendor_profiles row, never a generic
 *      phone/email pattern. The reasoning, and the false positives a generic
 *      pattern would cause, are written out in lib/moodboard-gallery-upload.ts.
 *      The text comes from a vision model, the same seam
 *      lib/payment-receipt-read.server.ts already uses to read a payment
 *      screenshot — no new dependency, no OCR engine to host.
 *      ⚠ AND IT FAILS OPEN, VISIBLY. If the key is unset or the read times
 *      out, the upload proceeds and the caller is handed
 *      `textScreen: 'unavailable'` so the SCREEN can say so. A check that
 *      silently did not run is the failure this repo keeps re-learning; the
 *      admin approval gate (approved_at) is the backstop, and the vendor is
 *      told the photo is going to review rather than straight to couples.
 *
 *   3. THEIR OWN LOGO — perceptual-hash comparison against the ONE image at
 *      `vendor_profiles.logo_url`, the same technique
 *      lib/vendor-image-repost-watch.ts uses across vendors, pointed at a
 *      single reference instead of every other shop's hashes. When logo_url is
 *      null there is nothing to compare against and the check is SKIPPED — we
 *      do not guess at "logo-shaped" content in the abstract.
 *      🔑 SCOPE, NAMED RATHER THAN OVERSOLD: a whole-image pHash match catches
 *      "the supplier uploaded their logo file as an inspiration photo". It does
 *      NOT catch a small logo STAMPED into the corner of a real photograph —
 *      the pHash of a wedding photo with a corner badge is nothing like the
 *      pHash of the badge. Corner-crop matching was considered and refused:
 *      at a threshold loose enough to catch a badge, a flat corner of sky or
 *      wall collides with a flat logo, and a false hard block on an honest
 *      supplier costs more than this residue does. In practice a Filipino
 *      supplier logo is usually a WORDMARK, so check 2 catches most of them by
 *      reading the shop's name; what remains — a purely graphic corner badge —
 *      is exactly the "genuinely ambiguous residue" the brief says gets
 *      something lighter than a hard block, and it reaches the admin approval
 *      queue like everything else.
 */

/** Sonnet, not Opus. This is transcription; the judgement after it is plain
 *  TypeScript. Same reasoning, and same model, as the receipt reader. */
export const GALLERY_TEXT_READ_MODEL = 'claude-sonnet-5';

/** A hard ceiling on the vendor's wait. Past this the check gives up and the
 *  upload proceeds with `textScreen: 'unavailable'`. */
const READ_TIMEOUT_MS = 20_000;

/** Anthropic's own "no benefit beyond this" long edge. */
const MAX_MODEL_EDGE = 1568;

/**
 * How close a pHash must be to the shop's own logo to count as "this IS the
 * logo". Tighter than the cross-vendor theft threshold (admin-set, default 10)
 * because that one FLAGS FOR REVIEW while this one BLOCKS A VENDOR, and the
 * two deserve different confidence.
 */
export const OWN_LOGO_HAMMING_THRESHOLD = 6;

export const GALLERY_TEXT_READ_PROMPT =
  'Transcribe every piece of readable text visible in this image — signage, printed cards, banners, screens, watermarks, logos containing words, anything legible. Output the text only, one item per line. If there is no readable text, output exactly: NO TEXT.';

export type TextScreenStatus = 'ran' | 'unavailable';

export type GalleryScreenResult = {
  /** TRUE ⇒ refuse the upload and show `message`. */
  blocked: boolean;
  /** Everything we found, each naming itself. Empty when clean. */
  hits: ContentHit[];
  /** The vendor-facing sentence. Empty when not blocked. */
  message: string;
  /** Whether the text read actually ran — see the fail-open note above. */
  textScreen: TextScreenStatus;
};

/** Is the text half of the screen configured at all? */
export function galleryTextScreenConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`gallery screen timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Read every legible string out of the photo. Returns null when the read could
 * not run at all (no key, undecodable image, model error, timeout) — which the
 * caller reports as `textScreen: 'unavailable'` rather than as "clean".
 * NEVER THROWS.
 */
export async function readVisibleText(bytes: Uint8Array): Promise<string | null> {
  if (!galleryTextScreenConfigured()) return null;
  try {
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp(Buffer.from(bytes))
      .rotate()
      .resize({
        width: MAX_MODEL_EDGE,
        height: MAX_MODEL_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();

    const client = new Anthropic();
    const res = await withTimeout(
      client.messages.create({
        model: GALLERY_TEXT_READ_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: jpeg.toString('base64'),
                },
              },
              { type: 'text', text: GALLERY_TEXT_READ_PROMPT },
            ],
          },
        ],
      }),
      READ_TIMEOUT_MS,
    );
    const text = res.content
      .filter((b): b is { type: 'text'; text: string } & typeof b => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text || text === 'NO TEXT') return '';
    return text;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'moodboard-gallery-screen' },
      extra: { phase: 'text-read' },
    });
    return null;
  }
}

/**
 * 🛑 IS THIS LOGO HASHABLE AT ALL? MEASURED, NOT ASSUMED.
 *
 * A DCT pHash is only stable on an image with real low-frequency STRUCTURE.
 * Measured here on 2026-09-04, hashing a synthetic logo and its own JPEG
 * re-encode:
 *
 *   · a DETAILED mark (four coloured elements on white) → distance 0
 *   · a SIMPLE mark  (one dark bar on white)            → distance 28
 *
 * 28 of 64 bits apart from ITSELF. A flat image has almost no energy outside
 * the DC term the hash deliberately discards, so what is left is thresholded
 * noise and the resulting hash is effectively random. Plenty of real shop
 * logos are exactly that shape — a wordmark on white.
 *
 * 🔑 SO THE CHECK CALIBRATES ITSELF ON THE ACTUAL LOGO instead of guessing at
 * a "detail" proxy: hash the logo, hash a re-encode of the logo, and if those
 * two disagree by more than the block threshold the logo cannot be matched
 * reliably and the check is SKIPPED. Running it anyway would give a random
 * verdict on somebody's business — sometimes a false block, sometimes a miss —
 * and a random hard block is worse than no check at all.
 *
 * ⚠ THE RESIDUE IS NAMED, NOT HIDDEN: a shop whose logo is a plain wordmark
 * gets no logo check. The contact check usually covers it anyway, because a
 * wordmark IS the shop's name and the text read picks the name up. What is left
 * — a plain GRAPHIC mark with no words — reaches the admin approval gate like
 * every other draft.
 */
async function logoIsHashable(
  logoBytes: Uint8Array,
  logoHash: bigint,
): Promise<boolean> {
  const sharp = (await import('sharp')).default;
  const reEncoded = await sharp(Buffer.from(logoBytes)).jpeg({ quality: 60 }).toBuffer();
  const twin = await computePHash(new Uint8Array(reEncoded));
  if (twin === null) return false;
  return hammingDistance(logoHash, twin) <= OWN_LOGO_HAMMING_THRESHOLD;
}

/**
 * Compare the upload against the shop's own logo bytes. Returns the hit, or
 * null when there is no logo, either image is undecodable, the logo is not
 * reliably hashable (see above), or they are simply not the same picture.
 * Never throws — an unreadable logo means the check is skipped, never that an
 * honest photo is blocked.
 */
export async function ownLogoMatch(
  uploadBytes: Uint8Array,
  logoBytes: Uint8Array | null,
): Promise<ContentHit | null> {
  if (!logoBytes || logoBytes.length === 0) return null;
  try {
    const [uploadHash, logoHash] = await Promise.all([
      computePHash(uploadBytes),
      computePHash(logoBytes),
    ]);
    if (uploadHash === null || logoHash === null) return null;
    if (!(await logoIsHashable(logoBytes, logoHash))) return null;
    const distance = hammingDistance(uploadHash, logoHash);
    return distance <= OWN_LOGO_HAMMING_THRESHOLD ? ownLogoHit(distance) : null;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'moodboard-gallery-screen' },
      extra: { phase: 'own-logo' },
    });
    return null;
  }
}

/**
 * Run all three checks over ONE upload and return a single verdict.
 *
 * The order is cheapest-first: the QR decode is local pixels, the logo compare
 * is local pixels, the text read is a network call. A QR hit short-circuits the
 * model call — there is no point paying to transcribe a photo we have already
 * refused.
 */
export async function screenGalleryImage(args: {
  bytes: Uint8Array;
  profile: OwnContactSource;
  logoBytes?: Uint8Array | null;
}): Promise<GalleryScreenResult> {
  const hits: ContentHit[] = [];

  const payload = await decodeQrPayloadFromImage(args.bytes).catch(() => null);
  if (payload) hits.push(qrHit(payload));

  if (hits.length === 0) {
    const logo = await ownLogoMatch(args.bytes, args.logoBytes ?? null);
    if (logo) hits.push(logo);
  }

  let textScreen: TextScreenStatus = 'unavailable';
  if (hits.length === 0) {
    const text = await readVisibleText(args.bytes);
    if (text !== null) {
      textScreen = 'ran';
      hits.push(...findOwnContactHits(text, ownContactNeedles(args.profile)));
    }
  } else {
    // Already refused on a local check — the model was never asked, which is
    // not the same as "the text screen failed". Reported as 'ran' would be a
    // lie and as 'unavailable' would put a needless warning on a rejection
    // that already names its reason, so the caller only reads this field when
    // nothing blocked.
    textScreen = 'unavailable';
  }

  return {
    blocked: hits.length > 0,
    hits,
    message: contentRejectionMessage(hits),
    textScreen,
  };
}
