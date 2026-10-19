/**
 * a-supplier-suggests-only-to-its-own-parts.db.test.ts — 🤝🖼 SUPPLIER PHOTO SUGGESTIONS, against the real replayed
 * schema (owner 2026-10-19, DECISION_LOG "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE INCLUDED" +
 * "FIVE CONTROLLER RECOMMENDATIONS APPROVED" item 4 = option (b); migration 20271279311294).
 *
 *   1 · THE MAP IS ONE MAP. `inspiration_suggestion_services(slot)` is asked about EVERY slot and compared with
 *       `canonicalServicesForSlot` for every couple part (`libraryPhotoParts`) — and EMPTY for every other slot. Where
 *       the two differ the database wins at runtime and the screen has already offered the button.
 *   2 · ONLY ITS OWN PARTS, ONLY WHEN BOOKED. A florist opens a suggestion on Bridal bouquet, is answered
 *       `wrong_trade` on Stage, and a shop NOT booked on the event is refused outright (`not_booked`). Three may wait
 *       per part per shop; the fourth is `full`.
 *   3 · THE SCREEN IS THE ONLY WAY TO THE COUPLE. The supplier's own session cannot write the row (no INSERT/UPDATE
 *       grant): it cannot attach a photo or move its row to 'waiting'. A 'waiting' row without a photo is refused by
 *       the table itself.
 *   4 · KEEP NEVER REPLACES SILENTLY. Keep on a part with a free place takes it, credited (`from_suggestion_id`); on
 *       a part holding three, Keep without a position changes NOTHING (`full`) — the same three photos, the
 *       suggestion still waiting; with a position it replaces that one, and Undo brings it back.
 *   5 · WHO MAY DECIDE. A guest of the event and another supplier cannot Keep; another supplier cannot read the rows.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { MOODBOARD_SLOT_KEYS } from '../../lib/moodboard-slots';
import { canonicalServicesForSlot } from '../../lib/moodboard-gallery';
import { libraryPhotoParts } from '../../lib/inspiration-slots';

let replay: ReplayResult;
let db: PGlite;

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[]): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  await asUser(uid);
  try {
    const r = await db.query<{ out: T }>(sql, params);
    return { ok: true, value: r.rows[0]?.out as T };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  } finally {
    await reset();
  }
}

const W = { couple: '', guest: '', florist: '', stylist: '', stranger: '', eventId: '', floristBooking: '' };

async function shop(email: string, name: string, services: string[], book: boolean): Promise<{ owner: string; booking: string | null }> {
  const owner = await newUser(email);
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', $3::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [owner, name, services],
  );
  if (!book) return { owner, booking: null };
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id)
     VALUES ($1, $2, 'florist'::public.vendor_category, 'contracted', $3) RETURNING vendor_id`,
    [W.eventId, name, vp.rows[0]!.vendor_profile_id],
  );
  return { owner, booking: ev.rows[0]!.vendor_id };
}

const HEX6 = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F', '#FFFFFF'];
/** What the server does after the content screen passed the photo (service role — here, the owner past RLS). */
async function screened(id: string, url = 'https://media.example/lab.jpg'): Promise<void> {
  await reset();
  await db.query(
    `UPDATE public.event_inspiration_suggestions SET state='waiting', image_url=$2, screened_at=NOW(),
       sampled_hex_1=$3, sampled_hex_2=$4, sampled_hex_3=$5, sampled_hex_4=$6, sampled_hex_5=$7, sampled_hex_6=$8
     WHERE suggestion_id=$1 AND state='screening'`,
    [id, url, ...HEX6],
  );
}
async function begin(uid: string, slot: string) {
  return as<{ status: string; suggestion_id?: string }>(uid, `SELECT public.vendor_begin_inspiration_suggestion($1, $2) AS out`, [W.eventId, slot]);
}
async function boardRows(slot: string) {
  await reset();
  const r = await db.query<{ inspiration_id: string; slot_position: number; source_kind: string; from_suggestion_id: string | null }>(
    `SELECT inspiration_id, slot_position, source_kind, from_suggestion_id FROM public.event_inspiration_assets
      WHERE event_id=$1 AND slot_key=$2 AND removed_at IS NULL ORDER BY slot_position`,
    [W.eventId, slot],
  );
  return r.rows;
}
async function stateOf(id: string): Promise<string> {
  await reset();
  return (await db.query<{ state: string }>(`SELECT state FROM public.event_inspiration_suggestions WHERE suggestion_id=$1`, [id])).rows[0]!.state;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  W.couple = await newUser('sugg-couple@audit.test');
  W.guest = await newUser('sugg-guest@audit.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Suggestions Test', 'birthday') RETURNING event_id`,
  );
  W.eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [W.eventId, W.couple]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`, [W.eventId, W.guest]);
  const f = await shop('sugg-florist@audit.test', 'Bloom & Co.', ['florals'], true);
  W.florist = f.owner;
  W.floristBooking = f.booking!;
  W.stylist = (await shop('sugg-stylist@audit.test', 'Hacienda Décor', ['stylist_decorator'], true)).owner;
  W.stranger = (await shop('sugg-stranger@audit.test', 'Not Booked Florals', ['florals'], false)).owner;
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('1 · the SQL map is the TS map — every couple part, and empty for every other slot', async () => {
  const parts = new Set(libraryPhotoParts().map((p) => p.key));
  assert.ok(parts.size >= 19, `only ${parts.size} couple parts were read — the list is broken, not the guard`);
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const r = await db.query<{ s: string[] }>(`SELECT public.inspiration_suggestion_services($1) AS s`, [slot]);
    const sql = [...(r.rows[0]!.s ?? [])].sort();
    const ts = parts.has(slot) ? [...canonicalServicesForSlot(slot)].sort() : [];
    assert.deepEqual(sql, ts, `inspiration_suggestion_services('${slot}') disagrees with canonicalServicesForSlot — re-list it in a NEW migration from the TS map`);
    if (parts.has(slot)) assert.ok(ts.length > 0, `${slot} is a couple part with no supplying trade`);
  }
});

