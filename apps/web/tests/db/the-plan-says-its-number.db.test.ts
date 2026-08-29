/**
 * THE PLAN SAYS ITS NUMBER — DB verification (migrations replayed).
 * Covers 20271180727490_the_plan_says_its_number, on top of
 * 20271121655918_vendor_tier_pipeline_caps.
 *
 * Three claims, each driven through real INSERT/UPDATE rather than by reading a
 * function body:
 *
 *   1. GRANDFATHERING. A supplier already ABOVE their plan's waiting-list number
 *      keeps it through any save that does not touch it, and loses it the moment
 *      they do touch it. Owner 2026-08-28: *grandfather existing suppliers*.
 *   2. ONE PREDICATE, TWO CALLERS. The count the screen shows
 *      (`vendor_whitelist_used_for_date`, via `vendor_whitelist_pressure`) is
 *      the same count the trigger refuses on — not a second copy of it.
 *   3. THE READER LEAKS NOTHING. `vendor_whitelist_pressure` answers only about
 *      the caller's own shop's thread, so it cannot be used to read a
 *      competitor's pipeline depth for a date.
 *
 * ⚠ The verified 2/1 retune is NOT asserted here. It is asserted where it
 * belongs — `vendor-tier-pipeline-caps.db.test.ts` DERIVES its expectations from
 * the TypeScript matrix, so a one-sided edit already fails there. A second copy
 * of that assertion here would be exactly the duplication this PR removes.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  // The whitelist count compares events.event_date (a DATE) — nothing here casts
  // a timestamptz — but the sibling caps suite pins UTC for a reason that cost a
  // day once, and a suite that is green only on a +08 laptop is worth nothing.
  await db.query(`SET TIME ZONE 'UTC'`);
});

after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = (label: string) => `${label}-${++seq}`;

async function setCapsEnabled(on: boolean): Promise<void> {
  await db.query(
    `UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = $1 WHERE id = 1`,
    [on],
  );
}

async function newVendor(
  label: string,
  tier: string,
): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq(label)}@grandfather.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const vendorProfileId =
    existing.rows[0]?.vendor_profile_id
    ?? (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Grandfather Test Shop', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = 'Grandfather Test Shop', location_city = 'Manila',
            services = ARRAY['photography']::text[],
            verification_state = 'verified', last_verified_at = NOW(),
            tier_state = $2
      WHERE vendor_profile_id = $1`,
    [vendorProfileId, tier],
  );
  return { vendorProfileId, userId };
}

async function newEvent(label: string, eventDate: string | null): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [uniq(label), eventDate],
  );
  return r.rows[0]!.event_id;
}

async function openThread(vendorProfileId: string, eventId: string): Promise<string> {
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING thread_id`,
    [eventId, vendorProfileId],
  );
  return t.rows[0]!.thread_id;
}

/** Accept a thread; returns the refusal message, or null. */
async function accept(threadId: string): Promise<string | null> {
  try {
    await db.query(
      `UPDATE public.chat_threads SET inquiry_status = 'accepted'::public.chat_inquiry_status
        WHERE thread_id = $1`,
      [threadId],
    );
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
}

async function storedWaitlist(vendorProfileId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT max_waitlist_acceptances AS n FROM public.vendor_profiles
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return Number(r.rows[0]!.n);
}

/** Put a shop ABOVE its ceiling the only honest way: with the ceilings off. */
async function seedAboveCeiling(vendorProfileId: string, n: number): Promise<void> {
  await setCapsEnabled(false);
  await db.query(
    `UPDATE public.vendor_profiles
        SET waitlist_enabled = TRUE, max_waitlist_acceptances = $2
      WHERE vendor_profile_id = $1`,
    [vendorProfileId, n],
  );
  await setCapsEnabled(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GRANDFATHERING
// ─────────────────────────────────────────────────────────────────────────────

test('an unrelated save does NOT lower a number the supplier already chose', async () => {
  const { vendorProfileId } = await newVendor('keep', 'solo'); // solo waitlist ceiling = 1
  await seedAboveCeiling(vendorProfileId, 3);
  assert.equal(await storedWaitlist(vendorProfileId), 3, 'seeding must actually land');

  // A plain profile edit. This is the exact write that used to take their 3.
  await db.query(
    `UPDATE public.vendor_profiles SET business_name = 'Renamed Shop'
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(
    await storedWaitlist(vendorProfileId),
    3,
    'grandfathering failed: an unrelated save clamped a number nobody touched',
  );
});

test('changing the number IS agreeing to the ceiling', async () => {
  const { vendorProfileId } = await newVendor('touch', 'solo');
  await seedAboveCeiling(vendorProfileId, 3);

  await db.query(
    `UPDATE public.vendor_profiles SET max_waitlist_acceptances = 2
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(
    await storedWaitlist(vendorProfileId),
    1,
    'the moment they set it themselves, the plan ceiling binds',
  );
});

test('a brand-new shop is inside the ceiling from its first row', async () => {
  await setCapsEnabled(true);
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','couple')) RETURNING id`,
    [`${uniq('fresh')}@grandfather.test`],
  );
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, max_waitlist_acceptances)
     VALUES ($1, 'Brand New Shop', 'Manila', 9) RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  const stored = await storedWaitlist(r.rows[0]!.vendor_profile_id);
  assert.equal(stored, 0, 'a brand-new shop is `free`, whose plan has no waiting list at all');
});

test('grandfathering protects a NUMBER, never a FEATURE — a 0-plan still has none', async () => {
  const { vendorProfileId } = await newVendor('nofeature', 'solo');
  await seedAboveCeiling(vendorProfileId, 3);
  // Downgrading is refused by the tier guard, so put them on the 0-allowance
  // plan the only way the database permits: with the caps off, from a fresh row.
  await setCapsEnabled(false);
  const free = await newVendor('freeplan', 'free');
  await db.query(
    `UPDATE public.vendor_profiles
        SET waitlist_enabled = TRUE, max_waitlist_acceptances = 3
      WHERE vendor_profile_id = $1`,
    [free.vendorProfileId],
  );
  await setCapsEnabled(true);

  await db.query(
    `UPDATE public.vendor_profiles SET business_name = 'Still Free'
      WHERE vendor_profile_id = $1`,
    [free.vendorProfileId],
  );
  const r = await db.query<{ n: number; on: boolean }>(
    `SELECT max_waitlist_acceptances AS n, waitlist_enabled AS on
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [free.vendorProfileId],
  );
  assert.equal(r.rows[0]!.n, 0, 'a plan with no waiting list keeps none, grandfather or not');
  assert.equal(r.rows[0]!.on, false, 'and the switch cannot be left on');
});

test('MUTATION GUARD: with the caps OFF nothing is clamped at all', async () => {
  await setCapsEnabled(false);
  const { vendorProfileId } = await newVendor('dark', 'solo');
  await db.query(
    `UPDATE public.vendor_profiles SET max_waitlist_acceptances = 7
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  assert.equal(
    await storedWaitlist(vendorProfileId),
    7,
    'ship-dark: the switch off must change nothing, even on a deliberate write',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ONE PREDICATE, TWO CALLERS
// ─────────────────────────────────────────────────────────────────────────────

test('the count the screen would show is the count the trigger refuses on', async () => {
  await setCapsEnabled(true);
  const { vendorProfileId } = await newVendor('count', 'solo'); // whitelist ceiling = 3
  const date = '2027-02-14';

  for (let i = 0; i < 3; i++) {
    const eventId = await newEvent(`count-${i}`, date);
    const err = await accept(await openThread(vendorProfileId, eventId));
    assert.equal(err, null, `accept ${i + 1} of 3 should have been allowed: ${err}`);
  }

  const used = await db.query<{ n: number }>(
    `SELECT public.vendor_whitelist_used_for_date($1, $2::date, NULL) AS n`,
    [vendorProfileId, date],
  );
  assert.equal(Number(used.rows[0]!.n), 3, 'the shared count must see all three');

  const fourth = await openThread(vendorProfileId, await newEvent('count-4th', date));
  const err = await accept(fourth);
  assert.match(
    String(err),
    /WHITELIST_DATE_LIMIT/,
    'the fourth must be refused by the trigger at exactly the number the count reports',
  );
  assert.match(String(err), /currently 3/, 'and the refusal must quote that same number');
});

test('a signed booking stops counting — the way out the screen offers is real', async () => {
  await setCapsEnabled(true);
  const { vendorProfileId } = await newVendor('signed', 'solo');
  const date = '2027-03-01';
  const bookedEvent = await newEvent('signed-booked', date);
  await accept(await openThread(vendorProfileId, bookedEvent));
  await accept(await openThread(vendorProfileId, await newEvent('signed-b', date)));
  await accept(await openThread(vendorProfileId, await newEvent('signed-c', date)));

  const before = await db.query<{ n: number }>(
    `SELECT public.vendor_whitelist_used_for_date($1, $2::date, NULL) AS n`,
    [vendorProfileId, date],
  );
  assert.equal(Number(before.rows[0]!.n), 3);

  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Grandfather Test Shop', 'deposit_paid', $2)`,
    [bookedEvent, vendorProfileId],
  );

  const after_ = await db.query<{ n: number }>(
    `SELECT public.vendor_whitelist_used_for_date($1, $2::date, NULL) AS n`,
    [vendorProfileId, date],
  );
  assert.equal(
    Number(after_.rows[0]!.n),
    2,
    'locking one in must free a slot — otherwise the sentence on screen is a lie',
  );
  const fourth = await accept(await openThread(vendorProfileId, await newEvent('signed-d', date)));
  assert.equal(fourth, null, 'and the freed slot must actually be usable');
});

test('a date the couple has not picked yet is never counted or capped', async () => {
  await setCapsEnabled(true);
  const { vendorProfileId } = await newVendor('nodate', 'free'); // ceiling = 1
  for (let i = 0; i < 4; i++) {
    const err = await accept(
      await openThread(vendorProfileId, await newEvent(`nodate-${i}`, null)),
    );
    assert.equal(err, null, 'with no date there is nothing to scope a per-date ceiling to');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE READER LEAKS NOTHING
// ─────────────────────────────────────────────────────────────────────────────

test('vendor_whitelist_pressure answers for the caller’s own thread', async () => {
  await setCapsEnabled(true);
  const mine = await newVendor('mine', 'solo');
  const date = '2027-04-04';
  await accept(await openThread(mine.vendorProfileId, await newEvent('mine-a', date)));
  const onScreen = await openThread(mine.vendorProfileId, await newEvent('mine-b', date));

  await setAuthUid(db, mine.userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query<{ used: number; cap: number; enforced: boolean }>(
      `SELECT used, cap, enforced FROM public.vendor_whitelist_pressure($1)`,
      [onScreen],
    );
    assert.equal(r.rows.length, 1, 'their own thread must answer');
    assert.equal(Number(r.rows[0]!.used), 1, 'one other customer is being chased for that date');
    assert.equal(Number(r.rows[0]!.cap), 3, 'solo chases 3');
    assert.equal(r.rows[0]!.enforced, true, 'the switch is on in this test');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
});

test('vendor_whitelist_pressure tells a DIFFERENT shop nothing at all', async () => {
  await setCapsEnabled(true);
  const theirs = await newVendor('theirs', 'enterprise');
  const stranger = await newVendor('stranger', 'solo');
  const date = '2027-05-05';
  await accept(await openThread(theirs.vendorProfileId, await newEvent('theirs-a', date)));
  const theirThread = await openThread(
    theirs.vendorProfileId,
    await newEvent('theirs-b', date),
  );

  await setAuthUid(db, stranger.userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query(
      `SELECT used, cap FROM public.vendor_whitelist_pressure($1)`,
      [theirThread],
    );
    assert.equal(
      r.rows.length,
      0,
      'a competitor must learn nothing about how full another shop’s date is',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
});

test('the raw counting function is NOT callable by a signed-in user', async () => {
  // It takes a vendor_profile_id, so a grant would answer about any shop.
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege(
              'authenticated',
              'public.vendor_whitelist_used_for_date(uuid,date,uuid)',
              'EXECUTE') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, false, 'the unscoped counter must stay off the exposed surface');
});

test('the caller-scoped reader IS callable by a signed-in user', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege(
              'authenticated',
              'public.vendor_whitelist_pressure(uuid)',
              'EXECUTE') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, true, 'the screen has to be able to ask');
});

test('and anon may not ask either question', async () => {
  const r = await db.query<{ a: boolean; b: boolean }>(
    `SELECT has_function_privilege('anon','public.vendor_whitelist_pressure(uuid)','EXECUTE') AS a,
            has_function_privilege('anon','public.vendor_whitelist_used_for_date(uuid,date,uuid)','EXECUTE') AS b`,
  );
  assert.equal(r.rows[0]!.a, false, 'a stranger must not read any shop’s pipeline');
  assert.equal(r.rows[0]!.b, false);
});
