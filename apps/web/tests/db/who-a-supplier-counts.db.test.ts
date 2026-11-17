/**
 * 🧮 WHO A SUPPLIER COUNTS — the SQL half (owner 2026-11-04; migration 20271307968824). Owner, verbatim: *"this way, a
 * supplier can count what they need to give. so for example. exclusive for principal sponsors. we only count the
 * attending principal sponsors."* · *"not counted for will be for service cards with pax only"*.
 *
 * Against the replayed migrations:
 *   · the rule changes the readers' count — `only` = the attending guests holding a picked role or in a picked group
 *     (each guest once), minus the per-guest ticks; `except` = attending minus the picked, minus the ticks;
 *   · the supplier's breakdown (`get_vendor_headcount_rule`) is the readers' number, split into not counted · outside;
 *   · a tick on an UNBOOKED supplier changes no count until that supplier is booked;
 *   · a flat-priced service takes no tick and no rule, and is never listed;
 *   · a supplier can never read who — not the rule table, not the helpers, no guest id or name in what it is handed;
 *   · a deleted group drops out of the rule.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let couple = '';
const shop: Record<string, { uid: string; vpid: string; booking: string }> = {};
const g: Record<string, string> = {};
let kids = '';

type Json = Record<string, unknown>;

async function newUser(email: string): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    )
  ).rows[0]!.id;
}

/** A shop, one service card (per head or flat), and a booking of it on the event in `status`. */
async function supplier(key: string, category: string, basis: 'per_pax' | 'fixed', status: string): Promise<void> {
  const uid = await newUser(`${key}@whocounts.test`);
  const vpid = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1, $2, 'Manila', ARRAY[$3]::text[], 'verified', NOW(), 'verified') RETURNING vendor_profile_id AS v`,
      [uid, `${key} Co`, category],
    )
  ).rows[0]!.v;
  const card = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, pricing_basis, per_pax_price_php, min_pax, is_active)
       VALUES ($1, $2, 1000, $3, $4, $5, FALSE) RETURNING vendor_service_id AS s`,
      [vpid, category, basis, basis === 'per_pax' ? 1000 : null, basis === 'per_pax' ? 1 : null],
    )
  ).rows[0]!.s;
  const booking = (
    await db.query<{ b: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1, $2::public.vendor_category, $3, $4::public.vendor_status, $5, $6) RETURNING vendor_id AS b`,
      [eventId, category, `${key} Co`, status, vpid, card],
    )
  ).rows[0]!.b;
  shop[key] = { uid, vpid, booking };
}

async function guest(first: string, role: string, rsvp = 'attending'): Promise<string> {
  const id = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status, role)
       VALUES ($1, $2, 'Santos', 'both', 'friends', $3::public.rsvp_status, $4::public.guest_role) RETURNING guest_id`,
      [eventId, first, rsvp, role],
    )
  ).rows[0]!.guest_id;
  g[first] = id;
  return id;
}

async function asPostgres(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
}
async function asSignedIn(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
}
async function asSupplier(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
}

async function call(fn: string): Promise<Json | null> {
  return (await db.query<{ r: Json | null }>(`SELECT public.${fn}($1) AS r`, [eventId])).rows[0]!.r;
}

/** What one supplier is told: the brief's attending number and the breakdown. */
async function told(key: string): Promise<{ brief: number; why: Json | null; briefRaw: Json }> {
  await asSupplier(shop[key]!.uid);
  const brief = (await call('get_vendor_event_brief'))!;
  const why = await call('get_vendor_headcount_rule');
  await asPostgres();
  return { brief: Number((brief.pax as Json).attending), why, briefRaw: brief };
}

/** The couple's own view of every per-head service. */
async function coupleSees(): Promise<{ services: Json[]; groups: Json[]; roster: Json[] }> {
  await asSignedIn(couple);
  const r = (await call('get_event_service_counts')) as { services: Json[]; groups: Json[]; roster: Json[] };
  await asPostgres();
  return r;
}

async function setRule(key: string, mode: string, roles: string[], groups: string[]): Promise<void> {
  await asSignedIn(couple);
  await db.query(
    `INSERT INTO public.event_vendor_count_rules (event_vendor_id, event_id, mode, roles, group_ids)
     VALUES ($1, $2, $3, $4::public.guest_role[], $5::uuid[])
     ON CONFLICT (event_vendor_id) DO UPDATE SET mode = EXCLUDED.mode, roles = EXCLUDED.roles, group_ids = EXCLUDED.group_ids`,
    [shop[key]!.booking, eventId, mode, `{${roles.join(',')}}`, `{${groups.join(',')}}`],
  );
  await asPostgres();
}

