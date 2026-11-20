/**
 * 🎁 THE PHOTO CHALLENGE AND THE 3D BOOTH COME WITH PRO AND UP — with grandfathering (migration 20271356215288).
 *
 * ⚖ DECISION_LOG 2026-11-20, owner, verbatim: *"the AI chatbot / the 3D booth / the photo challenge this is part of
 * Pro and Up"*; Free · Verified · Plus may not have them (controller, under owner delegation, same day), and whatever
 * a shop already held when this shipped runs to its end — paid time is never taken back.
 *
 * Proves:
 *   1 · live Pro / Ultra open both; a lapsed Pro does not.
 *   2 · Plus, and a Verified shop with a Specialized tools window bought AFTER the ship, get neither — while the
 *       unlock itself stays live for the other paid tools.
 *   3 · THE SNAPSHOT — the migration's own INSERT, run as written: it grandfathers a live Plus term (to its end, and a
 *       renewal never shortens it), an open-ended Plus (while it stays so), a live window and a live trial; it skips
 *       Free and a lapsed Plus; and with the table's COMMENT set (any re-apply) it grandfathers nobody new.
 *   4 · the TS mirror `proToolsIncludedFrom` agrees with the SQL on every case.
 *
 * Sabotage (each turns this file RED): drop the Pro arm · drop the plus_term arm · switch the two gates back to
 * vendor_specialized_tools_unlocked · drop the COMMENT guard from the INSERT.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { proToolsIncludedFrom, type ProToolsGrandfather } from '../../lib/specialized-tools-access';

const MIGRATION = readFileSync(
  join(MIGRATIONS_DIR, '20271356215288_pro_tools_come_with_pro.sql'),
  'utf8',
);
/** The snapshot statement exactly as the migration runs it. */
const SNAPSHOT_SQL = (() => {
  const from = MIGRATION.indexOf('INSERT INTO public.vendor_pro_tools_grandfather');
  const to = MIGRATION.indexOf('ON CONFLICT (vendor_profile_id) DO NOTHING;', from);
  assert.ok(from > 0 && to > from, 'the snapshot INSERT is in the migration');
  return MIGRATION.slice(from, to + 'ON CONFLICT (vendor_profile_id) DO NOTHING;'.length);
})();

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `protools-${++seq}-${Date.now()}`;
const FUTURE = (days = 10) => new Date(Date.now() + days * 864e5).toISOString();
const PAST = () => new Date(Date.now() - 10 * 864e5).toISOString();

async function newShop(a: { tier: string; verified?: boolean; tierExpires?: string | null }): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        tier_state, tier_expires_at, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], $3::vendor_verification_state, NOW(),
             $4::vendor_tier_state, $5,
             (CASE WHEN $3 = 'verified' THEN 'verified' ELSE 'hidden' END)::public.vendor_public_visibility)
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, `Shop ${uniq()}`, a.verified === false ? 'unverified' : 'verified', a.tier, a.tierExpires ?? null],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** An event with this shop booked on it (the booking may claim the shop's trial — spent below where it matters). */
async function newBooking(vpid: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('An event','birthday','2030-08-01') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  const host = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    host.rows[0]!.id,
  ]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','A Shop','contracted',$2,50000)`,
    [eventId, vpid],
  );
  return eventId;
}

async function spendTrial(vpid: string) {
  await db.query(
    `UPDATE public.vendor_specialized_tools_access SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE vendor_profile_id = $1`,
    [vpid],
  );
}

async function setWindow(vpid: string, iso: string | null) {
  await db.query(
    `INSERT INTO public.vendor_specialized_tools_access (vendor_profile_id, unlock_expires_at)
     VALUES ($1, $2) ON CONFLICT (vendor_profile_id) DO UPDATE SET unlock_expires_at = EXCLUDED.unlock_expires_at`,
    [vpid, iso],
  );
}

const included = async (vpid: string, eventId: string | null) =>
  (await db.query<{ ok: boolean }>(`SELECT public.vendor_pro_tools_included($1, $2) AS ok`, [vpid, eventId])).rows[0]!.ok;
const challenge = async (vpid: string, eventId: string) =>
  (await db.query<{ ok: boolean }>(`SELECT public.vendor_papic_challenge_entitled($1, $2) AS ok`, [vpid, eventId])).rows[0]!.ok;