test('2 · a florist suggests to Bridal bouquet, is refused Stage; a shop not booked is refused outright; three may wait', async () => {
  const ok = await begin(W.florist, 'bridal_bouquet');
  assert.ok(ok.ok && ok.value.status === 'ok' && ok.value.suggestion_id, JSON.stringify(ok));

  /* 🧪 SABOTAGE TARGET: a florist cannot suggest to Stage. */
  const stage = await begin(W.florist, 'stage');
  assert.ok(stage.ok && stage.value.status === 'wrong_trade', `a florist was let onto Stage: ${JSON.stringify(stage)}`);
  /* …and the stylist can (the map's other side). */
  const styl = await begin(W.stylist, 'stage');
  assert.ok(styl.ok && styl.value.status === 'ok', JSON.stringify(styl));
  /* A slot that is not a couple part answers nothing to anyone. */
  const flowers = await begin(W.florist, 'flowers');
  assert.ok(flowers.ok && flowers.value.status === 'wrong_trade', JSON.stringify(flowers));

  /* 🧪 SABOTAGE TARGET: a supplier NOT booked on the event cannot suggest at all. */
  const stranger = await begin(W.stranger, 'bridal_bouquet');
  assert.ok(!stranger.ok && /not_booked/.test(stranger.message), `a shop not booked on the event opened a suggestion: ${JSON.stringify(stranger)}`);

  /* Up to three waiting per part per shop. */
  await screened(ok.value.suggestion_id!);
  for (let i = 0; i < 2; i += 1) {
    const more = await begin(W.florist, 'bridal_bouquet');
    assert.ok(more.ok && more.value.status === 'ok', JSON.stringify(more));
    await screened(more.value.suggestion_id!);
  }
  const fourth = await begin(W.florist, 'bridal_bouquet');
  assert.ok(fourth.ok && fourth.value.status === 'full', `a fourth waiting photo was opened: ${JSON.stringify(fourth)}`);
});

