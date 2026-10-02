/**
 * 🎟 ONE QR FOR EVERYONE LETS A SIGNED-IN GUEST IN — against the replayed
 * migrations (owner, DECISION_LOG 2026-09-30 "THE RSVP IS OPTIONAL — AND AN
 * EVENT CAN RUN ON ONE QR FOR EVERYONE": "anyone who attends scans it, signs in
 * … and the event is added to their account as a guest; no reply, no approval
 * unless the host picks 'I approve each one'").
 *
 * `public.join_open_event_as_guest` (migration 20271259992581) is what the join
 * door (`joinEventAction`) calls. Pinned here, where a source grep cannot see:
 *
 *   1. OPEN (guestsReply false · whoCanRsvp anyone) → ONE guest row + ONE
 *      `event_members` row, member_type 'guest', role 'guest' — never a host;
 *   2. "I APPROVE EACH ONE" (approveEach true) → nothing written, 'needs_approval';
 *      so are "Only people on my list", "Anyone, I approve" (guests reply) and
 *      "Personal QR for each guest";
 *   3. A FINALIZED LIST still refuses ('locked', nothing written) — the lock
 *      trigger exempts service_role, so the function must check it itself;
 *   4. asking twice is ONE membership ('member'); a host is never re-added;
 *   5. `authenticated` cannot call it (it would be the client self-join that
 *      20271014300000 closed); service_role can.
 *
 * SABOTAGE (run 2026-10-02 while writing this): deleting the
 * `IF v_locked IS NOT NULL` block turns test 3 red; dropping the approveEach
 * line of the gate turns test 2 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}

async function seedUser(first: string | null, last: string | null): Promise<string> {
  const email = `oneqr${seq++}@t.invalid`;
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = a.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, email]);
  await db.query(`UPDATE public.users SET first_name = $2, last_name = $3 WHERE user_id = $1`, [id, first, last]);
  return id;
}

async function seedEvent(config: Record<string, unknown> | null): Promise<string> {
  const { rows } = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, slug, rsvp_ask_config)
     VALUES ('One QR party', 'birthday', '2027-06-06', $1, $2::jsonb) RETURNING event_id`,
    [`one-qr-${seq++}`, config === null ? null : JSON.stringify(config)],
  );
  return rows[0]!.event_id;
}

/** The join door's call — as the server action's service-role client makes it. */
async function join(eventId: string, userId: string): Promise<{ outcome: string; guest_id?: string; member_type?: string }> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    const { rows } = await db.query<{ r: { outcome: string; guest_id?: string; member_type?: string } }>(
      `SELECT public.join_open_event_as_guest($1, $2) AS r`,
      [eventId, userId],
    );
    return rows[0]!.r;
  } finally {
    await reset();
  }
}

async function counts(eventId: string, userId: string): Promise<{ guests: number; members: number }> {
  const g = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.guests WHERE event_id = $1 AND deleted_at IS NULL`,
    [eventId],
  );
  const m = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId],
  );
  return { guests: g.rows[0]!.n, members: m.rows[0]!.n };
}

const OPEN = { guestsReply: false, whoCanRsvp: 'anyone' };

test('1 · open one QR: the signed-in person is added to THIS event as a guest — never a host', async () => {
  const eventId = await seedEvent(OPEN);
  const otherEvent = await seedEvent(OPEN);
  const user = await seedUser('Lia', 'Santos');

  const r = await join(eventId, user);
  assert.equal(r.outcome, 'joined');
  assert.ok(r.guest_id);

  const { rows } = await db.query<{ member_type: string; role: string; joined_via: string; guest_id: string }>(
    `SELECT member_type, role, joined_via::text, guest_id FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, user],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.member_type, 'guest');
  assert.equal(rows[0]!.role, 'guest');
  assert.equal(rows[0]!.joined_via, 'qr_scan');
  assert.equal(rows[0]!.guest_id, r.guest_id);

  const g = await db.query<{ first_name: string; last_name: string; role: string; entry_source: string }>(
    `SELECT first_name, last_name, role, entry_source::text FROM public.guests WHERE guest_id = $1`,
    [r.guest_id],
  );
  assert.deepEqual(g.rows[0], { first_name: 'Lia', last_name: 'Santos', role: 'guest', entry_source: 'host_seeded' });

  // Only THIS event — the other open event knows nothing of them.
  assert.deepEqual(await counts(otherEvent, user), { guests: 0, members: 0 });
});

