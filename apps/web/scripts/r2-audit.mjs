/**
 * R2 AUDIT — what is actually sitting in your buckets.
 *
 * Read-only. It LISTS and COUNTS. It never deletes, never moves, never writes
 * to R2, and never prints a credential.
 *
 * Run from apps/web:
 *     node --env-file=.env.local scripts/r2-audit.mjs
 *
 * Credentials come from the environment (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY). They are read by the AWS SDK and never logged.
 *
 * Writes one file per bucket: scripts/out/<bucket>.keys.txt — the plain key
 * list, for diffing against what the database references.
 */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ACCOUNT = process.env.R2_ACCOUNT_ID;
const KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;

if (!ACCOUNT || !KEY || !SECRET) {
  console.error(
    'Missing R2 credentials. Add these three lines to apps/web/.env.local:\n' +
      '  R2_ACCOUNT_ID=...\n  R2_ACCESS_KEY_ID=...\n  R2_SECRET_ACCESS_KEY=...\n' +
      '(Cloudflare → R2 → API → Manage API Tokens → Object Read only is enough.)',
  );
  process.exit(1);
}

const BUCKETS = [
  'setnayan-media',
  'setnayan-samples',
  'setnayan-thread-files',
  'setnayan-vendor-contracts',
  'setnayan-vendor-verification',
];

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
});

const OUT = path.join(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });

const human = (b) =>
  b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} kB`;

for (const Bucket of BUCKETS) {
  const keys = [];
  let bytes = 0;
  let ContinuationToken;
  try {
    do {
      const page = await s3.send(
        new ListObjectsV2Command({ Bucket, ContinuationToken, MaxKeys: 1000 }),
      );
      for (const o of page.Contents ?? []) {
        keys.push(o.Key);
        bytes += o.Size ?? 0;
      }
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
  } catch (err) {
    console.log(`\n${Bucket}\n  could not read — ${err.name}: ${err.message}`);
    continue;
  }

  writeFileSync(path.join(OUT, `${Bucket}.keys.txt`), keys.join('\n') + '\n');

  // Group by top-level prefix so the shape is obvious at a glance.
  const byPrefix = new Map();
  for (const k of keys) {
    const p = k.includes('/') ? k.slice(0, k.indexOf('/')) : '(root)';
    byPrefix.set(p, (byPrefix.get(p) ?? 0) + 1);
  }

  console.log(`\n${Bucket}`);
  console.log(`  ${keys.length} objects · ${human(bytes)}`);
  for (const [p, n] of [...byPrefix].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${String(n).padStart(6)}  ${p}/`);
  }
  if (keys.length && keys.length <= 20) {
    console.log('  every key:');
    for (const k of keys) console.log(`    ${k}`);
  }
}

console.log(`\nKey lists written to ${OUT}`);
console.log('Nothing was deleted, moved or modified.');
