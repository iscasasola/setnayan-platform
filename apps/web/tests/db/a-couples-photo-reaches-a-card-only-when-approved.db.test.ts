/**
 * a-couples-photo-reaches-a-card-only-when-approved.db.test.ts — 📸 A COUPLE'S PHOTO SHARED TO A SUPPLIER'S
 * SERVICE CARD, against the real replayed schema (owner 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A
 * SUPPLIER'S INSPIRATION — THE SUPPLIER APPROVES, IT SYNCS TO THEIR SERVICE CARD …"; migration 20271297221336).
 *
 *   1 · PENDING NEVER PUBLIC. A waiting share is not on the card (`service_card_couple_photos`); anon cannot read the
 *       table at all; a declined share is not on the card.
 *   2 · ONLY THAT SUPPLIER CAN APPROVE. Another shop and the couple are refused (`not_yours`); the shop's own owner
 *       approves and the photo is on the card with its credit line.
 *   3 · WITHDRAW REMOVES IT. The uploader withdraws and the card no longer has it; so does removing the photo from
 *       the board. A co-host who did not upload it cannot withdraw it.
 *   4 · CONSENT REQUIRED. No consent version → `no_consent`, nothing written.
 *   5 · ONLY THEIR OWN PHOTO, ONLY A LINKED SHOP. A gallery-pick photo → `not_own_photo`; a shop not on the event →
 *       `not_on_event`; a guest → refused. Nobody can INSERT/UPDATE the table directly.
 *   6 · "A couple" credit is literally "A couple"; one live share per photo per shop.
 *
 * 🛡 SECURITY REVIEW #7089 — the reviewer's PoC (scenarios A–F), ported so each finding is pinned:
 *   F1 · the card serves the share's FROZEN COPY (`couple-looks/<share_id>.<ext>`), never the board row: a guest who
 *        swaps image_url / r2_key after (or before) Approve withdraws the share instead of re-pointing the card; a
 *        removal withdraws it and a guest's un-removal cannot bring it back.
 *   F2 · a direct-INSERTed "file_upload" with no key, a key from another event, or a partner's key reused on a second
 *        row is refused; the uploader of a board photo cannot be rewritten (NULL by erasure only).
 *   F3 · the public key carries no event id and no file name; Approve needs exactly that key.
 *   F4 · a NULL uploader is nobody's — no co-host may share it.
 *   F  · authenticated holds SELECT only on the table; anon nothing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
  await db.exec(`SET ROLE anon`);
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

const W = {
  couple: '', cohost: '', guest: '', eventId: '',
  florist: '', floristCard: '', other: '', otherCard: '', stranger: '', strangerCard: '',
  ownPhoto: '', ownPhoto2: '', pickedPhoto: '',
};
let keyN = 0;
/** What the upload action writes: a key under THIS event's folder, and its public URL. */
const uploadKey = (pos: number, eventId = W.eventId) => `inspiration/${eventId}/bridal_bouquet/${(++keyN).toString().padStart(8, '0')}-0000-4000-8000-000000000000-own-${pos}.jpg`;
const urlOf = (key: string) => `https://media.example/${key}`;
const lookKey = (shareId: string) => `couple-looks/${shareId}.jpg`;
const HEX = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F', '#FFFFFF'];

