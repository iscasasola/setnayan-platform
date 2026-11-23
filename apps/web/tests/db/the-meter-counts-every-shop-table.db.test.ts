/**
 * 📏 THE METER COUNTS EVERYTHING THE SHOP OWNS — covers 20271360925434_supplier_storage_meter_counts_everything.
 *
 * Owner 2026-11-23 (DECISION_LOG "THE SUPPLIER STORAGE METER COUNTS EVERYTHING THE SHOP OWNS — FILES AND DATA" +
 * "THE METER SHOWS REAL USAGE ONLY"): "we want them to achieve limits asap" · "their calendars schedule, website and
 * every data compiled to them is computed" · "No, real usage only".
 *
 *   · EVERY TABLE THAT NAMES A SHOP is counted, or left out with its reason — and the left-out list is short, real and
 *     only the platform's own books, safety records, secrets and the meter's own rows. A NEW table that names a shop is
 *     counted by default (made here, measured here);
 *   · every stored file lands in its kind: Photos & video · Files (evidence inside it) · Records; the room is the
 *     non-media files + the chat messages;
 *   · a new shop reads its true few KB — no reserve;
 *   · the measure is the nightly job's (every shop, one pass) or a first look's (one shop) — the read never rescans;
 *   · media vs document: the SQL twin says exactly what `isMediaContentType` says;
 *   · every piece is the service role's alone.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { isMediaContentType } from '../../lib/supplier-storage';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

let seq = 0;
/** `n` characters that do not compress (a row's stored size is measured, after compression). */
function noise(n: number): string {
  let out = '';
  let x = 2463534242;
  while (out.length < n) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    out += String.fromCharCode(33 + (x % 90));
  }
  return out;
}
type Shop = { uid: string; shop: string; ev: string; thread: string };

async function newShop(tier = 'solo'): Promise<Shop> {
  await asOwner();
  const n = ++seq;
  const uid = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
      [`meter-${n}@storage.test`],
    )
  ).rows[0]!.id;
  const shop = (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid])).rows[0]!.v;
  await db.query(`UPDATE public.vendor_profiles SET tier_state = $2 WHERE vendor_profile_id = $1`, [shop, tier]);
  const ev = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
       VALUES ($1, 'wedding', 'catholic', 'banquet_hall', '2027-04-10'::date) RETURNING event_id AS e`,
      [`Meter ${n}`],
    )
  ).rows[0]!.e;
  const thread = (
    await db.query<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3) RETURNING thread_id AS t`,
      [ev, shop, uid],
    )
  ).rows[0]!.t;
  return { uid, shop, ev, thread };
}

