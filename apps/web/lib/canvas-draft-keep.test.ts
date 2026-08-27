/**
 * canvas-draft-keep.test.ts — what a supplier gets back, and what they must not.
 *
 * 🔴 WHY IT EXISTS (owner 2026-08-28: *"add it"*). The maker saves in one
 * submit, so a lost signal took the photo, the sentence and the price with it
 * and said nothing. What is typed is now held in the vendor's OWN BROWSER and
 * offered back — never written to our database, where an autosave would mint a
 * junk card row per abandoned attempt, in the shop's list and in the caps that
 * count cards.
 *
 * ⚖ THE ASSERTIONS THAT MATTER MOST ARE THE REFUSALS: a keep from another
 * version, a keep past its week, a keep of a blank card, and any malformed
 * thing at all must all come back as "nothing kept" rather than as a card.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KEEP_MAX_BYTES,
  KEEP_TTL_MS,
  KEEP_VERSION,
  keepAgeLabel,
  keepHasContent,
  keepStorageKey,
  readKeep,
  serializeKeep,
  type CanvasKeep,
} from '@/lib/canvas-draft-keep';

// ⚠ Asserted first: under `tsx --test` an `@/lib/…` import has come back with
// EMPTY named exports in this repo, and a guard whose subject is `undefined`
// runs zero checks and reports a pass.
test('the module under test actually loaded', () => {
  assert.equal(typeof readKeep, 'function');
  assert.equal(typeof serializeKeep, 'function');
  assert.equal(KEEP_VERSION, 1);
});

const NOW = 1_800_000_000_000;
const keep = (over: Partial<CanvasKeep> = {}): CanvasKeep => ({
  v: KEEP_VERSION,
  at: NOW - 60_000,
  category: 'catering',
  fields: [['title', 'Kainang Handa']],
  ...over,
});

test('a keep from a minute ago comes back whole', () => {
  const back = readKeep(JSON.stringify(keep()), NOW);
  assert.ok(back, 'a fresh keep was thrown away');
  assert.equal(back.category, 'catering');
  assert.deepEqual(back.fields, [['title', 'Kainang Handa']]);
});

test('two shops on one browser never see each other', () => {
  assert.notEqual(keepStorageKey('shop-a'), keepStorageKey('shop-b'));
  assert.match(keepStorageKey('shop-a'), /shop-a/);
});

test('a keep past its week is gone', () => {
  const stale = JSON.stringify(keep({ at: NOW - KEEP_TTL_MS - 1 }));
  assert.equal(readKeep(stale, NOW), null, 'a week-old card was offered back');
  // …and one a second inside the window is not.
  assert.ok(readKeep(JSON.stringify(keep({ at: NOW - KEEP_TTL_MS + 1000 })), NOW));
});

test('a keep from an older shape is dropped, never guessed at', () => {
  assert.equal(readKeep(JSON.stringify(keep({ v: 0 })), NOW), null);
  assert.equal(readKeep(JSON.stringify(keep({ v: 99 })), NOW), null);
});

test('a keep of a blank card is not offered', () => {
  // "Pick up where you left off" pointing at nothing is worse than no offer.
  assert.equal(readKeep(JSON.stringify(keep({ category: '', fields: [['title', '   ']] })), NOW), null);
  assert.equal(keepHasContent(keep({ category: '', fields: [] })), false);
  assert.equal(keepHasContent(keep({ category: '', fields: [['title', 'x']] })), true);
});

test('nothing malformed ever throws — the caller is a render path', () => {
  for (const raw of [
    null,
    '',
    'not json',
    '{',
    '[]',
    'null',
    '{"v":1}',
    JSON.stringify({ v: KEEP_VERSION, at: 'soon', category: 'x', fields: [] }),
    JSON.stringify({ v: KEEP_VERSION, at: NOW, category: 5, fields: [] }),
    JSON.stringify({ v: KEEP_VERSION, at: NOW, category: 'x', fields: 'nope' }),
    JSON.stringify({ v: KEEP_VERSION, at: NOW, category: 'x', fields: [['only-one']] }),
    JSON.stringify({ v: KEEP_VERSION, at: NOW, category: 'x', fields: [[1, 2]] }),
  ]) {
    assert.equal(readKeep(raw as string | null, NOW), null, `${String(raw)} came back as a card`);
  }
});

test('a runaway form is not held at all, rather than held in half', () => {
  const huge = keep({ fields: [['notes', 'x'.repeat(KEEP_MAX_BYTES)]] });
  assert.equal(serializeKeep(huge), null, 'an oversized keep was written anyway');
  assert.ok(serializeKeep(keep()), 'an ordinary keep stopped being written');
});

test('the offer says how long ago, in words a person uses', () => {
  assert.equal(keepAgeLabel(NOW - 30_000, NOW), 'just now');
  assert.equal(keepAgeLabel(NOW - 20 * 60_000, NOW), '20 minutes ago');
  assert.equal(keepAgeLabel(NOW - 60 * 60_000, NOW), 'an hour ago');
  assert.equal(keepAgeLabel(NOW - 5 * 3600_000, NOW), '5 hours ago');
  assert.equal(keepAgeLabel(NOW - 26 * 3600_000, NOW), 'yesterday');
  assert.equal(keepAgeLabel(NOW - 3 * 24 * 3600_000, NOW), '3 days ago');
});

test('a round trip survives itself', () => {
  const raw = serializeKeep(keep());
  assert.ok(raw);
  assert.deepEqual(readKeep(raw, NOW)?.fields, keep().fields);
});
