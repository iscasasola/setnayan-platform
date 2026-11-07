/**
 * 🎟 ORDERED → RECEIVED — asserted against the DATABASE (migration 20271320900784; DECISION_LOG 2026-09-25 "TWO
 * SUPPLIER SERVICE MODES: RECEIVED ONLY or ORDERED → RECEIVED" · "READY TO CLAIM + A GUEST ANNOUNCEMENT" · "ALL
 * ANNOUNCEMENTS GO THROUGH THE ONE COORDINATOR ANNOUNCEMENT CHANNEL").
 *
 *   1 · the first scan ORDERS (#1), a second scan before Ready says "not ready" and changes nothing;
 *   2 · Ready on #1 tells THAT guest only — one targeted line in the one channel, sender 'supplier' — and the second
 *       scan then RECEIVES; a third says "already";
 *   3 · Ready is the booked shop's alone; a number already ready tells nobody twice;
 *   4 · the counts read Ordered · Ready · Received, and "Your numbers" carries no guest id;
 *   5 · nobody can write a one-guest line by hand, and a couple's event-wide line can never carry a target.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = { eventId: '', booth: '', boothCov: 0, stranger: '', couple: '', tokens: [] as string[], guestIds: [] as string[] };

type Answer = { outcome: string; number?: number | null; claimed?: number | null; total?: number | null };
async function scan(uid: string, token: string): Promise<Answer> {
  await asUser(uid);
  return (await db.query<{ a: Answer }>(`SELECT public.supplier_scan_claim($1,$2,$3,'supplier_qr') AS a`, [F.eventId, F.boothCov, token])).rows[0]!.a;
}
async function ready(uid: string, n: number): Promise<number> {
  await asUser(uid);
  return (await db.query<{ n: number }>(`SELECT public.supplier_scan_ready($1,$2,$3) AS n`, [F.eventId, F.boothCov, n])).rows[0]!.n;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.booth = await mkUser('prints@scan.test');
  F.stranger = await mkUser('stranger@scan.test');
  F.couple = await mkUser('couple@scan.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,'Lumina Studio','Manila',ARRAY['photo_booth']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
      [F.booth],
    )
  ).rows[0]!.vendor_profile_id;
  F.boothCov = Number(
    (await db.query<{ id: string }>(`INSERT INTO public.vendor_coverages (vendor_profile_id, canonical_service) VALUES ($1,'photo_booth') RETURNING id`, [vp]))
      .rows[0]!.id,
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1,'photobooth','Lumina Studio','contracted',10000,$2)`,
    [F.eventId, vp],
  );
  for (let i = 0; i < 3; i++) {
    const g = (
      await db.query<{ guest_id: string; qr_token: string }>(
        `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
         VALUES ($1,$2,'Sample','bride','friends','attending') RETURNING guest_id, qr_token`,
        [F.eventId, `Guest${i}`],
      )
    ).rows[0]!;
    F.guestIds.push(g.guest_id);
    F.tokens.push(g.qr_token);
  }
  await asUser(F.booth);
  await db.query(`INSERT INTO public.supplier_scan_settings (coverage_id, enabled, mode) VALUES ($1, TRUE, 'ordered_received')`, [F.boothCov]);
  await asOwner();
});

after(async () => {
  await replay?.db.close();
});

test('1 · the first scan orders; a second before Ready changes nothing', async () => {
  assert.deepEqual(await scan(F.booth, F.tokens[0]!), { outcome: 'ordered', number: 1 });
  assert.deepEqual(await scan(F.booth, F.tokens[1]!), { outcome: 'ordered', number: 2 });
  assert.deepEqual(await scan(F.booth, F.tokens[0]!), { outcome: 'not_ready', number: 1 });
  await asOwner();
  const k = await db.query<{ last_number: number }>(`SELECT last_number FROM public.supplier_scan_counters WHERE coverage_id = $1`, [F.boothCov]);
  assert.equal(k.rows[0]!.last_number, 2, 'a not-ready scan must not burn a number');
});

test('2 · Ready tells that one guest; the second scan receives; a third is "already"', async () => {
  assert.equal(await ready(F.booth, 1), 1);
  await asOwner();
  const lines = await db.query<{ target_guest_id: string; sender_role: string; body: string }>(
    `SELECT target_guest_id, sender_role, body FROM public.coordinator_broadcasts WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(lines.rows.length, 1);
  assert.equal(lines.rows[0]!.target_guest_id, F.guestIds[0]);
  assert.equal(lines.rows[0]!.sender_role, 'supplier');
  assert.match(lines.rows[0]!.body, /^#0001 is ready — claim it at .+ \(Lumina Studio\)\.$/);

  assert.deepEqual(await scan(F.booth, F.tokens[0]!), { outcome: 'received', number: 1, claimed: 1, total: 3 });
  const again = await scan(F.booth, F.tokens[0]!);
  assert.equal(again.outcome, 'already');
  assert.equal(again.number, 1);
});

test('3 · Ready is the booked shop’s alone, and never tells anybody twice', async () => {
  await assert.rejects(ready(F.stranger, 2), /not_your_booking/);
  assert.equal(await ready(F.booth, 1), 0, '#1 was already handed over');
  assert.equal(await ready(F.booth, 99), 0, 'no such number');
  assert.equal(await ready(F.booth, 2), 1);
  assert.equal(await ready(F.booth, 2), 0, 'Ready twice must not announce twice');
});

test('4 · counts read Ordered · Ready · Received, and "Your numbers" carries no guest id', async () => {
  await scan(F.booth, F.tokens[2]!);
  await asUser(F.booth);
  const t = (await db.query<{ t: Record<string, unknown> }>(`SELECT public.supplier_scan_tally($1,$2) AS t`, [F.eventId, F.boothCov])).rows[0]!.t;
  assert.equal(t.mode, 'ordered_received');
  assert.equal(t.ordered, 1);
  assert.equal(t.ready, 1);
  assert.equal(t.claimed, 1);
  const nums = await db.query<Record<string, unknown>>(`SELECT * FROM public.supplier_scan_numbers($1,$2)`, [F.eventId, F.boothCov]);
  assert.deepEqual(nums.rows.map((r) => r.scan_number), [3, 2, 1]);
  assert.deepEqual(Object.keys(nums.rows[0]!).sort(), ['first_at', 'guests', 'open', 'ordered', 'prints', 'ready', 'ready_at', 'received', 'received_at', 'scan_number']);
  await assert.rejects(
    (async () => {
      await asUser(F.stranger);
      await db.query(`SELECT * FROM public.supplier_scan_numbers($1,$2)`, [F.eventId, F.boothCov]);
    })(),
    /not_your_booking/,
  );
});

test('5 · a one-guest line is only ever a supplier’s, written by Ready — never by hand', async () => {
  await asUser(F.couple);
  // The couple's own event-wide line still works…
  await db.query(`INSERT INTO public.coordinator_broadcasts (event_id, body) VALUES ($1, 'Dinner is served')`, [F.eventId]);
  // …but cannot be aimed at one guest: the browser holds no INSERT grant on target_guest_id at all (the column grant
  // is event_id · body only), and the CHECK would refuse a couple's target anyway.
  await assert.rejects(
    db.query(`INSERT INTO public.coordinator_broadcasts (event_id, body, target_guest_id) VALUES ($1, 'psst', $2)`, [F.eventId, F.guestIds[1]]),
    /permission denied/,
  );
  await asOwner();
  await assert.rejects(
    db.query(
      `INSERT INTO public.coordinator_broadcasts (event_id, sender_user_id, sender_role, body, target_guest_id) VALUES ($1, $2, 'couple', 'psst', $3)`,
      [F.eventId, F.couple, F.guestIds[1]],
    ),
    /supplier_is_one_guest/,
    'even the server cannot send a couple’s line to one guest',
  );
  await asOwner();
  const wide = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.coordinator_broadcasts WHERE event_id = $1 AND target_guest_id IS NULL`,
    [F.eventId],
  );
  assert.equal(wide.rows[0]!.n, 1, 'the event-wide channel holds only the couple’s line');
});
