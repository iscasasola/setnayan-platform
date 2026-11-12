/**
 * 📁 A SUPPLIER FILES AN EVENT UNDER ITS QUOTED SERVICES — Piece 3b's schema walked in SQL, as each person, under RLS.
 * Covers 20271339773560_a_supplier_files_an_event_under_its_quoted_services (DECISION_LOG 2026-11-12: uploads belong to
 * the quoted service · documents belong to the booking · a shared portfolio photo is a mapping, never a copy · one
 * stored copy per photo · three guards against padding · FIVE GUARDS (4) · the couple's Hide).
 *
 * The five guards the build was asked to prove:
 *   G1 · a share creates NO copy — a mapped portfolio photo adds no supplier_media row and keeps its own service;
 *   G2 · the same hash never counts twice — one stored row per bytes, the second filing is a link (dedupe_of);
 *   G3 · outside the window (day before → day after) never lists, even with the couple's yes;
 *   G4 · nothing lists without the couple's yes — not even a photo taken ON the day;
 *   G5 · Hide takes a shown photo off at once.
 * Plus the filing rules: only under a service of THIS event's quote · a document never under a service · the supplier
 * can never write the couple's decision · only the couple of this event decides.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
async function shopOf(uid: string): Promise<string> {
  await asOwner();
  return (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid])).rows[0]!.v;
}
async function tryAs(uid: string, sql: string, params: unknown[] = []): Promise<string> {
  await asUser(uid);
  const out = await db.query(sql, params).then(
    () => 'ok',
    (e: Error) => `refused: ${e.message}`,
  );
  await asOwner();
  return out;
}
async function oneAs<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  await asUser(uid);
  const r = await db.query<T>(sql, params);
  await asOwner();
  return r.rows[0]!;
}
const sha = (c: string) => c.repeat(64).slice(0, 64);
const ref = (shop: string, n: string) => `r2://setnayan-thread-files/supplier-files/${shop}/ev/${n}.jpg`;

const F = {
  host: '', otherHost: '', rosa: '', shop: '', rival: '', rivalShop: '',
  ev: '', other: '', buffet: '', dessert: '', cocktail: '',
};

/** Rosa stores bytes once and files them; returns the file id. */
async function fileAs(uid: string, args: { ev: string; svc: string; media: string; name: string }): Promise<string> {
  return (
    await oneAs<{ f: string }>(
      uid,
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, vendor_service_id, media_id, file_name)
       VALUES ($1, $2, 'service', 'photo', $3, $4, $5) RETURNING file_id AS f`,
      [args.ev, F.shop, args.svc, args.media, args.name],
    )
  ).f;
}
async function storeAs(uid: string, hashChar: string, taken: string | null): Promise<string> {
  return (
    await oneAs<{ m: string }>(
      uid,
      `INSERT INTO public.supplier_media (vendor_profile_id, content_sha256, r2_ref, mime, size_bytes, taken_at)
       VALUES ($1, $2, $3, 'image/jpeg', 1000, $4) RETURNING media_id AS m`,
      [F.shop, sha(hashChar), ref(F.shop, hashChar), taken],
    )
  ).m;
}
async function listed(fileId: string): Promise<boolean> {
  await asOwner();
  const r = await db.query(`SELECT 1 FROM public.event_supplier_photos_listed WHERE file_id = $1`, [fileId]);
  return r.rows.length === 1;
}
async function decide(uid: string, fileId: string, d: 'shown' | 'hidden'): Promise<string> {
  return tryAs(uid, `SELECT public.couple_decide_supplier_file($1, $2)`, [fileId, d]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.host = await signUp('ana@files-3b.test', 'customer');
  F.otherHost = await signUp('cara@files-3b.test', 'customer');
  F.rosa = await signUp('rosa@files-3b.test', 'vendor');
  F.rival = await signUp('rival@files-3b.test', 'vendor');
  F.shop = await shopOf(F.rosa);
  F.rivalShop = await shopOf(F.rival);
  await asOwner();
  const mkEvent = async (name: string, day: string) =>
    (
      await db.query<{ e: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
         VALUES ($1, 'wedding', 'catholic', 'banquet_hall', $2::date) RETURNING event_id AS e`,
        [name, day],
      )
    ).rows[0]!.e;
  F.ev = await mkEvent('Ana & Miguel', '2027-03-15');
  F.other = await mkEvent('Cara & Dan', '2027-05-01');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.ev, F.host]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.other, F.otherHost]);
  for (const ev of [F.ev, F.other]) {
    await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [ev, F.shop, F.rosa]);
  }
  const card = async (title: string) =>
    (
      await db.query<{ s: string }>(
        `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active) VALUES ($1, 'catering', $2, FALSE) RETURNING vendor_service_id AS s`,
        [F.shop, title],
      )
    ).rows[0]!.s;
  F.buffet = await card('Garden buffet');
  F.cocktail = await card('Cocktail hour');
  F.dessert = await card('Dessert bar');
  // Ana & Miguel's quote holds Garden buffet + Cocktail hour (sent); Cara & Dan's holds Garden buffet.
  await db.query(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until, service_card_ids)
     VALUES ($1, $2, 'Garden wedding 150', 15000000, 'sent', now() + interval '10 days', $3::jsonb)`,
    [F.shop, F.ev, JSON.stringify([F.buffet, F.cocktail])],
  );
  await db.query(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until, service_card_ids)
     VALUES ($1, $2, 'Cara quote', 9000000, 'sent', now() + interval '10 days', $3::jsonb)`,
    [F.shop, F.other, JSON.stringify([F.buffet])],
  );
});
after(async () => {
  await db?.close();
});