type Breakdown = { pv: number; files: number; records: number; room: number; evidence: number; measured: string | null };
async function breakdown(shop: string): Promise<Breakdown> {
  await asOwner();
  const r = (
    await db.query<Record<string, unknown>>(`SELECT * FROM public.vendor_storage_breakdown($1)`, [shop])
  ).rows[0]!;
  return {
    pv: Number(r.photos_video_bytes),
    files: Number(r.files_bytes),
    records: Number(r.records_bytes),
    room: Number(r.room_bytes),
    evidence: Number(r.evidence_bytes),
    measured: r.records_measured_at === null ? null : String(r.records_measured_at),
  };
}
async function used(shop: string): Promise<number> {
  await asOwner();
  return Number((await db.query<{ u: string }>(`SELECT public.vendor_storage_used_bytes($1) AS u`, [shop])).rows[0]!.u);
}
async function measure(shop: string | null): Promise<number> {
  await asOwner();
  return Number((await db.query<{ n: number }>(`SELECT public.supplier_storage_measure_records($1) AS n`, [shop])).rows[0]!.n);
}
async function ledger(s: Shop, ref: string, bytes: number, contentType: string, evidence = false): Promise<void> {
  await asOwner();
  await db.query(
    `INSERT INTO public.supplier_stored_files (object_ref, vendor_profile_id, bytes, content_type, room, evidence)
     VALUES ($1, $2, $3, $4, CASE WHEN public.supplier_storage_is_media($4) THEN 'media' ELSE 'documents' END, $5)`,
    [ref, s.shop, bytes, contentType, evidence],
  );
}
async function chat(s: Shop, opts: { body: string; size?: number; mime?: string; role?: string }): Promise<string> {
  await asOwner();
  return (
    await db.query<{ m: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body,
                                         attachment_size_bytes, attachment_mime, attachment_r2_key, attachment_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING message_id AS m`,
      [
        s.thread,
        s.ev,
        s.shop,
        s.uid,
        opts.role ?? 'vendor',
        opts.body,
        opts.size ?? null,
        opts.mime ?? null,
        opts.size ? `chat/${s.thread}/${s.uid}/${++seq}` : null,
        opts.size ? `file-${seq}` : null,
      ],
    )
  ).rows[0]!.m;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

type Source = { table_name: string; shop_columns: string[]; booking_columns: string[]; counted: boolean; reason: string | null };
async function sources(): Promise<Source[]> {
  await asOwner();
  return (await db.query<Source>(`SELECT * FROM public.supplier_storage_record_sources()`)).rows;
}

test('every table that names a shop is counted — or left out with its reason, and only the platform’s own rows are', async () => {
  const all = await sources();
  const counted = all.filter((s) => s.counted).map((s) => s.table_name);
  const left = all.filter((s) => !s.counted);
  console.log(`  shop tables: ${all.length} · counted ${counted.length} · left out ${left.length}`);
  // A sweep that found nothing must not pass quietly (wrong schema, a renamed table).
  assert.ok(all.length >= 150, `only ${all.length} tables name a shop — the sweep stopped seeing them`);

  // What the owner named: "calendars schedule, website and every data compiled to them" — service cards, packages,
  // quotes, bookings, chat messages, clients, notes, team rows.
  for (const must of [
    'vendor_profiles', // the shop page / website
    'vendor_services', // service cards
    'vendor_packages',
    'vendor_calendar_blocks', // calendar
    'vendor_calendar_day_states',
    'vendor_schedule_pools', // schedule
    'vendor_service_time_slots',
    'vendor_proposals', // quotes
    'vendor_offer_cards',
    'event_vendors', // bookings (named by linked_vendor_profile_id / marketplace_vendor_id)
    'event_vendor_line_items', // a booking's own rows, through the booking
    'event_vendor_payments',
    'chat_threads',
    'chat_messages', // chat words
    'vendor_client_notes', // clients and notes
    'vendor_client_invites',
    'vendor_team_members', // team rows
    'vendor_contracts',
    'vendor_reviews',
  ]) {
    assert.ok(counted.includes(must), `${must} names a shop but its rows are not counted`);
  }

  // The left-out list: each one real, each with its reason, and short — the meter is counted by default.
  assert.ok(left.length <= 40, `${left.length} shop tables are left out — the meter must count by default`);
  for (const l of left) {
    assert.ok((l.reason ?? '').length > 10, `${l.table_name} is left out with no reason`);
    assert.match(l.reason ?? '', /^Setnayan's (own books|safety records|admin records)|secret|device|^This meter/, `${l.table_name}: "${l.reason}" is not a ruled reason to leave a shop's rows out`);
  }
  // A name in the left-out list that matches no shop table is a typo that would leave its real table counted by
  // accident today and out tomorrow: the function returns such a name with no columns.
  for (const s of all) {
    assert.ok(s.shop_columns.length + s.booking_columns.length > 0, `left-out "${s.table_name}" is not a table that names a shop`);
  }
});

test('a NEW table that names a shop is counted by default — measured the moment it exists', async () => {
  const s = await newShop();
  await asOwner();
  await db.exec(`CREATE TABLE public.zz_meter_probe (id serial PRIMARY KEY, shop uuid REFERENCES public.vendor_profiles(vendor_profile_id), note text)`);
  try {
    const probe = (await sources()).find((x) => x.table_name === 'zz_meter_probe');
    assert.ok(probe, 'a table with a key to vendor_profiles is not seen');
    assert.equal(probe.counted, true);
    assert.deepEqual(probe.shop_columns, ['shop']);
    await measure(s.shop);
    const before = (await breakdown(s.shop)).records;
    // Text that does not compress: the measure is the STORED size, so a repeated letter would weigh almost nothing.
    await db.query(`INSERT INTO public.zz_meter_probe (shop, note) VALUES ($1, $2)`, [s.shop, noise(4000)]);
    await measure(s.shop);
    const afterRows = (await breakdown(s.shop)).records;
    assert.ok(afterRows - before >= 3000, `a 4 KB row in a new shop table added ${afterRows - before} bytes`);
  } finally {
    await db.exec(`DROP TABLE public.zz_meter_probe`);
  }
});

