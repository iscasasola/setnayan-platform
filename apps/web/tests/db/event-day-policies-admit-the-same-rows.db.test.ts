/**
 * EVENT-DAY POLICY REWRITE — every rewritten policy admits and refuses EXACTLY
 * the rows it did before.
 *
 * Migration `20271274849201_event_day_policies_read_the_caller_once.sql` wraps
 * `auth.uid()` / `auth.jwt()` / `auth.role()` / `is_admin()` as `(select …)` in
 * 37 policies on the fifteen tables an event day hits hardest, so Postgres reads
 * the caller once per query instead of once per row. It is a speed change and
 * MUST NOT be a permission change. Three independent proofs, all against the
 * real migration corpus replayed into PGlite:
 *
 *   1. TEXT — the database is replayed up to (not including) the migration,
 *      every policy on the fifteen tables is captured, the REAL file is applied,
 *      and every policy is captured again. The 37 targeted predicates must equal
 *      their old text with exactly that wrapping and nothing else; every other
 *      policy must be byte-identical; no policy may appear, vanish, or change
 *      mode / command / roles.
 *
 *   2. WHY WRAPPING CANNOT CHANGE AN ANSWER — each wrapped function takes no
 *      argument and is STABLE, so within one statement it returns one value; the
 *      InitPlan runs inside that statement with the same snapshot. The test pins
 *      that premise (arity 0, provolatile 's') — if someone made is_admin()
 *      VOLATILE, the equivalence argument would no longer hold and this fails.
 *
 *   3. BEHAVIOUR — six callers (the couple, a guest, a coordinator who is also a
 *      moderator, a stranger who runs a different event, an admin, and an
 *      anonymous-sign-in user) each read, update, delete and insert on all
 *      fourteen tables that carry a rewritten policy, BEFORE and AFTER. Every
 *      outcome (the exact rows seen, the rows an UPDATE/DELETE touches, or the
 *      exact error) must be identical. Writes run in a transaction that is rolled
 *      back, so each probe sees the same seed.
 *
 * 🔑 NOT VACUOUS: a META test asserts the probes ran as `authenticated` (no
 * BYPASSRLS, not the owner), and that across the personas every one of the
 * fourteen tables shows at least one caller who sees some rows and one who sees
 * fewer than all of them — so "identical" can never be "everyone saw nothing".
 *
 * 🛡 SABOTAGE-CHECKED (2026-10-18), each on a scratch edit of the migration:
 *   • `orders_owner_read` widened by `OR true`            → the migration's own
 *     self-check refuses to commit ("changed more than the wrapping");
 *   • same widening with the self-check deleted           → TEXT and BEHAVIOUR fail;
 *   • `notifications_recipient_read` left unwrapped        → TEXT fails ("still
 *     calls auth.uid() per row") while BEHAVIOUR stays green — which is why the
 *     text proof exists: the speed fix is invisible to a row comparison.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import fs from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';

import { MIGRATIONS_DIR, createReplayedDb, versionOf } from './replay-migrations';

const POLICY_FILE = '20271274849201_event_day_policies_read_the_caller_once.sql';
const INDEX_FILE = '20271275124348_event_day_indexes_and_duplicate_drops.sql';

const HOT_TABLES = [
  'events',
  'event_members',
  'event_moderators',
  'guests',
  'orders',
  'payments',
  'notifications',
  'papic_photos',
  'papic_guest_captures',
  'papic_mission_completions',
  'papic_missions',
  'papic_limited_snapshots',
  'papic_seat_day_usage',
  'vendor_profiles',
  'event_vendors',
] as const;

/** The tables that carry at least one rewritten policy (event_vendors carries none). */
const PROBED_TABLES = HOT_TABLES.filter((t) => t !== 'event_vendors');

const WRAPPED_FNS = ['auth.uid()', 'auth.jwt()', 'auth.role()', 'is_admin()'] as const;