async function shop(email: string, name: string, link: boolean): Promise<{ owner: string; card: string }> {
  const owner = await newUser(email);
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['florals']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [owner, name],
  );
  const shopId = vp.rows[0]!.vendor_profile_id;
  const card = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, title, category, starting_price_php, is_active, primary_photo_r2_key)
     VALUES ($1, $2, 'photography', 40000, FALSE, 'vendor-media/cps/cover.jpg') RETURNING vendor_service_id`,
    [shopId, `${name} — Bridal bouquet`],
  );
  // A card publishes only with what it includes (the publish trigger) — then it goes live.
  await db.query(`INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label) VALUES ($1, $2, 'Boutonnière')`, [card.rows[0]!.vendor_service_id, shopId]);
  await db.query(`UPDATE public.vendor_services SET is_active = TRUE WHERE vendor_service_id = $1`, [card.rows[0]!.vendor_service_id]);
  if (link) {
    await db.query(
      `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id)
       VALUES ($1, $2, 'florist'::public.vendor_category, 'contracted', $3)`,
      [W.eventId, name, shopId],
    );
  }
  return { owner, card: card.rows[0]!.vendor_service_id };
}
async function boardPhoto(by: string, pos: number, kind: 'file_upload' | 'gallery_pick'): Promise<string> {
  await reset();
  if (kind === 'gallery_pick') {
    const asset = await db.query<{ asset_id: string }>(
      `INSERT INTO public.moodboard_library_assets (asset_type, asset_subtype, label, storage_path, source, approved_at)
       VALUES ('venue_scene', 'reception', 'lab', 'moodboard-library/lab.jpg', 'internet_placeholder', NOW()) RETURNING asset_id`,
    );
    const r = await db.query<{ inspiration_id: string }>(
      `INSERT INTO public.event_inspiration_assets (event_id, added_by_user_id, slot_key, slot_position, source_kind, library_asset_id, image_url,
         sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
       VALUES ($1, $2, 'bridal_bouquet', $3, 'gallery_pick', $4, 'moodboard-library/lab.jpg', $5, $6, $7, $8, $9, $10) RETURNING inspiration_id`,
      [W.eventId, by, pos, asset.rows[0]!.asset_id, ...HEX],
    );
    return r.rows[0]!.inspiration_id;
  }
  const key = uploadKey(pos);
  const r = await db.query<{ inspiration_id: string }>(
    `INSERT INTO public.event_inspiration_assets (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url, r2_key,
       sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, 'bridal_bouquet', $3, 'file_upload', $4, $5, $6, $7, $8, $9, $10, $11) RETURNING inspiration_id`,
    [W.eventId, by, pos, urlOf(key), key, ...HEX],
  );
  return r.rows[0]!.inspiration_id;
}
/** Free a board place (soft-delete whatever holds it), as the upload action does before a replace. */
async function freePlace(pos: number): Promise<void> {
  await reset();
  await db.query(`UPDATE public.event_inspiration_assets SET removed_at = NOW() WHERE event_id=$1 AND slot_key='bridal_bouquet' AND slot_position=$2 AND removed_at IS NULL`, [W.eventId, pos]);
}
const CONSENT = 'couple-photo-consent-v1';
async function share(uid: string, photo: string, card: string, style = 'names', line: string | null = 'Ana & Ben · Feb 2027', consent: string | null = CONSENT) {
  return as<{ status: string; share_id?: string; state?: string }>(
    uid,
    `SELECT public.couple_share_photo_with_supplier($1, $2, $3, $4, $5) AS out`,
    [photo, card, style, line, consent],
  );
}
/** The shop's answer. An Approve carries the frozen copy's key the server made (default: the right one). */
async function answer(uid: string, id: string, approve: boolean, key: string | null = approve ? lookKey(id) : null) {
  return as<{ status: string; unpublished_key?: string | null }>(uid, `SELECT public.vendor_answer_couple_photo($1, $2, $3) AS out`, [id, approve, key]);
}
async function withdraw(uid: string, id: string) {
  return as<{ status: string }>(uid, `SELECT public.couple_withdraw_photo_share($1) AS out`, [id]);
}
/** What a PUBLIC service card reads — as anon, the shop page's own visitor. */
async function onCard(card: string): Promise<Array<{ public_key: string; credit_line: string }>> {
  await asAnon();
  try {
    const r = await db.query<{ public_key: string; credit_line: string }>(
      `SELECT public_key, credit_line FROM public.service_card_couple_photos(ARRAY[$1]::uuid[])`,
      [card],
    );
    return r.rows;
  } finally {
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  W.couple = await newUser('cps-couple@audit.test');
  W.cohost = await newUser('cps-cohost@audit.test');
  W.guest = await newUser('cps-guest@audit.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Ana & Ben', 'birthday') RETURNING event_id`,
  );
  W.eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [W.eventId, W.couple]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [W.eventId, W.cohost]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`, [W.eventId, W.guest]);
  const f = await shop('cps-florist@audit.test', 'Bloom & Co.', true);
  W.florist = f.owner; W.floristCard = f.card;
  const o = await shop('cps-other@audit.test', 'Petal Lane', true);
  W.other = o.owner; W.otherCard = o.card;
  const s = await shop('cps-stranger@audit.test', 'Not On This Event', false);
  W.stranger = s.owner; W.strangerCard = s.card;
  W.ownPhoto = await boardPhoto(W.couple, 1, 'file_upload');
  W.ownPhoto2 = await boardPhoto(W.couple, 2, 'file_upload');
  W.pickedPhoto = await boardPhoto(W.couple, 3, 'gallery_pick');
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('4 · consent is required — no version, nothing written', async () => {
  for (const consent of [null, '', '   ']) {
    const r = await share(W.couple, W.ownPhoto, W.floristCard, 'names', 'Ana & Ben', consent);
    assert.ok(r.ok, r.ok ? '' : r.message);
    assert.equal(r.value.status, 'no_consent');
  }
  await reset();
  const n = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.couple_photo_shares`);
  assert.equal(n.rows[0]!.n, 0, 'a refused share wrote a row');
});

