import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEntourage, type EntourageGuestRow } from '@/lib/entourage';
import { marchSections, marchTray } from '@/lib/march-sections';
import { acrossTheAisle, planMove, walkSideOf, type MarchOut, type MarchSection } from '@/lib/march-drag';
import { marchPlaceOf } from '@/lib/march-place';

/*
 * 🚶 THE "NOT WALKING" TRAY + WHICH SIDE OF THE AISLE (owner 2026-10-06):
 *   *"Just show screen for those not added or will not walk the isle."*
 *   *"Walk side ninong left ninang right"* · *"Brides crew should be on right and grooms crew on the left."*
 * Each test is one way the ruling could be quietly broken.
 */

type G = EntourageGuestRow & { guest_id: string };
const g = (id: string, first: string, role: string, walk?: [number, number], side = 'both', out = false): G => ({
  guest_id: id,
  first_name: first,
  last_name: 'Test',
  role,
  side,
  extra_roles: [],
  march: walk ? { walk_no: walk[0], place_in_walk: walk[1] } : null,
  ...(out ? { not_walking: true } : {}),
});

function rows(): G[] {
  return [
    g('groom', 'Jose', 'groom', undefined, 'groom'),
    g('bride', 'Maria', 'bride', undefined, 'bride'),
    g('n1', 'Ricardo', 'principal_sponsor_ninong', [2, 0]),
    g('a1', 'Jessica', 'principal_sponsor_ninang', [2, 1]),
    g('n2', 'Cesar', 'principal_sponsor_ninong', [3, 0]),
    g('bm', 'Joy', 'bridesmaid', [5, 0]),
    g('gm', 'Dennis', 'groomsman', [5, 1]),
    g('rb', 'Joaquin', 'ring_bearer', [7, 0]),
    // Not walking: a groomsman and a flower girl.
    g('gm2', 'Vince', 'groomsman', undefined, 'groom', true),
    g('fg', 'Sofia', 'flower_girl', undefined, 'bride', true),
  ];
}
const walking = () => marchSections(buildEntourage(rows().filter((r) => !r.not_walking), null, {}, undefined, { march: true }));
const tray = () => marchTray(buildEntourage(rows().filter((r) => r.not_walking), null, {}, undefined, { march: true }));
const ids = (ss: readonly MarchSection[]) => ss.flatMap((s) => s.rows.flat()).filter(Boolean).map((p) => p!.id);

test('the tray holds the people with a role who do not walk — each once, with the section they come back to', () => {
  const out = tray();
  assert.deepEqual(out.map((p) => [p.id, p.section]).sort(), [['fg', 'flower_girls'], ['gm2', 'bridesmaids_groomsmen']]);
  for (const id of ['gm2', 'fg']) assert.ok(!ids(walking()).includes(id), `${id} walks while in the tray`);
});

test('a name dropped on the tray: out of the march, first in the tray, its walk-mate walks alone; Undo brings them back', () => {
  const plan = planMove(walking(), [], { kind: 'name', id: 'a1' }, { kind: 'tray' }, tray());
  assert.ok(plan && plan.ok);
  assert.ok(!ids(plan.sections).includes('a1'));
  assert.equal(plan.out?.[0]?.id, 'a1', 'the name just dropped is not first in the tray');
  const sponsors = plan.sections.find((s) => s.key === 'principal_sponsors')!;
  assert.ok(sponsors.rows.some((r) => (r[0]?.id === 'n1' && !r[1]) || (r[1]?.id === 'n1' && !r[0])), 'the walk-mate left the march too');
  assert.deepEqual(plan.steps, [{ kind: 'walking', section: 'principal_sponsors', guest: 'a1', walks: false }]);
  assert.match(plan.said, /is not walking · .* now walks alone/);
  assert.deepEqual(plan.undo[0], { kind: 'walking', section: 'principal_sponsors', guest: 'a1', walks: true });
  assert.ok(plan.undo.some((s) => s.kind === 'join' && s.joiner === 'a1'), 'Undo does not put the pair back together');
});

test('the couple always walk — the groom and the bride never go to the tray', () => {
  for (const id of ['groom', 'bride']) {
    const plan = planMove(walking(), [], { kind: 'name', id }, { kind: 'tray' }, tray());
    assert.ok(plan && !plan.ok, `${id} was taken out of the march`);
  }
});

test('a tray name dropped in a gap of its own section walks there — back in, then the section order', () => {
  const sec = walking().find((s) => s.key === 'bridesmaids_groomsmen')!;
  const plan = planMove(walking(), [], { kind: 'out', id: 'gm2' }, { kind: 'gap', section: sec.key, index: 0 }, tray());
  assert.ok(plan && plan.ok);
  const after = plan.sections.find((s) => s.key === sec.key)!;
  assert.equal((after.rows[0]![0] ?? after.rows[0]![1])!.id, 'gm2');
  assert.deepEqual(plan.steps[0], { kind: 'walking', section: sec.key, guest: 'gm2', walks: true });
  assert.equal(plan.steps.at(-1)!.kind, 'order');
  assert.ok(!plan.out!.some((p) => p.id === 'gm2'));
  assert.deepEqual(plan.undo, [{ kind: 'walking', section: sec.key, guest: 'gm2', walks: false }]);
});

