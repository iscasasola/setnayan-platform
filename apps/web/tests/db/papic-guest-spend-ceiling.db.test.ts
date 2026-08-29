/**
 * THE LIMIT BECOMES REAL — a per-guest credit ceiling that actually binds.
 *
 * ── WHY THIS FILE IS SUSPICIOUS OF ITSELF ─────────────────────────────────
 * FOUR limits have shipped on this exact surface governing nothing: the free
 * tier was unmetered for weeks; `papic_tier_config.points_per_day` is NULL on
 * every active tier; `vendor_papic_capture_configs.photo_cap` has no reader at
 * all; and the per-guest 150 is yielded on every pool event — which is EVERY
 * event, because the free 50-credit grant is armed on render.
 *
 * 🔑 SO A TEST THAT ASSERTS THE COLUMN EXISTS, OR THAT THE NUMBER WAS STORED,
 * PROVES NOTHING. Every test below that matters runs on an event with a REAL
 * pool applying — the precise condition under which the previous four went
 * inert — and asserts a capture is REFUSED.
 *
 * Migration: 20271184624871_papic_shots_per_guest_ceiling.sql
 * Run: cd apps/web && npx tsx --test tests/db/papic-guest-spend-ceiling.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

type Reply = {
  status: string;
  reason?: string;
  total?: number;
  used?: number;
  remaining?: number;
  unlimited?: boolean;
  ceiling?: number | null;
};

/** An event with a REAL shared pool — the condition four dead limits died in. */
async function seedPoolEvent(grantPoints = 5000, pax: number | null = null) {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type, estimated_pax)
     VALUES ($1, 'birthday', $2) RETURNING event_id`,
    [`ceiling test ${n}`, pax],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'ceiling test')`,
    [eventId, grantPoints],
  );
  return eventId;
}

async function seedGuest(eventId: string, name = 'Ana') {
  n += 1;
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                                ugc_terms_accepted_at)
     VALUES ($1, $2, 'Cruz', 'both', 'friends', NOW()) RETURNING guest_id`,
    [eventId, name],
  );
}

const shoot = (guestId: string, kind: 'photo' | 'clip' = 'photo', cost = 1) =>
  one<Reply>(
    `SELECT public.papic_record_guest_capture($1, $2, false, $3, $4, NULL, $5)`,
    [guestId, `r2://t/${Math.random()}`, kind, kind === 'clip' ? 10000 : null, cost],
  );

const ceilingOf = (guestId: string) =>
  one<number | null>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestId]);

const poolLeft = (eventId: string) =>
  one<number>(`SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId]);

const setCeiling = (eventId: string, points: number | null) =>
  db.query(
    `UPDATE public.events
        SET papic_guest_spend_ceiling_on = $2, papic_guest_spend_ceiling_points = $3
      WHERE event_id = $1`,
    [eventId, points !== null, points],
  );

// ══ 1 · INERT ON ARRIVAL ═══════════════════════════════════════════════════

test('off by default — the resolver says nothing and a capture behaves exactly as before', async () => {
  const eventId = await seedPoolEvent();
  const guestId = await seedGuest(eventId);

  assert.equal(await ceilingOf(guestId), null, 'a fresh celebration must have no ceiling');
  assert.equal(
    await one<boolean>(`SELECT papic_guest_spend_ceiling_on FROM public.events WHERE event_id = $1`, [eventId]),
    false,
    'the switch defaults OFF — a celebration must never quietly acquire a restriction',
  );

  const r = await shoot(guestId);
  assert.equal(r.status, 'ok');
  assert.equal(r.unlimited, true, 'the pool still stands the per-guest gate down when no ceiling is set');
  assert.equal(r.ceiling, null);
});

// ══ 2 · 🚨 THE HEADLINE — IT BINDS, ON A REAL POOL EVENT ═══════════════════

test('🚨 the ceiling REFUSES a capture on an event whose pool applies — the case four dead limits died in', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);

  const pool = await db.query<{ applies: boolean; total_points: number }>(
    `SELECT applies, total_points FROM public.papic_event_pool_status($1)`, [eventId],
  );
  assert.equal(pool.rows[0]!.applies, true, 'PRECONDITION: the pool must apply, or this test proves nothing');
  assert.ok(pool.rows[0]!.total_points >= 5000);

  await setCeiling(eventId, 3);
  assert.equal(await ceilingOf(guestId), 3);

  assert.equal((await shoot(guestId)).status, 'ok');
  assert.equal((await shoot(guestId)).status, 'ok');
  assert.equal((await shoot(guestId)).status, 'ok');

  const refused = await shoot(guestId);
  assert.equal(refused.status, 'quota_exhausted', 'the FOURTH capture must be refused');
  assert.equal(refused.reason, 'guest_spend_ceiling', 'and it must say WHICH limit refused');
  assert.equal(refused.total, 3);
  assert.equal(refused.remaining, 0);

  assert.ok(
    (await poolLeft(eventId)) >= 5000,
    'and the celebration still holds thousands of credits — that is the whole point of a per-guest ceiling',
  );
  assert.equal(
    await one<number>(`SELECT COUNT(*)::int FROM public.papic_guest_captures WHERE guest_id = $1`, [guestId]),
    3,
    'a refused capture must not land a row',
  );
});

test('the ceiling binds even on an event that bought PAPIC_UNLOCK — that pass lifts OUR limit, not the couple’s', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);
  n += 1;
  // public.users.user_id FKs to auth.users(id); a trigger mirrors the row, so
  // the auth insert alone is enough.
  const userId = await one<string>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`ceiling-${n}@example.test`],
  );
  await db.query(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'PAPIC_UNLOCK', 'Unlock all of Papic', 1, 'paid', $3)`,
    [eventId, userId, `CEIL-${n}`],
  );
  await setCeiling(eventId, 1);

  assert.equal((await shoot(guestId)).status, 'ok');
  const refused = await shoot(guestId);
  assert.equal(refused.status, 'quota_exhausted');
  assert.equal(refused.reason, 'guest_spend_ceiling');
});

