import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

/**
 * ON 31 MARCH A LAPSED SHOP REALLY DROPS TO FREE — and nothing else can borrow the door it drops through.
 *
 * 🚨 THE LATENT FAULT (found reviewing #7979). `stampLapsedPapers` wrote `tier_state = 'free'` with a plain
 * update. `vendor_tier_no_silent_downgrade` (20271115090000) refuses any update that LOWERS a shop still inside
 * its plan unless `setnayan.allow_tier_downgrade` is on — and a free "verified" plan has no end date (always
 * live), a paid plan with days left is live by definition. Both lapse writes were refused, and the pass never
 * throws, so the refusal was one console line and every lapsed shop stayed on its plan.
 *
 * ✅ `stamp_papers_lapse` (20271354465843) sets the flag for its own transaction and writes the stamp, the Free
 * plan and the stopped clock in ONE update. Test 1 is the fault itself, reproduced against the full schema: it
 * holds whether or not the fix exists, and it is why the fix must be a function. Tests 2–3 fail without the
 * migration (no such function). Tests 5–6 prove the guard is still closed for every other writer. Tests 7–9 prove a
 * paid drop and the row that holds its days commit together or not at all.
 */

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let n = 0;
async function lapsedShop(tier: string, expiresSql: string, dueSql = "NOW() - INTERVAL '1 day'"): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`papers-lapse-${n}@test.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        tier_state, tier_expires_at, next_renewal_due_at)
     VALUES ($1, 'Lapse Plan Shop', 'Pasig', ARRAY['photography']::text[], 'verified', NOW(),
             $2::public.vendor_tier_state, ${expiresSql}, ${dueSql})
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, tier],
  );
  return v.rows[0]!.vendor_profile_id;
}

type Shop = { tier_state: string; tier_expires_at: string | null; papers_lapsed_at: string | null };
async function read(id: string): Promise<Shop> {
  const r = await db.query<Shop>(
    `SELECT tier_state::text, tier_expires_at::text, papers_lapsed_at::text
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

async function stamp(id: string, plan: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(`SELECT public.stamp_papers_lapse($1, $2) AS ok`, [id, plan]);
  return r.rows[0]!.ok;
}

test('1 · THE FAULT: the old plain lapse write is refused by the downgrade guard — for both plans', async () => {
  const freeVerified = await lapsedShop('verified', 'NULL');
  const paid = await lapsedShop('pro', "NOW() + INTERVAL '40 days'");
  for (const [id, set] of [
    [freeVerified, `tier_state = 'free'`],
    [paid, `tier_state = 'free', tier_expires_at = NULL`],
  ] as const) {
    await assert.rejects(
      () => db.query(`UPDATE public.vendor_profiles SET papers_lapsed_at = NOW(), ${set} WHERE vendor_profile_id = $1`, [id]),
      /TIER_DOWNGRADE_BLOCKED/,
      'a plain lapse write went through — the guard no longer covers it',
    );
    assert.equal((await read(id)).papers_lapsed_at, null, 'the refused write stamped the shop anyway');
  }
});

test('2 · free_drop: a free "verified" plan becomes free, stamped, in one call', async () => {
  const id = await lapsedShop('verified', 'NULL');
  assert.equal(await stamp(id, 'free_drop'), true);
  const s = await read(id);
  assert.equal(s.tier_state, 'free');
  assert.notEqual(s.papers_lapsed_at, null);
});

test('3 · hold: a paid plan with days left becomes free with its clock stopped, in the same write', async () => {
  const id = await lapsedShop('pro', "NOW() + INTERVAL '40 days'");
  assert.equal(await stamp(id, 'hold'), true);
  const s = await read(id);
  assert.equal(s.tier_state, 'free');
  assert.equal(s.tier_expires_at, null, 'the held days were not stopped with the drop');
  assert.notEqual(s.papers_lapsed_at, null);
});

test('4 · idempotent and re-checked: a second call, a shop not yet due, or an unknown plan changes nothing', async () => {
  const id = await lapsedShop('verified', 'NULL');
  assert.equal(await stamp(id, 'free_drop'), true);
  const first = await read(id);
  assert.equal(await stamp(id, 'free_drop'), false, 'a stamped shop was stamped again');
  assert.deepEqual(await read(id), first);

  const notDue = await lapsedShop('pro', "NOW() + INTERVAL '40 days'", "NOW() + INTERVAL '10 days'");
  assert.equal(await stamp(notDue, 'hold'), false, 'the hatch lowered a shop whose renewal day has not passed');
  assert.equal((await read(notDue)).tier_state, 'pro');

  await assert.rejects(() => stamp(notDue, 'anything'), /unknown plan/);
});

test('5 · the hatch closes behind the function: a plain downgrade later in the SAME transaction is refused', async () => {
  const lapsing = await lapsedShop('verified', 'NULL');
  const other = await lapsedShop('enterprise', "NOW() + INTERVAL '20 days'");
  try {
    await assert.rejects(
      () =>
        db.exec(`
          BEGIN;
          SELECT public.stamp_papers_lapse('${lapsing}', 'free_drop');
          UPDATE public.vendor_profiles SET tier_state = 'pro' WHERE vendor_profile_id = '${other}';
          COMMIT;
        `),
      /TIER_DOWNGRADE_BLOCKED/,
      'the downgrade flag outlived stamp_papers_lapse',
    );
  } finally {
    // The refused statement leaves the transaction aborted; end it so the next test runs clean.
    await db.exec('ROLLBACK').catch(() => undefined);
  }
  assert.equal((await read(other)).tier_state, 'enterprise');
});

