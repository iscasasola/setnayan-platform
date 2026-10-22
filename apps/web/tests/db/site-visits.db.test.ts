/**
 * VISITS — the database half (migration 20271282829207, owner 2026-10-22:
 * traffic in our own admin, no cookies). Run against the replayed schema:
 *
 *   • a view lands as +1 view, and +1 visitor only on that visitor's FIRST
 *     view of the (Manila) day — so a day's rows sum to its distinct visitors;
 *   • 🔒 NO RAW ID IS STORED: the aggregate has no visitor column at all, and
 *     the only per-person row (site_visit_seen) is today's key hashed AGAIN
 *     with today's salt — never the key the middleware sent;
 *   • 🔒 A DAY CANNOT BE JOINED TO ANOTHER: the first visit of a new day deletes
 *     the old salt and every hash made with it (no scheduler — on write);
 *   • a raw URL / id / slug-with-digits / token cannot be stored (the CHECK);
 *   • 🔒 READ-ONLY, ADMIN-ONLY: anon and a signed-in non-admin see nothing and
 *     cannot write or call either function; an admin reads the aggregate only;
 *     every refusal has its positive control (the service role succeeds).
 *   • site_visit_summary returns the sums the Visits tab draws.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let adminUser = '';
let plainUser = '';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

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
type Visit = { path: string; source?: string; utm?: string; device?: string; country?: string; signedIn?: boolean; key?: string | null };
async function visit(v: Visit): Promise<boolean> {
  return as('service_role', async () => {
    const r = await db.query<{ ok: boolean }>(`SELECT public.record_site_visit($1, $2, $3, $4, $5, $6, $7) AS ok`, [
      v.path,
      v.source ?? '',
      v.utm ?? '',
      v.device ?? 'phone',
      v.country ?? 'PH',
      v.signedIn ?? false,
      v.key === undefined ? KEY_A : v.key,
    ]);
    return r.rows[0]!.ok;
  });
}
const today = async () => (await db.query<{ d: string }>(`SELECT ((NOW() AT TIME ZONE 'Asia/Manila')::date)::text AS d`)).rows[0]!.d;
async function sums(): Promise<{ views: number; visitors: number }> {
  const r = await db.query<{ v: string; u: string }>(
    `SELECT coalesce(sum(views),0)::text AS v, coalesce(sum(visitors),0)::text AS u FROM public.site_visit_days WHERE day = (NOW() AT TIME ZONE 'Asia/Manila')::date`,
  );
  return { views: Number(r.rows[0]!.v), visitors: Number(r.rows[0]!.u) };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  adminUser = (
    await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('visits-admin@visits.test', '{}'::jsonb) RETURNING id`)
  ).rows[0]!.id;
  await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [adminUser]);
  plainUser = (
    await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('visits-plain@visits.test', '{}'::jsonb) RETURNING id`)
  ).rows[0]!.id;
});

after(async () => {
  await db?.close();
});

test('a view is +1 view; a visitor is counted once a day, on the row of their first view', async () => {
  const start = await sums();
  assert.equal(await visit({ path: '/', source: 'facebook.com', device: 'phone', key: KEY_A }), true);
  assert.equal(await visit({ path: '/explore', device: 'phone', key: KEY_A }), true);
  assert.equal(await visit({ path: '/explore', device: 'phone', key: KEY_A }), true);
  assert.equal(await visit({ path: '/pricing', source: 'google.com', device: 'desktop', country: 'US', key: KEY_B }), true);
  const end = await sums();
  assert.equal(end.views - start.views, 4);
  assert.equal(end.visitors - start.visitors, 2, 'two people, however many pages');
  const landing = await db.query<{ visitors: number; views: number }>(
    `SELECT visitors, views FROM public.site_visit_days WHERE path = '/' AND source = 'facebook.com'`,
  );
  assert.equal(landing.rows[0]!.visitors, 1, 'the visitor belongs to the row they ARRIVED on');
  const explore = await db.query<{ visitors: number; views: number }>(`SELECT visitors, views FROM public.site_visit_days WHERE path = '/explore'`);
  assert.deepEqual(explore.rows[0], { visitors: 0, views: 2 });
});

test('🔒 no raw id is stored — the aggregate has no visitor column; the seen row is re-hashed with today’s salt', async () => {
  const cols = (
    await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_visit_days' ORDER BY column_name`,
    )
  ).rows.map((r) => r.column_name);
  assert.deepEqual(cols, ['country', 'day', 'device', 'path', 'signed_in', 'source', 'utm_source', 'views', 'visitors']);
  const seen = (await db.query<{ visitor: string }>(`SELECT visitor FROM public.site_visit_seen`)).rows.map((r) => r.visitor);
  assert.ok(seen.length >= 2, 'positive control: today’s visitors are remembered');
  for (const h of seen) {
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.ok(h !== KEY_A && h !== KEY_B, 'the key the middleware sent was stored as-is');
  }
  // A key that is not a 64-hex hash (a raw IP, a user id) is never stored anywhere.
  const before = (await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.site_visit_seen`)).rows[0]!.n;
  assert.equal(await visit({ path: '/', key: '203.177.42.19' }), true, 'the view still counts');
  assert.equal(await visit({ path: '/', key: '0f8fad5b-d9cb-469f-a165-70867728950e' }), true);
  const afterN = (await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.site_visit_seen`)).rows[0]!.n;
  assert.equal(afterN, before, 'a raw id reached site_visit_seen');
  const anyRaw = await db.query(`SELECT 1 FROM public.site_visit_seen WHERE visitor LIKE '%203.177%' OR visitor LIKE '0f8fad5b%'`);
  assert.equal(anyRaw.rows.length, 0);
});

test('🔒 a day cannot be joined to another — the next day’s first visit deletes the old salt and its hashes', async () => {
  const d = await today();
  await db.query(`INSERT INTO public.site_visit_salts (day, salt) VALUES ($1::date - 1, 'yesterday-salt') ON CONFLICT DO NOTHING`, [d]);
  await db.query(`INSERT INTO public.site_visit_seen (day, visitor) VALUES ($1::date - 1, $2) ON CONFLICT DO NOTHING`, [d, 'c'.repeat(64)]);
  await db.query(`INSERT INTO public.site_visit_days (day, path, device, views, visitors) VALUES ($1::date - 1, '/', 'phone', 5, 3) ON CONFLICT DO NOTHING`, [d]);
  assert.equal(await visit({ path: '/features' }), true);
  const salts = (await db.query<{ day: string }>(`SELECT day::text AS day FROM public.site_visit_salts`)).rows.map((r) => r.day);
  assert.deepEqual(salts, [d], 'an old salt survived');
  const old = await db.query(`SELECT 1 FROM public.site_visit_seen WHERE day < $1::date`, [d]);
  assert.equal(old.rows.length, 0, 'an old hash survived');
  const kept = await db.query<{ views: number }>(`SELECT views FROM public.site_visit_days WHERE day = $1::date - 1`, [d]);
  assert.equal(kept.rows[0]!.views, 5, 'the daily aggregate is kept');
});

test('🔒 a raw URL, an id or a token cannot be stored — the CHECK drops the view, never errors', async () => {
  const start = await sums();
  for (const path of [
    '/v/bituin-catering-2026',
    '/dashboard/6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b',
    '/dashboard/S89E-7K3M9QW2XR',
    '/u/maria@example.com',
    'https://setnayan.com/',
    '/explore?q=maria',
    '/claim/eyJhbGciOiJIUzI1NiJ9abcdefghijklmnopqrstuv',
  ]) {
    assert.equal(await visit({ path }), false, `stored: ${path}`);
  }
  assert.equal(await visit({ path: '/', source: 'https://facebook.com/groups/x' }), false, 'a referrer URL is not a domain');
  assert.equal(await visit({ path: '/', device: 'watch' }), false);
  assert.equal(await visit({ path: '/', country: 'Philippines' }), false);
  assert.deepEqual(await sums(), start);
  assert.equal(await visit({ path: '/v/[slug]' }), true, 'positive control: the template lands');
});

test('🔒 read-only and admin-only: no browser role writes or calls; an admin reads the aggregate only', async () => {
  for (const [role, uid] of [
    ['anon', null],
    ['authenticated', plainUser],
    ['authenticated', adminUser],
  ] as const) {
    await assert.rejects(
      as(role, () => db.query(`SELECT public.record_site_visit('/', '', '', 'phone', 'PH', false, $1)`, [KEY_A]), uid),
      /permission denied/,
      `${role}${uid === adminUser ? ' (admin)' : ''} called record_site_visit`,
    );
    await assert.rejects(
      as(role, () => db.query(`SELECT public.site_visit_summary(CURRENT_DATE - 30, CURRENT_DATE)`), uid),
      /permission denied/,
      `${role} called site_visit_summary`,
    );
    await assert.rejects(
      as(role, () => db.query(`INSERT INTO public.site_visit_days (day, path, device) VALUES (CURRENT_DATE, '/forged', 'phone')`), uid),
      /permission denied|row-level security/,
      `${role} wrote site_visit_days`,
    );
    for (const t of ['site_visit_seen', 'site_visit_salts']) {
      await assert.rejects(as(role, () => db.query(`SELECT * FROM public.${t}`), uid), /permission denied/, `${role} read ${t}`);
    }
  }
  const anon = await as('anon', () => db.query(`SELECT 1 FROM public.site_visit_days`)).catch((e: Error) => e);
  assert.ok(anon instanceof Error && /permission denied/.test(anon.message), 'anon read site_visit_days');
  const plain = await as('authenticated', () => db.query(`SELECT 1 FROM public.site_visit_days`), plainUser);
  assert.equal(plain.rows.length, 0, 'a signed-in non-admin read the visits');
  const admin = await as('authenticated', () => db.query(`SELECT 1 FROM public.site_visit_days`), adminUser);
  assert.ok(admin.rows.length > 0, 'positive control: an admin reads the aggregate');
  const svc = await as('service_role', () => db.query(`SELECT count(*) FROM public.site_visit_seen`));
  assert.equal(svc.rows.length, 1, 'positive control: the service role reads it');
});

test('site_visit_summary returns the sums the Visits tab draws', async () => {
  const d = await today();
  const r = await as('service_role', () =>
    db.query<{ s: Record<string, unknown> }>(`SELECT public.site_visit_summary($1::date - 7, $1::date) AS s`, [d]),
  );
  const s = r.rows[0]!.s as {
    days: Array<{ day: string; views: number; visitors: number }>;
    pages: Array<{ path: string; views: number }>;
    sources: Array<{ source: string; visitors: number }>;
    devices: Array<{ device: string }>;
    countries: Array<{ country: string; visitors: number }>;
    first_day: string;
  };
  const todayRow = s.days.find((x) => x.day === d)!;
  const direct = await sums();
  assert.equal(todayRow.views, direct.views);
  assert.equal(todayRow.visitors, direct.visitors);
  assert.ok(s.pages.some((p) => p.path === '/explore' && p.views === 2));
  assert.ok(s.sources.some((x) => x.source === 'facebook.com' && x.visitors === 1));
  assert.ok(s.countries.some((x) => x.country === 'US' && x.visitors === 1));
  assert.deepEqual(s.devices.map((x) => x.device).sort(), ['desktop', 'phone']);
  assert.ok(s.first_day <= d);
});
