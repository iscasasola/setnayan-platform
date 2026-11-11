/**
 * setup-step-7-is-how-many-a-day.test.ts — 7️⃣ TODAY'S STEP 7 IS THE CLIENTS ⚙ "HOW MANY A DAY", NEVER A SECOND FIELD.
 *
 * Owner 10 Nov 2026 (corpus `plans/supplier_build_6_2026-11-10/00-BUILD-6-PLAN.md` § Lane E; prototype
 * `prototypes/supplier_clients_2026-11-07/supplier-menu-r2.v119.html` `todayNew`, row `data-step="7"`): "Today setup
 * step 7: 'How many events can you take on one day?' (venues: 'How many halls?'), a stepper starting at 1; the new
 * 'Schedule not set' copy with [Set it]." Build 5 Lane A ruled the Clients ⚙ stepper the same way: "Count your crews.
 * 2 crews = 2."
 *
 * Held as properties:
 *   1 · the words: the title per kind of shop, the line, the stepper from 1 (a stored 0 is never drawn as 0);
 *   2 · honest: a refused schedules read SAYS it — no stepper standing on a guessed 1, never "not set"; the honest
 *       reader (`fetchVendorPoolsOrNull`) is null on a refused pools or category read, and `fetchVendorPools` keeps [];
 *   3 · no schedule → the Clients sentence + [Set it] to the ⚙'s How many a day; a venue of halls → its halls, counted;
 *   4 · the SAME field: the shipped `FormCounter` in a `StayForm` on the `supCalendar.updatePoolCapacity` door, posting
 *       `pool_id` + `capacity` from 1, saving itself; the action revalidates Today;
 *   5 · step 7 rides under the six and is never counted ("N of 6 done" unchanged); the page reads the schedules only
 *       while the shop is setting up.
 *
 * Sabotage (2026-11-11, each run and reverted): the venue title dropped · `Math.max(1, …)` removed · the unread branch
 * returning `not_set` · `poolsError` ignored · the door renamed · `min={1}` → `min={0}` — each RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

test('1 · the words — the title per kind of shop, the line, the stepper from 1', async () => {
  const { setupDailyView, DAILY_TITLE, DAILY_TITLE_VENUE } = await import('@/lib/supplier-setup');
  const one = setupDailyView({ schedules: [{ poolId: 'p1', name: 'Photo Video', capacity: 1 }], venue: false });
  assert.equal(one.state, 'set');
  assert.equal(one.title, 'How many events can you take on one day?');
  assert.equal(DAILY_TITLE, one.title);
  assert.equal(one.line, 'Count your crews. 2 crews = 2.');
  assert.deepEqual(one.rows, [{ poolId: 'p1', name: 'Photo Video', capacity: 1 }]);

  const venue = setupDailyView({ schedules: [{ poolId: 'p1', name: 'Reception venue', capacity: 3 }], venue: true });
  assert.equal(venue.title, 'How many halls?');
  assert.equal(DAILY_TITLE_VENUE, venue.title);
  assert.equal(venue.rows[0]!.capacity, 3);

  const zero = setupDailyView({ schedules: [{ poolId: 'p1', name: 'X', capacity: 0 }], venue: false });
  assert.equal(zero.rows[0]!.capacity, 1, 'a stepper starts at 1 — a stored 0 is never drawn as a number');
});

test('2 · honest — a refused read says so; the honest reader is null on a refused pools or category read', async () => {
  const { setupDailyView, DAILY_UNREAD } = await import('@/lib/supplier-setup');
  const v = setupDailyView({ schedules: null, venue: false });
  assert.equal(v.state, 'unread');
  assert.equal(v.line, DAILY_UNREAD);
  assert.equal(DAILY_UNREAD, 'Couldn’t load your schedule');
  assert.deepEqual(v.rows, [], 'no stepper on a guessed number');

  const { fetchVendorPools, fetchVendorPoolsOrNull } = await import('@/lib/vendor-schedule');
  const fake = (refuse: string | null) => {
    const result = (table: string) =>
      table === refuse
        ? { data: null, error: { message: 'permission denied' } }
        : table === 'vendor_schedule_pools'
          ? { data: [{ pool_id: 'p1', pool_label: 'catering', calendar_name: null, is_vendor_created: false, daily_booking_capacity: 2, is_hall: false }], error: null }
          : table === 'vendor_schedule_pool_categories'
            ? { data: [{ category_key: 'catering', pool_id: 'p1' }], error: null }
            : { data: [], error: null };
    const chain = (table: string): unknown => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order']) q[m] = () => q;
      q.then = (ok: (r: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result(table)).then(ok, bad);
      return q;
    };
    return { from: chain, rpc: async () => ({ data: null, error: null }) } as never;
  };
  const read = await fetchVendorPoolsOrNull(fake(null), 'v1');
  assert.equal(read?.length, 1);
  assert.equal(read?.[0]!.capacity, 2);
  assert.equal(await fetchVendorPoolsOrNull(fake('vendor_schedule_pools'), 'v1'), null, 'a refused pools read is not "no schedule"');
  assert.equal(await fetchVendorPoolsOrNull(fake('vendor_schedule_pool_categories'), 'v1'), null, 'a refused category map is not "no schedule"');
  assert.deepEqual(await fetchVendorPools(fake('vendor_schedule_pools'), 'v1'), [], 'the old reader keeps its [] for the screens that handle it');
});

test('3 · no schedule → the Clients sentence + [Set it]; a venue of halls → its halls, counted', async () => {
  const { setupDailyView, DAILY_NOT_SET } = await import('@/lib/supplier-setup');
  const { SET_HOW_MANY_A_DAY_HREF } = await import('@/lib/vendor-dates');
  const { SetupDailyStep, YOUR_HALLS_HREF } = await import('./setup-daily-step');

  const none = setupDailyView({ schedules: [], venue: false });
  assert.equal(none.state, 'not_set');
  assert.equal(DAILY_NOT_SET, 'Set how many events you take a day so couples see if your date is open.');
  // The SAME sentence Clients › Dates and the day sheet say (#7423) — one wording, not two.
  assert.match(code('app/vendor-dashboard/customers/page.tsx'), /Set how many events you take a day so couples see if your date is open\./);
  const html = renderToStaticMarkup(React.createElement(SetupDailyStep, { view: none, ceiling: 50, action: null, lab: true }));
  assert.match(text(html), /Set how many events you take a day so couples see if your date is open\./);
  assert.match(html, new RegExp(`href="${SET_HOW_MANY_A_DAY_HREF.replace(/[?&#]/g, (c) => (c === '&' ? '&amp;' : `\\${c}`))}"`), '[Set it] opens the ⚙ at How many a day');
  assert.match(text(html), /\bSet it\b/);
  assert.doesNotMatch(html, /data-counter=/, 'no stepper without a schedule to write to');

  const halls = setupDailyView({ schedules: [{ poolId: 'h1', name: 'Grand Hall', capacity: 1, hall: true }, { poolId: 'h2', name: 'Garden', capacity: 1, hall: true }], venue: true });
  assert.equal(halls.state, 'halls');
  assert.equal(halls.title, 'How many halls?');
  assert.equal(halls.line, '2 halls · Grand Hall · Garden');
  const hh = renderToStaticMarkup(React.createElement(SetupDailyStep, { view: halls, ceiling: 50, action: null, lab: true }));
  assert.match(hh, new RegExp(`href="${YOUR_HALLS_HREF.replace(/[?&]/g, (c) => (c === '&' ? '&amp;' : `\\${c}`))}"`));

  const unread = renderToStaticMarkup(React.createElement(SetupDailyStep, { view: setupDailyView({ schedules: null, venue: false }), ceiling: 50, action: null, lab: true }));
  assert.match(text(unread), /Couldn’t load your schedule/);
  assert.doesNotMatch(unread, /data-counter=/);
  assert.doesNotMatch(text(unread), /Set it/, 'a refused read is never told to set what may already be set');
});

test('4 · the SAME field — the Clients ⚙ counter, its door and its action; Today re-renders on a save', async () => {
  const { setupDailyView } = await import('@/lib/supplier-setup');
  const { SetupDailyStep } = await import('./setup-daily-step');
  const html = renderToStaticMarkup(
    React.createElement(SetupDailyStep, { view: setupDailyView({ schedules: [{ poolId: 'p1', name: 'Photo Video', capacity: 1 }], venue: false }), ceiling: 50, action: null, lab: true }),
  );
  assert.match(html, /data-counter="setup-daily"/);
  assert.match(html, /data-counter-value="1"/, 'the stepper starts at 1');
  assert.match(html, /2\u00a0crews\u00a0=\u00a02\./, '"2 crews = 2." never breaks across two lines');
  assert.match(html, /data-counter-less=""[^>]*disabled=""/, 'it never goes below 1');

  const step = code('app/vendor-dashboard/_components/setup-daily-step.tsx');
  assert.match(step, /<StayForm door="supCalendar\.updatePoolCapacity" action=\{action\}/, 'saved in place through the shipped door');
  assert.match(step, /name="pool_id" value=\{r\.poolId\}/);
  assert.match(
    step,
    /<StayForm door="supCalendar\.updatePoolCapacity"[\s\S]*?<FormCounter\s+name="capacity"\s+value=\{r\.capacity\}\s+min=\{1\}\s+max=\{[^}]+\}\s+label=\{label\}\s+saveAfterMs=\{900\}/,
    'the Clients ⚙ counter: capacity, from 1, saves itself',
  );
  // The ⚙'s own counter posts the same field to the same action — one field, two places.
  const gear = code('app/vendor-dashboard/customers/_components/dates-folds.tsx');
  assert.match(gear, /<StayForm door="supCalendar\.updatePoolCapacity"/);
  assert.match(gear, /<FormCounter name="capacity" value=\{c\.capacity\} min=\{1\}/);

  const screen = code('app/vendor-dashboard/_components/supplier-setup-screen.tsx');
  assert.match(screen, /import \{ updatePoolCapacity \} from '\.\.\/calendar\/actions'/);
  assert.match(screen, /action=\{lab \? null : updatePoolCapacity\}/, 'the lab writes nothing');

  const actions = code('app/vendor-dashboard/calendar/actions.ts');
  const at = actions.indexOf('function revalidateScheduleSurfaces');
  const surfaces = actions.slice(at, actions.indexOf('\n}', at));
  assert.match(surfaces, /revalidatePath\('\/vendor-dashboard'\)/, 'a save re-renders Today with the saved number');
  // Today is NOT a `within` screen of the door: the no-shop bounce lands on bare /vendor-dashboard and must navigate.
  assert.doesNotMatch(code('app/_actions/stay-registry/supCalendar.ts'), /supplierScreen\(''\)/);
});

test('5 · under the six, never counted; read only while setting up', async () => {
  const folds = code('app/vendor-dashboard/_components/supplier-setup-folds.tsx');
  const list = folds.slice(folds.indexOf('data-setup-folds=""'));
  assert.ok(list.indexOf('view.folds.map') < list.indexOf('{daily ?'), 'step 7 is drawn after the six');
  const { DAILY_STEP_N } = await import('@/lib/supplier-setup');
  assert.equal(DAILY_STEP_N, 7);
  const lib = code('lib/supplier-setup.ts');
  assert.doesNotMatch(lib.slice(lib.indexOf('export type SetupFoldKey'), lib.indexOf('export type SetupFold =')), /daily/, 'not one of the counted folds');

  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /const setupPoolsP = settingUpP\.then\(\(yes\) => \(yes \? fetchVendorPoolsOrNull\(supabase, vendorProfileId\) : null\)\)/, 'a live shop reads none of it');
  assert.match(page, /daily=\{\{/);
  assert.match(page, /VENUE_CATEGORIES\.has/, 'a venue is asked "How many halls?"');
});
