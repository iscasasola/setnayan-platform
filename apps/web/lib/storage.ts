import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  R2_BUCKETS,
  type R2BucketKey,
  type R2BucketName,
  getR2Client,
  isR2Configured,
  publicUrlFor,
} from '@/lib/r2';

/**
 * Server-side upload helper used by Server Actions (admin merchant-QR,
 * payment screenshot, dispute evidence, vendor logo via legacy text field,
 * etc.). The browser-direct flow lives in `app/api/upload/route.ts` and
 * `app/_components/file-upload.tsx`.
 *
 * Default path: Cloudflare R2.
 * Fallback path: Supabase Storage `platform-assets` bucket — only when R2
 * env vars are unset. See top-of-file comment in `lib/r2.ts` for the
 * graceful-degradation contract.
 */

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

/**
 * The Supabase Storage bucket the legacy upload path writes to. Kept as a
 * single bucket (vs. R2's four-bucket-by-domain split) because Supabase
 * Storage uploads are dev/staging-only — production has R2 env vars set.
 */
const SUPABASE_FALLBACK_BUCKET = 'platform-assets';

export type UploadResult =
  | {
      ok: true;
      publicUrl: string;
      key: string;
      bucket: R2BucketName | typeof SUPABASE_FALLBACK_BUCKET;
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
 *
 * When R2 env vars are unset, falls back to Supabase Storage
 * `platform-assets` bucket (legacy V0 behavior). This is the
 * graceful-degradation path used by dev / preview / staging environments
 * that don't yet have R2 credentials in their env file.
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

  if (!isR2Configured()) {
    return uploadViaSupabaseFallback({
      pathPrefix,
      file,
      declaredType,
    });
  }

  const bucketKey = bucketForPrefix(pathPrefix);
  const bucket = R2_BUCKETS[bucketKey];
  const prefix = pathPrefix.replace(/^\/+|\/+$/g, '');
  const key = `${prefix}/${randomUUID()}-${file.name}`;

  try {
    const client = getR2Client();
    if (!client) {
      // Race with isR2Configured() above — env var changed mid-flight. Fall
      // through to Supabase so the user's upload doesn't fail.
      return uploadViaSupabaseFallback({
        pathPrefix,
        file,
        declaredType,
      });
    }
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

/**
 * Legacy upload path: writes to Supabase Storage `platform-assets`. Only
 * called when R2 env vars are unset. Mirrors the pre-PR-#18 behavior so
 * dev/staging environments without R2 credentials keep working.
 *
 * The returned `publicUrl` is the Supabase Storage public URL, which read
 * sites accept verbatim — `parseR2Url` returns null for Supabase URLs and
 * the renderer passes them through unchanged (see `lib/uploads.ts`
 * `parseStoredAsset` → `legacy_url` branch).
 */
async function uploadViaSupabaseFallback(args: {
  pathPrefix: string;
  file: File;
  declaredType: string;
}): Promise<UploadResult> {
  const { pathPrefix, file, declaredType } = args;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key = `${pathPrefix.replace(/^\/+|\/+$/g, '')}/${stamp}-${random}.${ext}`;

  try {
    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await admin.storage
      .from(SUPABASE_FALLBACK_BUCKET)
      .upload(key, arrayBuffer, {
        contentType: declaredType,
        cacheControl: '3600',
        upsert: false,
      });
    if (error) {
      console.error('[storage] Supabase fallback upload failed', {
        bucket: SUPABASE_FALLBACK_BUCKET,
        key,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }
    const { data: pub } = admin.storage
      .from(SUPABASE_FALLBACK_BUCKET)
      .getPublicUrl(key);
    console.warn(
      '[storage] R2 not configured — wrote to Supabase Storage fallback',
      { bucket: SUPABASE_FALLBACK_BUCKET, key },
    );
    return {
      ok: true,
      publicUrl: pub.publicUrl,
      key,
      bucket: SUPABASE_FALLBACK_BUCKET,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown fallback upload error';
    console.error('[storage] Supabase fallback upload threw', {
      key,
      error: message,
    });
    return { ok: false, error: message };
  }
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
 * Parses a Supabase Storage public URL back into a `{ bucket, key }` pair.
 *
 * Supabase Storage public URLs look like:
 *   `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<key>`
 *
 * Returns null for anything else — R2 URLs, external CDN URLs, etc.
 */
function parseSupabaseStorageUrl(
  publicUrl: string,
): { bucket: string; key: string } | null {
  let url: URL;
  try {
    url = new URL(publicUrl);
  } catch {
    return null;
  }
  // Match `/storage/v1/object/public/<bucket>/<key>`
  const m = url.pathname.match(
    /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
  );
  if (!m) return null;
  return { bucket: m[1] as string, key: decodeURIComponent(m[2] as string) };
}

/**
 * Best-effort delete; we don't roll back the parent record if cleanup fails.
 *
 * Routes by URL shape:
 *   - R2 URL → `DeleteObjectCommand` against R2 (tolerates NoSuchKey).
 *   - Supabase Storage URL → `storage.remove()` against Supabase.
 *   - Anything else (external CDN, vendor's own host) → no-op.
 *
 * The Supabase branch is exercised when R2 is configured today but a row
 * still points at a legacy Supabase URL from the fallback window — the
 * delete should still clean the underlying object so we don't pay for
 * orphaned storage.
 */
export async function deletePublicAsset(args: {
  publicUrl: string;
}): Promise<void> {
  const r2 = parseR2Url(args.publicUrl);
  if (r2) {
    try {
      const client = getR2Client();
      if (!client) {
        // R2 unset — skip the delete. The underlying object is in R2 (we
        // can tell from the URL shape) and we have no way to authenticate
        // without the credentials. Logging it so the operator can clean
        // up via the R2 dashboard if needed.
        console.warn(
          '[storage] Skipping R2 delete — R2 not configured. Manual cleanup may be required.',
          r2,
        );
        return;
      }
      await client.send(
        new DeleteObjectCommand({ Bucket: r2.bucket, Key: r2.key }),
      );
    } catch (err) {
      if (
        err instanceof S3ServiceException &&
        (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)
      ) {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Unknown delete error';
      console.error('[storage] R2 delete failed', { ...r2, error: message });
    }
    return;
  }

  const supa = parseSupabaseStorageUrl(args.publicUrl);
  if (supa) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.storage
        .from(supa.bucket)
        .remove([supa.key]);
      if (error) {
        console.error('[storage] Supabase delete failed', {
          ...supa,
          error: error.message,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown delete error';
      console.error('[storage] Supabase delete threw', {
        ...supa,
        error: message,
      });
    }
    return;
  }

  // Not an R2 or Supabase URL — external CDN / vendor-hosted. No-op.
}