// ══ 3 · THE METER IS IN CREDITS, NOT ROWS ══════════════════════════════════

test('a ten-second clip spends 8 of the ceiling, not 1 — rows are not credits', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);
  await setCeiling(eventId, 10);

  const clip = await shoot(guestId, 'clip', 8);
  assert.equal(clip.status, 'ok');
  assert.equal(clip.used, 8, 'ONE row, EIGHT credits');
  assert.equal(clip.remaining, 2);

  assert.equal((await shoot(guestId, 'photo', 1)).status, 'ok');
  assert.equal((await shoot(guestId, 'photo', 1)).status, 'ok');
  assert.equal(
    (await shoot(guestId, 'photo', 1)).status,
    'quota_exhausted',
    '8 + 1 + 1 = 10 is the ceiling; the eleventh credit is refused',
  );
});

test('the cost is stored as the caller charged it, and a zero cost is floored at 1', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);
  await shoot(guestId, 'clip', 8);
  await shoot(guestId, 'photo', 0);

  const costs = await db.query<{ media_type: string; points_cost: number }>(
    `SELECT media_type, points_cost FROM public.papic_guest_captures
      WHERE guest_id = $1 ORDER BY id`, [guestId],
  );
  assert.deepEqual(
    costs.rows.map((r) => [r.media_type, r.points_cost]),
    [['clip', 8], ['photo', 1]],
    'the clip band came from the caller (the ONE place that owns it) and a 0 was floored',
  );
});

test('hiding a capture must never reset the meter', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);
  await setCeiling(eventId, 2);

  await shoot(guestId);
  await shoot(guestId);
  await db.query(`UPDATE public.papic_guest_captures SET hidden_at = NOW() WHERE guest_id = $1`, [guestId]);

  assert.equal(
    (await shoot(guestId)).status,
    'quota_exhausted',
    'hiding two captures would otherwise hand the guest their allowance back — the reset attack (#4867)',
  );
});

// ══ 4 · THE THREE TIERS ════════════════════════════════════════════════════

test('a named guest gets her own figure, and it beats the number set for everyone else', async () => {
  const eventId = await seedPoolEvent(5000);
  const named = await seedGuest(eventId, 'Named');
  const other = await seedGuest(eventId, 'Other');
  await setCeiling(eventId, 5);
  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 40)`, [eventId, named]);

  assert.equal(await ceilingOf(named), 40);
  assert.equal(await ceilingOf(other), 5);
});

test('the release opens the equal share and the excess — and NEVER a named guest’s own credits (owner 7c)', async () => {
  const eventId = await seedPoolEvent(5000);
  const named = await seedGuest(eventId, 'Named');
  const other = await seedGuest(eventId, 'Other');
  await setCeiling(eventId, 5);
  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 40)`, [eventId, named]);

  await one(`SELECT public.papic_set_guest_spend_ceiling_release($1, TRUE)`, [eventId]);
  assert.equal(await ceilingOf(other), null, 'tier 2 opens');
  assert.equal(await ceilingOf(named), 40, 'tier 1 does NOT — hers wait for her all night');

  // ⚠ and the release has an inverse in the same call, so nothing is one-way.
  await one(`SELECT public.papic_set_guest_spend_ceiling_release($1, FALSE)`, [eventId]);
  assert.equal(await ceilingOf(other), 5, 'closing it again is the same call in the other direction');
});

