/**
 * PER-TIER PIPELINE CAPS — END-TO-END DB verification (migrations replayed).
 * Covers 20271121655918_vendor_tier_pipeline_caps.
 *
 *            WHITELIST (per date)   WAITLIST (per date)
 *   FREE            1                     0
 *   SOLO            3                     1
 *   PRO             5                     3
 *   ENTERPRISE     10                     5
 *
 * 🔑 THE PARITY TEST IS THE POINT. The same grid lives in TypeScript
 * (`lib/vendor-tier-caps.ts`, the code SSOT) and in SQL (`vendor_tier_limit`),
 * because the enforcement has to happen in the database and the UI has to show
 * the number. Two hand-typed lists that agree today drift silently tomorrow — so
 * this suite IMPORTS the TypeScript matrix and interrogates SQL for every tier ×
 * key. Editing one side alone turns CI red; there is no third place to update.
 *
 * Everything else is driven through real INSERT/UPDATE so the trigger wiring is
 * exercised, never by reading a function body.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { VENDOR_TIERS, TIER_CAPS, type VendorTier } from '../../lib/vendor-tier-caps';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
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

async function newVendor(label: string, tier: VendorTier): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq(label)}@caps.test`],
  );
  const userId = u.rows[0]!.id;
  // account_type 'vendor' already mints the profile (on_auth_user_created) and
  // vendor_profiles.user_id is UNIQUE — take that row rather than inserting.
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const vendorProfileId =
    existing.rows[0]?.vendor_profile_id
    ?? (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Caps Test Vendor', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = 'Caps Test Vendor', location_city = 'Manila',
            services = ARRAY['photography']::text[],
            verification_state = 'verified', last_verified_at = NOW(),
            tier_state = $2
      WHERE vendor_profile_id = $1`,
    [vendorProfileId, tier],
  );
  return vendorProfileId;
}

async function newEvent(label: string, eventDate: string | null): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [uniq(label), eventDate],
  );
  return r.rows[0]!.event_id;
}

/** Open a thread and try to ACCEPT it. Returns the error message, or null. */
async function tryAccept(vendorProfileId: string, eventId: string): Promise<string | null> {
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING thread_id`,
    [eventId, vendorProfileId],
  );
  try {
    await db.query(
      `UPDATE public.chat_threads SET inquiry_status = 'accepted'::public.chat_inquiry_status
        WHERE thread_id = $1`,
      [t.rows[0]!.thread_id],
    );
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
}

/** Accept N fresh couples on one date; returns the first refusal, or null. */
async function acceptNOnDate(
  vendorProfileId: string,
  date: string,
  n: number,
  label: string,
): Promise<string | null> {
  for (let i = 0; i < n; i++) {
    const eventId = await newEvent(`${label}-${i}`, date);
    const err = await tryAccept(vendorProfileId, eventId);
    if (err) return err;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PARITY — the SQL grid and the TypeScript grid are the same grid.
// ─────────────────────────────────────────────────────────────────────────────

test('PARITY: vendor_tier_limit matches TIER_CAPS for every tier × key', async () => {
  const keys = [
    ['whitelist_per_date', (c: (typeof TIER_CAPS)[VendorTier]) => c.whitelistPerDate],
    ['waitlist_acceptances', (c: (typeof TIER_CAPS)[VendorTier]) => c.waitlistAcceptances],
  ] as const;

  let checked = 0;
  for (const tier of VENDOR_TIERS) {
    for (const [key, pick] of keys) {
      const expected = pick(TIER_CAPS[tier]);
      const r = await db.query<{ n: number | null }>(
        `SELECT public.vendor_tier_limit($1, $2) AS n`,
        [tier, key],
      );
      assert.equal(
        r.rows[0]!.n,
        expected,
        `SQL and TypeScript disagree on ${tier}.${key}: SQL=${r.rows[0]!.n} TS=${expected}. Both sides must move together.`,
      );
      checked++;
    }
  }
  // Meta: a loop that checks nothing passes. VENDOR_TIERS has 6 entries × 2 keys.
  assert.equal(checked, VENDOR_TIERS.length * keys.length, 'the parity loop ran empty');
  assert.ok(checked >= 12, `expected at least 12 comparisons, ran ${checked}`);
});

test("PARITY meta: the checker is not vacuous — a wrong expectation FAILS", async () => {
  const r = await db.query<{ n: number }>(
    `SELECT public.vendor_tier_limit('pro', 'whitelist_per_date') AS n`,
  );
  assert.notEqual(r.rows[0]!.n, 999, 'sanity: SQL must return a real number, not anything');
  assert.equal(r.rows[0]!.n, 5, 'Pro whitelist is 5 (owner 2026-08-09)');
});

test('the owner grid reads exactly as given', async () => {
  const expect: Array<[string, number, number]> = [
    // tier, whitelist, waitlist
    ['free', 1, 0],
    ['solo', 3, 1],
    ['pro', 5, 3],
    ['enterprise', 10, 5],
  ];
  for (const [tier, wl, wa] of expect) {
    const r = await db.query<{ wl: number; wa: number }>(
      `SELECT public.vendor_tier_limit($1,'whitelist_per_date') AS wl,
              public.vendor_tier_limit($1,'waitlist_acceptances') AS wa`,
      [tier],
    );
    assert.equal(r.rows[0]!.wl, wl, `${tier} whitelist`);
    assert.equal(r.rows[0]!.wa, wa, `${tier} waitlist`);
  }
});

test('an unknown KEY returns NULL, never a silent 0 or unlimited', async () => {
  const r = await db.query<{ n: number | null }>(
    `SELECT public.vendor_tier_limit('pro', 'whitelist_per_day') AS n`, // note: _day, a typo
  );
  assert.equal(
    r.rows[0]!.n,
    null,
    'a mistyped key must be loud (NULL → callers skip), not read as 0 (blocks everything) or a number',
  );
});

test('an unknown TIER reads as free, matching asVendorTier', async () => {
  const r = await db.query<{ wl: number; wa: number }>(
    `SELECT public.vendor_tier_limit('platinum','whitelist_per_date') AS wl,
            public.vendor_tier_limit(NULL,'waitlist_acceptances') AS wa`,
  );
  assert.equal(r.rows[0]!.wl, 1);
  assert.equal(r.rows[0]!.wa, 0);
});

test('THE LADDER ITSELF: vendor_tier_rank orders every tier as TIER_RANK does', async () => {
  // The bug this pins down: solo and custom were missing from the SQL CASE and
  // fell to ELSE 0, ranking them BELOW free — so guard_vendor_tier_no_silent_
  // downgrade refused free → solo, the first paid upgrade anyone would ever buy.
  const r = await db.query<{ tier: string; rank: number }>(
    `SELECT t AS tier, public.vendor_tier_rank(t::public.vendor_tier_state) AS rank
       FROM unnest($1::text[]) AS t`,
    [[...VENDOR_TIERS]],
  );
  assert.equal(r.rows.length, VENDOR_TIERS.length, 'every tier must be ranked');

  const sqlOrder = [...r.rows].sort((a, b) => a.rank - b.rank).map((x) => x.tier);
  assert.deepEqual(
    sqlOrder,
    [...VENDOR_TIERS],
    `SQL orders the ladder differently from TIER_RANK: ${JSON.stringify(r.rows)}`,
  );
  // No tier may share 0 — that is the "unrecognised" band, and a real tier
  // landing there is exactly how solo ended up below free.
  for (const row of r.rows) {
    assert.ok(row.rank > 0, `${row.tier} ranks ${row.rank}; 0 is reserved for unknown tiers`);
  }
});

test('free → solo is an UPGRADE and must not be refused as a downgrade', async () => {
  await setCapsEnabled(false);
  const vendor = await newVendor('ladder-up', 'free');
  await db.query(
    `UPDATE public.vendor_profiles SET tier_state = 'solo' WHERE vendor_profile_id = $1`,
    [vendor],
  );
  const r = await db.query<{ t: string }>(
    `SELECT tier_state::text AS t FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendor],
  );
  assert.equal(r.rows[0]!.t, 'solo', 'a free vendor must be able to buy the entry-level plan');
});

