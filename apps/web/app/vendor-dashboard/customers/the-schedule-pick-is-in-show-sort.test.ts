/**
 * the-schedule-pick-is-in-show-sort.test.ts — the Clients month's "All schedules ▾" moved into Show & sort.
 *
 * Record: controller 2026-11-12 under the owner's "Into Show & sort" — DECISION_LOG "📅 CLIENTS SCHEDULE PICKER → SHOW &
 * SORT (build)"; prototype `Build_Schedules_2026-11-12/schedules-hand-in-hand.html` part (a) (legend rows "Schedule ▾
 * row inside Show & sort" · "Chip under the month"). Part (b) is NOT built (owner questions open).
 *
 *   1 · NO PICKER ABOVE THE MONTH — nothing between the month's top and its grid picks a schedule.
 *   2 · SHOW & SORT HOLDS THE SCHEDULE ROW — under "Who you see", the month's own choices, on-screen (no address).
 *   3 · THE CHIP OPENS THE SAME CHOICES — one 44px pill under the legend, "Showing · <schedule>" when narrowed; the sheet
 *       and the chip read ONE list (`scheduleScopeOptions`) and speak on window events, like Show.
 *       ⚠ The ONE Clients screen draws NO chip (owner 2026-11-12: "all schedules under the calendar should be inside the
 *       show and sort and remove it from the page under the calendar") — there Show & sort's row is the only pick.
 *   4 · THE SCHEDULE PAGE'S MONTH (`place="schedule"`) keeps working: same chip, its own pick, never the Clients events.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  ALL_SCHEDULES,
  CLIENTS_SCHEDULE_EVENT,
  CLIENTS_SCHEDULING_EVENT,
  CLIENTS_SHOW_EVENT,
  scheduleScopeOptions,
  schedulesOffered,
} from './clients-show-sort';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (...rel: string[]) => stripComments(readFileSync(join(HERE, ...rel), 'utf8'));
const MONTH = code('_components', 'customers-calendar.tsx');
const SHEET = code('_components', 'clients-show-sort.tsx');
const PAGE = code('page.tsx');
const SCHEDULE_PAGE = code('..', 'clients', '[eventId]', '_components', 'schedule-calendar.tsx');

/** The month's JSX from its root `<div ref={rootRef}` down to the grid — what is drawn ABOVE the month. */
const aboveTheMonth = (() => {
  const from = MONTH.indexOf('<div ref={rootRef}');
  const to = MONTH.indexOf('<CalendarGrid', from);
  assert.ok(from > 0 && to > from, 'the month’s root or grid could not be found');
  return MONTH.slice(from, to);
})();

test('1 · no schedule picker above the month', () => {
  assert.doesNotMatch(aboveTheMonth, /<PickMenu\b/, 'a dropdown is drawn above the month again');
  assert.doesNotMatch(MONTH, /data-dates-scope|data-dates-eyebrow/, 'the old "All schedules ▾" above the month is back');
  assert.doesNotMatch(MONTH, /label="Schedules"/, 'the old Schedules picker is back');
});