async function tick(guestId: string, key: string): Promise<void> {
  await asSignedIn(couple);
  await db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) VALUES ($1, $2)`, [guestId, shop[key]!.booking]);
  await asPostgres();
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  couple = await newUser('couple@whocounts.test');
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Who counts', 'birthday', '2099-06-06') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);

  await supplier('juan', 'catering', 'per_pax', 'contracted'); // the caterer, booked
  await supplier('bloom', 'gifts_and_giveaways', 'per_pax', 'contracted'); // the sponsors' giveaway, booked
  await supplier('hacienda', 'venue', 'fixed', 'contracted'); // a flat-priced venue, booked
  await supplier('lens', 'catering', 'per_pax', 'shortlisted'); // a second caterer, quoted — not booked

  await guest('Ninong', 'principal_sponsor_ninong');
  await guest('Ninang', 'principal_sponsor_ninang');
  await guest('Groomsman', 'groomsman');
  await guest('Mia', 'flower_girl');
  await guest('Bimbo', 'guest');
  await guest('Plain', 'guest');
  await guest('Other', 'guest');
  await guest('Late', 'principal_sponsor', 'pending'); // not attending — never counted
  kids = (
    await db.query<{ id: string }>(`INSERT INTO public.guest_groups (event_id, label) VALUES ($1, 'Kids') RETURNING group_id AS id`, [eventId])
  ).rows[0]!.id;
  await db.query(`INSERT INTO public.guest_group_memberships (group_id, guest_id) VALUES ($1, $2), ($1, $3)`, [kids, g.Mia, g.Bimbo]);
});
after(async () => {
  await asPostgres();
  await db?.close();
});
beforeEach(asPostgres);

test('no rule, no tick: every per-head supplier counts all 7 attending', async () => {
  for (const key of ['juan', 'bloom']) {
    const t = await told(key);
    assert.equal(t.brief, 7, `${key} brief`);
    assert.deepEqual(
      { attending: t.why?.attending, not_counted: t.why?.not_counted, outside_rule: t.why?.outside_rule, counted: t.why?.counted, mode: t.why?.mode },
      { attending: 7, not_counted: 0, outside_rule: 0, counted: 7, mode: 'all' },
    );
  }
});

test('ONLY: the giveaway counts the attending principal sponsors — the pending one is never counted', async () => {
  await setRule('bloom', 'only', ['principal_sponsor', 'principal_sponsor_ninong', 'principal_sponsor_ninang'], []);
  const t = await told('bloom');
  assert.equal(t.brief, 2, 'the brief does not honour the rule');
  assert.equal(t.why?.counted, 2);
  assert.equal(t.why?.outside_rule, 5);
  assert.equal(t.why?.not_counted, 0);
  assert.deepEqual(t.why?.groups, []);
  // An extra role counts too.
  await db.query(`UPDATE public.guests SET extra_roles = ARRAY['principal_sponsor']::public.guest_role[] WHERE guest_id = $1`, [g.Plain]);
  assert.equal((await told('bloom')).brief, 3, 'an extra role is not read by the rule');
  await db.query(`UPDATE public.guests SET extra_roles = ARRAY[]::public.guest_role[] WHERE guest_id = $1`, [g.Plain]);
  // The caterer is untouched by another supplier's rule.
  assert.equal((await told('juan')).brief, 7, 'another supplier’s rule changed the caterer’s count');
});

test('ONLY = the sum of the picked roles and groups that are attending (each guest once), minus the ticks', async () => {
  // Principal sponsors (2) + Kids (Mia, Kid = 2); Mia is also a flower girl — picked twice, counted once.
  await setRule('bloom', 'only', ['principal_sponsor_ninong', 'principal_sponsor_ninang', 'flower_girl'], [kids]);
  assert.equal((await told('bloom')).brief, 4);
  await tick(g.Bimbo!, 'bloom');
  const t = await told('bloom');
  assert.equal(t.brief, 3, 'a tick inside the rule is not subtracted');
  assert.deepEqual([t.why?.attending, t.why?.not_counted, t.why?.outside_rule, t.why?.counted], [7, 1, 3, 3]);
  // A tick on a guest already OUTSIDE the rule is not subtracted twice.
  await tick(g.Plain!, 'bloom');
  const u = await told('bloom');
  assert.equal(u.brief, 3, 'a guest outside the rule was subtracted twice');
  assert.deepEqual([u.why?.not_counted, u.why?.outside_rule], [1, 3]);
});

test('EXCEPT = attending minus the picked, minus the ticks — across all three readers', async () => {
  await setRule('juan', 'except', [], [kids]);
  let t = await told('juan');
  assert.equal(t.brief, 5);
  await tick(g.Other!, 'juan');
  t = await told('juan');
  assert.equal(t.brief, 4);
  assert.deepEqual([t.why?.attending, t.why?.not_counted, t.why?.outside_rule, t.why?.counted], [7, 1, 2, 4]);
  await asSupplier(shop.juan!.uid);
  const metrics = (await call('get_vendor_catering_metrics'))!;
  assert.equal((metrics.headcount_scenarios as Json).confirmed, 4, 'the production sheet does not honour the rule');
  await asPostgres();
  // The couple sees the same number.
  const juan = (await coupleSees()).services.find((s) => s.id === shop.juan!.booking)!;
  assert.deepEqual([juan.counted, juan.mode, juan.group_ids], [4, 'except', [kids]]);
});

test('a tick on an UNBOOKED supplier changes no count until it is booked', async () => {
  const beforeJuan = (await told('juan')).brief;
  const beforeBloom = (await told('bloom')).brief;
  await tick(g.Ninong!, 'lens'); // allowed now — the list shows every supplier
  await setRule('lens', 'except', [], [kids]); // and a rule on a quote is kept for when it is booked
  assert.equal((await told('juan')).brief, beforeJuan, 'a tick on a quote moved a booked supplier’s count');
  assert.equal((await told('bloom')).brief, beforeBloom);
  // The quoted shop itself is told nothing — it is not booked.
  await asSupplier(shop.lens!.uid);
  // Its brief (stage-aware) still counts all 7 — the readers hand the helper BOOKED bookings only.
  const early = await db.query<{ r: Json }>(`SELECT public.get_vendor_event_brief($1) AS r`, [eventId]).then((r) => r.rows[0]!.r).catch(() => null);
  const pax = early?.pax as Json | undefined;
  if (pax) assert.equal(Number(pax.attending), 7, 'a quoted shop is told a count its tick already moved');
  await assert.rejects(db.query(`SELECT public.get_vendor_headcount_rule($1)`, [eventId]), /not_booked/);
  await asPostgres();
  // The couple sees what it WILL count: 7 − Kids (2) − Ninong (1) = 4, flagged not booked.
  const lens = (await coupleSees()).services.find((s) => s.id === shop.lens!.booking)!;
  assert.deepEqual([lens.booked, lens.counted], [false, 4]);
  // Booked → the tick and the rule apply.
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [shop.lens!.booking]);
  assert.equal((await told('lens')).brief, 4, 'the tick did not apply once booked');
});

test('a flat-priced service takes no tick, no rule, and is never listed', async () => {
  await asSignedIn(couple);
  await assert.rejects(
    db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) VALUES ($1, $2)`, [g.Bimbo, shop.hacienda!.booking]),
    /not priced per head/,
  );
  await assert.rejects(
    db.query(`INSERT INTO public.event_vendor_count_rules (event_vendor_id, event_id, mode) VALUES ($1, $2, 'except')`, [
      shop.hacienda!.booking,
      eventId,
    ]),
    /not priced per head/,
  );
  await asPostgres();
  const ids = (await coupleSees()).services.map((s) => s.id);
  assert.ok(!ids.includes(shop.hacienda!.booking), 'a flat-priced service is listed');
  assert.ok(ids.includes(shop.juan!.booking));
  const h = await told('hacienda');
  assert.equal(h.why, null, 'a flat-priced supplier is handed a count tile');
  assert.equal(h.brief, 7, 'a flat-priced supplier’s headcount moved');
});

