/**
 * Unit suite for the wedding-cardinality predicate. The load-bearing invariant
 * (flow-check fix 2026-07-12): a wedding blocks a new one only while IN PLANNING
 * — a SETTLED wedding (archived, or completed = event_date passed) must NOT
 * block, so a widow/annulled/remarrying user can create a new wedding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isInPlanningWedding } from './wedding-guard';

const TODAY = '2026-07-12';

test('an in-planning wedding (future date, not archived) blocks', () => {
  assert.equal(isInPlanningWedding({ event_type: 'wedding', event_date: '2027-01-17', archived: false }, TODAY), true);
});

test('a wedding with no date yet (still planning) blocks', () => {
  assert.equal(isInPlanningWedding({ event_type: 'wedding', event_date: null, archived: false }, TODAY), true);
});

test('a COMPLETED wedding (date strictly past) does NOT block — remarriage/widow', () => {
  assert.equal(isInPlanningWedding({ event_type: 'wedding', event_date: '2020-02-14', archived: false }, TODAY), false);
});

test('an ARCHIVED wedding does NOT block (called-off)', () => {
  assert.equal(isInPlanningWedding({ event_type: 'wedding', event_date: '2027-01-17', archived: true }, TODAY), false);
});

test('a wedding dated TODAY still blocks (day not yet passed)', () => {
  assert.equal(isInPlanningWedding({ event_type: 'wedding', event_date: TODAY, archived: false }, TODAY), true);
});

test('non-wedding events never block', () => {
  assert.equal(isInPlanningWedding({ event_type: 'anniversary', event_date: null, archived: false }, TODAY), false);
  assert.equal(isInPlanningWedding({ event_type: 'debut', event_date: '2027-01-01', archived: false }, TODAY), false);
});

test('null/undefined event never blocks', () => {
  assert.equal(isInPlanningWedding(null, TODAY), false);
  assert.equal(isInPlanningWedding(undefined, TODAY), false);
});
