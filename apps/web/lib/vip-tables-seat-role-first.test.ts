/**
 * vip-tables-seat-role-first.test.ts — 🪑 seating slice B, the owner's FINAL SEATING PRECEDENCE (DECISION_LOG
 * 2026-11-02): *"VIP should always be role first then group. then if there are plus 1, we pick if they sit beside on
 * the VIP or locate them. to the nearest table of the VIP. this also means all plus of the VIP should sit together."*
 * and *"sit with their group follows what group they are in and clusters them and all with roles must be clustered
 * together as well in that group"*. Run on a DUMMY room shaped like the real one (25 tables of 10, ~230 guests,
 * groups, roles, +1s, two VIP tables) — no real data.
 *
 *   1 · VIP ROLE FIRST: the VIP tables hold role holders only, in the Guests list's role order, then group.
 *   2 · +1s 'beside' (default): a VIP guest's +1 sits beside them at the VIP table.
 *   3 · +1s 'nearest': no +1 sits at a VIP table; ALL of them sit TOGETHER at the table(s) nearest the VIP tables.
 *   4 · EVERYONE ELSE, GROUP FIRST: a role holder the VIP tables had no room for sits with their GROUP.
 *   5 · ROLES CLUSTERED INSIDE THE GROUP: role holders take the group's first, consecutive chairs, in role order.
 *   6 · NOTHING SPLIT OR DROPPED SILENTLY: every eligible guest is seated or named in `cannotFit`, and the editor shows it.
 *   7 · The VIP mark and the +1 pick are wired: one column each, read by `fetchTables`/the floor plan, drawn in List,
 *       2D and 3D, one dropdown in the seating rules.
 *
 * SABOTAGE (each seen red, then restored): the VIP pass skipped (`vipTables` forced empty) → 1, 3, 4 · the 'nearest'
 * `away` split removed → 3 · `unitKeyOf` returning the role-set key for VIP overflow → 4 · chunks sorted by name only
 * (not `byRoleThenName`) → 5 · the `no_room` report removed → 6 · the group `split` report removed → 6.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { rosterRoleRank } from './role-groups';
import type { GuestRole } from './guests';
import {
  cannotFitWords,
  computeAutoSeat,
  parseVipPlusOneSeating,
  type AutoSeatCannotFit,
  type AutoSeatGuest,
  type AutoSeatRow,
  type EventTableRow,
} from './seating';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

/** Table 1…25 in a 5 × 5 grid, stage top-centre; Tables 2 and 3 (front row) are VIP. */
function room(vip: readonly number[] = [2, 3]): EventTableRow[] {
  return Array.from({ length: 25 }, (_, i) => ({
    table_id: `t${String(i + 1).padStart(2, '0')}`,
    public_id: `S89T-DUMMY${i}`,
    event_id: 'dummy',
    table_label: `Table ${i + 1}`,
    table_type: 'round_10' as EventTableRow['table_type'],
    capacity: 10,
    sort_order: i,
    x_pos: 10 + (i % 5) * 20,
    y_pos: 15 + Math.floor(i / 5) * 15,
    removed_seats: [],
    is_vip: vip.includes(i + 1),
  }));
}

type G = AutoSeatGuest;
function people() {
  const guests: G[] = [];
  let n = 0;
  const add = (over: Partial<G>): G => {
    const g = { guest_id: `g${String(n).padStart(3, '0')}`, role: 'guest', group_category: 'friends', rsvp_status: 'attending', plus_one_of_guest_id: null, last_name: 'Cruz', first_name: `N${String(n).padStart(3, '0')}`, group_id: null, ...over } as G;
    n++;
    guests.push(g);
    return g;
  };
  // Role holders, each in a group of their own people (as on the real list).
  const fam = ['bride_parents', 'bride_parents', 'groom_parents', 'groom_parents', 'bride_immediate_family', 'groom_immediate_family'].map((role, i) =>
    add({ role, group_category: 'family', group_id: i % 2 ? 'grp-groomfam' : 'grp-bridefam' }),
  );
  const crew = ['maid_of_honor', 'best_man', 'bridesmaid', 'bridesmaid', 'groomsman', 'groomsman'].map((role, i) => add({ role, group_id: i % 2 ? 'grp-work' : 'grp-college' }));
  const sponsors = Array.from({ length: 8 }, (_, i) => add({ role: i % 2 ? 'principal_sponsor_ninang' : 'principal_sponsor_ninong', group_id: `grp-${i % 4}` }));
  // Each sponsor brings their spouse (a +1 with no role of their own).
  const spouses = sponsors.map((s) => add({ group_id: s.group_id, plus_one_of_guest_id: s.guest_id }));
  // Everyone else: 20 groups of 9, every third guest with a +1.
  for (let grp = 0; grp < 20; grp++) {
    for (let k = 0; k < 8; k++) {
      const host = add({ group_id: `grp-${grp}` });
      if (k % 4 === 0) add({ group_id: `grp-${grp}`, plus_one_of_guest_id: host.guest_id });
    }
  }
  // Two readers (a role with no seating set) inside an ordinary group of their own friends.
  const readers = [add({ role: 'reader_lector', group_id: 'grp-7' }), add({ role: 'reader_lector', group_id: 'grp-7' })];
  return { guests, fam, crew, sponsors, spouses, readers };
}

