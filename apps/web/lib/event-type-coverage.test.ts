/**
 * Event-type coverage guard (runs in CI via test:unit).
 *
 * `ANCHOR_BY_TYPE` is treated as the canonical CODE roster of event types (it's
 * the list the create/checklist paths already key off). This guard asserts that
 * EVERY type in it also has:
 *   1. a `CHECKLIST_EVENT_LABELS` entry — else `checklistChrome()` falls through
 *      to the WEDDING chrome and the event renders as "Wedding checklist".
 *   2. an explicit `AI_TIER_BY_EVENT_TYPE` entry — else it silently defaults to
 *      Tier C (₱499), which is how gala_night was almost mispriced.
 *
 * Register a new type in `ANCHOR_BY_TYPE` and forget either map → this fails.
 * So the two maps can never drift out of sync with the roster again — that's the
 * exact miss that shipped gala_night / date / hangout. The remaining gap (a type
 * added to `event_type_vocab` but NOT to `ANCHOR_BY_TYPE`) is closed by the
 * source-of-truth DB guard in tests/db/event-type-coverage.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ANCHOR_BY_TYPE } from './event-anchor';
import { checklistChrome } from './checklist';
import { AI_TIER_BY_EVENT_TYPE } from './setnayan-ai-type-pricing';

const ROSTER = Object.keys(ANCHOR_BY_TYPE);

test('every event type has a checklist label (no Wedding-chrome fallthrough)', () => {
  // `wedding` legitimately uses the wedding chrome; every other type must have
  // its own label or checklistChrome returns the wedding heading.
  const missing = ROSTER.filter(
    (t) => t !== 'wedding' && checklistChrome(t).heading === 'Wedding checklist',
  );
  assert.deepEqual(
    missing,
    [],
    `event types missing a CHECKLIST_EVENT_LABELS entry (render as "Wedding checklist"): ${missing.join(', ')}`,
  );
});

test('every event type has an explicit AI price tier (no silent ₱499 default)', () => {
  const missing = ROSTER.filter((t) => !(t in AI_TIER_BY_EVENT_TYPE));
  assert.deepEqual(
    missing,
    [],
    `event types missing an AI_TIER_BY_EVENT_TYPE entry (silently default to Tier C/₱499): ${missing.join(', ')}`,
  );
});
