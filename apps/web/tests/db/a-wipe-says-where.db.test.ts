/**
 * A WIPE SAYS WHERE — migration 20271261953500.
 *
 * THE BUG, as production reported it (`app_fault_issues`, kind DB_WRITE_REFUSED,
 * open): `POST rpc/refresh_demand_radar_rollups` and
 * `POST rpc/recompute_market_price_bands` both failed with
 * "DELETE requires a WHERE clause", every run.
 *
 * Supabase loads the `safeupdate` library on every connection the API
 * (PostgREST) makes. It refuses any DELETE or UPDATE that has no WHERE — inside
 * a SECURITY DEFINER function and inside a CTE too. Each rebuild opened with a
 * bare `DELETE FROM <table>`, so the background refill, the vendor-side
 * refresh and the admin "Run now" all threw before writing one row, and the
 * tables read as "no data yet".
 *
 * 🔑 WHY EVERY EXISTING TEST STAYED GREEN: this replay (PGlite) has no
 * `safeupdate`. A bare DELETE runs here and is refused there. So this file
 * does two things a replay CAN do:
 *
 *   1. It reads every public function body the full replay ends with — the
 *      LATEST definition of each, wherever it was last re-created — and fails
 *      on any DELETE or UPDATE with no WHERE at its own level. That is
 *      safeupdate's own rule, so a bare wipe is refused HERE before it ships.
 *   2. It runs each fixed rebuild the way production calls it and proves it
 *      completes, removes what was stale, and writes the rows it reports.
 *
 * Known limit: SQL assembled at runtime (`EXECUTE format('DELETE FROM %I', …)`)
 * is a string, and the scan does not read strings.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard } from './live-card-fixture';
import { stripSqlComments } from '@/lib/security/events-column-privileges';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271261953500_a_wipe_says_where.sql';
const REBUILDS = [
  'refresh_demand_radar_rollups',
  'recompute_market_price_bands',
  'recompute_market_funnel_bands',
] as const;

// ── the scan ────────────────────────────────────────────────────────────────

/**
 * Comments are blanked by the repo's ONE SQL comment stripper
 * (`stripSqlComments`, lib/security/events-column-privileges.ts). What is left
 * is code plus string literals; this blanks the literals — `'…'` and nested
 * `$tag$…$tag$` (an EXECUTE's text) — so a message that MENTIONS a delete is
 * not one.
 */
function codeOnly(src: string): string {
  const sql = stripSqlComments(src);
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      out += " '' ";
      i = j + 1;
      continue;
    }
    const tag = /^\$([A-Za-z_]\w*)?\$/.exec(sql.slice(i, i + 64));
    if (tag) {
      const j = sql.indexOf(tag[0], i + tag[0].length);
      i = j < 0 ? n : j + tag[0].length;
      out += " '' ";
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

function tokens(src: string): string[] {
  const re = /[A-Za-z_][\w$]*(?:\.[A-Za-z_"][\w$"]*)*|"[^"]*"(?:\.[A-Za-z_"][\w$"]*)*|[();]/g;
  return (codeOnly(src).match(re) ?? []).map((t) => t.toLowerCase());
}

/** Words that put UPDATE somewhere other than the head of an UPDATE statement
 *  (`ON CONFLICT DO UPDATE`, `FOR UPDATE`, `BEFORE UPDATE OR …`, `ON UPDATE`). */
const NOT_A_STATEMENT_BEFORE_UPDATE = new Set(['do', 'for', 'on', 'or', 'before', 'after', 'of', 'key', 'no']);

type WriteStatement = { kind: 'DELETE' | 'UPDATE'; target: string; hasWhere: boolean };

/** Every DELETE / UPDATE statement in a body, and whether it has its own WHERE. */
function writeStatements(src: string): WriteStatement[] {
  const t = tokens(src);
  const found: WriteStatement[] = [];
  for (let i = 0; i < t.length; i += 1) {
    let kind: WriteStatement['kind'] | null = null;
    let target = '?';
    if (t[i] === 'delete' && t[i + 1] === 'from') {
      kind = 'DELETE';
      target = t[i + 2] ?? '?';
    } else if (t[i] === 'update' && !NOT_A_STATEMENT_BEFORE_UPDATE.has(t[i - 1] ?? '')) {
      // UPDATE [ONLY] <table> [[AS] alias] SET
      let j = i + 1;
      if (t[j] === 'only') j += 1;
      const tbl = t[j];
      if (tbl && !'();'.includes(tbl)) {
        let k = j + 1;
        if (t[k] === 'as') k += 1;
        if (t[k] && t[k] !== 'set' && !'();'.includes(t[k]!)) k += 1;
        if (t[k] === 'set') {
          kind = 'UPDATE';
          target = tbl;
        }
      }
    }
    if (!kind) continue;
    // Walk to the end of THIS statement: `;` at its own depth, or the `)` that
    // closes the CTE / subquery it sits in. A WHERE inside a deeper paren (a
    // subquery in SET, an EXISTS) is not the statement's WHERE.
    let depth = 0;
    let hasWhere = false;
    for (let j = i + 1; j < t.length; j += 1) {
      const y = t[j];
      if (y === '(') depth += 1;
      else if (y === ')') {
        depth -= 1;
        if (depth < 0) break;
      } else if (y === ';' && depth === 0) break;
      else if (y === 'where' && depth === 0) hasWhere = true;
    }
    found.push({ kind, target, hasWhere });
  }
  return found;
}

