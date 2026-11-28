/**
 * 🪑 EVERY TABLE ON THE SEAT PLAN WEARS A SENSIBLE, UNIQUE SHORT NAME (bug, 27 Nov 2026, Apple build 10 walkthrough of
 * Maria & Jose's 2D plan: one round read "·" and two tables both read "9"). The plan drew `label.match(/\d+/)` or "·".
 * Held here, EXECUTED on the sample event's own tables (scripts/seed-sample-event-maria-jose-content.sql) plus a linked
 * pair under one unit name, and the seat plan is held to the one function.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { planBadgeBase, planTableBadges, type PlanBadgeTable } from '@/lib/plan-table-badges';

const MARIA_JOSE: PlanBadgeTable[] = [
  { table_id: 't-sweet', table_label: 'Sweetheart Table', sort_order: 0 },
  { table_id: 't-ps1', table_label: 'Principal Sponsors 1', sort_order: 1 },
  { table_id: 't-ps2', table_label: 'Principal Sponsors 2', sort_order: 2 },
  { table_id: 't-famB', table_label: 'Family of the Bride', sort_order: 3 },
  { table_id: 't-famG', table_label: 'Family of the Groom', sort_order: 4 },
  { table_id: 't-friends', table_label: 'Friends — Barkada', sort_order: 5 },
  { table_id: 't-entourage', table_label: 'Entourage', sort_order: 6 },
  { table_id: 't-8', table_label: 'Table 8', sort_order: 7 },
  // Two serpentine halves linked as ONE unit: each member wears the unit's name.
  { table_id: 't-9a', table_label: 'Table 9', link_group_label: 'Table 9', sort_order: 8 },
  { table_id: 't-9b', table_label: 'Table 11', link_group_label: 'Table 9', sort_order: 9 },
  { table_id: 't-10', table_label: 'Table 10', sort_order: 10 },
];

test('no table reads "·" and no two tables read alike', () => {
  const badges = planTableBadges(MARIA_JOSE);
  assert.equal(badges.size, MARIA_JOSE.length, 'a table on the plan has no badge');
  const all = [...badges.values()];
  for (const b of all) assert.match(b, /^[\p{Lu}\p{N}]+$/u, `"${b}" is not a readable short name`);
  assert.equal(new Set(all).size, all.length, `two tables read alike: ${all.join(' ')}`);
});

test('the sample event reads as its names say', () => {
  const b = planTableBadges(MARIA_JOSE);
  assert.equal(b.get('t-entourage'), 'E', 'the "·" round in the walkthrough is Entourage');
  assert.equal(b.get('t-sweet'), 'S');
  assert.equal(b.get('t-ps1'), '1');
  assert.equal(b.get('t-ps2'), '2');
  assert.equal(b.get('t-8'), '8');
  assert.equal(b.get('t-10'), '10');
  // The linked unit keeps its number, one part letter per member, in plan order.
  assert.equal(b.get('t-9a'), '9A');
  assert.equal(b.get('t-9b'), '9B');
  // Family of the Bride and Friends — Barkada would both read "FB": each takes a count, in plan order.
  assert.equal(b.get('t-famB'), 'FB1');
  assert.equal(b.get('t-famG'), 'FG');
  assert.equal(b.get('t-friends'), 'FB2');
});

test('the one-table rule: a number first, else initials without the small words, else "T"', () => {
  assert.equal(planBadgeBase('Table 12'), '12');
  assert.equal(planBadgeBase('Table 9a'), '9A');
  assert.equal(planBadgeBase('Family of the Bride'), 'FB');
  assert.equal(planBadgeBase('Mesa ng Pamilya'), 'P');
  assert.equal(planBadgeBase('Table'), 'T');
  assert.equal(planBadgeBase(''), 'T');
  assert.equal(planBadgeBase(null), 'T');
});

test('a part mark never takes a badge another table already wears', () => {
  const b = planTableBadges([
    { table_id: 'a', table_label: 'Table 9', sort_order: 0 },
    { table_id: 'b', table_label: 'Sponsors 9', sort_order: 1 },
    { table_id: 'c', table_label: 'Table 9A', sort_order: 2 },
  ]);
  assert.equal(b.get('c'), '9A');
  assert.deepEqual([b.get('a'), b.get('b')], ['9B', '9C']);
});

test('the seat plan draws the one function, never a digit grab or a "·"', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8'),
  );
  // 🪑 Fed the names the tables SHOW (lib/table-auto-name.ts, seat plan § 4.3), so the badges stay unique on auto names.
  assert.match(src, /const planBadges = useMemo\(\(\) => planTableBadges\(withDisplayNames\(tables, shownNames\)\), \[tables, shownNames\]\);/);
  assert.match(src, /const num = planBadges\.get\(t\.table_id\)/);
  assert.doesNotMatch(src, /(table_label|displayLabel)\.match\(\/\\d\+\/\)/, 'the plan grabs a label’s digits again');
});
