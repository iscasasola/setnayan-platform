/**
 * CHAT DECISIONS YOU CAN FILE MESSAGES UNDER · THE POLL CARD — migration 20271338412990.
 *
 * ⚖ DECISION_LOG 2026-11-11 🗳 "CHAT DECISIONS YOU CAN TAP · DOUBLE-TAP FILES A MESSAGE · POLLS ARE THEIR OWN CARD"
 *   and 🗳 "CHAT POLLS — ONE PER CHAT · THE (+) REOPENS ONCE SENT · EITHER SIDE CLOSES" ("Only one poll can exist per
 *   chat. 1. Yes 2. Either side").
 *
 * Measured as real `authenticated` sessions on the replayed schema:
 *   · one OPEN poll per thread (the RPC refuses, the index refuses a direct write, a closed one makes room);
 *   · one vote per person per poll — it moves, it is taken back, it never doubles;
 *   · either side closes, anyone reopens, a saved poll stays settled;
 *   · save-as-decision: the winner, a tie needs a pick, the decision is a real topic with its line;
 *   · file / move / remove / rename, a message under at most one open topic, never a private line;
 *   · a stranger is refused on BOTH sides (no read, no write), and no table takes a direct write.
 *
 * Run (from apps/web): tsx --test tests/db/chat-decisions-file-messages-and-polls.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const FILE = '20271338412990_chat_decisions_file_messages_and_polls.sql';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(reset);

async function setClaimRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setClaimRole(null).catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setClaimRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function attempt(uid: string, fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await as(uid, fn);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
const one = async <T>(sql: string, args: unknown[] = []) => (await db.query<T>(sql, args)).rows[0]!;

let seq = 0;
const uniq = () => `pl-${++seq}`;
async function newUser(firstName: string): Promise<string> {
  const r = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  await db.query(`UPDATE public.users SET first_name = $2 WHERE user_id = $1`, [r.id, firstName]);
  return r.id;
}

type World = { eventId: string; host: string; supplier: string; stranger: string; shop: string; threadId: string };
async function newWorld(): Promise<World> {
  const host = await newUser('Maria');
  const supplier = await newUser('Sol');
  const stranger = await newUser('Xia');
  const shop = (
    await one<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`,
      [supplier, `Shop ${uniq()}`],
    )
  ).v;
  const eventId = (
    await one<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2099-12-12', 'day') RETURNING event_id AS e`,
    )
  ).e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  const threadId = (
    await one<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id AS t`,
      [eventId, shop, host],
    )
  ).t;
  return { eventId, host, supplier, stranger, shop, threadId };
}
async function send(w: World, uid: string, body: string, recipient?: string): Promise<string> {
  return as(uid, async () => {
    const cols = ['thread_id', 'event_id', 'vendor_profile_id', 'body'];
    const vals: unknown[] = [w.threadId, w.eventId, w.shop, body];
    if (recipient) {
      cols.push('recipient_user_id');
      vals.push(recipient);
    }
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING message_id`,
      vals,
    );
    return r.rows[0]!.message_id;
  });
}
const rpc = <T = string>(uid: string, sql: string, args: unknown[]) =>
  as(uid, async () => (await one<{ r: T }>(`SELECT ${sql} AS r`, args)).r);
const openPoll = (w: World, uid: string, q: string, choices: string[]) =>
  rpc(uid, `public.chat_poll_open($1, $2, $3::text[])`, [w.threadId, q, `{${choices.map((c) => `"${c}"`).join(',')}}`]);
const choicesOf = async (poll: string) =>
  (await db.query<{ choice_id: string; label: string }>(`SELECT choice_id, label FROM public.chat_poll_choices WHERE poll_id = $1 ORDER BY position`, [poll])).rows;
const lines = async (w: World) =>
  (await db.query<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role = 'system' ORDER BY created_at`, [w.threadId])).rows.map((r) => r.body);

test('the migration is applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((x) => x.file === FILE), `${FILE} was skipped during replay`);
});

// ── polls ──────────────────────────────────────────────────────────────────

test('ONE OPEN POLL PER THREAD — the RPC refuses a second, the index refuses a direct one, closing makes room', async () => {
  const w = await newWorld();
  const p1 = await openPoll(w, w.host, 'Where is the ceremony?', ['Garden', 'Chapel']);
  assert.ok(p1);
  assert.equal((await choicesOf(p1)).length, 2);
  // The posted card rides its own stream line.
  const line = await one<{ body: string }>(
    `SELECT m.body FROM public.chat_polls p JOIN public.chat_messages m ON m.message_id = p.message_id WHERE p.poll_id = $1`, [p1]);
  assert.equal(line.body, 'Poll · Where is the ceremony?');

  // Either side: the supplier cannot open a second while the host's is open.
  const second = await attempt(w.supplier, () => openPoll(w, w.supplier, 'Morning or afternoon?', ['Morning', 'Afternoon']));
  assert.match(second ?? '', /ONE_OPEN_POLL/);
  // Even a superuser write meets the partial unique index.
  await assert.rejects(
    db.query(`INSERT INTO public.chat_polls (thread_id, question) VALUES ($1, 'Sneaky')`, [w.threadId]),
    /chat_polls_one_open_per_thread|duplicate key/,
  );
  // Closed → a new one may be asked; the closed one cannot be reopened over it.
  assert.equal(await rpc(w.supplier, `public.chat_poll_close($1)`, [p1]), 'ok');
  const p2 = await openPoll(w, w.supplier, 'Morning or afternoon?', ['Morning', 'Afternoon']);
  assert.ok(p2 && p2 !== p1);
  assert.equal(await rpc(w.host, `public.chat_poll_reopen($1)`, [p1]), 'one_open');
  // Another chat is its own: a second thread may hold its own open poll.
  const other = await newWorld();
  assert.ok(await openPoll(other, other.host, 'Cake?', ['Ube', 'Mango']));
});

test('a poll is 2–6 different choices, a question ≤ 120, and no contact details', async () => {
  const w = await newWorld();
  assert.match((await attempt(w.host, () => openPoll(w, w.host, 'Just one?', ['Only']))) ?? '', /BAD_CHOICES/);
  assert.match((await attempt(w.host, () => openPoll(w, w.host, 'Seven?', ['a', 'b', 'c', 'd', 'e', 'f', 'g']))) ?? '', /BAD_CHOICES/);
  assert.match((await attempt(w.host, () => openPoll(w, w.host, 'Same?', ['Garden', 'garden']))) ?? '', /BAD_CHOICES/);
  assert.match((await attempt(w.host, () => openPoll(w, w.host, 'x'.repeat(121), ['a', 'b']))) ?? '', /BAD_QUESTION/);
  assert.match(
    (await attempt(w.host, () => openPoll(w, w.host, 'Which number to call?', ['09171234567', 'Viber me']))) ?? '',
    /CONTACT_BLOCKED/,
  );
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_polls WHERE thread_id = $1`, [w.threadId])).n, 0);
});

test('ONE VOTE PER VOTER — it moves, it is taken back, it never doubles; a closed poll takes none', async () => {
  const w = await newWorld();
  const p = await openPoll(w, w.host, 'Where?', ['Garden', 'Chapel', 'Beach']);
  const [garden, chapel] = await choicesOf(p);
  const votes = async () =>
    (await db.query<{ voter_user_id: string; label: string }>(
      `SELECT v.voter_user_id, c.label FROM public.chat_poll_votes v JOIN public.chat_poll_choices c USING (choice_id) WHERE v.poll_id = $1 ORDER BY c.label`,
      [p],
    )).rows;

  assert.equal(await rpc(w.host, `public.chat_poll_vote($1,$2)`, [p, garden!.choice_id]), 'ok');
  assert.equal(await rpc(w.supplier, `public.chat_poll_vote($1,$2)`, [p, garden!.choice_id]), 'ok');
  assert.equal(await rpc(w.host, `public.chat_poll_vote($1,$2)`, [p, chapel!.choice_id]), 'ok'); // moves
  assert.deepEqual((await votes()).map((v) => v.label), ['Chapel', 'Garden']);
  assert.equal((await votes()).length, 2, 'a moved vote is not a second row');
  // A choice of ANOTHER poll is refused (and the composite FK would refuse it too).
  const other = await newWorld();
  const op = await openPoll(other, other.host, 'Cake?', ['Ube', 'Mango']);
  const ube = (await choicesOf(op))[0]!;
  assert.equal(await rpc(w.host, `public.chat_poll_vote($1,$2)`, [p, ube.choice_id]), 'bad_choice');
  await assert.rejects(
    db.query(`INSERT INTO public.chat_poll_votes (poll_id, voter_user_id, choice_id, thread_id) VALUES ($1,$2,$3,$4)`,
      [p, w.stranger, ube.choice_id, w.threadId]),
    /foreign key/,
  );
  // Take it back.
  assert.equal(await rpc(w.host, `public.chat_poll_vote($1, NULL)`, [p]), 'withdrawn');
  assert.deepEqual((await votes()).map((v) => v.label), ['Garden']);
  // Closed: no vote moves.
  assert.equal(await rpc(w.host, `public.chat_poll_close($1)`, [p]), 'ok');
  assert.equal(await rpc(w.supplier, `public.chat_poll_vote($1,$2)`, [p, chapel!.choice_id]), 'closed');
  assert.deepEqual((await votes()).map((v) => v.label), ['Garden']);
});

test('either side closes, anyone reopens; each change is a chat line', async () => {
  const w = await newWorld();
  const p = await openPoll(w, w.host, 'Where?', ['Garden', 'Chapel']);
  assert.equal(await rpc(w.supplier, `public.chat_poll_close($1)`, [p]), 'ok');
  assert.equal(await rpc(w.host, `public.chat_poll_close($1)`, [p]), 'unchanged');
  assert.equal(await rpc(w.host, `public.chat_poll_reopen($1)`, [p]), 'ok');
  assert.equal(await rpc(w.host, `public.chat_poll_close($1)`, [p]), 'ok');
  assert.deepEqual(await lines(w), ['Poll · Where?', 'Poll closed · Where?', 'Poll reopened · Where?', 'Poll closed · Where?']);
});

test('SAVE AS DECISION — the winner opens a real decision; a tie needs a pick; a saved poll stays settled', async () => {
  const w = await newWorld();
  const p = await openPoll(w, w.host, 'Where?', ['Garden', 'Chapel']);
  const [garden, chapel] = await choicesOf(p);
  // Still open → refused.
  assert.match((await attempt(w.host, () => rpc(w.host, `public.chat_poll_save_as_decision($1)`, [p]))) ?? '', /STILL_OPEN/);
  await rpc(w.host, `public.chat_poll_vote($1,$2)`, [p, garden!.choice_id]);
  await rpc(w.supplier, `public.chat_poll_vote($1,$2)`, [p, chapel!.choice_id]);
  await rpc(w.supplier, `public.chat_poll_close($1)`, [p]);
  // 1–1 → a tie: no pick refused, a loser can never be picked, a tied one can.
  assert.match((await attempt(w.host, () => rpc(w.host, `public.chat_poll_save_as_decision($1)`, [p]))) ?? '', /TIE/);
  const topic = await rpc(w.supplier, `public.chat_poll_save_as_decision($1,$2)`, [p, chapel!.choice_id]);
  const t = await one<{ title: string; closed_at: string | null }>(`SELECT title, closed_at FROM public.chat_decision_topics WHERE topic_id = $1`, [topic]);
  assert.deepEqual(t, { title: 'Chapel', closed_at: null });
  assert.equal((await one<{ s: string }>(`SELECT saved_decision_id::text AS s FROM public.chat_polls WHERE poll_id = $1`, [p])).s, topic);
  assert.ok((await lines(w)).includes('Decision opened · Chapel'));
  assert.match((await attempt(w.host, () => rpc(w.host, `public.chat_poll_save_as_decision($1)`, [p]))) ?? '', /ALREADY_SAVED/);
  assert.equal(await rpc(w.host, `public.chat_poll_reopen($1)`, [p]), 'saved');

  // A clear winner needs no pick; a loser is never saved.
  const w2 = await newWorld();
  const p2 = await openPoll(w2, w2.host, 'Cake?', ['Ube', 'Mango']);
  const [ube, mango] = await choicesOf(p2);
  await rpc(w2.host, `public.chat_poll_vote($1,$2)`, [p2, ube!.choice_id]);
  await rpc(w2.supplier, `public.chat_poll_vote($1,$2)`, [p2, ube!.choice_id]);
  await rpc(w2.host, `public.chat_poll_close($1)`, [p2]);
  assert.match((await attempt(w2.host, () => rpc(w2.host, `public.chat_poll_save_as_decision($1,$2)`, [p2, mango!.choice_id]))) ?? '', /BAD_CHOICE/);
  const t2 = await rpc(w2.host, `public.chat_poll_save_as_decision($1)`, [p2]);
  assert.equal((await one<{ title: string }>(`SELECT title FROM public.chat_decision_topics WHERE topic_id = $1`, [t2])).title, 'Ube');
});

test('a stranger is refused on BOTH sides: no read, no write; no poll table takes a direct write', async () => {
  const w = await newWorld();
  const p = await openPoll(w, w.host, 'Where?', ['Garden', 'Chapel']);
  const garden = (await choicesOf(p))[0]!;
  await rpc(w.supplier, `public.chat_poll_vote($1,$2)`, [p, garden.choice_id]);

  const count = (uid: string, table: string) =>
    as(uid, async () => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.${table} WHERE thread_id = $1`, [w.threadId])).n);
  for (const table of ['chat_polls', 'chat_poll_choices', 'chat_poll_votes']) {
    assert.ok((await count(w.host, table)) > 0, `the host reads ${table}`);
    assert.ok((await count(w.supplier, table)) > 0, `the supplier reads ${table}`);
    assert.equal(await count(w.stranger, table), 0, `a stranger reads no ${table}`);
  }
  assert.match((await attempt(w.stranger, () => openPoll(w, w.stranger, 'Mine?', ['a', 'b']))) ?? '', /NOT_IN_THIS_CHAT/);
  assert.equal(await rpc(w.stranger, `public.chat_poll_vote($1,$2)`, [p, garden.choice_id]), 'not_found');
  assert.equal(await rpc(w.stranger, `public.chat_poll_close($1)`, [p]), 'not_found');
  assert.match((await attempt(w.stranger, () => rpc(w.stranger, `public.chat_poll_save_as_decision($1)`, [p]))) ?? '', /NOT_IN_THIS_CHAT/);

  // Direct writes, as members: refused (no grant).
  for (const sql of [
    [`INSERT INTO public.chat_polls (thread_id, question) VALUES ($1, 'x')`, [w.threadId]],
    [`UPDATE public.chat_polls SET closed_at = NOW() WHERE poll_id = $1`, [p]],
    [`INSERT INTO public.chat_poll_votes (poll_id, voter_user_id, choice_id, thread_id) VALUES ($1,$2,$3,$4)`, [p, w.host, garden.choice_id, w.threadId]],
    [`DELETE FROM public.chat_poll_votes WHERE poll_id = $1`, [p]],
    [`UPDATE public.chat_poll_choices SET label = 'x' WHERE poll_id = $1`, [p]],
  ] as const) {
    const err = await attempt(w.host, () => db.query(sql[0], [...sql[1]]));
    assert.match(err ?? '', /permission denied/, sql[0]);
  }
});

// ── decisions: file / move / remove / rename ────────────────────────────────

test('FILE · MOVE · REMOVE — a message under at most one open topic, never a private line, strangers refused', async () => {
  const w = await newWorld();
  const venue = await rpc(w.host, `public.chat_decision_open($1, 'Venue')`, [w.threadId]);
  const menu = await rpc(w.supplier, `public.chat_decision_open($1, 'Menu')`, [w.threadId]);
  const m1 = await send(w, w.host, 'How about the garden?');
  const priv = await send(w, w.host, 'Just between us', w.supplier);
  const filed = async (topic: string) =>
    (await db.query<{ message_id: string }>(`SELECT message_id FROM public.chat_decision_messages WHERE topic_id = $1`, [topic])).rows.map((r) => r.message_id);

  assert.equal(await rpc(w.supplier, `public.chat_decision_file_message($1,$2)`, [venue, m1]), 'ok');
  assert.equal(await rpc(w.host, `public.chat_decision_file_message($1,$2)`, [venue, m1]), 'already');
  assert.equal(await rpc(w.host, `public.chat_decision_file_message($1,$2)`, [menu, m1]), 'filed_elsewhere');
  assert.equal(await rpc(w.host, `public.chat_decision_file_message($1,$2)`, [venue, priv]), 'private');
  assert.equal(await rpc(w.stranger, `public.chat_decision_file_message($1,$2)`, [venue, m1]), 'not_found');
  // Who filed it is stamped.
  assert.equal((await one<{ a: string }>(`SELECT added_by_user_id::text AS a FROM public.chat_decision_messages WHERE topic_id = $1`, [venue])).a, w.supplier);

  // A message of ANOTHER chat cannot be filed here.
  const w2 = await newWorld();
  const foreign = await send(w2, w2.host, 'elsewhere');
  assert.equal(await rpc(w.host, `public.chat_decision_file_message($1,$2)`, [venue, foreign]), 'not_found');

  // Move.
  assert.equal(await rpc(w.host, `public.chat_decision_move_message($1,$2,$3)`, [m1, venue, menu]), 'ok');
  assert.deepEqual(await filed(venue), []);
  assert.deepEqual(await filed(menu), [m1]);
  assert.equal(await rpc(w.host, `public.chat_decision_move_message($1,$2,$3)`, [m1, venue, menu]), 'not_filed');
  assert.equal(await rpc(w.host, `public.chat_decision_move_message($1,$2,$3)`, [m1, menu, menu]), 'same');
  assert.equal(await rpc(w.stranger, `public.chat_decision_move_message($1,$2,$3)`, [m1, menu, venue]), 'not_found');

  // A closed topic takes no new filing, and a message in a closed topic may be filed under an open one.
  await rpc(w.host, `public.chat_decision_set_closed($1, true)`, [menu]);
  assert.equal(await rpc(w.host, `public.chat_decision_file_message($1,$2)`, [menu, await send(w, w.host, 'late')]), 'closed');
  assert.equal(await rpc(w.host, `public.chat_decision_file_message($1,$2)`, [venue, m1]), 'ok');

  // Remove (swipe left) — and Undo is filing it again.
  assert.equal(await rpc(w.stranger, `public.chat_decision_remove_message($1,$2)`, [venue, m1]), 'not_found');
  assert.equal(await rpc(w.supplier, `public.chat_decision_remove_message($1,$2)`, [venue, m1]), 'ok');
  assert.equal(await rpc(w.supplier, `public.chat_decision_remove_message($1,$2)`, [venue, m1]), 'not_filed');
  assert.equal(await rpc(w.host, `public.chat_decision_file_message($1,$2)`, [venue, m1]), 'ok');

  // RLS both sides: members read the filings, a stranger reads none; no direct write.
  const seen = (uid: string) =>
    as(uid, async () => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_decision_messages WHERE thread_id = $1`, [w.threadId])).n);
  assert.ok((await seen(w.host)) > 0);
  assert.ok((await seen(w.supplier)) > 0);
  assert.equal(await seen(w.stranger), 0);
  const direct = await attempt(w.host, () =>
    db.query(`INSERT INTO public.chat_decision_messages (topic_id, message_id, thread_id) VALUES ($1,$2,$3)`, [menu, m1, w.threadId]));
  assert.match(direct ?? '', /permission denied/);
});

test('RENAME — Edit topic saves in place on an open topic, one chat line; empty, closed and strangers refused', async () => {
  const w = await newWorld();
  const t = await rpc(w.host, `public.chat_decision_open($1, 'Venue')`, [w.threadId]);
  assert.equal(await rpc(w.supplier, `public.chat_decision_rename($1, $2)`, [t, '  Ceremony venue  ']), 'ok');
  assert.equal((await one<{ title: string }>(`SELECT title FROM public.chat_decision_topics WHERE topic_id = $1`, [t])).title, 'Ceremony venue');
  assert.equal(await rpc(w.host, `public.chat_decision_rename($1, $2)`, [t, 'Ceremony venue']), 'unchanged');
  assert.equal(await rpc(w.host, `public.chat_decision_rename($1, $2)`, [t, '   ']), 'empty');
  assert.equal(await rpc(w.stranger, `public.chat_decision_rename($1, $2)`, [t, 'Mine']), 'not_found');
  assert.equal(await rpc(w.host, `public.chat_decision_rename($1, $2)`, [t, 'y'.repeat(200)]), 'ok');
  assert.equal((await one<{ n: number }>(`SELECT char_length(title)::int AS n FROM public.chat_decision_topics WHERE topic_id = $1`, [t])).n, 120);
  await rpc(w.host, `public.chat_decision_set_closed($1, true)`, [t]);
  assert.equal(await rpc(w.host, `public.chat_decision_rename($1, $2)`, [t, 'After']), 'closed');
  assert.ok((await lines(w)).includes('Decision renamed · Ceremony venue'));
});
