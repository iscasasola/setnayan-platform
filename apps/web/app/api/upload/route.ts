import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { R2_BUCKETS, isR2Configured, type R2BucketKey } from '@/lib/r2';
import {
  encodeR2Ref,
  presignDisplayUrl,
  presignUploadUrl,
} from '@/lib/uploads';

/**
 * Presigned-URL endpoint used by `<FileUpload>` to upload files directly to
 * Cloudflare R2 without round-tripping the bytes through Next.js.
 *
 * Flow:
 *   1. Client POSTs `{ bucket, pathPrefix, filename, contentType, sizeBytes }`.
 *   2. We auth via the Supabase session cookie. Anonymous callers get 401.
 *   3. We whitelist the bucket key, sanitize the filename, validate the size,
 *      validate the MIME type, and pin the object key to a UUID so two users
 *      uploading the same filename can't collide.
 *   4. We hand back:
 *        • `uploadUrl`  — presigned PUT URL (5-minute TTL)
 *        • `r2Key`      — the object key we picked
 *        • `r2Ref`      — the `r2://bucket/key` value to persist via the
 *                         parent form (see `lib/uploads.ts` for the format)
 *        • `displayUrl` — presigned GET URL (24h TTL) for the preview after
 *                         a successful PUT
 *
 * The client is expected to PUT the file body with `Content-Type` matching
 * the value it sent in step 1 — the signature binds that header.
 *
 * Errors are surfaced as plain JSON `{ error: string }`. Anything unexpected
 * gets `Sentry.captureException` so we see uploads breaking before users do.
 */

type RequestBody = {
  bucket?: string;
  pathPrefix?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
};

const BUCKET_KEYS: ReadonlySet<R2BucketKey> = new Set([
  'media',
  'threadFiles',
  'vendorContracts',
  'samples',
  'vendorVerification',
]);

// Aliases the client sends ("thread-files") map to the internal R2BucketKey
// ("threadFiles"). Keeps the API ergonomic for callers while preserving the
// camelCase typed-object in lib/r2.ts.
const BUCKET_ALIASES: Record<string, R2BucketKey> = {
  media: 'media',
  'thread-files': 'threadFiles',
  threadFiles: 'threadFiles',
  'vendor-contracts': 'vendorContracts',
  vendorContracts: 'vendorContracts',
  samples: 'samples',
  'vendor-verification': 'vendorVerification',
  vendorVerification: 'vendorVerification',
};

// Per-bucket hard caps. The component-level cap is an additional sanity
// check; this one stops a hostile client from claiming `sizeBytes: 5` and
// then PUTting 100 MB because `Content-Length` IS signed (presignUploadUrl
// adds `content-length` to the signed headers set).
const BUCKET_MAX_BYTES: Record<R2BucketKey, number> = {
  media: 10 * 1024 * 1024, // 10 MB — covers logos (small) and portfolio photos
  threadFiles: 20 * 1024 * 1024, // 20 MB — force-majeure evidence + PDF receipts
  vendorContracts: 25 * 1024 * 1024, // 25 MB — signed PDF contracts
  samples: 10 * 1024 * 1024,
  vendorVerification: 15 * 1024 * 1024, // 15 MB — DTI, BIR 2303, Mayor's Permit, etc.
};

// MIME type whitelist — same union the existing `lib/storage.ts` accepts,
// plus PDF for force-majeure evidence and signed contracts, plus a small set
// of audio types for the AI Catalog Generator's voice-input flow (Filipino/
// Taglish service descriptions transcribed by OpenAI Whisper). Audio uploads
// go to the thread-files bucket under `vendors/{id}/voice-input/`.
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'application/pdf',
]);

// Maximum filename length we'll preserve in the object key. Anything longer
// is truncated. (Object keys themselves can be much longer, but the
// `original-${name}` convention falls apart at some point.)
const MAX_FILENAME_LEN = 120;

// Pathprefix sanity bound. Above this is almost certainly a client bug or
// attempt to balloon storage costs by chaining unbounded segments.
const MAX_PATH_PREFIX_LEN = 256;

function sanitizeFilename(raw: string): string {
  // Strip any path components — only the basename matters in the object key.
  const base = raw.split(/[\\/]/).pop() ?? raw;
  // Lowercase the extension for consistent grouping; preserve the basename
  // case so the original filename remains recognizable on download.
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const safeStem = stem.length > 0 ? stem : 'file';
  const composed = ext ? `${safeStem}.${ext}` : safeStem;
  return composed.slice(0, MAX_FILENAME_LEN);
}