test('re-pressing the release keeps the ORIGINAL moment rather than quietly moving it', async () => {
  const eventId = await seedPoolEvent(5000);
  const first = await one<string>(`SELECT public.papic_set_guest_spend_ceiling_release($1, TRUE)::text`, [eventId]);
  const again = await one<string>(`SELECT public.papic_set_guest_spend_ceiling_release($1, TRUE)::text`, [eventId]);
  assert.equal(again, first);
});

test('naming a guest is a TARGET, and NULL is its inverse rather than a second function', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);
  await setCeiling(eventId, 5);

  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 40)`, [eventId, guestId]);
  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 40)`, [eventId, guestId]);
  assert.equal(await ceilingOf(guestId), 40, 'applied twice is still 40');

  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, NULL)`, [eventId, guestId]);
  assert.equal(await ceilingOf(guestId), 5, 'un-naming puts her back on the equal share');
});

test('one celebration cannot name another celebration’s guest', async () => {
  const a = await seedPoolEvent(5000);
  const b = await seedPoolEvent(5000);
  const guestOfB = await seedGuest(b);
  await assert.rejects(
    () => one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 40)`, [a, guestOfB]),
    /not on this celebration/,
  );
});

test('with no number typed, the share is what the named guests left, divided among the rest', async () => {
  const eventId = await seedPoolEvent(5000, 10);
  const named = await seedGuest(eventId, 'Named');
  const other = await seedGuest(eventId, 'Other');
  await db.query(`UPDATE public.events SET papic_guest_spend_ceiling_on = TRUE WHERE event_id = $1`, [eventId]);
  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 500)`, [eventId, named]);

  // 🪤 5,050, NOT 5,000 — AND THE 50 IS NOT A ROUNDING ERROR. Every event is
  // born holding a 50-credit free grant (trigger papic_seed_free_grant_trg, seeded
  // by 20270902100836), which is exactly WHY the pool applies to every
  // celebration in existence and why the per-guest 150 has been inert since the
  // one-pool model landed. The first draft of this test expected 500 and was
  // wrong about the world, not about the code.
  assert.equal(
    await one<number>(`SELECT total_points FROM public.papic_event_pool_status($1)`, [eventId]),
    5050,
    'PRECONDITION: 5,000 granted + the automatic 50-credit free grant every event is born with',
  );

  // (5050 − 500) ÷ (10 heads − 1 named) = 505.5 → 505
  assert.equal(await ceilingOf(other), 505);
  assert.equal(await ceilingOf(named), 500, 'and the named guest keeps HER figure, not the share');

  // 🔑 DERIVED AT SPEND TIME, NEVER STAMPED. Top the pot up and the share moves
  // with it — a stamped copy would still be reading the old number.
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, 4500, 'admin', 'top-up')`, [eventId],
  );
  // (9550 − 500) ÷ 9 = 1005.5 → 1005
  assert.equal(await ceilingOf(other), 1005, 'a top-up moves every share, with no re-stamp sweep');
});

test('⚖ a share that rounds to zero is floored at 1 — a fairness rule must never refuse a guest their FIRST photograph', async () => {
  // The free 50-credit grant, 200 heads: 50/200 rounds to 0.
  const eventId = await seedPoolEvent(50, 200);
  const guestId = await seedGuest(eventId);
  await db.query(`UPDATE public.events SET papic_guest_spend_ceiling_on = TRUE WHERE event_id = $1`, [eventId]);

  assert.equal(await ceilingOf(guestId), 1);
  assert.equal((await shoot(guestId)).status, 'ok', 'the first capture must land');
});

test('the headcount is asked once — papic_event_pool_status and the share divide by the same function', async () => {
  const def = await one<string>(
    `SELECT pg_get_functiondef('public.papic_event_pool_status(uuid)'::regprocedure)`,
  );
  assert.match(def, /papic_event_guest_headcount/);
  assert.doesNotMatch(
    def,
    /SELECT COUNT\(\*\) FROM public\.guests/,
    'the headcount expression must be GONE from pool_status, not merely also present elsewhere',
  );
});

