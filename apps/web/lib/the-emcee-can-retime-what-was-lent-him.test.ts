/**
 * the-emcee-can-retime-what-was-lent-him.test.ts — DAY-8.
 *
 * The running order belongs to the couple. They lend it, one area at a time,
 * through the delegate grid: an accepted `event_moderators` row carrying
 * `schedule: 'edit'`. The control that acts on that loan — `ScheduleUpdater` —
 * has shipped since the floor-command surface was built.
 *
 * It was mounted in exactly ONE place: the COORDINATOR's surface. The host/MC's
 * desk read the same blocks, drew the same script, and offered no way to touch
 * them. So an emcee holding a loan the couple had already granted watched his own
 * segments run late and could do nothing about it.
 *
 * 🔑 NOTHING RENDERED WRONGLY, WHICH IS WHY NOTHING FOUND IT. A search for the
 * capability finds `ScheduleUpdater` and answers "already ships". An execution
 * pass finds no false branch, because there is no branch — the surface simply
 * does not render it. Only comparing the two SIBLING surfaces finds this class.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────────
 *   EXERCISED — `lentScheduleState` over the whole grant × schedule space, and
 *   the fact that `'view'` is NOT a loan. That distinction is the entire purpose
 *   of the delegate grid, and it is one character away from being lost.
 *
 *   PARSED — three things no unit test can execute here, because both surfaces
 *   are async server components:
 *     · the emcee's desk mounts `ScheduleUpdater`, and passes `onLoan`;
 *     · the coordinator's surface still mounts it too — this row must not move
 *       the control, only add a second home for it;
 *     · ONE rule decides that a `schedule` grant permits retiming. The whole
 *       reason `lentScheduleState` was extracted is that a second copy would
 *       drift, and the copy that drifts is the one that stops refusing.
 *
 * ⚠ THIS GUARD IS NOT THE AUTHORIZATION AND MUST NOT BE READ AS IT. The WRITE is
 * gated server-side by `decideMayAdvance` (`run-of-show-advance-gate.ts`), whose
 * own docblock records that two earlier generations of it were beaten by "keep
 * the call, discard its result". Everything below is about whether a control is
 * DRAWN. Drawing it for somebody the database will refuse is a broken promise;
 * hiding it from somebody the database allows is this row's defect.
 *
 * 🛡 Sabotage-checked, each mutation still parsing and still typechecking, with
 * the subtest count printed before the colour is read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { lentScheduleState, type FloorGrants } from '@/lib/floor-command';
import type { AdvanceAction } from '@/lib/floor-command';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const LIVE = join(WEB, 'app', 'vendor-dashboard', 'on-the-day', 'live', '[eventId]', '_components');
const src = (p: string) => stripComments(readFileSync(join(LIVE, p), 'utf8'));

const emcee = src(join('stage-script', 'stage-script.tsx'));
const coordinator = src(join('floor-command', 'floor-command.tsx'));

const START: AdvanceAction = { kind: 'start', label: 'First dance' } as AdvanceAction;
const EMPTY: AdvanceAction = { kind: 'empty' } as AdvanceAction;

test('EXERCISED · only an `edit` loan draws the control — `view` is permission to WATCH', () => {
  const levels: FloorGrants['schedule'][] = ['edit', 'view', null];
  for (const level of levels) {
    const r = lentScheduleState(level, START);
    console.log(`  schedule=${String(level).padEnd(5)} → ${r.state} (${r.reason ?? 'ready'})`);
  }
  assert.equal(lentScheduleState('edit', START).state, 'ready');

  /*
   * The load-bearing one. `'view'` and `'edit'` differ by one character and by
   * the whole meaning of the delegate grid: a couple who shared their running
   * order to be READ has not handed over the night. A gate that accepted any
   * non-null level would pass every test that only ever tried `edit` and `null`.
   */
  assert.equal(lentScheduleState('view', START).state, 'unavailable');
  assert.equal(lentScheduleState('view', START).reason, 'not_shared');
  assert.equal(lentScheduleState(null, START).state, 'unavailable');
});