/** Old text → the text the migration must produce. Unwrap first, so it is idempotent. */
function wrapCaller(expr: string | null): string | null {
  if (expr === null) return null;
  let e = expr;
  e = e
    .split('( SELECT auth.uid() AS uid)').join('auth.uid()')
    .split('( SELECT auth.jwt() AS jwt)').join('auth.jwt()')
    .split('( SELECT auth.role() AS role)').join('auth.role()')
    .split('( SELECT is_admin() AS is_admin)').join('is_admin()');
  e = e
    .split('auth.uid()').join('( SELECT auth.uid() AS uid)')
    .split('auth.jwt()').join('( SELECT auth.jwt() AS jwt)')
    .split('auth.role()').join('( SELECT auth.role() AS role)')
    .replace(/(?<![\w.])is_admin\(\)/g, '( SELECT is_admin() AS is_admin)');
  return e;
}

function mentionsCaller(expr: string | null): boolean {
  return expr !== null && /auth\.(uid|jwt|role)\(\)|(?<![\w.])is_admin\(\)/.test(expr);
}

type Pol = {
  tbl: string;
  pol: string;
  permissive: boolean;
  cmd: string;
  roles: string;
  qual: string | null;
  chk: string | null;
};

let db: PGlite;

const P = {
  host: '',
  guest: '',
  coordinator: '',
  stranger: '',
  admin: '',
  anonUser: '',
};
const ids: Record<string, string> = {};

async function policies(): Promise<Pol[]> {
  const r = await db.query<Pol>(
    `SELECT c.relname AS tbl, p.polname AS pol, p.polpermissive AS permissive, p.polcmd::text AS cmd,
            coalesce((SELECT string_agg(ro.rolname, ',' ORDER BY ro.rolname)
                        FROM pg_roles ro WHERE ro.oid = ANY (p.polroles)), 'PUBLIC') AS roles,
            pg_get_expr(p.polqual, p.polrelid) AS qual,
            pg_get_expr(p.polwithcheck, p.polrelid) AS chk
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
      ORDER BY 1, 2`,
    [HOT_TABLES as unknown as string[]],
  );
  return r.rows;
}

/** Run one statement as a signed-in caller inside a rolled-back transaction. */
async function asCaller(
  uid: string,
  sql: string,
  opts: { anonymous?: boolean } = {},
): Promise<string> {
  const claims = JSON.stringify({
    sub: uid,
    role: 'authenticated',
    is_anonymous: opts.anonymous === true,
  });
  await db.exec('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec('SET LOCAL ROLE authenticated');
    try {
      const r = await db.query<{ k: string }>(sql);
      const keys = r.rows.map((x) => String(x.k)).sort();
      return `ok:${r.rows.length}:${keys.join(',')}`;
    } catch (e) {
      return `err:${((e as Error).message ?? String(e)).split('\n')[0]}`;
    }
  } finally {
    await db.exec('ROLLBACK');
  }
}

/**
 * A row's identity: its PRIMARY KEY columns as text. Not the whole row — column
 * grants hide some columns of events / vendor_profiles / event_moderators from
 * `authenticated`, and a whole-row read would turn every probe into the same
 * "permission denied". Filled in from pg_index before the first probe.
 */
const PK: Record<string, string> = {};
const ROWKEY = (table: string, alias: string) => `(${PK[table]!.split(',').map((c) => `${alias}.${c}`).join(` || '/' || `)})::text AS k`;

