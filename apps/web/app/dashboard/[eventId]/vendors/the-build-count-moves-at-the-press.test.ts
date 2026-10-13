import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { buildTally, liveBuildTally, type LiveTallyBase } from '@/lib/suppliers-shell';
import { benchLocalStore, builtNowIn, savedInPlaceCount, setBuiltIn } from './_components/bench-local';

/**
 * THE BUILD'S COUNTS MOVE AT THE PRESS — no page render.
 *
 * 🚨 Seen on the batch-3 walk (2026-10-13, /dev/suppliers-lab, Chromium + WebKit): "Add to build" on Tinapay & Co.
 * (Cake) answered in place — the card read "In your build" — but the cart peek still said "This build · 2 of 5", the
 * segment "Build 2/5", and a supplier saved from "More to compare" was not in its row's "· N yours" / "N to decide",
 * until the couple left Find and the page's one owed refresh came back. A press answers at once (owner 2026-10-08);
 * its numbers are part of the answer.
 *
 *   1. `liveBuildTally` — the shell counts again from the page's OWN inputs with each pick's state now. Nothing
 *      pressed → exactly the page's numbers; a pin into an empty category → N+1 and its price; a swap in a one-pick
 *      category → the same N, the new price; a pin put back after a refusal → the first numbers again.
 *   2. `savedInPlaceCount` — a supplier saved here this visit and not drawn yet is counted once, and not again once
 *      the page draws it (or it is removed).
 *   3. The wiring: the bench says so on the window at every in-place pin, and the shell's segment and peek read the
 *      re-counted tally; the row's "· N yours" and its state word read the saved-here count.
 */

const pick = (vendor_id: string, raw_status: string, rolled_cost_php: number | null) => ({ vendor_id, raw_status, rolled_cost_php });

/** Reception booked ₱1,056,000 · Catering: Kusina in the build at ₱198,000 beside Bituin · Cake: Tinapay, nobody picked
 *  yet · Bridal car: Impala, nobody picked. Ring = the four rows Find shows. */
const BASE: LiveTallyBase = {
  children: [
    { groupId: 'reception', picks: [pick('seda', 'deposit_paid', 1_056_000)], buildPickVendorIds: ['seda'] },
    { groupId: 'catering', picks: [pick('kusina', 'shortlisted', 198_000), pick('bituin', 'considering', 240_000)], buildPickVendorIds: ['kusina'] },
    { groupId: 'cake', picks: [pick('tinapay', 'considering', 18_500)], buildPickVendorIds: [] },
    { groupId: 'bridal_car', picks: [pick('impala', 'considering', null)], buildPickVendorIds: [] },
  ],
  lockedCentavos: 1_056_000 * 100,
  ring: {
    tiles: [
      { tile: 'reception', lockedCount: 1, vendorIds: ['seda'] },
      { tile: 'catering', lockedCount: 0, vendorIds: ['kusina', 'bituin'] },
      { tile: 'cake', lockedCount: 0, vendorIds: ['tinapay'] },
      { tile: 'bridal_car', lockedCount: 0, vendorIds: ['impala'] },
      { tile: 'lights', lockedCount: 0, vendorIds: [] },
    ],
    inPlan: ['reception', 'catering', 'cake', 'bridal_car', 'lights'],
  },
  drawnIn: ['seda', 'kusina'],
};

const freshStore = (id: string) => {
  const s = benchLocalStore(id);
  s.built.clear();
  s.groupPick.clear();
  s.saved.clear();
  s.gone.clear();
  return s;
};
const live = (store: ReturnType<typeof benchLocalStore>, base: LiveTallyBase = BASE) =>
  liveBuildTally(base, (v, g, drawn) => builtNowIn(store, v, g, drawn));

test('nothing pressed → the page’s own numbers, exactly', () => {
  const s = freshStore('t-none');
  const t = live(s);
  assert.deepEqual([t.filled, t.total], [2, 5], 'reception (booked) · catering (in the build), over the ring');
  const drawn = buildTally(BASE.children, BASE.lockedCentavos);
  assert.equal(t.knownPhp, drawn.knownPhp);
  assert.equal(t.unpriced, drawn.unpriced);
  assert.deepEqual(live(s, { ...BASE, ring: null }), drawn, 'flag off: the plan model’s own count');
});