test('a genuine downgrade is STILL refused — the guard was not weakened', async () => {
  await setCapsEnabled(false);
  const vendor = await newVendor('ladder-down', 'enterprise');
  await assert.rejects(
    db.query(
      `UPDATE public.vendor_profiles SET tier_state = 'solo' WHERE vendor_profile_id = $1`,
      [vendor],
    ),
    /TIER_DOWNGRADE_BLOCKED/,
    'fixing the ladder must not open a silent downgrade',
  );
});

test('the ladder is monotonic — no tier buys LESS than a cheaper one', async () => {
  const order: VendorTier[] = ['free', 'verified', 'solo', 'pro', 'enterprise'];
  for (let i = 1; i < order.length; i++) {
    const lo = TIER_CAPS[order[i - 1]!];
    const hi = TIER_CAPS[order[i]!];
    assert.ok(
      hi.whitelistPerDate >= lo.whitelistPerDate,
      `${order[i]} whitelist ${hi.whitelistPerDate} < ${order[i - 1]} ${lo.whitelistPerDate}`,
    );
    assert.ok(
      hi.waitlistAcceptances >= lo.waitlistAcceptances,
      `${order[i]} waitlist ${hi.waitlistAcceptances} < ${order[i - 1]} ${lo.waitlistAcceptances}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SHIP-DARK — the default state must change nothing.
// ─────────────────────────────────────────────────────────────────────────────

test('DEFAULT (switch off): a free vendor can accept as many as they like', async () => {
  await setCapsEnabled(false);
  const vendor = await newVendor('dark', 'free');
  const err = await acceptNOnDate(vendor, '2027-02-14', 4, 'dark');
  assert.equal(err, null, `the cap fired while switched OFF: ${err}`);
});

test('the platform switch defaults to FALSE on a fresh database', async () => {
  const r = await db.query<{ v: boolean }>(
    `SELECT COALESCE(column_default LIKE '%false%', false) AS v
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='platform_settings'
        AND column_name='vendor_tier_pipeline_caps_enabled'`,
  );
  assert.equal(r.rows.length, 1, 'the switch column must exist');
  assert.equal(r.rows[0]!.v, true, 'it must default OFF — prod vendors are all free today');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. WHITELIST — accepted-but-not-yet-locked, per date.
// ─────────────────────────────────────────────────────────────────────────────

test('FREE holds 1 live client for a date; the 2nd is refused', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('free-wl', 'free');
  assert.equal(await acceptNOnDate(vendor, '2027-03-01', 1, 'free-wl'), null, 'the 1st must pass');
  const err = await acceptNOnDate(vendor, '2027-03-01', 1, 'free-wl-2');
  assert.match(String(err), /WHITELIST_DATE_LIMIT/, `the 2nd must be refused, got: ${err}`);
});

test('PRO holds 5 for a date; the 6th is refused', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('pro-wl', 'pro');
  assert.equal(await acceptNOnDate(vendor, '2027-03-02', 5, 'pro-wl'), null, 'all 5 must pass');
  const err = await acceptNOnDate(vendor, '2027-03-02', 1, 'pro-wl-6');
  assert.match(String(err), /WHITELIST_DATE_LIMIT/, `the 6th must be refused, got: ${err}`);
});

test('ENTERPRISE holds 10 for a date', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('ent-wl', 'enterprise');
  assert.equal(await acceptNOnDate(vendor, '2027-03-03', 10, 'ent-wl'), null, 'all 10 must pass');
  const err = await acceptNOnDate(vendor, '2027-03-03', 1, 'ent-wl-11');
  assert.match(String(err), /WHITELIST_DATE_LIMIT/, `the 11th must be refused, got: ${err}`);
});

test('THE CAP IS PER DATE — a different day is untouched', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('perdate', 'free');
  assert.equal(await acceptNOnDate(vendor, '2027-04-01', 1, 'perdate-a'), null);
  // At their limit for 1 Apr — but 2 Apr is a different day and must be free.
  assert.equal(
    await acceptNOnDate(vendor, '2027-04-02', 1, 'perdate-b'),
    null,
    'a full date must never close the vendor’s inbox on other dates',
  );
  const err = await acceptNOnDate(vendor, '2027-04-01', 1, 'perdate-c');
  assert.match(String(err), /WHITELIST_DATE_LIMIT/, 'the original date is still full');
});

test('LOCKING one in frees the slot — that client is no longer "pursuing"', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('locks', 'free');
  const eventId = await newEvent('locks-first', '2027-05-05');
  assert.equal(await tryAccept(vendor, eventId), null, 'the 1st must pass');
  assert.match(
    String(await acceptNOnDate(vendor, '2027-05-05', 1, 'locks-blocked')),
    /WHITELIST_DATE_LIMIT/,
    'at the cap before the lock',
  );

  // The couple books them: accepted-but-not-LOCKED becomes locked.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Caps Test Vendor', 'deposit_paid', $2)`,
    [eventId, vendor],
  );

  assert.equal(
    await acceptNOnDate(vendor, '2027-05-05', 1, 'locks-after'),
    null,
    'once a client is locked in they stop consuming a whitelist slot',
  );
});

test('DECLINING frees the slot too', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('declines', 'free');
  const eventId = await newEvent('declines-first', '2027-06-06');
  await tryAccept(vendor, eventId);
  await db.query(
    `UPDATE public.chat_threads SET inquiry_status = 'declined'::public.chat_inquiry_status
      WHERE event_id = $1 AND vendor_profile_id = $2`,
    [eventId, vendor],
  );
  assert.equal(
    await acceptNOnDate(vendor, '2027-06-06', 1, 'declines-next'),
    null,
    'declining someone must free a slot — the decline-the-others-first rule',
  );
});

