import 'server-only';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2 client + bucket constants.
 *
 * R2 is S3-compatible. We use the AWS SDK pointed at the account-scoped R2
 * endpoint, with `region: 'auto'`. Credentials come from environment vars set
 * in Vercel (and `.env.local` for local dev).
 *
 * Bucket map matches the four PH-region buckets the owner provisioned months
 * ago. Use the `R2_BUCKETS` constant rather than raw strings so a typo at the
 * call site becomes a compile error.
 *
 * # Graceful Supabase Storage fallback
 *
 * If `R2_ACCESS_KEY_ID` (or `R2_ACCOUNT_ID` / `R2_SECRET_ACCESS_KEY`) is
 * unset, `isR2Configured()` returns `false` and `getR2Client()` returns
 * `null` instead of throwing. The two upload entry points — the server-side
 * `uploadPublicAsset` helper in `lib/storage.ts` and the presigned-PUT route
 * at `app/api/upload/route.ts` — check this predicate and either fall back
 * to the legacy Supabase Storage `platform-assets` bucket (server-side) or
 * surface a clear 503 (presigned-PUT route). This is the "graceful
 * degradation" path noted in the R2 migration spec: an operator pushing the
 * branch to a staging environment without R2 credentials still sees
 * working uploads via Supabase Storage, and a clear log/warning so the
 * gap is visible. Production has the R2 env vars set, so the fallback path
 * is exercised only in dev / preview / staging.
 */

export const R2_BUCKETS = {
  media: 'setnayan-media',
  threadFiles: 'setnayan-thread-files',
  vendorContracts: 'setnayan-vendor-contracts',
  samples: 'setnayan-samples',
  vendorVerification: 'setnayan-vendor-verification',
} as const;

export type R2BucketKey = keyof typeof R2_BUCKETS;
export type R2BucketName = (typeof R2_BUCKETS)[R2BucketKey];

let _client: S3Client | null = null;
let _warnedMissingEnv = false;

/**
 * Returns `true` when all three R2 credentials are present. Use this guard
 * before calling `getR2Client` / `requireR2Client` in code paths that have a
 * Supabase Storage fallback.
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

/**
 * Returns a singleton S3Client configured for Cloudflare R2, or `null` when
 * the R2 credentials are missing. The first time we hit the null path we log
 * a one-shot warning so the operator sees that uploads are falling through
 * to the Supabase Storage path.
 *
 * Callers that have a fallback path should branch on `=== null`. Callers that
 * require R2 should use `requireR2Client()` and surface the failure as a 503
 * (or whatever the call site's error contract is).
 */
export function getR2Client(): S3Client | null {
  if (_client) return _client;

  if (!isR2Configured()) {
    if (!_warnedMissingEnv) {
      console.warn(
        '[r2] R2 env vars unset (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY). ' +
          'Uploads will fall back to Supabase Storage where supported. ' +
          'Set the R2 env vars in Vercel to enable Cloudflare R2 uploads.',
      );
      _warnedMissingEnv = true;
    }
    return null;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId as string,
      secretAccessKey: secretAccessKey as string,
    },
  });
  return _client;
}

/**
 * Returns the R2 client or throws if R2 is not configured. Use this in code
 * paths that cannot fall back — e.g., the presigned-PUT endpoint, which has
 * no Supabase-equivalent direct-upload flow.
 */
export function requireR2Client(): S3Client {
  const client = getR2Client();
  if (!client) {
    throw new Error(
      'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.',
    );
  }
  return client;
}

/**
 * Returns the public URL for an R2 object.
 *
 * If `R2_PUBLIC_URL` is set (custom domain or r2.dev subdomain), the URL is
 * built off that base. Otherwise we fall back to the account-scoped endpoint,
 * which only works if the bucket has public access enabled.
 *
 * The returned URL is round-trippable — `deletePublicAsset` parses it back
 * into a bucket + key pair.
 */
export function publicUrlFor(bucket: string, key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  if (base) {
    const trimmed = base.replace(/\/+$/, '');
    return `${trimmed}/${bucket}/${encodedKey}`;
  }
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('Missing R2_ACCOUNT_ID for public URL construction.');
  }
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodedKey}`;
}

// ---------------------------------------------------------------------------
// Named helpers per the R2 migration spec.
//
// These are thin wrappers around the underlying SDK calls so call sites
// import a stable surface (`r2Upload`, `r2SignedGet`, `r2PublicUrl`) rather
// than the AWS SDK directly. `uploadPublicAsset` and `presignUploadUrl` are
// the higher-level helpers most callers actually use — these are for code
// paths that need raw bucket+key control.
// ---------------------------------------------------------------------------

/**
 * Uploads a body to R2 via a single PUT. Throws if R2 is not configured.
 * Returns the public URL once the upload succeeds.
 *
 * Most callers should use `uploadPublicAsset` from `lib/storage.ts` instead,
 * which validates MIME + size, routes to the correct bucket by path prefix,
 * and falls back to Supabase Storage when R2 isn't configured.
 */
export async function r2Upload(args: {
  bucket: R2BucketName;
  key: string;
  body: Uint8Array | Buffer | string;
  contentType: string;
}): Promise<string> {
  const client = requireR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
      CacheControl: 'public, max-age=3600',
    }),
  );
  return publicUrlFor(args.bucket, args.key);
}

/**
 * Returns a short-lived presigned GET URL for an R2 object. Default TTL is
 * 24h (matches `presignDisplayUrl` in `lib/uploads.ts`). Throws if R2 is
 * not configured.
 */
export async function r2SignedGet(args: {
  bucket: R2BucketName;
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const client = requireR2Client();
  return await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: args.bucket, Key: args.key }),
    { expiresIn: args.expiresIn ?? 60 * 60 * 24 },
  );
}

/**
 * Returns the direct public URL for an R2 object. Alias for `publicUrlFor`
 * scoped to typed bucket names so the call site can't pass an arbitrary
 * string.
 */
export function r2PublicUrl(bucket: R2BucketName, key: string): string {
  return publicUrlFor(bucket, key);
}
