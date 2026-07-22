import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_DRIVE_DROP_WARN_GRACE_DAYS,
  noDriveDropAllowed,
} from './papic-fullres-drop-core';

// ============================================================================
// Papic storage PR-4 — no-Drive HOLD-AND-WARN gate (pure predicate).
//
// The load-bearing invariant: a couple who never connected Google Drive can
// NEVER lose a full-res original in one silent sweep. Their original is dropped
// only after a PROVEN warning (the ~day-76 nudge stamps full_res_drop_warned_at)
// AND a lead-time grace. Unwarned → HOLD, forever if need be.
// ============================================================================

const NOW = Date.parse('2026-07-22T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

test('THE INVARIANT: an unwarned no-Drive original is NEVER droppable (held, no silent loss)', () => {
  assert.equal(noDriveDropAllowed(null, { nowMs: NOW }), false);
});

test('an unparseable warn stamp is treated as unwarned → HOLD', () => {
  assert.equal(noDriveDropAllowed('not-a-timestamp', { nowMs: NOW }), false);
  assert.equal(noDriveDropAllowed('', { nowMs: NOW }), false);
});

test('warned but still inside the lead-time grace → HOLD', () => {
  // Warned 3 days ago, grace is 7 days → not yet droppable.
  assert.equal(
    noDriveDropAllowed(daysAgo(3), { nowMs: NOW }),
    false,
    'the couple must get their full download window before the drop',
  );
  // Exactly at the boundary minus a hair → still held.
  assert.equal(
    noDriveDropAllowed(daysAgo(NO_DRIVE_DROP_WARN_GRACE_DAYS - 0.01), { nowMs: NOW }),
    false,
  );
});

test('warned and past the grace → drop allowed (the couple had their window)', () => {
  assert.equal(noDriveDropAllowed(daysAgo(NO_DRIVE_DROP_WARN_GRACE_DAYS), { nowMs: NOW }), true);
  assert.equal(noDriveDropAllowed(daysAgo(14), { nowMs: NOW }), true);
});

test('the day-76 nudge (14 days before the 90-day fuse) clears the 7-day grace by the fuse', () => {
  // A photo captured 90 days ago was warned at day-76 → warned 14 days ago at the
  // fuse. 14 >= 7 → allowed. This is why the gate passes in the NORMAL flow and
  // only ever HOLDS when the warn never actually landed.
  assert.equal(noDriveDropAllowed(daysAgo(14), { nowMs: NOW }), true);
});

test('a custom grace is honored', () => {
  assert.equal(noDriveDropAllowed(daysAgo(5), { nowMs: NOW, graceDays: 10 }), false);
  assert.equal(noDriveDropAllowed(daysAgo(12), { nowMs: NOW, graceDays: 10 }), true);
});