test('3 · the supplier’s own session can neither attach a photo nor make its row visible', async () => {
  const r = await begin(W.florist, 'centrepieces');
  assert.ok(r.ok && r.value.status === 'ok');
  const id = r.value.suggestion_id!;
  await asUser(W.florist);
  await assert.rejects(
    db.query(`UPDATE public.event_inspiration_suggestions SET state='waiting', image_url='https://evil.example/x.jpg' WHERE suggestion_id=$1`, [id]),
    /permission denied/,
    'a supplier wrote its own suggestion row past the content screen',
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_inspiration_suggestions (event_id, shop_label, slot_key, state, image_url, screened_at, sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
       VALUES ($1, 'x', 'bridal_bouquet', 'waiting', 'https://evil.example/x.jpg', NOW(), '#000000','#000000','#000000','#000000','#000000','#000000')`,
      [W.eventId],
    ),
    /permission denied/,
  );
  await reset();
  assert.equal(await stateOf(id), 'screening');
  /* The table refuses a visible row with no photo, whoever writes it. */
  await assert.rejects(db.query(`UPDATE public.event_inspiration_suggestions SET state='waiting' WHERE suggestion_id=$1`, [id]), /screened_has_photo/);
  /* The couple's board cannot get a 'supplier_suggestion' row without its suggestion. */
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_inspiration_assets (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
         sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
       VALUES ($1, $2, 'cake', 1, 'supplier_suggestion', 'https://x/y.jpg', '#000000','#000000','#000000','#000000','#000000','#000000')`,
      [W.eventId, W.couple],
    ),
    /suggestion_has_provenance/,
  );
});

test('4 · Keep takes a free place, credited; on a full part it changes NOTHING without a position; Undo restores', async () => {
  /* A free place: kept at position 1, credited to the suggestion. */
  const a = await begin(W.florist, 'entourage_bouquets');
  assert.ok(a.ok);
  await screened(a.value.suggestion_id!);
  const kept = await as<{ status: string; slot_position: number }>(W.couple, `SELECT public.couple_decide_inspiration_suggestion($1, TRUE) AS out`, [a.value.suggestion_id]);
  assert.ok(kept.ok && kept.value.status === 'ok' && kept.value.slot_position === 1, JSON.stringify(kept));
  const rows = await boardRows('entourage_bouquets');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.source_kind, 'supplier_suggestion');
  assert.equal(rows[0]!.from_suggestion_id, a.value.suggestion_id);
  assert.equal(await stateOf(a.value.suggestion_id!), 'kept');

  /* A full part: the couple's own three photos. */
  await reset();
  for (const pos of [1, 2, 3]) {
    await db.query(
      `INSERT INTO public.event_inspiration_assets (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
         sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
       VALUES ($1, $2, 'flower_accents', $3, 'file_upload', $4, '#111111','#222222','#333333','#444444','#555555','#666666')`,
      [W.eventId, W.couple, pos, `https://couple/own-${pos}.jpg`],
    );
  }
  const before3 = await boardRows('flower_accents');
  const b = await begin(W.florist, 'flower_accents');
  assert.ok(b.ok);
  await screened(b.value.suggestion_id!);

  /* 🧪 SABOTAGE TARGET: Keep never replaces silently. */
  const full = await as<{ status: string }>(W.couple, `SELECT public.couple_decide_inspiration_suggestion($1, TRUE) AS out`, [b.value.suggestion_id]);
  assert.ok(full.ok && full.value.status === 'full', `Keep on a full part did not stop to ask: ${JSON.stringify(full)}`);
  assert.deepEqual(await boardRows('flower_accents'), before3, 'Keep on a full part changed the couple’s photos without being told which');
  assert.equal(await stateOf(b.value.suggestion_id!), 'waiting', '“Keep all three for now” must leave it waiting');

  /* Named: it replaces photo 2, and only photo 2. */
  const rep = await as<{ status: string; slot_position: number; replaced: boolean }>(W.couple, `SELECT public.couple_decide_inspiration_suggestion($1, TRUE, 2::smallint) AS out`, [b.value.suggestion_id]);
  assert.ok(rep.ok && rep.value.status === 'ok' && rep.value.slot_position === 2 && rep.value.replaced, JSON.stringify(rep));
  const after = await boardRows('flower_accents');
  assert.deepEqual(after.map((r) => r.slot_position), [1, 2, 3]);
  assert.equal(after[0]!.inspiration_id, before3[0]!.inspiration_id);
  assert.equal(after[2]!.inspiration_id, before3[2]!.inspiration_id);
  assert.equal(after[1]!.from_suggestion_id, b.value.suggestion_id);

  /* Undo: the kept photo comes off, the couple's photo 2 comes back, the suggestion waits again. */
  const undo = await as<{ status: string }>(W.couple, `SELECT public.couple_undo_kept_inspiration_suggestion($1) AS out`, [b.value.suggestion_id]);
  assert.ok(undo.ok && undo.value.status === 'ok', JSON.stringify(undo));
  assert.deepEqual(await boardRows('flower_accents'), before3, 'Undo did not put the couple’s own photo back');
  assert.equal(await stateOf(b.value.suggestion_id!), 'waiting');

  /* No thanks: declined, nothing on the board. */
  const no = await as<{ status: string }>(W.couple, `SELECT public.couple_decide_inspiration_suggestion($1, FALSE) AS out`, [b.value.suggestion_id]);
  assert.ok(no.ok && no.value.status === 'ok');
  assert.equal(await stateOf(b.value.suggestion_id!), 'declined');
  assert.deepEqual(await boardRows('flower_accents'), before3);
});

