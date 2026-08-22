/**
 * GUARD — the delete lane is closed, and no event pointer dangles.
 *
 * Three rules, all measured in production before they were written:
 *
 * 1 · `authenticated` could DELETE `public.events` straight through PostgREST
 *     (`has_table_privilege` = TRUE). That path runs the BEFORE DELETE trigger
 *     but SKIPS the R2 media sweep and the paid-supplier consent gate, because
 *     both live in application code. Photographs orphaned forever; a supplier
 *     who was paid never asked.
 *
 * 2 · `event_software_activations_v2.event_id` and `couple_briefs.event_id` had
 *     NO foreign key. Prod already held **17 orphan rows** — a pointer to a
 *     celebration that no longer exists, with nothing to notice it.
 *
 * 3 · `couple_briefs` takes SET NULL rather than CASCADE, because
 *     `vendor_bid_submissions` cascades off the brief: a cascade would destroy
 *     SUPPLIERS' BIDS when a couple deletes a celebration, which is the exact
 *     inverse of the owner's 2026-08-21 rule.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('a session role cannot DELETE an event', async () => {
  for (const role of ['authenticated', 'anon']) {
    const { rows } = await db.query<{ can: boolean }>(
      `SELECT has_table_privilege($1, 'public.events', 'DELETE') AS can`,
      [role],
    );
    assert.equal(
      rows[0]!.can,
      false,
      `${role} can still DELETE events through PostgREST. That path skips the ` +
        'photo sweep and the paid-supplier gate — both live in app code — so it ' +
        'orphans photographs and walks past a supplier who must first agree.',
    );
  }
});

test('service_role keeps DELETE — every real path uses it', async () => {
  // The revoke must not break the product. All five app delete sites and the
  // draft sweep go through service_role.
  const { rows } = await db.query<{ can: boolean }>(
    `SELECT has_table_privilege('service_role', 'public.events', 'DELETE') AS can`,
  );
  assert.equal(rows[0]!.can, true, 'the revoke took service_role with it');
});

test('both dangling event columns now have a real key', async () => {
  const { rows } = await db.query<{ tbl: string; rule: string }>(
    `SELECT c.relname AS tbl, con.confdeltype::text AS rule
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.events'::regclass
        AND c.relname IN ('event_software_activations_v2', 'couple_briefs')
      ORDER BY 1`,
  );
  const byTable = new Map(rows.map((r) => [r.tbl, r.rule]));
  assert.equal(
    byTable.get('event_software_activations_v2'),
    'c',
    'event_software_activations_v2 has no CASCADE key — deleting an event ' +
      'leaves its rows pointing at nothing, as 17 prod rows already did',
  );
  assert.equal(
    byTable.get('couple_briefs'),
    'n',
    'couple_briefs must be SET NULL, never CASCADE: vendor_bid_submissions ' +
      'cascades off the brief, so CASCADE would destroy suppliers’ bids when a ' +
      'couple deletes their celebration',
  );
});

test('deleting an event takes the activation row and spares the bids', async () => {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name)
     VALUES ('orphan-probe', 'birthday', 'Orphan Probe') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  const vend = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name, business_slug)
     VALUES ('Orphan Probe Co', 'orphan-probe-co') RETURNING vendor_profile_id`,
  );
  await db.query(
    `INSERT INTO public.event_software_activations_v2 (event_id, vendor_id, service_code)
     VALUES ($1, $2, (SELECT service_code FROM public.platform_retail_catalog_v2 LIMIT 1))`,
    [eventId, vend.rows[0]!.vendor_profile_id],
  );
  await db.query(
    `INSERT INTO public.couple_briefs
       (event_id, brief_title, brief_body, category, estimated_budget_range,
        brief_valuation_tier, token_cost_per_submission)
     -- ⚠ 'under_20k' is load-bearing: derive_brief_token_cost() is a CASE with
     -- no ELSE, so any unlisted budget range raises "case not found". A latent
     -- defect in a dead table (no reader, no writer) — noted, not fixed here.
     VALUES ($1, 'Orphan probe brief', 'A brief body long enough to clear the thirty character minimum.', 'catering', 'under_20k', 1, 0)`,
    [eventId],
  );

  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

  assert.equal(
    (
      await db.query(
        `SELECT 1 FROM public.event_software_activations_v2 WHERE event_id = $1`,
        [eventId],
      )
    ).rows.length,
    0,
    'the activation row survived, still pointing at a deleted celebration',
  );
  const briefs = await db.query<{ event_id: string | null }>(
    `SELECT event_id FROM public.couple_briefs`,
  );
  assert.equal(briefs.rows.length, 1, 'the brief row was destroyed — a cascade ' +
    'here would take suppliers’ bids with it');
  assert.equal(briefs.rows[0]!.event_id, null, 'the brief kept a dangling event id');
});

test('the orphan cleanup runs BEFORE the constraint is added', () => {
  /*
    ⚠ THIS ONE IS A SOURCE CHECK, AND THE COMMENT EXPLAINS WHY IT HAS TO BE.

    The PGlite replay starts from an EMPTY database, so it holds no orphans and
    removing the cleanup changes nothing there — measured: that sabotage stayed
    GREEN while every other one went red. The rows it protects exist only in
    production, where 17 already sat in event_software_activations_v2 before
    this migration was written.

    `ADD CONSTRAINT ... REFERENCES` is validated against existing rows and
    HARD-FAILS on the first orphan. Adding the key without clearing them first
    cannot deploy — and it would take the whole release with it, not just this
    migration. Ordering is the entire safety property, so ordering is what is
    pinned.
  */
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(
    resolve(
      here,
      '../../../../supabase/migrations/20271151165474_event_id_orphans_get_a_real_link.sql',
    ),
    'utf8',
  );
  const cleanupAt = sql.indexOf('DELETE FROM public.event_software_activations_v2');
  const constraintAt = sql.indexOf('ADD CONSTRAINT event_software_activations_v2_event_id_fkey');
  assert.ok(cleanupAt > 0, 'the orphan cleanup is gone — the migration will hard-fail in prod');
  assert.ok(constraintAt > 0, 'the constraint is gone');
  assert.ok(
    cleanupAt < constraintAt,
    'the constraint is added BEFORE the orphans are cleared. Postgres validates ' +
      'the key against existing rows, so this hard-fails on prod’s 17 orphans and ' +
      'takes the release with it.',
  );
});