test('5 · only their own upload, only a linked shop, never a guest; no direct writes', async () => {
  const picked = await share(W.couple, W.pickedPhoto, W.floristCard);
  assert.ok(picked.ok && picked.value.status === 'not_own_photo', JSON.stringify(picked));
  const stranger = await share(W.couple, W.ownPhoto, W.strangerCard);
  assert.ok(stranger.ok && stranger.value.status === 'not_on_event', JSON.stringify(stranger));
  const cohost = await share(W.cohost, W.ownPhoto, W.floristCard);
  assert.ok(cohost.ok && cohost.value.status === 'not_your_photo', JSON.stringify(cohost));
  const guest = await share(W.guest, W.ownPhoto, W.floristCard);
  assert.ok(!guest.ok && /not_your_event/.test(guest.message), JSON.stringify(guest));

  for (const uid of [W.couple, W.florist]) {
    const ins = await as(uid, `INSERT INTO public.couple_photo_shares (event_id, inspiration_id, vendor_profile_id, vendor_service_id, shared_by_user_id, credit_style, credit_line, consent_version, consented_at, state)
      SELECT $1, $2, vs.vendor_profile_id, vs.vendor_service_id, $3, 'a_couple', 'A couple', 'x', NOW(), 'approved' FROM public.vendor_services vs WHERE vs.vendor_service_id = $4 RETURNING 1 AS out`,
      [W.eventId, W.ownPhoto, uid, W.floristCard]);
    assert.ok(!ins.ok, `a ${uid === W.couple ? 'couple' : 'shop'} session INSERTed a share directly`);
  }
});

test('1 + 2 · pending is never public; only that shop approves; the card shows the credit line', async () => {
  const r = await share(W.couple, W.ownPhoto, W.floristCard);
  assert.ok(r.ok && r.value.status === 'ok', JSON.stringify(r));
  const id = r.value.share_id!;

  assert.deepEqual(await onCard(W.floristCard), [], 'a WAITING share reached the public card');
  await asAnon();
  const anonRead = await db.query(`SELECT * FROM public.couple_photo_shares`).then(
    () => 'read',
    (e: Error) => e.message,
  );
  await reset();
  assert.notEqual(anonRead, 'read', 'anon could SELECT the shares table');

  // The shop's own session cannot flip the state past the door.
  const direct = await as(W.florist, `UPDATE public.couple_photo_shares SET state='approved', decided_at=NOW() WHERE share_id=$1 RETURNING 1 AS out`, [id]);
  assert.ok(!direct.ok || direct.value === undefined, 'a shop UPDATEd a share directly');
  assert.deepEqual(await onCard(W.floristCard), []);

  for (const uid of [W.other, W.couple, W.guest]) {
    const no = await answer(uid, id, true);
    assert.ok(!no.ok && /not_yours/.test(no.message), `${uid} approved another shop's photo: ${JSON.stringify(no)}`);
  }
  assert.deepEqual(await onCard(W.floristCard), [], 'a refused approve put the photo on the card');

  const yes = await answer(W.florist, id, true);
  assert.ok(yes.ok && yes.value.status === 'ok', JSON.stringify(yes));
  assert.deepEqual(await onCard(W.floristCard), [{ public_key: lookKey(id), credit_line: 'Ana & Ben · Feb 2027' }]);
  assert.deepEqual(await onCard(W.otherCard), [], 'the photo reached a card it was not sent to');

  // One live share per photo per shop.
  const again = await share(W.couple, W.ownPhoto, W.floristCard);
  assert.ok(again.ok && again.value.status === 'already' && again.value.state === 'approved', JSON.stringify(again));
});

