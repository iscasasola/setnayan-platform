/**
 * THE YEAR KNOWS WHEN EACH CELEBRATION IS.
 *
 * Phase 7c adds public.cluster_timeline() — the read side of the planning
 * surface. Two things about it can break silently, so both are pinned here.
 *
 * 🪤 1. `events.event_date` IS NOT A DATE. For 'year' and 'month' precision it
 *    holds a FIRST-OF-RANGE PLACEHOLDER (20260603100000, verbatim: "event_date
 *    stores the first-day-of-range placeholder ('2027-01-01' for year …)").
 *    So a plain `ORDER BY event_date` sorts "Sometime in 2027" as if the host
 *    had said New Year's Day, and the year opens with the one celebration
 *    nobody has actually scheduled.
 *
 *    🔑 THE ORDERING TEST BELOW IS BUILT SO THAT SORT IS RED. Its three
 *    celebrations are chosen so the naive key and the honest key disagree:
 *      naive  ORDER BY event_date → year(2027-01-01) · wedding(2027-03-05) · shower(2027-08-01)
 *      honest ORDER BY midpoint   → wedding(Mar 5)   · year(~Jul 2)         · shower(~Aug 16)
 *    A fixture where both agree would pass against the defect, which is the
 *    only reason these particular dates were picked.
 *
 * 🔒 2. IT MUST DISCLOSE NOTHING 7a DOES NOT. cluster_timeline is SECURITY
 *    INVOKER precisely so it inherits event_cluster_members_read (owner or
 *    COUPLE member — deliberately not current_event_ids()). A SECURITY DEFINER
 *    "optimisation" would hand a shower GUEST the fact that the shower belongs
 *    to a group, plus the names and dates of every other celebration in it.
 *    The refusal tests below assert ZERO ROWS, never a throw: under RLS a
 *    refused read is filtered, not raised, so a denial and a no-op are the same
 *    value and only the outcome is worth asserting.
 *
 * ⛔ And the span is DERIVED here and stored NOWHERE — no column is added by
 *    7c. `no cluster table gained a span column` below is the guard on that.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

type EventSpec = {
  name: string;
  date: string | null;
  precision: 'year' | 'month' | 'day';
  endDate?: string | null;
};

/** Creates a celebration with `coupleId` as its couple member. */
async function newEvent(spec: EventSpec, coupleId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_end_date, event_date_precision)
     VALUES ($1,'celebration',$2,$3,$4) RETURNING event_id`,
    [spec.name, spec.date, spec.endDate ?? null, spec.precision],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple')`,
    [eventId, coupleId],
  );
  return eventId;
}

async function newCluster(ownerId: string, name: string): Promise<string> {
  const c = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1,$2) RETURNING event_cluster_id`,
    [ownerId, name],
  );
  return c.rows[0]!.event_cluster_id;
}

async function link(clusterId: string, eventId: string, isAnchor = false): Promise<void> {
  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, is_anchor)
     VALUES ($1,$2,$3)`,
    [clusterId, eventId, isAnchor],
  );
}

type TimelineRow = {
  event_id: string;
  display_name: string;
  event_type: string;
  event_date: string | null;
  event_end_date: string | null;
  event_date_precision: string;
  is_anchor: boolean;
  range_start: string | null;
  range_end: string | null;
  sort_key: string | null;
};

async function timeline(clusterId: string, uid: string): Promise<TimelineRow[]> {
  return asUser(uid, async () => {
    const r = await db.query<TimelineRow>(
      `SELECT * FROM public.cluster_timeline($1)`,
      [clusterId],
    );
    return r.rows;
  });
}

