import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { ANSWER_IN_PLACE_FIELD, answersInPlace } from '@/lib/answer-in-place';
import {
  benchLocalStore,
  markBenchDirty,
  payBenchDebt,
  withoutRemoved,
} from './_components/bench-local';
import type { ShortlistFolder, ShortlistVendor } from '@/lib/shortlist-taxonomy';

/**
 * a-card-press-answers-in-place.test.ts
 *
 * Owner 2026-10-12 (DECISION_LOG "SUPPLIERS PAGE — THE LAST OPEN APPROVALS
 * ANSWERED", item 5): "Save and Remove on a card refresh the whole page" is
 * still fixed — a press answers at once (owner 2026-10-08).
 *
 * Two halves, and each is necessary:
 *  1. the card draws its own answer (Remove: the card leaves; Save: "Saved to
 *     your …") and does NOT call `router.refresh()`;
 *  2. the action it calls does NOT `revalidatePath` — in Next 15 a revalidate
 *     inside a server action ships a whole render of the caller's page back
 *     (`skipFlight: !workStore.pathWasRevalidated`), so half 1 alone still
 *     costs a full page render per press.
 * The owed refresh is paid ONCE, when the couple leaves Find.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const BENCH = src('_components/shortlist-categories.tsx');
const CARD = src('_components/bench-vendor-actions.tsx');
const ACTIONS = src('actions.ts');
const SAVE = src('../../../(shell)/explore/actions.ts');

function slice(code: string, from: string, to: string): string {
  const i = code.indexOf(from);
  assert.ok(i > -1, `anchor moved: ${from}`);
  const j = code.indexOf(to, i + from.length);
  assert.ok(j > -1, `end anchor moved: ${to}`);
  return code.slice(i, j);
}

test('the field is one name, read one way', () => {
  const fd = new FormData();
  assert.equal(answersInPlace(fd), false, 'absent = every other caller, unchanged');
  fd.set(ANSWER_IN_PLACE_FIELD, '1');
  assert.equal(answersInPlace(fd), true);
});

test('Remove on a card: the card leaves first, the write answers in place, no page refresh', () => {
  const remove = slice(CARD, 'const remove = () => {', 'const nudge = () => {');
  const off = remove.indexOf('local?.removeInPlace(vendorId)');
  const write = remove.indexOf('await deleteVendor(fd)');
  assert.ok(off > -1 && write > -1 && off < write, 'the card must leave BEFORE the write is awaited');
  assert.match(remove, /if \(putBack\) fd\.set\(ANSWER_IN_PLACE_FIELD, '1'\);/);
  // The only refresh left is the fallback outside the bench.
  assert.equal((remove.match(/router\.refresh\(\)/g) ?? []).length, 1);
  assert.match(remove, /if \(!putBack\) router\.refresh\(\);/);
});

test('Save and Undo in "More to compare": answered by the card, no page refresh', () => {
  const save = slice(BENCH, 'const saveFromMore = async', 'const undoFromMore = async');
  const undo = slice(BENCH, 'const undoFromMore = async', 'const inquireFromMore = async');
  for (const [name, fn] of [['Save', save], ['Undo', undo]] as const) {
    assert.match(fn, /fd\.set\(ANSWER_IN_PLACE_FIELD, '1'\);/, `${name} must ask the action to answer in place`);
    assert.ok(!/router\.refresh\(\)/.test(fn), `${name} must not refresh the page`);
  }
  assert.match(save, /if \(res\.status === 'ok'\) markBenchDirty\(eventId\);/);
  assert.match(undo, /benchLocal\.removeInPlace\(saved\.eventVendorId\)/);
});

test('the actions skip their revalidate ONLY when asked', () => {
  const del = slice(ACTIONS, 'export async function deleteVendor(', 'export async function ');
  const gate = del.indexOf('if (answersInPlace(formData)) return;');
  const firstRevalidate = del.indexOf('revalidatePath(');
  assert.ok(gate > -1, 'deleteVendor no longer answers in place');
  assert.ok(gate < firstRevalidate, 'deleteVendor revalidates before the in-place gate');
  // Everything else it does (the supplier is told, the anchor and the date are
  // given back) still runs BEFORE the gate.
  for (const step of ['tellSupplierLockRequestWithdrawn(', 'recomputeReceptionAnchor(', 'releaseForcedDate(']) {
    const at = del.indexOf(step);
    assert.ok(at > -1 && at < gate, `${step} must run before the in-place return`);
  }

  const pick = slice(SAVE, 'export async function saveVendorToPicks(', "status: 'ok',");
  const guarded = pick.slice(pick.indexOf('if (!answersInPlace(formData)) {'));
  assert.ok(pick.includes('if (!answersInPlace(formData)) {'), 'saveVendorToPicks no longer answers in place');
  const before = pick.slice(0, pick.indexOf('if (!answersInPlace(formData)) {'));
  assert.ok(!/revalidatePath\(/.test(before.slice(before.indexOf('// 4. Insert'))), 'a revalidate escaped the gate');
  assert.equal((guarded.match(/revalidatePath\(/g) ?? []).length, 3);
});

test('the debt is paid once, when the couple leaves Find, and on a return visit', () => {
  const eventId = `t-${Date.now()}`;
  assert.equal(payBenchDebt(eventId), false, 'nothing owed');
  markBenchDirty(eventId);
  markBenchDirty(eventId);
  assert.equal(payBenchDebt(eventId), true, 'two presses → ONE refresh');
  assert.equal(payBenchDebt(eventId), false);
  assert.match(BENCH, /if \(suppliersMode !== 'find' && payBenchDebt\(eventId\)\) router\.refresh\(\);/);
  assert.match(BENCH, /useEffect\(\(\) => \{\s*if \(payBenchDebt\(eventId\)\) router\.refresh\(\);/);
  // Kept per event, for the visit.
  assert.equal(benchLocalStore(eventId), benchLocalStore(eventId));
});

const vendor = (vendorId: string) => ({ vendorId }) as unknown as ShortlistVendor;
const folders = (): ShortlistFolder[] =>
  [
    {
      folder: 'food',
      label: 'Food',
      slug: 'food',
      plannedCount: 1,
      pickCount: 3,
      tiles: [
        { tile: 'catering', label: 'Catering', slug: 'catering', vendors: [vendor('a'), vendor('b')] },
        { tile: 'cake', label: 'Cake', slug: 'cake', vendors: [vendor('c')] },
      ],
    },
  ] as unknown as ShortlistFolder[];

test('a removed supplier leaves its list, and the counts move with it', () => {
  const f = folders();
  assert.equal(withoutRemoved(f, new Set()), f, 'nothing removed → the same objects');
  const out = withoutRemoved(f, new Set(['b']));
  assert.deepEqual(out[0]!.tiles[0]!.vendors.map((v) => v.vendorId), ['a']);
  assert.equal(out[0]!.tiles[1], f[0]!.tiles[1], 'an untouched category is the same object');
  assert.equal(out[0]!.pickCount, 2);
  // And the bench reads `folders` only through this filter.
  assert.match(BENCH, /folders: foldersFromServer,/);
  assert.match(BENCH, /const folders = useMemo\(\(\) => withoutRemoved\(foldersFromServer, gone\), \[foldersFromServer, gone\]\);/);
  assert.equal((BENCH.match(/foldersFromServer/g) ?? []).length, 3, 'foldersFromServer read outside the filter');
});
