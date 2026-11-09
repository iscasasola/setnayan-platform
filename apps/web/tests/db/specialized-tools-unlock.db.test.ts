/**
 * 🧰 SPECIALIZED TOOLS — THE ROWS, THE GRANT, THE TRIAL GUARDS AND THE USAGE RPC. Executed against the replayed
 * migrations (migration 20271331982978, Build 4, owner 2026-11-09).
 *
 *   1 · THE ROWS — `vendor_specialized_tools` ₱499.00 and `vendor_specialized_tools_annual` ₱4,990.00 on sale;
 *       `vendor_photo_challenge`, `vendor_3d_booth`, `vendor_3d_booth_event` retired, NOT deleted, each pointing
 *       at the unlock.
 *   2 · THE GRANT — a live paid window opens the paid tools for a verified Verified-and-up shop; Pro and Ultra
 *       have them with no purchase; an unverified shop, a lapsed plan or an expired window do not. The two
 *       shipped gates read it: Papic challenge authoring/delivery and the branded booth. A legacy window still
 *       counts (paid time honoured). The TS mirror agrees with the SQL on every case.
 *   3 · THE TRIAL — the FIRST booked real-client event, until it ends; then it locks. Not a sample event, not
 *       an event the shop or its team hosts, not a past date; one per BUSINESS; Verified and up only.
 *   4 · THE USAGE RPC — counts opens and scans per tool shape for the caller's booked shop; refuses anything
 *       that is not a shape key; nobody writes the tables directly.
 *
 * SABOTAGE (2026-11-08, each against the replayed migrations, then reverted):
 *   · arm (b) `tier_state IN ('pro','enterprise')` removed from vendor_specialized_tools_unlocked → 2b + 2f RED.
 *   · `AND NOT COALESCE(e.is_sample, FALSE)` removed from the claim → 3b RED alone.
 *   · the host-is-the-shop NOT EXISTS removed → 3c RED alone (the co-host case).
 *   · the business EXISTS made to never match → 3e RED alone.
 *   · the `OR public.vendor_specialized_tools_unlocked(…)` arm dropped from vendor_papic_challenge_entitled → 2d RED.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import {
  SPECIALIZED_TOOL_KEYS,
  specializedToolsUnlockFrom,
  type SpecializedToolsFacts,
} from '../../lib/specialized-tools-access';

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
const uniq = () => `stools-${++seq}-${Date.now()}`;

async function newUser(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  return u.rows[0]!.id;
}

type ShopArgs = { tier?: string; verified?: boolean; reg?: string | null; tierExpires?: string | null };
async function newShop(a: ShopArgs = {}): Promise<{ vpid: string; ownerId: string }> {
  const ownerId = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        tier_state, tier_expires_at, registration_number_raw)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], $3::vendor_verification_state, NOW(),
             $4::vendor_tier_state, $5, $6)
     RETURNING vendor_profile_id`,
    [
      ownerId,
      `Shop ${uniq()}`,
      a.verified === false ? 'unverified' : 'verified',
      a.tier ?? 'verified',
      a.tierExpires ?? null,
      a.reg ?? null,
    ],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, ownerId };
}

type EventArgs = { date?: string; hostUserId?: string | null; status?: string };
/** An event hosted by `hostUserId` (a fresh client by default), then the shop booked on it. */
async function newBooking(vpid: string, a: EventArgs = {}) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('An event','birthday',$1::date) RETURNING event_id`,
    [a.date ?? '2030-08-01'],
  );
  const eventId = e.rows[0]!.event_id;
  const host = a.hostUserId === undefined ? await newUser() : a.hostUserId;
  if (host) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [eventId, host],
    );
  }
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','A Shop',$2::vendor_status,$3,50000) RETURNING vendor_id`,
    [eventId, a.status ?? 'contracted', vpid],
  );
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

