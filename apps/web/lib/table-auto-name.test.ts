/**
 * 🪑 A TABLE NAMES ITSELF AFTER ITS MAJORITY GROUP; A HOST-SET NAME IS NEVER OVERWRITTEN; NAMES ARE UNIQUE (owner
 * 2026-11-27, ruling R6; corpus SEAT-PLAN-COMPLETE-2026-11-27.md § 4.3 and § 7 "Pure tests"). Executed on small plans,
 * and the plan's badges are held unique on the names the tables SHOW.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoDefaultLabel,
  autoNameFor,
  hostNameClash,
  isDefaultTableLabel,
  renameWrites,
  tableDisplayNames,
  tableNameInfos,
  tableNameWhyWords,
  withDisplayNames,
  type NameGroups,
  type NameSeat,
  type NameTable,
} from '@/lib/table-auto-name';
import { planTableBadges } from '@/lib/plan-table-badges';

const GROUPS = [
  { group_id: 'g-reyes', label: 'Reyes family' },
  { group_id: 'g-choir', label: 'Parish choir' },
  { group_id: 'g-office', label: 'Office' },
];

/** `n` guests g{prefix}1…g{prefix}n, all in `group` (or none), seated at `table`. */
function seat(table: string, prefix: string, n: number, group: string | null) {
  const seats: NameSeat[] = [];
  const members: Array<{ guest_id: string; group_id: string }> = [];
  for (let i = 1; i <= n; i += 1) {
    const id = `${prefix}${i}`;
    seats.push({ guest_id: id, table_id: table });
    if (group) members.push({ guest_id: id, group_id: group });
  }
  return { seats, members };
}

function plan(parts: Array<ReturnType<typeof seat>>, broughtBy: Array<{ guest_id: string; plus_one_of_guest_id: string | null }> = []) {
  const groups: NameGroups = { labels: GROUPS, members: parts.flatMap((p) => p.members), broughtBy };
  return { seated: parts.flatMap((p) => p.seats), groups };
}

const auto = (id: string, n: number, sort = n): NameTable => ({ table_id: id, table_label: `Table ${n}`, label_is_auto: true, sort_order: sort });

test('majority: more than half of the seated seats names the table', () => {
  const { seated, groups } = plan([seat('t1', 'r', 6, 'g-reyes'), seat('t1', 'x', 4, null)]);
  const names = tableDisplayNames([auto('t1', 1)], seated, groups);
  assert.equal(names.get('t1'), 'Reyes family');
  const why = tableNameInfos([auto('t1', 1)], seated, groups).get('t1')!.why;
  assert.equal(tableNameWhyWords(why), 'Auto · 6 of 10 seated here are Reyes family');
});

test('exactly half is not a majority — the table keeps "Table N"', () => {
  const { seated, groups } = plan([seat('t1', 'r', 5, 'g-reyes'), seat('t1', 'x', 5, null)]);
  assert.equal(tableDisplayNames([auto('t1', 3)], seated, groups).get('t1'), 'Table 3');
  const why = tableNameInfos([auto('t1', 3)], seated, groups).get('t1')!.why;
  assert.equal(tableNameWhyWords(why), 'Auto · no group has more than half the seats yet');
});

test('an empty table is "Table N"', () => {
  const { seated, groups } = plan([]);
  assert.equal(tableDisplayNames([auto('t1', 7)], seated, groups).get('t1'), 'Table 7');
});

test('a host name is kept, whoever sits there', () => {
  const { seated, groups } = plan([seat('t1', 'r', 10, 'g-reyes')]);
  const t: NameTable = { table_id: 't1', table_label: 'Barkada', label_is_auto: false, sort_order: 1 };
  assert.equal(tableDisplayNames([t], seated, groups).get('t1'), 'Barkada');
  assert.equal(tableNameWhyWords(tableNameInfos([t], seated, groups).get('t1')!.why), 'Named by you · moving guests never changes it');
  // A row read without the flag is never renamed.
  assert.equal(tableDisplayNames([{ table_id: 't1', table_label: 'Barkada' }], seated, groups).get('t1'), 'Barkada');
});

