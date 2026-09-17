import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolvePabuyaQrRef, pabuyaQrAcceptedPolicies } from '@/lib/pabuya-qr-ref';
import { stripComments } from '@/lib/strip-comments';

/**
 * THE GIFT-QR ROUTE SERVES ITS OWN EVENT'S OBJECT, OR NOTHING.
 *
 * The route streams bytes with ADMIN credentials from whatever bucket and key
 * `event_egift_methods.qr_r2_key` names. That column is plain text and
 * `event_egift_methods_host_all` lets a host write their own row, so before
 * this the read side trusted a value the writer had validated and the database
 * had not. The only thing preventing a cross-bucket read was that the
 * legitimate value happened to be the public bucket.
 *
 * 🔑 EXECUTED, NOT GREPPED. `resolvePabuyaQrRef` is pure, so every case below
 * is a real call. The one source assertion at the end only pins that the route
 * actually reaches it.
 */

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
const OTHER = '11111111-2222-3333-4444-555555555555';
const OK = `r2://setnayan-media/events/${EVENT}/pabuya/b4797491-IMG_4424.jpg`;

let cases = 0;
const check = (label: string, fn: () => void) => { cases++; fn(); void label; };

test('the real production ref resolves', () => {
  const ref = resolvePabuyaQrRef(OK, EVENT);
  assert.ok(ref, 'the one live row stopped resolving — this would blank a real gift page');
  assert.equal(ref.bucket, 'setnayan-media');
  assert.equal(ref.key, `events/${EVENT}/pabuya/b4797491-IMG_4424.jpg`);
});

test('🔒 another EVENT’s object is refused, even in the right bucket', () => {
  assert.equal(
    resolvePabuyaQrRef(`r2://setnayan-media/events/${OTHER}/pabuya/x.png`, EVENT),
    null,
    'a host could serve another celebration’s gift QR by writing its key into their own row',
  );
});

test('🔒 another BUCKET is refused — this is the cross-bucket read', () => {
  for (const bucket of [
    'setnayan-thread-files',
    'setnayan-vendor-contracts',
    'setnayan-vendor-verification',
    'setnayan-samples',
  ]) {
    check(bucket, () =>
      assert.equal(
        resolvePabuyaQrRef(`r2://${bucket}/events/${EVENT}/pabuya/x.png`, EVENT),
        null,
        `${bucket} was served through the gift route — admin credentials, arbitrary object`,
      ),
    );
  }
});

test('🔒 another PREFIX in the right bucket and event is refused', () => {
  for (const key of [
    `events/${EVENT}/disputes/evidence.png`,
    `events/${EVENT}/site/hero.jpg`,
    `payment-proof/${EVENT}/receipt.png`,
    `events/${EVENT}/pabuya`, // the bare prefix, no object name
    `events/${EVENT}/pabuya/`,
  ]) {
    check(key, () =>
      assert.equal(
        resolvePabuyaQrRef(`r2://setnayan-media/${key}`, EVENT),
        null,
        `${key} resolved — the prefix check is not holding`,
      ),
    );
  }
});

test('🔒 a non-r2 value is refused — no open redirect, no SSRF', () => {
  for (const v of [
    'https://evil.example/x.png',
    'http://169.254.169.254/latest/meta-data/',
    '//evil.example/x.png',
    'r2://',
    'r2://setnayan-media/',
    '',
  ]) {
    check(v, () =>
      assert.equal(
        resolvePabuyaQrRef(v, EVENT),
        null,
        `${JSON.stringify(v)} resolved — the route would answer it`,
      ),
    );
  }
  assert.equal(resolvePabuyaQrRef(null, EVENT), null);
  assert.equal(resolvePabuyaQrRef(undefined, EVENT), null);
});

test('🔒 a literal ".." segment cannot climb out of the event’s own folder', () => {
  const key = `events/${EVENT}/pabuya/../../${OTHER}/pabuya/x.png`;
  check(key, () =>
    assert.equal(resolvePabuyaQrRef(`r2://setnayan-media/${key}`, EVENT), null, key),
  );
});

test('a percent-encoded ".." is NOT a traversal — and pinning why', () => {
  /*
    ⚠ THIS ASSERTION WAS WRITTEN BACKWARDS FIRST, and the correction is the
    point. `..%2Fx.png` DOES resolve, and that is correct: an R2/S3 key is an
    OPAQUE STRING, not a filesystem path. `%2F` is not a separator to S3 — the
    SDK percent-encodes the key again on the wire — so this names one object
    whose literal name contains those characters, inside this event's own
    prefix. There is nothing to climb out of.

    The prefix check runs on the same literal string the SDK sends, so the two
    cannot disagree. Refusing it would be cargo-cult hardening of a path
    grammar that does not exist here, and would reject a legitimate (if ugly)
    filename. The LITERAL `..` segment is still refused above, because a
    consumer that normalises could differ — that is the real case.
  */
  const ref = resolvePabuyaQrRef(
    `r2://setnayan-media/events/${EVENT}/pabuya/..%2Fx.png`,
    EVENT,
  );
  cases++;
  assert.ok(ref, 'an opaque key was refused as if it were a path');
  assert.ok(
    ref.key.startsWith(`events/${EVENT}/pabuya/`),
    'the resolved key left this event’s own prefix — THAT would be the bug',
  );
});

test('the accepted-policy list is the whole transition surface', () => {
  const policies = pabuyaQrAcceptedPolicies(EVENT);
  assert.ok(policies.length >= 1);
  for (const p of policies) {
    assert.ok(
      p.prefixes.every((x) => x.includes(EVENT) && x.endsWith('/')),
      'a policy admits a prefix that is not this event’s own folder',
    );
  }
});

test('the route actually reaches the resolver, and no longer redirects', () => {
  /* ⚠ COMMENTS STRIPPED. The route's docblock NAMES `parseStoredAsset` while
     explaining why it was removed, so a raw-text check reported the unchecked
     resolver as "back" against correct code — the third time today a guard
     anchored on prose instead of code. */
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/api/pabuya/qr/[publicId]/route.ts'), 'utf8'),
  );
  assert.match(
    src,
    /resolvePabuyaQrRef\(method\.qr_r2_key, method\.event_id\)/,
    'the route does not resolve against its own event',
  );
  assert.ok(
    !src.includes('parseStoredAsset'),
    'the unchecked resolver is back — it answers any bucket and any key',
  );
  assert.ok(
    !/NextResponse\.redirect/.test(src),
    'the open-redirect branch is back: an arbitrary https value in the column becomes a 307 off setnayan.com',
  );
});

test('case count', () => {
  // Print it, so a guard that silently stops exercising cases is visible.
  console.log(`      (${cases} ref cases executed)`);
  assert.ok(cases >= 17, `expected >= 17 executed cases, ran ${cases}`);
});
