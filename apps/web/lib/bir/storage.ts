import 'server-only';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, isR2Configured, publicUrlFor } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Storage layer for the BIR Form 2307 PDFs.
 *
 * Primary: Cloudflare R2 bucket `setnayan-bir-2307` (env
 * R2_BUCKET_BIR_2307). Auto-falls-back to Supabase Storage when R2 env
 * vars are unset — mirrors the pattern in `lib/r2.ts` so local dev /
 * staging without R2 credentials still produces a working PDF link.
 *
 * Lifecycle is BIR-driven: 2307 documents must be retained for 10 years
 * per the standard BIR audit window. The bucket lifecycle policy is
 * owner-side (provisioned in Cloudflare R2 dashboard); engineering
 * uploads with no expiry.
 */

export type Upload2307Args = {
  pdfBytes: Uint8Array;
  vendor_profile_id: string;
  tax_year: number;
  tax_quarter: number;
};

export type Upload2307Result = {
  bucket: string;
  key: string;
  publicUrl: string;
  /** 'r2' or 'supabase' — for the audit log. */
  storage: 'r2' | 'supabase';
};

/**
 * Path scheme: `vendors/{vendor_profile_id}/{year}_Q{quarter}.pdf`.
 * Matches the spec § 5.4 pattern, minus the iteration-level
 * `setnayan-bir-2307/` prefix (the bucket name is the prefix).
 */
function objectKey(args: Upload2307Args): string {
  const { vendor_profile_id, tax_year, tax_quarter } = args;
  return `vendors/${vendor_profile_id}/${tax_year}_Q${tax_quarter}.pdf`;
}

function r2BucketName(): string | null {
  // V1 fallback chain — R2_BUCKET_BIR_2307 is the new env (added in this
  // PR); a bare 'setnayan-bir-2307' string fallback covers the case
  // where the env file hasn't been refreshed yet.
  return (
    process.env.R2_BUCKET_BIR_2307 ||
    (process.env.R2_ACCOUNT_ID ? 'setnayan-bir-2307' : null)
  );
}

/**
 * Upload the rendered 2307 PDF.
 *
 * R2 path: bytes → PutObject → publicUrlFor(bucket, key).
 * Supabase fallback path: Storage bucket `bir-2307` (auto-created on
 * first upload, public-read) → getPublicUrl. Public-read is fine here
 * because the URL is unguessable (UUID in the path) and we surface it
 * only to the vendor + admin; bound by BIR's 10-year retention.
 */
export async function upload2307Pdf(
  args: Upload2307Args,
): Promise<Upload2307Result> {
  const key = objectKey(args);
  const r2Bucket = r2BucketName();

  if (isR2Configured() && r2Bucket) {
    const client = getR2Client();
    if (client) {
      await client.send(
        new PutObjectCommand({
          Bucket: r2Bucket,
          Key: key,
          Body: args.pdfBytes,
          ContentType: 'application/pdf',
          CacheControl: 'private, max-age=0, no-cache',
        }),
      );
      return {
        bucket: r2Bucket,
        key,
        publicUrl: publicUrlFor(r2Bucket, key),
        storage: 'r2',
      };
    }
    // Race with isR2Configured() — env disappeared mid-flight. Fall through.
  }

  // Supabase Storage fallback.
  const admin = createAdminClient();
  const supabaseBucket = 'bir-2307';
  // Best-effort bucket creation — ignore "already exists" errors.
  const { error: createErr } = await admin.storage.createBucket(supabaseBucket, {
    public: true,
  });
  if (createErr && !/already exists/i.test(createErr.message ?? '')) {
    // Soft-warn rather than throwing — upload may still succeed if the
    // bucket exists but was created by a different agent.
    console.warn('[bir/storage] createBucket warning:', createErr.message);
  }
  const { error: uploadErr } = await admin.storage
    .from(supabaseBucket)
    .upload(key, args.pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) {
    throw new Error(
      `Supabase Storage upload failed for ${supabaseBucket}/${key}: ${uploadErr.message}`,
    );
  }
  const { data: pub } = admin.storage.from(supabaseBucket).getPublicUrl(key);
  return {
    bucket: `supabase://${supabaseBucket}`,
    key,
    publicUrl: pub.publicUrl,
    storage: 'supabase',
  };
}
