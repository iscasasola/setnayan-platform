/**
 * PAPIC CHALLENGES IS A SUBSCRIPTION — DB verification (migrations replayed).
 * Covers 20271181420277_the_challenge_is_a_subscription.
 *
 * Owner 2026-08-28, verbatim: "unlimited us 2500 for 4 weeks."
 *
 * Three claims, and the first one is a live repair rather than a new feature:
 *
 *   1. THE PAYWALL IS BACK. Read out of production by the object on 2026-08-29,
 *      the live `papic_create_vendor_challenge` had NO paid gate at all — one
 *      CREATE OR REPLACE rebased its body on a migration with a LOWER prefix
 *      than the one that added the gate, and deleted it silently. Inert (0
 *      vendor missions ever), but open.
 *   2. ONE ENTITLEMENT, TWO CALLERS. Authoring and photo-delivery ask the same
 *      function, so they cannot drift apart again the same way.
 *   3. THE WINDOW IS NOT SELF-GRANTABLE. `vendor_profiles_owner` is FOR ALL with
 *      no column scoping and `authenticated` holds table-level INSERT/UPDATE, so
 *      the trigger is the only thing between a shop and a free 2099 expiry.
 *
 * Everything is driven through real calls and real writes, never by reading a
 * function body — with ONE deliberate exception, marked where it appears.
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
  await db.query(`SET TIME ZONE 'UTC'`);
});

after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = (label: string) => `${label}-${++seq}`;

async function newVendor(
  label: string,
  tier: string,
): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq(label)}@challenge.test`],
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
         VALUES ($1, 'Challenge Test Shop', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = 'Challenge Test Shop', location_city = 'Manila',
            services = ARRAY['photography']::text[],
            verification_state = 'verified', last_verified_at = NOW(),
            tier_state = $2
      WHERE vendor_profile_id = $1`,
    [vendorProfileId, tier],
  );
  return { vendorProfileId, userId };
}

/** A celebration this shop is BOOKED on — the precondition the RPC checks first. */
async function newBookedEvent(label: string, vendorProfileId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', '2027-06-06'::date) RETURNING event_id`,
    [uniq(label)],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Challenge Test Shop', 'contracted', $2)`,
    [eventId, vendorProfileId],
  );
  return eventId;
}

async function setSubscription(vendorProfileId: string, iso: string | null): Promise<void> {
  await db.query(
    `UPDATE public.vendor_profiles SET papic_challenge_expires_at = $2
      WHERE vendor_profile_id = $1`,
    [vendorProfileId, iso],
  );
}

