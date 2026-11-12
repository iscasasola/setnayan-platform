/**
 * THE EARLY SHOPS RENEW ON 30 MARCH 2027 — migration 20271341349934 (owner, 12 Nov 2026: "Yes, their due is on
 * March 30, 2027"; one renewal day for every verified shop, `lib/papers-due.ts`).
 *
 * The replay applies the move to an empty table, which proves nothing, so its BACKFILL block is re-run here from the
 * migration's own text against fixtures:
 *   · a shop on the old 12 March 2027 day (the 2026-09-11 backfill's) moves to the END of 30 March 2027 Manila, and its
 *     vouch row with it, with one audit row;
 *   · a founders shop and an approved shop on other days are untouched — the move is by the old day, to the second;
 *   · the listing columns never move;
 *   · a second run moves nothing (idempotent).
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { EARLY_SHOPS_PAPERS_DUE_ISO } from '../../lib/verified-badge';

let replay: ReplayResult;
let db: PGlite;

const OLD_DAY = '2027-03-12T15:59:59.000Z';
const OTHER_DAY = '2027-03-30T15:59:59.000Z';
const APPROVED_DAY = '2027-08-08T02:16:42.000Z';

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
}

async function verifiedShop(email: string, name: string, due: string): Promise<string> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [email],
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
    [u.rows[0]!.id, name],
  );
  const vid = vp.rows[0]!.vendor_profile_id;
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified', public_visibility = 'verified',
            last_verified_at = now(), next_renewal_due_at = $2
      WHERE vendor_profile_id = $1`,
    [vid, due],
  );
  return vid;
}

async function vouch(vid: string, until: string): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_verification_bypasses (vendor_profile_id, granted_at, expires_at, reason, updated_at)
     VALUES ($1, now(), $2, 'fixture vouch for the 30 March move', now())`,
    [vid, until],
  );
}

type Row = { due: string | null; vouch: string | null; state: string; vis: string };
async function rowOf(vid: string): Promise<Row> {
  await reset();
  const r = await db.query<{ due: Date | null; vouch: Date | null; state: string; vis: string }>(
    `SELECT vp.next_renewal_due_at AS due, b.expires_at AS vouch,
            vp.verification_state::text AS state, vp.public_visibility::text AS vis
       FROM public.vendor_profiles vp
       LEFT JOIN public.vendor_verification_bypasses b ON b.vendor_profile_id = vp.vendor_profile_id
      WHERE vp.vendor_profile_id = $1`,
    [vid],
  );
  const x = r.rows[0]!;
  return {
    due: x.due ? new Date(x.due).toISOString() : null,
    vouch: x.vouch ? new Date(x.vouch).toISOString() : null,
    state: x.state,
    vis: x.vis,
  };
}

const MIGRATION_FILE = readdirSync(MIGRATIONS_DIR).find((n) => n.endsWith('_early_shops_renew_on_march_30.sql'));
function moveSql(): string {
  assert.ok(MIGRATION_FILE, 'the 30 March migration is missing');
  const text = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE!), 'utf8');
  const a = text.indexOf('-- BACKFILL:BEGIN');
  const b = text.indexOf('-- BACKFILL:END');
  assert.ok(a >= 0 && b > a, 'the BACKFILL markers are gone — this test would re-run nothing');
  return text.slice(a, b);
}

const V = { early: '', founders: '', approved: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  V.early = await verifiedShop('march30-early@test.test', 'Early Shop', OLD_DAY);
  await vouch(V.early, OLD_DAY);
  V.founders = await verifiedShop('march30-founders@test.test', 'Founders Shop', OTHER_DAY);
  await vouch(V.founders, OTHER_DAY);
  V.approved = await verifiedShop('march30-approved@test.test', 'Papered Shop', APPROVED_DAY);
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the code and the migration name the same day — the end of 30 March 2027 in Manila', () => {
  assert.equal(EARLY_SHOPS_PAPERS_DUE_ISO, '2027-03-30T15:59:59.000Z');
  const text = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE!), 'utf8');
  for (const m of text.matchAll(/SET (?:next_renewal_due_at|expires_at) = TIMESTAMPTZ '([^']+)'/g)) {
    assert.equal(new Date(m[1]!.replace(' ', 'T').replace(/\+08$/, '+08:00')).toISOString(), EARLY_SHOPS_PAPERS_DUE_ISO);
  }
});

test('an early shop moves from 12 to 30 March 2027 with its vouch row; the others and the listing never move', async () => {
  await reset();
  const auditBefore = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.admin_audit_log WHERE action = 'vendor_badge_deadline_moved'`,
  );
  await db.exec(moveSql());
  const early = await rowOf(V.early);
  assert.equal(early.due, EARLY_SHOPS_PAPERS_DUE_ISO, 'the early shop’s badge day did not move');
  assert.equal(early.vouch, EARLY_SHOPS_PAPERS_DUE_ISO, 'the early shop’s vouch row did not move with it');
  assert.deepEqual([early.state, early.vis], ['verified', 'verified'], 'the move touched the listing');
  assert.equal((await rowOf(V.founders)).due, OTHER_DAY);
  assert.equal((await rowOf(V.approved)).due, APPROVED_DAY, 'a day nobody asked to move was moved');
  const auditAfter = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.admin_audit_log WHERE action = 'vendor_badge_deadline_moved'`,
  );
  assert.equal(auditAfter.rows[0]!.n - auditBefore.rows[0]!.n, 1, 'one audit row per moved shop');
});

test('a second run moves nothing — idempotent', async () => {
  await reset();
  const n = async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.admin_audit_log WHERE action = 'vendor_badge_deadline_moved'`))
      .rows[0]!.n;
  const was = await n();
  await db.exec(moveSql());
  assert.equal(await n(), was);
  assert.equal((await rowOf(V.early)).due, EARLY_SHOPS_PAPERS_DUE_ISO);
});
