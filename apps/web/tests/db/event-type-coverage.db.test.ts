/**
 * Event-type coverage — SOURCE-OF-TRUTH guard (test:db, migrations replayed).
 *
 * The pure sibling (lib/event-type-coverage.test.ts) keys off ANCHOR_BY_TYPE, a
 * CODE roster that can itself drift from the real event types. This one closes
 * that last gap: it replays every migration into PGlite and reads the ACTUAL
 * `event_type_vocab` the migrations produce — the same roster the pickers show —
 * then asserts every ENABLED type has a checklist label and an explicit AI tier.
 *
 * So: add a new type via a vocab migration and forget the code maps → this
 * fails, no hand-maintained proxy to keep in sync. This is the self-enforcing
 * net (catches even a vocab type that was never added to ANCHOR_BY_TYPE — the
 * exact way gala_night and date/hangout slipped past the map guards).
 *
 * NOTE: `test:db` is not yet wired into the main CI job; this guard fires on
 * `pnpm --filter @setnayan/web test:db` (and any CI step that runs it).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { checklistChrome } from '../../lib/checklist';
import { AI_TIER_BY_EVENT_TYPE } from '../../lib/setnayan-ai-type-pricing';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close();
});

test('every ENABLED event_type_vocab type has a checklist label + an AI price tier', async () => {
  const r = await replay.db.query<{ event_type: string }>(
    `SELECT event_type FROM public.event_type_vocab
      WHERE enabled = true AND status = 'active'
      ORDER BY event_type`,
  );
  const types = r.rows.map((row) => row.event_type);

  // Sanity: the replayed vocab must be non-trivial (guards against an empty
  // read silently passing the coverage checks below).
  assert.ok(
    types.length >= 14,
    `expected the full event_type_vocab roster, got ${types.length}: ${types.join(', ')}`,
  );

  // `wedding` legitimately owns the wedding chrome; every other enabled type
  // must have its own CHECKLIST_EVENT_LABELS entry (else it mislabels).
  const missingLabel = types.filter(
    (t) => t !== 'wedding' && checklistChrome(t).heading === 'Wedding checklist',
  );
  assert.deepEqual(
    missingLabel,
    [],
    `enabled vocab types with NO CHECKLIST_EVENT_LABELS entry (render as "Wedding checklist"): ${missingLabel.join(', ')}`,
  );

  const missingTier = types.filter((t) => !(t in AI_TIER_BY_EVENT_TYPE));
  assert.deepEqual(
    missingTier,
    [],
    `enabled vocab types with NO AI_TIER_BY_EVENT_TYPE entry (silently default to Tier C/₱499): ${missingTier.join(', ')}`,
  );
});
