/**
 * papic-crew-roster.test.ts
 *
 * The host's crew screen now prints a NUMBER next to each camera, and a wrong
 * number here is worse than the blank it replaced: it sends someone to fix a
 * camera that is fine, or leaves them calm about one that has stopped.
 *
 * Two states carry all the risk and are asserted in both directions —
 * "unknown" must never render as 0, and 0 must never be swallowed as unknown.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  crewHolderName,
  crewShotsLeftLabel,
  PAPIC_UNCAPPED_REMAINING,
} from './papic-crew-roster';

test('a camera that has stopped says so — 0 is a real answer, not a missing one', () => {
  assert.equal(crewShotsLeftLabel(0), 'Out of shots');
});

test('an unknown count says NOTHING — it must never be rendered as zero', () => {
  // A failed probe, a null, a NaN. Each has to be silent: "Out of shots" on a
  // camera that is actually fine is the expensive mistake on this screen.
  for (const v of [null, undefined, Number.NaN]) {
    assert.equal(crewShotsLeftLabel(v as number | null | undefined), null);
  }
});

test('the uncapped sentinel is never printed as a number', () => {
  // papic_camera_points_remaining returns INT_MAX to mean "no per-day budget".
  // Printed literally that is "2,147,483,647 shots left" on a couple's screen.
  assert.equal(crewShotsLeftLabel(PAPIC_UNCAPPED_REMAINING), null);
  assert.equal(crewShotsLeftLabel(PAPIC_UNCAPPED_REMAINING - 1), null);
});

test('a real count reads as a count, and singular is singular', () => {
  assert.equal(crewShotsLeftLabel(1), '1 shot left');
  assert.equal(crewShotsLeftLabel(42), '42 shots left');
  assert.equal(crewShotsLeftLabel(1500), '1,500 shots left');
});

test('a negative count cannot appear on screen', () => {
  assert.equal(crewShotsLeftLabel(-5), 'Out of shots');
});

test('a holder with no display name still gets a word, never a blank', () => {
  assert.equal(crewHolderName(null), 'Someone');
  assert.equal(crewHolderName('   '), 'Someone');
  assert.equal(crewHolderName(undefined), 'Someone');
});

test('a holder with a name gets their name, trimmed', () => {
  assert.equal(crewHolderName('  Ana Reyes '), 'Ana Reyes');
});