test('unique: a clashing auto name takes " 2", " 3" in plan order; a host name keeps its name', () => {
  const { seated, groups } = plan([
    seat('t1', 'a', 8, 'g-reyes'),
    seat('t2', 'b', 8, 'g-reyes'),
    seat('t3', 'c', 8, 'g-reyes'),
    seat('t4', 'd', 8, 'g-choir'),
  ]);
  const tables: NameTable[] = [
    auto('t2', 2),
    auto('t1', 1),
    auto('t3', 3),
    { table_id: 't0', table_label: 'Reyes family', label_is_auto: false, sort_order: 9 },
    auto('t4', 4),
  ];
  const names = tableDisplayNames(tables, seated, groups);
  assert.equal(names.get('t0'), 'Reyes family');
  assert.equal(names.get('t1'), 'Reyes family 2');
  assert.equal(names.get('t2'), 'Reyes family 3');
  assert.equal(names.get('t3'), 'Reyes family 4');
  assert.equal(names.get('t4'), 'Parish choir');
  assert.equal(new Set(names.values()).size, names.size);
});

test('a suffix never lands on a name another table already wears', () => {
  const { seated, groups } = plan([seat('t1', 'a', 4, 'g-office'), seat('t2', 'b', 4, 'g-office')]);
  const tables: NameTable[] = [
    auto('t1', 1),
    auto('t2', 2),
    { table_id: 'h', table_label: 'Office 2', label_is_auto: false, sort_order: 0 },
  ];
  const names = tableDisplayNames(tables, seated, groups);
  assert.equal(names.get('t1'), 'Office');
  assert.equal(names.get('t2'), 'Office 3');
});

test('a host name equal to another table\'s shown name is refused', () => {
  const { seated, groups } = plan([seat('t1', 'r', 9, 'g-reyes')]);
  const tables = [auto('t1', 1), auto('t2', 2)];
  const names = tableDisplayNames(tables, seated, groups);
  assert.equal(hostNameClash('t2', 'Reyes family', names), 'Reyes family already has that name. Pick another.');
  assert.equal(hostNameClash('t2', '  reyes   FAMILY ', names), 'Reyes family already has that name. Pick another.');
  assert.equal(hostNameClash('t1', 'Reyes family', names), null, 'its own name is no clash');
  assert.equal(hostNameClash('t2', 'Lolas & Titas', names), null);
  assert.equal(hostNameClash('t2', '', names), null, 'an empty name returns to auto');
});

test('a +1 counts under the guest who brought them', () => {
  // 4 Reyes guests and their 4 +1s (no group of their own) + 2 strangers = 8 of 10.
  const reyes = seat('t1', 'r', 4, 'g-reyes');
  const plusOnes = seat('t1', 'p', 4, null);
  const strangers = seat('t1', 'x', 2, null);
  const broughtBy = [1, 2, 3, 4].map((i) => ({ guest_id: `p${i}`, plus_one_of_guest_id: `r${i}` }));
  const withBringer = plan([reyes, plusOnes, strangers], broughtBy);
  assert.equal(tableDisplayNames([auto('t1', 1)], withBringer.seated, withBringer.groups).get('t1'), 'Reyes family');
  // Without the link the same table has no majority (4 of 10).
  const without = plan([reyes, plusOnes, strangers]);
  assert.equal(tableDisplayNames([auto('t1', 1)], without.seated, without.groups).get('t1'), 'Table 1');
});

test('two qualifying groups (a guest in both): more seats wins, then A→Z', () => {
  const both = seat('t1', 'b', 6, 'g-reyes');
  const alsoChoir = { seats: [], members: both.seats.map((s) => ({ guest_id: s.guest_id, group_id: 'g-choir' })) };
  const extraChoir = seat('t1', 'c', 1, 'g-choir');
  const p = plan([both, alsoChoir, extraChoir, seat('t1', 'x', 3, null)]);
  // Reyes 6 of 10, choir 7 of 10 → choir.
  assert.equal(tableDisplayNames([auto('t1', 1)], p.seated, p.groups).get('t1'), 'Parish choir');
  // Tied: A→Z.
  const tie = plan([both, alsoChoir, seat('t1', 'x', 4, null)]);
  assert.equal(tableDisplayNames([auto('t1', 1)], tie.seated, tie.groups).get('t1'), 'Parish choir');
});

test('returning to auto: the default label comes back, and the preview names it', () => {
  const { seated, groups } = plan([seat('t2', 'r', 8, 'g-reyes')]);
  const tables: NameTable[] = [auto('t1', 1), { table_id: 't2', table_label: 'VIPs', label_is_auto: false, sort_order: 2 }, auto('t3', 3)];
  assert.equal(autoDefaultLabel('t2', tables), 'Table 2');
  assert.equal(autoNameFor('t2', tables, seated, groups), 'Reyes family');
  assert.equal(autoNameFor('t1', tables, seated, groups), 'Table 1');
  assert.equal(isDefaultTableLabel('table  12'), true);
  assert.equal(isDefaultTableLabel('Sweetheart'), false);
});

