/**
 * march-own-groups.test.ts — GUESTS › MARCH: THE COUPLE'S OWN MARCH GROUPS (owner 2026-10-29, DECISION_LOG "GUESTS
 * ANSWERS (owner ~14:40): custom March groups YES" — *"yes. so if they have a custom way of marching they can customize
 * it."*; prototype v13 `newMarchGroup` / `mgNew` / `thWalk`).
 *
 * Properties held:
 *   (1) ＋ Group makes an EMPTY group, drawn right after the selected one (else after the last section, never after the
 *       bride's side), and the drafted step replays to exactly what the drop drew;
 *   (2) a name dragged into an own group leaves its walk (the walk-mate walks alone), remembers its home, and replays
 *       the same; back home is allowed, any OTHER role section is still refused, the couple never move;
 *   (3) Delete on an own group = everyone to "Not walking" (filed under their HOME section) + the group goes;
 *   (4) a "Not walking" name dropped into an own group walks again, then regroups — one move;
 *   (5) the builder: in the march an own group holds its walkers (even empty it is drawn, in its saved place); the PRINT
 *       is unchanged — nobody leaves their role there;
 *   (6) the draft only keeps own-group steps that name an own key; Apply dispatches every kind; +0 server actions;
 *   (7) the Guests march offers ＋ Group in the thumb row's ＋ ▾ AND in the selected group's toolbar.
 *
 * 🛡 Sabotaged (2026-10-29): regroup replay appending to the SOURCE section → red on (2); planOut filing an own-group
 * walker under the own group → red on (3); dropping `own` from the march build → red on (5).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  newOwnGroupKey,
  newOwnGroupLabel,
  planGroupAdd,
  planGroupName,
  planMove,
  planSectionOut,
  replayMarch,
  sectionsMoved,
  type MarchSection,
  type MarchShown,
} from '@/lib/march-drag';
import { buildEntourage, isMarchOnlyGroup, isOwnMarchGroup, MARCH_GROUP_KEYS, marchOrderKeys, orderedGroupKeys, type EntourageGuestRow } from '@/lib/entourage';
import { sanitizeMarchStep } from '@/lib/march-draft';

const p = (id: string, name: string, role: string) => ({ id, name, role });
const groomSide = MARCH_GROUP_KEYS.find((k) => isMarchOnlyGroup(k))!;
const brideSide = [...MARCH_GROUP_KEYS].reverse().find((k) => isMarchOnlyGroup(k))!;
const OWN = 'own_abc123defg';

const base = (): MarchSection[] => [
  { key: groomSide, label: 'The Groom & his parents', rows: [[p('groom', 'Jose', 'groom'), null]] },
  {
    key: 'secondary_sponsors',
    label: 'Secondary Sponsors',
    rows: [[p('c1', 'Paolo Tan', 'candle_sponsor'), p('c2', 'Ivy Tan', 'candle_sponsor')], [p('v1', 'Karl Lim', 'veil_sponsor'), null]],
  },
  { key: 'bearers', label: 'Bearers', rows: [[p('rb', 'Joaquin Buanhog', 'ring_bearer'), null]] },
  { key: brideSide, label: 'The Bride & her parents', rows: [[null, p('bride', 'Maria', 'bride')]] },
];
const printed0 = ['secondary_sponsors', 'bearers'];
const shown = (sections: MarchSection[], printed = printed0): MarchShown => ({ sections, printed, out: [] });
const keys = (secs: readonly MarchSection[]) => secs.map((x) => x.key);
const strip = (secs: readonly MarchSection[]) => JSON.stringify(secs.map((x) => ({ k: x.key, l: x.label, r: x.rows.map((r) => r.map((q) => q?.id ?? null)) })));

test('(1) ＋ Group: an empty group after the selected one — or before the bride’s side — and it replays the same', () => {
  assert.match(newOwnGroupKey(), /^own_[0-9a-z]{10}$/);
  assert.ok(isOwnMarchGroup(newOwnGroupKey()) && !isOwnMarchGroup('bearers'));
  assert.equal(newOwnGroupLabel(base()), 'New group');
  const after = planGroupAdd(base(), printed0, [], OWN, 'New group', 'secondary_sponsors');
  assert.ok(after.ok);
  if (!after.ok) return;
  assert.deepEqual(keys(after.sections), [groomSide, 'secondary_sponsors', OWN, 'bearers', brideSide]);
  assert.deepEqual(after.printed, ['secondary_sponsors', OWN, 'bearers']);
  assert.equal(after.sections.find((x) => x.key === OWN)!.rows.length, 0, 'a new group is not empty');
  assert.equal(strip(replayMarch(shown(base()), after.steps).sections), strip(after.sections), 'the drafted ＋ Group replays differently');
  // After the bride's side (or nothing selected → the last section): it still walks BEFORE the bride.
  const last = planGroupAdd(base(), printed0, [], OWN, 'New group', brideSide);
  assert.ok(last.ok && keys(last.sections).at(-1) === brideSide && keys(last.sections).at(-2) === OWN, 'a new group walks after the bride');
  assert.ok(last.ok && last.steps[0]!.kind === 'group-add' && last.steps[0]!.after === 'bearers', 'the step names a side, not a section');
  const first = planGroupAdd(base(), printed0, [], OWN, 'New group', groomSide);
  assert.ok(first.ok && keys(first.sections)[1] === OWN && first.steps[0]!.kind === 'group-add' && first.steps[0]!.after === null);
  assert.equal(newOwnGroupLabel(after.sections), 'New group 2');
  const named = planGroupName(after.sections, after.printed, OWN, '  Flower Parade ');
  assert.ok(named && named.ok && named.sections.find((x) => x.key === OWN)!.label === 'Flower Parade');
  const blank = planGroupName(after.sections, after.printed, OWN, '   ');
  assert.ok(blank && !blank.ok, 'a group could be named nothing');
});

const withOwn = (): MarchSection[] => {
  const m = planGroupAdd(base(), printed0, [], OWN, 'Parade', 'secondary_sponsors');
  assert.ok(m.ok);
  return m.ok ? m.sections : [];
};
const printedOwn = ['secondary_sponsors', OWN, 'bearers'];

test('(2) a name into an own group leaves its walk, remembers home — back home yes, elsewhere no, the couple never', () => {
  const into = planMove(withOwn(), printedOwn, { kind: 'name', id: 'c2' }, { kind: 'gap', section: OWN, index: 0 });
  assert.ok(into && into.ok, into && !into.ok ? into.reason : 'no plan');
  if (!into || !into.ok) return;
  assert.deepEqual(into.steps.map((s) => s.kind), ['regroup', 'order']);
  const own = into.sections.find((x) => x.key === OWN)!;
  assert.equal(own.rows[0]![0]?.id ?? own.rows[0]![1]?.id, 'c2');
  assert.deepEqual(own.rows.flat().find((q) => q?.id === 'c2')!.home, { key: 'secondary_sponsors', label: 'Secondary Sponsors' });
  const sec = into.sections.find((x) => x.key === 'secondary_sponsors')!;
  assert.deepEqual(sec.rows.map((r) => r.filter(Boolean).map((q) => q!.id)), [['c1'], ['v1']], 'the walk-mate did not walk alone');
  assert.match(into.said, /Paolo Tan walks alone$/);
  assert.equal(strip(replayMarch(shown(withOwn(), printedOwn), into.steps).sections), strip(into.sections), 'the drafted regroup replays differently');

  // Beside a lone walker in the group: regroup, then walk together.
  const two = planMove(into.sections, printedOwn, { kind: 'name', id: 'rb' }, { kind: 'beside', anchor: 'c2' });
  assert.ok(two && two.ok && two.steps.map((s) => s.kind).join() === 'regroup,join');
  if (!two || !two.ok) return;
  assert.equal(two.sections.find((x) => x.key === 'bearers'), undefined, 'an emptied role section is still drawn');
  assert.equal(strip(replayMarch(shown(into.sections, printedOwn), two.steps).sections), strip(two.sections));

  // Back home: allowed. Into another role section: refused in words. The couple: never.
  const home = planMove(into.sections, printedOwn, { kind: 'name', id: 'c2' }, { kind: 'gap', section: 'secondary_sponsors', index: 0 });
  assert.ok(home && home.ok && home.steps[0]!.kind === 'regroup');
  if (home && home.ok) assert.equal(home.sections.flatMap((x) => x.rows.flat()).find((q) => q?.id === 'c2')!.home, undefined, 'home is still remembered at home');
  const elsewhere = planMove(into.sections, printedOwn, { kind: 'name', id: 'c2' }, { kind: 'gap', section: 'bearers', index: 0 });
  assert.ok(elsewhere && !elsewhere.ok, 'a walker crossed into a role section that is not theirs');
  const couple = planMove(withOwn(), printedOwn, { kind: 'name', id: 'groom' }, { kind: 'gap', section: OWN, index: 0 });
  assert.ok(couple && !couple.ok, 'the groom left his side');
  const roleToRole = planMove(base(), printed0, { kind: 'name', id: 'v1' }, { kind: 'gap', section: 'bearers', index: 0 });
  assert.ok(roleToRole && !roleToRole.ok, 'role sections stopped deciding by role');
});

test('(3) Delete an own group: its walkers to "Not walking" under their HOME section, and the group goes', () => {
  const into = planMove(withOwn(), printedOwn, { kind: 'name', id: 'v1' }, { kind: 'gap', section: OWN, index: 0 });
  assert.ok(into && into.ok);
  if (!into || !into.ok) return;
  const del = planSectionOut(into.sections, printedOwn, [], OWN);
  assert.ok(del && del.ok);
  if (!del || !del.ok) return;
  assert.deepEqual(del.steps.map((s) => s.kind), ['walking', 'group-drop']);
  assert.equal(del.sections.find((x) => x.key === OWN), undefined, 'the group is still drawn');
  assert.ok(!del.printed.includes(OWN));
  assert.deepEqual((del.out ?? []).map((o) => [o.id, o.section]), [['v1', 'secondary_sponsors']], 'the tray files them under the own group');
  assert.match(del.said, /Parade deleted · 1 moved to Not walking/);
  const replayed = replayMarch(shown(into.sections, printedOwn), del.steps);
  assert.equal(strip(replayed.sections), strip(del.sections));
  assert.deepEqual(replayed.out.map((o) => o.section), ['secondary_sponsors']);
  const empty = planSectionOut(withOwn(), printedOwn, [], OWN);
  assert.ok(empty && empty.ok && empty.steps.map((s) => s.kind).join() === 'group-drop', 'an empty own group cannot be deleted');
  // A role section's Delete is unchanged (no group-drop).
  const role = planSectionOut(base(), printed0, [], 'bearers');
  assert.ok(role && role.ok && role.steps.every((s) => s.kind === 'walking'));
});

test('(4) a "Not walking" name dropped into an own group walks again and joins it — one move', () => {
  const out = [{ ...p('fg', 'Ana Cruz', 'flower_girl'), section: 'flower_girls', sectionLabel: 'Flower Girls' }];
  const m = planMove(withOwn(), printedOwn, { kind: 'out', id: 'fg' }, { kind: 'gap', section: OWN, index: 0 }, out);
  assert.ok(m && m.ok, m && !m.ok ? m.reason : 'no plan');
  if (!m || !m.ok) return;
  assert.deepEqual(m.steps.map((s) => s.kind), ['walking', 'regroup', 'order']);
  assert.deepEqual(m.out, []);
  assert.equal(m.sections.find((x) => x.key === 'flower_girls'), undefined, 'their role section was drawn for nobody');
  const replayed = replayMarch({ sections: withOwn(), printed: printedOwn, out }, m.steps);
  assert.equal(strip(replayed.sections), strip(m.sections));
});

test('(5) the builder: own groups hold their walkers in the march, drawn even empty — the PRINT is unchanged', () => {
  const row = (id: string, first: string, role: string, walk: number, group: string | null): EntourageGuestRow => ({
    guest_id: id,
    first_name: first,
    last_name: 'Test',
    role,
    march: { walk_no: walk, place_in_walk: 0, march_group: group },
  });
  const rows = [row('c1', 'Paolo', 'candle_sponsor', 1, null), row('c2', 'Ivy', 'candle_sponsor', 2, OWN), row('rb', 'Jun', 'ring_bearer', 3, null)];
  const own = [{ key: OWN, label: 'Parade' }, { key: 'own_emptygroup1', label: 'Later' }];
  const saved = ['secondary_sponsors', OWN];
  const march = buildEntourage(rows, saved, null, undefined, { march: true, own });
  const k = march.map((g) => g.key);
  assert.ok(k.indexOf(OWN) === k.indexOf('secondary_sponsors') + 1, 'the own group is not in its saved place');
  assert.ok(k.includes('own_emptygroup1'), 'an empty own group is not drawn');
  const ids = (key: string) => march.find((g) => g.key === key)!.rows.flat().filter(Boolean).map((q) => q!.id);
  assert.deepEqual(ids(OWN), ['c2']);
  assert.deepEqual(ids('secondary_sponsors'), ['c1'], 'a walker in an own group is drawn twice');
  const print = buildEntourage(rows, saved, null, undefined);
  assert.ok(!print.some((g) => isOwnMarchGroup(g.key)), 'an own group printed on the invitation');
  assert.deepEqual(print.find((g) => g.key === 'secondary_sponsors')!.rows.flat().filter(Boolean).map((q) => q!.id).sort(), ['c1', 'c2']);
  assert.deepEqual(orderedGroupKeys(saved), orderedGroupKeys(['secondary_sponsors']), 'an own key changed the printed order');
  const mo = marchOrderKeys(['bearers', OWN], [OWN, 'own_newone12345']);
  assert.ok(mo.indexOf(OWN) === mo.indexOf('bearers') + 1 && mo.at(-1) === 'own_newone12345');
  assert.ok(!marchOrderKeys(['bearers', 'own_retired1234'], [OWN]).includes('own_retired1234'), 'a deleted group kept its place');
  assert.equal(sectionsMoved(['secondary_sponsors', OWN, 'bearers']), false, 'an own group reads as the sections moved');
});

test('(6) the draft keeps only own-group steps on own keys; Apply dispatches every kind; +0 server actions', () => {
  assert.deepEqual(sanitizeMarchStep({ kind: 'group-add', section: OWN, label: ' Parade ', after: null }), { kind: 'group-add', section: OWN, label: 'Parade', after: null });
  assert.equal(sanitizeMarchStep({ kind: 'group-add', section: 'bearers', label: 'x', after: null }), null, 'a built-in section could be made');
  assert.equal(sanitizeMarchStep({ kind: 'group-drop', section: 'bearers' }), null, 'a built-in section could be dropped');
  assert.equal(sanitizeMarchStep({ kind: 'group-name', section: OWN, label: 'x'.repeat(65) }), null);
  assert.deepEqual(sanitizeMarchStep({ kind: 'regroup', section: OWN, guest: 'g1' }), { kind: 'regroup', section: OWN, guest: 'g1' });
  const step = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/guests/march-step.ts'), 'utf8'));
  for (const k of ['group-add', 'group-name', 'group-drop', 'regroup']) assert.match(step, new RegExp(`case '${k}':`), `Apply drops ${k}`);
  const writer = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/guests/march-group-step.ts'), 'utf8');
  assert.doesNotMatch(stripComments(writer), /['"]use server['"]/, 'the own-group writes became endpoints');
  assert.match(writer, /rpc\('set_march_group'/);
  assert.match(writer, /writeSectionOrder\(/, 'the group’s place has a second writer');
});

test('(7) the Guests march offers ＋ Group — the thumb row’s ＋ ▾ and the selected group’s toolbar', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/launch/_components/details-march.tsx'), 'utf8'));
  assert.match(src, /\{ key: NEW_GROUP, label: 'New group', group: 'Groups' \}/, 'the thumb row’s ＋ ▾ has no New group');
  assert.match(src, /if \(id === NEW_GROUP\) return addGroup\(marchSel\);/);
  assert.match(src, /onAddGroup=\{\(\) => addGroup\(selSec\.key\)\}/, 'the selected group’s toolbar has no ＋ Group');
  assert.match(src, /run\(planGroupAdd\(shown, shownPrinted, shownOut, key, newOwnGroupLabel\(shown\), at\)\);/);
  assert.match(src, /data-march-own-empty=""/, 'an empty own group has nowhere to drop a name');
  const bar = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/guests/_components/section-head-toolbar.tsx'), 'utf8'));
  assert.match(bar, /\{onAddGroup \? <ActionButton tone="neutral" icon=\{Plus\} label="Group"/);
});