test('a booking’s own rows count for the booked shop — through event_vendors', async () => {
  const s = await newShop();
  await asOwner();
  const booking = (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors (event_id, linked_vendor_profile_id, vendor_name, category, status)
       VALUES ($1, $2, 'Meter shop', 'photographer', 'considering') RETURNING vendor_id AS v`,
      [s.ev, s.shop],
    )
  ).rows[0]!.v;
  await db.exec(`CREATE TABLE public.zz_meter_booking_probe (id serial PRIMARY KEY, booking uuid REFERENCES public.event_vendors(vendor_id), note text)`);
  try {
    const probe = (await sources()).find((x) => x.table_name === 'zz_meter_booking_probe');
    assert.ok(probe?.counted, 'a table naming a booking is not counted');
    assert.deepEqual(probe.booking_columns, ['booking']);
    await measure(s.shop);
    const before = (await breakdown(s.shop)).records;
    await db.query(`INSERT INTO public.zz_meter_booking_probe (booking, note) VALUES ($1, $2)`, [booking, noise(4000)]);
    assert.equal(await measure(s.shop), 1);
    const one = (await breakdown(s.shop)).records;
    assert.ok(one - before >= 3000, `a 4 KB booking row added ${one - before} bytes for the shop`);
    await measure(null); // the nightly pass says the same as the shop's own
    assert.equal((await breakdown(s.shop)).records, one, 'the nightly pass and the one-shop measure disagree');
  } finally {
    await db.exec(`DROP TABLE public.zz_meter_booking_probe`);
  }
});

test('a NEW shop reads its true few KB — no reserve, no “System” block (owner 23 Nov: “No, real usage only”)', async () => {
  const s = await newShop('free');
  await asOwner();
  assert.equal((await db.query(`SELECT 1 FROM public.supplier_storage_records WHERE vendor_profile_id = $1`, [s.shop])).rows.length, 0);
  const b = await breakdown(s.shop); // its first look measures it, once
  assert.equal(b.pv, 0);
  assert.equal(b.files, 0);
  assert.equal(b.evidence, 0);
  assert.ok(b.records > 0, 'the shop’s own rows weigh nothing');
  assert.ok(b.records < 20_000, `a new shop reads ${b.records} bytes — more than its sign-up rows`);
  assert.ok(b.measured, 'measured_at not set');
  assert.equal(await used(s.shop), b.pv + b.files + b.records, 'the total is the three kinds added');
});

test('a BUSY shop: every file in its kind, evidence inside Files, the room = documents + chat words', async () => {
  const s = await newShop('solo');
  const MB = 1_000_000;
  // Photos & video
  await ledger(s, `r2://setnayan-media/vendors/${s.shop}/logo/a.jpg`, 2 * MB, 'image/jpeg');
  await ledger(s, `r2://setnayan-media/vendors/${s.shop}/services/b.mp4`, 30 * MB, 'video/mp4');
  await chat(s, { body: 'the venue', size: 3 * MB, mime: 'image/heic' });
  await asOwner();
  await db.query(
    `INSERT INTO public.vendor_papic_portfolio_photos (vendor_profile_id, event_id, r2_object_key, size_bytes, media_kind, credits_spent)
     VALUES ($1, $2, $3, $4, 'photo', 1)`,
    [s.shop, s.ev, `r2://setnayan-media/papic/portfolio/${s.shop}/1.jpg`, 5 * MB],
  );
  // Files (documents), one of them evidence
  await ledger(s, `r2://setnayan-vendor-verification/vendors/${s.shop}/dti.pdf`, 1 * MB, 'application/pdf', true);
  await chat(s, { body: 'price list', size: 400_000, mime: 'application/pdf' });
  await asOwner();
  await db.query(
    `INSERT INTO public.vendor_contracts (vendor_profile_id, event_id, title, file_name, file_url, file_size_bytes, mime_type)
     VALUES ($1, $2, 'Contract', 'contract.pdf', $3, $4, 'application/pdf')`,
    [s.shop, s.ev, `r2://setnayan-vendor-contracts/${s.shop}/c.pdf`, 600_000],
  );
  // Not the shop's: a file the COUPLE sent counts for the one who uploaded it, not the shop (DECISION_LOG 23 Nov (1)).
  await chat(s, { body: 'our mood board', size: 9 * MB, mime: 'image/jpeg', role: 'couple' });
  // Records: words
  for (let i = 0; i < 5; i++) await chat(s, { body: `message ${i} ${'·'.repeat(200)}` });

  await measure(s.shop);
  const b = await breakdown(s.shop);
  assert.equal(b.pv, 2 * MB + 30 * MB + 3 * MB + 5 * MB, 'Photos & video');
  assert.equal(b.files, 1 * MB + 400_000 + 600_000, 'Files');
  assert.equal(b.evidence, 1 * MB + 600_000, 'evidence: the contract + the verification paper');
  assert.ok(b.records > 5 * 200, 'Records');
  assert.ok(b.room > b.files, 'the room holds the documents AND the chat words');
  assert.ok(b.room - b.files <= b.records, 'the chat words in the room are part of Records, not added again');
  assert.equal(await used(s.shop), b.pv + b.files + b.records);

  // A released upload, a removed chat file and a dropped original stop counting.
  await asOwner();
  await db.query(`UPDATE public.supplier_stored_files SET released_at = now() WHERE object_ref = $1`, [
    `r2://setnayan-media/vendors/${s.shop}/services/b.mp4`,
  ]);
  await db.query(`UPDATE public.chat_messages SET file_removed_at = now() WHERE vendor_profile_id = $1 AND attachment_mime = 'image/heic'`, [s.shop]);
  const after = await breakdown(s.shop);
  assert.equal(after.pv, 2 * MB + 5 * MB, 'a deleted file still counts');
});

test('the read never rescans: records change only when measured (the nightly job, or a shop’s first look)', async () => {
  const s = await newShop();
  const first = await breakdown(s.shop);
  await chat(s, { body: noise(3000) });
  assert.equal((await breakdown(s.shop)).records, first.records, 'a page view measured again');
  // The nightly job: every shop in one pass, this one included.
  const n = await measure(null);
  assert.ok(n >= 2, `the nightly measure wrote ${n} shops`);
  assert.ok((await breakdown(s.shop)).records >= first.records + 2000, 'the nightly measure missed the new message');
});

test('the nightly pass never skips a shop: every supplier is measured, now, in one pass', async () => {
  await newShop('free');
  await newShop('pro');
  await asOwner();
  const before = (await db.query<{ t: string }>(`SELECT now()::text AS t`)).rows[0]!.t;
  const n = await measure(null);
  const shops = Number((await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.vendor_profiles`)).rows[0]!.c);
  assert.equal(n, shops, `the nightly measure wrote ${n} of ${shops} shops`);
  const missed = await db.query(
    `SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
       LEFT JOIN public.supplier_storage_records r ON r.vendor_profile_id = vp.vendor_profile_id
      WHERE r.measured_at IS NULL OR r.measured_at < $1::timestamptz`,
    [before],
  );
  assert.equal(missed.rows.length, 0, 'a shop was left "not measured yet" (or on an old measure) after the nightly pass');
});

test('media vs document: the SQL twin says exactly what isMediaContentType says', async () => {
  await asOwner();
  const types = [
    'image/jpeg', 'image/heic', 'image/x-canon-cr2', 'video/mp4', 'video/quicktime', 'audio/webm', 'audio/mpeg',
    'application/zip', 'application/x-7z-compressed', 'application/vnd.rar', 'application/octet-stream',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv', 'IMAGE/PNG', 'image/png; charset=binary', '', null,
  ];
  for (const t of types) {
    const sql = (await db.query<{ m: boolean }>(`SELECT public.supplier_storage_is_media($1) AS m`, [t])).rows[0]!.m;
    assert.equal(sql, isMediaContentType(t), `“${t}”: SQL says ${sql}, the app says ${isMediaContentType(t)}`);
  }
  assert.equal(isMediaContentType('application/pdf'), false);
  assert.equal(isMediaContentType('image/jpeg'), true);
});

test('every piece is the service role’s alone — a signed-in supplier reads none of it and writes none of it', async () => {
  const s = await newShop();
  await asUser(s.uid);
  for (const q of [
    `SELECT * FROM public.vendor_storage_breakdown('${s.shop}')`,
    `SELECT public.supplier_storage_measure_records('${s.shop}')`,
    `SELECT * FROM public.supplier_storage_record_sources()`,
    `SELECT * FROM public.vendor_storage_files('${s.shop}')`,
    `SELECT * FROM public.supplier_stored_files`,
    `SELECT * FROM public.supplier_storage_records`,
    `INSERT INTO public.supplier_stored_files (object_ref, vendor_profile_id, bytes, room) VALUES ('r2://a/b', '${s.shop}', 0, 'media')`,
  ]) {
    await assert.rejects(db.query(q), /permission denied/, `a supplier could run: ${q}`);
  }
  await asOwner();
  for (const t of ['supplier_stored_files', 'supplier_storage_records']) {
    const rls = (await db.query<{ r: boolean }>(`SELECT relrowsecurity AS r FROM pg_class WHERE relname = $1`, [t])).rows[0]!.r;
    assert.equal(rls, true, `${t} has RLS off`);
  }
});
