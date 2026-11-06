/**
 * 🧠 GUESTS › MAP IS A MIND MAP (R4 slice 10; HANDOVER: *"Map = the prototype's mind map (≤6 hubs on a ring + 'Other
 * households · N' drill-in, '‹ All households', couple centre, 36 px faces …, fit on grouping change; grouping = the
 * shared ⇅ Group by)"*; prototype `mapHubs` / `ringsFor` / `facePos`).
 *
 * The PROPERTIES (executed on the pure layout, `lib/guest-mind-map.ts`):
 *   1. ≤ 6 hubs; the smallest beyond five fold into "Other groups · N" holding their keys; biggest first.
 *   2. A hub draws ≤ 10 faces ("+N more"); one hub alone draws everyone; a side's own groups fold into the side's hub.
 *   3. Drill: "Other" opens its folded hubs; a hub's "+N more" opens that hub alone (everyone).
 *   4. Faces sit on rings around their hub, 36 px (r 18), never two on one point; hubs sit on one ring around (0, 0).
 *   5. The canvas draws it: the couple, hub buttons, labels, "+N more", faces that PEEK (`onOpen`), "‹ All groups";
 *      the shipped measure / fit / pinch stay (map-is-the-screen.test.ts).
 *
 * SABOTAGE (each seen RED, then restored): MAX_HUBS 7 · the single-hub "everyone" dropped · the ring offset removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GuestRow } from '@/lib/guests';
import type { MapBranch } from '@/lib/guest-roster-view';
import { FACE_R, MAX_FACES, MAX_HUBS, facePos, mindMapBounds, mindMapHubs, ringsFor } from '@/lib/guest-mind-map';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = (id: string): GuestRow => ({ guest_id: id, first_name: id, last_name: 'X' }) as GuestRow;
const branch = (key: string, n: number, kids: MapBranch[] = []): MapBranch => ({
  key,
  label: key,
  mark: { kind: 'letter', letter: key[0]!.toUpperCase() } as MapBranch['mark'],
  kids,
  guests: Array.from({ length: n }, (_, i) => g(`${key}${i}`)),
});

test('1 · at most six hubs — the rest fold into "Other groups · N", biggest first', () => {
  const tree = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k, i) => branch(k, 20 - i));
  const hubs = mindMapHubs(tree);
  assert.equal(hubs.length, MAX_HUBS);
  assert.deepEqual(hubs.map((h) => h.key), ['a', 'b', 'c', 'd', 'e', 'other']);
  const other = hubs.at(-1)!;
  assert.equal(other.label, 'Other groups · 3');
  assert.deepEqual(other.keys, ['f', 'g', 'h']);
  assert.equal(other.guests.length, 15 + 14 + 13);
});

test('2 · ≤ 10 faces a hub (+N more); one hub alone shows everyone; a side folds its groups in', () => {
  const hubs = mindMapHubs([branch('a', 25), branch('b', 4)]);
  assert.equal(hubs[0]!.shown.length, MAX_FACES);
  assert.equal(hubs[0]!.more, 15);
  assert.equal(hubs[1]!.more, 0);
  const alone = mindMapHubs([branch('a', 25)]);
  assert.equal(alone[0]!.shown.length, 25, 'one hub alone does not show everyone');
  assert.deepEqual([alone[0]!.x, alone[0]!.y], [0, 0]);
  const side = mindMapHubs([branch('bride', 2, [branch('college', 3), branch('family', 4)])]);
  assert.equal(side[0]!.guests.length, 9, 'a side’s own groups are not folded into its hub');
});

test('3 · drill into "Other", or into one hub', () => {
  const tree = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k, i) => branch(k, 20 - i));
  const other = mindMapHubs(tree, { kind: 'other', keys: ['f', 'g', 'h'] });
  assert.deepEqual(other.map((h) => h.key), ['f', 'g', 'h']);
  const one = mindMapHubs(tree, { kind: 'hub', key: 'a' });
  assert.equal(one.length, 1);
  assert.equal(one[0]!.shown.length, 20);
});

test('4 · faces on rings around their hub, never on one point; hubs on one ring around the couple', () => {
  assert.deepEqual(ringsFor(10), [64, 106]);
  const hubs = mindMapHubs([branch('a', 10), branch('b', 10), branch('c', 3)]);
  for (const h of hubs) {
    const pts = h.shown.map((_, i) => facePos(h, i));
    assert.equal(new Set(pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)).size, pts.length, 'two faces on one point');
    for (const p of pts) assert.ok(Math.hypot(p.x - h.x, p.y - h.y) >= FACE_R + 46 - 1e-6, 'a face sits on its hub');
  }
  const radii = hubs.map((h) => Math.hypot(h.x, h.y));
  assert.ok(radii.every((r) => Math.abs(r - radii[0]!) < 1e-6) && radii[0]! >= 150, 'the hubs are not on one ring');
  const b = mindMapBounds(hubs);
  assert.ok(b.width > 0 && b.height > 0);
});

test('5 · the canvas draws the mind map, faces peek, and the shipped fit and pinch stay', () => {
  const MAP = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/guests/_components/guest-map-canvas.tsx'), 'utf8'));
  assert.match(MAP, /const hubs = useMemo\(\(\) => mindMapHubs\(tree, drill\), \[tree, drill\]\);/);
  assert.match(MAP, /onClick=\{\(e\) => onOpen\(g\.guest_id, e\.currentTarget\)\}/);
  assert.match(MAP, /setDrill\(\{ kind: 'other', keys: h\.keys \}\)/);
  assert.match(MAP, /setDrill\(\{ kind: 'hub', key: h\.key \}\)/);
  assert.match(MAP, /data-mind-back=""/);
  assert.match(MAP, /data-map-root=""/);
  assert.doesNotMatch(MAP, /layoutMap\(/, 'the old tree is still drawn');
});