const unlocked = async (vpid: string, eventId: string | null) =>
  (await db.query<{ ok: boolean }>(`SELECT public.vendor_specialized_tools_unlocked($1, $2) AS ok`, [vpid, eventId])).rows[0]!.ok;

async function branded(eventId: string): Promise<string[]> {
  await db.exec('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', true)`);
    await db.exec('SET LOCAL ROLE service_role');
    const r = await db.query<{ id: string }>(`SELECT public.event_branded_booth_vendor_ids($1) AS id`, [eventId]);
    return r.rows.map((x) => x.id);
  } finally {
    await db.exec('ROLLBACK');
    await db.exec('RESET ROLE').catch(() => {});
  }
}

/** Run the migration's snapshot as on a FIRST apply (no COMMENT yet), then put the marker back. */
async function runFirstApplySnapshot() {
  const comment = (
    await db.query<{ c: string | null }>(`SELECT obj_description('public.vendor_pro_tools_grandfather'::regclass, 'pg_class') AS c`)
  ).rows[0]!.c;
  assert.ok(comment, 'the replay applied the migration, so the marker is set');
  await db.exec(`COMMENT ON TABLE public.vendor_pro_tools_grandfather IS NULL`);
  await db.exec(SNAPSHOT_SQL);
  await db.exec(`COMMENT ON TABLE public.vendor_pro_tools_grandfather IS '${comment.replace(/'/g, "''")}'`);
}

async function grandfather(vpid: string): Promise<ProToolsGrandfather | null> {
  const r = await db.query<ProToolsGrandfather>(
    `SELECT plus_term_ends_at, plus_open_ended, unlock_expires_at, trial_event_id, trial_ends_at
       FROM public.vendor_pro_tools_grandfather WHERE vendor_profile_id = $1`,
    [vpid],
  );
  const g = r.rows[0];
  if (!g) return null;
  const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
  return {
    plus_term_ends_at: iso(g.plus_term_ends_at),
    plus_open_ended: g.plus_open_ended,
    unlock_expires_at: iso(g.unlock_expires_at),
    trial_event_id: g.trial_event_id,
    trial_ends_at: iso(g.trial_ends_at),
  };
}

test('1 · live Pro and Ultra get both tools; a lapsed Pro does not', async () => {
  for (const tier of ['pro', 'enterprise']) {
    const vpid = await newShop({ tier, tierExpires: FUTURE() });
    const eventId = await newBooking(vpid);
    assert.equal(await challenge(vpid, eventId), true, `${tier}: photo challenge`);
    assert.deepEqual(await branded(eventId), [vpid], `${tier}: branded booth`);
  }
  const lapsed = await newShop({ tier: 'pro', tierExpires: PAST() });
  const eventId = await newBooking(lapsed);
  assert.equal(await challenge(lapsed, eventId), false);
  assert.deepEqual(await branded(eventId), []);
});

test('2 · Plus, and a window bought after the ship, get neither — the unlock still opens the other tools', async () => {
  const plus = await newShop({ tier: 'solo', tierExpires: FUTURE() });
  const e1 = await newBooking(plus);
  await spendTrial(plus);
  assert.equal(await unlocked(plus, e1), true, 'Plus still includes the Specialized tools unlock');
  assert.equal(await challenge(plus, e1), false, 'but not the photo challenge');
  assert.deepEqual(await branded(e1), [], 'nor the branded booth');

  const verified = await newShop({ tier: 'verified' });
  const e2 = await newBooking(verified);
  await spendTrial(verified);
  await setWindow(verified, FUTURE());
  assert.equal(await unlocked(verified, e2), true);
  assert.equal(await challenge(verified, e2), false);
  assert.deepEqual(await branded(e2), []);
});