test('a supplier never reads who — not the rule, not the helpers, no id or name in what it is handed', async () => {
  for (const key of ['juan', 'bloom', 'lens']) {
    const t = await told(key);
    const handed = JSON.stringify([t.why, t.briefRaw.pax]);
    for (const [name, id] of Object.entries(g)) {
      assert.ok(!handed.includes(id), `${key} is handed ${name}'s guest id`);
      assert.ok(!t.why || !JSON.stringify(t.why).includes(name), `${key} is handed ${name}'s name`);
    }
  }
  await asSignedIn(shop.juan!.uid);
  assert.equal((await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.event_vendor_count_rules`)).rows[0]!.n, 0);
  await assert.rejects(db.query(`SELECT * FROM public.event_vendor_left_out($1, $2)`, [eventId, shop.juan!.booking]), /permission denied/);
  await assert.rejects(db.query(`SELECT public.event_vendor_headcount($1, ARRAY[$2]::uuid[])`, [eventId, shop.juan!.booking]), /permission denied/);
  await assert.rejects(db.query(`SELECT public.get_event_service_counts($1)`, [eventId]), /not_allowed/);
  await assert.rejects(
    db.query(`INSERT INTO public.event_vendor_count_rules (event_vendor_id, event_id, mode) VALUES ($1, $2, 'only')`, [shop.juan!.booking, eventId]),
    /row-level security|permission denied/,
  );
  await db.exec('RESET ROLE');
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query(`SELECT 1 FROM public.event_vendor_count_rules`), /permission denied/);
  await assert.rejects(db.query(`SELECT public.get_event_service_counts($1)`, [eventId]), /permission denied/);
  // The couple's roster carries roles, groups and ticks — never an id or a name.
  const roster = JSON.stringify((await coupleSees()).roster);
  for (const [name, id] of Object.entries(g)) {
    assert.ok(!roster.includes(id) && !roster.includes(name), `the roster names ${name}`);
  }
});

test('a deleted group drops out of the rule', async () => {
  await db.query(`DELETE FROM public.guest_groups WHERE group_id = $1`, [kids]);
  const rule = (
    await db.query<{ group_ids: string[] }>(`SELECT group_ids FROM public.event_vendor_count_rules WHERE event_vendor_id = $1`, [shop.juan!.booking])
  ).rows[0]!;
  assert.deepEqual(rule.group_ids, []);
  // Except nobody now → 7 attending − the one tick.
  assert.equal((await told('juan')).brief, 6);
});