const unqualified = (src: string) => writeStatements(src).filter((s) => !s.hasWhere);

// ── fixtures ────────────────────────────────────────────────────────────────

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
/** As the background job calls it: `createAdminClient().rpc(...)`. */
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
/** As the admin console's "Run now" calls it. */
async function asAdmin<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

async function newUser(email: string, accountType: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return u.rows[0]!.id;
}

async function newShop(label: string): Promise<string> {
  const uid = await newUser(`shop-${label}@wipe.test`, 'vendor');
  await db.query(
    `INSERT INTO public.vendor_profiles (user_id, business_name, hq_region)
     VALUES ($1, $2, 'wipe-test-region')
     ON CONFLICT (user_id) DO UPDATE SET hq_region = 'wipe-test-region'`,
    [uid, `Wipe Test ${label}`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  return v.rows[0]!.vendor_profile_id;
}

let adminUid = '';
let shops: string[] = [];
let prices: number[] = [];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  adminUid = await newUser('admin@wipe.test', 'admin');
  // is_console_admin() reads public.users, not the auth metadata.
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [adminUid]);
});

/** The rows the rebuilds read — seeded once, by the tests that run them, so a
 *  fixture problem can never hide the scan above. */
let seeded: Promise<void> | null = null;
function seed(): Promise<void> {
  seeded ??= (async () => {
    // As many shops in one region as the band's peer floor asks for (the
    // admin-managed radar_min_n_floor, never below 3), each with a priced live
    // card — so the band clears its floor exactly.
    const f = await db.query<{ floor: number }>(
      `SELECT GREATEST(COALESCE(radar_min_n_floor, 3), 3)::int AS floor FROM public.platform_settings WHERE id = 1`,
    );
    const peers = f.rows[0]?.floor ?? 3;
    shops = [];
    prices = [];
    for (let i = 0; i < peers; i += 1) {
      const shop = await newShop(String(i));
      shops.push(shop);
      prices.push(10000 + 1000 * i);
      await insertLiveCard(db, {
        vendor_profile_id: shop,
        category: 'photographer',
        title: `Wipe test card ${i}`,
        starting_price_php: prices[i],
      });
    }
    // One event with a committed booking — one demand-radar rollup row.
    const ev = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, region, event_date)
       VALUES ('Wipe Test Party', 'birthday', 'wipe-test-region', '2027-12-12') RETURNING event_id`,
    );
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
       VALUES ($1, 'misc', 'Wipe Test 0', 'contracted')`,
      [ev.rows[0]!.event_id],
    );
  })();
  return seeded;
}

after(async () => {
  await db?.close();
});

// ── 0. the scan reads SQL the way safeupdate does ───────────────────────────

test('the scan: a bare wipe is caught; a wipe that says WHERE is not', () => {
  const caught = (sql: string) => unqualified(sql).map((s) => `${s.kind} ${s.target}`);
  assert.deepEqual(caught(`BEGIN DELETE FROM public.t; END`), ['DELETE public.t']);
  assert.deepEqual(caught(`WITH w AS (DELETE FROM public.t RETURNING 1) SELECT 1`), ['DELETE public.t']);
  assert.deepEqual(caught(`UPDATE public.t SET a = 1;`), ['UPDATE public.t']);
  assert.deepEqual(caught(`UPDATE public.t x SET a = (SELECT b FROM u WHERE u.id = 1);`), ['UPDATE public.t']);

  assert.deepEqual(caught(`DELETE FROM public.t WHERE true;`), []);
  assert.deepEqual(caught(`WITH w AS (DELETE FROM public.t WHERE true RETURNING 1) SELECT 1`), []);
  assert.deepEqual(caught(`UPDATE public.t AS x SET a = 1 FROM u WHERE u.id = x.id;`), []);
  assert.deepEqual(caught(`INSERT INTO t VALUES (1) ON CONFLICT (id) DO UPDATE SET a = 1;`), []);
  assert.deepEqual(caught(`SELECT 1 FROM t FOR UPDATE; -- DELETE FROM t;`), []);
  assert.deepEqual(caught(`RAISE NOTICE 'DELETE FROM t;'; /* UPDATE t SET a = 1; */`), []);
});

// ── 1. no function the replay ends with carries an unqualified write ───────