test('5 · a guest and another supplier cannot Keep; another supplier cannot read; the florist may take its own back', async () => {
  const c = await begin(W.florist, 'cake');
  assert.ok(c.ok && c.value.status === 'wrong_trade', 'a florist reached Cake');
  const s = await begin(W.florist, 'table');
  assert.ok(s.ok && s.value.status === 'ok', 'Table linens is a florist part in the one map');
  await screened(s.value.suggestion_id!);

  const guest = await as(W.guest, `SELECT public.couple_decide_inspiration_suggestion($1, TRUE) AS out`, [s.value.suggestion_id]);
  assert.ok(!guest.ok && /not_your_event/.test(guest.message), `a guest kept a supplier's photo: ${JSON.stringify(guest)}`);
  const styl = await as(W.stylist, `SELECT public.couple_decide_inspiration_suggestion($1, TRUE) AS out`, [s.value.suggestion_id]);
  assert.ok(!styl.ok, 'another supplier kept the florist’s photo');

  await asUser(W.stylist);
  const seen = await db.query(`SELECT 1 FROM public.event_inspiration_suggestions WHERE suggestion_id=$1`, [s.value.suggestion_id]);
  await reset();
  assert.equal(seen.rows.length, 0, 'another supplier can read the florist’s suggestions');
  await asUser(W.couple);
  const couple = await db.query(`SELECT 1 FROM public.event_inspiration_suggestions WHERE suggestion_id=$1`, [s.value.suggestion_id]);
  await reset();
  assert.equal(couple.rows.length, 1, 'the couple cannot read a suggestion on their own event');

  const steal = await as(W.stylist, `SELECT public.vendor_withdraw_inspiration_suggestion($1) AS out`, [s.value.suggestion_id]);
  assert.ok(!steal.ok && /not_yours/.test(steal.message));
  const back = await as<{ status: string }>(W.florist, `SELECT public.vendor_withdraw_inspiration_suggestion($1) AS out`, [s.value.suggestion_id]);
  assert.ok(back.ok && back.value.status === 'ok');
  assert.equal(await stateOf(s.value.suggestion_id!), 'withdrawn');
});