test('a tray name dropped in ANOTHER section lands at the end of its own (its role decides) — and beside a lone walker, walks with them', () => {
  const plan = planMove(walking(), [], { kind: 'out', id: 'gm2' }, { kind: 'gap', section: 'principal_sponsors', index: 0 }, tray());
  assert.ok(plan && plan.ok);
  const crew = plan.sections.find((s) => s.key === 'bridesmaids_groomsmen')!;
  assert.equal(leadId(crew.rows.at(-1)!), 'gm2');
  assert.ok(!plan.sections.find((s) => s.key === 'principal_sponsors')!.rows.some((r) => r.some((p) => p?.id === 'gm2')));

  // Its section had nobody walking: it comes back with them.
  const fg = planMove(walking(), [], { kind: 'out', id: 'fg' }, { kind: 'gap', section: '*', index: 0 }, tray());
  assert.ok(fg && fg.ok && fg.sections.some((s) => s.key === 'flower_girls' && s.rows.length === 1));

  // Beside the lone ninong (n2): only someone of his section may — a groomsman is refused, in words.
  const no = planMove(walking(), [], { kind: 'out', id: 'gm2' }, { kind: 'beside', anchor: 'n2' }, tray());
  assert.ok(no && no.ok && leadId(no.sections.find((s) => s.key === 'bridesmaids_groomsmen')!.rows.at(-1)!) === 'gm2', 'a drop beside someone of another section lands in its own');
});
const leadId = (r: readonly (MarchOut | { id: string } | null)[]) => (r[0] ?? r[1])!.id;

test('which side of the aisle: Ninong left, Ninang right; the groom’s crew left, the bride’s right; the bride’s side right; else left', () => {
  assert.equal(walkSideOf({ role: 'principal_sponsor_ninong' }), 0);
  assert.equal(walkSideOf({ role: 'principal_sponsor_ninang' }), 1);
  assert.equal(walkSideOf({ role: 'best_man' }), 0);
  assert.equal(walkSideOf({ role: 'best_woman' }), 0, 'a best woman stands in the groom’s crew');
  assert.equal(walkSideOf({ role: 'groomsman' }), 0);
  assert.equal(walkSideOf({ role: 'maid_of_honor' }), 1);
  assert.equal(walkSideOf({ role: 'matron_of_honor' }), 1);
  assert.equal(walkSideOf({ role: 'bridesmaid' }), 1);
  assert.equal(walkSideOf({ role: 'candle_sponsor', side: 'bride' }), 1);
  assert.equal(walkSideOf({ role: 'candle_sponsor', side: 'groom' }), 0);
  assert.equal(walkSideOf({ role: 'ring_bearer', side: 'both' }), 0);
  assert.equal(walkSideOf({ role: 'flower_girl' }), 0);

  const p = (id: string, role: string, side?: string) => ({ id, name: id, role, side });
  // The printer put the bridesmaid on the LEFT (its own columns); the march draws her on the right.
  assert.deepEqual(acrossTheAisle([p('bm', 'bridesmaid'), p('gm', 'groomsman')]).map((x) => x?.id), ['gm', 'bm']);
  assert.deepEqual(acrossTheAisle([p('n', 'principal_sponsor_ninong'), p('a', 'principal_sponsor_ninang')]).map((x) => x?.id), ['n', 'a']);
  // Alone: on their own side.
  assert.deepEqual(acrossTheAisle([p('bm', 'bridesmaid'), null]).map((x) => x?.id ?? null), [null, 'bm']);
  assert.deepEqual(acrossTheAisle([null, p('gm', 'groomsman')]).map((x) => x?.id ?? null), ['gm', null]);
  // Both of one side: the first keeps theirs, the partner takes the other.
  assert.deepEqual(acrossTheAisle([p('m', 'groom_parents', 'bride'), p('d', 'groom_parents', 'bride')]).map((x) => x?.id), ['d', 'm']);
  assert.deepEqual(acrossTheAisle([p('m', 'groom_parents', 'groom'), p('d', 'groom_parents', 'groom')]).map((x) => x?.id), ['m', 'd']);
});

test('"You walk Nth" leaves a person who does not walk out of the walking ORDER — they still print', () => {
  const printed = buildEntourage(rows(), null, {});
  // They print under their role…
  assert.ok(printed.some((grp) => grp.rows.some((r) => r.some((x) => x?.id === 'gm2'))), 'a non-walker stopped printing');
  // …but have no place in the march, and nobody "walks after" them.
  assert.equal(marchPlaceOf(printed, 'gm2'), null);
  const all = printed.flatMap((grp) => grp.rows).filter((r) => r.some((x) => x && !x.notWalking)).length;
  assert.equal(marchPlaceOf(printed, 'rb')!.total, all);
  assert.doesNotMatch(marchPlaceOf(printed, 'rb')!.after ?? '', /Vince|Sofia/);
});

test('Undo of "not walking" always writes the section order — they come back unplaced, where the server sorts them', () => {
  // The ring bearer is the LAST walk of Bearers: the predicted "back at the end" already matches, yet the order is still written.
  const plan = planMove(walking(), [], { kind: 'name', id: 'rb' }, { kind: 'tray' }, tray());
  assert.ok(plan && plan.ok);
  assert.equal(plan.undo.at(-1)!.kind, 'order', 'Undo trusts the server to put them back where they were');
});
