/**
 * Hub tools, second five — END-TO-END DB verification of 20271360665147_hub_tool_entries_and_dietary_list.
 *
 *   vendor_hub_tool_entries (Tech rider · Personalisation list · Quantity vs guests rows):
 *     • anon holds nothing (the REVOKE is load-bearing on this project);
 *     • the booked supplier writes their OWN rows on their event;
 *     • another booked supplier, the couple and a stranger read none of them and cannot forge one;
 *     • an UPDATE cannot re-point a row at another event, supplier or tool (column grants);
 *     • an unbooked supplier cannot write.
 *   vendor_event_dietary_list (Dietary & allergies):
 *     • the caterer gets the coming guests' meal + dietary note — and nobody who is not coming, and no "No preference";
 *     • a supplier booked for anything but food gets allowed=false (DECISION_LOG 2026-10-28: "the booked caterer only");
 *     • a supplier not booked here is refused.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function createUser(email: string) {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function createVendor(userId: string, name: string, services: string[]) {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, $2, 'Manila', $3::text[], 'verified', NOW(), 'verified')
     RETURNING vendor_profile_id`,
    [userId, name, services],
  );
  return r.rows[0]!.vendor_profile_id;
}
async function bookVendor(eventId: string, vendorProfileId: string, category: string) {
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, $2, 'Booked', 'contracted', 100000, $3)`,
    [eventId, category, vendorProfileId],
  );
}
async function guest(eventId: string, first: string, rsvp: string, meal: string | null, dietary: string | null) {
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, rsvp_status, meal_preference, dietary_restrictions)
     VALUES ($1, $2, 'Test', 'both', 'other', 'guest', $3, $4::public.meal_preference, $5)`,
    [eventId, first, rsvp, meal, dietary],
  );
}

const F = { eventId: '', otherEventId: '', couple: '', bandUser: '', band: '', caterUser: '', cater: '', outsider: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  F.couple = await createUser('couple@hub-tools.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Hub Tools Test', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.couple]);
  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Someone Else', 'birthday') RETURNING event_id`,
  );
  F.otherEventId = other.rows[0]!.event_id;

  F.bandUser = await createUser('band@hub-tools.test');
  F.band = await createVendor(F.bandUser, 'Band Co', ['live_band']);
  await bookVendor(F.eventId, F.band, 'band_dj');
  F.caterUser = await createUser('cater@hub-tools.test');
  F.cater = await createVendor(F.caterUser, 'Cater Co', ['catering']);
  await bookVendor(F.eventId, F.cater, 'catering');
  F.outsider = await createUser('outsider@hub-tools.test');

  await guest(F.eventId, 'Ana', 'attending', 'fish', 'Shellfish allergy');
  await guest(F.eventId, 'Ben', 'attending', 'no_preference', null);
  await guest(F.eventId, 'Cara', 'attending', 'vegan', null);
  await guest(F.eventId, 'Dan', 'declined', 'beef', 'No nuts');
  await guest(F.eventId, 'Eve', 'pending', null, 'Halal');
});

after(async () => {
  await db?.close?.();
});

async function insertRow(uid: string, eventId: string, vendorProfileId: string, label: string, toolKey = 'tech_rider') {
  await asUser(uid);
  try {
    const r = await db.query<{ entry_id: string }>(
      `INSERT INTO public.vendor_hub_tool_entries (event_id, vendor_profile_id, tool_key, label, position)
       VALUES ($1, $2, $3, $4, 100) RETURNING entry_id`,
      [eventId, vendorProfileId, toolKey, label],
    );
    return { ok: true as const, id: r.rows[0]!.entry_id };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  } finally {
    await asOwner();
  }
}

test('anon holds nothing on the table', async () => {
  const r = await db.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'vendor_hub_tool_entries' AND grantee = 'anon'`,
  );
  assert.equal(r.rows.length, 0);
  const rls = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'vendor_hub_tool_entries'`);
  assert.equal(rls.rows[0]!.relrowsecurity, true);
});

test('the booked supplier writes, ticks and counts their own rows', async () => {
  const a = await insertRow(F.bandUser, F.eventId, F.band, '2× wireless mic');
  assert.ok(a.ok, a.ok ? '' : a.error);
  await asUser(F.bandUser);
  const t = await db.query(`UPDATE public.vendor_hub_tool_entries SET done_at = NOW() WHERE entry_id = $1 RETURNING entry_id`, [a.id]);
  assert.equal(t.rows.length, 1);
  const q = await db.query(
    `INSERT INTO public.vendor_hub_tool_entries (event_id, vendor_profile_id, tool_key, label, qty) VALUES ($1, $2, 'quantity_vs_guests', 'Giveaways', 5) RETURNING qty`,
    [F.eventId, F.band],
  );
  assert.equal((q.rows[0] as { qty: number }).qty, 5);
  const mine = await db.query(`SELECT label FROM public.vendor_hub_tool_entries WHERE event_id = $1`, [F.eventId]);
  assert.equal(mine.rows.length, 2);
  await asOwner();
});

test('another booked supplier and a stranger see none of it, and nobody forges a row', async () => {
  for (const uid of [F.caterUser, F.outsider]) {
    await asUser(uid);
    const r = await db.query(`SELECT * FROM public.vendor_hub_tool_entries WHERE vendor_profile_id = $1`, [F.band]);
    assert.equal(r.rows.length, 0, `${uid} read the band's rows`);
    await asOwner();
  }
  const forged = await insertRow(F.caterUser, F.eventId, F.band, 'forged');
  assert.equal(forged.ok, false, 'the caterer wrote a row in the band’s name');
  const stranger = await insertRow(F.outsider, F.eventId, F.band, 'stranger');
  assert.equal(stranger.ok, false);
});

// ── 👀 THE COUPLE SEES THE CHECKLIST TICKS (owner 23 Nov 2026; migration 20271361284618) ────────────────────────────

test('👀 the couple reads the CHECKLIST ticks (Tech rider) and nothing else — never the count', async () => {
  await asUser(F.couple);
  const r = await db.query<{ tool_key: string; label: string; done: boolean }>(
    `SELECT tool_key, label, done_at IS NOT NULL AS done FROM public.vendor_hub_tool_entries WHERE vendor_profile_id = $1 ORDER BY label`,
    [F.band],
  );
  await asOwner();
  assert.deepEqual(
    r.rows.map((x) => [x.tool_key, x.label, x.done]),
    [['tech_rider', '2× wireless mic', true]],
    'the couple sees the ticked checklist row, and not the Quantity vs guests count',
  );
});

test('👀 a GUEST of the same event reads none of it (the couple-only helper, never current_event_ids)', async () => {
  const guestUser = await createUser('guest-member@hub-tools.test');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [F.eventId, guestUser]);
  await asUser(guestUser);
  const r = await db.query(`SELECT * FROM public.vendor_hub_tool_entries WHERE event_id = $1`, [F.eventId]);
  await asOwner();
  assert.equal(r.rows.length, 0, 'a guest read a supplier’s checklist');
});

test('👀 the couple only reads: no insert, no tick, no delete', async () => {
  const forged = await insertRow(F.couple, F.eventId, F.band, 'couple wrote this');
  assert.equal(forged.ok, false, 'the couple wrote a row in the supplier’s name');
  await asUser(F.couple);
  const t = await db.query(`UPDATE public.vendor_hub_tool_entries SET done_at = NULL WHERE vendor_profile_id = $1 RETURNING entry_id`, [F.band]);
  const d = await db.query(`DELETE FROM public.vendor_hub_tool_entries WHERE vendor_profile_id = $1 RETURNING entry_id`, [F.band]);
  await asOwner();
  assert.equal(t.rows.length, 0, 'the couple un-ticked the supplier’s row');
  assert.equal(d.rows.length, 0, 'the couple deleted the supplier’s row');
});

test('👀 the library decides: a checklist starts shared, other templates do not, and turning the flag off hides it', async () => {
  const flags = await db.query<{ template: string; shared: boolean }>(
    `SELECT template, bool_and(couple_sees) AS shared FROM public.hub_tools GROUP BY template ORDER BY template`,
  );
  for (const row of flags.rows) assert.equal(row.shared, row.template === 'checklist', `template ${row.template}`);
  await db.query(`UPDATE public.hub_tools SET couple_sees = FALSE WHERE tool_key = 'tech_rider'`);
  await asUser(F.couple);
  const hidden = await db.query(`SELECT * FROM public.vendor_hub_tool_entries WHERE vendor_profile_id = $1`, [F.band]);
  await asOwner();
  await db.query(`UPDATE public.hub_tools SET couple_sees = TRUE WHERE tool_key = 'tech_rider'`);
  assert.equal(hidden.rows.length, 0, 'the flag off still showed the couple the rows');
});

test('an unbooked supplier cannot write to an event they are not on', async () => {
  const r = await insertRow(F.bandUser, F.otherEventId, F.band, 'not my event');
  assert.equal(r.ok, false);
});

test('an UPDATE cannot re-point a row at another event, supplier or tool', async () => {
  const a = await insertRow(F.bandUser, F.eventId, F.band, 'Power 220V');
  assert.ok(a.ok);
  await asUser(F.bandUser);
  for (const sql of [
    `UPDATE public.vendor_hub_tool_entries SET event_id = '${F.otherEventId}' WHERE entry_id = $1`,
    `UPDATE public.vendor_hub_tool_entries SET vendor_profile_id = '${F.cater}' WHERE entry_id = $1`,
    `UPDATE public.vendor_hub_tool_entries SET tool_key = 'set_list' WHERE entry_id = $1`,
  ]) {
    await assert.rejects(db.query(sql, [a.ok ? a.id : '']), /permission denied/);
  }
  await asOwner();
});

test('the table refuses a blank label, a key the library does not hold and a negative count', async () => {
  await asUser(F.bandUser);
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_hub_tool_entries (event_id, vendor_profile_id, tool_key, label) VALUES ($1, $2, 'tech_rider', '  ')`, [F.eventId, F.band]),
  );
  // tool_key is an FK to hub_tools (controller 23 Nov 2026: ONE home): a malformed key AND a well-shaped key the
  // library never seeded are both refused by the FK (23503) — the second is the case a shape CHECK alone let through.
  for (const key of ['Tech Rider!', 'no_such_tool']) {
    await assert.rejects(
      db.query(`INSERT INTO public.vendor_hub_tool_entries (event_id, vendor_profile_id, tool_key, label) VALUES ($1, $2, $3, 'x')`, [F.eventId, F.band, key]),
      (e: { code?: string }) => e.code === '23503',
      `${key}: refused by the hub_tools FK`,
    );
  }
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_hub_tool_entries (event_id, vendor_profile_id, tool_key, label, qty) VALUES ($1, $2, 'quantity_vs_guests', 'x', -1)`, [F.eventId, F.band]),
  );
  await asOwner();
});

type Dietary = { allowed: boolean; guests: { name: string; meal: string | null; dietary: string | null; table: string | null }[] };

test('Dietary & allergies: the caterer reads the coming guests’ own answers — and nobody else’s', async () => {
  await asUser(F.caterUser);
  const r = await db.query<{ d: Dietary }>(`SELECT public.vendor_event_dietary_list($1) AS d`, [F.eventId]);
  await asOwner();
  const d = r.rows[0]!.d;
  assert.equal(d.allowed, true);
  const names = d.guests.map((g) => g.name).sort();
  assert.deepEqual(names, ['Ana Test', 'Cara Test'], 'declined, pending and "No preference" guests must not be listed');
  const ana = d.guests.find((g) => g.name === 'Ana Test')!;
  assert.equal(ana.dietary, 'Shellfish allergy');
  assert.equal(ana.meal, 'fish');
  assert.equal(ana.table, null, 'no table until guests may see seats');
});

test('Dietary & allergies: a supplier booked for anything but food is told no, never handed names', async () => {
  await asUser(F.bandUser);
  const r = await db.query<{ d: Dietary }>(`SELECT public.vendor_event_dietary_list($1) AS d`, [F.eventId]);
  await asOwner();
  assert.deepEqual(r.rows[0]!.d, { allowed: false, guests: [] });
});

test('Dietary & allergies: a supplier not booked here, and anon, are refused', async () => {
  await asUser(F.caterUser);
  await assert.rejects(db.query(`SELECT public.vendor_event_dietary_list($1)`, [F.otherEventId]), /not_booked/);
  await asOwner();
  await asUser(F.outsider);
  await assert.rejects(db.query(`SELECT public.vendor_event_dietary_list($1)`, [F.eventId]), /not_a_vendor/);
  await asOwner();
  const g = await db.query(
    `SELECT has_function_privilege('anon', 'public.vendor_event_dietary_list(uuid)', 'EXECUTE') AS anon_can`,
  );
  assert.equal((g.rows[0] as { anon_can: boolean }).anon_can, false);
});

async function teamMember(vendorProfileId: string, email: string, duty: string, deactivated = false) {
  const uid = await createUser(email);
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, duty) VALUES ($1, $2, 'viewer', $3)`,
    [vendorProfileId, uid, duty],
  );
  if (deactivated) {
    await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NOW() WHERE user_id = $1`, [uid]);
  }
  return uid;
}

test('🔒 Dietary & allergies are health data: Event Crew reads them; Marketing, Helper and a removed seat are refused', async () => {
  await asOwner();
  const crew = await teamMember(F.cater, 'crew@hub-tools.test', 'event_crew');
  const marketing = await teamMember(F.cater, 'marketing@hub-tools.test', 'marketing');
  const helper = await teamMember(F.cater, 'helper@hub-tools.test', 'helper');
  const gone = await teamMember(F.cater, 'gone@hub-tools.test', 'event_crew', true);

  await asUser(crew);
  const r = await db.query<{ d: Dietary }>(`SELECT public.vendor_event_dietary_list($1) AS d`, [F.eventId]);
  await asOwner();
  assert.equal(r.rows[0]!.d.allowed, true, 'Event Crew runs the day and must read the allergies');
  assert.deepEqual(r.rows[0]!.d.guests.map((g) => g.name).sort(), ['Ana Test', 'Cara Test']);

  for (const [who, uid] of [['Marketing', marketing], ['Helper', helper], ['a removed Event Crew seat', gone]] as const) {
    await asUser(uid);
    await assert.rejects(db.query(`SELECT public.vendor_event_dietary_list($1)`, [F.eventId]), /not_a_vendor/, `${who} read guests' allergies`);
    await asOwner();
  }
});