test('filing · a photo goes only under a service of THIS event’s quote; a document never under a service', async () => {
  const m = await storeAs(F.rosa, 'a', '2027-03-15T10:00:00+08:00');
  assert.match(
    await tryAs(
      F.rosa,
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, vendor_service_id, media_id, file_name) VALUES ($1, $2, 'service', 'photo', $3, $4, 'x.jpg')`,
      [F.ev, F.shop, F.dessert, m],
    ),
    /^refused/,
    'a photo was filed under Dessert bar — a service NOT in this event’s quote',
  );
  assert.match(
    await tryAs(
      F.rosa,
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, vendor_service_id, media_id, file_name) VALUES ($1, $2, 'service', 'document', $3, $4, 'menu.pdf')`,
      [F.ev, F.shop, F.buffet, m],
    ),
    /^refused/,
    'a document was filed under a service',
  );
  assert.equal(
    await tryAs(
      F.rosa,
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, media_id, file_name) VALUES ($1, $2, 'booking', 'document', $3, 'contract.pdf')`,
      [F.ev, F.shop, m],
    ),
    'ok',
    'a document could not go in This booking',
  );
  assert.match(
    await tryAs(
      F.rival,
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, media_id, file_name) VALUES ($1, $2, 'booking', 'document', $3, 'x.pdf')`,
      [F.ev, F.rivalShop, m],
    ),
    /^refused/,
    'a shop that never talked to this couple filed into their event (or pointed at another shop’s copy)',
  );
});

test('G1 · sharing a portfolio photo creates NO copy and keeps its own service', async () => {
  await asOwner();
  const before = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.supplier_media`)).rows[0]!.n;
  const portfolioRef = `r2://setnayan-media/vendors/${F.shop}/portfolio/dessert-1.jpg`;
  const linked = await oneAs<{ f: string; counts: boolean; svc: string }>(
    F.rosa,
    `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, vendor_service_id, portfolio_ref, file_name)
     VALUES ($1, $2, 'linked', 'photo', $3, $4, 'dessert-1.jpg') RETURNING file_id AS f, counts, vendor_service_id AS svc`,
    [F.ev, F.shop, F.dessert, portfolioRef],
  );
  await asOwner();
  const after = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.supplier_media`)).rows[0]!.n;
  assert.equal(after, before, 'a share stored a new copy of the photo');
  assert.equal(linked.svc, F.dessert, 'the mapped photo lost its own service');
  assert.equal(linked.counts, false, 'a mapped portfolio photo counted toward this event');
  assert.match(
    await tryAs(
      F.rosa,
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, portfolio_ref, media_id, file_name) VALUES ($1, $2, 'linked', 'photo', $3, $4, 'copy.jpg')`,
      [F.ev, F.shop, portfolioRef + '?2', await storeAs(F.rosa, 'b', null)],
    ),
    /^refused/,
    'a "share" carried a stored copy of its own',
  );
  assert.match(
    await tryAs(
      F.rosa,
      `INSERT INTO public.event_supplier_files (event_id, vendor_profile_id, grp, kind, vendor_service_id, portfolio_ref, file_name) VALUES ($1, $2, 'linked', 'photo', $3, $4, 'again.jpg')`,
      [F.ev, F.shop, F.dessert, portfolioRef],
    ),
    /^refused/,
    'the same portfolio photo was mapped twice into one event',
  );
  assert.equal(await listed(linked.f), false);
});

