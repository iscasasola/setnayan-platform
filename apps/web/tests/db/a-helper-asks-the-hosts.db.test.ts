/**
 * 🪪 ASK THE HOSTS (migrations 20271299515167 + 20271299854365), asserted against the REPLAYED schema, every call
 * through a real `authenticated` session — the same door the helper's Send calls (`ask-the-hosts.tsx`).
 *
 * Owner 2026-10-31: *"yes"* to building "Ask the hosts" (DECISION_LOG "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW
 * OF HOME ⚙ EVENT SETTINGS — read-only, with 'Ask the hosts'"); and the standing "no new emails without his word".
 *
 *   1 · a LIMITED helper's ask notifies EVERY host — one in-app `access_more_asked` notice each, linked to People with
 *       access landed on that helper's seat — and nobody else (not the helper, not a guest); a coordinator may ask too;
 *   2 · a second ask the same day for the SAME part is refused ('already_asked') and writes nothing; another part is not
 *       refused; a day later the same part may be asked again;
 *   3 · a non-member cannot ask — a stranger, a guest, a host of another event, a seat not yet accepted, a removed
 *       seat — and a signed-out caller cannot even call it; a part the hosts cannot set is refused;
 *   4 · no email is queued: nothing reaches `email_deliveries`, and the notice is never written for anyone off-event.
 *
 * 🛡 Sabotage (run 2026-10-31, restored → green): the once-a-day check switched off (`IF FALSE AND v_last IS NOT NULL`)
 *    → test 2 red ("already_asked" expected, got "ok"); the seat check widened to any seat (`accepted_at IS NOT NULL`
 *    dropped) → test 3 red (the invited-but-not-accepted seat was let in).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let emailsAtStart = 0;

const W = {
  eventId: '',
  otherEventId: '',
  creator: '',
  cohost: '',
  helper: '',
  helperSeat: '',
  coordinator: '',
  invited: '',
  removed: '',
  guest: '',
  stranger: '',
};

const NARROW = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false };
const ALL_VIEW = {
  guest_list: 'view', seat_plan: 'view', schedule: 'view', vendors: 'view',
  invitations: 'view', mood_board: 'view', budget: 'view', photos: 'view',
};

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
type Ask = { status: string; asked_at?: string; hosts?: number };
async function ask(uid: string | null, area: string, note: string | null = null, eventId = W.eventId): Promise<{ r: Ask | null; error: string | null }> {
  if (uid) await asUser(uid);
  else await db.exec(`SET ROLE anon`);
  try {
    const res = await db.query<{ r: Ask }>(`SELECT public.ask_hosts_for_more_access($1, $2, $3) AS r`, [eventId, area, note]);
    return { r: res.rows[0]!.r, error: null };
  } catch (e) {
    return { r: null, error: (e as Error).message };
  } finally {
    await reset();
  }
}
async function newUser(email: string, name: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = r.rows[0]!.id;
  await db.query(`UPDATE public.users SET display_name = $2 WHERE user_id = $1`, [id, name]);
  return id;
}
async function seat(uid: string, role: string, perms: unknown, opts: { accepted?: boolean; removed?: boolean } = {}): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at, removed_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, CASE WHEN $6 THEN now() END, CASE WHEN $7 THEN now() END) RETURNING moderator_id`,
    [W.eventId, role, JSON.stringify(perms), W.creator, uid, opts.accepted ?? true, opts.removed ?? false],
  );
  return r.rows[0]!.moderator_id;
}
async function asks(): Promise<Array<{ user_id: string; title: string; body: string; related_url: string; event_id: string }>> {
  const r = await db.query<{ user_id: string; title: string; body: string; related_url: string; event_id: string }>(
    `SELECT user_id, title, body, related_url, event_id FROM public.notifications WHERE type = 'access_more_asked' ORDER BY created_at, user_id`,
  );
  return r.rows;
}
async function emails(): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.email_deliveries`);
  return r.rows[0]!.n;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.creator = await newUser('ath-creator@ask-the-hosts.test', 'Claire');
  W.cohost = await newUser('ath-cohost@ask-the-hosts.test', 'Ice');
  W.helper = await newUser('ath-helper@ask-the-hosts.test', 'Tita Lorna');
  W.coordinator = await newUser('ath-coordinator@ask-the-hosts.test', 'Ana');
  W.invited = await newUser('ath-invited@ask-the-hosts.test', 'Ina');
  W.removed = await newUser('ath-removed@ask-the-hosts.test', 'Rex');
  W.guest = await newUser('ath-guest@ask-the-hosts.test', 'Gina');
  W.stranger = await newUser('ath-stranger@ask-the-hosts.test', 'Sam');

  W.eventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Ask The Hosts', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;
  W.otherEventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Another Event', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;

  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`, [W.eventId, W.creator]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.eventId, W.cohost]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [W.eventId, W.guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.otherEventId, W.stranger]);

  // A LIMITED helper (every part View — the grant setGuestAccess writes), the hired coordinator, a seat invited but
  // not yet accepted, and a seat the hosts removed.
  W.helperSeat = await seat(W.helper, 'viewer', { ...NARROW, areas: { ...ALL_VIEW } });
  await seat(W.coordinator, 'wedding_planner_external', { ...NARROW, areas: { ...ALL_VIEW, guest_list: 'edit' }, access_level: 'limited' });
  await seat(W.invited, 'viewer', { ...NARROW, areas: { ...ALL_VIEW } }, { accepted: false });
  await seat(W.removed, 'viewer', { ...NARROW, areas: { ...ALL_VIEW } }, { removed: true });
  emailsAtStart = await emails();
});

after(async () => {
  await replay?.db.close();
});

test('1 · a limited helper’s ask reaches EVERY host, in the app, landed on their own row — and nobody else', async () => {
  const emailsBefore = await emails();
  const { r, error } = await ask(W.helper, 'seat_plan', '  I’m doing the seats with Claire  ');
  assert.equal(error, null, `the helper could not ask: ${error}`);
  assert.equal(r?.status, 'ok', `a limited helper was refused: ${JSON.stringify(r)}`);
  assert.equal(r?.hosts, 2, 'not every host was told');

  const rows = await asks();
  assert.deepEqual(rows.map((n) => n.user_id).sort(), [W.creator, W.cohost].sort(), 'the ask reached someone who is not a host, or missed a host');
  for (const n of rows) {
    assert.equal(n.event_id, W.eventId);
    assert.equal(n.related_url, `/dashboard/${W.eventId}?settings=1&row=access&person=${W.helperSeat}&part=seat_plan`, 'the notice does not open People with access on that helper');
    assert.equal(n.title, 'Helper Tita Lorna asks for more access · Seat plan');
    assert.match(n.body, /^“I’m doing the seats with Claire” — /, 'the helper’s own words are not carried (trimmed)');
  }
  assert.equal(await emails(), emailsBefore, 'an ask queued an email');

  // The hired coordinator may ask too, named as the hosts name them.
  const c = await ask(W.coordinator, 'budget');
  assert.equal(c.r?.status, 'ok', `the coordinator was refused: ${JSON.stringify(c)}`);
  const coordinatorRows = (await asks()).filter((n) => n.related_url.endsWith('&part=budget'));
  assert.equal(coordinatorRows.length, 2);
  assert.equal(coordinatorRows[0]!.title, 'Coordinator Ana asks for more access · Budget & payments');
  assert.equal(coordinatorRows[0]!.body, 'Open People with access to change what they can open.', 'an ask with no words invents some');
});

test('2 · one ask per helper per part a day — a second is refused and writes nothing; another part is not', async () => {
  const before = (await asks()).length;
  const again = await ask(W.helper, 'seat_plan', 'please?');
  assert.equal(again.error, null);
  assert.equal(again.r?.status, 'already_asked', `a second ask the same day went through: ${JSON.stringify(again.r)}`);
  assert.ok(again.r?.asked_at, 'the refusal does not say when they asked');
  assert.equal((await asks()).length, before, 'a refused ask still wrote a notice');

  const other = await ask(W.helper, 'guest_list');
  assert.equal(other.r?.status, 'ok', 'a different part was refused as if it were the same one');
  assert.equal((await asks()).length, before + 2);

  // A day later the same part may be asked again.
  await db.query(
    `UPDATE public.notifications SET created_at = created_at - interval '25 hours' WHERE type = 'access_more_asked' AND related_url LIKE '%&part=seat_plan'`,
  );
  const tomorrow = await ask(W.helper, 'seat_plan');
  assert.equal(tomorrow.r?.status, 'ok', 'the once-a-day rule never lets the part be asked again');
});

test('3 · a non-member cannot ask — nor a guest, another event’s host, an unaccepted or removed seat, or a signed-out caller', async () => {
  const before = (await asks()).length;
  for (const [who, uid] of [
    ['a stranger (a host of another event)', W.stranger],
    ['a guest of this event', W.guest],
    ['a seat invited but not accepted', W.invited],
    ['a removed seat', W.removed],
  ] as const) {
    const res = await ask(uid, 'schedule');
    assert.equal(res.error, null, `${who}: ${res.error}`);
    assert.equal(res.r?.status, 'not_a_helper', `${who} could ask the hosts: ${JSON.stringify(res.r)}`);
  }
  // A helper of THIS event asking on ANOTHER event is a stranger there.
  assert.equal((await ask(W.helper, 'schedule', null, W.otherEventId)).r?.status, 'not_a_helper', 'a helper could ask another event’s hosts');
  // A host has nothing to ask for here — they hold no seat.
  assert.equal((await ask(W.creator, 'schedule')).r?.status, 'not_a_helper');
  // Event Hub has no setting a host could raise; an unknown word is no part.
  assert.equal((await ask(W.helper, 'invitations')).r?.status, 'bad_part');
  assert.equal((await ask(W.helper, 'everything')).r?.status, 'bad_part');
  // Signed out: the door is not even callable.
  const anon = await ask(null, 'schedule');
  assert.match(anon.error ?? '', /permission denied/i, 'a signed-out caller could call the door');
  assert.equal((await asks()).length, before, 'a refused ask wrote a notice');
});

test('4 · no email is ever queued, and no notice lands off the event', async () => {
  assert.equal(await emails(), emailsAtStart, 'an ask queued an email');
  const off = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.notifications WHERE type = 'access_more_asked' AND (event_id IS DISTINCT FROM $1 OR user_id NOT IN ($2, $3))`,
    [W.eventId, W.creator, W.cohost],
  );
  assert.equal(off.rows[0]!.n, 0, 'an ask reached someone who is not this event’s host');
});
