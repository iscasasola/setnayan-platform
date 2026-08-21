import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMenuLifecyclePhase, getDayOfPhase } from './day-of-mode';
import { getLifecyclePhase } from './invitation-widgets';
import { isFinishedEvent } from './event-board';
import { BOOKED_VENDOR_STATUSES } from './vendors';
import { timelineStatusOf } from './vendors-plan-budget';
import { roadmapLedeStage } from './wedding-roadmap';

/**
 * a-finished-event-reads-as-finished.test.ts
 *
 * Owner, 2026-08-21, opening a Movie Night (2026-08-20, Asia/Manila) at 08:33
 * the morning after — and again after a first fix shipped: *"nothing changed.
 * i can still invite. prepare for event day, etc"*.
 *
 * 🛡 EVERY ASSERTION BELOW WAS MUTATION-CHECKED BY OCCURRENCE COUNT — the
 * sabotage applied, the count printed before → after, the test observed RED.
 */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => readFileSync(join(WEB, p), 'utf8');

const MNL = 'Asia/Manila';
const DAY = '2026-08-20';
const at = (iso: string) => new Date(iso).getTime();
const phaseAt = (iso: string, end?: string | null) =>
  getMenuLifecyclePhase(DAY, null, MNL, at(iso), end ?? null);

/*
  1 · THE MORNING AFTER IS "AFTER".

  The boundary used to be T+60h — two and a half days — so the owner's event
  was still "day-of" when he opened it, and every after-phase surface stayed
  dark. It is now 06:00 on the day after the last day.
*/
test('the morning after the event, the app says it is over', () => {
  assert.equal(phaseAt('2026-08-21T08:33:00+08:00'), 'after', "the owner's actual visit");
  assert.equal(phaseAt('2026-08-21T06:00:00+08:00'), 'after', 'the boundary itself');
});

/*
  2 · A PARTY RUNNING PAST MIDNIGHT KEEPS ITS DAY-OF DESK.

  This is the ONLY reason the boundary is 06:00 and not midnight. A Filipino
  reception routinely runs past twelve, and a couple whose after-party is still
  going must not lose the live desk because the calendar rolled over.
*/
test('a celebration still running at 2am has not been declared over', () => {
  assert.equal(phaseAt('2026-08-20T22:00:00+08:00'), 'dayof', 'the reception');
  assert.equal(phaseAt('2026-08-21T02:00:00+08:00'), 'dayof', 'the after-party');
  assert.equal(phaseAt('2026-08-21T05:59:00+08:00'), 'dayof', 'the last minute of the night');
});

/*
  3 · BEFORE THE DAY IS UNCHANGED.

  The whole change must be invisible to every event that has not happened yet.
*/
test('nothing before the event moved', () => {
  assert.equal(phaseAt('2026-08-19T09:00:00+08:00'), 'plan');
  assert.equal(phaseAt('2026-08-17T09:00:00+08:00'), 'plan');
  assert.equal(phaseAt('2026-08-20T10:00:00+08:00'), 'dayof');
  // The day-of window resolver itself is untouched — only the menu phase moved.
  assert.equal(getDayOfPhase(DAY, MNL, at('2026-08-20T10:00:00+08:00')), 'live');
});

/*
  4 · THE DASHBOARD AND THE EVENTS BOARD MUST AGREE, AND THE NIGHT GAP IS
      DELIBERATE.

  🚨 THIS IS THE DEFECT AT THE HEART OF THE COMPLAINT. `isFinishedEvent` — the
  board's rule, shipped and read by three surfaces — had said "finished" since
  midnight, while the dashboard the board's own card OPENS said "EVENT DAY
  SOON". Two answers to one question, one click apart.

  They now agree at every hour a person is realistically looking. Between
  midnight and 06:00 they differ ON PURPOSE (see assertion 2), and that gap is
  pinned here so neither can be "fixed" alone.
*/
test('the dashboard and the events board agree by breakfast', () => {
  const boardSaysFinished = (todayISO: string) =>
    isFinishedEvent({ event_date: DAY, archived: false }, todayISO);
  assert.equal(boardSaysFinished('2026-08-21'), true, 'the board flips at midnight');
  assert.equal(boardSaysFinished('2026-08-20'), false, 'and not on the day itself');

  for (const hour of ['06:00', '08:33', '12:00', '23:00']) {
    assert.equal(
      phaseAt(`2026-08-21T${hour}:00+08:00`),
      'after',
      `dashboard disagrees with the board at ${hour}`,
    );
  }
  // The deliberate gap — asserted, not merely tolerated.
  assert.equal(phaseAt('2026-08-21T01:00:00+08:00'), 'dayof', 'the night gap must stay');
});

