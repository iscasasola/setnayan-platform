/**
 * booked-is-team-budget-schedule.test.ts — 📅 SUPPLIERS › BOOKED = TEAM · BUDGET · SCHEDULE, CONNECTED.
 *
 * Owner 2026-10-29, *"so booked has budget and schedule."* · 2026-10-30, live on the iPhone app: *"Booked does not
 * collapse and i still do not see schedule and budget properly connected to each other here."* · *"i was hoping this
 * would be a single row"* (the verbs). The approved final Suppliers design is the contract
 * (`carry-2026-10-29/suppliers-final-proto/`, its `renderTeam` / `teamFold` / `renderBudget` / `renderSchedule`).
 *
 * What is held here, each as a PROPERTY, executed where it can be:
 *   1. Booked's parts are ONE dropdown — Team · Budget · Schedule — and Budget/Schedule are the SHIPPED pages,
 *      rendered whole under Booked (never a second editor); the old /schedule address forwards there.
 *   2. A Team row's CALL TIME is the Schedule's moment — the ONE rule (`earliestTaggedBlock`) the call-time emails
 *      use too — and a refused Schedule read is said, never drawn as "no call time".
 *   3. A Team row's PAYMENT PLAN is the Pay sheet's own rows (`readBookedPlans`), the next instalment marked; a
 *      refused read is said, never drawn as "nothing to pay".
 *   4. ONE row open at a time, and the opened row's verbs are ONE row of equal tiles.
 *   5. Booked › Budget's supplier row opens the SAME Pay sheet the Team row's Pay opens.
 *   6. Only the hosts and the coordinator show a moment to guests (owner 2026-10-29).
 *
 * Sabotage (2026-10-30, each reverted, each red — 1 failing test apiece): `earliestTaggedBlock` keeping the LATEST
 * moment · `callTimeFor` mapping a refused read (null) to `none` · `.bk-tiles` back to `display:flex;flex-wrap:wrap` ·
 * `toggleBlockVisibility` without its host check.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { earliestTaggedBlock } from './coordinator-broadcasts';
import { bookedClock, callTimeFor, planFor } from './booked-rows';
import { bookedParts } from './pillar-parts';
import type { RosMetaMap } from './schedule-ros';
import type { SupplierRow } from './budget-page-view';

const APP = join(process.cwd(), 'app', 'dashboard', '[eventId]');
const read = (...p: string[]) => stripComments(readFileSync(join(APP, ...p), 'utf8'));

test('1 · Booked is Team · Budget · Schedule — ONE dropdown, each part its own address', () => {
  const parts = bookedParts({ eventId: 'E', budgetEnabled: true });
  assert.deepEqual(
    parts.map((p) => [p.key, p.label, p.href]),
    [
      ['team', 'Team', '/dashboard/E/vendors?tab=budget'],
      ['budget', 'Budget', '/dashboard/E/vendors?part=budget'],
      ['schedule', 'Schedule', '/dashboard/E/vendors?part=schedule'],
    ],
  );
  // Budget keeps its condition — the event type's budget surface.
  assert.deepEqual(bookedParts({ eventId: 'E', budgetEnabled: false }).map((p) => p.key), ['team', 'schedule']);

  const row = read('vendors', '_components', 'booked-part-row.tsx');
  assert.match(row, /<PickMenu\b/, 'Booked’s parts are not ONE dropdown');
  assert.doesNotMatch(row, /<ISegmented\b|<nav\b/, 'Booked’s parts became a pill row');

  // The parts are the SHIPPED pages, whole, inside the Suppliers shell.
  const page = read('vendors', 'page.tsx');
  assert.match(page, /if \(sp\.part === BOOKED_SCHEDULE_PART\)[\s\S]*?<BookedPartPage[\s\S]*?<CoupleSchedulePage[\s\S]*?booked: '1'/);
  assert.match(page, /import CoupleSchedulePage from '\.\.\/schedule\/page'/, 'Booked › Schedule is not the shipped Schedule page');
  // Each hosted page draws Booked's row where its masthead was — it holds the numbers.
  assert.match(read('budget', 'page.tsx'), /inBooked \? \([\s\S]*?<BookedPartRow[\s\S]*?current="budget"/);
  assert.match(read('schedule', 'page.tsx'), /inBooked \? \([\s\S]*?<BookedPartRow[\s\S]*?current="schedule"/);
  assert.match(read('vendors', '_components', 'booked-body.tsx'), /<BookedPartRow parts=\{parts\} current="team"/);

  // The old address forwards, with its own query, for anyone who can open Suppliers.
  const sched = read('schedule', 'page.tsx');
  assert.match(
    sched,
    /if \(!inMaker && !inBooked\) \{[\s\S]*?marketplaceEnabled === true && !isDelegateWithoutArea\(viewer, 'vendors'\)[\s\S]*?redirect\(`\/dashboard\/\$\{eventId\}\/vendors\?\$\{q\.toString\(\)\}`\)/,
    '/schedule no longer forwards to Suppliers › Booked › Schedule',
  );
});

test('2 · the call time is the Schedule’s earliest tagged moment — one rule, honest when unread', () => {
  const blocks = [
    { block_id: 'cer', label: 'Ceremony', start_at: '2026-12-18T14:00:00.000Z' },
    { block_id: 'ingress', label: 'Ingress & setup', start_at: '2026-12-18T08:00:00.000Z' },
    { block_id: 'rec', label: 'Reception', start_at: '2026-12-18T17:30:00.000Z' },
  ];
  const meta: RosMetaMap = new Map([
    ['cer', { responsible_party: null, responsible_vendor_ids: ['v-a'] }],
    ['ingress', { responsible_party: null, responsible_vendor_ids: ['v-a', 'v-b'] }],
    ['rec', { responsible_party: null, responsible_vendor_ids: ['v-c'] }],
  ]);
  assert.equal(earliestTaggedBlock(blocks, meta, 'v-a')?.label, 'Ingress & setup', 'not the EARLIEST tagged moment');
  assert.equal(earliestTaggedBlock(blocks, meta, 'v-c')?.label, 'Reception');
  assert.equal(earliestTaggedBlock(blocks, meta, 'v-z'), null, 'a supplier on no moment was given a call time');

  // The wall clock as written (a UTC column holding the venue's clock) — never converted.
  assert.equal(bookedClock('2026-12-18T08:00:00.000Z'), '8:00 AM');
  const times = new Map([['v-a', { startAt: '2026-12-18T08:00:00.000Z', label: 'Ingress & setup' }]]);
  assert.deepEqual(callTimeFor(times, 'v-a'), { kind: 'set', clock: '8:00 AM', moment: 'Ingress & setup' });
  assert.deepEqual(callTimeFor(times, 'v-b'), { kind: 'none' });
  assert.deepEqual(callTimeFor(null, 'v-a'), { kind: 'unread' }, 'a refused Schedule read became "no call time"');
  assert.equal(callTimeFor(undefined, 'v-a'), null);

  // Both readers ask the one rule; nobody keeps a copy.
  assert.match(readFileSync(join(process.cwd(), 'lib', 'coordinator-broadcasts.ts'), 'utf8'), /const earliest = earliestTaggedBlock\(blocks, meta, vendor\.vendor_id\);/);
  assert.match(readFileSync(join(process.cwd(), 'lib', 'booked-call-times.server.ts'), 'utf8'), /earliestTaggedBlock\(blocks, meta, vendorId\)/);
  assert.match(read('vendors', '_components', 'booked-slot.tsx'), /readBookedCallTimes\(supabase, eventId, bookedIds\)/);
});

test('3 · the plan rows are the Pay sheet’s own rows; a refused read is said', () => {
  const now = new Date('2026-11-01T04:00:00Z');
  const plan = {
    steps: [
      { seq: 1, label: 'First payment', amount_php: 90_000, due_date: '2026-10-20', amount_kind: 'fixed' as const, percent_bps: null, state: 'paid' as const },
      { seq: 2, label: 'Second', amount_php: 45_000, due_date: '2026-10-25', amount_kind: 'fixed' as const, percent_bps: null, state: 'due' as const },
      { seq: 3, label: 'Balance', amount_php: 45_000, due_date: '2026-12-11', amount_kind: 'fixed' as const, percent_bps: null, state: 'due' as const },
    ],
    clearedAt: null,
    isDefaultSeeded: false,
  };
  const p = planFor(plan, true, null, true, true, now);
  assert.ok(p && p.kind === 'plan');
  assert.deepEqual(
    p.rows.map((r) => [r.label, r.state, r.next, r.late]),
    [
      ['First payment', 'paid', false, false],
      ['Second', 'due', true, true],
      ['Balance', 'due', false, false],
    ],
    'the plan rows lost their order, the next mark, or the late flag',
  );
  // No plan: the ledger's paid figure and dated dues, the first one next.
  const money: SupplierRow = {
    vendorId: 'v', name: 'V', initials: 'V', service: 'x', agreedPhp: 100, paidPhp: 40, owedPhp: 60,
    dues: [{ label: 'Balance', dueDate: '2026-12-01', amountPhp: 60 }], status: 'owing',
  };
  const l = planFor(null, true, money, true, true, now);
  assert.ok(l && l.kind === 'ledger');
  assert.deepEqual(l.rows.map((r) => [r.state, r.amountPhp, r.next]), [['paid', 40, false], ['due', 60, true]]);
  // Neither answered → said. Never "nothing to pay".
  assert.deepEqual(planFor(null, false, null, false, true, now), { kind: 'unread' });
  assert.equal(planFor(null, true, null, true, false, now), null, 'a supplier with no price drew a plan');
});

test('4 · ONE row open at a time; the opened row’s verbs are ONE row of equal tiles', () => {
  const row = read('vendors', '_components', 'booked-row.tsx');
  assert.match(row, /const \[openId, setOpenId\] = useState<string \| null>\(firstOpen\)/, 'the Team list no longer holds ONE open id');
  assert.match(row, /open=\{openId === r\.vendorId\}/);
  assert.match(row, /const toggle = \(id: string\) => setOpenId\(\(cur\) => \(cur === id \? null : id\)\);/);
  assert.match(row, /onToggle=\{\(\) => toggle\(r\.vendorId\)\}/);
  assert.match(row, /className="bk-exp" inert=\{!open\}/, 'the fold is no longer inert while closed');
  // On a phone the fold opens under its row; from 1024 the list's right column holds it — the SAME component.
  assert.match(row, /<div className="bk-exp" inert=\{!open\}>\s*<div>\s*<BookedFold eventId=\{eventId\} row=\{row\} \/>/);
  assert.match(row, /<BookedFold eventId=\{eventId\} row=\{openRow\} \/>/, 'the wide right column draws its own fold');
  // The fold carries the call time, the plan, the feeds and the tiles — in that order.
  const fold = row.slice(row.indexOf('function BookedFold('));
  const order = ['<CallTimeLine', '<PlanRows', 'data-booked-feeds', '<VerbRow'].map((t) => fold.indexOf(t));
  assert.ok(order.every((i, k) => i > -1 && (k === 0 || i > order[k - 1]!)), `the fold's order is not call time · plan · feeds · tiles (${order})`);
  assert.match(fold.slice(fold.indexOf('<VerbRow')), /^<VerbRow[\s\S]*?\btiles\b/, 'the opened row’s verbs are not tiles');

  const body = read('vendors', '_components', 'booked-body.tsx');
  const rule = body.match(/\.bk-tiles\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(rule, 'the tile row rule is gone');
  assert.match(rule, /grid-auto-flow:column/, 'the tiles wrap — they must be ONE row');
  assert.match(rule, /grid-auto-columns:minmax\(0,1fr\)/, 'the tiles are not equal');
  assert.doesNotMatch(rule, /flex-wrap/);
  // The short words, the full names.
  const rows = readFileSync(join(process.cwd(), 'lib', 'booked-rows.ts'), 'utf8');
  assert.match(rows, /cancel: \{ label: 'Cancel booking', tone: 'danger', tile: 'Cancel' \}/);
  assert.match(rows, /dispute: \{ label: 'Report a problem', tone: 'warn', tile: 'Report' \}/);
  assert.match(row, /label: tiles && v\.tile \? v\.tile : v\.label,\s*name: v\.label,/, 'a tile lost its full accessible name');
});

test('5 · Booked › Budget’s supplier row opens the SAME Pay sheet the Team row opens', () => {
  const budget = read('budget', 'page.tsx');
  assert.match(budget, /supplierOpens=\{inBooked \? 'plan' : 'ledger'\}/);
  const screen = read('budget', '_components', 'budget-screen.tsx');
  assert.match(screen, /import\('\.\.\/\.\.\/vendors\/_components\/pay-sheet'\)\.then\(\(m\) => m\.PaySheet\)/, 'not the Booked Pay sheet');
  assert.match(screen, /const paying = planDoor && sheet\?\.kind === 'pay' \? sheet\.vendorId : null;/);
  assert.match(screen, /sheet=\{paying \? null : sheet\}/, 'both sheets can open at once');
});

test('6 · only the hosts and the coordinator show a moment to guests', () => {
  const actions = read('schedule', 'actions.ts');
  assert.match(actions, /return await userHostsEvent\(supabase, userId, eventId\);/, 'the host check is not the one definition');
  assert.match(actions, /if \(desired && !\(await mayShowToGuests\(supabase, user\.id, eventId\)\)\) throw new Error\(ONLY_HOSTS_SHOW_GUESTS\);/);
  assert.match(actions, /is_public: formData\.get\('is_public'\) === 'on' && \(await mayShowToGuests\(supabase, user\.id, eventId\)\),/);
  assert.match(actions, /if \(patch\.is_public === true && !\(await mayShowToGuests\(supabase, user\.id, eventId\)\)\)/);
  const picks = read('schedule', 'activity-picks-actions.ts');
  assert.match(picks, /is_public: showToGuests,/, 'placed activity picks are shown to guests by anyone');
});
