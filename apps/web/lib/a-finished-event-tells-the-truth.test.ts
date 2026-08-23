import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sortScheduleBlocks } from './schedule';
import { checklistPhaseLabel, CHECKLIST_PHASES, CHECKLIST_PHASES_SHORT } from './checklist';
import { buildCustomerMenuTree } from './customer-menu';
import { buildProgressStages, type ProgressStagesInput } from './progress-stages';

/**
 * a-finished-event-tells-the-truth.test.ts
 *
 * Four things a celebration that has already happened used to say, and no
 * longer does:
 *   1. an empty schedule on its very first open, because the page asked the
 *      database the SAME question twice in one render and Next answered the
 *      second one from memory;
 *   2. "This week" over a column of dates in the past, every one of them red;
 *   3. a menu entry called "Review" that opened a shop directory;
 *   4. a "7-day review window" that exists nowhere in the product.
 *
 * 🛡 Every source assertion below was mutation-checked BY OCCURRENCE COUNT —
 * the count is printed before and after in the PR body. Comments are stripped
 * before matching, because each fix carries a note quoting the string it
 * removed and a raw-source guard would pass on its own explanation.
 */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const SCHEDULE_PAGE = 'app/dashboard/[eventId]/schedule/page.tsx';
const SEED = 'lib/schedule-seed.server.ts';
const CHECKLIST_PAGE = 'app/dashboard/[eventId]/checklist/page.tsx';
const CHECKLIST_FULL = 'app/dashboard/[eventId]/_components/checklist/checklist-full.tsx';
const TEAM = 'app/dashboard/[eventId]/vendors/_components/build-locked.tsx';
const VENDORS_PAGE = 'app/dashboard/[eventId]/vendors/page.tsx';
const SUMMARY = 'app/dashboard/[eventId]/_components/after/finished-event-summary.tsx';

// ── 1 · the schedule asks once ───────────────────────────────────────────────