test('3 · the snapshot grandfathers what was held at ship time, to its end — and a re-apply adds nobody', async () => {
  const plusDated = await newShop({ tier: 'solo', tierExpires: FUTURE(20) });
  const plusOpen = await newShop({ tier: 'solo', tierExpires: null });
  const plusLapsed = await newShop({ tier: 'solo', tierExpires: PAST() });
  const withWindow = await newShop({ tier: 'verified' });
  await setWindow(withWindow, FUTURE(15));
  const withTrial = await newShop({ tier: 'verified' });
  const trialEvent = await newBooking(withTrial); // the booking trigger claims the trial on this event
  const free = await newShop({ tier: 'free', verified: false });

  await runFirstApplySnapshot();

  const gDated = await grandfather(plusDated);
  assert.ok(gDated?.plus_term_ends_at, 'a live Plus term is kept');
  assert.equal(await included(plusDated, null), true);
  assert.equal(await included(plusOpen, null), true, 'an open-ended Plus is kept');
  assert.equal(await grandfather(plusLapsed), null, 'a lapsed Plus held nothing');
  assert.equal(await included(plusLapsed, null), false);
  assert.equal(await included(withWindow, null), true, 'a live window is kept');
  assert.equal(await included(withTrial, trialEvent), true, 'a claimed trial is kept on its event');
  assert.equal(await included(withTrial, null), false, '… and only there');
  assert.equal(await grandfather(free), null);
  assert.equal(await included(free, null), false);

  // A renewal never shortens the grandfathered term …
  await db.query(`UPDATE public.vendor_profiles SET tier_expires_at = $2 WHERE vendor_profile_id = $1`, [plusDated, FUTURE(60)]);
  assert.equal(await included(plusDated, null), true);
  // … and once that term has ended, the gate applies.
  await db.query(
    `UPDATE public.vendor_pro_tools_grandfather SET plus_term_ends_at = NOW() - INTERVAL '1 minute' WHERE vendor_profile_id = $1`,
    [plusDated],
  );
  assert.equal(await included(plusDated, null), false, 'the term ended: Plus no longer includes them');
  // An open-ended Plus that takes an end date has left that plan.
  await db.query(`UPDATE public.vendor_profiles SET tier_expires_at = $2 WHERE vendor_profile_id = $1`, [plusOpen, FUTURE(28)]);
  assert.equal(await included(plusOpen, null), false);

  // A RE-APPLY (marker set) grandfathers nobody new.
  const lateJoiner = await newShop({ tier: 'solo', tierExpires: FUTURE(20) });
  await db.exec(SNAPSHOT_SQL);
  assert.equal(await grandfather(lateJoiner), null, 'a shop that joined Plus after the ship is not grandfathered');
});

test('4 · the TS mirror agrees with the SQL on every case', async () => {
  const gShapes: Array<Partial<ProToolsGrandfather> | null> = [
    null,
    { plus_term_ends_at: FUTURE() },
    { plus_term_ends_at: PAST() },
    { plus_open_ended: true },
    { unlock_expires_at: FUTURE() },
    { unlock_expires_at: PAST() },
  ];
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise']) {
    for (const verified of [true, false]) {
      for (const tierExpires of [null, PAST(), FUTURE()]) {
        for (const shape of gShapes) {
          const vpid = await newShop({ tier, verified, tierExpires });
          let g: ProToolsGrandfather | null = null;
          if (shape) {
            g = {
              plus_term_ends_at: shape.plus_term_ends_at ?? null,
              plus_open_ended: shape.plus_open_ended ?? false,
              unlock_expires_at: shape.unlock_expires_at ?? null,
              trial_event_id: null,
              trial_ends_at: null,
            };
            await db.query(
              `INSERT INTO public.vendor_pro_tools_grandfather (vendor_profile_id, plus_term_ends_at, plus_open_ended, unlock_expires_at)
               VALUES ($1, $2, $3, $4)`,
              [vpid, g.plus_term_ends_at, g.plus_open_ended, g.unlock_expires_at],
            );
          }
          const facts = { tier_state: tier, tier_expires_at: tierExpires, verification_state: verified ? 'verified' : 'unverified' };
          assert.equal(
            proToolsIncludedFrom(facts, g, null),
            await included(vpid, null),
            JSON.stringify({ tier, verified, tierExpires, shape }),
          );
        }
      }
    }
  }
});

test('5 · the grandfather table is service-role only', async () => {
  const r = await db.query<{ grantee: string }>(
    `SELECT DISTINCT grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'vendor_pro_tools_grandfather' AND grantee IN ('anon','authenticated')`,
  );
  assert.deepEqual(r.rows, []);
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.vendor_pro_tools_grandfather'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true);
});