test('3 · withdraw removes it; a co-host cannot withdraw it; a decline never shows', async () => {
  await reset();
  const id = (await db.query<{ share_id: string }>(
    `SELECT share_id FROM public.couple_photo_shares WHERE inspiration_id=$1 AND state='approved'`, [W.ownPhoto],
  )).rows[0]!.share_id;

  const cohost = await withdraw(W.cohost, id);
  assert.ok(!cohost.ok && /not_yours/.test(cohost.message), JSON.stringify(cohost));
  const shopTry = await withdraw(W.florist, id);
  assert.ok(!shopTry.ok, 'the shop withdrew the couple’s share');

  const gone = await withdraw(W.couple, id);
  assert.ok(gone.ok && gone.value.status === 'ok', JSON.stringify(gone));
  assert.deepEqual(await onCard(W.floristCard), [], 'a WITHDRAWN photo is still on the card');
  const late = await answer(W.florist, id, true);
  assert.ok(late.ok && late.value.status === 'withdrawn', 'a withdrawn share could be re-approved');

  // "A couple" — and a decline never reaches the card.
  const anon = await share(W.couple, W.ownPhoto2, W.otherCard, 'a_couple', 'Ana & Ben (ignored)');
  assert.ok(anon.ok && anon.value.status === 'ok', JSON.stringify(anon));
  await reset();
  const line = await db.query<{ credit_line: string }>(`SELECT credit_line FROM public.couple_photo_shares WHERE share_id=$1`, [anon.value.share_id]);
  assert.equal(line.rows[0]!.credit_line, 'A couple');
  const no = await answer(W.other, anon.value.share_id!, false);
  assert.ok(no.ok && no.value.status === 'ok');
  assert.deepEqual(await onCard(W.otherCard), [], 'a DECLINED share reached the card');

  // Removing the photo from the board takes an approved share off the card.
  const re = await share(W.couple, W.ownPhoto2, W.floristCard, 'a_couple', null);
  assert.ok(re.ok && re.value.status === 'ok', JSON.stringify(re));
  await answer(W.florist, re.value.share_id!, true);
  assert.equal((await onCard(W.floristCard)).length, 1);
  await reset();
  await db.query(`UPDATE public.event_inspiration_assets SET removed_at = NOW() WHERE inspiration_id=$1`, [W.ownPhoto2]);
  assert.deepEqual(await onCard(W.floristCard), [], 'a photo removed from the board is still on the card');
});

test('the shop reads its own list; another shop reads none of it', async () => {
  await reset();
  await freePlace(1);
  const fresh = await boardPhoto(W.couple, 1, 'file_upload');
  const r = await share(W.couple, fresh, W.floristCard);
  assert.ok(r.ok && r.value.status === 'ok', JSON.stringify(r));
  await asUser(W.florist);
  const mine = await db.query<{ share_id: string; state: string; credit_line: string; photo_key: string }>(`SELECT share_id, state, credit_line, photo_key FROM public.vendor_couple_photo_shares()`);
  await reset();
  const row = mine.rows.find((x) => x.share_id === r.value.share_id);
  assert.ok(row && row.state === 'waiting', 'the shop cannot see the photo waiting for it');
  const snap = (await db.query<{ r2_key: string }>(`SELECT r2_key FROM public.event_inspiration_assets WHERE inspiration_id=$1`, [fresh])).rows[0]!.r2_key;
  assert.equal(row!.photo_key, snap, 'a waiting share must show the shop the SNAPSHOT it is approving');
  await asUser(W.stranger);
  const theirs = await db.query(`SELECT * FROM public.vendor_couple_photo_shares()`);
  await reset();
  assert.equal(theirs.rows.length, 0, 'another shop saw this shop’s couple photos');
});

/* ══════════════════════════════════════════════════════════════════════════
   🛡 SECURITY REVIEW #7089 — the reviewer's PoC, pinned
   ══════════════════════════════════════════════════════════════════════════ */