test('G2 · the same bytes are stored once and never count twice', async () => {
  const m = await storeAs(F.rosa, 'c', '2027-03-15T11:00:00+08:00');
  assert.match(
    await tryAs(
      F.rosa,
      `INSERT INTO public.supplier_media (vendor_profile_id, content_sha256, r2_ref, mime) VALUES ($1, $2, $3, 'image/jpeg')`,
      [F.shop, sha('c'), ref(F.shop, 'c2')],
    ),
    /^refused/,
    'the same bytes were stored a second time',
  );
  const first = await fileAs(F.rosa, { ev: F.ev, svc: F.buffet, media: m, name: 'buffet.jpg' });
  // The SAME photo filed into another couple's event (the padding loophole) …
  const again = await fileAs(F.rosa, { ev: F.other, svc: F.buffet, media: m, name: 'buffet.jpg' });
  // … and a second time into the same event.
  const twice = await fileAs(F.rosa, { ev: F.ev, svc: F.cocktail, media: m, name: 'buffet-again.jpg' });
  await asOwner();
  const rows = (
    await db.query<{ file_id: string; counts: boolean; dedupe_of: string | null }>(
      `SELECT file_id, counts, dedupe_of FROM public.event_supplier_files WHERE media_id = $1 ORDER BY created_at`,
      [m],
    )
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.counts),
    [true, false, false],
    'the same photo counted more than once',
  );
  assert.equal(rows.find((r) => r.file_id === again)!.dedupe_of, first);
  assert.equal(rows.find((r) => r.file_id === twice)!.dedupe_of, first);
  // Even shown by the other couple, the copy never lists.
  assert.equal(await decide(F.otherHost, again, 'shown'), 'ok');
  assert.equal(await listed(again), false, 'a duplicate of another event’s photo listed on the shop');
  // Bytes already on the portfolio never count for an event.
  const onPortfolio = await storeAs(F.rosa, 'd', null);
  await asOwner();
  await db.query(`UPDATE public.supplier_media SET in_portfolio = TRUE WHERE media_id = $1`, [onPortfolio]);
  const pf = await fileAs(F.rosa, { ev: F.ev, svc: F.buffet, media: onPortfolio, name: 'portfolio.jpg' });
  await asOwner();
  assert.equal((await db.query<{ counts: boolean }>(`SELECT counts FROM public.event_supplier_files WHERE file_id = $1`, [pf])).rows[0]!.counts, false);
  // Even the table owner flipping it by hand does not stick — the trigger recomputes on every write …
  await db.query(`UPDATE public.event_supplier_files SET counts = TRUE WHERE file_id = $1`, [again]);
  assert.equal((await db.query<{ counts: boolean }>(`SELECT counts FROM public.event_supplier_files WHERE file_id = $1`, [again])).rows[0]!.counts, false);
  // … and with the trigger out of the way, the unique index still refuses a second counting row for one copy.
  await db.exec(`ALTER TABLE public.event_supplier_files DISABLE TRIGGER event_supplier_files_guard`);
  await assert.rejects(db.query(`UPDATE public.event_supplier_files SET counts = TRUE WHERE file_id = $1`, [again]), /event_supplier_files_counts_once/);
  await db.exec(`ALTER TABLE public.event_supplier_files ENABLE TRIGGER event_supplier_files_guard`);
});