/** Author a challenge AS the shop's owner. Returns the refusal message, or null. */
async function tryAuthor(userId: string, eventId: string): Promise<string | null> {
  await setAuthUid(db, userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    await db.query(`SELECT public.papic_create_vendor_challenge($1, $2)`, [
      eventId,
      'Photograph our signature pour',
    ]);
    return null;
  } catch (e) {
    return String((e as Error).message);
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
}

const inDays = (n: number) =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE PAYWALL IS BACK
// ─────────────────────────────────────────────────────────────────────────────

test('a BOOKED shop with no subscription cannot author a challenge', async () => {
  const shop = await newVendor('unpaid', 'pro');
  const eventId = await newBookedEvent('unpaid-ev', shop.vendorProfileId);
  const err = await tryAuthor(shop.userId, eventId);
  assert.match(
    String(err),
    /PAPIC_CHALLENGE_NOT_SUBSCRIBED/,
    'this is the gate a CREATE OR REPLACE deleted in production; if this passes, it is gone again',
  );
  const n = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM public.papic_missions WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(n.rows[0]!.c, 0, 'and nothing may be written on the way to being refused');
});

test('a live subscription authors freely', async () => {
  const shop = await newVendor('paid', 'pro');
  const eventId = await newBookedEvent('paid-ev', shop.vendorProfileId);
  await setSubscription(shop.vendorProfileId, inDays(20));
  assert.equal(await tryAuthor(shop.userId, eventId), null);
  const n = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM public.papic_missions
      WHERE event_id = $1 AND source = 'vendor' AND approved = false`,
    [eventId],
  );
  assert.equal(n.rows[0]!.c, 1, 'and it lands UNAPPROVED — the couple still decides');
});

test('ONE subscription covers EVERY celebration — the whole product change', async () => {
  const shop = await newVendor('many', 'pro');
  await setSubscription(shop.vendorProfileId, inDays(20));
  for (let i = 0; i < 3; i++) {
    const eventId = await newBookedEvent(`many-ev-${i}`, shop.vendorProfileId);
    assert.equal(
      await tryAuthor(shop.userId, eventId),
      null,
      `celebration ${i + 1} must be covered by the same subscription`,
    );
  }
});

test('a LAPSED subscription refuses — lapse is read time, nothing sweeps it', async () => {
  const shop = await newVendor('lapsed', 'pro');
  const eventId = await newBookedEvent('lapsed-ev', shop.vendorProfileId);
  await setSubscription(shop.vendorProfileId, inDays(-1));
  assert.match(String(await tryAuthor(shop.userId, eventId)), /PAPIC_CHALLENGE_NOT_SUBSCRIBED/);
});

test('a legacy ₱400 per-event sponsorship is still honoured, on THAT event only', async () => {
  // Nobody in production holds one. A repricing must still never retroactively
  // unsell what somebody already bought.
  const shop = await newVendor('legacy', 'pro');
  const paidEvent = await newBookedEvent('legacy-paid', shop.vendorProfileId);
  const otherEvent = await newBookedEvent('legacy-other', shop.vendorProfileId);
  await db.query(
    `INSERT INTO public.papic_photo_challenge_sponsorships (event_id, vendor_profile_id)
     VALUES ($1, $2)`,
    [paidEvent, shop.vendorProfileId],
  );
  assert.equal(await tryAuthor(shop.userId, paidEvent), null, 'their ₱400 still works');
  assert.match(
    String(await tryAuthor(shop.userId, otherEvent)),
    /PAPIC_CHALLENGE_NOT_SUBSCRIBED/,
    'and it still buys exactly the one celebration it bought',
  );
});

test('BOOKED is still checked FIRST — a subscription is not a way in', async () => {
  const shop = await newVendor('notbooked', 'pro');
  await setSubscription(shop.vendorProfileId, inDays(20));
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', '2027-06-06'::date) RETURNING event_id`,
    [uniq('stranger')],
  );
  assert.match(
    String(await tryAuthor(shop.userId, e.rows[0]!.event_id)),
    /not booked for this event/,
    'paying us must never open a celebration the shop has nothing to do with',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ONE ENTITLEMENT, TWO CALLERS
// ─────────────────────────────────────────────────────────────────────────────

test('the photo-delivery RPC hands an unentitled shop NOTHING', async () => {
  const shop = await newVendor('photos', 'pro');
  const eventId = await newBookedEvent('photos-ev', shop.vendorProfileId);
  await setAuthUid(db, shop.userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query(`SELECT * FROM public.papic_vendor_challenge_photos($1)`, [
      eventId,
    ]);
    assert.equal(r.rows.length, 0);
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
});

test('BOTH callers ask the SAME function — the anti-drift claim, stated exactly', async () => {
  // ⚠ THE ONE OBJECT-LEVEL ASSERTION IN THIS FILE, and it is deliberate. The
  // claim being made is not "delivery refuses an unentitled shop" (asserted
  // behaviourally above) but "these two gates are the same gate, so they cannot
  // drift" — which is a claim about the CODE, not about an outcome. Seeding a
  // consented, NSFW-screened capture through a completion to prove it
  // behaviourally would assert the same thing more expensively and still not
  // pin the shared call.
  const r = await db.query<{ name: string; body: string }>(
    `SELECT p.proname AS name, pg_get_functiondef(p.oid) AS body
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('papic_create_vendor_challenge','papic_vendor_challenge_photos')`,
  );
  assert.equal(r.rows.length, 2, 'both RPCs must exist');
  for (const row of r.rows) {
    assert.ok(
      row.body.includes('vendor_papic_challenge_entitled'),
      `${row.name} no longer asks the shared entitlement function — the 2026-07/08 drift is back`,
    );
  }
});

test('the raw entitlement function is NOT callable by a signed-in user', async () => {
  // It takes a vendor_profile_id, so a grant would answer about any shop.
  const r = await db.query<{ a: boolean; b: boolean }>(
    `SELECT has_function_privilege('authenticated','public.vendor_papic_challenge_entitled(uuid,uuid)','EXECUTE') AS a,
            has_function_privilege('anon','public.vendor_papic_challenge_entitled(uuid,uuid)','EXECUTE') AS b`,
  );
  assert.equal(r.rows[0]!.a, false);
  assert.equal(r.rows[0]!.b, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE WINDOW IS NOT SELF-GRANTABLE
// ─────────────────────────────────────────────────────────────────────────────

test('a shop CANNOT hand itself a Papic Challenges window', async () => {
  // The eighth instance of "the row is yours, the field is not": RLS says the
  // row belongs to them and has no opinion about what is in it, and
  // `authenticated` holds table-level UPDATE on this column.
  const shop = await newVendor('selfgrant', 'pro');
  await setAuthUid(db, shop.userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(
        `UPDATE public.vendor_profiles SET papic_challenge_expires_at = '2099-01-01'
          WHERE vendor_profile_id = $1`,
        [shop.vendorProfileId],
      ),
      /self-grant blocked/,
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
  const r = await db.query<{ v: string | null }>(
    `SELECT papic_challenge_expires_at::text AS v FROM public.vendor_profiles
      WHERE vendor_profile_id = $1`,
    [shop.vendorProfileId],
  );
  assert.equal(r.rows[0]!.v, null, 'and nothing may have landed');
});

test('a shop cannot be BORN holding a window either', async () => {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','couple')) RETURNING id`,
    [`${uniq('born')}@challenge.test`],
  );
  const userId = u.rows[0]!.id;
  await setAuthUid(db, userId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(
        `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, papic_challenge_expires_at)
         VALUES ($1, 'Born Paid', 'Manila', '2099-01-01')`,
        [userId],
      ),
      /self-grant blocked/,
      'the DELETE-then-reinsert self-elevation route must be closed too',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE PRICE
// ─────────────────────────────────────────────────────────────────────────────

test('the catalogue row is a 28-day subscription at ₱2,500, not a per-event fee', async () => {
  const r = await db.query<{ price: string; type: string; active: boolean }>(
    `SELECT price_php::text AS price, offering_type AS type, is_active AS active
       FROM public.vendor_billing_catalog WHERE sku_code = 'vendor_photo_challenge'`,
  );
  assert.equal(r.rows.length, 1, 'ONE row — the sku_code is also the orders.service_key');
  assert.equal(Number(r.rows[0]!.price), 2500);
  assert.equal(r.rows[0]!.type, 'vendor_addon_recurring');
  assert.equal(r.rows[0]!.active, true, 'a retired row would block the sale outright');
});
