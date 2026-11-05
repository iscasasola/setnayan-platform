/**
 * 🎟 A SUPPLIER'S SCAN CLAIMS A GUEST'S SERVICE ONCE — asserted against the DATABASE (migration 20271309463657;
 * DECISION_LOG 2026-09-25 "SUPPLIERS CLAIM A GUEST'S SERVICE BY SCANNING…", "SUPPLIER SCAN SHOWS A COUNT ONLY",
 * "EVERY SUPPLIER SCAN GETS A SHARED SEQUENCE NUMBER"; 2026-10-03 "SUPPLIER SCAN … APPROVED").
 *
 *   1 · the booked shop, scanner ON, scans a guest of THIS event → #1, "claimed 1 of T"; a second guest → #2;
 *   2 · the same guest again → "already", the SAME number, nothing new written, the number does not move;
 *   3 · a code that is not a guest of this event (another event's guest, a stranger's token) → 'not_guest', nothing written;
 *   4 · refused: a shop not booked, a stranger, a scanner switched OFF, a service the booking did not name;
 *   5 · a SOUVENIR service writes the couple's own souvenir record (one record, two desks), and a guest the couple's
 *       desk already handed a souvenir is "already" at the supplier;
 *   6 · the claim answer itself names nobody, and the supplier cannot read the claim rows;
 *   8 · the FIRST name (owner 2026-11-05 "name is fine"): only to the booked shop, only after its claim is recorded,
 *       never the last name; a stranger, an unclaimed guest and another shop's service get NULL; anon cannot call it;
 *   7 · the couple reads the claims (their desk shows names); the shop's own setting is the shop's alone.
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

const F = {
  eventId: '',
  otherEventId: '',
  booth: '',
  boothVp: '',
  boothCov: 0,
  boothCov2: 0,
  souvenir: '',
  souvenirCov: 0,
  unbooked: '',
  unbookedCov: 0,
  couple: '',
  stranger: '',
  tokens: [] as string[],
  guestIds: [] as string[],
  otherToken: '',
};

type Answer = { outcome: string; number?: number | null; claimed?: number | null; total?: number | null };

async function scan(uid: string, cov: number, token: string, method = 'supplier_qr'): Promise<Answer> {
  await asUser(uid);
  const r = await db.query<{ a: Answer }>(`SELECT public.supplier_scan_claim($1, $2, $3, $4) AS a`, [
    F.eventId,
    cov,
    token,
    method,
  ]);
  return r.rows[0]!.a;
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
  F.booth = await mkUser('booth@scan.test');
  F.souvenir = await mkUser('souvenir@scan.test');
  F.unbooked = await mkUser('unbooked@scan.test');
  F.couple = await mkUser('couple@scan.test');
  F.stranger = await mkUser('stranger@scan.test');

  const mkEvent = async (name: string) =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.eventId = await mkEvent('Sample Wedding');
  F.otherEventId = await mkEvent('Another Wedding');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);

  const profile = async (uid: string, name: string, cat: string): Promise<string> =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY[$3]::text[],'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, name, cat],
      )
    ).rows[0]!.vendor_profile_id;
  const coverage = async (vp: string, canonical: string): Promise<number> =>
    Number(
      (
        await db.query<{ id: string }>(
          `INSERT INTO public.vendor_coverages (vendor_profile_id, canonical_service) VALUES ($1,$2) RETURNING id`,
          [vp, canonical],
        )
      ).rows[0]!.id,
    );
  F.boothVp = await profile(F.booth, 'Sample Booth', 'photo_booth');
  F.boothCov = await coverage(F.boothVp, 'photo_booth');
  F.boothCov2 = await coverage(F.boothVp, 'mirror_booth');
  const souvenirVp = await profile(F.souvenir, 'Sample Souvenirs', 'souvenirs_giveaways');
  F.souvenirCov = await coverage(souvenirVp, 'souvenirs_giveaways');
  const unbookedVp = await profile(F.unbooked, 'Sample Unbooked', 'photo_booth');
  F.unbookedCov = await coverage(unbookedVp, 'photo_booth');

  // The booth's booking names ONE service card, filed under photo_booth — mirror_booth was not booked.
  const card = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, is_active, primary_photo_r2_key, coverage_id)
       VALUES ($1,'photo_booth',10000,FALSE,'samples/booth.jpg',$2) RETURNING vendor_service_id`,
      [F.boothVp, F.boothCov],
    )
  ).rows[0]!.vendor_service_id;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, requested_service_ids)
     VALUES ($1,'photobooth','Sample Booth','contracted',10000,$2,ARRAY[$3]::uuid[])`,
    [F.eventId, F.boothVp, card],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1,'gifts_and_giveaways','Sample Souvenirs','deposit_paid',5000,$2)`,
    [F.eventId, souvenirVp],
  );
  // The unbooked shop is only being considered.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1,'photobooth','Sample Unbooked','considering',10000,$2)`,
    [F.eventId, unbookedVp],
  );

  for (let i = 0; i < 4; i++) {
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
  F.otherToken = (
    await db.query<{ qr_token: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1,'Elsewhere','Sample','bride','friends') RETURNING qr_token`,
      [F.otherEventId],
    )
  ).rows[0]!.qr_token;

  // Each shop switches its scanner on — as the shop, through its own RLS.
  for (const [uid, cov] of [
    [F.booth, F.boothCov],
    [F.booth, F.boothCov2],
    [F.souvenir, F.souvenirCov],
    [F.unbooked, F.unbookedCov],
  ] as const) {
    await asUser(uid);
    await db.query(`INSERT INTO public.supplier_scan_settings (coverage_id, enabled, mode) VALUES ($1, TRUE, 'once')`, [cov]);
  }
  await asOwner();
});

after(async () => {
  await replay?.db.close();
});

test('1 · the booked shop claims a guest of this event — #1, then #2, counted against the attending', async () => {
  const a = await scan(F.booth, F.boothCov, F.tokens[0]!);
  assert.deepEqual(a, { outcome: 'claimed', number: 1, claimed: 1, total: 4 });
  const b = await scan(F.booth, F.boothCov, F.tokens[1]!, 'supplier_nfc');
  assert.deepEqual(b, { outcome: 'claimed', number: 2, claimed: 2, total: 4 });
});

test('2 · the same guest again is "already", with the same number — nothing written, the number does not move', async () => {
  const a = await scan(F.booth, F.boothCov, F.tokens[0]!.toUpperCase());
  assert.equal(a.outcome, 'already');
  assert.equal(a.number, 1);
  await asOwner();
  const rows = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.supplier_scan_claims WHERE coverage_id = $1`, [F.boothCov]);
  assert.equal(rows.rows[0]!.n, 2);
  const next = await scan(F.booth, F.boothCov, F.tokens[2]!);
  assert.equal(next.number, 3, 'a refused repeat must not burn a number');
});

test('3 · a code that is not a guest of this event writes nothing', async () => {
  assert.deepEqual(await scan(F.booth, F.boothCov, F.otherToken), { outcome: 'not_guest' });
  assert.deepEqual(await scan(F.booth, F.boothCov, 'f'.repeat(32)), { outcome: 'not_guest' });
  await asOwner();
  const k = await db.query<{ last_number: number }>(
    `SELECT last_number FROM public.supplier_scan_counters WHERE event_id = $1 AND coverage_id = $2`,
    [F.eventId, F.boothCov],
  );
  assert.equal(k.rows[0]!.last_number, 3);
});

test('4 · refused: not booked, a stranger, a scanner switched off, a service the booking did not name', async () => {
  await assert.rejects(scan(F.unbooked, F.unbookedCov, F.tokens[3]!), /not_your_booking/);
  await assert.rejects(scan(F.stranger, F.boothCov, F.tokens[3]!), /not_your_booking/);
  await assert.rejects(scan(F.booth, F.boothCov2, F.tokens[3]!), /not_your_booking/, 'mirror_booth was not on the booking');
  await assert.rejects(scan(F.booth, F.unbookedCov, F.tokens[3]!), /not_your_booking/, 'another shop’s service');
  await asUser(F.booth);
  await db.query(`UPDATE public.supplier_scan_settings SET enabled = FALSE WHERE coverage_id = $1`, [F.boothCov]);
  await assert.rejects(scan(F.booth, F.boothCov, F.tokens[3]!), /scanner_off/);
  await asUser(F.booth);
  await db.query(`UPDATE public.supplier_scan_settings SET enabled = TRUE WHERE coverage_id = $1`, [F.boothCov]);
  await assert.rejects(scan(F.booth, F.boothCov, F.tokens[3]!, 'manual'), /bad_method/);
});

test('5 · a souvenir service writes the couple’s own souvenir record — one record, two desks', async () => {
  // The couple's desk hands guest 2 a souvenir first.
  await asUser(F.couple);
  await db.query(`INSERT INTO public.guest_souvenir_claims (event_id, guest_id, method) VALUES ($1,$2,'qr_scan')`, [
    F.eventId,
    F.guestIds[2],
  ]);
  const first = await scan(F.souvenir, F.souvenirCov, F.tokens[0]!);
  assert.deepEqual(first, { outcome: 'claimed', number: 1, claimed: 2, total: 4 }, 'the pile is one: the couple’s desk counted');
  const already = await scan(F.souvenir, F.souvenirCov, F.tokens[2]!);
  assert.equal(already.outcome, 'already', 'the couple’s desk already gave it');
  assert.equal(already.number, null);
  await asUser(F.couple);
  const desk = await db.query<{ guest_id: string; method: string; scan_number: number | null }>(
    `SELECT guest_id, method, scan_number FROM public.guest_souvenir_claims WHERE event_id = $1 ORDER BY claimed_at`,
    [F.eventId],
  );
  assert.equal(desk.rows.length, 2);
  assert.ok(desk.rows.some((r) => r.guest_id === F.guestIds[0] && r.method === 'supplier_qr' && r.scan_number === 1));
  await asOwner();
  const other = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.supplier_scan_claims WHERE coverage_id = $1`, [F.souvenirCov]);
  assert.equal(other.rows[0]!.n, 0, 'a souvenir must not be written twice');
});

test('6 · the claim answer names nobody, and the supplier cannot read the claim rows', async () => {
  const a = await scan(F.booth, F.boothCov, F.tokens[1]!);
  assert.deepEqual(Object.keys(a).sort(), ['claimed', 'number', 'outcome', 'total']);
  await asUser(F.booth);
  const tally = (await db.query<{ t: Record<string, unknown> }>(`SELECT public.supplier_scan_tally($1,$2) AS t`, [F.eventId, F.boothCov]))
    .rows[0]!.t;
  assert.deepEqual(tally, { enabled: true, mode: 'once', souvenir: false, claimed: 3, ordered: 0, ready: 0, total: 4, last_number: 3 });
  const rows = await db.query(`SELECT * FROM public.supplier_scan_claims`);
  assert.equal(rows.rows.length, 0, 'a supplier read the claim rows directly');
  const services = await db.query<{ coverage_id: string }>(`SELECT coverage_id FROM public.supplier_scan_services($1)`, [F.eventId]);
  assert.deepEqual(services.rows.map((r) => Number(r.coverage_id)), [F.boothCov], 'only the booked service, scanner on');
});

test('7 · the couple reads the claims; a shop cannot touch another shop’s setting', async () => {
  await asUser(F.couple);
  const rows = await db.query<{ scan_number: number }>(
    `SELECT scan_number FROM public.supplier_scan_claims WHERE event_id = $1 ORDER BY scan_number`,
    [F.eventId],
  );
  assert.deepEqual(rows.rows.map((r) => r.scan_number), [1, 2, 3]);
  await asUser(F.unbooked);
  const u = await db.query(`UPDATE public.supplier_scan_settings SET enabled = FALSE WHERE coverage_id = $1 RETURNING 1`, [F.boothCov]);
  assert.equal(u.rows.length, 0);
  await assert.rejects(
    db.query(`INSERT INTO public.supplier_scan_settings (coverage_id, enabled) VALUES ($1, TRUE)`, [F.boothCov2]),
    /row-level security|duplicate key/,
  );
  await assert.rejects(
    db.query(`INSERT INTO public.supplier_scan_settings (coverage_id, enabled, mode) VALUES ($1, TRUE, 'unlimited')`, [F.unbookedCov]),
    /check constraint|duplicate key/,
  );
});

test('8 · the first name: only the booked shop, only after its claim is recorded, never the last name', async () => {
  const first = async (uid: string, cov: number, token: string) => {
    await asUser(uid);
    return (await db.query<{ n: string | null }>(`SELECT public.supplier_scan_first_name($1,$2,$3) AS n`, [F.eventId, cov, token]))
      .rows[0]!.n;
  };
  assert.equal(await first(F.booth, F.boothCov, F.tokens[0]!), 'Guest0', 'claimed at the booth → the first name');
  assert.equal(await first(F.booth, F.boothCov, F.tokens[0]!.toUpperCase()), 'Guest0', 'the token reads case-blind');
  assert.equal(await first(F.booth, F.boothCov, F.tokens[3]!), null, 'never claimed at this service → nothing');
  assert.equal(await first(F.stranger, F.boothCov, F.tokens[0]!), null, 'not the shop → nothing');
  assert.equal(await first(F.unbooked, F.unbookedCov, F.tokens[0]!), null, 'a shop not booked → nothing');
  assert.equal(await first(F.booth, F.boothCov, F.otherToken), null, 'another event’s guest → nothing');
  assert.equal(await first(F.souvenir, F.souvenirCov, F.tokens[0]!), 'Guest0', 'a souvenir the shop’s scanner handed out');
  assert.equal(await first(F.souvenir, F.souvenirCov, F.tokens[2]!), null, 'a souvenir the couple’s desk gave is not the shop’s claim');
  await asOwner();
  const grants = await db.query<{ anon: boolean }>(
    `SELECT has_function_privilege('anon', 'public.supplier_scan_first_name(uuid, bigint, text)', 'EXECUTE') AS anon`,
  );
  assert.equal(grants.rows[0]!.anon, false, 'anon must not look a guest up');
});