/*
  5 · A CELEBRATION THAT SPANS SEVERAL DAYS IS NOT OVER ON ITS THIRD MORNING.

  The old rule was `event_date + 60h`, which for a five-day festival lands in
  the middle of day three. It was not merely redundant — it was wrong, and it
  is deleted rather than kept beside the new rule.
*/
test('a multi-day celebration runs to its last day', () => {
  const END = '2026-08-23';
  assert.equal(phaseAt('2026-08-22T12:00:00+08:00', END), 'dayof', 'day three, mid-festival');
  assert.equal(phaseAt('2026-08-23T20:00:00+08:00', END), 'dayof', 'the last evening');
  assert.equal(phaseAt('2026-08-24T06:00:00+08:00', END), 'after', 'the morning after the last day');
  // And the middle days are day-of, never 'plan' — telling a family in the
  // middle of their own celebration to go and plan it.
  assert.notEqual(phaseAt('2026-08-22T12:00:00+08:00', END), 'plan');
});

/*
  6 · THE NEXT MIDNIGHT IS A CALENDAR DAY, NOT "+24h".

  Month ends, year ends and leap days all have to roll over. Asia/Manila has no
  DST, so a fixed-24h version would be invisible in production and wrong the
  first time somebody holds an event in a zone that does.
*/
test('the day after rolls over months, years and leap days', () => {
  const p = (d: string, iso: string) => getMenuLifecyclePhase(d, null, MNL, at(iso));
  assert.equal(p('2026-08-31', '2026-09-01T07:00:00+08:00'), 'after', 'month end');
  assert.equal(p('2026-12-31', '2027-01-01T07:00:00+08:00'), 'after', 'year end');
  assert.equal(p('2028-02-29', '2028-03-01T07:00:00+08:00'), 'after', 'leap day');
  assert.equal(p('2026-08-31', '2026-09-01T05:00:00+08:00'), 'dayof', 'and not an hour early');
});

/*
  7 · THE GUESTS' OWN PAGE MOVES ON AT THE SAME MOMENT.

  The public page ran the live day-of surface until T+36h, so on the morning
  after a wedding the couple's dashboard could call it finished while the page
  their guests were opening still said "Happening now".

  ⚠ THE CAUSE WAS THE WINDOW, NOT THE MISSING TIMEZONE. At 08:33 Manila both
  the UTC anchor (+24.5h) and the venue anchor (+32.5h) sit inside the 36-hour
  live window, so passing the zone alone would have changed nothing here. The
  zone is fixed too, and separately — see assertion 8.
*/
test('the public page shows the story, not the live day, once it is over', () => {
  /*
    🪤 THE FIRST VERSION OF THIS ASSERTION PASSED FOR THE WRONG REASON and was
    caught by a mutation that stayed GREEN. It ran at the real wall clock, and
    by then `getDayOfPhase` had already reached 'post' — which the old switch
    ALSO maps to 'editorial'. Deleting the new boundary changed nothing it
    could see. The instant is now pinned, and it is pinned INSIDE the old live
    window (08:33 the morning after ⇒ T+32.5h &lt; 36h), which is the only place
    the two answers differ.
  */
  const morningAfter = at('2026-08-21T08:33:00+08:00');
  assert.equal(
    getDayOfPhase(DAY, MNL, morningAfter),
    'live',
    'the old window still calls this the wedding day — that is the point',
  );
  assert.equal(getLifecyclePhase(DAY, MNL, null, morningAfter), 'editorial');
  // And during the celebration itself it is emphatically NOT the recap.
  assert.equal(getLifecyclePhase(DAY, MNL, null, at('2026-08-20T22:00:00+08:00')), 'event');
});

/*
  8 · EVERY PUBLIC-PHASE CALLER HANDS OVER THE VENUE'S CLOCK.

  On `app/[slug]/page.tsx` the day-of resolver was given the venue zone and the
  lifecycle resolver, fifteen lines below it, was not — two clocks deciding one
  page. A guard, because the next call site will forget.
*/
test('no call site asks a UTC server what time it is at the venue', () => {
  const CALLERS = [
    'app/[slug]/page.tsx',
    'app/[slug]/print/page.tsx',
    'app/[slug]/_components/guest-column-card.tsx',
    'app/dashboard/[eventId]/launch/page.tsx',
    'app/dashboard/[eventId]/website/editor/page.tsx',
    'app/api/std/view/route.ts',
  ];
  for (const f of CALLERS) {
    const body = src(f);
    const i = body.indexOf('getLifecyclePhase(');
    assert.ok(i >= 0, `${f} no longer calls getLifecyclePhase — update this list`);
    const call = body.slice(i, i + 400);
    assert.match(call, /tz|timezone|venueTz|eventTz/, `${f} resolves the phase without a timezone`);
  }
});

