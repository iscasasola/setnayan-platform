/**
 * invitation_widgets seed — the canonical 16-type contract.
 *
 * Migration 20270919679722 reconciles populate_default_invitation_widgets()
 * after the 20270110320023 stale rebuild left the live trigger at 14 types
 * (missing what_to_bring + our_photos, with our_love_story squatting on
 * what_to_bring's display_order 14). Proven here against the FULL replayed
 * prod schema (every migration, in-memory PGlite):
 *
 *   1. A new event seeds exactly 16 widget rows — one per canonical
 *      WIDGET_TYPES entry — at the canonical display_orders (our_love_story
 *      at 16, what_to_bring at 14, our_photos at 15), no collisions.
 *   2. The reconcile's defensive backfill heals a drifted event: deleting
 *      what_to_bring + our_photos and re-running the migration's backfill
 *      INSERT restores both without disturbing the other 14 rows.
 *
 * The canonical list mirrors apps/web/lib/invitation-widgets.ts WIDGET_TYPES
 * (kept literal here so a lib change breaks this test loudly, not silently).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

const CANONICAL_16: ReadonlyArray<[type: string, order: number]> = [
  ['hero', 1],
  ['greeting', 2],
  ['qr_card', 3],
  ['event_details', 4],
  ['countdown', 5],
  ['schedule', 6],
  ['rsvp', 7],
  ['venue_map', 8],
  ['dress_code', 9],
  ['photo_moments', 10],
  ['your_photos', 11],
  ['tier_comparison', 12],
  ['special_message', 13],
  ['what_to_bring', 14],
  ['our_photos', 15],
  ['our_love_story', 16],
];

let replay: ReplayResult;
let db: PGlite;
let eventId: string;

async function widgetRows(): Promise<Array<{ widget_type: string; display_order: number }>> {
  const r = await db.query<{ widget_type: string; display_order: number }>(
    `SELECT widget_type, display_order FROM public.invitation_widgets
     WHERE event_id = $1 ORDER BY display_order, widget_type`,
    [eventId],
  );
  return r.rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // operate as the migration owner — the trigger fires regardless

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Widget Seed Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
});

after(async () => {
  await db?.close();
});

test('a new event seeds exactly the canonical 16 widgets at canonical orders', async () => {
  const rows = await widgetRows();
  assert.equal(rows.length, 16, `expected 16 seeded widgets, got ${rows.length}`);

  const byType = new Map(rows.map((r) => [r.widget_type, r.display_order]));
  for (const [type, order] of CANONICAL_16) {
    assert.ok(byType.has(type), `missing seeded widget_type '${type}'`);
    assert.equal(byType.get(type), order, `'${type}' at order ${byType.get(type)}, expected ${order}`);
  }

  // No display_order collisions (the stale rebuild's our_love_story@14 bug).
  const orders = rows.map((r) => r.display_order);
  assert.equal(new Set(orders).size, orders.length, 'display_order collision in the seed');
});

test('the defensive backfill restores drifted events without touching healthy rows', async () => {
  // Simulate prod's drift: the two types the stale trigger never seeded.
  await db.query(
    `DELETE FROM public.invitation_widgets
     WHERE event_id = $1 AND widget_type IN ('what_to_bring', 'our_photos')`,
    [eventId],
  );
  assert.equal((await widgetRows()).length, 14, 'drift simulation should leave 14 rows');

  // Re-run the migration's backfill statement verbatim (it is idempotent).
  await db.query(
    `INSERT INTO public.invitation_widgets
       (event_id, widget_type, display_order, is_visible, is_always_on)
     SELECT e.event_id, w.widget_type, w.display_order, TRUE, w.is_always_on
     FROM public.events e
     CROSS JOIN (VALUES
       ('hero', 1, TRUE), ('greeting', 2, TRUE), ('qr_card', 3, TRUE),
       ('event_details', 4, FALSE), ('countdown', 5, FALSE), ('schedule', 6, FALSE),
       ('rsvp', 7, TRUE), ('venue_map', 8, FALSE), ('dress_code', 9, FALSE),
       ('photo_moments', 10, FALSE), ('your_photos', 11, FALSE),
       ('tier_comparison', 12, FALSE), ('special_message', 13, FALSE),
       ('what_to_bring', 14, FALSE), ('our_photos', 15, FALSE),
       ('our_love_story', 16, FALSE)
     ) AS w(widget_type, display_order, is_always_on)
     ON CONFLICT (event_id, widget_type) DO NOTHING`,
  );

  const healed = await widgetRows();
  assert.equal(healed.length, 16, 'backfill should restore to 16');
  const types = new Set(healed.map((r) => r.widget_type));
  assert.ok(types.has('what_to_bring') && types.has('our_photos'), 'both drifted types restored');
});
