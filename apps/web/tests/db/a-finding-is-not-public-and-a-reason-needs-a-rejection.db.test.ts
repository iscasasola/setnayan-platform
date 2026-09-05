/**
 * MB21's two columns, against the REPLAYED production schema.
 *
 * Two claims, and the first one is the one a session gets wrong:
 *
 *   1. A NEW COLUMN INHERITS THE PUBLIC GRANT. Supabase grants table-level ALL
 *      on every public table, so `ADD COLUMN` alone hands `anon` and
 *      `authenticated` SELECT/INSERT/UPDATE on it. `moodboard_library_assets`
 *      has a PUBLIC read policy and the anon key ships in the page source, so
 *      the inherited grant would publish the full transcribed text of every
 *      photograph and a reviewer's private note about a shop's work — and,
 *      worse, would let a supplier clear their own `rejected_at` with one HTTP
 *      request, because RLS is row-level and can never constrain a VALUE.
 *
 *   2. A REJECTION AND ITS REASON ARE ONE FACT. `rejected_at` with no reason is
 *      the defect MB21 exists to remove, reintroduced one UPDATE at a time; a
 *      reason with no timestamp is a sentence shown to a supplier about a
 *      refusal that never happened. The CHECK makes both unrepresentable.
 *
 * ── 🪤 WHY THE PRIVILEGE HALF IS PROVED BY DOING, NOT BY ASKING ─────────────
 * `has_column_privilege` is what the migration's own post-conditions assert,
 * so a test that only re-asks it agrees with the migration by construction. The
 * grant assertions below therefore SET ROLE and try the statement, and the
 * suite asserts up front that the role it becomes is not the table owner —
 * this repo has shipped a vacuous RLS test twice, from a connection that owned
 * the table and skipped RLS entirely.
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

const CLOSED = ['screen_findings', 'rejected_at', 'rejection_reason'] as const;

async function asRole<T>(role: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
  }
}

/** Did the statement run, or was it refused? Never swallows into a pass. */
async function attempt(sql: string): Promise<{ ok: boolean; message: string }> {
  try {
    await db.query(sql);
    return { ok: true, message: '' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

test('the harness is not vacuous — the roles exist and do not own the table', async () => {
  for (const role of ['anon', 'authenticated']) {
    const owns = await asRole(role, () =>
      db.query<{ owner: boolean }>(
        `SELECT pg_get_userbyid(c.relowner) = current_user AS owner
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'moodboard_library_assets'`,
      ),
    );
    assert.equal(
      owns.rows[0]?.owner,
      false,
      `${role} owns the table — every privilege assertion below would be vacuous`,
    );
  }
});

test('the three columns exist at all — a rename must fail loudly', async () => {
  const { rows } = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='moodboard_library_assets'
        AND column_name = ANY($1)`,
    [CLOSED as unknown as string[]],
  );
  assert.equal(rows.length, CLOSED.length, `found ${JSON.stringify(rows)}`);
});

test('⭐ THE GUARD · neither browser role can SELECT the screening internals', async () => {
  // Sabotage run: the migration's whole grant DO-block was commented out. Every
  // assertion below went RED — which is what the inherited table grant does on
  // its own, with no line of SQL required to cause it.
  for (const role of ['anon', 'authenticated']) {
    for (const col of CLOSED) {
      const res = await asRole(role, () =>
        attempt(`SELECT ${col} FROM public.moodboard_library_assets LIMIT 1`),
      );
      assert.equal(
        res.ok,
        false,
        `${role} could SELECT ${col} — a reviewer's private words on a table with a PUBLIC read policy`,
      );
      assert.match(res.message, /permission denied/i);
    }
  }
});

test('⭐ THE GUARD · a supplier cannot clear their own rejection', async () => {
  // The worse half. `moodboard_library_assets_vendor_insert` admits a vendor's
  // OWN row, and no policy constrains a column's VALUE — only the grant can.
  for (const col of CLOSED) {
    const res = await asRole('authenticated', () =>
      attempt(`UPDATE public.moodboard_library_assets SET ${col} = NULL`),
    );
    assert.equal(res.ok, false, `authenticated could UPDATE ${col}`);
    assert.match(res.message, /permission denied/i);
  }
});

test('MB11’s source_event_id denial survived the re-granted allow-list', async () => {
  // An allow-list computed from the full catalog instead of from LIVE
  // privileges would silently hand this back, re-opening MB11's quota bypass.
  for (const role of ['anon', 'authenticated']) {
    const res = await asRole(role, () =>
      attempt('SELECT source_event_id FROM public.moodboard_library_assets LIMIT 1'),
    );
    assert.equal(res.ok, false, `${role} regained source_event_id — MB11 undone`);
  }
});