test('1b · a one-word account name keeps the missing-surname mark', async () => {
  const eventId = await seedEvent(OPEN);
  const user = await seedUser('Bongbong', null);
  const r = await join(eventId, user);
  assert.equal(r.outcome, 'joined');
  const g = await db.query<{ first_name: string; last_name: string }>(
    `SELECT first_name, last_name FROM public.guests WHERE guest_id = $1`,
    [r.guest_id],
  );
  assert.deepEqual(g.rows[0], { first_name: 'Bongbong', last_name: '—' });
});

test('2 · "I approve each one" — and every non-open choice — writes nothing', async () => {
  const cases: Array<[string, Record<string, unknown> | null]> = [
    ['I approve each one', { ...OPEN, approveEach: true }],
    ['Only people on my list (default)', null],
    ['Anyone, I approve (guests reply)', { whoCanRsvp: 'anyone' }],
    ['Personal QR for each guest', { guestsReply: false, whoCanRsvp: 'guest_list' }],
    ['a string "false" is not false', { guestsReply: 'false', whoCanRsvp: 'anyone' }],
  ];
  for (const [name, cfg] of cases) {
    const eventId = await seedEvent(cfg);
    const user = await seedUser('Ana', 'Reyes');
    const r = await join(eventId, user);
    assert.equal(r.outcome, 'needs_approval', name);
    assert.deepEqual(await counts(eventId, user), { guests: 0, members: 0 }, name);
  }
  // …and approveEach false is still open.
  const open = await seedEvent({ ...OPEN, approveEach: false });
  const u = await seedUser('Ben', 'Cruz');
  assert.equal((await join(open, u)).outcome, 'joined');
});

test('3 · a finalized guest list still refuses — nothing written', async () => {
  const eventId = await seedEvent(OPEN);
  await setRole('service_role');
  await db.query(`UPDATE public.events SET guest_count_locked_at = now() WHERE event_id = $1`, [eventId]);
  await reset();
  const locked = await db.query<{ l: string | null }>(`SELECT guest_count_locked_at AS l FROM public.events WHERE event_id = $1`, [eventId]);
  assert.ok(locked.rows[0]!.l, 'the fixture did not finalize the list — this test would pass vacuously');

  const user = await seedUser('Cara', 'Diaz');
  const r = await join(eventId, user);
  assert.equal(r.outcome, 'locked');
  assert.deepEqual(await counts(eventId, user), { guests: 0, members: 0 });
});

test('4 · asking twice is one membership; a host is never re-added', async () => {
  const eventId = await seedEvent(OPEN);
  const user = await seedUser('Dina', 'Lopez');
  const first = await join(eventId, user);
  const again = await join(eventId, user);
  assert.equal(first.outcome, 'joined');
  assert.equal(again.outcome, 'member');
  assert.equal(again.guest_id, first.guest_id);
  assert.deepEqual(await counts(eventId, user), { guests: 1, members: 1 });

  const host = await seedUser('Hosting', 'Person');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, host]);
  const h = await join(eventId, host);
  assert.equal(h.outcome, 'member');
  assert.equal(h.member_type, 'couple');
  const rows = await db.query<{ member_type: string }>(
    `SELECT member_type FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, host],
  );
  assert.deepEqual(rows.rows.map((r) => r.member_type), ['couple']);
});

test('5 · a signed-in client cannot call it — only the server (service_role) can', async () => {
  const eventId = await seedEvent(OPEN);
  const user = await seedUser('Eli', 'Ramos');
  await setAuthUid(db, user);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  let refused = false;
  try {
    await db.query(`SELECT public.join_open_event_as_guest($1, $2)`, [eventId, user]);
  } catch {
    refused = true;
  } finally {
    await reset();
  }
  assert.equal(refused, true, 'an authenticated session can mint its own membership again');
  assert.deepEqual(await counts(eventId, user), { guests: 0, members: 0 });
});
