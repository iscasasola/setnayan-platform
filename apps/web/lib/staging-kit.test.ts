/**
 * THE FINAL-CHECK STAGING KIT, HELD — the rules of scripts/staging/* by behaviour, the two runners' refusals by
 * running them, and lock (e) (the flags checklist) end to end on a fake Vercel answer that carries a secret.
 *
 *   accounts     10 sign-ins, the 8 areas each owned once, reserved test domains only
 *   seed-core    `stagingTarget` refuses production, unknown hosts and mixed projects; the summary is a pure read
 *   seed.sql     no production ref, both belts present, Setnayan's prices READ from the catalogue
 *   copy-catalog production is reached only through the read-only door; tenant tables refused; stamps nulled
 *   flags (e)    every switch found, every class known, a secret's value never printed
 *   areas        every shipped route in exactly one area; every rule still matches a real route
 *
 * The SQL itself is proven on the replayed schema in tests/db/the-staging-seed-runs-clean.db.test.ts.
 *
 * SABOTAGE (each seen red, restored): let `stagingTarget` skip a host whose project it cannot read · keep a server
 * value that is not switch-shaped (the secret reaches the checklist) · point the Spaces rule at a route that does not
 * exist (the dead-rule test names it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from './strip-comments';
import { STAGING_ACCOUNTS, accountEmail, accountEmails, plusSinkEmail } from '../../../scripts/staging/accounts';
import {
  DEFAULT_COVER,
  PRODUCTION_SUPABASE_REF,
  SEED_SUMMARY_SQL,
  jwtRefOf,
  seedSettingsSql,
  stagingTarget,
  supabaseRefOf,
} from '../../../scripts/staging/seed-core';
import { COPY_TABLES, buildUpsertSql, refusalFor, type TableMeta } from '../../../scripts/staging/copy-catalog-core';
import {
  ENVIRONMENT_FLAGS,
  SERVER_ENVIRONMENT,
  classifyServerName,
  inventoryFlags,
  isSwitchShaped,
  productionValues,
  renderFlagChecklist,
} from '../../../scripts/staging/flags-core';
import { appSources } from '../../../scripts/staging/flags';
import { AREA_RULES, CHECK_AREAS, areaLists, bucketOf, shippedScreens } from '../../../scripts/staging/areas';
import { assertSelectOnly } from '../../../scripts/lib/read-only-db.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const KIT = join(ROOT, 'scripts/staging');
const TSX = join(ROOT, 'node_modules/.bin/tsx');
const BRANCH_DB = 'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
const BRANCH_API = 'https://abcdefghijklmnopqrst.supabase.co';
const PROD_DB = `postgresql://postgres:pw@db.${PRODUCTION_SUPABASE_REF}.supabase.co:5432/postgres`;
const PROD_API = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;

const jwt = (payload: object) =>
  ['x', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');

// ── accounts ────────────────────────────────────────────────────────────────────────────────────────────────────

test('accounts: ten sign-ins, each of the 8 areas owned exactly once, two shared messy ones', () => {
  assert.equal(STAGING_ACCOUNTS.length, 10);
  const areas = STAGING_ACCOUNTS.map((a) => a.area).filter((a): a is number => a !== null).sort();
  assert.deepEqual(areas, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(STAGING_ACCOUNTS.filter((a) => a.area === null).map((a) => a.key), ['messy_one', 'messy_two']);
  for (const a of CHECK_AREAS) assert.equal(STAGING_ACCOUNTS.find((x) => x.key === a.account)?.area, a.id, `area ${a.id}'s sign-in`);
});

test('accounts: only a reserved test domain — no address can reach a person', () => {
  assert.equal(accountEmail('couple_plan'), 'couple-plan@final-check.test');
  for (const d of ['gmail.com', 'setnayan.com', 'final-check.test.com', 'a b.test']) {
    assert.throws(() => accountEmail('front', d), /not a reserved test domain/, d);
  }
  assert.equal(plusSinkEmail('supplier_shop', 'QA+old@Inbox.example'), 'qa+supplier-shop@inbox.example');
  assert.throws(() => plusSinkEmail('front', 'a@b.com, c@d.com'), /not one address/);
  const all = Object.values(accountEmails((k) => accountEmail(k)));
  assert.equal(new Set(all).size, 10, 'ten different sign-ins');
});

// ── seed-core: the target guard ──────────────────────────────────────────────────────────────────────────────────

test('seed-core: the project ref is read from every Supabase URL shape, and from nothing else', () => {
  assert.equal(supabaseRefOf(BRANCH_API), 'abcdefghijklmnopqrst');
  assert.equal(supabaseRefOf(BRANCH_DB), 'abcdefghijklmnopqrst');
  assert.equal(supabaseRefOf(PROD_DB), PRODUCTION_SUPABASE_REF);
  for (const u of ['postgresql://u:p@db.example.com/x', 'https://setnayan.com', 'not a url', 'postgresql://postgres:p@pooler.supabase.com/x']) {
    assert.equal(supabaseRefOf(u), null, u);
  }
  assert.equal(jwtRefOf(jwt({ ref: PRODUCTION_SUPABASE_REF, role: 'service_role' })), PRODUCTION_SUPABASE_REF);
  assert.equal(jwtRefOf('sb_secret_abc'), null);
});

test('seed-core: the kit writes only with STAGING=1, to one non-production project (or this machine)', () => {
  const ok = (x: Parameters<typeof stagingTarget>[0]) => stagingTarget(x).ok;
  assert.ok(ok({ staging: '1', dbUrl: BRANCH_DB, apiUrl: BRANCH_API, serviceKey: jwt({ ref: 'abcdefghijklmnopqrst' }) }));
  assert.ok(ok({ staging: '1', dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' }));
  // A writer reads narrow: only exactly "1".
  for (const s of [undefined, '', 'true', 'yes', '0']) assert.equal(ok({ staging: s, dbUrl: BRANCH_DB }), false, String(s));
  const refusals: Array<[Parameters<typeof stagingTarget>[0], RegExp]> = [
    [{ staging: '1', dbUrl: PROD_DB }, /PRODUCTION/],
    [{ staging: '1', dbUrl: BRANCH_DB, apiUrl: PROD_API }, /PRODUCTION/],
    [{ staging: '1', dbUrl: BRANCH_DB, apiUrl: 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co' }, /different projects/],
    [{ staging: '1', dbUrl: 'postgresql://u:p@db.example.com/x' }, /names no Supabase project/],
    [{ staging: '1', dbUrl: BRANCH_DB, serviceKey: jwt({ ref: PRODUCTION_SUPABASE_REF }) }, /minted for PRODUCTION/],
    [{ staging: '1', dbUrl: BRANCH_DB, serviceKey: jwt({ ref: 'zzzzzzzzzzzzzzzzzzzz' }) }, /service key is for/],
  ];
  for (const [input, why] of refusals) {
    const r = stagingTarget(input);
    assert.ok(!r.ok && why.test(r.why), JSON.stringify(r));
  }
});

test('seed-core: the settings preamble quotes safely, and the summary is a single read-only SELECT', () => {
  const sql = seedSettingsSql({ accounts: accountEmails((k) => accountEmail(k)), cover: "https://x.example/it's.jpg" });
  assert.match(sql, /set_config\('staging\.cover', 'https:\/\/x\.example\/it''s\.jpg', false\)/);
  assert.match(seedSettingsSql({ accounts: accountEmails((k) => accountEmail(k)) }), new RegExp(DEFAULT_COVER.replace(/[/.]/g, '\\$&')));
  // The repo's own read-only door accepts it: one statement, SELECT only, no write word.
  assert.doesNotThrow(() => assertSelectOnly(SEED_SUMMARY_SQL));
});

// ── seed.sql ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('seed.sql: no production ref, both belts, and Setnayan prices READ from the catalogue', () => {
  const sql = readFileSync(join(KIT, 'seed.sql'), 'utf8');
  assert.ok(!sql.includes(PRODUCTION_SUPABASE_REF));
  assert.match(sql, /IF v_real_people > 25 THEN\s+RAISE EXCEPTION 'staging seed REFUSED/);
  assert.match(sql, /IF EXISTS \(SELECT 1 FROM public\.events WHERE slug LIKE 'stg-%'\) THEN\s+RAISE EXCEPTION 'staging seed REFUSED/);
  // Orders are priced by JOINING the catalogue on the service code; nothing else prices them.
  assert.match(sql, /JOIN public\.platform_retail_catalog_v2 c ON c\.service_code = x\.code/);
  assert.match(sql, /c\.retail_price_php,/);
  // The one sample-price unit is read from the catalogue too.
  assert.match(sql, /percentile_disc\(0\.5\) WITHIN GROUP \(ORDER BY retail_price_php\) INTO v_unit\s+FROM public\.platform_retail_catalog_v2/);
  // Every account is internal-free: the seed never sets is_internal.
  assert.doesNotMatch(sql, /is_internal\s*=\s*(true|TRUE)/);
  const seal = readFileSync(join(KIT, 'seal.sql'), 'utf8');
  assert.match(seal, /cron\.alter_job\(\$1, active := false\)/);
  assert.match(seal, /notify_webhook_secret/);
});

// ── copy-catalog ─────────────────────────────────────────────────────────────────────────────────────────────────

test('copy-catalog: production is reached ONLY through the read-only door', () => {
  const src = stripComments(readFileSync(join(KIT, 'copy-catalog.ts'), 'utf8'));
  assert.match(src, /import \{ readRows, scrub as scrubDb \} from '\.\.\/lib\/read-only-db\.mjs';/);
  // The production URL feeds three things and no others: the read door's env, the ref check, and the guard message.
  const uses = [...src.matchAll(/\bprodUrl\b/g)].length;
  assert.equal(uses, 4, `prodUrl is used ${uses} times — a new use may send production something other than a SELECT`);
  assert.match(src, /PRICES_DB_URL: prodUrl/);
  assert.match(src, /const read = readRows\(`SELECT \* FROM public\.\$\{spec\.table\}`, \{ env: readEnv \}\);/);
  // The door itself refuses anything but one SELECT.
  for (const bad of ['DELETE FROM public.users', 'SELECT 1; DELETE FROM x', 'UPDATE x SET y = 1', 'WITH d AS (DELETE FROM x RETURNING *) SELECT * FROM d']) {
    assert.throws(() => assertSelectOnly(bad), /read-only-db/, bad);
  }
});

test('copy-catalog: a tenant table is refused, stamps land NULL, keep columns are never written', () => {
  const meta: TableMeta = {
    table: 'platform_settings',
    columns: ['id', 'bookings_open', 'maya_checkout_endpoint', 'updated_by'],
    primaryKey: ['id'],
    foreignKeys: { updated_by: 'auth.users' },
  };
  const spec = COPY_TABLES.find((t) => t.table === 'platform_settings')!;
  assert.equal(refusalFor(meta, spec), null);
  assert.match(refusalFor({ ...meta, foreignKeys: { owner: 'vendor_profiles' } }, spec) ?? '', /holds people, shops or events/);
  assert.match(refusalFor(undefined, spec) ?? '', /does not exist/);
  assert.match(refusalFor({ ...meta, primaryKey: [] }, spec) ?? '', /no primary key/);
  const sql = buildUpsertSql(spec, meta, [{ id: 1, bookings_open: true, maya_checkout_endpoint: 'https://live', updated_by: 'u', extra_prod_only: 1 }])!;
  assert.match(sql, /^INSERT INTO public\.platform_settings \(id, bookings_open, updated_by\)/);
  assert.match(sql, /NULL AS updated_by/);
  assert.doesNotMatch(sql.split('\n')[0]!, /maya_checkout_endpoint/, 'a keep column is never in the insert list');
  assert.match(sql, /ON CONFLICT \(id\) DO UPDATE SET bookings_open = EXCLUDED\.bookings_open, updated_by = EXCLUDED\.updated_by;$/);
  assert.equal(buildUpsertSql(spec, meta, []), null);
  assert.throws(() => buildUpsertSql(spec, meta, [{ bookings_open: true }]), /no primary-key column id/);
  // A payload carrying the dollar tag gets a different tag.
  assert.match(buildUpsertSql(spec, meta, [{ id: 1, bookings_open: '$stg_rows$' }])!, /\$stg_rows_0\$/);
  assert.equal(new Set(COPY_TABLES.map((t) => t.table)).size, COPY_TABLES.length);
});

// ── flags (lock e) ───────────────────────────────────────────────────────────────────────────────────────────────

test('flags: the inventory finds each read and how it is read, and ignores comments and fragments', () => {
  const flags = inventoryFlags([
    { path: 'a.ts', code: "envFlagEnabled(process.env.NEXT_PUBLIC_A_ENABLED); process.env.NEXT_PUBLIC_B === 'true'" },
    { path: 'b.ts', code: "process.env.NEXT_PUBLIC_C !== 'false'; const u = process.env.NEXT_PUBLIC_APP_URL; process.env.SECRET_THING" },
  ]);
  assert.deepEqual(
    flags.map((f) => `${f.name}:${f.reads.join('/')}`),
    ['NEXT_PUBLIC_A_ENABLED:parser', 'NEXT_PUBLIC_APP_URL:value', 'NEXT_PUBLIC_B:strict-true', 'NEXT_PUBLIC_C:default-on'],
  );
  assert.deepEqual(inventoryFlags([{ path: 'x.ts', code: 'process.env.SECRET_THING; process.env.NEXT_PUBLIC_X' }], 'server').map((f) => f.name), ['SECRET_THING']);
});

test('flags: the real app — 80+ switches, and every named environment flag is still read (no stale entry)', () => {
  const sources = appSources();
  const pub = new Set(inventoryFlags(sources).map((f) => f.name));
  const server = new Set(inventoryFlags(sources, 'server').map((f) => f.name));
  assert.ok(pub.size >= 80, `only ${pub.size} NEXT_PUBLIC_* reads found — the walker went blind`);
  for (const name of Object.keys(ENVIRONMENT_FLAGS)) assert.ok(pub.has(name), `${name} is classified but no longer read — remove it`);
  for (const name of Object.keys(SERVER_ENVIRONMENT)) assert.ok(server.has(name), `${name} is classified but no longer read — remove it`);
  // The names that would make a copy act on something real stay refused.
  for (const name of ['VERCEL_API_TOKEN', 'META_PAGE_ACCESS_TOKEN', 'TIKTOK_ACCESS_TOKEN', 'IG_APP_SECRET']) {
    assert.equal(classifyServerName(name).kind, 'unset', name);
  }
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'ENCRYPTION_KEY']) assert.equal(classifyServerName(name).kind, 'own', name);
});

test('flags: a secret in the Vercel answer is never printed; switches become commands', () => {
  const api = {
    envs: [
      { key: 'NEXT_PUBLIC_SEATING_3D', value: 'true', target: ['production'], type: 'plain' },
      { key: 'NEXT_PUBLIC_SUPABASE_URL', value: 'https://prod.example', target: ['production'], type: 'plain' },
      { key: 'NEXT_PUBLIC_PREVIEW_ONLY', value: 'true', target: ['preview'], type: 'plain' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', value: 'super-secret-xyz', target: ['production'], type: 'encrypted' },
      { key: 'WEBSITE_PHASES_ENABLED', value: 'true', target: ['production'], type: 'encrypted' },
      { key: 'RESEND_FROM_ADDRESS', value: 'Setnayan <noreply@x>', target: ['production'], type: 'encrypted' },
      { key: 'NEXT_PUBLIC_SENSITIVE', target: ['production'], type: 'sensitive' },
    ],
  };
  const values = productionValues(api, 'public');
  const serverValues = productionValues(api, 'server');
  assert.deepEqual([...values.keys()].sort(), ['NEXT_PUBLIC_SEATING_3D', 'NEXT_PUBLIC_SENSITIVE', 'NEXT_PUBLIC_SUPABASE_URL']);
  assert.deepEqual(serverValues.get('SUPABASE_SERVICE_ROLE_KEY'), { sensitive: true });
  assert.deepEqual(serverValues.get('RESEND_FROM_ADDRESS'), { sensitive: true }, 'not switch-shaped ⇒ never kept');
  const md = renderFlagChecklist({
    flags: [
      { name: 'NEXT_PUBLIC_SEATING_3D', files: ['a'], reads: ['parser'] },
      { name: 'NEXT_PUBLIC_SUPABASE_URL', files: ['a'], reads: ['value'] },
    ],
    serverFlags: [
      { name: 'SUPABASE_SERVICE_ROLE_KEY', files: ['a'], reads: ['value'] },
      { name: 'WEBSITE_PHASES_ENABLED', files: ['a'], reads: ['parser'] },
      { name: 'RESEND_FROM_ADDRESS', files: ['a'], reads: ['value'] },
    ],
    values,
    serverValues,
    prod: { version: 'abc1234', env: 'production' },
    branch: 'preview/final-check',
  });
  for (const secret of ['super-secret-xyz', 'noreply@x', 'https://prod.example']) assert.ok(!md.includes(secret), `printed ${secret}`);
  assert.match(md, /printf '%s' 'true' \| vercel env add NEXT_PUBLIC_SEATING_3D preview preview\/final-check/);
  assert.match(md, /printf '%s' 'true' \| vercel env add WEBSITE_PHASES_ENABLED preview preview\/final-check/);
  assert.match(md, /`NEXT_PUBLIC_SUPABASE_URL` — the staging branch's API URL/);
  assert.match(md, /Production runs commit `abc1234`/);
  assert.ok(isSwitchShaped(' TRUE ') && isSwitchShaped('30') && !isSwitchShaped('sk-live-123') && !isSwitchShaped('1234567'));
});

// ── areas ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('areas: every shipped route lands in exactly one bucket, every area has pages, labs are only labs', () => {
  const screens = shippedScreens();
  assert.ok(screens.length >= 500, `only ${screens.length} routes read — a map went missing`);
  const lists = areaLists(screens);
  const placed = [...lists.values()].reduce((n, l) => n + l.length, 0);
  assert.equal(placed, screens.length, 'every route placed once');
  for (const a of CHECK_AREAS) assert.ok((lists.get(a.id) ?? []).some((s) => !s.redirectsTo), `area ${a.id} has no page`);
  for (const s of lists.get('labs') ?? []) assert.match(s.route, /^\/(dev|demo-capture)(\/|$)/);
  assert.ok((lists.get(8) ?? []).some((s) => s.route === '/admin'), 'the admin map reached area 8');
});

test('areas: every specific rule still matches a real route (a renamed page leaves no dead rule)', () => {
  const screens = shippedScreens();
  for (const rule of AREA_RULES) {
    if (rule.re.source === '^\\/') continue; // the per-area fallbacks
    assert.ok(
      screens.some((s) => (!rule.area || rule.area === s.area) && rule.re.test(s.route) && bucketOf(s) === rule.to),
      `rule ${rule.re} (${rule.why}) matches no route any more`,
    );
  }
});

// ── the runners refuse before they touch anything ────────────────────────────────────────────────────────────────

function run(script: string, env: Record<string, string>): { status: number | null; out: string } {
  const r = spawnSync(TSX, [join(KIT, script), '--dry-run'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('runners: seed.ts and copy-catalog.ts refuse production and a missing STAGING=1, exit 2, print no secret', () => {
  const key = jwt({ ref: 'abcdefghijklmnopqrst' });
  const cases: Array<[string, Record<string, string>, RegExp]> = [
    ['seed.ts', { STAGING_DB_URL: BRANCH_DB, STAGING_SUPABASE_URL: BRANCH_API, STAGING_SERVICE_ROLE_KEY: key }, /STAGING=1 is not set/],
    ['seed.ts', { STAGING: '1', STAGING_DB_URL: PROD_DB, STAGING_SUPABASE_URL: BRANCH_API, STAGING_SERVICE_ROLE_KEY: key }, /PRODUCTION/],
    ['copy-catalog.ts', { STAGING: '1', PROD_READ_DB_URL: BRANCH_DB, STAGING_DB_URL: PROD_DB }, /PRODUCTION/],
    ['copy-catalog.ts', { STAGING: '1', PROD_READ_DB_URL: BRANCH_DB, STAGING_DB_URL: BRANCH_DB }, /same project/],
  ];
  for (const [script, env, why] of cases) {
    const r = run(script, env);
    assert.equal(r.status, 2, `${script} ${JSON.stringify(Object.keys(env))}: exit ${r.status}\n${r.out}`);
    assert.match(r.out, /REFUSED/);
    assert.match(r.out, why);
    assert.ok(!r.out.includes(':pw@') && !r.out.includes(key), 'a connection string or key was printed');
  }
  // And a staging branch passes the guard: the dry run plans, creates nothing.
  const ok = run('seed.ts', { STAGING: '1', STAGING_DB_URL: BRANCH_DB, STAGING_SUPABASE_URL: BRANCH_API, STAGING_SERVICE_ROLE_KEY: key });
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, /dry run: nothing created, nothing written/);
  assert.match(ok.out, /would create {2}couple-plan@final-check\.test/);
});