async function unlocked(vpid: string, eventId: string | null): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.vendor_specialized_tools_unlocked($1, $2) AS ok`,
    [vpid, eventId],
  );
  return r.rows[0]!.ok;
}

async function claim(vpid: string): Promise<{ status: string; event_id?: string; ends_at?: string }> {
  const r = await db.query<{ r: { status: string; event_id?: string; ends_at?: string } }>(
    `SELECT public.specialized_tools_claim_trial($1) AS r`,
    [vpid],
  );
  return r.rows[0]!.r;
}

async function access(vpid: string) {
  const r = await db.query<{
    trial_used_at: string | null;
    trial_event_id: string | null;
    trial_ends_at: string | null;
    unlock_expires_at: string | null;
  }>(`SELECT * FROM public.vendor_specialized_tools_access WHERE vendor_profile_id = $1`, [vpid]);
  return r.rows[0] ?? null;
}

async function setWindow(vpid: string, iso: string | null) {
  await db.query(
    `INSERT INTO public.vendor_specialized_tools_access (vendor_profile_id, unlock_expires_at)
     VALUES ($1, $2) ON CONFLICT (vendor_profile_id) DO UPDATE SET unlock_expires_at = EXCLUDED.unlock_expires_at`,
    [vpid, iso],
  );
}

const FUTURE = () => new Date(Date.now() + 10 * 864e5).toISOString();
const PAST = () => new Date(Date.now() - 10 * 864e5).toISOString();

/** Run as the signed-in `authenticated` role, then roll everything back. */
async function asUser<T>(uid: string | null, fn: () => Promise<T>, role = 'authenticated'): Promise<T | { err: string }> {
  await db.exec('BEGIN');
  try {
    await setAuthUid(db, uid);
    await db.query(`SELECT set_config('request.jwt.claim.role', $1, true)`, [role]);
    await db.exec(`SET LOCAL ROLE ${role}`);
    return await fn();
  } catch (e) {
    return { err: (e as Error).message };
  } finally {
    await db.exec('ROLLBACK').catch(() => {});
    await db.exec('RESET ROLE').catch(() => {});
    await setAuthUid(db, null).catch(() => {});
  }
}

// ── 1 · THE ROWS ──────────────────────────────────────────────────────────────

test('1a · the unlock is on sale at ₱499.00 / 4 weeks and ₱4,990.00 / year', async () => {
  const r = await db.query<{ sku_code: string; price_php: string; offering_type: string; is_active: boolean }>(
    `SELECT sku_code, price_php::text, offering_type, is_active FROM public.vendor_billing_catalog
      WHERE sku_code IN ('vendor_specialized_tools','vendor_specialized_tools_annual') ORDER BY sku_code`,
  );
  assert.deepEqual(
    r.rows.map((x) => [x.sku_code, Number(x.price_php), x.offering_type, x.is_active]),
    [
      ['vendor_specialized_tools', 499, 'vendor_addon_recurring', true],
      ['vendor_specialized_tools_annual', 4990, 'vendor_addon_recurring', true],
    ],
  );
});

test('1b · the three add-ons it replaces are RETIRED, never deleted, and point at it', async () => {
  const r = await db.query<{
    sku_code: string;
    is_active: boolean;
    retired_at: string | null;
    retirement_reason: string | null;
    replaced_by_sku_code: string | null;
  }>(
    `SELECT sku_code, is_active, retired_at, retirement_reason, replaced_by_sku_code
       FROM public.vendor_billing_catalog
      WHERE sku_code IN ('vendor_photo_challenge','vendor_3d_booth','vendor_3d_booth_event') ORDER BY sku_code`,
  );
  assert.equal(r.rows.length, 3, 'a retired row was deleted');
  for (const row of r.rows) {
    assert.equal(row.is_active, false, row.sku_code);
    assert.ok(row.retired_at, `${row.sku_code} has no retired_at`);
    assert.match(row.retirement_reason ?? '', /Specialized tools/, row.sku_code);
    assert.equal(row.replaced_by_sku_code, 'vendor_specialized_tools', row.sku_code);
  }
});

// ── 2 · THE GRANT ─────────────────────────────────────────────────────────────

test('2a · a live paid window opens the paid tools for a verified Verified or Solo shop — at any event', async () => {
  for (const tier of ['verified', 'solo']) {
    const { vpid } = await newShop({ tier });
    assert.equal(await unlocked(vpid, null), false, `${tier}: nothing bought, nothing open`);
    await setWindow(vpid, FUTURE());
    assert.equal(await unlocked(vpid, null), true, `${tier}: paid window`);
    await setWindow(vpid, PAST());
    assert.equal(await unlocked(vpid, null), false, `${tier}: an expired window locks`);
  }
});

test('2b · Pro and Ultra include it — no purchase; a lapsed plan does not', async () => {
  for (const tier of ['pro', 'enterprise']) {
    const { vpid } = await newShop({ tier });
    assert.equal(await unlocked(vpid, null), true, tier);
    const lapsed = await newShop({ tier, tierExpires: PAST() });
    assert.equal(await unlocked(lapsed.vpid, null), false, `${tier} with an elapsed tier_expires_at`);
  }
});

test('2c · an unverified shop or a Free tier gets nothing from a window', async () => {
  const unverified = await newShop({ tier: 'solo', verified: false });
  await setWindow(unverified.vpid, FUTURE());
  assert.equal(await unlocked(unverified.vpid, null), false, 'unverified');
  const free = await newShop({ tier: 'free' });
  await setWindow(free.vpid, FUTURE());
  assert.equal(await unlocked(free.vpid, null), false, 'free');
  // (`custom` cannot be written any more — vendor_profiles_tier_state_not_custom — so it needs no case.)
});

test('2d · the two shipped gates read the unlock — Papic challenge and the branded booth', async () => {
  const { vpid } = await newShop({ tier: 'verified' });
  const { eventId } = await newBooking(vpid);
  // The booking took the trial; spend it on another event so only the window can open this one.
  await db.query(
    `UPDATE public.vendor_specialized_tools_access SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE vendor_profile_id = $1`,
    [vpid],
  );
  const entitled = async () =>
    (await db.query<{ ok: boolean }>(`SELECT public.vendor_papic_challenge_entitled($1, $2) AS ok`, [vpid, eventId])).rows[0]!.ok;
  const branded = async () =>
    (await db.query<{ id: string }>(`SELECT public.event_branded_booth_vendor_ids($1) AS id`, [eventId])).rows.map((r) => r.id);

  assert.equal(await entitled(), false);
  assert.deepEqual(await branded(), []);
  await setWindow(vpid, FUTURE());
  assert.equal(await entitled(), true, 'the unlock opens Papic challenge');
  // The booth RPC is service_role-only — ask it the way lib/seating.ts does (the service-role JWT).
  await db.exec('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', true)`);
    await db.exec('SET LOCAL ROLE service_role');
    assert.deepEqual(await branded(), [vpid], 'the unlock brands the booth at this event');
  } finally {
    await db.exec('ROLLBACK');
  }
});

