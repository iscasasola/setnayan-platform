/**
 * Three events columns a signed-in person was refused — and the whole query
 * died with them.
 *
 * `public.events` revokes table-level SELECT and re-grants a per-column
 * allow-list, so PostgREST refuses the ENTIRE query when a select names one
 * withheld column. Three shipped surfaces did exactly that through the couple's
 * own session: the website editor (which then bounced them back to the
 * dashboard), the guest-camera switch (which rendered nothing at all, so the
 * button the owner asked for had never appeared), and the forced-date release
 * (which answered "nothing to do" and silently never released a date).
 *
 * ── 🪤 WHAT THIS FILE CAN AND CANNOT PROVE ──────────────────────────────────
 * The replay applies migrations in FILENAME order. `site_art_direction` carries
 * a prefix BELOW the lock-down, so in the replay it is added first and lands
 * inside the computed allow-list — it was already `true` here while production
 * answered `false`. Measured before this change:
 *
 *     column                      replay   prod
 *     site_art_direction           true    false   ← divergent
 *     papic_guest_capture_early    false   false
 *     date_forced_by_lock_of       false   false
 *     event_date (control)         true    true
 *     master_qr_token (control)    false   false
 *
 * So the site_art_direction assertions below are a REGRESSION GUARD ONLY: they
 * were green before the fix and prove nothing about production. The other two
 * columns are what the replay can honestly prove, and they were red before it.
 * Saying so is the point — the same shape as the manpower_gigs drift, where a
 * db test would have passed against a table production did not have.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
}, { timeout: 600000 });

after(async () => {
  await db?.close?.();
});

/** The three this change grants. */
const FIXED = ['site_art_direction', 'papic_guest_capture_early', 'date_forced_by_lock_of'];

/** Proved in the replay, not merely asked of the catalogue. */
async function canSelect(col: string): Promise<boolean> {
  await db.exec('SET ROLE authenticated');
  try {
    await db.query(`SELECT event_id, ${col} FROM public.events LIMIT 1`);
    return true;
  } catch {
    return false;
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
  }
}

async function hasPriv(role: string, col: string, priv: string): Promise<boolean> {
  const r = (await db.query(
    `SELECT has_column_privilege($1, 'public.events', $2, $3) AS ok`,
    [role, col, priv],
  )) as { rows: { ok: boolean }[] };
  const row = r.rows[0];
  assert.ok(row, `has_column_privilege returned no row for ${role}/${col}/${priv}`);
  return row.ok;
}

test('a signed-in person can READ all three — proved by selecting, not by asking', async () => {
  for (const col of FIXED) {
    assert.equal(await canSelect(col), true, `authenticated cannot select ${col}`);
  }
});

test('the control still fails, so the check above can fail', async () => {
  // If this ever passes, `canSelect` has stopped measuring anything and every
  // assertion in this file is vacuous.
  assert.equal(
    await canSelect('master_qr_token'),
    false,
    'master_qr_token became selectable — the pairing credential is a secret',
  );
});

test('anon gained nothing', async () => {
  // 🪤 DELIBERATELY NOT `FIXED`. In the replay `site_art_direction` sorts BELOW
  // the lock-down, so it landed inside the computed allow-list — which grants to
  // `authenticated, anon` alike. anon holds it here and does NOT hold it in
  // production; asserting `false` for it fails in the replay for a reason that
  // has nothing to do with this change. The migration itself carries the
  // stronger check (a before/after snapshot proving it moved anon not at all);
  // what the replay can honestly assert is the two non-divergent columns.
  for (const col of ['papic_guest_capture_early', 'date_forced_by_lock_of']) {
    assert.equal(
      await hasPriv('anon', col, 'SELECT'),
      false,
      `anon can now read ${col} — this fix widened a public read`,
    );
  }
});

test('the migration grants to authenticated and to nobody else', async () => {
  // The runtime check above cannot cover site_art_direction, so cover the ACT:
  // every GRANT this migration performs names `authenticated` alone.
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(
    join(here, '..', '..', '..', '..', 'supabase', 'migrations',
         '20271179873885_a_column_the_couple_cannot_read.sql'),
    'utf8',
  ).replace(/^\s*--.*$/gm, '');

  const grants = [...sql.matchAll(/GRANT\s+SELECT\s*\([^)]*\)\s+ON\s+public\.events\s+TO\s+([^;]+);/gi)]
    .map((m) => (m[1] ?? '').trim());
  assert.equal(grants.length, 3, `expected 3 grants, found ${grants.length}`);
  for (const target of grants) {
    assert.equal(target, 'authenticated', `a grant targets "${target}", not authenticated alone`);
  }
});

test('the deliberate write-lock on the guest-camera switch survives the read-fix', async () => {
  // 20271121501756 withheld UPDATE on purpose: events UPDATE RLS is row-level,
  // so a writable column is writable by anyone who can update the row at all.
  // That reasoning is about WRITING. Granting the read must not disturb it.
  for (const role of ['authenticated', 'anon']) {
    assert.equal(
      await hasPriv(role, 'papic_guest_capture_early', 'UPDATE'),
      false,
      `${role} can now write papic_guest_capture_early`,
    );
  }
});

test('the three genuine secrets are untouched', async () => {
  for (const col of [
    'master_qr_token',
    'photo_delivery_oauth_token_encrypted',
    'photo_delivery_oauth_expires_at',
  ]) {
    for (const role of ['authenticated', 'anon']) {
      assert.equal(await hasPriv(role, col, 'SELECT'), false, `${role} can read ${col}`);
    }
  }
});

test('the guest-lock deny-sets still deny', async () => {
  // A blanket re-grant would have quietly undone SEC-2b. Assert a sample of the
  // private-details columns are still off the table for a user session.
  for (const col of [
    'partner_a_birth_date',
    'estimated_budget_centavos',
    'wizard_state',
    'signature_details',
    'honoree_label',
  ]) {
    assert.equal(
      await hasPriv('authenticated', col, 'SELECT'),
      false,
      `${col} became readable — the guest lock was undone`,
    );
  }
});