test('the schedule page reads its blocks exactly once per render', () => {
  const page = code(SCHEDULE_PAGE);
  assert.equal(
    (page.match(/fetchScheduleBlocks\(/g) || []).length,
    1,
    'two identical reads in one render are ONE read — Next memoises the second, ' +
      'so the post-seed re-read is served the pre-seed answer',
  );
});

test('the seed hands back the rows it wrote, rather than a count to re-read', () => {
  const seed = code(SEED);
  assert.match(seed, /Promise<ScheduleBlockRow\[\]>/, 'it returns blocks, not a number');
  assert.match(seed, /insertScheduleBlocks\(admin, rows\)/, 'INSERT … RETURNING, via the module that owns the columns');
  assert.ok(
    !/fetchScheduleBlocks/.test(seed),
    'the seed must not re-read either — that is the same trap one file along',
  );
});

test('the column list stays PRIVATE — an exported one becomes a canonical list', () => {
  /*
    🪤 THE FIRST CUT EXPORTED IT AS `SCHEDULE_BLOCK_SELECT` so the seeder could
    name the same columns. `scripts/lint-dup-rule.ts` treats every exported
    `*_SELECT` / `*_COLUMNS` constant as the CANONICAL list for its table and
    reports narrower hand-typed selects against it — **108 findings in one CI
    run**, none of them defects. A guard that cries wolf 108 times teaches its
    reader to skim past the one time it is right. The list is private again and
    the seeder calls a function instead, so there is still exactly one copy.
  */
  const lib = code('lib/schedule.ts');
  assert.ok(!/export const \w*SELECT\b/.test(lib), 'do not export a *_SELECT constant from here');
  assert.match(lib, /export async function insertScheduleBlocks/, 'the writer is the shared thing');
  assert.match(lib, /\.select\(SELECT\)/, 'and it uses the one private list');
});

test('the seeded order is the order the database would have returned', () => {
  // Mirrors fetchScheduleBlocks: start_at ascending, then sort_order ascending.
  const rows = [
    { start_at: '2026-05-02T10:00:00Z', sort_order: 300 },
    { start_at: null, sort_order: 100 },
    { start_at: '2026-05-01T10:00:00Z', sort_order: 200 },
    { start_at: '2026-05-01T10:00:00Z', sort_order: 100 },
  ];
  assert.deepEqual(
    sortScheduleBlocks(rows).map((r) => [r.start_at, r.sort_order]),
    [
      ['2026-05-01T10:00:00Z', 100],
      ['2026-05-01T10:00:00Z', 200],
      ['2026-05-02T10:00:00Z', 300],
      [null, 100], // PostgREST puts NULLs last on an ascending order
    ],
  );
});

test('the comparator and the query still name the same two columns', () => {
  const lib = code('lib/schedule.ts');
  const fetchBody = lib.slice(lib.indexOf('export async function fetchScheduleBlocks'));
  assert.match(fetchBody.slice(0, 500), /\.order\('start_at', \{ ascending: true \}\)/);
  assert.match(fetchBody.slice(0, 500), /\.order\('sort_order', \{ ascending: true \}\)/);
});

// ── 2 · the checklist knows the day happened ────────────────────────────────

test('the checklist asks the ONE lifecycle resolver, not a date comparison of its own', () => {
  const page = code(CHECKLIST_PAGE);
  assert.match(page, /getMenuLifecyclePhase/, 'one resolver decides "did this happen", app-wide');
  assert.match(page, /event_end_date/, 'a celebration spanning days is over after its LAST day');
  assert.match(page, /eventIsOver=\{eventIsOver\}/, 'and the answer must reach the list');
});

test('"This week" is the only caption a finished event re-words — and it does', () => {
  const s1 = CHECKLIST_PHASES_SHORT.find((p) => p.id === 's1')!;
  assert.equal(checklistPhaseLabel(s1, 'hangout', false).label, 'This week');
  assert.equal(checklistPhaseLabel(s1, 'hangout', true).label, 'The week before');
});

test('every OTHER caption is event-relative and is left alone', () => {
  // "9–6 months before" is as true a year later as it was on the day it was
  // written. Re-wording those would be churn, not a fix.
  for (const p of [...CHECKLIST_PHASES, ...CHECKLIST_PHASES_SHORT]) {
    if (p.id === 's1') continue;
    assert.equal(
      checklistPhaseLabel(p, 'birthday', true).label,
      checklistPhaseLabel(p, 'birthday', false).label,
      `${p.id} changed wording after the event and had no reason to`,
    );
  }
});

test('a finished list drops the deadline word and the alarm colours', () => {
  const full = code(CHECKLIST_FULL);
  const due = full.slice(full.indexOf('function dueLabel'), full.indexOf('function PhaseRows'));
  assert.match(due, /if \(eventIsOver\) return \{ label: pretty/, 'the date, plainly');
  assert.ok(
    due.indexOf('if (eventIsOver) return') < due.indexOf('text-danger-700'),
    'the finished branch must return BEFORE anything can paint a row overdue',
  );
  assert.ok(
    !/\{pct\}%[\s\S]{0,80}<\/span>\s*<\/div>\s*<div className="sn-bar/.test(full),
    'the countdown bar must be behind the not-over branch',
  );
});

// ── 3 · "Review" has a destination ──────────────────────────────────────────

test('the After menu\'s Review entry lands on the team, not the bench', () => {
  const after = buildCustomerMenuTree('EVT1', { phase: 'after' });
  const review = after.find((m) => m.key === 'review');
  assert.ok(review, 'the after phase carries a Review entry');
  assert.equal(review!.href, '/dashboard/EVT1/vendors?tab=build');
});

test('the finished-event summary card lands there too, unless there is nobody', () => {
  const summary = code(SUMMARY);
  assert.match(summary, /summary\.suppliers === 0 \? `\$\{base\}\/vendors` : `\$\{base\}\/vendors\?tab=build`/);
});

test('the team list actually offers the review it invites — on the LIVE path', () => {
  // The chip used to exist ONLY on plan-budget-accordion.tsx, which renders
  // solely with BUDGET_BUILD_ENABLED=false. It had never been seen.
  const team = code(TEAM);
  assert.match(team, /reviewStatusByVendorId\?\.get\(r\.vendorId\) === 'open'/);
  assert.match(team, /vendors\/\$\{r\.vendorId\}\/review/);
  assert.match(team, /reviewStatusByVendorId\?\.get\(r\.vendorId\) === 'submitted'/);
  /*
    🪤 SCOPED TO THE <BuildLocked> ELEMENT, AND THAT IS NOT FUSSINESS.
    The first cut matched this prop anywhere in the file and stayed GREEN
    through a mutation that deleted it from BuildLocked — because the page ALSO
    passes it to the fallback accordion, and 2 → 1 is still a match. The count
    was the only thing that showed it. A file-level count cannot say which
    component still receives a thing.
  */
  const page = code(VENDORS_PAGE);
  const el = page.slice(page.indexOf('<BuildLocked'));
  assert.match(
    el.slice(0, el.indexOf('/>')),
    /reviewStatusByVendorId=\{reviewStatusByVendorId\}/,
    'a prop nothing passes is a chip nobody sees',
  );
});

test('the chip never uses the gold slot for text', () => {
  // `text-terracotta` is the atelier GOLD in this repo — 3.37:1 on the page,
  // below the 4.5:1 floor. The action colour lives in the `mulberry` slot.
  const team = code(TEAM);
  const chip = team.slice(team.indexOf("=== 'open'"), team.indexOf("=== 'submitted'"));
  assert.ok(!/text-terracotta/.test(chip), 'gold is not a text colour');
  // The measured pairing: mulberry fill + cream label = 4.76:1 light,
  // 6.20:1 dark. NOT `bg-mulberry/10` + `text-mulberry`, which measures 4.16:1
  // and which both shipped contrast guards pass — an alpha fill is invisible to
  // one and out of scope for the other.
  assert.match(chip, /bg-mulberry px-/, 'a solid fill, not a tint');
  assert.match(chip, /text-cream/);
  assert.ok(!/bg-mulberry\//.test(chip), 'an alpha mulberry fill cannot carry mulberry text');
});

// ── 4 · the After stage stops promising a clock nobody runs ─────────────────

const STAGE_INPUT: ProgressStagesInput = {
  eventType: 'wedding',
  ceremonyType: null,
  eventDate: '2026-01-01',
  datePrecision: 'day',
  daysOut: -30,
  venueName: null,
  paletteFinalizedAt: null,
  budgetTargetCentavos: null,
  guestsTotal: 0,
  guestsAttending: 0,
  guestsResponded: 0,
  lockedVendorCount: 0,
  totalLockableCategories: 4,
  seatedGuests: 0,
  paperworkTotal: 0,
  paperworkReceived: 0,
  pendingPaymentCount: 0,
  activeServiceCount: 0,
};

test('no stage promises a review window the product does not run', () => {
  const { stages } = buildProgressStages(STAGE_INPUT);
  const words = stages.flatMap((s) => [
    s.aiNote ?? '',
    ...s.done.map((i) => `${i.label} ${i.detail ?? ''}`),
    ...s.todo.map((i) => `${i.label} ${i.detail ?? ''}`),
  ]);
  for (const w of words) {
    assert.ok(
      !/7[\s-]?day/i.test(w),
      `nothing counts seven days over a gallery anywhere in this product: "${w}"`,
    );
  }
});

test('the After stage still says the true half — the couple releases it', () => {
  const after = buildProgressStages(STAGE_INPUT).stages.find((s) => s.key === 'after')!;
  assert.match(after.aiNote ?? '', /when you release it/);
  assert.match(after.aiNote ?? '', /nothing goes public without you/);
});

test('the After percentage is derived from its own items, not hardcoded', () => {
  assert.ok(
    !/const afterPct = 0;/.test(code('lib/progress-stages.ts')),
    'a stub that ignores its own items reads as a measurement and is not one',
  );
});
