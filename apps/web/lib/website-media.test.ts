/**
 * Unit suite for the website-media read side.
 *
 * The two properties worth testing are both SAFETY properties, and both are
 * about what the module refuses to do:
 *
 *   • the allowlist genuinely excludes customer content — no key under a
 *     guest-photo / payment / verification prefix is ever deletable, including
 *     the traversal and prefix-confusion shapes that look allowlisted; and
 *   • a failed reference lookup yields `unknown`, never `unreferenced`, so a
 *     broken or denied read can never present a whole folder as safe to wipe.
 *
 * The second is the one that would actually cost data: an RLS denial and an
 * empty read are the same value, so "nothing came back" must never be allowed
 * to mean "nothing is used".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertDeletableKey,
  classifyGroup,
  humanBytes,
  isSiteMediaKey,
  SITE_MEDIA_PREFIXES,
  summarize,
  type ReferenceLookup,
  type StoredObject,
} from './website-media';

const prefix = SITE_MEDIA_PREFIXES[0]!;

const obj = (key: string, size = 100): StoredObject => ({
  key,
  size,
  lastModified: null,
});

/* ---------------------------------------------------------------- allowlist */

test('site-media keys are accepted', () => {
  assert.equal(isSiteMediaKey('homepage-background-videos/hero.mp4'), true);
  assert.equal(isSiteMediaKey('onboarding/cities/manila.webp'), true);
  assert.equal(isSiteMediaKey('brand/mark.svg'), true);
});

test('customer content is NOT reachable from this surface', () => {
  // Every one of these is real user data living in the same bucket.
  for (const key of [
    'papic/EVT123/photo.jpg',
    'captures/EVT123/clip.mp4',
    'payment-screenshots/ORD1.png',
    'vendor-verification/gov-id.pdf',
    'thread-files/contract.pdf',
    'gallery/EVT123/001.jpg',
  ]) {
    assert.equal(isSiteMediaKey(key), false, key);
    assert.throws(() => assertDeletableKey(key), /not website media/, key);
  }
});

test('a key cannot climb out of an allowlisted prefix', () => {
  assert.throws(
    () => assertDeletableKey('brand/../papic/EVT123/photo.jpg'),
    /malformed/,
  );
  assert.throws(() => assertDeletableKey('/brand/mark.svg'), /malformed/);
  assert.throws(() => assertDeletableKey(''), /malformed/);
});

test('a prefix that merely STARTS like an allowlisted one is refused', () => {
  // `brand-ambassador-uploads/` shares a stem with `brand/` but is not it.
  assert.equal(isSiteMediaKey('brand-ambassador-uploads/id.jpg'), false);
  assert.equal(isSiteMediaKey('onboarding-drafts/user.png'), false);
  assert.throws(() => assertDeletableKey('brand-ambassador-uploads/id.jpg'));
});

test('every allowlisted prefix ends in a slash — the guard depends on it', () => {
  // Without the trailing slash, `brand` would also match `brand-ambassador/`.
  for (const p of SITE_MEDIA_PREFIXES) {
    assert.ok(p.prefix.endsWith('/'), p.prefix);
  }
});

/* ------------------------------------------------------------ classification */

test('a successful lookup separates in-use from unreferenced', () => {
  const lookup: ReferenceLookup = {
    ok: true,
    keys: new Set(['homepage-background-videos/live.mp4']),
  };
  const group = classifyGroup({
    prefix,
    objects: [
      obj('homepage-background-videos/live.mp4', 500),
      obj('homepage-background-videos/replaced.mp4', 900),
    ],
    lookup,
  });

  assert.equal(group.counts['in-use'], 1);
  assert.equal(group.counts.unreferenced, 1);
  assert.equal(group.counts.unknown, 0);
  assert.equal(group.totalBytes, 1400);
  // Biggest first — the page exists to reclaim space.
  assert.equal(group.rows[0]!.key, 'homepage-background-videos/replaced.mp4');
});

test('🔑 a FAILED lookup marks everything unknown, never unreferenced', () => {
  const group = classifyGroup({
    prefix,
    objects: [obj('homepage-background-videos/a.mp4'), obj('homepage-background-videos/b.mp4')],
    lookup: { ok: false, reason: 'database read failed' },
  });

  assert.equal(group.counts.unknown, 2);
  assert.equal(
    group.counts.unreferenced,
    0,
    'a failed read must never present files as safe to delete',
  );
  assert.equal(group.lookupFailure, 'database read failed');
  for (const r of group.rows) assert.equal(r.unknownReason, 'database read failed');
});

test('an EMPTY successful lookup is honoured — it is a real answer', () => {
  // Distinct from the failure above: the resolver ran and found no references.
  const group = classifyGroup({
    prefix,
    objects: [obj('homepage-background-videos/orphan.mp4')],
    lookup: { ok: true, keys: new Set() },
  });
  assert.equal(group.counts.unreferenced, 1);
  assert.equal(group.counts.unknown, 0);
});

test('no objects is not an error', () => {
  const group = classifyGroup({
    prefix,
    objects: [],
    lookup: { ok: true, keys: new Set() },
  });
  assert.deepEqual(group.rows, []);
  assert.equal(group.totalBytes, 0);
});

/* -------------------------------------------------------------------- totals */

test('only PROVEN-unreferenced bytes count as reclaimable', () => {
  const proven = classifyGroup({
    prefix,
    objects: [obj('homepage-background-videos/a.mp4', 1000)],
    lookup: { ok: true, keys: new Set() },
  });
  const guessed = classifyGroup({
    prefix: SITE_MEDIA_PREFIXES[1]!,
    objects: [obj('hero-videos/b.mp4', 5000)],
    lookup: { ok: false, reason: 'no resolver' },
  });

  const s = summarize([proven, guessed]);
  assert.equal(s.fileCount, 2);
  assert.equal(s.totalBytes, 6000);
  assert.equal(s.reclaimableBytes, 1000, 'unknown bytes are not reclaimable');
  assert.equal(s.reclaimableCount, 1);
  assert.equal(s.unknownCount, 1);
});

test('humanBytes reads plainly', () => {
  assert.equal(humanBytes(1_500_000_000), '1.50 GB');
  assert.equal(humanBytes(2_400_000), '2.4 MB');
  assert.equal(humanBytes(4_096), '4 KB');
  assert.equal(humanBytes(12), '12 bytes');
});