async function freshShare(pos: number, card: string, approve: boolean): Promise<{ photo: string; id: string }> {
  await freePlace(pos);
  const photo = await boardPhoto(W.couple, pos, 'file_upload');
  const s = await share(W.couple, photo, card);
  assert.ok(s.ok && s.value.status === 'ok', JSON.stringify(s));
  const id = s.value.share_id!;
  if (approve) {
    const a = await answer(W.florist, id, true);
    assert.ok(a.ok && a.value.status === 'ok', JSON.stringify(a));
  }
  return { photo, id };
}
async function stateOf(id: string): Promise<{ state: string; public_key: string | null }> {
  await reset();
  return (await db.query<{ state: string; public_key: string | null }>(`SELECT state, public_key FROM public.couple_photo_shares WHERE share_id=$1`, [id])).rows[0]!;
}

test('F1 · PoC A — a GUEST swaps the picture behind an APPROVED card: the share is withdrawn, the card never shows the swap', async () => {
  const { photo, id } = await freshShare(1, W.floristCard, true);
  assert.deepEqual((await onCard(W.floristCard)).map((x) => x.public_key), [lookKey(id)]);
  const swap = await as(W.guest, `UPDATE public.event_inspiration_assets SET image_url='https://evil.example/swap.jpg' WHERE inspiration_id=$1 RETURNING image_url AS out`, [photo]);
  assert.ok(swap.ok, 'the pre-existing guest UPDATE path changed (that policy is out of scope here) — re-read this test');
  const card = await onCard(W.floristCard);
  assert.ok(!card.some((x) => x.public_key.includes('evil') || x.public_key === lookKey(id)), `the swapped (or stale) photo is still on the card: ${JSON.stringify(card)}`);
  assert.deepEqual(await stateOf(id), { state: 'withdrawn', public_key: null });
});

test('F1 · PoC A′ — a guest swaps the object KEY while the share waits: the shop can no longer approve it', async () => {
  const { photo, id } = await freshShare(1, W.floristCard, false);
  const swap = await as(W.guest, `UPDATE public.event_inspiration_assets SET r2_key=$2 WHERE inspiration_id=$1 RETURNING 1 AS out`, [photo, uploadKey(9)]);
  assert.ok(swap.ok);
  const late = await answer(W.florist, id, true);
  assert.ok(late.ok && late.value.status === 'withdrawn', `a share whose picture changed was approvable: ${JSON.stringify(late)}`);
  assert.deepEqual(await onCard(W.floristCard), []);
});

test('F1 · PoC C — the couple removes the photo; a guest un-removes it; it does NOT come back', async () => {
  const { photo, id } = await freshShare(1, W.floristCard, true);
  const rm = await as(W.couple, `UPDATE public.event_inspiration_assets SET removed_at=NOW() WHERE inspiration_id=$1 RETURNING 1 AS out`, [photo]);
  assert.ok(rm.ok);
  assert.deepEqual(await onCard(W.floristCard), [], 'a removed photo is still on the card');
  const un = await as(W.guest, `UPDATE public.event_inspiration_assets SET removed_at=NULL WHERE inspiration_id=$1 RETURNING 1 AS out`, [photo]);
  assert.ok(un.ok);
  assert.deepEqual(await onCard(W.floristCard), [], 'a guest’s un-remove put the photo back on the card');
  assert.equal((await stateOf(id)).state, 'withdrawn');
});

test('F2 · PoC B — a direct-INSERTed "file_upload" is refused unless its key is this event’s own, unshared upload', async () => {
  await freePlace(2);
  const insert = (key: string | null, url: string) =>
    as<string>(W.couple, `INSERT INTO public.event_inspiration_assets (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url, r2_key,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
      VALUES ($1,$2,'bridal_bouquet',2,'file_upload',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING inspiration_id AS out`, [W.eventId, W.couple, url, key, ...HEX]);
  // No key at all — an external picture typed in as an "upload".
  const ext = await insert(null, 'https://pinterest.example/not-mine.jpg');
  assert.ok(ext.ok, JSON.stringify(ext));
  const r1 = await share(W.couple, ext.value, W.floristCard, 'a_couple', null);
  assert.ok(r1.ok && r1.value.status === 'not_own_photo', `an external URL was shareable: ${JSON.stringify(r1)}`);
  // A key from ANOTHER event's folder.
  await freePlace(2);
  const otherEvent = uploadKey(2, '11111111-1111-4111-8111-111111111111');
  const foreign = await insert(otherEvent, urlOf(otherEvent));
  assert.ok(foreign.ok);
  const r2 = await share(W.couple, foreign.value, W.floristCard, 'a_couple', null);
  assert.ok(r2.ok && r2.value.status === 'not_own_photo', `another event's object was shareable: ${JSON.stringify(r2)}`);
});

