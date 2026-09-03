/**
 * ONE DOOR, ONE ANSWER — the application half.
 *
 * The database half (`tests/db/one-door-one-answer.db.test.ts`) proves the
 * backfill. This pins the two code changes that make the unification hold going
 * forward, both of which are invisible to a behavioural test:
 *
 *   1. `fetchEntrance` must CONSULT the canonical store. It previously read
 *      only `events.venue_entrance_*`, which is why wayfinding could point at a
 *      different door than the 3D room drew.
 *   2. The Indoor Blueprint editor must WRITE the canonical store, and must set
 *      `entrance_enabled` — every 3D surface ignores a stored position while
 *      the doorway is disabled, so writing a coordinate without enabling it
 *      saves a value nothing will use. That is the same silent disagreement one
 *      field along, and it would pass any test that only checked "the write
 *      happened".
 *
 * Source-level on purpose: both are I/O against tables a unit test has no
 * connection to, and the defect was never a wrong VALUE — it was reading and
 * writing the wrong PLACE.
 *
 * Comment-stripped first: the docblocks below name both tables in prose, so
 * unstripped assertions would pass against code that had been reverted.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const READER = join(import.meta.dirname, 'indoor-blueprint.ts');
const WRITER = join(
  import.meta.dirname, '..', 'app', 'dashboard', '[eventId]',
  'studio', 'indoor-blueprint', 'actions.ts',
);

test('fetchEntrance consults the canonical floor plan, not just the legacy columns', () => {
  const fn = stripComments(readFileSync(READER, 'utf8'));
  const start = fn.indexOf('export async function fetchEntrance');
  assert.ok(start !== -1, 'fetchEntrance moved');
  const body = fn.slice(start);
  const plan = body.indexOf("from('event_floor_plan')");
  const legacy = body.indexOf('venue_entrance_x');
  assert.ok(plan !== -1, 'fetchEntrance must read event_floor_plan — the store four 3D surfaces already use');
  assert.ok(
    legacy === -1 || plan < legacy,
    'the canonical store must be consulted BEFORE the legacy columns, or a ' +
      'stale blueprint value keeps winning over the door the 3D room draws.',
  );
});

test('the blueprint editor writes the canonical store', () => {
  const s = stripComments(readFileSync(WRITER, 'utf8'));
  assert.match(s, /from\('event_floor_plan'\)/, 'the editor must write event_floor_plan');
  assert.doesNotMatch(
    s,
    /update\(\{\s*venue_entrance_x/,
    'writing events.venue_entrance_* is what created the second source of truth',
  );
});

test('placing a door ENABLES it — a coordinate no surface will use is not a save', () => {
  assert.match(
    stripComments(readFileSync(WRITER, 'utf8')),
    /entrance_enabled:\s*true/,
    'every 3D surface ignores a stored entrance while entrance_enabled is ' +
      'false, so the editor must switch the doorway on when the couple places it.',
  );
});