const tableOf = (rows: AutoSeatRow[], id: string) => rows.find((r) => r.guest_id === id)?.table_id ?? null;
const seatOf = (rows: AutoSeatRow[], id: string) => rows.find((r) => r.guest_id === id)!.seat_number;
const VIP = new Set(['t02', 't03']);
const isRole = (g: G) => g.role !== 'guest';

test('the dummy room is shaped like the real one', () => {
  const { guests } = people();
  assert.ok(guests.length >= 220 && guests.length <= 240, `${guests.length} guests`);
  assert.equal(room().filter((t) => t.is_vip).length, 2);
});

test('1 · VIP tables: role holders only, in the Guests list role order — then group', () => {
  const { guests, fam, crew, sponsors } = people();
  const rows = computeAutoSeat(room(), guests, []);
  const byId = new Map(guests.map((g) => [g.guest_id, g]));
  const atVip = rows.filter((r) => VIP.has(r.table_id)).map((r) => byId.get(r.guest_id)!);
  assert.equal(atVip.length, 20, 'the VIP tables are not full');
  // Only role holders and the +1s they bring ('beside', the default).
  for (const g of atVip) assert.ok(isRole(g) || (g.plus_one_of_guest_id && isRole(byId.get(g.plus_one_of_guest_id)!)), `${g.guest_id} (${g.role}) sits at a VIP table`);
  // Role order: the families and the crews (above the sponsors on the Guests list) are all in.
  for (const g of [...fam, ...crew]) assert.ok(VIP.has(tableOf(rows, g.guest_id)!), `${g.role} ${g.guest_id} is not at a VIP table`);
  // …and no role sits at VIP while a role ABOVE it on the list is left out.
  const out = guests.filter((g) => isRole(g) && !g.plus_one_of_guest_id && !VIP.has(tableOf(rows, g.guest_id) ?? ''));
  const worstIn = Math.max(...atVip.filter(isRole).map((g) => rosterRoleRank(g.role as GuestRole)));
  const sponsorsIn = sponsors.filter((s) => VIP.has(tableOf(rows, s.guest_id)!)).length;
  assert.ok(sponsorsIn >= 1 && sponsorsIn < sponsors.length, `sponsors at VIP: ${sponsorsIn}`);
  for (const g of out) {
    if (g.role === 'reader_lector') continue; // ranks below the sponsors
    assert.ok(rosterRoleRank(g.role as GuestRole) >= worstIn, `${g.role} was left out while a lower role sat at VIP`);
  }
});

test('2 · +1s of VIP guests, "Beside them at the VIP table" (the default): the next chair, same table', () => {
  const { guests, sponsors, spouses } = people();
  for (const mode of [undefined, 'beside' as const]) {
    const rows = computeAutoSeat(room(), guests, [], undefined, null, undefined, true, null, mode ? { vipPlusOnes: mode } : {});
    let checked = 0;
    sponsors.forEach((s, i) => {
      const t = tableOf(rows, s.guest_id)!;
      if (!VIP.has(t)) return;
      checked++;
      assert.equal(tableOf(rows, spouses[i]!.guest_id), t, 'the +1 is at another table');
      const gap = Math.abs(seatOf(rows, s.guest_id) - seatOf(rows, spouses[i]!.guest_id));
      assert.ok(gap === 1 || gap === 9, `not beside (gap ${gap})`);
    });
    assert.ok(checked > 0);
  }
});

