/**
 * OPEN-BROWSE PR4 — inert schema (migration 20270919912384).
 *
 * Council build plan §3 row 4 (Guest_Event_Website_Open_Browse_Council_Verdict
 * _2026-07-22.md): two columns, ZERO readers, DEFAULT FALSE is the go-live
 * hold under auto-apply-on-merge. Proven against the FULL replayed prod schema
 * (every migration, in order, in an in-memory PGlite):
 *
 *   • events.website_open_browse defaults FALSE and rejects NULL on a NEW event;
 *   • the prod path: ADD COLUMN NOT NULL DEFAULT FALSE populates PRE-EXISTING
 *     events with FALSE (never NULL) — reproduced by drop-and-re-ALTER against
 *     a populated table, the exact scenario prod's ~4 events hit at apply time;
 *   • invitation_widgets.mode defaults 'auto' on every trigger-seeded row;
 *   • the seed is the full canonical 16 (GATED — the 20270919679722 reconcile
 *     is on the replay base; a future seed regression fails here loudly);
 *   • the backfill maps is_visible = FALSE → mode = 'hidden' (proven by
 *     re-applying the idempotent migration file against seeded rows — the
 *     same UPDATE that ran against prod's rows at apply time);
 *   • the backfill's `AND is_always_on = FALSE` guard holds: an always-on row
 *     forced to is_visible=FALSE is never tagged hidden (always-on renders
 *     regardless — the invariant mode must not break once it's authoritative);
 *   • the re-run guard (AND mode = 'auto') never clobbers a later couple
 *     decision ('shown' survives a re-apply);
 *   • the CHECK rejects anything outside auto|shown|hidden.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';

const MIGRATION_FILE = '20270919912384_open_browse_inert_schema.sql';

/** The authoritative 16-type list (WIDGET_TYPES in lib/invitation-widgets.ts,
 *  mirrored by the CHECK from 20270125028817). */
const CANONICAL_16 = [
  'hero',
  'greeting',
  'qr_card',
  'event_details',
  'countdown',
  'schedule',
  'rsvp',
  'venue_map',
  'dress_code',
  'photo_moments',
  'your_photos',
  'our_photos',
  'tier_comparison',
  'special_message',
  'what_to_bring',
  'our_love_story',
] as const;

let replay: ReplayResult;
let db: PGlite;
let eventId: string;

async function widgetRows(): Promise<Array<{ widget_type: string; is_visible: boolean; mode: string }>> {
  const r = await db.query<{ widget_type: string; is_visible: boolean; mode: string }>(
    `SELECT widget_type, is_visible, mode FROM public.invitation_widgets
     WHERE event_id = $1 ORDER BY widget_type`,
    [eventId],
  );
  return r.rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Open Browse Schema Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
});

after(async () => {
  await db?.close();
});

