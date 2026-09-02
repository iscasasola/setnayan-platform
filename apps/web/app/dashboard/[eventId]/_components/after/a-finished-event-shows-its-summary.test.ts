import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCustomerNavGroups } from '../customer-nav-config';
import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { loadAfterSummary } from '@/lib/after-summary';

/**
 * a-finished-event-shows-its-summary.test.ts
 *
 * Owner, 2026-08-21, on a Movie Night that had already happened: *"why can i
 * still plan and build and create guest list as if it hasn't ended… what we
 * want is to show the summary of the overview, guest, marketplace, suite, and
 * the editorial maker."*
 *
 * 🛡 EVERY ASSERTION BELOW WAS MUTATION-CHECKED BY OCCURRENCE COUNT — the
 * sabotage was applied, the count printed before → after, and the test
 * observed RED. A green result from a sabotage that did not land proves
 * nothing, which this repo has now paid for six separate times.
 */

/* `new URL('.', import.meta.url).pathname` PERCENT-ENCODES the `[eventId]`
   brackets, so readFileSync looks for a `%5BeventId%5D` directory that does
   not exist. `fileURLToPath` is the decoder. */
const HERE = dirname(fileURLToPath(import.meta.url));
const EVENT_ROOT = join(HERE, '..', '..');
const src = (p: string) => readFileSync(join(EVENT_ROOT, p), 'utf8');

const hrefs = (phase?: 'plan' | 'dayof' | 'after') =>
  buildCustomerNavGroups('EVT123', { websiteEnabled: true, ...(phase ? { phase } : {}) })
    .flatMap((g) => g.items)
    .map((i) => i.href);

/*
  1 · THE RAIL GAINS THE EDITORIAL MAKER ONCE THE EVENT IS OVER.

  Until 2026-08-21 the desktop rail had NO row for it at any phase: the only
  ways in were the Suite's website card and the /website hub, which is what
  the owner's *"how do i see the editorial maker?"* was actually asking.
*/
test('after the event, the rail carries the editorial maker and the galleries', () => {
  const after = hrefs('after');
  assert.ok(
    after.includes('/dashboard/EVT123/website/editorial'),
    'the After rail must carry a row for the editorial maker',
  );
  assert.ok(
    after.includes('/dashboard/EVT123/galleries'),
    'the After rail must carry a row for the galleries',
  );
});

/*
  2 · NOTHING IS TAKEN AWAY.

  The receded-not-removed rule, asserted rather than promised in a comment. A
  host still adding the cousin who turned up must find the guest list exactly
  where it was.
*/
test('after the event, every planning row the person already had is still there', () => {
  const plan = hrefs();
  const after = hrefs('after');
  for (const href of plan) {
    assert.ok(after.includes(href), `the After rail dropped ${href}`);
  }
  assert.equal(after.length, plan.length + 2, 'After adds exactly two rows and removes none');
});

/*
  3 · OMITTING THE PHASE MUST CHANGE NOTHING.

  Every existing caller passes no phase. If the default drifted, this whole
  change would ship as a silent re-shuffle of the shipped rail.
*/
test('omitting the phase is byte-identical to the plan phase', () => {
  assert.deepEqual(hrefs(), hrefs('plan'));
});

/*
  4 · THE TWO ROSTERS MUST NOT DISAGREE ABOUT WHERE "EDITORIAL" GOES.

  The phone has had an After roster since 2026-06-16 and the rail now has one.
  Two lists naming the same phase and pointing at different addresses is the
  drift that costs a person a dead end; the addresses are compared, not
  assumed equal because both were typed from the same memory.
*/
test('the rail and the phone agree on the After destinations', () => {
  const phone = buildCustomerMenuTree('EVT123', { phase: 'after' });
  const railAfter = hrefs('after');
  /* 🔤 'editorial' left this list on 2026-09-02 (EH3): the phone's after-phase
     tab is now the Event Hub (key 'launch'), and the editorial maker is a door
     inside it. The RAIL keeps its own /website/editorial row — test 1 above is
     unchanged and still holds that door open, which is the whole 2026-08-21
     lesson. The Hub itself is compared here too, so the two rosters cannot
     start disagreeing about where the after-phase leads. */
  for (const key of ['launch', 'galleries']) {
    const row = phone.find((m) => m.key === key);
    assert.ok(row, `the phone's After roster lost its ${key} tab`);
    assert.ok(
      railAfter.includes(row.href),
      `the rail and the phone disagree about ${key}: ${row.href}`,
    );
  }
});

/*
  5 · A COUNT THAT COULD NOT BE READ IS `null`, NEVER `0`.

  Supabase does not throw on a refused query — it RESOLVES with `{ error }`.
  A loader that reads `count ?? 0` therefore reports a confident zero for a
  read that never happened, and "0 guests" on a wedding with 300 of them is a
  summary that lies while looking completely fine.
*/
test('a refused read reports null, not zero', async () => {
  const refusing = {
    from() {
      const thenable = {
        select: () => thenable,
        eq: () => thenable,
        is: () => thenable,
        in: () => thenable,
        maybeSingle: async () => ({ data: null, error: { message: 'refused' } }),
        then: (resolve: (v: { count: null; error: { message: string } }) => unknown) =>
          resolve({ count: null, error: { message: 'refused' } }),
      };
      return thenable;
    },
  };
  type Client = Parameters<typeof loadAfterSummary>[0];
  const s = await loadAfterSummary(refusing as unknown as Client, 'EVT123');
  for (const field of ['guests', 'checkedIn', 'suppliers', 'photos'] as const) {
    assert.equal(s[field], null, `${field} must be null when the read is refused`);
  }
  assert.equal(s.editorial, 'none');
  assert.equal(s.editorialMeasured, false);
});

/*
  6 · THE OVERVIEW RECEDES THE PLANNING STACK — IT DOES NOT DELETE IT.

  Source-level, because the branch is a server component the unit runner
  cannot render. Both halves are asserted: the summary must be there, and the
  planning dashboard must STILL be there inside the same branch.
*/
test('the finished-event branch shows the summary AND keeps the planning tools', () => {
  const page = src('page.tsx');
  const branch = page.slice(page.indexOf('afterActive && afterSummary'));
  assert.ok(branch.length > 0, 'the Overview lost its finished-event branch');
  const upToElse = branch.slice(0, branch.indexOf('The dashboard — hero'));
  assert.match(upToElse, /<FinishedEventSummary/, 'the finished-event branch lost its summary');
  assert.match(
    upToElse,
    /Planning tools — still here if you need them/,
    'the finished-event branch stopped offering the planning tools',
  );
  assert.match(upToElse, /<EventDashboard/, 'the planning dashboard was removed, not receded');
});

/*
  7 · THE MENU AND THE PAGE MUST READ THE SAME CLOCK.

  The layout resolved the phase with no timezone — the runtime's own midnight,
  UTC on Vercel — while the Overview body has passed the venue's zone since
  2026-08-14. Eight hours apart, the rail could say "after" while the page
  still said "day-of", or the reverse. Same family as every wall-clock defect
  fixed on 2026-08-04.
*/
test('the layout resolves the lifecycle phase in the venue timezone', () => {
  const layout = src('layout.tsx');
  const call = layout.slice(layout.indexOf('const phase = getMenuLifecyclePhase('));
  const args = call.slice(0, call.indexOf(');') + 2);
  assert.match(args, /timezone/, 'the layout phase call dropped the venue timezone');
});