// ══ 5 · THE SHAPE OF THE WRITER ════════════════════════════════════════════

test('🚨 exactly ONE papic_record_guest_capture — a second overload makes every named call ambiguous', async () => {
  const count = await one<number>(
    `SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = 'papic_record_guest_capture'`,
  );
  assert.equal(
    count, 1,
    'measured in production 2026-08-30: two candidates raise 42725, and the route\'s fallback ladder ' +
      'regex matches that error — it would silently degrade every clip to a photo',
  );
});

test('the gate lives INSIDE the writer, which is the one door an anonymous caller reaches', async () => {
  const def = await one<string>(
    `SELECT pg_get_functiondef(
       'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer)'::regprocedure)`,
  );
  assert.match(def, /papic_guest_spend_ceiling/, 'a ceiling resolved anywhere else is bypassable');
  assert.match(def, /SUM\(points_cost\)/, 'and it must meter in credits');
  assert.match(
    def,
    /v_unlimited\s*:=\s*v_unlimited\s*OR\s*\(COALESCE\(v_pool_applies, FALSE\) AND v_ceiling IS NULL\)/,
    'the pool must only stand the per-guest gate down when NO ceiling is set',
  );
});

test('the new table ships closed, and the couple’s columns ship granted', async () => {
  assert.equal(
    await one<boolean>(
      `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.papic_guest_spend_ceilings'::regclass`,
    ),
    true,
  );
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      await one<boolean>(`SELECT has_table_privilege($1, 'public.papic_guest_spend_ceilings', 'SELECT')`, [role]),
      false,
      `${role} must not read the ceilings table directly`,
    );
  }
  // ⚠ The GRANT half of this cannot be trusted here — the replay re-computes the
  // events allow-list over every column present, so a missing grant passes green.
  // scripts/lint-events-column-grants.mjs and the production dry-run in the PR
  // body are what actually prove it. This asserts only the projection.
  for (const col of [
    'papic_guest_spend_ceiling_on',
    'papic_guest_spend_ceiling_points',
    'papic_guest_spend_ceiling_released_at',
  ]) {
    assert.equal(
      await one<number>(
        `SELECT COUNT(*)::int FROM information_schema.columns
          WHERE table_schema='public' AND table_name='events_host' AND column_name=$1`, [col],
      ),
      1,
      `${col} is a phantom column on events_host — Personalization throws for every host`,
    );
  }
});

test('a stored ceiling of zero cannot be typed into the "everyone else" number — a blank box is not zero', async () => {
  const eventId = await seedPoolEvent(5000);
  await assert.rejects(
    () => db.query(
      `UPDATE public.events SET papic_guest_spend_ceiling_points = 0 WHERE event_id = $1`, [eventId],
    ),
    /events_papic_guest_spend_ceiling_points_positive/,
  );
});

// ══ 6 · WHICH 150 GOVERNS — proved with numbers that DISAGREE ══════════════
//
// 🔑 THE SHARPEST POINT ANYONE MADE ON THIS BUILD. Three separate figures are
// all 150 today and have therefore never disagreed:
//   • GUEST_CAPTURE_CREDITS = 150 — the platform's own per-guest cap
//   • papic_event_pool_config.points_per_guest = 150 — the POOL MULTIPLIER,
//     which sizes the pot from headcount and is a different fact entirely
//   • and, from today, the couple's own ceiling
// A gate that silently kept deferring to either of the first two would leave
// the couple's number governing nothing — this stream's own defect wearing a
// control panel — and NO test could catch it while all three read 150.
//
// So these run with the values deliberately pulled apart.

test('🚨 the COUPLE’S number binds, not the platform’s 150 and not the pool multiplier', async () => {
  // pool multiplier 150 (untouched default) · a 30,000-credit pot · couple's
  // ceiling 20. Every number in play is different, so only one answer can pass.
  const eventId = await seedPoolEvent(30000, 500);
  const guestId = await seedGuest(eventId);
  await setCeiling(eventId, 20);

  assert.equal(
    await one<number>(`SELECT points_per_guest FROM public.papic_event_pool_config WHERE config_key = 'default'`),
    150,
    'PRECONDITION: the pool multiplier is still 150, so 20 cannot be it',
  );
  assert.equal(await ceilingOf(guestId), 20, 'not 150, and not 30000/500 = 60');

  const clip = await shoot(guestId, 'clip', 8);
  assert.equal(clip.total, 20, 'the reply reports the COUPLE’s figure as the total, never 150');
  await shoot(guestId, 'clip', 8);
  const refused = await shoot(guestId, 'clip', 8);
  assert.equal(refused.status, 'quota_exhausted', '8 + 8 + 8 crosses 20');
  assert.equal(refused.reason, 'guest_spend_ceiling');
  assert.equal(refused.used, 16, 'and it refused at 16 of 20 — not at 150, and not at 60');
});