test('2e · paid time on a RETIRED add-on is honoured to its end', async () => {
  const { vpid } = await newShop({ tier: 'solo' });
  const { eventId } = await newBooking(vpid);
  await db.query(
    `UPDATE public.vendor_specialized_tools_access SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE vendor_profile_id = $1`,
    [vpid],
  );
  await db.query(`UPDATE public.vendor_profiles SET papic_challenge_expires_at = $2 WHERE vendor_profile_id = $1`, [vpid, FUTURE()]);
  const r = await db.query<{ ok: boolean }>(`SELECT public.vendor_papic_challenge_entitled($1, $2) AS ok`, [vpid, eventId]);
  assert.equal(r.rows[0]!.ok, true);
});

test('2f · the TS mirror agrees with the SQL on every case', async () => {
  const cases: Array<{ tier: string; verified: boolean; tierExpires: string | null; window: string | null }> = [];
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise']) {
    for (const verified of [true, false]) {
      for (const tierExpires of [null, PAST(), FUTURE()]) {
        for (const window of [null, PAST(), FUTURE()]) cases.push({ tier, verified, tierExpires, window });
      }
    }
  }
  for (const c of cases) {
    const { vpid } = await newShop({ tier: c.tier, verified: c.verified, tierExpires: c.tierExpires });
    if (c.window) await setWindow(vpid, c.window);
    const facts: SpecializedToolsFacts = {
      tier_state: c.tier,
      tier_expires_at: c.tierExpires,
      verification_state: c.verified ? 'verified' : 'unverified',
      unlock_expires_at: c.window,
      trial_event_id: null,
      trial_ends_at: null,
    };
    assert.equal(specializedToolsUnlockFrom(facts, null).unlocked, await unlocked(vpid, null), JSON.stringify(c));
  }
});

