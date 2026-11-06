/**
 * THE LOAD-TIME LOG — the database half (migration 20271270180398, owner
 * 2026-10-16). Run against the replayed schema:
 *
 *   • the REAL ingest shaping (`loadsFromWire` + the route-pattern matcher) →
 *     `record_load_timings` → rows land, with the build SHA and signed-in flag
 *     the SERVER stamps;
 *   • a route carrying an id, an email, a query or a token is refused by the
 *     table's own CHECK — row by row, never the whole batch;
 *   • rows older than 30 days are trimmed as new ones are written;
 *   • 🔒 ADMIN ONLY: no browser session — anon, a signed-in person, not even an
 *     admin's own session — can read, write or call the RPC. The admin reads
 *     through the service role behind requireAdmin() (held in
 *     lib/telemetry/the-load-time-log.test.ts). Every refusal has its positive
 *     control: the service role does the same thing and succeeds.
 *   • platform_settings.load_time_targets exists, defaults to {} (→ every page
 *     on the 1.5 s default), and refuses a non-object.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

import { loadsFromWire, targetFor, coerceTargets } from '@/lib/telemetry/load-timing';
import { makeRouteMatcher } from '@/lib/telemetry/route-pattern';
import { normalizePath } from '@/lib/telemetry/fault-normalize';
import screens from '@/lib/ugat/screens.generated.json';

let replay: ReplayResult;
let db: PGlite;
let adminUser = '';

const SHA = 'cccccccc3333333333333333333333333333cccc';
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const match = makeRouteMatcher((screens as { screens: Array<{ route: string }> }).screens.map((s) => s.route));
const toPattern = (p: string) => match(normalizePath(p));

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function as<T>(role: 'service_role' | 'anon' | 'authenticated', fn: () => Promise<T>, uid: string | null = null): Promise<T> {
  await setRole(role);
  if (uid) await setAuthUid(db, uid);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function record(rows: unknown, signedIn = true): Promise<number> {
  return as('service_role', async () => {
    const r = await db.query<{ n: number }>(`SELECT public.record_load_timings($1::jsonb, $2, $3) AS n`, [
      JSON.stringify(rows),
      SHA,
      signedIn,
    ]);
    return r.rows[0]!.n;
  });
}
async function count(): Promise<number> {
  return Number((await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.app_load_timings`)).rows[0]!.n);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  adminUser = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('loads-admin@loads.test', '{}'::jsonb) RETURNING id`,
    )
  ).rows[0]!.id;
  await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [adminUser]);
});

after(async () => {
  await db?.close();
});

test('a browser’s batch, through the real ingest shaping, lands as route patterns with the server’s stamp', async () => {
  const before = await count();
  const rows = loadsFromWire(
    [
      { kind: 'nav', route: `/dashboard/${UUID}/guests`, total_ms: 2300, server_ms: 900, download_ms: 400, render_ms: 1000, device: 'phone', connection: '4g', weight: 1 },
      { kind: 'page', route: '/maria-and-jose', total_ms: 600, lcp_ms: 600, ttfb_ms: 200, device: 'desktop', weight: 10 },
    ],
    toPattern,
  );
  assert.equal(rows.length, 2);
  assert.equal(await record(rows), 2);
  assert.equal(await count(), before + 2);
  const got = (
    await db.query<{ route: string; build_sha: string; signed_in: boolean; weight: number; total_ms: number }>(
      `SELECT route, build_sha, signed_in, weight, total_ms FROM public.app_load_timings ORDER BY id DESC LIMIT 2`,
    )
  ).rows;
  assert.deepEqual(got.map((r) => r.route).sort(), ['/[slug]', '/dashboard/[eventId]/guests']);
  for (const r of got) {
    assert.equal(r.build_sha, SHA);
    assert.equal(r.signed_in, true);
  }
});

test('🔒 a raw URL, an id, an email or a token cannot be stored — the CHECK refuses that row, the batch still lands', async () => {
  const before = await count();
  const n = await record([
    { kind: 'nav', route: `/dashboard/${UUID}/guests`, total_ms: 2000, device: 'phone' },
    { kind: 'nav', route: '/dashboard/guests?id=12345', total_ms: 2000, device: 'phone' },
    { kind: 'nav', route: '/u/maria@example.com', total_ms: 2000, device: 'phone' },
    { kind: 'nav', route: 'https://setnayan.com/dashboard', total_ms: 2000, device: 'phone' },
    { kind: 'nav', route: '/claim/eyJhbGciOiJIUzI1NiJ9abcdefghijklmnopqrstuv', total_ms: 2000, device: 'phone' },
    { kind: 'nav', route: '/dashboard/S89E-AB12CD34EF', total_ms: 2000, device: 'phone' },
    { kind: 'nav', route: '/dashboard/abcdefab-cdef-abcd-efab-cdefabcdefab', total_ms: 2000, device: 'phone' },
    { kind: 'nav', route: '/dashboard/[eventId]/guests', total_ms: 2000, device: 'phone' }, // the control
  ]);
  assert.equal(n, 1, 'only the route pattern lands');
  assert.equal(await count(), before + 1);
});

test('rows older than 30 days are trimmed as new ones are written', async () => {
  await db.query(
    `INSERT INTO public.app_load_timings (created_at, kind, route, total_ms, device) VALUES (NOW() - INTERVAL '31 days', 'nav', '/old', 3000, 'phone'), (NOW() - INTERVAL '29 days', 'nav', '/kept', 3000, 'phone')`,
  );
  await record([{ kind: 'page', route: '/', total_ms: 1200, device: 'phone' }]);
  const routes = (await db.query<{ route: string }>(`SELECT route FROM public.app_load_timings WHERE route IN ('/old','/kept')`)).rows.map((r) => r.route);
  assert.deepEqual(routes, ['/kept']);
});

test('🔒 ADMIN ONLY — no browser session reads, writes or calls the RPC; the service role does (positive control)', async () => {
  const sessions: Array<['anon' | 'authenticated', string | null, string]> = [
    ['anon', null, 'a stranger'],
    ['authenticated', adminUser, 'even an admin’s own browser session'],
  ];
  for (const [role, uid, who] of sessions) {
    await as(
      role,
      async () => {
        await assert.rejects(db.query(`SELECT * FROM public.app_load_timings`), /permission denied/, `${who} must not read the log`);
        await assert.rejects(
          db.query(`INSERT INTO public.app_load_timings (kind, route, total_ms, device) VALUES ('nav','/x',1,'phone')`),
          /permission denied|row-level security/,
          `${who} must not write the log`,
        );
        await assert.rejects(
          db.query(`SELECT public.record_load_timings('[]'::jsonb, NULL, FALSE)`),
          /permission denied/,
          `${who} must not call record_load_timings`,
        );
      },
      uid,
    );
  }
  // Positive control: the service role reads it (the admin page's path, behind requireAdmin()).
  const n = await as('service_role', async () => (await db.query(`SELECT 1 FROM public.app_load_timings LIMIT 1`)).rows.length);
  assert.equal(n, 1);
});

test('the targets column: {} by default (every page on 1.5 s), an object only', async () => {
  const r = (await db.query<{ t: unknown }>(`SELECT load_time_targets AS t FROM public.platform_settings WHERE id = 1`)).rows[0]!;
  assert.deepEqual(r.t, {});
  assert.equal(targetFor('/dashboard/[eventId]/guests', coerceTargets(r.t)), 1500);
  await assert.rejects(db.query(`UPDATE public.platform_settings SET load_time_targets = '[1]'::jsonb WHERE id = 1`), /check/i);
  await db.query(`UPDATE public.platform_settings SET load_time_targets = '{"/dashboard/[eventId]/guests": 2500}'::jsonb WHERE id = 1`);
  const t2 = (await db.query<{ t: unknown }>(`SELECT load_time_targets AS t FROM public.platform_settings WHERE id = 1`)).rows[0]!.t;
  assert.equal(targetFor('/dashboard/[eventId]/guests', coerceTargets(t2)), 2500);
  await db.query(`UPDATE public.platform_settings SET load_time_targets = '{}'::jsonb WHERE id = 1`);
});