test('🚨 a NAMED guest’s figure beats the couple’s number AND the platform’s 150, in the gate itself', async () => {
  const eventId = await seedPoolEvent(30000, 500);
  const named = await seedGuest(eventId, 'Named');
  const other = await seedGuest(eventId, 'Other');
  await setCeiling(eventId, 20);
  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 5)`, [eventId, named]);

  // Three different answers for three different people, all on one celebration.
  assert.equal(await ceilingOf(named), 5);
  assert.equal(await ceilingOf(other), 20);

  assert.equal((await shoot(named)).status, 'ok');
  assert.equal((await shoot(named)).status, 'ok');
  assert.equal((await shoot(named)).status, 'ok');
  assert.equal((await shoot(named)).status, 'ok');
  assert.equal((await shoot(named)).status, 'ok');
  const refused = await shoot(named);
  assert.equal(refused.status, 'quota_exhausted', 'she is refused at HER 5');
  assert.equal(refused.total, 5, 'not 20, not 150, not the derived share');

  // …while the guest beside her is still shooting on the couple's 20.
  assert.equal((await shoot(other)).status, 'ok');
});

// ══ 7 · THE LATE RELEASE — no cron, evaluated when the question is asked ═══
//
// Owner 7a asks for BOTH a button and an automatic release late in the night.
// The button lives in the control centre; this half lives here, and it is LAZY
// rather than scheduled: computed at the moment a ceiling is resolved, so it
// cannot fail to run. There is no cron on this platform to fail.

test('🚨 the ceiling releases itself in the celebration’s last stretch — with nothing scheduled', async () => {
  const eventId = await seedPoolEvent(5000, 10);
  const guestId = await seedGuest(eventId, 'Late');
  const named = await seedGuest(eventId, 'Named');
  await setCeiling(eventId, 5);
  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 40)`, [eventId, named]);

  // A window that closes in three hours: still early, the ceiling still binds.
  await db.query(
    `UPDATE public.events SET papic_window_end = NOW() + INTERVAL '3 hours' WHERE event_id = $1`, [eventId],
  );
  assert.equal(await ceilingOf(guestId), 5, 'three hours out is not the last stretch');

  // An hour from closing: the rest of the room opens up on its own.
  await db.query(
    `UPDATE public.events SET papic_window_end = NOW() + INTERVAL '1 hour' WHERE event_id = $1`, [eventId],
  );
  assert.equal(await ceilingOf(guestId), null, 'nobody is locked out of a pot that still holds credits');
  assert.equal(
    await ceilingOf(named), 40,
    'and the late release does NOT touch a named guest either — hers wait for her (owner 7c)',
  );

  // ⚠ It is a READ-TIME derivation, so nothing was written to say so.
  assert.equal(
    await one<string | null>(
      `SELECT papic_guest_spend_ceiling_released_at FROM public.events WHERE event_id = $1`, [eventId],
    ),
    null,
    'the automatic release stamps nothing — a stamp would need something to run, and nothing runs',
  );
});

test('a celebration with no window falls back to the end of the event day, and never opens EARLY', async () => {
  const eventId = await seedPoolEvent(5000, 10);
  const guestId = await seedGuest(eventId);
  await setCeiling(eventId, 5);

  await db.query(
    `UPDATE public.events SET event_date = (NOW() + INTERVAL '2 days')::date WHERE event_id = $1`, [eventId],
  );
  assert.equal(await ceilingOf(guestId), 5, 'a celebration two days away is not in its last stretch');

  await db.query(
    `UPDATE public.events SET event_date = (NOW() - INTERVAL '1 day')::date WHERE event_id = $1`, [eventId],
  );
  assert.equal(await ceilingOf(guestId), null, 'yesterday’s celebration is certainly over');

  // ⚖ Being LATE is harmless — it opens credits that were going unused anyway.
  // Being EARLY breaks the promise, so a celebration with no date at all gets
  // no automatic release and keeps only the couple's button.
  await db.query(`UPDATE public.events SET event_date = NULL WHERE event_id = $1`, [eventId]);
  assert.equal(await ceilingOf(guestId), 5, 'no date, no automatic release');
});