test('Add to build into an empty category → N+1 of M, and its price joins the build', () => {
  const s = freshStore('t-add');
  setBuiltIn(s, 'tinapay', 'cake', true, false);
  const t = live(s);
  assert.deepEqual([t.filled, t.total], [3, 5], 'the walk’s "This build · 2 of 5" must read 3 of 5');
  assert.equal(t.knownPhp, 1_056_000 + 198_000 + 18_500);
  setBuiltIn(s, 'impala', 'bridal_car', true, false);
  const u = live(s);
  assert.equal(u.filled, 4);
  assert.equal(u.unpriced, t.unpriced + 1, 'a pick with no price is counted as unpriced, never ₱0');
});

test('a swap in a one-pick category keeps N and moves the money; taking it out drops N', () => {
  const s = freshStore('t-swap');
  setBuiltIn(s, 'bituin', 'catering', true, false);
  const t = live(s);
  assert.equal(t.filled, 2, 'Catering was already filled');
  assert.equal(t.knownPhp, 1_056_000 + 240_000, 'Kusina out, Bituin in');
  setBuiltIn(s, 'bituin', 'catering', false, true);
  assert.equal(live(s).filled, 1, 'nobody left in Catering’s build');
});

test('a refused pin put back reads the first numbers again', () => {
  const s = freshStore('t-back');
  const first = live(s);
  setBuiltIn(s, 'tinapay', 'cake', true, false);
  setBuiltIn(s, 'tinapay', 'cake', false, true);
  assert.deepEqual(live(s), first);
});

test('a supplier saved here this visit is counted on its row once — and not again once drawn or removed', () => {
  const s = freshStore('t-saved');
  assert.equal(savedInPlaceCount(s, 'catering', new Set(['kusina', 'bituin'])), 0);
  s.saved.set('catering|prof-lola', { eventVendorId: 'lola', undoable: true });
  s.saved.set('cake|prof-x', { eventVendorId: 'x', undoable: true });
  assert.equal(savedInPlaceCount(s, 'catering', new Set(['kusina', 'bituin'])), 1, 'Lola joins "· N yours" at once');
  assert.equal(savedInPlaceCount(s, 'catering', new Set(['kusina', 'bituin', 'lola'])), 0, 'drawn by the page → not twice');
  s.gone.add('lola');
  assert.equal(savedInPlaceCount(s, 'catering', new Set(['kusina', 'bituin'])), 0, 'removed → gone from the count');
});

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('wiring: the bench says it at every in-place pin; the shell’s segment and peek read the re-count', () => {
  const bench = src('_components/shortlist-categories.tsx');
  const setBuilt = bench.slice(bench.indexOf('setBuilt: (vendorId, groupId, on, multi) => {'), bench.indexOf('say: (tone, text, retry)'));
  assert.match(setBuilt, /window\.dispatchEvent\(new Event\(BENCH_BUILT_EVENT\)\)/, 'an in-place pin must tell the shell');
  const shell = src('_components/services-takeover.tsx');
  assert.match(shell, /window\.addEventListener\(BENCH_BUILT_EVENT, onBuilt\)/);
  assert.match(shell, /liveBuildTally\(liveTally, \(v, g, drawn\) => builtNowIn\(benchLocalStore\(eventId\), v, g, drawn\)\)/);
  assert.match(shell, /tally: drawnTally,/, 'the drawn tally must not be read directly by the segment or the peek');
  assert.match(shell, /<BuildCart tally=\{tally\} \/>/);
  assert.match(shell, /<Count value=\{tally\.filled\} id="sup-seg-filled" \/>/);
  const page = src('page.tsx');
  assert.match(page, /liveTally=\{liveTallyBase\}/, 'the page must hand the shell its inputs');
  assert.match(bench, /vendorCount: yours,/, 'the row’s state word must count a supplier saved here');
  assert.match(bench, /<Count value=\{yours\} id=\{`sup-yours-\$\{t\.tile\}`\} \/> yours/, '"· N yours" must count a supplier saved here');
  assert.match(bench, /savedChanged: \(\) => setBuiltTick\(\(n\) => n \+ 1\)/);
});
