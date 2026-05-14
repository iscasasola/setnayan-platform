import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';

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
 */

export const R2_BUCKETS = {
  media: 'setnayan-media',
  threadFiles: 'setnayan-thread-files',
  vendorContracts: 'setnayan-vendor-contracts',
  samples: 'setnayan-samples',
} as const;

export type R2BucketKey = keyof typeof R2_BUCKETS;
export type R2BucketName = (typeof R2_BUCKETS)[R2BucketKey];

let _client: S3Client | null = null;

/**
 * Returns a singleton S3Client configured for Cloudflare R2.
 *
 * Throws if any of R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
 * is missing — we'd rather fail loudly at the first upload than silently
 * write into an unauthenticated client.
 */
export function getR2Client(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 env vars. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.',
    );
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  return _client;
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
