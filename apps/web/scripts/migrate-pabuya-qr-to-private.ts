/**
 * MOVE THE COUPLES' GIFT QRs OFF THE PUBLIC BUCKET, AND REVOKE THE OLD COPIES.
 *
 * `event_egift_methods.qr_r2_key` pointed at `setnayan-media`, which is
 * world-readable: an anonymous GET of an object key returns 200. A QR Ph code
 * ENCODES the bank account number it stands for, so while the app route
 * correctly answered 403 to a stranger, the bytes it was protecting had a
 * second address that answered everyone.
 *
 * 🔑 THE DELETE IS THE POINT, NOT THE COPY. Moving the object while leaving the
 * original in place changes nothing a stranger can reach — the key was disclosed
 * in every presigned `<img src>` the page ever rendered, so the old URL keeps
 * working forever unless the object is actually removed. Owner authorised the
 * move AND the deletion, 2026-09-17.
 *
 * ── ORDER, AND WHY IT IS THIS ORDER ────────────────────────────────────────
 *   COPY → VERIFY (size + etag) → UPDATE the ref → DELETE the source.
 * Copied from the shape of `scripts/migrate-payment-screenshots-to-private.ts`,
 * which did the same job for vendor payment receipts. Deviating is the risk:
 * updating the ref BEFORE the copy is verified leaves a row pointing at nothing;
 * deleting BEFORE the ref update leaves the page blank if the update then fails.
 * A crash at any point leaves a readable object under a valid ref — recoverable
 * — rather than a ref pointing at a deleted object.
 *
 * ── ORPHANS ────────────────────────────────────────────────────────────────
 * ⚠ A ROW-DRIVEN MIGRATION CANNOT SEE A REPLACED QR. Until 2026-09-17 nothing
 * ever deleted a displaced object, so every QR a couple replaced is still in the
 * public bucket with NO row pointing at it. Those are invisible to a query and
 * are exactly as exposed as the live ones. `--sweep-orphans` LISTS the public
 * prefix and removes anything under it that no row claims. It is off by default
 * because listing is the one operation here that can surprise you.
 *
 * ── USAGE ──────────────────────────────────────────────────────────────────
 *   DRY RUN (default, writes nothing):
 *     npx tsx scripts/migrate-pabuya-qr-to-private.ts
 *   DRY RUN including the orphan listing:
 *     npx tsx scripts/migrate-pabuya-qr-to-private.ts --sweep-orphans
 *   APPLY:
 *     MIGRATE_APPLY=1 npx tsx scripts/migrate-pabuya-qr-to-private.ts --sweep-orphans
 *
 *   Needs REAL values for R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *   ⚠ Run by the OWNER: no R2 credential reaches an assistant session.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  S3Client,
  CopyObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

/** Minimal env-file loader — same as the payment-screenshot precedent. */
function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
loadEnvFile(process.env.ENV_FILE ?? path.resolve(process.cwd(), '.env.local'));

const PUBLIC_BUCKET = 'setnayan-media';
const PRIVATE_BUCKET = 'setnayan-thread-files';
const APPLY = process.env.MIGRATE_APPLY === '1';
const SWEEP_ORPHANS = process.argv.includes('--sweep-orphans');

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `Missing (or empty) required env: ${name}\n` +
        `  → Point ENV_FILE at an env file with REAL values for:\n` +
        `    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,\n` +
        `    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n` +
        `  This migration MOVES and DELETES R2 objects; it cannot run without live creds.`,
    );
    process.exit(1);
  }
  return v;
}

const accountId = requireEnv('R2_ACCOUNT_ID');
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
  // Match lib/r2.ts — R2 rejects the SDK's default checksum headers.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } },
);

type Head = { size?: number; etag?: string };
async function head(bucket: string, key: string): Promise<Head | null> {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: r.ContentLength, etag: r.ETag };
  } catch (err) {
    const name = (err as { name?: string }).name;
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) return null;
    throw err;
  }
}

