/**
 * 🔁 TWO SAVES OF ONE REPLY TELL THE COUPLE ONCE — event-day L1·6
 * (`submitRsvp`, apps/web/app/[slug]/actions.ts).
 *
 * Before: two submits of one reply (a double tap, a retry after a lost answer,
 * two tabs) each read `before` while it still held the OLD answer, each decided
 * "it changed", and the couple got two `rsvp_received` notices. Now the write is
 * a compare-and-set on `updated_at` AS READ: the save that finds the row moved
 * re-reads it and compares against THAT.
 *
 * `submitRsvp` is a server action (cookies, `redirect`) this harness cannot run,
 * so test 1 drives the SAME write shape through the replayed schema with the
 * service client — two interleaved saves, the real `guestDetailsChanged` — and
 * proves the timestamp a read returns is one the filter matches (a CAS that
 * never matches would silently re-read on every save; one that always matches
 * would never catch the race). Test 2 holds the action to that shape.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the CAS filter dropped from the action's write            → test 2 red;
 *   • the re-read on a lost CAS removed                          → test 2 red;
 *   • `updated_at` dropped from the columns the reply reads      → test 2 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import './supabase-over-pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { SERVICE, clientAs } from './pglite-client';
import { guestDetailsChanged } from '../../app/[slug]/_lib/guest-details-changed';

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';
let GUEST = '';

const COLS = 'rsvp_status, meal_preference, dietary_restrictions, guest_note, email, mobile, display_name, updated_at';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  EVENT = (await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Twice', 'birthday') RETURNING event_id`)).rows[0]!.event_id;
  GUEST = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Ana', 'Cruz', 'both', 'friends') RETURNING guest_id`,
      [EVENT],
    )
  ).rows[0]!.guest_id;
});
after(async () => {
  await db?.close();
});

type Row = { rsvp_status: string; meal_preference: string | null; dietary_restrictions: string | null; guest_note: string | null; email: string | null; mobile: string | null; display_name: string | null; updated_at: string };

test('1 · two interleaved saves of the same reply: one write wins the compare, the other re-reads and reports nothing', async () => {
  const admin = clientAs(db, SERVICE);
  const read = async () => (await admin.from('guests').select(COLS).eq('guest_id', GUEST).eq('event_id', EVENT).maybeSingle()).data as unknown as Row;
  const reply = { rsvp_status: 'attending', meal_preference: 'fish', dietary_restrictions: 'nuts', mobile: '09171234567' };
  const write = (stamp: string | null) => {
    const row = admin.from('guests').update({ ...reply, updated_at: new Date().toISOString() }).eq('guest_id', GUEST).eq('event_id', EVENT);
    return (stamp ? row.eq('updated_at', stamp) : row).select('guest_id');
  };
  const report = (b: Row) => ({
    answer: b.rsvp_status !== reply.rsvp_status,
    details: guestDetailsChanged(b, { meal: 'fish', dietary: 'nuts', guestNote: null, email: null, mobile: reply.mobile, displayName: b.display_name }),
  });

  // Both saves read BEFORE either writes — the double tap.
  const a = await read();
  const b = await read();
  assert.equal(a.rsvp_status, 'pending');

  const wa = await write(a.updated_at);
  assert.equal(wa.error, null);
  assert.equal((wa.data ?? []).length, 1, 'a save against the stamp it read did not match — the CAS would re-read on every save');
  const ra = report(a);
  assert.equal(ra.answer, true, 'the first save is a real reply');

  const wb = await write(b.updated_at);
  assert.equal((wb.data ?? []).length, 0, 'the second save matched a stamp that had moved — the race is invisible');
  const fresh = await read();
  const rb = report(fresh);
  assert.deepEqual(rb, { answer: false, details: [] }, 'the second save would tell the couple again');
  // …and the old read is exactly what used to notify twice.
  assert.equal(report(b).answer, true);
  const wb2 = await write(null);
  assert.equal((wb2.data ?? []).length, 1, 'the second save did not land');
});

test('2 · the reply action has that shape: CAS on updated_at as read, re-read on a lost compare, then the report', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'app', '[slug]', 'actions.ts'), 'utf8');
  const submit = src.slice(src.indexOf('export async function submitRsvp('), src.indexOf('async function nameTheSeats('));
  assert.ok(submit.length > 2000, 'submitRsvp moved — re-point this guard');
  assert.match(src, /const REPLY_BEFORE_COLUMNS =\s*'[^']*\bupdated_at\b[^']*'/, 'the reply no longer reads the stamp it compares with');
  assert.match(submit, /return \(ifStillAt \? row\.eq\('updated_at', ifStillAt\) : row\)\.select\('guest_id'\);/, 'the write no longer asks whether the row is still the one read');
  const first = submit.indexOf('await writeReply(beforeStamp)');
  const reread = submit.indexOf('.select(REPLY_BEFORE_COLUMNS)', first);
  const assign = submit.indexOf('Object.assign(before, now_)', first);
  const report = submit.indexOf('guestDetailsChanged(before');
  assert.ok(first > -1 && reread > first && assign > reread && report > assign, 'a lost compare is not re-read before the change is reported');
});
