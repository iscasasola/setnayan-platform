/**
 * march-groups-in-guests.test.ts — GUESTS › MARCH: A GROUP IS PRESSED, A LONE WALKER SPANS, AN EMPTIED WALK SAYS SO
 * (R4 slice 5, owner 2026-10-29 — Guests prototype v13/v26).
 *
 * ⚖ "drop between rows = new walk" (shipped: a gap drop, `planDrop`) · "a walk emptied by a move removes itself with
 * Undo" · "a solo walker's pill spans both columns with the animated join/leave on the dropped side" · "both pills of a
 * walk share one height" · "no LEFT/RIGHT labels" · "tap a March group header → Rename · ＋Walk · ＋Group · Delete".
 *
 * Properties held:
 *   (1) Delete = everyone in the group to "Not walking" through the SAME step as the tray drag (`walking: false` per
 *       person), the group leaves the march, the tray holds them; the groom's / bride's sides are refused in words;
 *   (2) a lone walker who joins someone empties their walk — and the toast says it;
 *   (3) the Guests march: no LEFT/RIGHT row; a lone walker's other side is CLOSED until something is being moved;
 *       the two sides sit in one stretching row; the header's second tap folds AND unselects; no Delete on a fixed side.
 *
 * 🛡 Sabotaged (2026-10-29): the closed side staying open at rest → red on (3); Delete leaving the tray untouched → red on (1).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { planDrop, planSectionOut, type MarchSection } from '@/lib/march-drag';
import { isMarchOnlyGroup, MARCH_GROUP_KEYS } from '@/lib/entourage';

const p = (id: string, name: string, role: string) => ({ id, name, role });
const fixedKey = MARCH_GROUP_KEYS.find((k) => isMarchOnlyGroup(k))!;
const sections = (): MarchSection[] => [
  { key: fixedKey, label: 'The Groom & his parents', rows: [[p('groom', 'Jose', 'groom'), null]] },
  {
    key: 'secondary_sponsors',
    label: 'Secondary Sponsors',
    rows: [
      [p('c1', 'Paolo Tan', 'candle_sponsor'), p('c2', 'Ivy Tan', 'candle_sponsor')],
      [p('v1', 'Karl Lim', 'veil_sponsor'), null],
    ],
  },
  { key: 'bearers', label: 'Bearers', rows: [[p('rb', 'Joaquin Buanhog', 'ring_bearer'), null], [p('cb', 'Enzo Bautista', 'coin_bearer'), null]] },
];

test('(1) Delete sends the whole group to Not walking — the tray drag, for each, one move', () => {
  assert.ok(fixedKey, 'no march-only group — this guard is blind');
  const m = planSectionOut(sections(), ['secondary_sponsors', 'bearers'], [], 'secondary_sponsors');
  assert.ok(m && m.ok, 'Delete was refused on an ordinary group');
  if (!m || !m.ok) return;
  assert.deepEqual(m.steps.map((s) => (s.kind === 'walking' ? `${s.guest}:${s.walks}` : s.kind)), ['c1:false', 'c2:false', 'v1:false']);
  assert.equal(m.sections.find((x) => x.key === 'secondary_sponsors'), undefined, 'the emptied group stays in the march');
  assert.deepEqual(new Set((m.out ?? []).map((o) => o.id)), new Set(['c1', 'c2', 'v1']), 'the tray does not hold them');
  assert.ok(m.sections.some((x) => x.key === 'bearers'), 'Delete touched another group');
  const fixed = planSectionOut(sections(), [], [], fixedKey);
  assert.ok(fixed && !fixed.ok, 'the groom’s side could be deleted');
});

test('(2) a lone walker joining someone empties their walk — said, with Undo', () => {
  const plan = planDrop(sections(), { kind: 'name', id: 'cb' }, { kind: 'beside', anchor: 'rb' });
  assert.ok(plan && plan.ok);
  if (!plan || !plan.ok) return;
  assert.match(plan.said, /empty walk removed$/);
  assert.equal(plan.next.find((x) => x.key === 'bearers')!.rows.length, 1, 'the emptied walk is still drawn');
});

test('(3) the Guests march: no LEFT/RIGHT, a lone walker spans, the header selects and folds', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/launch/_components/details-march.tsx'), 'utf8'));
  assert.match(src, /\{guests \? null : \(\s*<div aria-hidden className="grid grid-cols-\[2rem_1fr_1fr\][^"]*">\s*<span \/>\s*<span className="text-center">Left<\/span>/, 'the LEFT/RIGHT words are drawn in Guests');
  assert.match(src, /const solo = guests && \(laid\[0\] === null\) !== \(laid\[1\] === null\);/);
  assert.match(src, /const hideEmpty = solo && !dragging && !carried;/, 'a lone walker’s other side is not closed at rest (or not opened for a move)');
  assert.match(src, /hideEmpty \? ' pointer-events-none !grow-0 !border-0 !px-0 opacity-0' : ''/, 'the closed side still takes room');
  assert.match(src, /<div className="flex min-w-0 items-stretch" data-march-pair="">/, 'the two pills of a walk do not share one stretching row');
  const tap = src.slice(src.indexOf('const tapHead = '), src.indexOf('const selSec = '));
  assert.match(tap, /if \(marchSel === key\) \{\s*setMarchSel\(null\);\s*setFolded\(\(f\) => new Set\(\[\.\.\.f, key\]\)\);/, 'the selected header’s tap does not fold AND unselect');
  assert.match(src, /onDelete=\{\s*isMarchOnlyGroup\(selSec\.key\)\s*\?\s*undefined/, 'a fixed side offers Delete');
  assert.match(src, /run\(planSectionOut\(shown, shownPrinted, shownOut, selSec\.key\)\)/, 'Delete is not the shipped tray move');
});
