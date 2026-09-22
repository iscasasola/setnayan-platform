import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { findTodaysOneThingRowId } from './todays-one-thing-is-row-one';

/*
  TODAY'S ONE THING IS ROW ①, AND THE FOLD CANNOT LOSE IT (2026-09-22).

  The resolver's #1 pick and the board's `start` row are the same task by
  construction — buildCockpitModel writes `id: `start:${topPriorityTask.id}``.
  So rendering the tile AND the row put one task on the page twice.

  ⚠ THE WHOLE RISK IS THE THIRD STATE. Two cockpit branches leave the pick with
  no row of its own, and one of them pushes NO decision at all (a group with an
  outstanding ask is added to `decidedGroupIds` and `continue`s). Folding the
  tile away unconditionally would delete today's one thing in that state. Hence
  a resolver that returns null, and a caller that keeps the tile when it does.
*/

const g = (...ids: string[]) => ({ items: ids.map((id) => ({ id })) });

test('the start row IS today’s one thing', () => {
  const groups = [g('start:coordinator'), g('pay:o1')];
  assert.equal(findTodaysOneThingRowId(groups, 'coordinator'), 'start:coordinator');
});

test('so is the pick row, when the group already has saved options', () => {
  // Same group, different framing: the cockpit pushes `pick:` INSTEAD of
  // `start:` once options are saved, so the task is still on the board.
  const groups = [g('pick:logistics'), g('pay:o1')];
  assert.equal(findTodaysOneThingRowId(groups, 'logistics'), 'pick:logistics');
});

test('an outstanding ask leaves NO row — and that is what null is for', () => {
  // The cockpit marked the group decided and pushed nothing. The caller must
  // keep the standalone card, so the task does not vanish from the page.
  const groups = [g('pay:o1'), g('role:principal_sponsors')];
  assert.equal(findTodaysOneThingRowId(groups, 'coordinator'), null);
});

test('a pay or role row that shares the suffix is NOT this task', () => {
  // Promoting the wrong row would give the filled action and the "one thing"
  // label to something the resolver never picked.
  const groups = [g('pay:coordinator'), g('role:coordinator'), g('deadline:coordinator')];
  assert.equal(findTodaysOneThingRowId(groups, 'coordinator'), null);
});

test('no task, no row', () => {
  assert.equal(findTodaysOneThingRowId([g('start:venue')], null), null);
  assert.equal(findTodaysOneThingRowId([g('start:venue')], undefined), null);
  assert.equal(findTodaysOneThingRowId([], 'venue'), null);
});

/* ─────────── the render side, which no test can mount ─────────── */

const source = readFileSync(
  path.join(process.cwd(), 'app/dashboard/[eventId]/_components/event-dashboard.tsx'),
  'utf8',
);
const count = (re: RegExp) => (source.match(re) || []).length;

test('the card renders ONLY when the board does not carry the task', () => {
  assert.ok(
    source.includes('{aiActive && topPriorityTask && !oneThingRowId ? ('),
    'the standalone card is the fallback, not the default',
  );
});

test('exactly one filled action on the page, in either state', () => {
  /*
    D-4 (2026-07) reserved ONE filled action for the top-priority task; every
    other CTA steps down to an outline. The task moved from a card into a row,
    so the filled style moved with it — and must not have multiplied.

    Filled = the CTA terracotta in the `mulberry` token. It may appear at most
    twice in the SOURCE: once on the board row (conditional on this being the
    one thing) and once on the fallback card — and those two are mutually
    exclusive at render time, because the card is gated on `!oneThingRowId`.
  */
  const filled = count(/background: 'rgb\(var\(--color-mulberry\)\)', color: '#FFFFFF'/g);
  console.log(`  filled-action sites in source: ${filled} (mutually exclusive at render)`);
  assert.equal(filled, 2, 'one on the row, one on the fallback card, never both on screen');

  // Both must be reachable only through the one-thing condition.
  assert.ok(
    count(/item\.id === oneThingRowId/g) >= 3,
    'the row uses the condition for its label, its style and its inspector copy',
  );
});

test('the row keeps the NAME, and the paragraph goes to the inspector', () => {
  assert.ok(
    /\{item\.id === oneThingRowId \? \(\s*<p className="sn-eye">Today&rsquo;s one thing<\/p>/.test(
      source,
    ),
    'the "one thing" framing survives the card',
  );
  assert.ok(
    /why=\{\s*item\.id === oneThingRowId \? topPriorityTask\?\.whyItMatters : undefined\s*\}/.test(
      source,
    ),
    'whyItMatters is handed to the inspector — the comment that says so must be true',
  );
  const inspector = readFileSync(
    path.join(process.cwd(), 'app/dashboard/[eventId]/_components/overview-inspector-body.tsx'),
    'utf8',
  );
  assert.ok(
    inspector.includes('{why ? <p'),
    'and the inspector renders it only when present — never an empty paragraph',
  );
});