test('events.website_open_browse defaults FALSE (the go-live hold) and rejects NULL', async () => {
  const r = await db.query<{ website_open_browse: boolean }>(
    `SELECT website_open_browse FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.website_open_browse, false, 'a fresh event is NOT open-browse');

  await assert.rejects(
    db.query(`UPDATE public.events SET website_open_browse = NULL WHERE event_id = $1`, [eventId]),
    /null|not-null/i,
    'the column is NOT NULL — no tri-state ambiguity on the switch',
  );
});

test('ADD COLUMN NOT NULL DEFAULT FALSE populates PRE-EXISTING events with FALSE (the prod path)', async () => {
  // The replay applies this migration against an EMPTY events table, so the
  // cases above only exercise the column default on a NEW insert. Prod's
  // reality is ~4 events already present when the ALTER runs. Reproduce that
  // exactly: an event exists, DROP the column, then re-run the migration's
  // idempotent ALTER against the now-populated table and assert the
  // pre-existing row is FALSE (never NULL) and the ALTER did not error.
  const r0 = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.events`);
  assert.ok(r0.rows[0]!.n > 0, 'at least one pre-existing event stands in for prod’s rows');

  await db.exec(`ALTER TABLE public.events DROP COLUMN website_open_browse`);
  await db.exec(
    `ALTER TABLE public.events
       ADD COLUMN IF NOT EXISTS website_open_browse BOOLEAN NOT NULL DEFAULT FALSE`,
  );

  const r = await db.query<{ website_open_browse: boolean | null; n: number }>(
    `SELECT bool_and(website_open_browse) AS website_open_browse, count(*)::int AS n
     FROM public.events`,
  );
  assert.equal(r.rows[0]!.website_open_browse, false, 'every pre-existing event backfilled to FALSE, not NULL');
  const nulls = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.events WHERE website_open_browse IS NULL`,
  );
  assert.equal(nulls.rows[0]!.n, 0, 'no pre-existing event left NULL by the ADD COLUMN');
});

test('invitation_widgets.mode defaults to auto on every trigger-seeded row', async (t) => {
  const rows = await widgetRows();
  assert.ok(rows.length > 0, 'the events INSERT trigger seeded widget rows');
  for (const row of rows) {
    assert.equal(row.mode, 'auto', `${row.widget_type} seeds at mode=auto`);
    assert.equal(row.is_visible, true, `${row.widget_type} seeds visible (legacy column untouched)`);
  }

  // --- Council §3 row 4 sanity check: the seed is the full canonical 16. ---
  // Migration 20270919679722 (the widget-seed reconcile, merged just before
  // this PR) restored populate_default_invitation_widgets() to all 16 types.
  // With that on the replay base the seed is complete, so this is now a GATED
  // invariant, not a diagnostic: any future regression that drops the seed
  // (e.g. another CREATE OR REPLACE from a stale list) fails here loudly.
  const seeded = new Set(rows.map((r) => r.widget_type));
  for (const wt of seeded) {
    assert.ok(
      (CANONICAL_16 as readonly string[]).includes(wt),
      `seeded type ${wt} is in the canonical 16`,
    );
  }
  const missing = CANONICAL_16.filter((wt) => !seeded.has(wt));
  t.diagnostic(`seed trigger populated ${seeded.size}/16 canonical widget types`);
  assert.equal(missing.length, 0, `seed trigger missing canonical types: ${missing.join(', ') || '(none)'}`);
  assert.equal(seeded.size, 16, 'seed trigger populates the full canonical 16 (post-20270919679722 reconcile)');
});

test('backfill: is_visible=FALSE rows get mode=hidden when the migration (re-)applies', async () => {
  // Simulate the pre-migration prod state the backfill exists for: rows a
  // couple deliberately hid via the legacy editor. The replay applied the
  // migration against an empty table, so re-apply the SAME idempotent file
  // against seeded rows — the identical UPDATE that ran on prod's data.
  await db.query(
    `UPDATE public.invitation_widgets SET is_visible = FALSE
     WHERE event_id = $1 AND widget_type IN ('dress_code', 'tier_comparison')`,
    [eventId],
  );

  const pre = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.invitation_widgets
     WHERE is_visible = FALSE AND mode = 'auto'`,
  );
  assert.equal(pre.rows[0]!.n, 2, 'two deliberate hides await the backfill');

  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8');
  await db.exec(sql);

  const rows = await widgetRows();
  const byType = new Map(rows.map((r) => [r.widget_type, r]));
  assert.equal(byType.get('dress_code')!.mode, 'hidden', 'deliberate hide survives as mode=hidden');
  assert.equal(byType.get('tier_comparison')!.mode, 'hidden', 'deliberate hide survives as mode=hidden');

  const hidden = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.invitation_widgets
     WHERE mode = 'hidden' AND event_id = $1`,
    [eventId],
  );
  assert.equal(hidden.rows[0]!.n, 2, 'backfill touched exactly this event’s 2 hidden rows');

  for (const row of rows) {
    if (row.widget_type === 'dress_code' || row.widget_type === 'tier_comparison') continue;
    assert.equal(row.mode, 'auto', `${row.widget_type} stays auto — visible rows untouched`);
  }
});

test('backfill guard: an always-on row is never tagged hidden, even at is_visible=FALSE', async () => {
  // The always-on invariant: hero/greeting/qr_card/rsvp render REGARDLESS of
  // is_visible (lib/invitation-widgets.ts widgetShouldRender), so the backfill
  // must skip them (its `AND is_always_on = FALSE` guard). The app blocks
  // hiding always-on rows, so this is a latent path — assert the guard holds
  // directly by forcing the state the app would never produce.
  await db.query(
    `UPDATE public.invitation_widgets SET is_visible = FALSE, mode = 'auto'
     WHERE event_id = $1 AND is_always_on = TRUE`,
    [eventId],
  );
  const total = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.invitation_widgets
     WHERE event_id = $1 AND is_always_on = TRUE`,
    [eventId],
  );
  assert.ok(total.rows[0]!.n > 0, 'fixture has always-on rows to exercise the guard');

  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8');
  await db.exec(sql);

  const wronglyHidden = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.invitation_widgets
     WHERE event_id = $1 AND is_always_on = TRUE AND mode = 'hidden'`,
    [eventId],
  );
  assert.equal(wronglyHidden.rows[0]!.n, 0, 'the backfill skipped every always-on row');
});

test('re-run guard: a later couple decision (shown) is never clobbered by a re-apply', async () => {
  // Post-PR9 scenario: couple force-shows a section whose legacy flag is
  // still FALSE. The backfill's `AND mode = 'auto'` guard must skip it.
  await db.query(
    `UPDATE public.invitation_widgets SET mode = 'shown'
     WHERE event_id = $1 AND widget_type = 'dress_code'`,
    [eventId],
  );

  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8');
  await db.exec(sql);

  const r = await db.query<{ mode: string }>(
    `SELECT mode FROM public.invitation_widgets
     WHERE event_id = $1 AND widget_type = 'dress_code'`,
    [eventId],
  );
  assert.equal(r.rows[0]!.mode, 'shown', 'the shown decision survives an idempotent re-apply');
});

test('the CHECK rejects garbage modes', async () => {
  await assert.rejects(
    db.query(
      `UPDATE public.invitation_widgets SET mode = 'garbage'
       WHERE event_id = $1 AND widget_type = 'hero'`,
      [eventId],
    ),
    /invitation_widgets_mode_check|check constraint/i,
    'only auto|shown|hidden pass the named CHECK',
  );
});
