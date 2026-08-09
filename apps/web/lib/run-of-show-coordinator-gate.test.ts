/**
 * run-of-show-coordinator-gate.test.ts — REPLACED 2026-08-10.
 *
 * This file used to assert the SHAPE of `mayAdvanceRunOfShow()` inside
 * `app/_actions/run-of-show.ts`: that the function existed, that the gate call
 * appeared before the RPC call, and so on. It was careful about the obvious trap
 * — it stripped comments and sliced function bodies so prose could not satisfy it.
 *
 * It still could not fail. An adversarial reviewer beat it twice with one
 * one-token sabotage — **keep the call, discard its result** — and separately by
 * deleting the entire authorization block. The suite stayed green both times
 * while a wedding guest could advance the programme mid-ceremony.
 *
 * 🔑 A SOURCE-SHAPE ASSERTION IS NOT A GUARD. It pins how the code LOOKS, and
 * every failure that mattered here was about what it DOES.
 *
 * The real coverage now lives in two files that run the code and read what comes
 * back, and both go red under all four sabotages:
 *
 *   • `run-of-show-advance-gate.test.ts` — the decision as a pure function, over
 *     the row shapes production actually produces (including the coordinator
 *     membership row that every accepted host invite mints).
 *   • `run-of-show-advance.test.ts` — the whole path with stubbed clients, pinning
 *     the property nothing pinned before: **on a refusal,
 *     `advance_schedule_block` is never called.**
 *
 * What remains here is the one rule that is genuinely structural and cannot be
 * expressed as behaviour: there must be exactly ONE gate, and it must not be
 * re-inlined into the action. Two copies of a permission check is precisely how
 * the day-of console and the floor console came to disagree about who counts as a
 * booked coordinator.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Comments stripped — an assertion must never be satisfied by prose. */
const ACTION = readFileSync(join(WEB, 'app/_actions/run-of-show.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

test('the action delegates to the single gate rather than carrying its own', () => {
  assert.match(
    ACTION,
    /runAdvance\(/,
    'the action stopped calling runAdvance — if the gate moved again, move the two ' +
      'behavioural test files with it; if it was inlined here, that is a second copy ' +
      'and the reason this rule exists',
  );
});

test('the action does not re-implement the permission check inline', () => {
  for (const smell of [
    /from\(\s*['"]event_members['"]\s*\)/,
    /from\(\s*['"]event_moderators['"]\s*\)/,
    /current_coordinator_booked_event_ids/,
  ]) {
    assert.ok(
      !smell.test(ACTION),
      `a permission read matching ${smell} is back inside the server action. There ` +
        `must be exactly one gate — lib/run-of-show-advance.ts — or the two copies ` +
        `will drift.`,
    );
  }
});

test('the action never calls the advance RPC directly', () => {
  assert.ok(
    !/rpc\(\s*['"]advance_schedule_block['"]/.test(ACTION),
    'the action calls advance_schedule_block itself — that is a path around the gate',
  );
});