// ── 3 · THE TRIAL ─────────────────────────────────────────────────────────────

test('3a · the FIRST booked real-client event is the trial — every paid tool there until it ends, then it locks', async () => {
  const { vpid } = await newShop({ tier: 'verified' });
  const first = await newBooking(vpid, { date: '2030-08-01' });
  const second = await newBooking(vpid, { date: '2030-09-01' });
  const a = await access(vpid);
  assert.ok(a?.trial_used_at, 'the booking trigger claimed it');
  assert.equal(a?.trial_event_id, first.eventId);
  assert.equal(new Date(a!.trial_ends_at!).toISOString(), '2030-08-01T16:00:00.000Z', 'the end of 1 Aug, Manila');

  assert.equal(await unlocked(vpid, first.eventId), true, 'open on the trial event');
  assert.equal(await unlocked(vpid, second.eventId), false, 'the NEXT booking needs the unlock');
  assert.equal(await unlocked(vpid, null), false, 'the trial is not a shop-wide window');

  const again = await claim(vpid);
  assert.equal(again.status, 'claimed', 'frozen');
  assert.equal(again.event_id, first.eventId, 'frozen on the FIRST event');
  assert.equal(new Date(again.ends_at!).toISOString(), '2030-08-01T16:00:00.000Z', 'frozen end');

  await db.query(
    `UPDATE public.vendor_specialized_tools_access SET trial_ends_at = NOW() - INTERVAL '1 minute' WHERE vendor_profile_id = $1`,
    [vpid],
  );
  assert.equal(await unlocked(vpid, first.eventId), false, 'after the event it locks');
});

test('3b · a SAMPLE event never takes the trial', async () => {
  // A real shop cannot be BOOKED on a sample event (demo_cross_booking), so the guard is reached the other way:
  // the booking lands while the shop is below the trial floor (Free tier, so nothing is claimed), the event is
  // then marked a sample, and the shop reaches Verified — the claim must still refuse it.
  const { vpid } = await newShop({ tier: 'free' });
  const sample = await newBooking(vpid);
  await db.query(`UPDATE public.events SET is_sample = TRUE WHERE event_id = $1`, [sample.eventId]);
  await db.query(`UPDATE public.vendor_profiles SET tier_state = 'verified' WHERE vendor_profile_id = $1`, [vpid]);
  assert.equal((await claim(vpid)).status, 'no_booking');
  assert.equal(await access(vpid), null);
  const real = await newBooking(vpid);
  assert.equal((await access(vpid))?.trial_event_id, real.eventId, 'the next REAL booking does');
});