test('the plan\'s badges stay unique on the names the tables show', () => {
  const { seated, groups } = plan([
    seat('t1', 'a', 8, 'g-reyes'),
    seat('t2', 'b', 8, 'g-reyes'),
    seat('t3', 'c', 8, 'g-office'),
  ]);
  const tables = [auto('t1', 1), auto('t2', 2), auto('t3', 3), auto('t4', 4), { table_id: 't5', table_label: 'Rey Fam', label_is_auto: false, sort_order: 5 }];
  const shown = withDisplayNames(tables, tableDisplayNames(tables, seated, groups));
  assert.deepEqual(
    shown.map((t) => t.table_label),
    ['Reyes family', 'Reyes family 2', 'Office', 'Table 4', 'Rey Fam'],
  );
  const badges = planTableBadges(shown);
  assert.equal(new Set(badges.values()).size, tables.length, `badges must be unique: ${[...badges.values()].join(' ')}`);
});

test('linked tables are one unit: one shared auto name, read from all their seats', () => {
  // Each half alone has no majority (4 of 8 Reyes); together 8 of 12 → Reyes family on BOTH.
  const reyesA = seat('la', 'ra', 4, 'g-reyes');
  const otherA = seat('la', 'xa', 4, null);
  const reyesB = seat('lb', 'rb', 4, 'g-reyes');
  const { seated, groups } = plan([reyesA, otherA, reyesB]);
  const tables: NameTable[] = [
    { table_id: 'la', table_label: 'Table 1', label_is_auto: true, sort_order: 1, link_group_id: 'L', link_group_label: 'Table 1' },
    { table_id: 'lb', table_label: 'Table 2', label_is_auto: true, sort_order: 2, link_group_id: 'L', link_group_label: 'Table 1' },
    auto('t3', 3),
  ];
  const names = tableDisplayNames(tables, seated, groups);
  assert.equal(names.get('la'), 'Reyes family');
  assert.equal(names.get('lb'), 'Reyes family', 'the linked run wears one name, never "Reyes family 2"');
  assert.equal(names.get('t3'), 'Table 3');
  const shown = withDisplayNames(tables, names);
  assert.equal(shown[1]!.link_group_label, 'Reyes family', 'the unit name the plan reads follows too');
  // A host-named unit keeps its unit name on every member; its own name is no clash for a sibling.
  const host = tables.map((t) => (t.link_group_id ? { ...t, label_is_auto: false, link_group_label: 'Long table' } : t));
  const hostNames = tableDisplayNames(host, seated, groups);
  assert.equal(hostNames.get('la'), 'Long table');
  assert.equal(hostNames.get('lb'), 'Long table');
  assert.equal(hostNameClash('lb', 'Long table', hostNames), null);
  assert.equal(hostNameClash('t3', 'Long table', hostNames), 'Long table already has that name. Pick another.');
});

test('a name field tapped away from never renames: only a real change writes', () => {
  const autoT = { table_label: 'Table 3', label_is_auto: true };
  const hostT = { table_label: 'Barkada', label_is_auto: false };
  // The field shows "Reyes family" (the auto name); focusing and leaving it writes nothing.
  assert.equal(renameWrites(autoT, 'Reyes family', 'Reyes family'), 'none');
  assert.equal(renameWrites(autoT, '  Table 3 ', 'Reyes family'), 'none', 'the stored default is no change either');
  assert.equal(renameWrites(autoT, '', 'Reyes family'), 'none', 'empty on an auto table changes nothing');
  assert.equal(renameWrites(autoT, 'Ninongs', 'Reyes family'), 'host');
  assert.equal(renameWrites(hostT, 'Barkada', 'Barkada'), 'none');
  assert.equal(renameWrites(hostT, '', 'Barkada'), 'auto', 'an empty Save returns a host name to auto');
  assert.equal(renameWrites(hostT, 'College friends', 'Barkada'), 'host');
  // Exact, not case-folded: changing only the capitals is a rename the host meant.
  assert.equal(renameWrites({ table_label: 'reyes family', label_is_auto: false }, 'Reyes Family', 'reyes family'), 'host');
  assert.equal(renameWrites(autoT, 'reyes family', 'Reyes family'), 'host', 'an auto name re-typed in other capitals becomes the host\'s');
});