const INSERTS: Record<string, (uid: string) => string> = {
  events_private: () =>
    `INSERT INTO public.events (display_name, event_type, landing_page_visibility) VALUES ('probe', 'birthday', 'private') RETURNING 'x' AS k`,
  events_public: () =>
    `INSERT INTO public.events (display_name, event_type, landing_page_visibility) VALUES ('probe', 'birthday', 'public') RETURNING 'x' AS k`,
  event_members_e1: (uid) =>
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ('${ids.e1}', '${uid}', 'guest') ON CONFLICT DO NOTHING RETURNING 'x' AS k`,
  orders_draft: (uid) =>
    `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code, status)
     VALUES ('${uid}', '${ids.e1}', 'probe', 1, 'PROBE-D-' || md5(random()::text), 'draft') RETURNING 'x' AS k`,
  orders_paid: (uid) =>
    `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code, status)
     VALUES ('${uid}', '${ids.e1}', 'probe', 1, 'PROBE-P-' || md5(random()::text), 'paid') RETURNING 'x' AS k`,
  payments_pending: (uid) =>
    `INSERT INTO public.payments (user_id, order_id, amount_php, channel, status)
     VALUES ('${uid}', '${ids.orderHost}', 1, 'gcash', 'pending') RETURNING 'x' AS k`,
  payments_other_user: () =>
    `INSERT INTO public.payments (user_id, order_id, amount_php, channel, status)
     VALUES ('${P.host}', '${ids.orderHost}', 1, 'gcash', 'pending') RETURNING 'x' AS k`,
  vendor_profiles_self: (uid) =>
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ('${uid}', 'probe') RETURNING 'x' AS k`,
};

/** Every probe, for one caller. */
async function probeAll(uid: string, anonymous = false): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const t of PROBED_TABLES) {
    out[`${t}:select`] = await asCaller(uid, `SELECT ${ROWKEY(t, 't')} FROM public.${t} t`, { anonymous });
    out[`${t}:update`] = await asCaller(uid, `${UPDATE_PROBES[t]!} RETURNING ${ROWKEY(t, 't')}`, { anonymous });
    out[`${t}:delete`] = await asCaller(uid, `DELETE FROM public.${t} t RETURNING ${ROWKEY(t, 't')}`, { anonymous });
  }
  for (const [name, mk] of Object.entries(INSERTS)) {
    out[`insert:${name}`] = await asCaller(uid, mk(uid), { anonymous });
  }
  out['rpc:count_unread_message_threads'] = await asCaller(
    uid,
    `SELECT public.count_unread_message_threads()::text AS k`,
    { anonymous },
  );
  return out;
}

/**
 * An UPDATE that writes a column back to itself — admitted rows are counted,
 * nothing changes. The column is one `authenticated` holds UPDATE on, so the
 * probe reaches the row policy instead of stopping at a column grant.
 */
const UPDATE_PROBES: Record<string, string> = {
  events: `UPDATE public.events t SET display_name = t.display_name`,
  event_members: `UPDATE public.event_members t SET member_type = t.member_type`,
  event_moderators: `UPDATE public.event_moderators t SET role_subtype = t.role_subtype`,
  guests: `UPDATE public.guests t SET first_name = t.first_name`,
  orders: `UPDATE public.orders t SET description = t.description`,
  payments: `UPDATE public.payments t SET channel = t.channel`,
  notifications: `UPDATE public.notifications t SET title = t.title`,
  papic_photos: `UPDATE public.papic_photos t SET hidden_at = t.hidden_at`,
  papic_guest_captures: `UPDATE public.papic_guest_captures t SET guest_id = t.guest_id`,
  papic_mission_completions: `UPDATE public.papic_mission_completions t SET status = t.status`,
  papic_missions: `UPDATE public.papic_missions t SET prompt = t.prompt`,
  papic_limited_snapshots: `UPDATE public.papic_limited_snapshots t SET guest_count = t.guest_count`,
  papic_seat_day_usage: `UPDATE public.papic_seat_day_usage t SET usage_date = t.usage_date`,
  vendor_profiles: `UPDATE public.vendor_profiles t SET business_name = t.business_name`,
};

async function enumFirst(type: string): Promise<string> {
  const r = await db.query<{ v: string }>(`SELECT (enum_range(NULL::public.${type}))[1]::text AS v`);
  return r.rows[0]!.v;
}

