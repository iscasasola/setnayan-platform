/**
 * Unit suite for the website-media read side.
 *
 * These are SAFETY properties, and most of them assert what the module REFUSES
 * to do. Three of them exist because an adversarial review found the first
 * revision failing them:
 *
 *   • THE PREFIXES MUST BE THE ONES THE APP ACTUALLY WRITES. The first revision
 *     guessed `homepage-background-videos/` from a module name; the uploader
 *     writes `homepage-bg/slot-N/`, so the allowlist matched zero objects and
 *     the page silently did nothing.
 *   • A FAILED LOOKUP YIELDS `unknown`, NEVER `unreferenced` — a denied or
 *     broken read must not present a whole folder as safe to wipe.
 *   • ONLY PROVEN-LEFTOVER IS DELETABLE. The first revision allowed deleting
 *     `unknown` files behind a warning, and a LIVE file (the onboarding
 *     background music) sat in an unresolved folder under prose calling it
 *     "probably left over". Prose is not a safety mechanism.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertDeletableKey,
  classifyGroup,
  formatStoredDate,
  humanBytes,
  isDeletableUsage,
  isSiteMediaKey,
  keyFromRef,
  prefixFor,
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

test('the allowlist holds the prefixes the app ACTUALLY writes', () => {
  // Ground truth, from the presignAndPut/pathPrefix call sites:
  //   background-videos-manager.tsx  `homepage-bg/slot-${slot}`
  //   hero-uploader.tsx              'hero-videos' · `hero-frames/${sessionId}`
  //   onboarding-surface.tsx         pathPrefix="onboarding/background-music"
  //   admin/settings/actions.ts      `brand-icon/${randomUUID()}`
  //   admin/menus/actions.ts         `nav-icons/${slot}-${randomUUID()}.${ext}`
  const prefixes = SITE_MEDIA_PREFIXES.map((p) => p.prefix).sort();
  assert.deepEqual(prefixes, [
    'brand-icon/',
    'hero-frames/',
    'hero-videos/',
    'homepage-bg/',
    'nav-icons/',
    'onboarding/',
  ]);

  // The exact keys those call sites mint must be recognised.
  for (const key of [
    'homepage-bg/slot-0/abc-hero.mp4',
    'hero-videos/abc-hero.mp4',
    'hero-frames/sess123/frame-001.jpg',
    'onboarding/background-music/abc-track.mp3',
    'brand-icon/uuid-1/favicon.ico',
    'nav-icons/guests-uuid.svg',
  ]) {
    assert.equal(isSiteMediaKey(key), true, key);
  }
});

test('customer and financial content is NOT reachable from this surface', () => {
  // Real prefixes in the SAME bucket, from their own upload call sites.
  for (const key of [
    'events/EVT123/photo.jpg',
    'living-heroes/abc-hero.mp4',
    'locked-qr-proof/abc.png',
    'merchant-qr/gcash/abc.png',
    'editorial-vendor/abc.jpg',
    'papic/EVT123/photo.jpg',
    'payment-screenshots/ORD1.png',
  ]) {
    assert.equal(isSiteMediaKey(key), false, key);
    assert.throws(() => assertDeletableKey(key), /not website media/, key);
  }
});

test('a key cannot climb out of an allowlisted prefix', () => {
  assert.throws(
    () => assertDeletableKey('brand-icon/../events/EVT123/photo.jpg'),
    /malformed/,
  );
  assert.throws(() => assertDeletableKey('/brand-icon/mark.svg'), /malformed/);
  assert.throws(() => assertDeletableKey(''), /malformed/);
});

test('a prefix that merely STARTS like an allowlisted one is refused', () => {
  assert.equal(isSiteMediaKey('onboarding-drafts/user.png'), false);
  assert.equal(isSiteMediaKey('hero-videos-archive/old.mp4'), false);
  assert.equal(isSiteMediaKey('brand-iconography/x.svg'), false);
  assert.equal(isSiteMediaKey('nav-icons-backup/x.svg'), false);
  assert.throws(() => assertDeletableKey('onboarding-drafts/user.png'));
});

test('every allowlisted prefix ends in a slash — the guard depends on it', () => {
  // Without the trailing slash, `onboarding` would also match `onboarding-drafts/`.
  for (const p of SITE_MEDIA_PREFIXES) {
    assert.ok(p.prefix.endsWith('/'), p.prefix);
  }
});

test('prefixFor returns the owning entry, or null', () => {
  assert.equal(prefixFor('homepage-bg/slot-1/a.mp4')?.prefix, 'homepage-bg/');
  assert.equal(prefixFor('events/EVT1/a.jpg'), null);
});

/* ------------------------------------------------- what may be deleted at all */

test('🔑 ONLY proven-leftover is deletable — "not sure" is refused like "in use"', () => {
  assert.equal(isDeletableUsage('unreferenced'), true);
  assert.equal(isDeletableUsage('in-use'), false);
  assert.equal(
    isDeletableUsage('unknown'),
    false,
    'an unchecked file must never be deletable — this is the property whose absence ' +
      'put a live audio track behind an enabled Delete button',
  );
});

/* -------------------------------------------------- reference key extraction */

test('keyFromRef recovers keys from the shapes actually stored', () => {
  // Bare key
  assert.equal(keyFromRef('hero-frames/s1/f-001.jpg'), 'hero-frames/s1/f-001.jpg');
  // r2:// ref
  assert.equal(
    keyFromRef('r2://setnayan-media/onboarding/background-music/t.mp3'),
    'onboarding/background-music/t.mp3',
  );
  // Public URL
  assert.equal(
    keyFromRef('https://cdn.setnayan.com/hero-frames/s1/f-002.jpg'),
    'hero-frames/s1/f-002.jpg',
  );
  // Signed URL with query + bucket segment
  assert.equal(
    keyFromRef(
      'https://acct.r2.cloudflarestorage.com/setnayan-media/brand-icon/u1/favicon.ico?X-Amz-Signature=deadbeef',
    ),
    'brand-icon/u1/favicon.ico',
  );
  // Percent-encoded
  assert.equal(
    keyFromRef('https://cdn.setnayan.com/hero-videos/my%20hero.mp4'),
    'hero-videos/my hero.mp4',
  );
});

