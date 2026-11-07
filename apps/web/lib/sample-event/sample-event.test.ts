/**
 * 🎭 The Maria and Jose sample's read path and gate — the pure halves.
 *
 *   (a) a real event's id under /sample never resolves — only the sample's own
 *       key returns the sample; every other key is `null` (→ 404);
 *   (b) the sample's id can never name a real event — it is no uuid, no S89E
 *       public id and no slug, so it cannot match or cast to a row;
 *   (e) the native app shell is bounced from every /sample path while `/` is
 *       held back for Apple review, and only then;
 *   (f) with the switch off, only an internal account opens it.
 *
 * The source-level seals (no server action, noindex, the sitemaps, the
 * catch-all, middleware wiring) are `app/sample/the-sample-is-sealed.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isUuid } from '@/lib/is-uuid';
import { readSampleEvent, readSampleGuest, isSampleEventId, SAMPLE_EVENT_ID } from './snapshot';
import { sampleOpensFor } from './gate';
import { isSamplePath, SAMPLE_ROOT } from './paths';
import { stripComments } from '@/lib/strip-comments';

const REAL_LOOKING_KEYS = [
  '5599d399-b4f8-459d-9080-8069824dec96', // a uuid
  '00000000-0000-0000-0000-000000000000',
  'S89E-7K3M9Q2W4X', // an S89E public id
  'maria-and-jose', // the old real sample event's slug
  'sample-maria-and-jose',
  'maria',
  '',
  ' sample:maria-and-jose',
  'sample:maria-and-jose ',
  'SAMPLE:MARIA-AND-JOSE',
  'sample:maria-and-jose/',
];

test('(a) only the sample’s own key returns the sample; every real-looking key is null', () => {
  const snap = readSampleEvent(SAMPLE_EVENT_ID);
  assert.ok(snap, 'the sample key must return the sample');
  assert.equal(snap.id, SAMPLE_EVENT_ID);
  for (const key of REAL_LOOKING_KEYS) {
    assert.equal(readSampleEvent(key), null, `key ${JSON.stringify(key)} resolved under /sample`);
    assert.equal(isSampleEventId(key), false);
  }
  for (const key of [null, undefined, 0, {}, [SAMPLE_EVENT_ID]]) {
    assert.equal(readSampleEvent(key), null, `non-string key ${String(key)} resolved`);
  }
});

test('(b) the sample’s id can never name a real event (no uuid, public id or slug shape)', () => {
  assert.equal(isUuid(SAMPLE_EVENT_ID), false, 'a uuid-shaped sample id could match a real events row');
  assert.doesNotMatch(SAMPLE_EVENT_ID, /^S89[A-Z]-[0-9A-Z]{10}$/, 'a public-id-shaped sample id could match a real event');
  assert.doesNotMatch(SAMPLE_EVENT_ID, /^[a-z0-9-]+$/, 'a slug-shaped sample id could match a real event’s address');
  // And the snapshot is the sample, never a real event's row passed through.
  const snap = readSampleEvent(SAMPLE_EVENT_ID)!;
  assert.equal(snap.stage, 'preparation', 'the sample is always in preparation');
  assert.equal(snap.personas.length, 3, 'three personas: a guest, a guest with a role, the host');
  assert.ok(Object.isFrozen(snap), 'the shared snapshot must be frozen — a visitor’s edit may never reach the next visitor');
});

test('(f) switch off → only internal accounts; switch on → everyone; the app shell → never', () => {
  assert.equal(sampleOpensFor({ webShell: true, switchOn: false, internal: false }), false, 'switch off opened for a stranger');
  assert.equal(sampleOpensFor({ webShell: true, switchOn: false, internal: true }), true, 'internal must see it while off');
  assert.equal(sampleOpensFor({ webShell: true, switchOn: true, internal: false }), true);
  for (const switchOn of [true, false]) {
    for (const internal of [true, false]) {
      assert.equal(sampleOpensFor({ webShell: false, switchOn, internal }), false, 'the app shell opened the sample');
    }
  }
});

test('(e) the sample follows `/` into the app (owner 2026-11-02): it opens wherever Discover opens, under its own switch', () => {
  // The prefix match the sample is reached by — and nothing that merely starts with the word.
  for (const p of [SAMPLE_ROOT, '/sample/', '/sample/hub/sample-guest-maid-of-honor', '/sample/dashboard/guests']) {
    assert.equal(isSamplePath(p), true, `${p} is the sample`);
  }
  for (const p of ['/samples', '/sampler', '/maria-and-jose', '/', '/dashboard']) {
    assert.equal(isSamplePath(p), false, `${p} is not the sample`);
  }
  // While Apple reviewed 1.0 middleware bounced the sample out of the app by prefix for as long as `/` was bounced
  // (`appShellBouncesSample`). `/` left on 2026-11-02 ("let everything go live"), and the sample followed it: there is
  // no native-shell bounce left in middleware, and the sample's "is this a browser?" fact IS "does Discover open
  // here?" — which now answers yes in the app too.
  const WEB = join(__dirname, '..', '..');
  const mw = stripComments(readFileSync(join(WEB, 'middleware.ts'), 'utf8'));
  assert.doesNotMatch(mw, /appShellBouncesSample|APP_EXCLUDED_MARKETING_PATHS|isCapacitorClient|SetnayanApp|setnayan-client-type/, 'middleware bounces the app again');
  const sw = stripComments(readFileSync(join(WEB, 'lib/sample-event/switch.server.ts'), 'utf8'));
  assert.match(sw, /const webShell = await discoverOpensHere\(\);\s*if \(!webShell\) return false;/, 'the sample no longer follows `/`');
  // So in the app the switch decides, exactly as on the web.
  assert.equal(sampleOpensFor({ webShell: true, switchOn: true, internal: false }), true);
  assert.equal(sampleOpensFor({ webShell: true, switchOn: false, internal: false }), false);
});

test('(a) /sample/hub/[guestKey] resolves only a sample guest — the two personas today — never a real guest’s key', () => {
  const sample = readSampleEvent(SAMPLE_EVENT_ID)!;
  for (const key of ['sample-guest-bride-cousin', 'sample-guest-maid-of-honor']) {
    const g = readSampleGuest(key);
    assert.ok(g, `persona guest ${key} must resolve`);
    assert.equal(g.guestKey, key);
    assert.equal(isUuid(g.guest_id), false, 'a uuid-shaped sample guest id could match a real guests row');
    assert.doesNotMatch(g.guest_id, /^S89[A-Z]-[0-9A-Z]{10}$/);
    assert.doesNotMatch(g.guest_id, /^[a-z0-9-]+$/, 'a slug-shaped guest id could match a real key');
    assert.ok(Object.isFrozen(g));
  }
  for (const p of sample.personas) {
    if (p.guestKey) assert.ok(readSampleGuest(p.guestKey), `persona ${p.key} opens a guest that is not in the fixture`);
  }
  assert.equal(readSampleGuest('sample-guest-maid-of-honor')!.role, 'maid_of_honor', 'persona 2 is the maid of honor (the bride’s sister)');
  for (const key of [
    '5599d399-b4f8-459d-9080-8069824dec96',
    'S89G-7K3M9Q2W4X',
    'sample:sample-guest-bride-cousin',
    'SAMPLE-GUEST-BRIDE-COUSIN',
    ' sample-guest-bride-cousin',
    'sample-guest-preview',
    'constructor',
    '__proto__',
    'toString',
    '',
  ]) {
    assert.equal(readSampleGuest(key), null, `guest key ${JSON.stringify(key)} resolved under /sample/hub`);
  }
  assert.equal(readSampleGuest(undefined), null);
});
