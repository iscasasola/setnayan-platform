/**
 * r2-images-reach-the-optimizer.test.ts — the URL we sign must be a URL
 * next/image will accept.
 *
 * WHAT IT COST (2026-08-08, measured on the live site). The owner's shop logo
 * was fixed to stop handing a raw `r2://` reference to an <img>. It resolved
 * correctly. The picture was still missing:
 *
 *     the presigned URL itself      → 200  image/png  34478 bytes
 *     /_next/image?url=<that URL>   → 400  INVALID_IMAGE_OPTIMIZE_REQUEST
 *
 * `lib/r2.ts` points its S3Client at `https://<accountId>.r2.cloudflarestorage.com`
 * and leaves `forcePathStyle` at its default of false, so the SDK signs
 * VIRTUAL-HOST style URLs with the bucket as a SUBDOMAIN:
 *
 *     https://setnayan-media.<accountId>.r2.cloudflarestorage.com/<key>
 *
 * `next.config.ts` allowed only `<accountId>.r2.cloudflarestorage.com`, and
 * `hostname` is an exact match unless it carries a wildcard. So the entry that
 * existed to allow R2 images had never matched a real R2 URL — every presigned
 * image in the app 400'd at the optimizer.
 *
 * 🔑 TWO RULES, BOTH LEARNED THE EXPENSIVE WAY:
 * 1. **Resolving a reference is not the same as the picture arriving.** Fetch
 *    the final URL a browser would fetch. A well-formed URL is not a working
 *    image, exactly as a 200 status is not a page.
 * 2. **This is the same disease a third time.** A raw `r2://` (browser cannot
 *    parse it), a CSP-blocked iframe (browser refuses it), and now a host
 *    outside `remotePatterns` (the optimizer refuses it). Three different
 *    layers decline, and all three symptoms are identical: an absence.
 *
 * Nobody had noticed because production holds no vendor portfolios and no Papic
 * photos — the shop logo was the first R2 image the optimizer was ever asked
 * for.
 *
 * This test derives BOTH sides from the same fact rather than comparing two
 * hand-typed strings: the endpoint shape in lib/r2.ts decides which host form
 * gets signed, and next.config.ts must allow that form.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const R2 = readFileSync(join(WEB, 'lib', 'r2.ts'), 'utf8');
const CONFIG = readFileSync(join(WEB, 'next.config.ts'), 'utf8');

test('the R2 client still signs virtual-host URLs (bucket as a subdomain)', () => {
  assert.match(
    R2,
    /endpoint:\s*`https:\/\/\$\{accountId\}\.r2\.cloudflarestorage\.com`/,
    'the R2 endpoint changed shape — re-derive what next.config.ts must allow',
  );
  assert.ok(
    !/forcePathStyle:\s*true/.test(R2),
    'forcePathStyle is now true, so signed URLs are path-style ' +
      '(<account>.r2.cloudflarestorage.com/<bucket>/<key>) and the wildcard ' +
      'subdomain pattern in next.config.ts is no longer the thing that matters. ' +
      'Re-read this test before changing it.',
  );
});

test('next/image allows the bucket-subdomain host those URLs actually use', () => {
  // The wildcard entry. Anchored on the `*.` prefix in front of the SAME
  // interpolation the endpoint uses, so the two cannot drift apart silently.
  assert.match(
    CONFIG,
    /hostname:\s*`\*\.\$\{process\.env\.R2_ACCOUNT_ID\}\.r2\.cloudflarestorage\.com`/,
    'The bucket-subdomain remotePattern is gone. Every presigned R2 image will ' +
      'return 400 INVALID_IMAGE_OPTIMIZE_REQUEST from /_next/image and render as ' +
      'a broken picture — with the underlying object still perfectly fetchable, ' +
      'which is what makes it so hard to see.',
  );
});

test('a bucket-subdomain URL matches, and a stranger does not', () => {
  // Replicates Next's hostname matching for the two forms we care about, so
  // this asserts BEHAVIOUR and not merely the presence of a line of config.
  const ACCOUNT = '8bb05d666180fd9c0087e6552e63e2ff'; // shape only, not a secret
  const hostnames = [...CONFIG.matchAll(/hostname:\s*`([^`]*)`/g)].map((m) =>
    m[1]!.replace(/\$\{process\.env\.R2_ACCOUNT_ID\}/g, ACCOUNT),
  );
  assert.ok(hostnames.length > 0, 'no templated hostname patterns found — rewrite this guard');

  const matches = (host: string) =>
    hostnames.some((pattern) => {
      const rx = new RegExp(
        '^' +
          pattern
            .split('.')
            .map((seg) => (seg === '**' ? '.+' : seg === '*' ? '[^.]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
            .join('\\.') +
          '$',
      );
      return rx.test(host);
    });

  assert.ok(
    matches(`setnayan-media.${ACCOUNT}.r2.cloudflarestorage.com`),
    'the media bucket host is not allowed — this is the exact URL the shop logo uses',
  );
  assert.ok(
    matches(`thread-files.${ACCOUNT}.r2.cloudflarestorage.com`),
    'other buckets on the same account must match the same wildcard',
  );
  assert.ok(
    !matches('setnayan-media.someone-elses-account.r2.cloudflarestorage.com'),
    'the wildcard must not open the optimizer to another Cloudflare account',
  );
});
