/**
 * 🏷 The pure rules of inspiration tags (lib/inspiration-tags.ts) on real values — the state table of the prototype
 * `inspiration_tags_2026-11-14_fable.html`, the event line of ruling (4), and the ▾'s choices (ruling 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventLineWords,
  partsLeftToTag,
  pickedWords,
  tagButtonWords,
  tagCountsByFile,
  tagStateOf,
  tagStateWords,
} from '@/lib/inspiration-tags';

test('the state table: refused → checking → shown → private → waiting', () => {
  const approved = { approved_at: '2026-11-14T00:00:00Z', rejected_at: null };
  assert.equal(tagStateOf({ approved_at: null, rejected_at: '2026-11-14T00:00:00Z' }, { listed: true, shopState: 'shown' }), 'refused');
  assert.equal(tagStateOf({ approved_at: null, rejected_at: null }, { listed: true, shopState: 'shown' }), 'checking');
  assert.equal(tagStateOf(approved, { listed: true, shopState: 'shown' }), 'shown');
  assert.equal(tagStateOf(approved, { listed: false, shopState: 'hidden' }), 'private');
  assert.equal(tagStateOf(approved, { listed: false, shopState: 'outside' }), 'private');
  assert.equal(tagStateOf(approved, { listed: false, shopState: 'waiting' }), 'waiting');
});

test('🛑 "shown" comes ONLY from the listing — an approved tag of a photo the board calls shown but the view does not list waits', () => {
  // The board's own state and the view can disagree for a moment (or under a new handover rule); the view decides.
  assert.equal(tagStateOf({ approved_at: 'x', rejected_at: null }, { listed: false, shopState: 'shown' }), 'waiting');
});

test('each state has its pill and its line; a refusal names its reason', () => {
  assert.deepEqual(tagStateWords({ state: 'shown', reason: null }), { pill: 'Shown', line: 'Couples can see it' });
  assert.deepEqual(tagStateWords({ state: 'checking', reason: null }), { pill: 'Checking', line: 'Setnayan is checking it' });
  assert.equal(tagStateWords({ state: 'refused', reason: 'a phone number' }).line, 'We couldn’t publish this: a phone number');
  assert.equal(tagStateWords({ state: 'private', reason: null }).pill, 'Private');
  assert.equal(tagStateWords({ state: 'waiting', reason: null }).line, 'Shows when this photo is shown on your shop');
});

test('ruling (4): type · venue · month — never a name; an unknown part is dropped, never invented', () => {
  assert.equal(eventLineWords({ typeLabel: 'Wedding', venue: 'Makati Shangri-La', month: '2026-09-01' }), 'Wedding · Makati Shangri-La · Sep 2026');
  assert.equal(eventLineWords({ typeLabel: 'Debut', venue: null, month: '2026-08-01' }), 'Debut · Aug 2026');
  assert.equal(eventLineWords({ typeLabel: null, venue: '  ', month: null }), null);
});

test('the ▾ offers only the card’s parts the photo is not already in', () => {
  const offered = [
    { slotKey: 'flowers', label: 'Bridal bouquet' },
    { slotKey: 'entourage_bouquets', label: 'Entourage bouquets' },
    { slotKey: 'flower_accents', label: 'Flower accents' },
  ];
  assert.deepEqual(
    partsLeftToTag(offered, [{ slotKey: 'flowers' }, { slotKey: 'entourage_bouquets' }]).map((p) => p.slotKey),
    ['flower_accents'],
  );
  assert.deepEqual(partsLeftToTag([], [{ slotKey: 'flowers' }]), []);
});

test('the words of the picker and the tile', () => {
  assert.equal(pickedWords(0), 'none yet');
  assert.equal(pickedWords(2), '2 picked');
  assert.equal(tagButtonWords(1), 'Tag to 1 inspiration');
  assert.equal(tagButtonWords(2), 'Tag to 2 inspirations');
  assert.deepEqual(tagCountsByFile([{ fileId: 'a' }, { fileId: 'a' }, { fileId: 'b' }]), { a: 2, b: 1 });
});

test('frames 6–7: an album counts the inspirations of its FILES photos only, in first-seen order', async () => {
  const { albumInspirations, inspirationChipWords } = await import('@/lib/inspiration-tags');
  const tags = new Map([
    ['f1', [{ slotKey: 'flowers', label: 'Bridal bouquet' }, { slotKey: 'entourage', label: 'Entourage bouquets' }]],
    ['f2', [{ slotKey: 'flowers', label: 'Bridal bouquet' }]],
    // A Papic photo id that happens to collide with a file id is never read as one.
    ['p1', [{ slotKey: 'cake', label: 'Cake' }]],
  ]);
  const got = albumInspirations(['files:f1', 'files:f2', 'papic:p1', 'files:f3'], tags);
  assert.deepEqual(got.map((i) => [i.slotKey, i.count]), [['flowers', 2], ['entourage', 1]]);
  assert.equal(inspirationChipWords(got[0]!), 'Bridal bouquet · 2');
  assert.deepEqual(albumInspirations(['papic:p1'], tags), []);
});