/*
  9 · "EVENT DAY SOON" DOES NOT GREET SOMEBODY THE MORNING AFTER.

  Its own window is T-3d .. T+1d and it never asked whether the day had been
  and gone — the banner the owner photographed. It is TOLD, from the one
  resolver, rather than handed a third opinion of its own.
*/
test('the prepare-for-event-day banner is told the event has happened', () => {
  const page = src('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /<EventDayPrepCta[^/]*finished=\{afterActive\}/);
  assert.match(page, /<AutoPreloadOnEventDay[^/]*finished=\{afterActive\}/);
  const cta = src('app/_components/event-day-prep-cta.tsx');
  assert.match(cta, /if \(finished\) return null;/, 'the banner must refuse to render');
  const pre = src('app/_components/auto-preload-on-event-day.tsx');
  assert.match(pre, /if \(finished\) return;/, 'the preloader must not fire');
});

/*
  10 · THE GUEST LIST KNOWS, AND STILL LETS YOU ADD SOMEBODY.

  The page did not read the event's date at all, which is why it kept offering
  to invite people to a party that was over. It now asks the one resolver — and
  the add paths RECEDE rather than disappear, because the cousin who turned up
  unannounced still belongs on the list.
*/
test('the guest list knows the event happened, and nothing is taken away', () => {
  const g = src('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(g, /getMenuLifecyclePhase\(/, 'the Guests page must resolve the phase');
  assert.match(g, /event_date, event_end_date, cleared_at, timezone/, 'it must read the date');
  assert.match(g, /Still adding someone\?/, 'the add path must still be reachable');
  assert.match(g, /<CaptureBar/, 'the capture bar must still be mounted');
  assert.match(g, /OpenQuickAddButton/, 'the quick-add button must survive');
});

/*
  11 · THE WAY TO SAY "WE FINISHED EARLY" IS VISIBLE.

  It was the last element of the day-of block, under seven cards — below the
  fold on a phone, and the only door to it in the whole app.
*/
test('the close-out door sits above the day-of cards, and there is still only one', () => {
  const grid = src('app/dashboard/[eventId]/_components/day-of-mode/grid.tsx');
  const banner = grid.indexOf('<DayOfModeBanner');
  const door = grid.indexOf('/clearance');
  const firstCard = grid.indexOf('<WhatsHappeningCard');
  assert.ok(banner >= 0 && door >= 0 && firstCard >= 0);
  assert.ok(door > banner, 'the door belongs under the banner');
  assert.ok(door < firstCard, 'the door must come before the cards, not after them');
  assert.equal(
    grid.split('/clearance').length - 1,
    1,
    'two entrances to one switch inside one block is clutter',
  );
});

/*
  12 · THE SUMMARY COUNTS SUPPLIERS WHO WORKED THE DAY, NOT ONES WHO WERE
       SHOPPED FOR.

  The first cut counted every row on the event's vendor list, so a couple who
  shortlisted eleven caterers and hired one would have read "11 suppliers".
  The status set is pinned against `lib/vendors.ts` so the two cannot drift.
*/
test('only booked suppliers count as having worked the event', () => {
  const summary = src('lib/after-summary.ts');
  // The SHIPPED list, imported — not a fourth hand-typed copy of it.
  assert.match(summary, /BOOKED_VENDOR_STATUSES/, 'the supplier count must filter by status');
  assert.match(
    summary,
    /\.in\('status', BOOKED_VENDOR_STATUSES/,
    'and it must be the imported set, not a literal',
  );
  const booked = BOOKED_VENDOR_STATUSES as readonly string[];
  assert.ok(!booked.includes('shortlisted'), 'a shortlist is a shopping list, not a booking');
  assert.ok(booked.includes('contracted'), 'a contracted supplier worked the day');
});

/*
  13 · AND IT USES THE SHIPPED HEAD-COUNT.

  A second count without the soft-delete filter would show a couple who removed
  a guest one number on the summary and a smaller one on the guest list.
*/
test('the summary and the guest list count the same guests', () => {
  const summary = src('lib/after-summary.ts');
  assert.match(summary, /countGuestsByEvent\(supabase, eventId\)/);
  assert.ok(
    !/from\('guests'\)[\s\S]{0,200}\.eq\('event_id', eventId\),\n/.test(summary) ||
      /is\('deleted_at', null\)/.test(summary),
    'every guests count here must exclude soft-deleted rows',
  );
});


/*
  14 · RECEDING WAS NOT ENOUGH.

  PR #4651 folded the whole planning dashboard behind a disclosure in the After
  phase. One click down it still told a finished celebration it was "0%
  planned", that locking a venue was overdue, and headed its digest "Needs you
  this week". A wrong statement one click down is still a wrong statement — so
  the component is TOLD the phase and gates each of those on it.
*/
test('the planning dashboard stops stating things that are no longer true', () => {
  const dash = src('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  assert.match(dash, /lifecyclePhase\?: MenuLifecyclePhase;/, 'it must be told the phase');
  assert.match(dash, /const eventHasHappened = lifecyclePhase === 'after';/);
  // The specific statements, each one asserted at its own site.
  assert.match(dash, /marketplaceEnabled && !eventHasHappened/, "today's one thing");
  assert.match(dash, /!eventHasHappened \|\| g\.id === 'pay'/, 'the book/pick/role groups');
  assert.match(dash, /\{eventHasHappened \? null : \(\s*<>/, 'the % planned bar');
  assert.match(dash, /eventHasHappened \? 'Still open' : 'Needs you this week'/);
  assert.match(dash, /!eventHasHappened && stats\.pending > 0/, 'the RSVP nag');
  // And the page hands it down at EVERY mount, not just the one in view.
  const page = src('app/dashboard/[eventId]/page.tsx');
  assert.equal(
    page.split('lifecyclePhase={lifecyclePhase}').length - 1,
    3,
    'all three EventDashboard mounts must be told',
  );
});

/*
  15 · THE MARKETPLACE CLOCK STOPS.

  Every booking deadline is computed backwards from the event date, so once it
  is past, EVERY category reads overdue and the red "⚠ Nd overdue" chip grows by
  one a day forever. `'upcoming'` is this ladder's own quiet rung — the same one
  a dateless event gets — so it renders no chip at all.
*/
test('a past event has no overdue supplier categories', () => {
  assert.equal(timelineStatusOf('reception_venue', -1, 'empty'), 'upcoming', 'the day after');
  assert.equal(timelineStatusOf('reception_venue', -366, 'empty'), 'upcoming', 'and a year later');
  // The rungs that must NOT be swallowed by the new branch.
  assert.equal(timelineStatusOf('reception_venue', 5, 'empty'), 'overdue', 'still overdue before the day');
  assert.equal(timelineStatusOf('reception_venue', -1, 'finalized'), 'locked', 'a booking stays booked');
  assert.equal(timelineStatusOf('reception_venue', -1, 'awaiting'), 'awaiting', 'an ask stays an ask');
});

/*
  16 · "YOUR LAST STRETCH" IS NOT WHAT YOU SAY THE MORNING AFTER.

  Two ladders read months-to-date and neither had a negative branch, so a
  celebration that happened last night fell through the bottom of both. The
  RUNG is shared; the words stay each hub's own.
*/
test('the Suite and the Studio know the event is behind them', () => {
  assert.equal(roadmapLedeStage(-0.03), 'past', 'last night');
  assert.equal(roadmapLedeStage(null), 'undated');
  assert.equal(roadmapLedeStage(0.5), 'last_stretch', 'and the rung below is untouched');
  assert.equal(roadmapLedeStage(7), 'far');
  for (const f of ['app/dashboard/[eventId]/suite/page.tsx', 'app/dashboard/[eventId]/studio/page.tsx']) {
    const body = src(f);
    assert.match(body, /roadmapLedeStage\(monthsToDate\)/, `${f} must read the shared rung`);
    assert.match(body, /past: /, `${f} must have something to say about a past event`);
    assert.ok(
      !/monthsToDate > 6\s*$/m.test(body),
      `${f} must not keep a second copy of the ladder`,
    );
  }
});

/*
  17 · THE COUNTDOWN ANCHORS ON THE VENUE'S MIDNIGHT.

  It used `new Date(`${d}T00:00:00`)` against `today.setHours(0,0,0,0)` — both
  the runtime's own clock, UTC on Vercel — so between midnight and 08:00 Manila
  the day after a wedding it still returned 0 and the hero read "It's your event
  day" while the rest of the page had moved on.
*/
test('the dashboard countdown reads the venue clock', () => {
  const dash = src('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  const fn = dash.slice(dash.indexOf('function daysUntil('), dash.indexOf('function daysUntil(') + 700);
  assert.match(fn, /eventDateToEpoch\(eventDate, tz\)/, 'the event side');
  assert.match(fn, /eventDateToEpoch\(todayIso, tz\)/, 'and the today side, in the SAME zone');
  assert.ok(!/setHours\(0, 0, 0, 0\)/.test(fn), 'the runtime-local midnight must be gone');
  assert.match(dash, /event_date_precision, timezone/, 'and the zone must actually be selected');
});