test('no public function body ends the replay with a DELETE or UPDATE that has no WHERE', async () => {
  const r = await db.query<{ fn: string; src: string }>(
    `SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS fn,
            p.prosrc AS src
       FROM pg_proc p
       JOIN pg_namespace ns ON ns.oid = p.pronamespace
       JOIN pg_language l ON l.oid = p.prolang
      WHERE ns.nspname = 'public' AND l.lanname IN ('plpgsql', 'sql')`,
  );
  // An inert scan passes everything — so prove it read real bodies and real
  // write statements before trusting its "none".
  assert.ok(r.rows.length > 300, `read only ${r.rows.length} function bodies`);
  let seen = 0;
  const offenders: string[] = [];
  for (const { fn, src } of r.rows) {
    const writes = writeStatements(src);
    seen += writes.length;
    for (const w of writes) if (!w.hasWhere) offenders.push(`${fn}: ${w.kind} ${w.target}`);
  }
  assert.ok(seen > 150, `the scan recognised only ${seen} DELETE/UPDATE statements`);
  assert.deepEqual(
    offenders,
    [],
    `These run through the API, where safeupdate refuses a write with no WHERE ` +
      `("DELETE requires a WHERE clause"). Say what you mean — ` +
      `\`WHERE true\` for every row:\n  ${offenders.join('\n  ')}`,
  );

  for (const fn of REBUILDS) {
    const src = r.rows.find((x) => x.fn === `${fn}()`)?.src;
    assert.ok(src, `${fn}() is missing from the replay`);
    assert.ok(
      writeStatements(src).some((w) => w.kind === 'DELETE' && w.hasWhere),
      `${fn}() no longer wipes its table — the rebuild changed shape; re-read ${MIGRATION_FILE}`,
    );
  }
});

// ── 2. each rebuild runs, clears what was stale, and writes what it says ───

test('refresh_demand_radar_rollups: the background job completes and rebuilds the rollup', async () => {
  await seed();
  await db.query(
    `INSERT INTO public.demand_radar_rollups (region, month_bucket, event_type, style, inquiry_count)
     VALUES ('stale-region', '2020-01-01', 'stale', 'ORIG', 99)`,
  );
  const written = await asService(async () => {
    const r = await db.query<{ n: number }>(`SELECT public.refresh_demand_radar_rollups() AS n`);
    return r.rows[0]!.n;
  });
  const rows = await db.query<{ region: string; booking_count: number }>(
    `SELECT region, booking_count FROM public.demand_radar_rollups ORDER BY region`,
  );
  assert.ok(written >= 1, `wrote ${written} rows`);
  assert.equal(rows.rows.length, written, 'the count it returns is the rows it left');
  assert.ok(!rows.rows.some((x) => x.region === 'stale-region'), 'the stale row survived the wipe');
  assert.ok(
    rows.rows.some((x) => x.region === 'wipe-test-region' && x.booking_count === 1),
    'the seeded booking is not in the rollup',
  );
});

test('recompute_market_price_bands: the background job completes and rebuilds the bands', async () => {
  await seed();
  await db.query(
    `INSERT INTO public.market_price_bands
       (category, region_slug, pax_bucket, low_php, median_php, high_php, sample_n, computed_at)
     VALUES ('stale', 'stale-region', 'any', 1, 2, 3, 9, NOW())`,
  );
  const written = await asService(async () => {
    const r = await db.query<{ n: number }>(`SELECT public.recompute_market_price_bands() AS n`);
    return r.rows[0]!.n;
  });
  const rows = await db.query<{ category: string; region_slug: string; median_php: string; sample_n: number }>(
    `SELECT category, region_slug, median_php::text, sample_n FROM public.market_price_bands`,
  );
  assert.ok(written >= 1, `wrote ${written} rows`);
  assert.equal(rows.rows.length, written, 'the count it returns is the rows it left');
  assert.ok(!rows.rows.some((x) => x.category === 'stale'), 'the stale band survived the wipe');
  const band = rows.rows.find((x) => x.region_slug === 'wipe-test-region' && x.category === 'photographer');
  assert.ok(band, `the ${shops.length} seeded shops produced no band`);
  assert.equal(band.sample_n, shops.length);
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = (sorted.length - 1) / 2;
  const median = (sorted[Math.floor(mid)]! + sorted[Math.ceil(mid)]!) / 2;
  assert.equal(Number(band.median_php), Math.round(median));
});

test('recompute_market_funnel_bands: the admin "Run now" completes and clears stale bands', async () => {
  await db.query(
    `INSERT INTO public.market_funnel_bands (category, region_slug, pax_bucket, reply_rate_p50, sample_n)
     VALUES ('stale', 'stale-region', 'any', 50, 9)`,
  );
  const written = await asAdmin(adminUid, async () => {
    const r = await db.query<{ n: number }>(`SELECT public.recompute_market_funnel_bands() AS n`);
    return r.rows[0]!.n;
  });
  const rows = await db.query<{ category: string }>(`SELECT category FROM public.market_funnel_bands`);
  assert.equal(rows.rows.length, written, 'the count it returns is the rows it left');
  assert.ok(!rows.rows.some((x) => x.category === 'stale'), 'the stale band survived the wipe');
});