test('G3 · a photo taken outside the day before → the day after never lists — even with the couple’s yes', async () => {
  const inWindowEdge = await fileAs(F.rosa, { ev: F.ev, svc: F.buffet, media: await storeAs(F.rosa, 'e', '2027-03-14T07:00:00+08:00'), name: 'setup.jpg' });
  const dayAfter = await fileAs(F.rosa, { ev: F.ev, svc: F.buffet, media: await storeAs(F.rosa, 'f', '2027-03-16T23:30:00+08:00'), name: 'teardown.jpg' });
  const tooEarly = await fileAs(F.rosa, { ev: F.ev, svc: F.buffet, media: await storeAs(F.rosa, '1', '2027-03-13T23:30:00+08:00'), name: 'other-wedding.jpg' });
  const farAway = await fileAs(F.rosa, { ev: F.ev, svc: F.buffet, media: await storeAs(F.rosa, '2', '2026-12-01T12:00:00+08:00'), name: 'december.jpg' });
  for (const f of [inWindowEdge, dayAfter, tooEarly, farAway]) assert.equal(await decide(F.host, f, 'shown'), 'ok');
  assert.equal(await listed(inWindowEdge), true, 'the day before (setup) did not list');
  assert.equal(await listed(dayAfter), true, 'the day after (teardown) did not list');
  assert.equal(await listed(tooEarly), false, 'two days before the event listed');
  assert.equal(await listed(farAway), false, 'a photo from another month listed as from this event');
});

test('G4 · nothing lists without the couple’s yes — not even a photo taken on the day, and not an undated one', async () => {
  const onTheDay = await fileAs(F.rosa, { ev: F.ev, svc: F.cocktail, media: await storeAs(F.rosa, '3', '2027-03-15T18:00:00+08:00'), name: 'toast.jpg' });
  const undated = await fileAs(F.rosa, { ev: F.ev, svc: F.cocktail, media: await storeAs(F.rosa, '4', null), name: 'nodate.jpg' });
  assert.equal(await listed(onTheDay), false, 'a photo listed before the couple said yes');
  assert.equal(await listed(undated), false, 'an undated photo listed before the couple said yes');
  // The supplier cannot say yes for them — not by column, not through the RPC.
  assert.match(
    await tryAs(F.rosa, `UPDATE public.event_supplier_files SET couple_decision = 'shown' WHERE file_id = $1`, [onTheDay]),
    /^refused/,
    'the supplier wrote the couple’s decision',
  );
  assert.match(await decide(F.rosa, onTheDay, 'shown'), /^refused/, 'the supplier approved its own photo through the RPC');
  assert.match(await decide(F.otherHost, onTheDay, 'shown'), /^refused/, 'another event’s couple approved this one');
  // The couple sees the stored copy behind THEIR event's files (to decide), never the shop's other copies.
  await asUser(F.host);
  const seen = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.supplier_media`);
  const mine = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.supplier_media m WHERE m.media_id IN (SELECT media_id FROM public.event_supplier_files WHERE event_id = $1)`,
    [F.ev],
  );
  await asOwner();
  const all = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.supplier_media`)).rows[0]!.n;
  assert.equal(seen.rows[0]!.n, mine.rows[0]!.n, 'the couple read stored copies that are not behind their event’s files');
  assert.ok(seen.rows[0]!.n < all);
  assert.equal(await decide(F.host, undated, 'shown'), 'ok');
  assert.equal(await listed(undated), true, 'an undated photo did not list on the couple’s yes');
  assert.equal(await decide(F.host, onTheDay, 'shown'), 'ok');
  assert.equal(await listed(onTheDay), true);
});

test('G5 · Hide takes a shown photo off at once; re-filing under another service asks again', async () => {
  const f = await fileAs(F.rosa, { ev: F.ev, svc: F.buffet, media: await storeAs(F.rosa, '5', '2027-03-15T12:00:00+08:00'), name: 'mains.jpg' });
  assert.equal(await decide(F.host, f, 'shown'), 'ok');
  assert.equal(await listed(f), true);
  assert.equal(await decide(F.host, f, 'hidden'), 'ok');
  assert.equal(await listed(f), false, 'a hidden photo stayed on the shop');
  assert.equal(await decide(F.host, f, 'shown'), 'ok');
  assert.equal(await tryAs(F.rosa, `UPDATE public.event_supplier_files SET vendor_service_id = $2 WHERE file_id = $1`, [f, F.cocktail]), 'ok');
  assert.equal(await listed(f), false, 'moving a photo to another service kept the couple’s old yes');
});
