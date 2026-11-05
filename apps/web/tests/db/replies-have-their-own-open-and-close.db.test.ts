/**
 * 📬 REPLIES HAVE THEIR OWN OPEN AND CLOSE — ON THE REPLAYED SCHEMA (owner 2026-10-14, DECISION_LOG 📬).
 *
 * The window is not a column and not a database rule: it is four keys of `events.rsvp_ask_config`
 * read by ONE resolver (`replyWindow`, lib/reply-window.ts), which every reply writer asks before it
 * writes (`submitRsvp`, the join door's `createJoinRequest` — held by
 * lib/every-reply-writer-asks-the-window.test.ts, whose sabotage runs are recorded there). What the
 * database has to prove, it proves here:
 *
 *   1 · the couple's choice FITS the column: the real CHECK (`events_rsvp_ask_config_shape`) takes all
 *       four keys, and the couple's own session can Apply them (UPDATE granted on the column);
 *   2 · the columns every writer reads (`REPLY_WINDOW_EVENT_COLUMNS`) all EXIST — one read, through the
 *       same client shape the writers use — and the window decided from that row is the couple's:
 *       Closed → closed, a later open date → not yet (with that date), the default → open;
 *   3 · a reply from a GUEST outside the window is refused — the writer's own question, asked of the row
 *       it reads, says "not open", and the guest's stored answer stays as it was;
 *   4 · THE COUPLE'S OWN GUEST-LIST EDIT IS NOT GATED: with replies Closed, the couple — signed in, under
 *       RLS, through their own client — still changes a guest's answer. Nothing in the database knows
 *       the window, so nothing there can stand in their way (the ruling's item 3).
 *
 * ⚠ What this does NOT run: `submitRsvp` itself. It is a server action (cookies, `redirect`) the replay
 * cannot call. Its refusal is pinned by the writer guard above (removing the gate turns it red) and was
 * walked in a browser — the refusal sentence on the reply page.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import './supabase-over-pglite'; // the `server-only` shim, before any production module loads
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { SERVICE, clientAs } from './pglite-client';
import { REPLY_WINDOW_EVENT_COLUMNS, replyWindow, type ReplyFace, type ReplyWindowEvent } from '../../lib/reply-window';

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';
let GUEST = '';
let COUPLE = '';

const FACE: ReplyFace = { phasesEnabled: true, solemn: false };
const MNL = 'Asia/Manila';
/** A day `n` days from today on Manila's calendar — the event sits inside the Invitation stage. */
const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA', { timeZone: MNL });

async function readRow(): Promise<ReplyWindowEvent> {
  const { data, error } = await clientAs(db, SERVICE)
    .from('events')
    .select(REPLY_WINDOW_EVENT_COLUMNS)
    .eq('event_id', EVENT)
    .maybeSingle();
  assert.equal(error, null, `the writers' one read failed on the replayed schema: ${error?.message}`);
  assert.ok(data, 'the event was not read');
  return data as unknown as ReplyWindowEvent;
}
const answer = async () =>
  (await db.query<{ rsvp_status: string }>(`SELECT rsvp_status FROM public.guests WHERE guest_id = $1`, [GUEST])).rows[0]!.rsvp_status;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug, event_date) VALUES ('Marco and Marga', 'birthday', 'marco-marga-window', $1::date) RETURNING event_id`,
    [dayFromNow(30)],
  );
  EVENT = ev.rows[0]!.event_id;
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Bean', 'Banlag', 'both', 'friends') RETURNING guest_id`,
    [EVENT],
  );
  GUEST = g.rows[0]!.guest_id;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ('couple@reply-window.test', jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
  );
  COUPLE = u.rows[0]!.id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [EVENT, COUPLE]);
});

after(async () => {
  await replay?.db?.close?.();
});

test('1 · the couple’s choice fits the column, and their own session can Apply it', async () => {
  const cfg = { meal: false, repliesOpen: 'on_date', repliesOpenOn: dayFromNow(10), repliesClose: 'on_date', repliesCloseOn: dayFromNow(20) };
  const { error } = await clientAs(db, COUPLE).from('events').update({ rsvp_ask_config: cfg }).eq('event_id', EVENT).select('event_id');
  assert.equal(error, null, `the couple could not Apply the window: ${error?.message}`);
  const stored = (await db.query<{ c: Record<string, unknown> }>(`SELECT rsvp_ask_config AS c FROM public.events WHERE event_id = $1`, [EVENT])).rows[0]!.c;
  assert.deepEqual(stored, cfg);
});

test('2 · the writers’ columns all exist, and the window read from them is the couple’s', async () => {
  const now = Date.now();
  // Still the couple's open date ahead (from test 1): not yet, with that date.
  let w = replyWindow(await readRow(), now, MNL, FACE);
  assert.deepEqual({ state: w.state, opensOn: w.opensOn }, { state: 'not_yet', opensOn: dayFromNow(10) });
  // Closed.
  await db.query(`UPDATE public.events SET rsvp_ask_config = '{"repliesOpen":"closed"}'::jsonb WHERE event_id = $1`, [EVENT]);
  w = replyWindow(await readRow(), now, MNL, FACE);
  assert.equal(w.state, 'closed');
  // The default (nothing chosen) — 30 days out is the Invitation: open.
  await db.query(`UPDATE public.events SET rsvp_ask_config = NULL WHERE event_id = $1`, [EVENT]);
  w = replyWindow(await readRow(), now, MNL, FACE);
  assert.equal(w.state, 'open', 'anti-vacuity: the default must be open, or "closed" above proves nothing');
});

test('3 · a guest’s reply outside the window is refused — the stored answer stays', async () => {
  await db.query(`UPDATE public.events SET rsvp_ask_config = '{"repliesOpen":"closed"}'::jsonb WHERE event_id = $1`, [EVENT]);
  assert.equal(await answer(), 'pending');
  // The writer's question, exactly as `submitRsvp` asks it of the row it reads: not open → nothing written.
  const w = replyWindow(await readRow(), Date.now(), MNL, FACE);
  assert.notEqual(w.state, 'open');
  assert.equal(await answer(), 'pending', 'something wrote the answer while replies were closed');
});

test('4 · the couple’s own guest-list edit is NOT gated by the window', async () => {
  await db.query(`UPDATE public.events SET rsvp_ask_config = '{"repliesOpen":"closed"}'::jsonb WHERE event_id = $1`, [EVENT]);
  assert.equal(replyWindow(await readRow(), Date.now(), MNL, FACE).state, 'closed', 'precondition: replies are closed');
  const { data, error } = await clientAs(db, COUPLE)
    .from('guests')
    .update({ rsvp_status: 'attending' })
    .eq('guest_id', GUEST)
    .eq('event_id', EVENT)
    .select('guest_id');
  assert.equal(error, null, `the couple's edit was refused: ${error?.message}`);
  assert.equal((data ?? []).length, 1, 'the couple’s edit reached no row (RLS) — the test would prove nothing');
  assert.equal(await answer(), 'attending');
});