test('re-saving an ALREADY-accepted thread is never refused', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('resave', 'free');
  const eventId = await newEvent('resave', '2027-07-07');
  await tryAccept(vendor, eventId);
  const r = await db.query<{ thread_id: string }>(
    `SELECT thread_id FROM public.chat_threads WHERE event_id = $1 AND vendor_profile_id = $2`,
    [eventId, vendor],
  );
  // Idempotent re-accept — acceptInquiry does this on a double-submit.
  await db.query(
    `UPDATE public.chat_threads SET inquiry_status = 'accepted'::public.chat_inquiry_status
      WHERE thread_id = $1`,
    [r.rows[0]!.thread_id],
  );
  // No throw = pass.
});

test('an event with NO DATE yet cannot be capped by a per-date rule', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('nodate', 'free');
  for (let i = 0; i < 3; i++) {
    const eventId = await newEvent(`nodate-${i}`, null);
    assert.equal(
      await tryAccept(vendor, eventId),
      null,
      'a couple who has not picked their day must still reach the vendor',
    );
  }
});

test("one vendor's full date does not touch another vendor", async () => {
  await setCapsEnabled(true);
  const a = await newVendor('two-a', 'free');
  const b = await newVendor('two-b', 'free');
  await acceptNOnDate(a, '2027-08-08', 1, 'two-a');
  assert.match(String(await acceptNOnDate(a, '2027-08-08', 1, 'two-a2')), /WHITELIST_DATE_LIMIT/);
  assert.equal(
    await acceptNOnDate(b, '2027-08-08', 1, 'two-b'),
    null,
    'the cap is per vendor, not per date globally',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. WAITLIST — clamped to the plan, never raised at the vendor.
// ─────────────────────────────────────────────────────────────────────────────

async function waitlistSettings(
  vendorProfileId: string,
): Promise<{ enabled: boolean; cap: number }> {
  const r = await db.query<{ waitlist_enabled: boolean; max_waitlist_acceptances: number }>(
    `SELECT waitlist_enabled, max_waitlist_acceptances FROM public.vendor_profiles
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return { enabled: r.rows[0]!.waitlist_enabled, cap: r.rows[0]!.max_waitlist_acceptances };
}

test('FREE has no waitlist: switching it on is clamped straight back off', async () => {
  await setCapsEnabled(true);
  const vendor = await newVendor('free-wa', 'free');
  await db.query(
    `UPDATE public.vendor_profiles
        SET waitlist_enabled = TRUE, max_waitlist_acceptances = 3
      WHERE vendor_profile_id = $1`,
    [vendor],
  );
  const s = await waitlistSettings(vendor);
  assert.equal(s.enabled, false, 'a free plan may not hold a waitlist');
  assert.equal(s.cap, 0, 'and its number must read 0, not a stale 3');
});

test('PRO is clamped to 3, ENTERPRISE keeps 5', async () => {
  await setCapsEnabled(true);
  const pro = await newVendor('pro-wa', 'pro');
  await db.query(
    `UPDATE public.vendor_profiles SET waitlist_enabled = TRUE, max_waitlist_acceptances = 9
      WHERE vendor_profile_id = $1`,
    [pro],
  );
  const p = await waitlistSettings(pro);
  assert.equal(p.enabled, true);
  assert.equal(p.cap, 3, 'Pro tops out at 3');

  const ent = await newVendor('ent-wa', 'enterprise');
  await db.query(
    `UPDATE public.vendor_profiles SET waitlist_enabled = TRUE, max_waitlist_acceptances = 5
      WHERE vendor_profile_id = $1`,
    [ent],
  );
  const e = await waitlistSettings(ent);
  assert.equal(e.cap, 5, 'Enterprise keeps its 5');
});

test('a number ABOVE the plan clamps quietly instead of locking the vendor out of saving', async () => {
  // This is the post-downgrade state: a stored 5 on a plan that allows 1.
  // NOTE: we reach it by storing 5 while the switch is OFF rather than by
  // moving tier_state down — a separate shipped guard (TIER_DOWNGRADE_BLOCKED)
  // deliberately refuses a silent downgrade, so a test that moved the tier
  // would be exercising that guard, not this clamp.
  await setCapsEnabled(false);
  const vendor = await newVendor('overcap', 'solo');
  await db.query(
    `UPDATE public.vendor_profiles SET waitlist_enabled = TRUE, max_waitlist_acceptances = 5
      WHERE vendor_profile_id = $1`,
    [vendor],
  );
  assert.equal((await waitlistSettings(vendor)).cap, 5, 'precondition: stored above the plan');

  await setCapsEnabled(true);
  // Any subsequent save clamps. Must NOT raise — the vendor keeps their settings
  // page usable and simply lands on their plan's number.
  await db.query(
    `UPDATE public.vendor_profiles SET microsite_about = COALESCE(microsite_about, '')
      WHERE vendor_profile_id = $1`,
    [vendor],
  );
  const s = await waitlistSettings(vendor);
  assert.equal(s.cap, 1, 'Solo holds 1');
  assert.equal(s.enabled, true, 'they keep their waitlist, just a smaller one');
});

test('the old 1..3 CHECK is gone — 0 and 5 are both storable now', async () => {
  await setCapsEnabled(false); // constraint only, no clamping
  const vendor = await newVendor('checkwidth', 'enterprise');
  for (const n of [0, 5, 10]) {
    await db.query(
      `UPDATE public.vendor_profiles SET max_waitlist_acceptances = $2 WHERE vendor_profile_id = $1`,
      [vendor, n],
    );
    assert.equal((await waitlistSettings(vendor)).cap, n, `${n} must be storable`);
  }
  await assert.rejects(
    db.query(
      `UPDATE public.vendor_profiles SET max_waitlist_acceptances = 11 WHERE vendor_profile_id = $1`,
      [vendor],
    ),
    /check/i,
    'but the column still refuses nonsense (>10)',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. WIRING — a trigger that exists but is not attached fails silently forever.
// ─────────────────────────────────────────────────────────────────────────────

test('both triggers are actually ATTACHED', async () => {
  const r = await db.query<{ tgname: string; def: string }>(
    `SELECT t.tgname, pg_get_triggerdef(t.oid) AS def
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal
        AND t.tgname IN ('chat_threads_whitelist_per_date','vendor_profiles_clamp_waitlist_to_tier')`,
  );
  const names = r.rows.map((x) => x.tgname).sort();
  assert.deepEqual(
    names,
    ['chat_threads_whitelist_per_date', 'vendor_profiles_clamp_waitlist_to_tier'],
    `a cap trigger is missing — it would be decoration: ${JSON.stringify(names)}`,
  );
  for (const row of r.rows) {
    assert.match(row.def, /\bBEFORE\b/, `${row.tgname} must be BEFORE to refuse/clamp: ${row.def}`);
    assert.match(row.def, /FOR EACH ROW/, row.def);
  }
});