test('EXERCISED · a lent but EMPTY schedule says so instead of drawing a dead button', () => {
  const r = lentScheduleState('edit', EMPTY);
  console.log(`  edit + empty schedule → ${r.state} (${r.reason})`);
  assert.deepEqual(r, { state: 'unavailable', reason: 'no_schedule' });
  // And an unlent empty schedule reports the LOAN as the reason, not the
  // emptiness — you do not tell somebody a room is empty when they were never
  // given the key.
  assert.equal(lentScheduleState(null, EMPTY).reason, 'not_shared');
});

test('PARSED · the emcee desk mounts the control, and says whose schedule it is', () => {
  const mounts = emcee.match(/<ScheduleUpdater\b/g)?.length ?? 0;
  console.log(`  <ScheduleUpdater> on the emcee desk: ${mounts}`);
  assert.equal(mounts, 1, 'the host/MC desk no longer offers the control');

  const mount = emcee.slice(emcee.indexOf('<ScheduleUpdater'));
  const close = mount.indexOf('/>');
  assert.ok(close > 0, 'the mount is not self-closing — this guard cannot read its props');
  const props = mount.slice(0, close);
  assert.match(props, /\bonLoan\b/, 'the emcee is not told the running order is on loan');

  // The mount must be GATED on the resolved loan, never rendered unconditionally.
  assert.match(
    emcee,
    /lentScheduleState\(/,
    'the emcee desk no longer asks whether the schedule was lent',
  );
  assert.match(
    emcee,
    /\.state === 'ready' \?[\s\S]{0,400}?<ScheduleUpdater/,
    'the control is drawn without checking that the couple lent it',
  );
});

test('PARSED · the coordinator keeps the control — this row adds a home, never moves one', () => {
  const mounts = coordinator.match(/<ScheduleUpdater\b/g)?.length ?? 0;
  console.log(`  <ScheduleUpdater> on the coordinator surface: ${mounts}`);
  assert.equal(mounts, 1, 'the coordinator lost the retimer');
});

test('PARSED · neither surface decides the loan itself — both ask the one resolver', () => {
  /*
   * The anti-drift assertion, and the reason the rule was extracted rather than
   * copied. Two surfaces now draw the same control; if either re-derives "does
   * this grant permit retiming" locally, they can disagree — and the copy that
   * drifts is the one that stops refusing.
   *
   * ⚠ SCOPED TO THE TWO SIBLING SURFACES, DELIBERATELY, AND THE FIRST VERSION OF
   * THIS TEST WAS WRONG. It scanned the whole tree for any `schedule … === 'edit'`
   * and fired on two legitimate sites — `coordinator-broadcasts-server.ts` and
   * the couple's own `schedule/page.tsx` — which RESOLVE a delegate's permission
   * out of `ModeratorPermissions` for entirely different questions. Banning a
   * spelling across a codebase catches the innocent; the property that matters is
   * that THESE TWO surfaces share one answer. Asserted as a property of each
   * file, not as a phrasing forbidden everywhere.
   */
  for (const [name, body] of [
    ['stage-script.tsx (emcee)', emcee],
    ['floor-command.tsx (coordinator)', coordinator],
  ] as const) {
    const local = body.match(/\bschedule\b[^\n]{0,40}===\s*'edit'/g)?.length ?? 0;
    console.log(`  ${name}: local "=== 'edit'" decisions ${local}`);
    assert.equal(local, 0, `${name} decides the schedule loan itself instead of asking the resolver`);
  }

  // And the emcee's surface must reach the rule through the shared module, not
  // through a local helper that happens to share its name.
  assert.match(
    emcee,
    /import \{[^}]*lentScheduleState[^}]*\} from '@\/lib\/floor-command'/,
    'the emcee desk no longer imports the shared loan resolver',
  );
  assert.match(
    stripComments(readFileSync(join(WEB, 'lib', 'floor-command.ts'), 'utf8')),
    /const schedule = lentScheduleState\(/,
    'buildFloorCommand stopped delegating to the extracted rule, so the two surfaces can drift',
  );
});
