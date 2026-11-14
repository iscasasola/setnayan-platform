/**
 * 🏛📍 MANY VENUES PER EVENT; SUPPLIERS PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE — against the DATABASE,
 * migrations replayed, through real sessions (owner 2026-11-01; migration 20271300598766).
 *
 *   · TWO VENUES BOOK on one event (the One per event switch is off for both venue categories) — and a second
 *     coordinator is still refused, so the lock guard itself is live and this is not vacuous;
 *   · `set_supplier_where` writes a supplier's Where onto the chapters (`responsible_vendor_ids` on TOP-LEVEL blocks),
 *     and returns before/after so a booked supplier can be told;
 *   · BOOKED WITHOUT WHERE IS REFUSED (while the event has chapters) — before booking it may be empty;
 *   · COORDINATORS NEED NONE — the door refuses to set one;
 *   · a moment, or another event's chapter, is not a Where;
 *   · an IN-HOUSE group's change lands in `covered_where`;
 *   · a stranger changes nothing.
 * Every test names the mutation that turns it red.
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

const F = { couple: '', stranger: '', shopOwner: '', shop: '', eventId: '', otherEventId: '', prep: '', cer: '', rec: '', moment: '', otherChapter: '' };

async function book(category: string, name: string, status = 'contracted', eventId = F.eventId): Promise<string> {
  await asUser(F.couple);
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
     VALUES ($1, $2::public.vendor_category, $3, $4::public.vendor_status) RETURNING vendor_id`,
    [eventId, category, name, status],
  );
  return r.rows[0]!.vendor_id;
}

async function setWhere(uid: string, vendorId: string, ids: string[], group: string | null = null) {
  await asUser(uid);
  const r = await db.query<{ r: { booked: boolean; before: string[] | null; after: string[]; after_names: string[] } }>(
    `SELECT public.set_supplier_where($1, $2::uuid[], $3) AS r`,
    [vendorId, ids, group],
  );
  return r.rows[0]!.r;
}

async function chaptersOf(vendorId: string): Promise<string[]> {
  await asOwner();
  const r = await db.query<{ block_id: string }>(
    `SELECT block_id FROM public.event_schedule_blocks WHERE $1 = ANY (responsible_vendor_ids) ORDER BY start_at`,
    [vendorId],
  );
  return r.rows.map((x) => x.block_id);
}

async function chapter(label: string, start: string, eventId = F.eventId, parent: string | null = null): Promise<string> {
  await asUser(F.couple);
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, parent_block_id) VALUES ($1, $2, $3, $4) RETURNING block_id`,
    [eventId, label, start, parent],
  );
  return r.rows[0]!.block_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  const mkEvent = async (name: string) =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.couple = await mkUser('couple@where.test');
  F.stranger = await mkUser('stranger@where.test');
  F.shopOwner = await mkUser('shop@where.test');
  F.shop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1,'Sample Lights','Manila',ARRAY['lights_and_sound']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
      [F.shopOwner],
    )
  ).rows[0]!.vendor_profile_id;
  F.eventId = await mkEvent('Sample Wedding');
  F.otherEventId = await mkEvent('Another Wedding');
  for (const ev of [F.eventId, F.otherEventId]) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [ev, F.couple]);
  }
  F.prep = await chapter('Preparation', '2099-12-18T06:00:00Z');
  F.cer = await chapter('Ceremony', '2099-12-18T14:00:00Z');
  F.rec = await chapter('Reception', '2099-12-18T18:00:00Z');
  F.moment = await chapter('First dance', '2099-12-18T19:00:00Z', F.eventId, F.rec);
  F.otherChapter = await chapter('Elsewhere', '2099-12-18T18:00:00Z', F.otherEventId);
});

after(async () => {
  await replay?.db.close();
});

test('🔒 TWO VENUES ARE ALLOWED: two confirmed receptions and two confirmed churches book on one event', async () => {
  // MUTATION: drop the UPDATE that switches the venue categories off ⇒ the second insert hits hard_single_lock_uniq ⇒ red.
  await book('venue', 'Sample Hotel');
  await book('venue', 'Sample Garden');
  await book('religious_venue', 'Sample Parish');
  await book('religious_venue', 'Sample Chapel');
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors WHERE event_id = $1 AND category IN ('venue','religious_venue') AND status = 'contracted'`,
    [F.eventId],
  );
  assert.equal(r.rows[0]!.n, 4);
});

test('…and the lock guard is still live: a second confirmed coordinator is refused', async () => {
  await book('planner_coordinator', 'Sample Coordinator');
  await assert.rejects(() => book('planner_coordinator', 'Another Coordinator'), /hard_single_lock_uniq/);
});

test('a supplier’s Where is written onto the chapters, and before/after come back', async () => {
  const photo = await book('photographer', 'Sample Photo');
  const r = await setWhere(F.couple, photo, [F.rec, F.cer]);
  assert.equal(r.booked, true);
  assert.deepEqual(r.before, []);
  assert.deepEqual([...r.after].sort(), [F.cer, F.rec].sort());
  assert.deepEqual(r.after_names, ['Ceremony', 'Reception'], 'the names, in time order — the words of the notice');
  assert.deepEqual(await chaptersOf(photo), [F.cer, F.rec]);
  // Moving off one chapter removes the tag there and only there.
  const r2 = await setWhere(F.couple, photo, [F.rec]);
  assert.deepEqual([...(r2.before ?? [])].sort(), [F.cer, F.rec].sort());
  assert.deepEqual(await chaptersOf(photo), [F.rec]);
  // MUTATION: drop the array_remove UPDATE ⇒ Ceremony keeps the tag ⇒ red.
});

test('🔒 BOOKED WITHOUT WHERE IS REFUSED — and nothing is removed', async () => {
  const cake = await book('cake_maker', 'Sample Cakes');
  await setWhere(F.couple, cake, [F.rec]);
  // MUTATION: drop the keep-one check ⇒ the empty Where saves ⇒ red.
  await assert.rejects(() => setWhere(F.couple, cake, []), /a_booked_supplier_needs_a_chapter/);
  assert.deepEqual(await chaptersOf(cake), [F.rec], 'the refusal changed nothing');
});

test('before booking (on the quote) Where may be set — and emptied', async () => {
  const florist = await book('florist', 'Sample Florist', 'shortlisted');
  const r = await setWhere(F.couple, florist, [F.rec]);
  assert.equal(r.booked, false, 'not booked: a change tells nobody');
  await setWhere(F.couple, florist, []);
  assert.deepEqual(await chaptersOf(florist), []);
});

test('🔒 COORDINATORS NEED NONE — the door refuses to set one', async () => {
  await asOwner();
  const coord = (await db.query<{ vendor_id: string }>(`SELECT vendor_id FROM public.event_vendors WHERE vendor_name = 'Sample Coordinator'`)).rows[0]!
    .vendor_id;
  // MUTATION: drop the coordinator check ⇒ the tag is written ⇒ red.
  await assert.rejects(() => setWhere(F.couple, coord, [F.rec]), /coordinators_are_everywhere/);
  assert.deepEqual(await chaptersOf(coord), []);
});

test('a moment, or another event’s chapter, is not a Where', async () => {
  const band = await book('band_dj', 'Sample Band');
  await assert.rejects(() => setWhere(F.couple, band, [F.moment]), /not_a_chapter/);
  await assert.rejects(() => setWhere(F.couple, band, [F.otherChapter]), /not_a_chapter/);
  assert.deepEqual(await chaptersOf(band), []);
});

test('an IN-HOUSE group’s change lands in covered_where; the venue’s own chapters are untouched', async () => {
  await asOwner();
  const venue = (await db.query<{ vendor_id: string }>(`SELECT vendor_id FROM public.event_vendors WHERE vendor_name = 'Sample Hotel'`)).rows[0]!
    .vendor_id;
  await setWhere(F.couple, venue, [F.prep, F.rec]);
  const r = await setWhere(F.couple, venue, [F.rec], 'catering');
  assert.equal(r.before, null, 'it followed the venue until now');
  await asOwner();
  const row = (await db.query<{ covered_where: Record<string, string[]> }>(`SELECT covered_where FROM public.event_vendors WHERE vendor_id = $1`, [venue])).rows[0]!;
  assert.deepEqual(row.covered_where, { catering: [F.rec] });
  assert.deepEqual(await chaptersOf(venue), [F.prep, F.rec], 'the venue itself still hosts both');
  await assert.rejects(() => setWhere(F.couple, venue, [], 'catering'), /a_booked_supplier_needs_a_chapter/);
  await assert.rejects(() => setWhere(F.couple, venue, [F.rec], 'Bad Key!'), /not_covered/);
});

async function notices(): Promise<Array<{ title: string; body: string; related_url: string }>> {
  await asOwner();
  const r = await db.query<{ title: string; body: string; related_url: string }>(
    `SELECT title, body, related_url FROM public.notifications WHERE user_id = $1 AND type = 'supplier_where_changed' ORDER BY created_at, notification_id`,
    [F.shopOwner],
  );
  return r.rows;
}

test('🔒 A WHERE CHANGE NOTIFIES — a booked shop is told in the app; on the quote, or with no change, nobody is', async () => {
  await asUser(F.couple);
  const lights = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
       VALUES ($1,'lights_and_sound','Sample Lights','shortlisted',$2) RETURNING vendor_id`,
      [F.eventId, F.shop],
    )
  ).rows[0]!.vendor_id;
  // On the quote: set, nobody told.
  const q = await setWhere(F.couple, lights, [F.rec]);
  assert.equal((q as { told?: boolean }).told, false);
  assert.equal((await notices()).length, 0, 'before booking there is nobody to tell');
  await asOwner();
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [lights]);
  // Booked, the same set again: no change, no notice.
  await setWhere(F.couple, lights, [F.rec]);
  assert.equal((await notices()).length, 0, 'saving the same chapters is not a change');
  // Booked, a change: ONE notice, naming the chapters, saying the price does not move by itself.
  // MUTATION: drop the INSERT INTO notifications ⇒ zero rows ⇒ red.
  const r = await setWhere(F.couple, lights, [F.cer, F.rec]);
  assert.equal((r as { told?: boolean }).told, true);
  const n = await notices();
  assert.equal(n.length, 1);
  assert.match(n[0]!.title, /Sample Wedding changed where you go/);
  assert.match(n[0]!.body, /Ceremony, Reception/);
  assert.match(n[0]!.body, /price doesn’t change by itself/);
  assert.equal(n[0]!.related_url, `/vendor-dashboard/clients/${F.eventId}`);
});

test('a stranger changes nothing', async () => {
  await asOwner();
  const photo = (await db.query<{ vendor_id: string }>(`SELECT vendor_id FROM public.event_vendors WHERE vendor_name = 'Sample Photo'`)).rows[0]!.vendor_id;
  await assert.rejects(() => setWhere(F.stranger, photo, [F.cer]), /supplier_not_found|not_saved/);
  assert.deepEqual(await chaptersOf(photo), [F.rec]);
});
