/**
 * public-url-takes-a-key-not-a-ref.test.ts
 *
 * A STORED r2:// REFERENCE MUST NEVER REACH AN IMAGE TAG.
 *
 * ## What went wrong (live in production, found 2026-09-10)
 *
 * `vendor_services.primary_photo_r2_key` holds what `<FileUpload>` persists —
 * `r2://setnayan-media/vendors/…/services/….jpg`. Four couple-facing screens
 * handed that whole string to `r2PublicUrl(bucket, KEY)`, which percent-encodes
 * each path segment, so the scheme became part of the object path:
 *
 *     https://<public-host>/r2%3A//setnayan-media/vendors/… → 404
 *     https://<public-host>/vendors/…                        → 200 image/jpeg
 *
 * Measured on the live site before the fix, and against production: the one
 * published service card in the database has a cover, and it was a broken image
 * on Explore, on the couple's vendors tab, and in the wizard's picks.
 *
 * ## Why the existing guard could not see it
 *
 * `stored-asset-render.test.ts` catches a COMPONENT rendering `.logo_url` /
 * `.primary_photo_url` raw. Here the producer DID resolve — through the wrong
 * function — so what reached the component was a perfectly URL-shaped 404.
 * The defect is one layer up, at the call to the URL builder.
 *
 * ## The rule, and why it is DERIVED rather than listed
 *
 * A hand-written list of "the call sites that might hold a ref" is a list of the
 * ones somebody thought of; five of the seven that existed were wrong and two
 * were right, and no reader could tell which was which without tracing each
 * column back to its writer. So the rule is structural instead:
 *
 *   **Application code may not call `r2PublicUrl` / `publicUrlFor` at all.**
 *   Those take an OBJECT KEY. Everything outside the storage layer goes through
 *   `publicUrlForStoredAsset`, which accepts either shape a write path stores.
 *
 * The scan enumerates every `.ts` / `.tsx` under `app/` and `lib/`, so a call
 * site added tomorrow in a file nobody has thought of fails this test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicAssetTarget } from '@/lib/stored-asset-public-url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/**
 * Source with comments removed. Load-bearing: several docblocks legitimately
 * NAME `r2PublicUrl()` while explaining why they no longer call it, and a raw
 * substring scan would report the very files that carry the correction.
 */
function code(abs: string): string {
  return readFileSync(abs, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * The storage layer itself — the only place a bare `(bucket, key)` pair is in
 * scope by construction, so the only place the key-taking builders may be
 * called. `lib/uploads.ts` is on the list because `publicUrlForStoredAsset`
 * lives there and is what everyone else uses.
 */
const STORAGE_LAYER = new Set(['lib/r2.ts', 'lib/storage.ts', 'lib/uploads.ts']);

/** `r2PublicUrl(` / `publicUrlFor(` as a CALL, not as a mention or an import. */
const CALL = /(?<![\w.])(r2PublicUrl|publicUrlFor)\s*\(/;

function census(): { files: string[]; offenders: string[]; sanctioned: string[] } {
  const files: string[] = [];
  const offenders: string[] = [];
  const sanctioned: string[] = [];
  for (const dir of ['app', 'lib']) {
    for (const abs of walk(resolve(WEB, dir))) {
      const rel = relative(WEB, abs);
      files.push(rel);
      const m = CALL.exec(code(abs));
      if (!m) continue;
      if (STORAGE_LAYER.has(rel)) sanctioned.push(rel);
      else offenders.push(`${rel} → ${m[0]}`);
    }
  }
  return { files, offenders, sanctioned };
}

test('no application code calls the key-taking public URL builders', () => {
  const { files, offenders, sanctioned } = census();

  // Anti-vacuity: a walk that finds nothing passes silently and proves nothing.
  assert.ok(files.length > 500, `only ${files.length} source files walked — the walk is wrong`);
  assert.ok(
    sanctioned.length >= 3,
    `expected the storage layer to still call the builders; found ${sanctioned.length}. ` +
      'If they were renamed, this scan is now blind — fix the pattern, do not delete the test.',
  );

  assert.deepEqual(
    offenders,
    [],
    'These call `r2PublicUrl` / `publicUrlFor` directly. Their second argument is an\n' +
      'OBJECT KEY, and the value stored in a `*_r2_key` column may be a full\n' +
      '`r2://bucket/key` REF — which produces `https://<host>/r2%3A//…`, a 404 that\n' +
      'renders as a broken image with nothing thrown. Use\n' +
      '`publicUrlForStoredAsset(storedValue)` from `@/lib/uploads` instead:\n' +
      offenders.map((o) => `  • ${o}`).join('\n'),
  );
});

test('a stored ref and its bare key resolve to the SAME object', () => {
  const key = 'vendors/d266c234/services/427b9c5f-cover.jpg';
  const fromRef = publicAssetTarget(`r2://setnayan-media/${key}`);
  const fromKey = publicAssetTarget(key);
  assert.deepEqual(fromRef, { kind: 'object', bucket: 'setnayan-media', key });
  assert.deepEqual(
    fromKey,
    fromRef,
    'The two write paths store different shapes for the same object — a ref from ' +
      '<FileUpload>, a bare key from uploadPublicAsset. Both must land on one object.',
  );
});

test('a legacy absolute URL passes through untouched', () => {
  for (const url of [
    'https://lh3.googleusercontent.com/a/photo=s96',
    'http://example.test/logo.png',
    '//cdn.example.test/logo.png',
    'data:image/png;base64,iVBOR',
  ]) {
    assert.deepEqual(
      publicAssetTarget(url),
      { kind: 'passthrough', url },
      `${url} is already an address — building a key-URL from it would break it`,
    );
  }
});

test('anything that cannot be addressed publicly resolves to null, never to a 404', () => {
  const unaddressable = [
    null,
    undefined,
    '',
    '   ',
    // The four private buckets are never publicly readable — a public URL for
    // one looks resolved and can never load.
    'r2://setnayan-thread-files/payments/o1/receipt.png',
    'r2://setnayan-vendor-contracts/paperwork/e1/psa.pdf',
    'r2://setnayan-vendor-verification/vendors/v1/dti.jpg',
    'r2://setnayan-samples/taxonomy/x.png',
    // Typo'd / unknown bucket, and malformed refs.
    'r2://setnayan-medi/vendors/x.jpg',
    'r2://setnayan-media',
    'r2://setnayan-media/',
    'r2:///key-with-no-bucket.jpg',
  ];
  for (const v of unaddressable) {
    assert.equal(publicAssetTarget(v), null, `${String(v)} must not produce a public URL`);
  }
});

test('the resolver is what the fixed call sites actually use', () => {
  // The census above proves nobody calls the raw builders. This proves the
  // replacement is present at the four couple-facing covers rather than the
  // photo having simply been deleted from the screen.
  const sites: ReadonlyArray<readonly [string, RegExp]> = [
    ['app/(shell)/explore/page.tsx', /publicUrlForStoredAsset\(svc\.photoR2Key\)/],
    [
      'app/dashboard/[eventId]/vendors/page.tsx',
      /publicUrlForStoredAsset\(row\.primary_photo_r2_key\)/,
    ],
    ['lib/wizard-recommendations.ts', /publicUrlForStoredAsset\(firstPhotoKey\)/],
    [
      'lib/wizard-recommendations.ts',
      /publicUrlForStoredAsset\(p\.primary_photo_r2_key\)/,
    ],
  ];
  for (const [rel, re] of sites) {
    assert.match(
      code(resolve(WEB, rel)),
      re,
      `${rel} must resolve its cover through publicUrlForStoredAsset`,
    );
  }
});
