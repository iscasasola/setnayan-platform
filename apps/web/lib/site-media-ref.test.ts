/**
 * WEBSITE MEDIA IS SIGNED ONLY FROM THE PUBLIC BUCKET (lib/site-media-ref.ts).
 *
 * The property that matters is not "a private ref returns null" for the inputs
 * someone thought of — it is that NOTHING this function returns can be parsed,
 * by the resolver that signs it, as a ref into a private bucket. The resolver
 * (`parseStoredAsset`, lib/uploads.ts — server-only, so restated below from its
 * source) trims and then reads `r2://<bucket>/…`; so every output must be
 * trim-stable and, if it is a ref at all, a media-bucket one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { siteMediaServeRef, siteMediaServeRefs } from './site-media-ref';

/** What the signer would sign — `parseStoredAsset`'s rule, verbatim in behaviour. */
function bucketTheSignerWouldSign(value: string | null): string | null {
  if (value === null) return null;
  const t = value.trim();
  if (!t.startsWith('r2://')) return null; // legacy passthrough: never signed
  const rest = t.slice('r2://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  return rest.slice(0, slash);
}

const WS = ['', ' ', '\t', '\n', '\u00a0', '\ufeff', '\u2028', '\u3000', '\u200b'];
const BUCKETS = [
  'setnayan-thread-files',
  'setnayan-vendor-verification',
  'setnayan-vendor-contracts',
  'setnayan-samples',
  'some-unknown-bucket',
  'setnayan-media',
];
const SCHEMES = ['r2://', 'R2://', 'r2:/', 'r2:///'];

function corpus(): string[] {
  const out: string[] = [];
  for (const lead of WS) {
    for (const trail of WS) {
      for (const scheme of SCHEMES) {
        for (const bucket of BUCKETS) {
          out.push(`${lead}${scheme}${bucket}/payment-proof/x.png${trail}`);
        }
      }
      out.push(`${lead}https://example.com/x.jpg${trail}`);
      out.push(`${lead}/demo/hero.jpg${trail}`);
    }
  }
  return out;
}

test('PROPERTY: no output can be signed as a private-bucket object, and every output is trim-stable', () => {
  let signedMedia = 0;
  for (const input of corpus()) {
    const out = siteMediaServeRef(input);
    if (out === null) continue;
    assert.equal(out, out.trim(), `not trim-stable: ${JSON.stringify(input)}`);
    const bucket = bucketTheSignerWouldSign(out);
    assert.ok(bucket === null || bucket === 'setnayan-media', `would sign ${bucket} for ${JSON.stringify(input)}`);
    if (bucket === 'setnayan-media') signedMedia += 1;
  }
  assert.ok(signedMedia > 0, 'anti-vacuity: the corpus must include media refs that ARE signed');
});

test('each private bucket, an unknown bucket and a malformed ref resolve to nothing', () => {
  for (const bad of [
    'r2://setnayan-thread-files/payment-proof/events/x/proof.png',
    'r2://setnayan-vendor-verification/vendors/x/verification/gov.png',
    'r2://setnayan-vendor-contracts/x.pdf',
    'r2://setnayan-samples/x.png',
    'r2://nope/x.png',
    'r2://setnayan-media/',
    'r2:///x.png',
    '\ufeffr2://setnayan-thread-files/chat/x/receipt.png',
    '\u00a0r2://setnayan-thread-files/chat/x/receipt.png',
    ' r2://setnayan-thread-files/chat/x/receipt.png',
  ]) {
    assert.equal(siteMediaServeRef(bad), null, JSON.stringify(bad));
  }
  for (const v of [null, undefined, 42, {}, [], '', '   ']) {
    assert.equal(siteMediaServeRef(v), null, JSON.stringify(v));
  }
});

test('the public bucket and plain URLs are served exactly as before (no regression)', () => {
  assert.equal(
    siteMediaServeRef('r2://setnayan-media/events/e/landing-page-hero/a.jpg'),
    'r2://setnayan-media/events/e/landing-page-hero/a.jpg',
  );
  assert.equal(siteMediaServeRef('r2://setnayan-media/living-heroes/u-hero.jpg'), 'r2://setnayan-media/living-heroes/u-hero.jpg');
  assert.equal(siteMediaServeRef('  /demo/hero.jpg '), '/demo/hero.jpg');
  assert.equal(siteMediaServeRef('https://example.com/x.jpg'), 'https://example.com/x.jpg');
  // `R2://` is not a ref to the resolver either — passed through as a dead URL,
  // never signed. Held here so a later "normalise the scheme" change is a
  // visible decision (it would have to widen the allow-list with it).
  assert.equal(bucketTheSignerWouldSign(siteMediaServeRef('R2://setnayan-thread-files/x.png')), null);
});

test('arrays keep only servable strings, in order', () => {
  assert.deepEqual(
    siteMediaServeRefs([
      'r2://setnayan-media/events/e/our-photos/a.jpg',
      'r2://setnayan-thread-files/payment-proof/x.png',
      7,
      '',
      '/demo/b.jpg',
    ]),
    ['r2://setnayan-media/events/e/our-photos/a.jpg', '/demo/b.jpg'],
  );
  assert.deepEqual(siteMediaServeRefs('r2://setnayan-media/x.jpg'), []);
  assert.deepEqual(siteMediaServeRefs(null), []);
});

/**
 * The database's twin: `events_site_media_names_only_the_public_bucket` uses
 * one allow-list regex, anchored at the first character. Every value that
 * regex ADMITS must be one this function would never sign into a private
 * bucket — so the write side can never store something the serve side would
 * have had to catch.
 */
test('every value the database’s CHECK admits is one the serve side would never sign privately', () => {
  const dir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_a_render_key_is_its_own.sql'));
  assert.ok(file);
  const sql = readFileSync(join(dir, file), 'utf8');
  const patterns = [...sql.matchAll(/~ '(\^\(r2:\/\/setnayan-media\/[^']+)'/g)].map((m) => m[1]!);
  assert.ok(patterns.length >= 4, `expected the allow-list on every text column, found ${patterns.length}`);
  assert.equal(new Set(patterns).size, 1, 'every column must use the SAME allow-list');
  // POSIX `~` and JS RegExp agree on this ASCII-only pattern (literal chars, `?`, `|`, ` *$`).
  const re = new RegExp(patterns[0]!);
  let admitted = 0;
  for (const input of corpus()) {
    if (!re.test(input)) continue;
    admitted += 1;
    const bucket = bucketTheSignerWouldSign(input);
    assert.ok(
      bucket === null || bucket === 'setnayan-media',
      `the CHECK admits ${JSON.stringify(input)}, which the resolver would sign from ${bucket}`,
    );
  }
  assert.ok(admitted > 0, 'anti-vacuity: the CHECK must admit something');
});
