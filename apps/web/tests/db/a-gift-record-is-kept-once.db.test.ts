/**
 * "I SENT IT" IS KEPT ONCE — event-day L1·4 (migration 20271274314846):
 * `recordGift` (`lib/gift-record.server.ts`) called against the REPLAYED schema.
 *
 * Before: every request inserted a row. A guest whose answer was lost on bad
 * venue signal pressed Send again, and one ₱2,500 gift was counted twice —
 * which can carry a ₱4,500 wish to its price and mark it "got" on money said
 * once. Now the sheet sends one `ref` per Send and a repeat is answered with
 * the first record.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the early `theFirstKept` read removed (the index still refuses the row,
 *     the 23505 branch answers)                                → still green — by design;
 *   • the early read AND the 23505 branch removed              → test 1 red (a refusal);
 *   • `client_ref` not written on the insert                   → tests 1, 2, 4 red;
 *   • the sheet stops sending its ref                          → test 5 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import './supabase-over-pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { SERVICE, clientAs } from './pglite-client';

type Writer = typeof import('../../lib/gift-record.server');
let W: Writer;
let replay: ReplayResult;
let db: PGlite;
let EVENT = '';
let NENE = '';
let AIR = '';
let AIR_ROW = '';

const admin = () => clientAs(db, SERVICE);
const as = (guestId: string) => ({ guest_id: guestId, event_id: EVENT });
const records = async () =>
  (await db.query<{ amount_php: number }>(`SELECT amount_php FROM public.event_gift_records WHERE event_id = $1`, [EVENT])).rows;
const gotOf = async () =>
  (await db.query<{ got_by: string | null }>(`SELECT got_by FROM public.event_wish_items WHERE wish_item_id = $1`, [AIR_ROW])).rows[0]!.got_by;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  W = await import('../../lib/gift-record.server');
  EVENT = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Kept Once', 'birthday', 'kept-once') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  NENE = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Nene', 'Reyes', 'both', 'friends') RETURNING guest_id`,
      [EVENT],
    )
  ).rows[0]!.guest_id;
  await db.query(
    `INSERT INTO public.event_egift_methods (event_id, method_kind, label, handle, is_enabled) VALUES ($1, 'gcash', 'GCash', '0917 123 4567', true)`,
    [EVENT],
  );
  const w = await db.query<{ wish_item_id: string; public_id: string }>(
    `INSERT INTO public.event_wish_items (event_id, name, price_php) VALUES ($1, 'Air fryer', 4500) RETURNING wish_item_id, public_id`,
    [EVENT],
  );
  AIR = w.rows[0]!.public_id;
  AIR_ROW = w.rows[0]!.wish_item_id;
});
after(async () => {
  await db?.close();
});

const REF = '4fa06e8c-5d7b-4c9e-9f1a-2b3c4d5e6f70';

test('1 · the same Send twice is ONE record — the wish is not carried to its price by a retry', async () => {
  const send = () => W.recordGift(admin(), as(NENE), EVENT, { wishId: AIR, amount: '2500', message: 'For merienda', ref: REF });
  const a = await send();
  const b = await send();
  assert.equal(a.ok, true);
  assert.equal(b.ok, true, 'a retry of a kept Send was refused');
  if (!a.ok || !b.ok) return;
  assert.deepEqual(
    { amountPhp: b.amountPhp, wishName: b.wishName, hasMessage: b.hasMessage, nowGot: b.nowGot },
    { amountPhp: 2500, wishName: 'Air fryer', hasMessage: true, nowGot: false },
  );
  assert.equal((await records()).length, 1, 'one Send became two records');
  assert.equal(await gotOf(), null, 'a retry marked the wish got on money said once');
});

test('2 · two Sends are two gifts — and they do reach the price together', async () => {
  const r = await W.recordGift(admin(), as(NENE), EVENT, { wishId: AIR, amount: '2500', ref: '5ab17f9d-6e8c-4dab-8a2b-3c4d5e6f7081' });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.nowGot, true);
  assert.equal((await records()).length, 2);
  assert.equal(await gotOf(), 'auto');
});

test('3 · a Send with no ref (an old sheet) is kept as before', async () => {
  const before_ = (await records()).length;
  await W.recordGift(admin(), as(NENE), EVENT, { amount: '100' });
  await W.recordGift(admin(), as(NENE), EVENT, { amount: '100' });
  assert.equal((await records()).length, before_ + 2);
});

test('4 · the database refuses a second row for one Send, whoever writes it', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_gift_records (event_id, amount_php, giver_name, giver_guest_id, client_ref) VALUES ($1, 1, 'X', $2, $3)`,
      [EVENT, NENE, REF],
    ),
    /duplicate key|unique/i,
  );
});

test('5 · the sheet mints one ref per Send and the door hands it to the writer', () => {
  const root = join(__dirname, '..', '..');
  const sheet = readFileSync(join(root, 'app', '[slug]', 'pabuya', '_components', 'gift-record-sheet.tsx'), 'utf8');
  assert.match(sheet, /const sendRef = useRef<string>\(/, 'the sheet no longer holds one ref for its Send');
  assert.match(sheet, /purpose: 'gift-record',[^\n]*ref: sendRef\.current/, 'the Send no longer carries its ref');
  assert.match(readFileSync(join(root, 'lib', 'gift-door.server.ts'), 'utf8'), /ref: body\.ref,/, 'the door drops the ref');
});
