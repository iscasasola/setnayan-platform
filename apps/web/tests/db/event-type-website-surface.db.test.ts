/**
 * EVERY event type the migrations actually produce must have a launchable
 * public page — SOURCE-OF-TRUTH guard (test:db, migrations replayed). Item 81.
 *
 * `day_of` and `gallery` are pages OF the couple's public event website, and
 * `website` is the surface that makes that site editable and carries the ONLY
 * "go live" control. A profile with either and no `website` is a page nobody
 * can ever open. That shipped once — `simple_event` — and the owner reported it
 * (2026-08-02, "the host of the event cannot launch his on the day website");
 * migration 20271102084500 repaired the rows that existed at that moment.
 *
 * The pure siblings (lib/event-type-launchable.test.ts,
 * lib/event-type-website-surface-guard.test.ts) key off the HARDCODED fallback
 * profiles and the admin save path. Neither can see a seed migration that adds
 * a new event type with the broken combination — and `resolveProfile` PREFERS
 * the database row, so the seeded row is what prod actually reads. This closes
 * that gap: it replays every migration and reads the real
 * `event_type_profiles` table.
 *
 * So: seed a new event type with a day-of page and forget `website` → this
 * fails. There is no hand-maintained roster to keep in sync.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { SURFACES_THAT_RENDER_ON_THE_WEBSITE } from '../../lib/event-type-profile';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close();
});

test('🚨 no event_type_profiles row enables a day-of page or gallery without the website surface', async () => {
  const r = await replay.db.query<{ event_type: string; enabled_surfaces: string[] | null }>(
    `SELECT event_type, enabled_surfaces
       FROM public.event_type_profiles
      ORDER BY event_type`,
  );

  // Sanity floor FIRST: an empty read satisfies every assertion below and looks
  // exactly like a pass. (RLS denial and an empty table are the same value.)
  assert.ok(
    r.rows.length >= 10,
    `expected the seeded event_type_profiles roster, got ${r.rows.length} rows — ` +
      `an empty/failed read would pass the invariant check vacuously.`,
  );

  // …and the dependent surfaces must actually be PRESENT somewhere in the data,
  // or the loop below is checking a condition that never occurs.
  const anyDependent = r.rows.some((row) =>
    SURFACES_THAT_RENDER_ON_THE_WEBSITE.some((s) => (row.enabled_surfaces ?? []).includes(s)),
  );
  assert.ok(
    anyDependent,
    `no seeded profile enables ${SURFACES_THAT_RENDER_ON_THE_WEBSITE.join(' or ')} — ` +
      `this guard would then pass without testing anything.`,
  );

  const stranded = r.rows
    .filter((row) => {
      const s = row.enabled_surfaces ?? [];
      if (s.includes('website')) return false;
      return SURFACES_THAT_RENDER_ON_THE_WEBSITE.some((dep) => s.includes(dep));
    })
    .map((row) => `${row.event_type} [${(row.enabled_surfaces ?? []).join(', ')}]`);

  assert.deepEqual(
    stranded,
    [],
    `these event types render a day-of page or gallery on the public event site ` +
      `but have no 'website' surface, so their host is redirected out of the only ` +
      `"go live" control and the page can never be opened by a guest:\n  ` +
      stranded.join('\n  '),
  );
});