test('3 · +1s of VIP guests, "At the nearest table to the VIP": none at VIP, ALL together at the nearest tables', () => {
  const { guests, sponsors, spouses } = people();
  const tables = room();
  const rows = computeAutoSeat(tables, guests, [], undefined, null, undefined, true, null, { vipPlusOnes: 'nearest' });
  const vipSponsors = sponsors.filter((s) => VIP.has(tableOf(rows, s.guest_id)!));
  assert.ok(vipSponsors.length >= 4, `only ${vipSponsors.length} sponsors at VIP — with their +1s away, more fit`);
  const away = vipSponsors.map((s) => spouses[sponsors.indexOf(s)]!);
  for (const p of away) assert.ok(!VIP.has(tableOf(rows, p.guest_id) ?? 't02'), `${p.guest_id} sits at a VIP table`);
  const at = new Set(away.map((p) => tableOf(rows, p.guest_id)!));
  assert.equal(at.size, 1, `the VIP +1s are split across ${[...at].join(', ')}`);
  // …at the table nearest a VIP table (2D distance; ties → the natural table order).
  const pt = (id: string) => tables.find((t) => t.table_id === id)!;
  const d = (a: EventTableRow, b: EventTableRow) => Math.hypot(Number(a.x_pos) - Number(b.x_pos), Number(a.y_pos) - Number(b.y_pos));
  const nearest = tables.filter((t) => !t.is_vip).sort((a, b) => Math.min(d(a, pt('t02')), d(a, pt('t03'))) - Math.min(d(b, pt('t02')), d(b, pt('t03'))) || a.table_label.localeCompare(b.table_label, 'en', { numeric: true }))[0]!;
  assert.equal([...at][0], nearest.table_id, `they sit at ${[...at][0]}, not the nearest table (${nearest.table_id})`);
  assert.equal(parseVipPlusOneSeating('nearest'), 'nearest');
  assert.equal(parseVipPlusOneSeating('junk'), 'beside', 'a stored junk value reads as the default');
});

test('4 · everyone else is GROUP first: a role holder the VIP tables had no room for sits with their group', () => {
  const { guests, sponsors } = people();
  const cannotFit: AutoSeatCannotFit[] = [];
  const rows = computeAutoSeat(room(), guests, [], undefined, null, undefined, true, null, { cannotFit });
  const left = sponsors.filter((s) => !VIP.has(tableOf(rows, s.guest_id)!));
  assert.ok(left.length > 0);
  for (const s of left) {
    const friends = guests.filter((g) => g.group_id === s.group_id && g.role === 'guest' && !g.plus_one_of_guest_id && !VIP.has(tableOf(rows, g.guest_id) ?? ''));
    const mates = new Set(friends.map((f) => tableOf(rows, f.guest_id)));
    assert.ok(mates.has(tableOf(rows, s.guest_id)), `${s.guest_id} does not sit with their group ${s.group_id}`);
  }
  // …and that is SHOWN.
  const full = cannotFit.find((c) => c.kind === 'vip_full');
  assert.ok(full, 'the VIP overflow was not reported');
  const allLeft = guests.filter((g) => isRole(g) && !g.plus_one_of_guest_id && !VIP.has(tableOf(rows, g.guest_id) ?? ''));
  assert.deepEqual(new Set(full.guestIds), new Set(allLeft.map((g) => g.guest_id)), 'the report does not name exactly who was left out');
});

test('5 · roles clustered inside the group: the first consecutive chairs, in role order', () => {
  const tables = room([]);
  const grp = [
    { guest_id: 'z1', role: 'guest', last_name: 'Abad', first_name: 'A' },
    { guest_id: 'z2', role: 'guest', last_name: 'Bato', first_name: 'B' },
    { guest_id: 'r2', role: 'bridesmaid', last_name: 'Yap', first_name: 'Y' },
    { guest_id: 'z3', role: 'guest', last_name: 'Cruz', first_name: 'C' },
    { guest_id: 'r1', role: 'reader_lector', last_name: 'Zamora', first_name: 'Z' },
    { guest_id: 'z4', role: 'guest', last_name: 'Diaz', first_name: 'D' },
  ].map((g) => ({ group_category: 'friends', rsvp_status: 'attending', plus_one_of_guest_id: null, group_id: 'barkada', ...g }) as G);
  // The crew is switched to "Sit with their group" so the bridesmaid sits with her barkada.
  const rows = computeAutoSeat(tables, grp, [], undefined, null, undefined, true, { wedding_party: 'group' });
  assert.equal(new Set(rows.map((r) => r.table_id)).size, 1, 'the group is split');
  const order = [...rows].sort((a, b) => a.seat_number - b.seat_number).map((r) => r.guest_id);
  assert.deepEqual(order.slice(0, 2), ['r2', 'r1'], `the role holders are not first and in role order: ${order.join(' ')}`);
  assert.equal(Math.abs(seatOf(rows, 'r1') - seatOf(rows, 'r2')), 1, 'the role holders are not side by side');
});