test('2 · Show & sort holds the Schedule row — the month’s choices, on-screen', () => {
  const row = SHEET.match(/<ChosenRow\s+data="clients-schedule"[\s\S]*?\/>/)?.[0] ?? '';
  assert.ok(row, 'Show & sort has no Schedule row');
  assert.match(row, /name="Schedule"/);
  assert.match(row, /options=\{schedules\}/, 'the Schedule row draws its own choices, not the month’s');
  assert.match(row, /onPick=\{pickSchedule\}/);
  // It sits under "Who you see", right after Show (prototype order: Show · Schedule · Service …).
  assert.ok(SHEET.indexOf('data="clients-show"') < SHEET.indexOf('data="clients-schedule"'), 'Schedule is not after Show');
  assert.ok(SHEET.indexOf('data="clients-schedule"') < SHEET.indexOf('data="clients-service"'), 'Schedule is not before Service');
  // On-screen, like Show: a window event, never the address.
  assert.match(SHEET, /window\.dispatchEvent\(new CustomEvent\(CLIENTS_SCHEDULE_EVENT, \{ detail: k \}\)\)/, 'the pick does not reach the month');
  assert.match(SHEET, /window\.addEventListener\(CLIENTS_SCHEDULING_EVENT, on\)/, 'the sheet does not hear the chip’s pick');
  assert.doesNotMatch(SHEET, /'sched'|sched=/, 'the Schedule pick rides the address');
  // A narrowed month counts as a choice, and Clear all lets it go.
  assert.match(SHEET, /schedule !== ALL_SCHEDULES \? 1 : 0/, 'a narrowed month is not counted in "N applied"');
  assert.match(SHEET, /onClearAll=\{\(\) => \{[\s\S]{0,120}pickSchedule\(ALL_SCHEDULES\)/, 'Clear all keeps the schedule pick');
  // The page hands the sheet the SAME list the month builds.
  assert.match(PAGE, /schedules=\{scheduleScopeOptions\(monthPart\.month\)\}/, 'the page does not hand the sheet the month’s choices');
});

test('3 · the chip under the legend opens the same choices', () => {
  const legendAt = MONTH.indexOf('<CalendarLegend');
  const chipAt = MONTH.indexOf('data-dates-schedule-chip');
  assert.ok(legendAt > 0 && chipAt > legendAt, 'the chip is not under the legend');
  const chip = MONTH.slice(chipAt, MONTH.indexOf('/>', chipAt));
  assert.match(chip, /<PickMenu\s+label="Schedule"/, 'the chip is not the house dropdown');
  assert.match(chip, /options=\{options\}/, 'the chip does not open the month’s choices');
  assert.match(chip, /`Showing · \$\{scopeWords\}`/, 'the chip does not say "Showing · <schedule>"');
  assert.match(chip, /!min-h-11/, 'the chip is not 44px tall');
  assert.match(MONTH, /const options = scheduleScopeOptions\(\{ pools, agents, halls \}\)/, 'the month builds its own list');
  assert.match(MONTH, /\{schedulesOffered\(options\) && !oneScreen \? \(\s*<div[^>]*data-dates-schedule-chip/, 'one schedule draws a chip');
  // The month hears the sheet and tells it back — only on Clients.
  assert.match(MONTH, /window\.addEventListener\(CLIENTS_SCHEDULE_EVENT, pick\)/, 'the month does not hear Show & sort');
  assert.match(MONTH, /if \(onClients\) window\.dispatchEvent\(new CustomEvent\(CLIENTS_SCHEDULING_EVENT/, 'the sheet is not told the chip’s pick');

  // The one list, executed.
  const pools = [
    { poolId: 'p1', label: 'Photo team' },
    { poolId: 'p2', label: 'Video team' },
  ];
  assert.deepEqual(
    scheduleScopeOptions({ pools, agents: [{ value: 'm1', label: 'Mia' }] }).map((o) => o.label),
    ['All schedules', 'Photo team schedule', 'Video team schedule', 'Mia’s work'],
  );
  assert.deepEqual(scheduleScopeOptions({ pools, halls: true }).map((o) => o.label), ['All halls', 'Photo team', 'Video team']);
  assert.equal(scheduleScopeOptions({ pools })[0]!.key, ALL_SCHEDULES);
  assert.equal(schedulesOffered(scheduleScopeOptions({ pools: pools.slice(0, 1) })), false, 'one schedule offers a pick');
  assert.equal(schedulesOffered(scheduleScopeOptions({ pools })), true);
  assert.notEqual(CLIENTS_SCHEDULE_EVENT, CLIENTS_SHOW_EVENT);
  assert.notEqual(CLIENTS_SCHEDULE_EVENT, CLIENTS_SCHEDULING_EVENT);
});

test('4 · the Schedule page reuses the month — same chip, its own pick', () => {
  assert.match(SCHEDULE_PAGE, /<CustomersCalendar\s+place="schedule"/, 'the Schedule page no longer draws the Clients month');
  // The events are wired behind `onClients`: the Schedule page's month never hears or speaks for the Clients list.
  assert.match(MONTH, /useEffect\(\(\) => \{\s*if \(!onClients\) return;\s*const pick = \(e: Event\) => setScope/, 'the Schedule month hears Clients’ sheet');
  // The chip itself is not gated on the place: the Schedule page has no Show & sort, so the chip is its only way in.
  const before = MONTH.slice(0, MONTH.indexOf('data-dates-schedule-chip'));
  assert.match(before.slice(-200), /\{schedulesOffered\(options\) && !oneScreen \? \(\s*<div[^>]*$/, 'the chip is hidden on the Schedule page');
});

test('5 · the ONE Clients screen draws no chip under the month — the pick is Show & sort’s only', () => {
  // The page mounts the month as the one screen (customers-pin passes `oneScreen`), and the chip is drawn only off it.
  assert.match(code('_components', 'customers-pin.tsx'), /<CustomersCalendar \{\.\.\.month\} oneScreen\b/, 'Clients no longer mounts the one screen');
  assert.match(MONTH, /\{schedulesOffered\(options\) && !oneScreen \? \(/, 'the chip under the month is back on Clients');
  assert.equal((MONTH.match(/data-dates-schedule-chip/g) ?? []).length, 1, 'a second schedule chip was added');
});
