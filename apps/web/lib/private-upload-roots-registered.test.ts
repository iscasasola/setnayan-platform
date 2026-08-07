import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { privateBucketRootIsAllowed } from './r2-client-ref';
import { type R2BucketName } from '@/lib/r2';

/**
 * EVERY <FileUpload> AIMED AT A PRIVATE BUCKET MUST HAVE ITS ROOT REGISTERED.
 *
 * WHY THIS EXISTS. `vendor-itemization-card.tsx` mints
 * `payment-proof/events/<id>` into the private thread-files bucket.
 * `PRIVATE_BUCKET_ROOTS` did not list `payment-proof`, so `/api/upload` refused
 * it with a 400 — every receipt a couple attached to a vendor payment, from the
 * day it shipped. Meanwhile the vendor's "confirm this payment" screen had been
 * rendering a slot for that receipt since 2026-06-20.
 *
 * 🔑 THE EXISTING TEST LOOKED LIKE COVERAGE AND WAS NOT.
 * `r2-client-ref-stored-writes.test.ts` carries a hand-written list of "real
 * private call sites" whose docblock claimed it was grepped exhaustively. It
 * was not — this call site was missing, and a hand-typed list is silent about
 * what nobody typed into it. This test does not ask a human to remember: it
 * reads the call sites out of the source.
 *
 * ⚠ It also does NOT belong in `upload-prefix-tenancy.test.ts`. That checks a
 * DIFFERENT dimension (does the id under the prefix belong to the caller), and
 * `payment-proof` already passed it while being unusable. Two dimensions, two
 * tests.
 */

const APP_DIR = join(process.cwd(), 'app');

/** `bucket="thread-files"` in JSX → the real bucket name. */
const BUCKET_ALIAS: Record<string, R2BucketName> = {
  'thread-files': 'setnayan-thread-files',
  'vendor-contracts': 'setnayan-vendor-contracts',
  'vendor-verification': 'setnayan-vendor-verification',
  samples: 'setnayan-samples',
  media: 'setnayan-media',
};

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Find each `<FileUpload …>` element and pull its literal `bucket=` and
 * `pathPrefix=`. Template literals keep their `${…}` holes — we only need the
 * ROOT segment, which is always literal text before the first slash.
 */
function fileUploads(src: string): { bucket: string; prefix: string }[] {
  const found: { bucket: string; prefix: string }[] = [];
  const re = /<FileUpload\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // The element ends at the first "/>" after it.
    const end = src.indexOf('/>', m.index);
    if (end === -1) continue;
    const el = src.slice(m.index, end);
    const b = el.match(/bucket=["']([a-z-]+)["']/);
    const p = el.match(/pathPrefix=\{?[`"']([^`"'$]*)/);
    if (b && p) found.push({ bucket: b[1]!, prefix: p[1]! });
  }
  return found;
}

test('every private-bucket FileUpload has its root registered in PRIVATE_BUCKET_ROOTS', () => {
  const files = walk(APP_DIR);
  // Self-check: a scanner that reads nothing passes forever.
  assert.ok(files.length >= 100, `scanned only ${files.length} tsx files — the path is wrong`);

  const offenders: string[] = [];
  let checked = 0;

  for (const file of files) {
    for (const { bucket, prefix } of fileUploads(readFileSync(file, 'utf8'))) {
      const real = BUCKET_ALIAS[bucket];
      if (!real || real === 'setnayan-media') continue; // public bucket, not this test
      checked++;
      const root = prefix.split('/')[0] ?? '';
      if (!privateBucketRootIsAllowed(real, prefix)) {
        offenders.push(
          `${file.replace(process.cwd() + '/', '')} — uploads to ${real} under root ` +
            `"${root}", which is NOT in PRIVATE_BUCKET_ROOTS. /api/upload will refuse this ` +
            `with a 400 and only the widget will show it.`,
        );
      }
    }
  }

  // Second self-check: if the matcher found no private uploader at all, its
  // green means nothing.
  assert.ok(
    checked >= 5,
    `matched only ${checked} private-bucket FileUpload call sites — expected at least the ` +
      `disputes, orders, booking-fees, paperwork and verify uploaders. The matcher has ` +
      `drifted; fix it rather than trusting this pass.`,
  );

  assert.deepEqual(offenders, [], offenders.join('\n  '));
});
