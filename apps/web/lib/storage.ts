import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  R2_BUCKETS,
  type R2BucketKey,
  type R2BucketName,
  getR2Client,
  publicUrlFor,
} from '@/lib/r2';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
]);

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

export type UploadResult =
  | {
      ok: true;
      publicUrl: string;
      key: string;
      bucket: R2BucketName;
    }
  | { ok: false; error: string };

/**
 * Routes a `pathPrefix` to one of the four R2 buckets.
 *
 * V1 rules (mirror the spec in the PR body):
 *   - merchant-qr/*         → media
 *   - vendor-logo/*         → media
 *   - profile-photo/*       → media
 *   - payment-screenshot/*  → thread-files
 *   - everything else       → media (safe default for public assets)
 */
function bucketForPrefix(pathPrefix: string): R2BucketKey {
  const normalized = pathPrefix.replace(/^\/+/, '');
  if (normalized.startsWith('merchant-qr/')) return 'media';
  if (normalized.startsWith('vendor-logo/')) return 'media';
  if (normalized.startsWith('profile-photo/')) return 'media';
  if (normalized.startsWith('payment-screenshot/')) return 'threadFiles';
  return 'media';
}

/**
 * Uploads a file to Cloudflare R2 and returns the public URL.
 *
 * Validates MIME type + size before sending. Server-only — uses the R2
 * singleton client with the service-level access key. Object key is
 * `${pathPrefix}/${randomUUID()}-${file.name}` so collisions are impossible
 * and the file's original name is preserved for downloads.
 */
export async function uploadPublicAsset(args: {
  pathPrefix: string;
  file: File;
}): Promise<UploadResult> {
  const { pathPrefix, file } = args;

  // file.type can be empty if the browser couldn't detect (some older
  // Android browsers do this for HEIC). Fall back to extension sniffing.
  const declaredType = file.type || sniffMimeFromName(file.name);
  if (!declaredType || !ALLOWED_MIME.has(declaredType)) {
    return {
      ok: false,
      error: `Unsupported file type: ${file.type || 'unknown'}. Use PNG, JPEG, WebP, GIF, or HEIC.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is 6 MB.`,
    };
  }

  const bucketKey = bucketForPrefix(pathPrefix);
  const bucket = R2_BUCKETS[bucketKey];
  const prefix = pathPrefix.replace(/^\/+|\/+$/g, '');
  const key = `${prefix}/${randomUUID()}-${file.name}`;

  try {
    const client = getR2Client();
    const body = new Uint8Array(await file.arrayBuffer());
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: declaredType,
        CacheControl: 'public, max-age=3600',
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown upload error';
    console.error('[storage] R2 upload failed', { bucket, key, error: message });
    return { ok: false, error: message };
  }

  return {
    ok: true,
    publicUrl: publicUrlFor(bucket, key),
    key,
    bucket,
  };
}

function sniffMimeFromName(name: string): string | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'avif':
      return 'image/avif';
    default:
      return null;
  }
}

/**
 * Parses a public URL back into a `{ bucket, key }` pair.
 *
 * Handles both URL shapes `publicUrlFor` can emit:
 *   1. `${R2_PUBLIC_URL}/${bucket}/${key}` (custom domain)
 *   2. `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}` (raw)
 *
 * Returns null for URLs that don't look like R2 (e.g. legacy Supabase
 * Storage URLs — we leave those alone and rely on the owner's manual
 * migration).
 */
function parseR2Url(
  publicUrl: string,
): { bucket: string; key: string } | null {
  let pathname: string;
  try {
    pathname = new URL(publicUrl).pathname;
  } catch {
    return null;
  }

  // Strip the R2_PUBLIC_URL pathname prefix (custom domain may have a path).
  const base = process.env.R2_PUBLIC_URL;
  if (base) {
    try {
      const basePath = new URL(base).pathname.replace(/\/+$/, '');
      if (basePath && pathname.startsWith(basePath)) {
        pathname = pathname.slice(basePath.length);
      }
    } catch {
      /* base not a full URL — ignore */
    }
  }

  const stripped = pathname.replace(/^\/+/, '');
  const slash = stripped.indexOf('/');
  if (slash <= 0 || slash === stripped.length - 1) return null;

  const bucket = stripped.slice(0, slash);
  const key = decodeURIComponent(stripped.slice(slash + 1));
  const knownBuckets: string[] = Object.values(R2_BUCKETS);
  if (!knownBuckets.includes(bucket)) return null;
  return { bucket, key };
}

/**
 * Best-effort delete; we don't roll back the parent record if cleanup fails.
 * Tolerates "object not found" silently — R2 returns NoSuchKey for missing
 * keys, and `DeleteObject` is otherwise idempotent.
 */
export async function deletePublicAsset(args: {
  publicUrl: string;
}): Promise<void> {
  const parsed = parseR2Url(args.publicUrl);
  if (!parsed) {
    // Not an R2 URL — probably a legacy Supabase Storage URL. Skip; the
    // owner is handling historical migration manually.
    return;
  }

  try {
    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
    );
  } catch (err) {
    if (
      err instanceof S3ServiceException &&
      (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)
    ) {
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown delete error';
    console.error('[storage] R2 delete failed', { ...parsed, error: message });
  }
}
