/**
 * migrate-payment-screenshots-to-private.ts   (ONE-OFF · operator-run)
 *
 * Relocates payment-proof screenshots that were mistakenly written to the
 * PUBLIC `setnayan-media` bucket into the PRIVATE `setnayan-thread-files`
 * bucket, and rewrites the stored `payments.screenshot_url` refs to match.
 *
 * WHY: two payment-proof upload paths targeted the public `media` bucket —
 *   (a) `<FileUpload bucket="media">` in the checkout + order-detail drawers
 *       (the preferred `r2://…` direct-upload path — this is what fired in
 *       prod: every stored proof ref is `r2://setnayan-media/…`), and
 *   (b) `bucketForPrefix` matched only the SINGULAR `payment-screenshot/`
 *       prefix while the server-side `uploadPublicAsset` writers pass the
 *       PLURAL `payment-screenshots/…`, so that fallback path fell through
 *       to `media` too.
 * Both are fixed forward (bucket="thread-files" + plural mapping). This
 * script moves the objects that already leaked into the public bucket and
 * repoints their DB refs so the private presigned-read path takes over.
 *
 * SAFETY CONTRACT (per object · strict order · never destructive-first):
 *   1. COPY   setnayan-media/<key>  →  setnayan-thread-files/<key>
 *   2. VERIFY dest HEAD matches source (size + etag)   [abort object on mismatch]
 *   3. UPDATE payments.screenshot_url  r2://setnayan-media/…  →  r2://setnayan-thread-files/…
 *   4. DELETE the public source object                 [only after 1-3 succeed]
 * Ref-update precedes the source delete, so a crash mid-run can only ever
 * leave a still-readable (private) object under an old media/ ref — never a
 * ref pointing at a deleted object. Re-runnable: a dest object that already
 * matches skips the copy; rows already on thread-files aren't selected.
 *
 * RUN:
 *   cd apps/web
 *   # DRY RUN (default — no copies, no deletes, no DB writes):
 *   npx tsx scripts/migrate-payment-screenshots-to-private.ts
 *   # APPLY:
 *   MIGRATE_APPLY=1 npx tsx scripts/migrate-payment-screenshots-to-private.ts
 *
 * ENV: reads `apps/web/.env.local` by default (override with ENV_FILE=/path).
 *   Requires REAL, non-empty values for:
 *     R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *     NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   The script MOVES R2 objects, so it exits (no partial writes) if any R2
 *   credential is missing/empty.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  S3Client,
  CopyObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

/**
 * Minimal env-file loader (no shell `source`, no dotenv dep). Handles
 * `KEY="value"` / `KEY='value'` / bare / `export KEY=…`. Only fills a key
 * that isn't already set, so a real shell env wins. Prints nothing.
 */
function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const stripped = line.startsWith('export ') ? line.slice(7) : line;
    const eq = stripped.indexOf('=');
    if (eq <= 0) continue;
    const key = stripped.slice(0, eq).trim();
    let val = stripped.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(
  process.env.ENV_FILE ?? path.resolve(process.cwd(), '.env.local'),
);

const PUBLIC_BUCKET = 'setnayan-media';
const PRIVATE_BUCKET = 'setnayan-thread-files';
const R2_PREFIX_PUBLIC = `r2://${PUBLIC_BUCKET}/`;
const R2_PREFIX_PRIVATE = `r2://${PRIVATE_BUCKET}/`;

const APPLY = process.env.MIGRATE_APPLY === '1';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `Missing (or empty) required env: ${name}\n` +
        `  → Point ENV_FILE at an env file with REAL, non-empty values for:\n` +
        `    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,\n` +
        `    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n` +
        `  This migration MOVES R2 objects, so it cannot run without live R2 creds.`,
    );
    process.exit(1);
  }
  return v;
}

const accountId = requireEnv('R2_ACCOUNT_ID');
const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  // Match lib/r2.ts — R2 rejects the SDK's default checksum headers.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

type Head = { size?: number; etag?: string };

async function head(bucket: string, key: string): Promise<Head | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: r.ContentLength, etag: r.ETag };
  } catch (err) {
    const name = (err as { name?: string }).name;
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) return null;
    throw err;
  }
}