/** `DATE` comes back from PGlite as a Date; normalise to YYYY-MM-DD. */
function ymd(v: string | null): string | null {
  if (v === null || v === undefined) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`;
}

/* ── ordering: the placeholder date must not become a position ───────────── */

test('a "Sometime in 2027" celebration does not sort as if it were New Year\'s Day', async () => {
  const me = await newUser('timeline-order@example.com');
  const cluster = await newCluster(me, 'Our year');

  // Chosen so the naive key and the honest key DISAGREE — see the file header.
  const vague = await newEvent(
    { name: 'Somewhere in the year', date: '2027-01-01', precision: 'year' },
    me,
  );
  const wedding = await newEvent(
    { name: 'The wedding', date: '2027-03-05', precision: 'day' },
    me,
  );
  const shower = await newEvent(
    { name: 'The shower', date: '2027-08-01', precision: 'month' },
    me,
  );

  await link(cluster, vague);
  await link(cluster, wedding, true);
  await link(cluster, shower);

  const rows = await timeline(cluster, me);
  assert.deepEqual(
    rows.map((r) => r.display_name),
    ['The wedding', 'Somewhere in the year', 'The shower'],
    'the year-precision celebration was placed by its placeholder date, not by the window it actually claims',
  );

  // And the window itself is reported, so the screen can draw the uncertainty
  // instead of flattening it to a point.
  const vagueRow = rows.find((r) => r.event_id === vague)!;
  assert.equal(ymd(vagueRow.range_start), '2027-01-01');
  assert.equal(ymd(vagueRow.range_end), '2027-12-31', 'a year-precision celebration spans its whole year');

  const showerRow = rows.find((r) => r.event_id === shower)!;
  assert.equal(ymd(showerRow.range_start), '2027-08-01');
  assert.equal(ymd(showerRow.range_end), '2027-08-31', 'a month-precision celebration spans its whole month');

  const weddingRow = rows.find((r) => r.event_id === wedding)!;
  assert.equal(ymd(weddingRow.range_start), '2027-03-05');
  assert.equal(ymd(weddingRow.range_end), '2027-03-05', 'a day-precision single-day celebration is one day wide');
  assert.equal(weddingRow.is_anchor, true, 'the anchor did not survive the read');
  assert.equal(
    rows.filter((r) => r.is_anchor).length,
    1,
    'exactly one anchor should come back',
  );
});

test('a multi-day celebration reports its tail, and is still ONE row', async () => {
  const me = await newUser('timeline-multiday@example.com');
  const cluster = await newCluster(me, 'A long weekend and a wedding');
  const trip = await newEvent(
    { name: 'The prenup getaway', date: '2027-05-01', endDate: '2027-05-04', precision: 'day' },
    me,
  );
  await link(cluster, trip);

  const rows = await timeline(cluster, me);
  assert.equal(rows.length, 1, 'a multi-day celebration is ONE celebration with days, never one row per day');
  assert.equal(ymd(rows[0]!.range_start), '2027-05-01');
  assert.equal(ymd(rows[0]!.range_end), '2027-05-04', 'event_end_date did not reach the timeline');
});

test('an undated celebration sorts LAST, not first', async () => {
  const me = await newUser('timeline-undated@example.com');
  const cluster = await newCluster(me, 'Mostly decided');
  const someday = await newEvent({ name: 'Someday, the reunion', date: null, precision: 'year' }, me);
  const booked = await newEvent({ name: 'The booked one', date: '2029-11-20', precision: 'day' }, me);
  await link(cluster, someday);
  await link(cluster, booked);

  const rows = await timeline(cluster, me);
  assert.deepEqual(
    rows.map((r) => r.display_name),
    ['The booked one', 'Someday, the reunion'],
    'a celebration nobody has scheduled opened the year',
  );
  assert.equal(rows[1]!.range_start, null);
  assert.equal(rows[1]!.range_end, null);
});

/* ── disclosure: the timeline may not say more than 7a's membership does ─── */

test('a stranger reads an empty timeline', async () => {
  const me = await newUser('timeline-owner@example.com');
  const stranger = await newUser('timeline-stranger@example.com');
  const cluster = await newCluster(me, 'Not yours');
  const wedding = await newEvent({ name: 'Our wedding', date: '2027-06-06', precision: 'day' }, me);
  await link(cluster, wedding, true);

  assert.equal((await timeline(cluster, me)).length, 1, 'the owner cannot read their own year');
  assert.equal(
    (await timeline(cluster, stranger)).length,
    0,
    'a stranger read somebody else\'s year',
  );
});

test('a mere GUEST of one celebration never learns the cluster around it', async () => {
  const me = await newUser('timeline-host@example.com');
  const guest = await newUser('timeline-guest@example.com');
  const cluster = await newCluster(me, 'The whole year');
  const shower = await newEvent({ name: 'The shower', date: '2027-04-04', precision: 'day' }, me);
  const wedding = await newEvent({ name: 'The wedding', date: '2027-09-09', precision: 'day' }, me);
  await link(cluster, shower);
  await link(cluster, wedding, true);

  // This person is at the shower — but as a guest, not as the couple.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'guest')`,
    [shower, guest],
  );

  const rows = await timeline(cluster, guest);
  assert.equal(
    rows.length,
    0,
    'a shower guest learned the shower belongs to a group, and saw the rest of the year with it',
  );
});

/* ── the span stays derived, and the cluster stays a label ───────────────── */

test('no cluster table gained a span column', async () => {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('event_clusters','event_cluster_members')`,
  );
  const STORED_SPAN = /^(year|season|starts_on|ends_on|start_date|end_date|span|timeline)$/i;
  const offenders = cols.rows.filter((r) => STORED_SPAN.test(r.column_name));
  assert.deepEqual(
    offenders,
    [],
    'the span must be DERIVED at read time — a stored span goes stale the first time a date moves (7a)',
  );
});

test('cluster_timeline is SECURITY INVOKER and off the anon RPC surface', async () => {
  const r = await db.query<{ secdef: boolean; acl: string | null }>(
    `SELECT p.prosecdef AS secdef, array_to_string(p.proacl,',') AS acl
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'cluster_timeline'`,
  );
  assert.equal(r.rows.length, 1, 'cluster_timeline is missing');
  assert.equal(
    r.rows[0]!.secdef,
    false,
    'SECURITY DEFINER would bypass event_cluster_members_read and hand a guest the whole year',
  );
  const acl = r.rows[0]!.acl ?? '';
  assert.ok(!/(^|,)anon=/.test(acl), `anon holds EXECUTE on cluster_timeline: ${acl}`);
  assert.ok(/authenticated=X/.test(acl), `authenticated is missing EXECUTE: ${acl}`);
});

test('the timeline touches no pot', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'cluster_timeline'`,
  );
  const def = r.rows[0]!.def;
  // The body, not the comment block: value words must not appear in the SQL.
  const body = def.slice(def.indexOf('AS $function$'));
  for (const word of ['papic', 'points', 'credits', 'shots', 'amount', 'guest_count']) {
    assert.ok(
      !new RegExp(word, 'i').test(body),
      `cluster_timeline's body names "${word}" — a cluster is a label, never a container of value`,
    );
  }
});