test('6 · a plain downgrade from anywhere else is still refused, and only the service role may call the function', async () => {
  const id = await lapsedShop('enterprise', "NOW() + INTERVAL '20 days'");
  await assert.rejects(
    () => db.query(`UPDATE public.vendor_profiles SET tier_state = 'pro' WHERE vendor_profile_id = $1`, [id]),
    /TIER_DOWNGRADE_BLOCKED/,
  );
  assert.equal((await read(id)).tier_state, 'enterprise');

  const r = await db.query<{ anon: boolean; authed: boolean; svc: boolean }>(
    `SELECT has_function_privilege('anon', 'public.stamp_papers_lapse(uuid, text, timestamptz)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.stamp_papers_lapse(uuid, text, timestamptz)', 'EXECUTE') AS authed,
            has_function_privilege('service_role', 'public.stamp_papers_lapse(uuid, text, timestamptz)', 'EXECUTE') AS svc`,
  );
  assert.deepEqual(r.rows[0], { anon: false, authed: false, svc: true });
});

/* ── 💸 THE HOLD LANDS WITH THE DROP — never after it (review of #8056 at 6c8b36df7) ─────────────────────────────
 * Renewal gives a paid plan back from the latest `vendor_papers_lapsed` audit row (held_tier, held_ms —
 * heldPlanBack in lib/verification-decision.server.ts). Written by a separate call after the drop committed, a failed
 * insert lost the paid days for good: the stamp stops a re-run and renewal finds no hold. The row is now written
 * inside stamp_papers_lapse, so the drop and the hold commit or fail together. */

type Hold = { held_tier: string | null; held_ms: number | null; tier_before: string; tier_after: string; has_held: boolean };
async function holdRows(id: string): Promise<Hold[]> {
  const r = await db.query<Hold>(
    `SELECT metadata->>'held_tier' AS held_tier, (metadata->>'held_ms')::bigint::float8 AS held_ms,
            metadata->>'tier_before' AS tier_before, metadata->>'tier_after' AS tier_after,
            metadata ? 'held_tier' AS has_held
       FROM public.admin_audit_log
      WHERE action = 'vendor_papers_lapsed' AND target_id = $1`,
    [id],
  );
  return r.rows;
}

test('7 · every paid drop writes its hold row in the same call — the days left, the tier, and no hold for a free drop', async () => {
  const paid = await lapsedShop('pro', "NOW() + INTERVAL '40 days'");
  assert.equal(await stamp(paid, 'hold'), true);
  const [h, ...more] = await holdRows(paid);
  assert.equal(more.length, 0, 'one lapse wrote more than one row');
  assert.ok(h, 'a paid plan was dropped with NO hold row — its days are lost');
  assert.equal(h.held_tier, 'pro');
  assert.equal(h.tier_before, 'pro');
  assert.equal(h.tier_after, 'free');
  const days = (h.held_ms ?? 0) / 86_400_000;
  assert.ok(days > 39.9 && days <= 40, `held ${days} days, expected ~40`);

  const comped = await lapsedShop('pro', 'NULL');
  assert.equal(await stamp(comped, 'hold'), true);
  const [c] = await holdRows(comped);
  assert.ok(c && c.has_held && c.held_tier === 'pro' && c.held_ms === null, 'a plan with no clock must wait whole (held_ms null)');

  const free = await lapsedShop('verified', 'NULL');
  assert.equal(await stamp(free, 'free_drop'), true);
  const [f] = await holdRows(free);
  assert.ok(f && !f.has_held && f.tier_after === 'free', 'the free drop wrote a hold, or no row');

  // Across every shop this file stamped: no paid shop sits on free with a stopped clock and no hold row.
  const orphans = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_profiles vp
      WHERE vp.papers_lapsed_at IS NOT NULL AND vp.tier_state = 'free'
        AND NOT EXISTS (SELECT 1 FROM public.admin_audit_log a
                         WHERE a.action = 'vendor_papers_lapsed' AND a.target_id = vp.vendor_profile_id::text)`,
  );
  assert.equal(orphans.rows[0]!.n, 0, 'a lapsed shop was dropped with no audit row');
});

test('8 · if the hold row cannot be written, the drop rolls back with it — nothing is lost, the shop is retried tomorrow', async () => {
  const id = await lapsedShop('pro', "NOW() + INTERVAL '40 days'");
  await db.exec(`
    CREATE FUNCTION public.__fail_lapse_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'audit insert refused (test)'; END; $$;
    CREATE TRIGGER __fail_lapse_audit BEFORE INSERT ON public.admin_audit_log
      FOR EACH ROW WHEN (NEW.action = 'vendor_papers_lapsed') EXECUTE FUNCTION public.__fail_lapse_audit();
  `);
  try {
    await assert.rejects(() => stamp(id, 'hold'), /audit insert refused/);
  } finally {
    await db.exec(`DROP TRIGGER __fail_lapse_audit ON public.admin_audit_log; DROP FUNCTION public.__fail_lapse_audit();`);
  }
  const s = await read(id);
  assert.equal(s.tier_state, 'pro', 'the plan dropped although its hold was never written');
  assert.notEqual(s.tier_expires_at, null);
  assert.equal(s.papers_lapsed_at, null, 'the shop was stamped, so tomorrow\'s pass would skip it');
  // …and the next pass does it properly.
  assert.equal(await stamp(id, 'hold'), true);
  assert.equal((await holdRows(id))[0]?.held_tier, 'pro');
});

test('9 · a hold handed a stale row (no longer a running paid plan) is refused and changes nothing', async () => {
  const id = await lapsedShop('pro', "NOW() - INTERVAL '1 day'");
  await assert.rejects(() => stamp(id, 'hold'), /not a plan to hold/);
  const s = await read(id);
  assert.equal(s.tier_state, 'pro');
  assert.equal(s.papers_lapsed_at, null);
  assert.equal((await holdRows(id)).length, 0);
});