test('the columns the gallery actually needs are still readable', async () => {
  // A mis-computed allow-list breaks uploads and the couple-facing picker
  // silently. This is the other half of the same measurement.
  for (const role of ['anon', 'authenticated']) {
    const res = await asRole(role, () =>
      attempt(
        `SELECT asset_id, asset_type, asset_subtype, label, storage_path, source,
                uploaded_by, approved_at, retired_at, created_at, vendor_profile_id,
                rights_warranted_at, rights_warranty_version
           FROM public.moodboard_library_assets LIMIT 1`,
      ),
    );
    assert.equal(res.ok, true, `${role} lost a column the gallery needs: ${res.message}`);
  }
});

test('the service role keeps all three — every write on this path is its', async () => {
  const res = await asRole('service_role', () =>
    attempt(
      `SELECT screen_findings, rejected_at, rejection_reason
         FROM public.moodboard_library_assets LIMIT 1`,
    ),
  );
  assert.equal(res.ok, true, res.message);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE PAIRING
   ══════════════════════════════════════════════════════════════════════════ */

async function insertAsset(extra: string): Promise<{ ok: boolean; message: string }> {
  return attempt(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, label, storage_path, source ${extra ? ', ' + extra.split('=')[0].trim() : ''})
     VALUES ('venue_scene', 'x', 'moodboard-library/x.jpg', 'internet_placeholder'
       ${extra ? ', ' + extra.split('=').slice(1).join('=').trim() : ''})`,
  );
}

test('⭐ THE GUARD · a rejection cannot exist without a reason', async () => {
  // Sabotage run: the CHECK was dropped. This went GREEN — which is exactly
  // what "retire it and say nothing" looked like before MB21, and why the
  // constraint rather than a convention is the fix.
  const res = await insertAsset("rejected_at = now()");
  assert.equal(res.ok, false, 'a bare rejected_at must be refused');
  assert.match(res.message, /moodboard_library_assets_rejection_paired/);
});

test('a reason cannot exist without a rejection', async () => {
  const res = await insertAsset("rejection_reason = 'there is a phone number on the sign'");
  assert.equal(res.ok, false, 'a reason with no refusal is a sentence about nothing');
  assert.match(res.message, /moodboard_library_assets_rejection_paired/);
});

test('a BLANK reason beside a rejection is refused too', async () => {
  // `reject, reason: '   '` satisfies a naive pairing and renders as an empty
  // red box — a refusal the supplier still cannot act on.
  const res = await attempt(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, label, storage_path, source, rejected_at, rejection_reason)
     VALUES ('venue_scene','x','moodboard-library/x.jpg','internet_placeholder', now(), '   ')`,
  );
  assert.equal(res.ok, false);
  assert.match(res.message, /moodboard_library_assets_rejection_paired/);
});

test('both together are accepted, and neither is the DEFAULT state', async () => {
  const both = await attempt(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, label, storage_path, source, rejected_at, rejection_reason)
     VALUES ('venue_scene','x','moodboard-library/x.jpg','internet_placeholder',
             now(), 'there is a phone number on the sign behind the cake')`,
  );
  assert.equal(both.ok, true, both.message);

  const neither = await attempt(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, label, storage_path, source)
     VALUES ('venue_scene','y','moodboard-library/y.jpg','internet_placeholder')`,
  );
  assert.equal(neither.ok, true, neither.message);

  const { rows } = await db.query<{ rejected_at: string | null; screen_findings: unknown }>(
    `SELECT rejected_at, screen_findings FROM public.moodboard_library_assets
      WHERE label = 'y'`,
  );
  assert.equal(rows[0]?.rejected_at, null, 'a fresh photo is not born rejected');
  assert.equal(rows[0]?.screen_findings, null, 'a clean photo stores no findings');
});

test('🔑 NEITHER NEW COLUMN IS REACHED BY AN ON DELETE SET NULL', async () => {
  // 20271202522764 records what a CHECK over a SET NULL column costs: the
  // cascade UPDATE violates the check, Postgres fails the PARENT delete, and
  // deleting a celebration — hence an account, hence RA 10173 erasure — is
  // blocked by a supplier's photograph. Checked, not assumed.
  const { rows } = await db.query<{ column_name: string }>(
    `SELECT a.attname AS column_name
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN unnest(c.conkey) AS k(attnum) ON true
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE n.nspname = 'public'
        AND t.relname = 'moodboard_library_assets'
        AND c.contype = 'f'
        AND c.confdeltype = 'n'`,
  );
  const setNullCols = new Set(rows.map((r) => r.column_name));
  for (const col of CLOSED) {
    assert.ok(!setNullCols.has(col), `${col} is both CHECKed and SET NULL — erasure hazard`);
  }
});