test('3c · an event the shop or its team hosts never takes the trial', async () => {
  const owner = await newShop({ tier: 'solo' });
  await newBooking(owner.vpid, { hostUserId: owner.ownerId });
  assert.equal((await claim(owner.vpid)).status, 'no_booking', 'hosted by the owner');

  const team = await newShop({ tier: 'solo' });
  const crew = await newUser();
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'agent')`,
    [team.vpid, crew],
  );
  await newBooking(team.vpid, { hostUserId: crew });
  assert.equal((await claim(team.vpid)).status, 'no_booking', 'hosted by a team member');

  // A real client hosting WITH the shop's owner as a co-host is still the shop's own event.
  const cohost = await newShop({ tier: 'solo' });
  const shared = await newBooking(cohost.vpid, { status: 'shortlisted' });
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [shared.eventId, cohost.ownerId],
  );
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [shared.eventVendorId]);
  assert.equal((await claim(cohost.vpid)).status, 'no_booking', 'co-hosted by the owner');
  assert.equal(await access(cohost.vpid), null);

  const nobody = await newShop({ tier: 'solo' });
  await newBooking(nobody.vpid, { hostUserId: null });
  assert.equal((await claim(nobody.vpid)).status, 'no_booking', 'no client at all');
});

test('3d · a past date never takes the trial', async () => {
  const { vpid } = await newShop({ tier: 'verified' });
  await newBooking(vpid, { date: '2020-01-01' });
  assert.equal((await claim(vpid)).status, 'no_booking');
});

test('3e · ONE trial per BUSINESS — a second shop of the same business gets none', async () => {
  const first = await newShop({ tier: 'verified', reg: 'DTI-7788-1234' });
  await newBooking(first.vpid);
  assert.ok((await access(first.vpid))?.trial_used_at);

  const again = await newShop({ tier: 'verified', reg: 'dti 7788 1234' });
  await newBooking(again.vpid);
  assert.equal(await access(again.vpid), null, 'no trial written for the second shop');
  assert.equal((await claim(again.vpid)).status, 'used_by_business');

  const other = await newShop({ tier: 'verified', reg: 'SEC-0000-9999' });
  await newBooking(other.vpid);
  assert.ok((await access(other.vpid))?.trial_used_at, 'a genuinely different business still gets one');
});

test('3f · Verified and up only — a Free-tier shop, or one that lost its verification, gets no trial', async () => {
  const free = await newShop({ tier: 'free' });
  await newBooking(free.vpid);
  assert.equal((await claim(free.vpid)).status, 'not_eligible', 'free tier');
  assert.equal(await access(free.vpid), null);

  // An unverified shop cannot be booked at all (vendor_not_verified), so: booked while on Free, then unverified.
  const lost = await newShop({ tier: 'free' });
  await newBooking(lost.vpid);
  await db.query(
    `UPDATE public.vendor_profiles SET tier_state = 'solo', verification_state = 'unverified' WHERE vendor_profile_id = $1`,
    [lost.vpid],
  );
  assert.equal((await claim(lost.vpid)).status, 'not_eligible', 'unverified');
  assert.equal(await access(lost.vpid), null);
});

test('3g · a shop that reaches Verified AFTER its first booking still gets that booking — on the first ask', async () => {
  const { vpid } = await newShop({ tier: 'free' });
  const b = await newBooking(vpid);
  assert.equal(await access(vpid), null);
  await db.query(`UPDATE public.vendor_profiles SET tier_state = 'verified' WHERE vendor_profile_id = $1`, [vpid]);
  const c = await claim(vpid);
  assert.equal(c.status, 'claimed');
  assert.equal(c.event_id, b.eventId);
});

test('3h · a booking that is not booked yet takes nothing', async () => {
  const { vpid } = await newShop({ tier: 'verified' });
  await newBooking(vpid, { status: 'shortlisted' });
  assert.equal(await access(vpid), null);
});

// ── 4 · THE USAGE RPC ─────────────────────────────────────────────────────────

test('4a · counts opens and scans per tool shape for the caller’s booked shop', async () => {
  const { vpid, ownerId } = await newShop({ tier: 'verified' });
  const { eventId } = await newBooking(vpid);
  await db.exec('BEGIN');
  try {
    await setAuthUid(db, ownerId);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    await db.exec('SET LOCAL ROLE authenticated');
    const rec = (tool: string, kind: string, mode: string | null = null) =>
      db.query<{ ok: boolean }>(`SELECT public.record_specialized_tool_use($1,$2,$3,NULL,$4,'coordinator') AS ok`, [eventId, tool, kind, mode]);
    assert.equal((await rec('scanner', 'open', 'check_in')).rows[0]!.ok, true);
    await rec('scanner', 'scan', 'check_in');
    await rec('scanner', 'scan', 'check_in');
    await rec('song_desk', 'open');
    await db.exec('RESET ROLE');
    const r = await db.query<{ tool_key: string; scanner_mode: string; opens: number; scans: number; vendor_profile_id: string }>(
      `SELECT tool_key, scanner_mode, opens, scans, vendor_profile_id FROM public.specialized_tool_usage
        WHERE event_id = $1 ORDER BY tool_key`,
      [eventId],
    );
    assert.deepEqual(
      r.rows.map((x) => [x.tool_key, x.scanner_mode, x.opens, x.scans, x.vendor_profile_id]),
      [
        ['scanner', 'check_in', 1, 2, vpid],
        ['song_desk', '', 1, 0, vpid],
      ],
    );
  } finally {
    await db.exec('ROLLBACK').catch(() => {});
    await db.exec('RESET ROLE').catch(() => {});
    await setAuthUid(db, null).catch(() => {});
  }
});

test('4b · a caller who is not a shop booked on the event counts nothing', async () => {
  const { vpid } = await newShop({ tier: 'verified' });
  const { eventId } = await newBooking(vpid);
  const stranger = await newUser();
  const r = await asUser(stranger, async () =>
    (await db.query<{ ok: boolean }>(`SELECT public.record_specialized_tool_use($1,'scanner') AS ok`, [eventId])).rows[0]!.ok,
  );
  assert.equal(r, false);
});

test('4c · ENTERED DATA CANNOT BE SENT — anything but a shape key is refused', async () => {
  const { vpid, ownerId } = await newShop({ tier: 'verified' });
  const { eventId } = await newBooking(vpid);
  for (const [tool, template, mode] of [
    ['scanner', 'Juan Dela Cruz', null],
    ['scanner', null, '+63 917 555 0101'],
    ['scanner', 'table 12', null],
    ['a guest named Ana', null, null],
  ] as const) {
    const r = await asUser(ownerId, () =>
      db.query(`SELECT public.record_specialized_tool_use($1,$2,'open',$3,$4)`, [eventId, tool, template, mode]),
    );
    assert.ok(r && typeof r === 'object' && 'err' in r, `accepted ${tool} / ${template} / ${mode}`);
  }
});

test('4d · nobody writes the two tables directly — not the shop, not anon', async () => {
  const { vpid, ownerId } = await newShop({ tier: 'verified' });
  const { eventId } = await newBooking(vpid);
  const w1 = await asUser(ownerId, () =>
    db.query(
      `INSERT INTO public.vendor_specialized_tools_access (vendor_profile_id, unlock_expires_at)
       VALUES ($1, NOW() + INTERVAL '1 year') ON CONFLICT (vendor_profile_id) DO UPDATE SET unlock_expires_at = EXCLUDED.unlock_expires_at`,
      [vpid],
    ),
  );
  assert.ok('err' in (w1 as object), 'a shop granted itself the unlock');
  const w2 = await asUser(ownerId, () =>
    db.query(
      `INSERT INTO public.specialized_tool_usage (vendor_profile_id, event_id, tool_key, opens) VALUES ($1, $2, 'scanner', 999)`,
      [vpid, eventId],
    ),
  );
  assert.ok('err' in (w2 as object), 'a shop wrote its own usage');
  const w3 = await asUser(null, () => db.query(`SELECT public.record_specialized_tool_use($1,'scanner')`, [eventId]), 'anon');
  assert.ok('err' in (w3 as object), 'anon may call the usage RPC');
  const w4 = await asUser(ownerId, () => db.query(`SELECT public.specialized_tools_claim_trial($1)`, [vpid]));
  assert.ok('err' in (w4 as object), 'a shop may call the trial claim itself');
});

test('4e · neither table is readable by a signed-in session — not even the shop’s own row', async () => {
  const mine = await newShop({ tier: 'verified' });
  const { eventId } = await newBooking(mine.vpid);
  for (const sql of [
    `SELECT * FROM public.vendor_specialized_tools_access`,
    `SELECT * FROM public.specialized_tool_usage`,
  ]) {
    const r = await asUser(mine.ownerId, () => db.query(sql));
    assert.ok('err' in (r as object), `readable by authenticated: ${sql}`);
  }
  void eventId;
});

test('4f · the TS tool-key list is the table’s CHECK list, exactly', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'specialized_tool_usage_tool_key_known'`,
  );
  const sqlKeys = [...(r.rows[0]?.def ?? '').matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(sqlKeys, [...SPECIALIZED_TOOL_KEYS].sort());
});