function sanitizePathPrefix(raw: string): string {
  // Trim leading/trailing slashes, collapse repeats, drop `..` segments —
  // standard defenses against an absolute or escape-y pathPrefix.
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  const segments = trimmed
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '..' && s !== '.');
  return segments.join('/');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // R2 is required for the presigned-PUT flow — there's no Supabase
  // Storage equivalent of "browser PUTs the bytes directly to the bucket".
  // The server-side helper `uploadPublicAsset` in `lib/storage.ts` DOES
  // fall back to Supabase Storage; surface that to the operator so they
  // know which path needs the env vars.
  if (!isR2Configured()) {
    console.warn(
      '[upload] Rejecting presign request — R2 env vars unset. ' +
        'Browser-direct uploads via /api/upload require R2. ' +
        'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in Vercel.',
    );
    return NextResponse.json(
      {
        error:
          'Uploads are not configured. Please contact support — the operator needs to set R2 credentials.',
      },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to upload.' },
      { status: 401 },
    );
  }

  // ---- Validation ---------------------------------------------------------

  const bucketRaw = typeof body.bucket === 'string' ? body.bucket : '';
  const bucketKey = BUCKET_ALIASES[bucketRaw];
  if (!bucketKey || !BUCKET_KEYS.has(bucketKey)) {
    return NextResponse.json(
      {
        error: `Unknown bucket "${bucketRaw}". Use one of: media, thread-files, vendor-contracts, samples.`,
      },
      { status: 400 },
    );
  }
  const bucketName = R2_BUCKETS[bucketKey];

  const pathPrefixRaw = typeof body.pathPrefix === 'string' ? body.pathPrefix : '';
  if (pathPrefixRaw.length === 0 || pathPrefixRaw.length > MAX_PATH_PREFIX_LEN) {
    return NextResponse.json(
      { error: 'pathPrefix is required and must be 1–256 chars.' },
      { status: 400 },
    );
  }
  const pathPrefix = sanitizePathPrefix(pathPrefixRaw);
  if (pathPrefix.length === 0) {
    return NextResponse.json(
      { error: 'pathPrefix must contain at least one non-empty segment.' },
      { status: 400 },
    );
  }

  const filenameRaw = typeof body.filename === 'string' ? body.filename : '';
  if (filenameRaw.length === 0) {
    return NextResponse.json(
      { error: 'filename is required.' },
      { status: 400 },
    );
  }
  const filename = sanitizeFilename(filenameRaw);

  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  // MediaRecorder sometimes appends `;codecs=opus` (or similar) to the MIME
  // — strip parameters before checking the whitelist so `audio/webm;codecs=opus`
  // matches `audio/webm`. We preserve the original value for the presign so
  // R2 stores the full content-type header the browser sent.
  const baseContentType = contentType.split(';')[0]?.trim() ?? '';
  if (!ALLOWED_MIME_TYPES.has(baseContentType)) {
    return NextResponse.json(
      { error: `Unsupported file type "${contentType || 'unknown'}".` },
      { status: 400 },
    );
  }

  const sizeBytes = typeof body.sizeBytes === 'number' ? body.sizeBytes : NaN;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json(
      { error: 'sizeBytes must be a positive integer.' },
      { status: 400 },
    );
  }
  const maxBytes = BUCKET_MAX_BYTES[bucketKey];
  if (sizeBytes > maxBytes) {
    return NextResponse.json(
      {
        error: `File is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB — max for this bucket is ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`,
      },
      { status: 413 },
    );
  }

  // ---- Build object key + presign ----------------------------------------

  // The UUID prefix guarantees uniqueness even when two users upload a file
  // with the same original name. We keep the original (sanitized) filename in
  // the suffix so downloads land with a recognizable name.
  const objectKey = `${pathPrefix}/${randomUUID()}-${filename}`;

  try {
    const [uploadUrl, displayUrl] = await Promise.all([
      presignUploadUrl({
        bucket: bucketName,
        key: objectKey,
        contentType,
        sizeBytes,
      }),
      presignDisplayUrl(bucketName, objectKey),
    ]);

    return NextResponse.json(
      {
        uploadUrl,
        r2Key: objectKey,
        r2Bucket: bucketName,
        r2Ref: encodeR2Ref(bucketName, objectKey),
        displayUrl,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown presign error';
    // Server-side log + Sentry. Sentry init is no-op when SENTRY_DSN is
    // unset, so this is safe in dev.
    console.error('[upload] presign failed', {
      bucket: bucketName,
      key: objectKey,
      error: message,
    });
    Sentry.captureException(err, {
      tags: { route: 'api/upload', bucket: bucketName },
      extra: { objectKey, contentType, sizeBytes, userId: user.id },
    });
    return NextResponse.json(
      { error: 'Could not generate upload URL. Please try again.' },
      { status: 500 },
    );
  }
}