test('keyFromRef returns null rather than guessing', () => {
  assert.equal(keyFromRef(''), null);
  assert.equal(keyFromRef('https://example.com/nothing/here.jpg'), null);
  assert.equal(keyFromRef('r2://setnayan-media'), null);
});

/* ------------------------------------------------------------ classification */

test('a successful lookup separates in-use from unreferenced', () => {
  const lookup: ReferenceLookup = {
    ok: true,
    keys: new Set(['homepage-bg/slot-0/live.mp4']),
  };
  const group = classifyGroup({
    prefix,
    objects: [obj('homepage-bg/slot-0/live.mp4', 500), obj('homepage-bg/slot-0/old.mp4', 900)],
    lookup,
  });

  assert.equal(group.counts['in-use'], 1);
  assert.equal(group.counts.unreferenced, 1);
  assert.equal(group.counts.unknown, 0);
  assert.equal(group.totalBytes, 1400);
  // Biggest first — the page exists to reclaim space.
  assert.equal(group.rows[0]!.key, 'homepage-bg/slot-0/old.mp4');
});

test('🔑 a FAILED lookup marks everything unknown, never unreferenced', () => {
  const group = classifyGroup({
    prefix,
    objects: [obj('homepage-bg/slot-0/a.mp4'), obj('homepage-bg/slot-1/b.mp4')],
    lookup: { ok: false, reason: 'database read failed' },
  });

  assert.equal(group.counts.unknown, 2);
  assert.equal(
    group.counts.unreferenced,
    0,
    'a failed read must never present files as safe to delete',
  );
  assert.equal(group.lookupFailure, 'database read failed');
  for (const r of group.rows) {
    assert.equal(r.unknownReason, 'database read failed');
    assert.equal(isDeletableUsage(r.usage), false);
  }
});

test('an EMPTY successful lookup is honoured — it is a real answer', () => {
  // Distinct from the failure above: the resolver ran and found no references.
  const group = classifyGroup({
    prefix,
    objects: [obj('homepage-bg/slot-0/orphan.mp4')],
    lookup: { ok: true, keys: new Set() },
  });
  assert.equal(group.counts.unreferenced, 1);
  assert.equal(group.counts.unknown, 0);
});

test('truncation and listing errors are carried on the group', () => {
  const g = classifyGroup({
    prefix,
    objects: [obj('homepage-bg/slot-0/a.mp4')],
    lookup: { ok: true, keys: new Set() },
    truncated: true,
    listingError: 'network',
  });
  assert.equal(g.truncated, true);
  assert.equal(g.listingError, 'network');
});

/* -------------------------------------------------------------------- totals */

test('only PROVEN-unreferenced bytes count as reclaimable', () => {
  const proven = classifyGroup({
    prefix,
    objects: [obj('homepage-bg/slot-0/a.mp4', 1000)],
    lookup: { ok: true, keys: new Set() },
  });
  const guessed = classifyGroup({
    prefix: SITE_MEDIA_PREFIXES[1]!,
    objects: [obj('hero-videos/b.mp4', 5000)],
    lookup: { ok: false, reason: 'read failed' },
  });

  const s = summarize([proven, guessed]);
  assert.equal(s.fileCount, 2);
  assert.equal(s.totalBytes, 6000);
  assert.equal(s.reclaimableBytes, 1000, 'unknown bytes are not reclaimable');
  assert.equal(s.reclaimableCount, 1);
  assert.equal(s.unknownCount, 1);
});

test('🔑 totals declare themselves INCOMPLETE when a folder was truncated or failed', () => {
  const clean = classifyGroup({
    prefix,
    objects: [obj('homepage-bg/slot-0/a.mp4', 10)],
    lookup: { ok: true, keys: new Set() },
  });
  assert.equal(summarize([clean]).incomplete, false);

  const cut = classifyGroup({
    prefix,
    objects: [obj('homepage-bg/slot-0/a.mp4', 10)],
    lookup: { ok: true, keys: new Set() },
    truncated: true,
  });
  assert.equal(
    summarize([cut]).incomplete,
    true,
    'a truncated listing makes "Space used" a floor, and the page must say so',
  );

  const failed = classifyGroup({
    prefix,
    objects: [],
    lookup: { ok: false, reason: 'x' },
    listingError: 'denied',
  });
  assert.equal(summarize([failed]).incomplete, true);
});

/* ------------------------------------------------------------------ display */

test('humanBytes reads plainly', () => {
  assert.equal(humanBytes(1_500_000_000), '1.50 GB');
  assert.equal(humanBytes(2_400_000), '2.4 MB');
  assert.equal(humanBytes(4_096), '4 KB');
  assert.equal(humanBytes(12), '12 bytes');
});

test('dates format identically regardless of the runtime timezone', () => {
  // Pinned to Asia/Manila: the same instant must render the same string on the
  // server (UTC on Vercel) and in the browser, or hydration mismatches.
  const iso = '2026-08-01T23:30:00.000Z'; // 07:30 next day in Manila
  assert.equal(formatStoredDate(iso), 'Aug 2, 2026');
  assert.equal(formatStoredDate(null), '—');
  assert.equal(formatStoredDate('not-a-date'), '—');
});
