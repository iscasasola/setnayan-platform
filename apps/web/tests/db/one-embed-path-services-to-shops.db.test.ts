/**
 * ONE EMBED PATH FROM A SERVICE CARD TO ITS SHOP — against a replayed schema.
 *
 * 🛑 Prod incident 2026-11-12: /suppliers drew "Something on our end didn't work." and /explore failed the same read,
 * because …_service_card_opens.sql gave a ledger foreign keys to BOTH vendor_services and vendor_profiles. PostgREST
 * reads such a table as a many-to-many junction, so every `vendor_services → vendor_profiles(...)` embed in the app
 * got two candidate relationships and failed with PGRST201. The fix (…_service_card_opens_one_embed_path.sql)
 * dropped the ledger's shop FK. This keeps it dropped, and catches the NEXT table that adds the same pair of keys.
 *
 * The rule, as PostgREST applies it: a table whose foreign keys to vendor_services AND vendor_profiles both sit inside
 * its primary key is a junction — a second path. Want both? Keep vendor_service_id as the key and carry the shop as a
 * plain column — the service already names its shop.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});
after(async () => {
  await replay?.db.close();
});

// PostgREST's junction rule: FKs to both tables whose columns all sit inside its PRIMARY KEY. Measured
// 2026-11-12: guest_saved_vendors has both FKs inside a UNIQUE key and PostgREST did NOT list it as a path.
// (A table that merely references both — a package, a review — is not a junction and is fine.)
const BOTH_KEYS = `
  SELECT DISTINCT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_constraint fs ON fs.conrelid = c.oid AND fs.contype = 'f' AND fs.confrelid = 'public.vendor_services'::regclass
    JOIN pg_constraint fp ON fp.conrelid = c.oid AND fp.contype = 'f' AND fp.confrelid = 'public.vendor_profiles'::regclass
    JOIN pg_constraint k  ON k.conrelid = c.oid AND k.contype = 'p'
                         AND fs.conkey <@ k.conkey AND fp.conkey <@ k.conkey
   WHERE c.relname NOT IN ('vendor_services', 'vendor_profiles')
   ORDER BY 1`;

test('no table carries foreign keys to both vendor_services and vendor_profiles (a second PostgREST embed path)', async () => {
  const rows = (await replay.db.query<{ table_name: string }>(BOTH_KEYS)).rows.map((r) => r.table_name);
  console.log(`tables with FKs to both vendor_services and vendor_profiles: ${rows.length} ${JSON.stringify(rows)}`);
  assert.deepEqual(
    rows,
    [],
    `These tables make every vendor_services → vendor_profiles embed ambiguous (PGRST201, the 2026-11-12 /suppliers outage). Drop the vendor_profiles FK and carry the shop as a plain column: ${rows.join(', ')}`,
  );
});

test('the opens ledger still deletes with its card (the kept vendor_services FK cascades)', async () => {
  const r = await replay.db.query<{ n: number }>(`
    SELECT count(*)::int AS n FROM pg_constraint
     WHERE conrelid = 'public.vendor_service_card_view_days'::regclass AND contype = 'f'
       AND confrelid = 'public.vendor_services'::regclass AND confdeltype = 'c'`);
  assert.equal(r.rows[0]!.n, 1);
});