/** `r2://bucket/key` → parts, or null. */
function parseRef(ref: string): { bucket: string; key: string } | null {
  if (!ref.startsWith('r2://')) return null;
  const rest = ref.slice('r2://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

async function main() {
  console.log(
    `\n=== Pabuya gift QR → private bucket (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`,
  );
  console.log(`  source (public):  ${PUBLIC_BUCKET}`);
  console.log(`  target (private): ${PRIVATE_BUCKET}`);
  console.log(`  orphan sweep:     ${SWEEP_ORPHANS ? 'ON' : 'off'}\n`);

  const { data, error } = await supabase
    .from('event_egift_methods')
    .select('egift_method_id, event_id, qr_r2_key')
    .not('qr_r2_key', 'is', null);
  if (error) {
    console.error('Could not read event_egift_methods:', error.message);
    process.exit(1);
  }
  const rows = (data ?? []) as {
    egift_method_id: string;
    event_id: string;
    qr_r2_key: string;
  }[];
  console.log(`Rows with a QR: ${rows.length}\n`);

  /** Every key we still consider legitimately claimed, for the orphan sweep. */
  const claimed = new Set<string>();
  let moved = 0;
  let deleted = 0;
  let skipped = 0;

  for (const row of rows) {
    const ref = parseRef(row.qr_r2_key);
    const tag = `${row.egift_method_id} (${row.event_id})`;
    if (!ref) {
      console.log(`? ${tag}\n    unparseable ref, left alone: ${row.qr_r2_key}`);
      skipped += 1;
      continue;
    }
    if (ref.bucket === PRIVATE_BUCKET) {
      console.log(`= ${tag}\n    already private, nothing to do`);
      claimed.add(ref.key);
      skipped += 1;
      continue;
    }
    if (ref.bucket !== PUBLIC_BUCKET) {
      console.log(`? ${tag}\n    unexpected bucket ${ref.bucket}, left alone`);
      skipped += 1;
      continue;
    }

    // The new key: own root prefix, so bucketForPrefix can carry a rule for it.
    const basename = ref.key.split('/').pop() as string;
    const destKey = `pabuya-qr/${row.event_id}/${basename}`;
    const destRef = `r2://${PRIVATE_BUCKET}/${destKey}`;

    const src = await head(PUBLIC_BUCKET, ref.key);
    const dst = await head(PRIVATE_BUCKET, destKey);

    if (!src && dst) {
      console.log(`~ ${tag}\n    source gone, dest present → fixing ref only`);
      if (APPLY) {
        const { error: upErr } = await supabase
          .from('event_egift_methods')
          .update({ qr_r2_key: destRef })
          .eq('egift_method_id', row.egift_method_id);
        if (upErr) {
          console.error(`    REF UPDATE FAILED: ${upErr.message}`);
          continue;
        }
      }
      claimed.add(destKey);
      moved += 1;
      continue;
    }
    if (!src) {
      console.log(`! ${tag}\n    source object MISSING: ${ref.key} — left alone`);
      skipped += 1;
      continue;
    }

    // 1 · COPY (unless an identical object is already there)
    const identical = dst && dst.size === src.size && dst.etag === src.etag;
    if (identical) {
      console.log(`= ${tag}\n    dest already matches — copy step skipped`);
    } else if (APPLY) {
      await s3.send(
        new CopyObjectCommand({
          Bucket: PRIVATE_BUCKET,
          Key: destKey,
          CopySource: `${PUBLIC_BUCKET}/${encodeURIComponent(ref.key).replace(/%2F/g, '/')}`,
        }),
      );
    } else {
      console.log(`+ ${tag}\n    would COPY → ${PRIVATE_BUCKET}/${destKey}`);
    }

    // 2 · VERIFY — size AND etag. Without this the delete below is a guess.
    if (APPLY) {
      const check = await head(PRIVATE_BUCKET, destKey);
      if (!check || check.size !== src.size || check.etag !== src.etag) {
        console.error(
          `    VERIFY FAILED for ${destKey} — source kept, ref untouched.\n` +
            `      src=${src.size}/${src.etag}  dst=${check?.size}/${check?.etag}`,
        );
        skipped += 1;
        continue;
      }
    }

    // 3 · UPDATE THE REF — before the delete, never after.
    if (APPLY) {
      const { data: upd, error: upErr } = await supabase
        .from('event_egift_methods')
        .update({ qr_r2_key: destRef })
        .eq('egift_method_id', row.egift_method_id)
        .select('egift_method_id');
      if (upErr || !upd || upd.length === 0) {
        console.error(
          `    REF UPDATE FAILED (${upErr?.message ?? 'no row matched'}) — ` +
            `copy kept, SOURCE NOT DELETED. Re-run is safe.`,
        );
        skipped += 1;
        continue;
      }
    }
    claimed.add(destKey);
    moved += 1;

    // 4 · DELETE THE PUBLIC SOURCE — the step that actually revokes it.
    if (APPLY) {
      await s3.send(
        new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: ref.key }),
      );
      deleted += 1;
      console.log(`- ${tag}\n    moved and public copy DELETED`);
    } else {
      console.log(`- ${tag}\n    would DELETE public ${ref.key}`);
    }
  }

  // ── ORPHANS ──────────────────────────────────────────────────────────────
  let orphans = 0;
  if (SWEEP_ORPHANS) {
    console.log(`\n--- orphan sweep under ${PUBLIC_BUCKET}/events/*/pabuya/ ---`);
    let token: string | undefined;
    const live = new Set(
      rows
        .map((r) => parseRef(r.qr_r2_key))
        .filter((r): r is { bucket: string; key: string } => !!r)
        .filter((r) => r.bucket === PUBLIC_BUCKET)
        .map((r) => r.key),
    );
    do {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: PUBLIC_BUCKET,
          Prefix: 'events/',
          ContinuationToken: token,
        }),
      );
      for (const obj of res.Contents ?? []) {
        const key = obj.Key ?? '';
        // Only this feature's folder. `events/` holds eleven other features.
        if (!/^events\/[^/]+\/pabuya\//.test(key)) continue;
        if (live.has(key)) continue; // still referenced — handled above
        orphans += 1;
        if (APPLY) {
          await s3.send(
            new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }),
          );
          console.log(`- ORPHAN DELETED ${key}`);
        } else {
          console.log(`- would DELETE ORPHAN ${key}`);
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    if (orphans === 0) console.log('  none found');
  } else {
    console.log(
      `\n⚠ ORPHANS NOT SWEPT. Every QR a couple ever REPLACED is still in the\n` +
        `  public bucket with no row pointing at it, and is exactly as readable as\n` +
        `  the live ones were. Re-run with --sweep-orphans.`,
    );
  }

  console.log(`\n=== summary (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`);
  console.log(`  rows with a QR   : ${rows.length}`);
  console.log(`  moved / ref-fixed: ${moved}`);
  console.log(`  public deleted   : ${deleted}`);
  console.log(`  skipped          : ${skipped}`);
  console.log(`  orphans          : ${SWEEP_ORPHANS ? orphans : 'not swept'}`);
  if (!APPLY) {
    console.log(`\nNothing was written. Re-run with MIGRATE_APPLY=1 to apply.`);
  }
  console.log(
    `\nAFTER APPLYING, re-run this DRY to confirm 0 rows remain on the public\n` +
      `bucket — that zero is what unblocks removing pabuyaQrLegacyPolicy.`,
  );
}

main().catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