test('6 · nothing split or dropped silently: everyone is seated or named, and the editor shows it', () => {
  const { guests } = people();
  // A room too small for everyone: 15 tables.
  const small = room().slice(0, 15);
  const cannotFit: AutoSeatCannotFit[] = [];
  const rows = computeAutoSeat(small, guests, [], undefined, null, undefined, true, null, { cannotFit });
  const seated = new Set(rows.map((r) => r.guest_id));
  const named = new Set(cannotFit.filter((c) => c.kind === 'no_room').flatMap((c) => c.guestIds));
  for (const g of guests) assert.ok(seated.has(g.guest_id) || named.has(g.guest_id), `${g.guest_id} has no chair and nobody is told`);
  assert.ok(named.size > 0);
  const words = cannotFitWords(cannotFit, (id) => (id === [...named][0] ? 'Ana Reyes' : 'Someone'));
  assert.match(words, /no chair for/);
  assert.equal(cannotFitWords([], () => ''), '', 'nothing to say when everything fits');
  // A group of 6 that fits one table, in a room with only 5 + 5 chairs left: it splits — and that is SAID.
  const two = room([]).slice(0, 2);
  const pre = two.flatMap((t) => [0, 1, 2, 3, 4].map((k) => ({ assignment_id: `a${t.table_id}${k}`, table_id: t.table_id, guest_id: `p${t.table_id}${k}`, seat_number: k })));
  const six = Array.from({ length: 6 }, (_, i) => ({ guest_id: `s${i}`, role: 'guest', group_category: 'friends', rsvp_status: 'attending', plus_one_of_guest_id: null, last_name: 'Six', first_name: `${i}`, group_id: 'six' }) as G);
  const splitReport: AutoSeatCannotFit[] = [];
  computeAutoSeat(two, six, pre, undefined, null, undefined, true, null, { cannotFit: splitReport });
  const split = splitReport.find((c) => c.kind === 'split');
  assert.ok(split, 'a group split across two tables was not reported');
  assert.equal(split.tableIds.length, 2);
  // The editor puts it in the Auto arrange toast, from the server's own list.
  const act = read('app/dashboard/[eventId]/seating/actions.ts');
  assert.match(act, /changedTableIds: [^\n]*\n\s*cannotFit,\n/, 'auto arrange does not return what could not fit');
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(ed, /cannotFitWords\(res\.cannotFit/, 'the editor does not show what could not fit');
  assert.match(ed, /\+ overflowNote \+ cannotFitNote/, 'the note never reaches the toast');
});

test('7 · wired: the VIP column + the +1 pick are read, marked in List / 2D / 3D, and set in one place each', () => {
  const mig = readFileSync(join(__dirname, '..', '..', '..', 'supabase/migrations/20271302302532_seating_vip_tables.sql'), 'utf8').replace(/--.*$/gm, '');
  assert.match(mig, /ALTER TABLE public\.event_tables\s+ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(mig, /ADD COLUMN IF NOT EXISTS vip_plus_ones TEXT NOT NULL DEFAULT 'beside'/);
  assert.doesNotMatch(mig, /\bUPDATE\b/i, 'no backfill UPDATE (the column default is the value)');
  const seating = read('lib/seating.ts');
  assert.match(seating, /link_group_label,is_vip'/, 'fetchTables does not read is_vip');
  assert.match(seating, /role_seating,vip_plus_ones,/, 'the floor plan does not read vip_plus_ones');
  const act = read('app/dashboard/[eventId]/seating/actions.ts');
  for (const call of act.match(/computeAutoSeat\([\s\S]*?\);/g) ?? []) {
    if (/\[\],\s*\{ x: floorPlan/.test(call)) continue; // the first draft builds fresh tables — none is VIP yet
    assert.match(call, /vipPlusOnes: floorPlan\.vip_plus_ones/, `a seater ignores the host's +1 pick: ${call.slice(0, 80)}`);
  }
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.equal((ed.match(/<VipMark \/>/g) ?? []).length, 2, 'the 2D plan draws the VIP mark on both hub kinds');
  assert.match(ed, /setTableVip\(st, k === 'vip-on'\)/, 'the 2D table ⋯ cannot mark VIP');
  assert.match(ed, /\{vipPick\(m, 'data-seat-list-vip'\)\}/, 'the List table tools cannot mark VIP');
  assert.equal((ed.match(/options=\{VIP_PLUS_ONE_OPTIONS\}/g) ?? []).length, 1, 'the +1 pick is not ONE dropdown');
  assert.match(read('app/dashboard/[eventId]/seating/_components/seat-list.tsx'), /\{vip \? <VipMark \/> : null\}/, 'the List does not mark VIP');
  assert.match(read('app/dashboard/[eventId]/seating/lab/page.tsx'), /vip: t\.is_vip === true/, 'the 3D room is not told which tables are VIP');
  assert.match(read('app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx'), /\{table\.vip \? <VipTableMark \/> : null\}/, 'the 3D room does not mark VIP');
});