async function main() {
  console.log(
    `\n=== payment-screenshot bucket migration · ${APPLY ? 'APPLY' : 'DRY RUN'} ===`,
  );
  console.log(`  source (public):  ${PUBLIC_BUCKET}`);
  console.log(`  target (private): ${PRIVATE_BUCKET}\n`);

  // Every payment whose stored ref still points at the public media bucket.
  const { data, error } = await supabase
    .from('payments')
    .select('payment_id, screenshot_url')
    .like('screenshot_url', `${R2_PREFIX_PUBLIC}%`);

  if (error) {
    console.error('Supabase query failed:', error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(
    `Found ${rows.length} payment row(s) pointing at the public bucket.\n`,
  );

  let moved = 0;
  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const ref = row.screenshot_url as string;
    const key = ref.slice(R2_PREFIX_PUBLIC.length);
    const newRef = `${R2_PREFIX_PRIVATE}${key}`;
    const tag = `payment ${row.payment_id} · ${key}`;

    try {
      const srcHead = await head(PUBLIC_BUCKET, key);
      if (!srcHead) {
        // Source already gone. If the private copy exists, this is a partial
        // prior run — just repoint the ref. Otherwise it's an orphan ref.
        const destExists = await head(PRIVATE_BUCKET, key);
        if (destExists) {
          console.log(`~ ${tag}\n    source gone, dest present → fixing ref only`);
          if (APPLY) {
            const { error: upErr } = await supabase
              .from('payments')
              .update({ screenshot_url: newRef })
              .eq('payment_id', row.payment_id);
            if (upErr) throw new Error(`DB update: ${upErr.message}`);
          }
          moved++;
        } else {
          console.warn(
            `! ${tag}\n    ORPHAN: no object in either bucket — ref left untouched`,
          );
          skipped++;
        }
        continue;
      }

      // 1. COPY (idempotent — skip if the dest already byte-matches).
      const preDest = await head(PRIVATE_BUCKET, key);
      const alreadyCopied =
        preDest &&
        preDest.size === srcHead.size &&
        preDest.etag === srcHead.etag;

      if (alreadyCopied) {
        console.log(`= ${tag}\n    dest already matches — copy step skipped`);
      } else if (APPLY) {
        await s3.send(
          new CopyObjectCommand({
            Bucket: PRIVATE_BUCKET,
            // Cross-bucket copy. Keep `/` path separators un-encoded.
            CopySource: `${PUBLIC_BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
            Key: key,
          }),
        );
      } else {
        console.log(`+ ${tag}\n    would COPY → ${PRIVATE_BUCKET}`);
      }

      if (APPLY) {
        // 2. VERIFY the copy landed byte-for-byte before touching anything.
        const destHead = await head(PRIVATE_BUCKET, key);
        if (
          !destHead ||
          destHead.size !== srcHead.size ||
          destHead.etag !== srcHead.etag
        ) {
          throw new Error(
            `verify mismatch: src(size=${srcHead.size},etag=${srcHead.etag}) vs ` +
              `dest(size=${destHead?.size},etag=${destHead?.etag}) — NOT deleting source`,
          );
        }

        // 3. UPDATE the ref BEFORE deleting the public source (crash-safe order).
        const { error: upErr } = await supabase
          .from('payments')
          .update({ screenshot_url: newRef })
          .eq('payment_id', row.payment_id);
        if (upErr) throw new Error(`DB update: ${upErr.message}`);

        // 4. DELETE the public source only after copy + verify + ref-update.
        await s3.send(
          new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }),
        );
        deleted++;
        console.log(
          `✓ ${tag}\n    copied · verified · ref updated · public source deleted`,
        );
      }
      moved++;
    } catch (err) {
      failed++;
      console.error(
        `✗ ${tag}\n    FAILED: ${err instanceof Error ? err.message : String(err)} — left as-is`,
      );
    }
  }

  console.log(`\n=== summary (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`);
  console.log(`  candidate rows : ${rows.length}`);
  console.log(`  moved/updated  : ${moved}`);
  console.log(`  public deleted : ${deleted}`);
  console.log(`  skipped/orphan : ${skipped}`);
  console.log(`  failed         : ${failed}`);
  if (!APPLY) console.log('\n(dry run — set MIGRATE_APPLY=1 to apply)');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Fatal:', err);
    process.exit(1);
  },
);