test('F2 · PoC D — a co-host cannot become the uploader: rewriting is refused, and a partner’s key copied onto a second row is refused', async () => {
  await freePlace(3);
  const partner = await boardPhoto(W.couple, 3, 'file_upload');
  const steal = await as(W.cohost, `UPDATE public.event_inspiration_assets SET added_by_user_id=$2 WHERE inspiration_id=$1 RETURNING 1 AS out`, [partner, W.cohost]);
  assert.ok(!steal.ok, 'a co-host rewrote the uploader of the partner’s photo');
  const before = await share(W.cohost, partner, W.floristCard, 'a_couple', null);
  assert.ok(before.ok && before.value.status === 'not_your_photo', JSON.stringify(before));
  // The same object, copied onto the co-host's own new row.
  await reset();
  const key = (await db.query<{ r2_key: string }>(`SELECT r2_key FROM public.event_inspiration_assets WHERE inspiration_id=$1`, [partner])).rows[0]!.r2_key;
  await freePlace(2);
  const copy = await as<string>(W.cohost, `INSERT INTO public.event_inspiration_assets (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url, r2_key,
      sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
    VALUES ($1,$2,'bridal_bouquet',2,'file_upload',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING inspiration_id AS out`, [W.eventId, W.cohost, urlOf(key), key, ...HEX]);
  assert.ok(copy.ok, JSON.stringify(copy));
  const r = await share(W.cohost, copy.value, W.floristCard, 'a_couple', null);
  assert.ok(r.ok && r.value.status === 'not_own_photo', `a partner's upload, re-filed under a co-host, was shareable: ${JSON.stringify(r)}`);
  // Erasure still works: the account FK may set the uploader to NULL.
  await reset();
  await db.query(`UPDATE public.event_inspiration_assets SET added_by_user_id=NULL WHERE inspiration_id=$1`, [partner]);
});

test('F4 · PoC E — a NULL uploader (an erased account) is nobody’s: no co-host may share it', async () => {
  await freePlace(1);
  const orphan = await boardPhoto(W.couple, 1, 'file_upload');
  await reset();
  // The account-erasure FK's move — the one change of uploader that is allowed.
  await db.query(`UPDATE public.event_inspiration_assets SET added_by_user_id=NULL WHERE inspiration_id=$1`, [orphan]);
  const r = await share(W.cohost, orphan, W.floristCard, 'a_couple', null);
  assert.ok(r.ok && r.value.status === 'not_your_photo', `a NULL-uploader photo was shareable: ${JSON.stringify(r)}`);
});

test('F3 · the public key names no event and no file; Approve needs exactly this share’s key', async () => {
  const { id } = await freshShare(1, W.floristCard, false);
  for (const bad of [null, `couple-looks/${W.eventId}.jpg`, `inspiration/${W.eventId}/bridal_bouquet/x.jpg`, `couple-looks/${id}-ana-ben.jpg`, `couple-looks/${id}.jpeg.exe`]) {
    const a = await answer(W.florist, id, true, bad);
    assert.ok(a.ok && a.value.status === 'bad_key', `approve accepted ${bad}: ${JSON.stringify(a)}`);
  }
  assert.equal((await stateOf(id)).state, 'waiting');
  const ok = await answer(W.florist, id, true);
  assert.ok(ok.ok && ok.value.status === 'ok');
  const card = await onCard(W.floristCard);
  assert.ok(card.length > 0 && card.every((x) => /^couple-looks\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/.test(x.public_key) && !x.public_key.includes(W.eventId)), JSON.stringify(card));
  // Take off returns the key so the server deletes the copy; withdraw does too.
  const off = await answer(W.florist, id, false);
  assert.ok(off.ok && off.value.status === 'ok' && off.value.unpublished_key === lookKey(id), JSON.stringify(off));
  assert.deepEqual(await stateOf(id), { state: 'declined', public_key: null });
});

test('F · PoC F — the table grants: authenticated SELECT only, anon nothing', async () => {
  await reset();
  const r = await db.query<{ grantee: string; privilege_type: string }>(
    `SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='couple_photo_shares' AND grantee IN ('anon','authenticated') ORDER BY 1,2`,
  );
  assert.deepEqual(r.rows, [{ grantee: 'authenticated', privilege_type: 'SELECT' }]);
});
