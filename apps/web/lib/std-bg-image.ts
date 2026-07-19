import 'server-only';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { requireR2Client, type R2BucketName } from '@/lib/r2';
import {
  displayUrlForStoredAsset,
  parseStoredAsset,
  presignDisplayUrl,
} from '@/lib/uploads';

/**
 * Save-the-Date background — serve a SCREEN-SIZED variant, not the raw upload.
 *
 * The Step-1 "upload" background is the couple's own photo, stored in R2 as the
 * ORIGINAL straight off their camera/phone — e.g. cale-ice's 4.2 MB / 4460×2509
 * Nikon JPEG. The film draws it full-bleed behind everything via a CSS
 * `background-image`, so the browser streamed the whole 4 MB at low priority →
 * the reported "background image loads slowly" (multi-second on phones, where it
 * only ever displays at ~400–1200 px wide).
 *
 * We can't lean on `next/image` here: every other presigned-R2 surface in the app
 * deliberately uses a raw element because the optimizer keys its cache on the URL
 * and our presigned URLs rotate every render (see app/[slug]/page.tsx "raw <img>
 * because the URLs are presigned"). So instead we DERIVE a web-sized WebP ONCE and
 * cache it back in R2 next to the original, then serve that. ~4 MB → a few hundred
 * KB, same visual full-bleed.
 *
 * Generation is lazy + idempotent: the first view of an event that lacks a variant
 * pays a one-time GET→resize→PUT (~1–3 s on the server, fail-open to the original
 * so the background never breaks); every later view (and every guest) just HEADs
 * the cached variant and presigns it. The derived object is immutable, so a stored
 * variant is reused forever (the source never changes once uploaded).
 */

// 1600 px wide covers desktop full-bleed crisply and downscales cleanly on phones
// (~3× DPR × 400 css-px ≈ 1200 px). q72 WebP keeps it visually clean at a fraction
// of the bytes. Kept under the parallax overscan so edges never show.
const VARIANT_WIDTH = 1600;
const VARIANT_QUALITY = 72;
/** Suffix marking a derived web variant; also the idempotency guard. */
const VARIANT_SUFFIX = '__stdbg-w1600.webp';

async function objectExists(bucket: R2BucketName, key: string): Promise<boolean> {
  try {
    await requireR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a stored Save-the-Date background to a presigned URL for a screen-sized
 * WebP variant — generating + caching the variant in R2 on first use. Legacy
 * (non-r2://) values and any failure fall back to the original via
 * `displayUrlForStoredAsset`, so the background always resolves to *something*.
 */
export async function displayUrlForStdBackground(
  value: string | null | undefined,
): Promise<string | null> {
  const ref = parseStoredAsset(value);
  if (!ref || ref.kind !== 'r2') {
    // null / empty / legacy URL — nothing to resize.
    return displayUrlForStoredAsset(value);
  }

  // Already a derived variant (defensive) — serve it as-is, never re-derive.
  if (ref.key.endsWith(VARIANT_SUFFIX)) {
    return presignDisplayUrl(ref.bucket, ref.key);
  }

  const variantKey = `${ref.key}${VARIANT_SUFFIX}`;
  try {
    if (!(await objectExists(ref.bucket, variantKey))) {
      const client = requireR2Client();
      const original = await client.send(
        new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key }),
      );
      const bytes = await original.Body?.transformToByteArray();
      if (!bytes || bytes.length === 0) throw new Error('empty source object');
      const webp = await sharp(Buffer.from(bytes))
        .rotate() // honor EXIF orientation before stripping metadata
        .resize({ width: VARIANT_WIDTH, withoutEnlargement: true })
        .webp({ quality: VARIANT_QUALITY })
        .toBuffer();
      await client.send(
        new PutObjectCommand({
          Bucket: ref.bucket,
          Key: variantKey,
          Body: webp,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    }
    return await presignDisplayUrl(ref.bucket, variantKey);
  } catch {
    // R2 down (dev/preview), an un-decodable source, or any transient error —
    // a full-size original background beats a broken one.
    return displayUrlForStoredAsset(value);
  }
}