async function ins(table: string, row: Record<string, unknown>, returning = 'NULL'): Promise<string> {
  const cols = Object.keys(row);
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.${table} (${cols.join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${returning}::text AS id`,
    cols.map((c) => row[c]),
  );
  return r.rows[0]!.id;
}

let before_: Pol[] = [];
let after_: Pol[] = [];
const outcomesBefore: Record<string, Record<string, string>> = {};
const outcomesAfter: Record<string, Record<string, string>> = {};
let fileApplied = false;

before(async () => {
  const policyVersion = versionOf(POLICY_FILE);
  const earlier = new Set(
    fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map(versionOf)
      .filter((v) => v < policyVersion),
  );
  const replay = await createReplayedDb({ only: earlier });
  db = replay.db;

  // ── people (the auth trigger provisions public.users) ──────────────────────
  const mk = async (email: string): Promise<string> => {
    const u = await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email]);
    return u.rows[0]!.id;
  };
  P.host = await mk('edp-host@example.com');
  P.guest = await mk('edp-guest@example.com');
  P.coordinator = await mk('edp-coordinator@example.com');
  P.stranger = await mk('edp-stranger@example.com');
  P.admin = await mk('edp-admin@example.com');
  P.anonUser = await mk('edp-anon@example.com');
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [P.admin]);

  // ── the seed: FK checks and triggers off, so every table can hold rows of BOTH
  // events without dragging in its whole dependency graph. RLS is what is under
  // test; it reads the rows, not how they got there. ────────────────────────
  await db.exec(`SET session_replication_role = replica`);
  const side = await enumFirst('guest_side');
  const group = await enumFirst('guest_group_category');
  const ntype = await enumFirst('notification_type');

  ids.e1 = await ins('events', { display_name: 'EDP One', event_type: 'birthday' }, 'event_id');
  ids.e2 = await ins('events', { display_name: 'EDP Two', event_type: 'birthday' }, 'event_id');
  for (const [e, u, t] of [
    [ids.e1, P.host, 'couple'],
    [ids.e1, P.guest, 'guest'],
    [ids.e1, P.coordinator, 'coordinator'],
    [ids.e2, P.stranger, 'couple'],
  ] as const) {
    await ins('event_members', { event_id: e, user_id: u, member_type: t });
  }
  await ins('event_moderators', {
    event_id: ids.e1, user_id: P.coordinator, role_subtype: 'wedding_planner_external',
    permissions_json: '{}', accepted_at: new Date().toISOString(),
  });
  await ins('event_moderators', {
    event_id: ids.e2, user_id: P.stranger, role_subtype: 'wedding_planner_external',
    permissions_json: '{}', accepted_at: new Date().toISOString(),
  });

  ids.g1 = await ins('guests', { event_id: ids.e1, first_name: 'A', last_name: 'One', side, group_category: group }, 'guest_id');
  ids.g2 = await ins('guests', { event_id: ids.e1, first_name: 'B', last_name: 'Two', side, group_category: group }, 'guest_id');
  ids.g3 = await ins('guests', { event_id: ids.e2, first_name: 'C', last_name: 'Three', side, group_category: group }, 'guest_id');

  for (const u of [P.host, P.guest, P.stranger]) {
    await ins('notifications', { user_id: u, type: ntype, title: `for ${u}` });
  }

  ids.orderHost = await ins('orders', {
    user_id: P.host, event_id: ids.e1, description: 'host order', requested_total_php: 100,
    reference_code: 'EDP-1', status: 'draft',
  }, 'order_id');
  await ins('orders', {
    user_id: P.guest, event_id: ids.e1, description: 'guest order', requested_total_php: 100,
    reference_code: 'EDP-2', status: 'draft',
  });
  ids.orderStranger = await ins('orders', {
    user_id: P.stranger, event_id: ids.e2, description: 'stranger order', requested_total_php: 100,
    reference_code: 'EDP-3', status: 'draft',
  }, 'order_id');
  await ins('payments', { user_id: P.host, order_id: ids.orderHost, amount_php: 100, channel: 'gcash', status: 'pending' });
  await ins('payments', { user_id: P.stranger, order_id: ids.orderStranger, amount_php: 100, channel: 'gcash', status: 'pending' });

  ids.vpStranger = await ins('vendor_profiles', { user_id: P.stranger, business_name: 'Stranger Shop' }, 'vendor_profile_id');
  await ins('vendor_profiles', { user_id: null, business_name: 'Unclaimed Shop' });

  ids.s1 = await ins('paparazzi_seats', {
    event_id: ids.e1, seat_index: 1, sku_code: 'PROBE', claim_qr_token: 'edp-q1', claimer_user_id: P.guest,
  }, 'seat_id');
  ids.s2 = await ins('paparazzi_seats', {
    event_id: ids.e2, seat_index: 1, sku_code: 'PROBE', claim_qr_token: 'edp-q2', claimer_user_id: P.stranger,
  }, 'seat_id');
  await ins('papic_photos', { event_id: ids.e1, paparazzi_seat_id: ids.s1, r2_object_key: 'k1' });
  await ins('papic_photos', { event_id: ids.e2, paparazzi_seat_id: ids.s2, r2_object_key: 'k2' });
  await ins('papic_guest_captures', { event_id: ids.e1, guest_id: ids.g1 });
  await ins('papic_guest_captures', { event_id: ids.e2, guest_id: ids.g3 });
  ids.m1 = await ins('papic_missions', { event_id: ids.e1, mission_type: 'prompt', prompt: 'one' }, 'mission_id');
  ids.m2 = await ins('papic_missions', { event_id: ids.e2, mission_type: 'prompt', prompt: 'two' }, 'mission_id');
  await ins('papic_mission_completions', { mission_id: ids.m1, event_id: ids.e1, guest_id: ids.g1 });
  await ins('papic_mission_completions', { mission_id: ids.m2, event_id: ids.e2, guest_id: ids.g3 });
  for (const e of [ids.e1, ids.e2]) {
    await ins('papic_limited_snapshots', {
      event_id: e, guest_count: 10, rate_php: 1, cap_php: 1, frozen_bill_php: 1, camera_cap: 1,
    });
  }
  await ins('papic_seat_day_usage', { event_id: ids.e1, seat_id: ids.s1, usage_date: '2026-10-18' });
  await ins('papic_seat_day_usage', { event_id: ids.e2, seat_id: ids.s2, usage_date: '2026-10-18' });

  // The unread badge's RPC: one thread on E1 with a message from the shop.
  ids.t1 = await ins('chat_threads', { event_id: ids.e1, vendor_profile_id: ids.vpStranger }, 'thread_id');
  await ins('chat_messages', {
    thread_id: ids.t1, event_id: ids.e1, vendor_profile_id: ids.vpStranger,
    sender_role: 'vendor', sender_user_id: P.stranger, body: 'hello',
  });
  await db.exec(`SET session_replication_role = origin`);

  // ── each probed table's primary key ───────────────────────────────────────
  const pks = await db.query<{ t: string; cols: string }>(
    `SELECT c.relname AS t, string_agg(a.attname, ',' ORDER BY k.ord) AS cols
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      WHERE i.indisprimary AND n.nspname = 'public' AND c.relname = ANY($1::text[])
      GROUP BY c.relname`,
    [PROBED_TABLES as unknown as string[]],
  );
  for (const r of pks.rows) PK[r.t] = r.cols;
  assert.deepEqual(Object.keys(PK).sort(), [...PROBED_TABLES].sort(), 'a probed table has no primary key');

  // ── BEFORE ────────────────────────────────────────────────────────────────
  before_ = await policies();
  for (const [name, uid] of Object.entries(P)) {
    outcomesBefore[name] = await probeAll(uid, name === 'anonUser');
  }

  // ── apply the REAL file (never a reconstruction of it) ─────────────────────
  await db.exec(fs.readFileSync(join(MIGRATIONS_DIR, POLICY_FILE), 'utf8'));
  fileApplied = true;

  // ── AFTER ─────────────────────────────────────────────────────────────────
  after_ = await policies();
  for (const [name, uid] of Object.entries(P)) {
    outcomesAfter[name] = await probeAll(uid, name === 'anonUser');
  }
});

after(async () => {
  await db?.close();
});

test('META: the probes run as `authenticated` — no BYPASSRLS, not the table owner', async () => {
  const r = await asCaller(
    P.guest,
    `SELECT current_user || '|' || (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user)::text
            || '|' || (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.orders'::regclass) AS k`,
  );
  const [cu, bypass, owner] = r.replace(/^ok:1:/, '').split('|');
  assert.equal(cu, 'authenticated', `SET ROLE did not take: ${r}`);
  assert.equal(bypass, 'false');
  assert.notEqual(owner, 'authenticated');
});

test('META: the seed discriminates on every probed table — "identical" is never "everyone saw nothing"', () => {
  const flat: string[] = [];
  for (const t of PROBED_TABLES) {
    const seen = Object.entries(outcomesBefore).map(([who, o]) => {
      const m = /^ok:(\d+):/.exec(o[`${t}:select`] ?? '');
      return { who, n: m ? Number(m[1]) : -1 };
    });
    const max = Math.max(...seen.map((s) => s.n));
    const min = Math.min(...seen.map((s) => s.n));
    if (!(max > 0 && min < max)) flat.push(`${t}: ${seen.map((s) => `${s.who}=${s.n}`).join(' ')}`);
  }
  assert.deepEqual(flat, [], `these tables did not separate the callers:\n  ${flat.join('\n  ')}`);
});

test('PREMISE: every wrapped function is STABLE and takes no argument', async () => {
  const r = await db.query<{ f: string; vol: string; nargs: number }>(
    `SELECT n.nspname || '.' || p.proname AS f, p.provolatile::text AS vol, p.pronargs AS nargs
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE (n.nspname = 'auth' AND p.proname IN ('uid', 'jwt', 'role'))
         OR (n.nspname = 'public' AND p.proname = 'is_admin')
      ORDER BY 1`,
  );
  assert.deepEqual(
    r.rows.map((x) => `${x.f}:${x.vol}:${x.nargs}`),
    ['auth.jwt:s:0', 'auth.role:s:0', 'auth.uid:s:0', 'public.is_admin:s:0'],
  );
});

test('TEXT: the 37 targeted predicates changed by exactly the wrapping; every other policy is byte-identical', () => {
  assert.ok(fileApplied, 'the migration file was not applied');
  const key = (p: Pol) => `${p.tbl}|${p.pol}`;
  const b = new Map(before_.map((p) => [key(p), p]));
  const a = new Map(after_.map((p) => [key(p), p]));
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort(), 'a policy appeared or vanished');
  assert.ok(b.size >= 60, `expected the 60 hot-table policies, saw ${b.size}`);

  const problems: string[] = [];
  let targeted = 0;
  for (const [k, old] of b) {
    const now = a.get(k)!;
    if (old.permissive !== now.permissive || old.cmd !== now.cmd || old.roles !== now.roles) {
      problems.push(`${k}: mode/command/roles changed`);
    }
    const isTarget = mentionsCaller(old.qual) || mentionsCaller(old.chk);
    if (isTarget) targeted += 1;
    const wantQ = isTarget ? wrapCaller(old.qual) : old.qual;
    const wantC = isTarget ? wrapCaller(old.chk) : old.chk;
    if (now.qual !== wantQ) problems.push(`${k} USING\n    want ${wantQ}\n    got  ${now.qual}`);
    if (now.chk !== wantC) problems.push(`${k} WITH CHECK\n    want ${wantC}\n    got  ${now.chk}`);
    for (const f of WRAPPED_FNS) {
      const bare = new RegExp(`(?<![\\w.])${f.replace(/[().]/g, '\\$&')}`);
      const stripped = `${now.qual ?? ''} ${now.chk ?? ''}`.replace(/\( SELECT [\w.]+\(\) AS \w+\)/g, '');
      if (bare.test(stripped)) problems.push(`${k}: still calls ${f} per row`);
    }
  }
  assert.equal(targeted, 37, 'the migration was written for 37 policies');
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('BEHAVIOUR: every caller reads, writes, deletes and inserts exactly the same rows before and after', () => {
  const diffs: string[] = [];
  for (const who of Object.keys(P)) {
    const b = outcomesBefore[who]!;
    const a = outcomesAfter[who]!;
    for (const k of Object.keys(b)) {
      if (b[k] !== a[k]) diffs.push(`${who} ${k}\n    before ${b[k]}\n    after  ${a[k]}`);
    }
  }
  assert.deepEqual(diffs, [], diffs.join('\n'));
});

test('BEHAVIOUR: the probes reach the policies under test (not one blanket error)', () => {
  // The couple must be able to read their own order, the stranger must not; the
  // anonymous-sign-in user must be refused a public event and allowed a private
  // one — the restrictive auth.jwt() policy, live.
  const ok = (s: string | undefined) => s?.startsWith('ok:') ?? false;
  const n = (s: string | undefined) => Number(/^ok:(\d+):/.exec(s ?? '')?.[1] ?? -1);
  const host = outcomesAfter.host!;
  const stranger = outcomesAfter.stranger!;
  const anonUser = outcomesAfter.anonUser!;
  assert.ok(n(host['orders:select']) >= 1, `couple read no orders: ${host['orders:select']}`);
  assert.ok(n(stranger['papic_photos:select']) >= 1, `seat claimer read no photos: ${stranger['papic_photos:select']}`);
  assert.ok(ok(anonUser['insert:events_private']), `anon user refused a private event: ${anonUser['insert:events_private']}`);
  assert.ok(!ok(anonUser['insert:events_public']), `anon user created a PUBLIC event: ${anonUser['insert:events_public']}`);
  assert.ok(!ok(host['insert:orders_paid']), `a customer inserted a PAID order: ${host['insert:orders_paid']}`);
  assert.equal(host['rpc:count_unread_message_threads'], 'ok:1:1', 'the couple should have one unread thread');
});

test('INDEX FILE: duplicates dropped, survivors still enforce uniqueness, new indexes exist', async () => {
  await db.exec(fs.readFileSync(join(MIGRATIONS_DIR, INDEX_FILE), 'utf8'));
  // Re-running is a no-op.
  await db.exec(fs.readFileSync(join(MIGRATIONS_DIR, INDEX_FILE), 'utf8'));
  const r = await db.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
        AND indexname IN ('event_moderators_user_id_idx', 'chat_messages_thread_created_idx',
                          'guests_event_guest_key', 'guests_event_guest_uniq',
                          'comp_grants_public_id_unique', 'comp_grants_public_id_key')
      ORDER BY 1`,
  );
  assert.deepEqual(r.rows.map((x) => x.indexname), [
    'chat_messages_thread_created_idx',
    'comp_grants_public_id_key',
    'event_moderators_user_id_idx',
    'guests_event_guest_uniq',
  ]);
  // (event_id, guest_id) is still unique, and the composite FKs still point at it.
  const fks = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_constraint
      WHERE contype = 'f' AND conindid = 'public.guests_event_guest_uniq'::regclass`,
  );
  assert.ok(fks.rows[0]!.n >= 1, 'no composite FK depends on guests_event_guest_uniq');
  const uniq = await db.query<{ u: boolean }>(
    `SELECT indisunique AS u FROM pg_index WHERE indexrelid = 'public.guests_event_guest_uniq'::regclass`,
  );
  assert.equal(uniq.rows[0]!.u, true);
});

