/**
 * WHO A CHAT MESSAGE IS FROM — decided by the database, never by the browser.
 *
 * ── WHAT WAS POSSIBLE ──────────────────────────────────────────────────────
 * Measured against this exact replay before migration 20271132839561: a couple
 * signed into their OWN account, with nothing but their session and the public
 * anon key, inserted three messages into their supplier thread stamped
 * `sender_role = 'vendor'` (carrying the vendor's real uid and is_bot=true),
 * `'system'` (Setnayan appearing to speak), and `'coordinator'`. All three were
 * ACCEPTED — on a thread the vendor had not yet accepted. The supplier could
 * delete none of them: chat_messages is the immutable evidence layer and has no
 * UPDATE and no DELETE policy (see chat-immutable-archive.db.test.ts).
 *
 * Forging the 'vendor' one also fired all three AFTER INSERT triggers, so
 * vendor_profiles.name_revealed_at and .real_name_unlocked_at were both
 * stamped: the couple unmasked the supplier's real personal name to themselves
 * before that supplier had said a word.
 *
 * ── WHY RLS DID NOT COVER IT ───────────────────────────────────────────────
 * chat_messages_member_insert asks WHICH CONVERSATION the row belongs to, and
 * the couple genuinely belongs to it. It says nothing about WHO the row claims
 * to be from. Correct stamping lived only in lib/chat-send.ts, and
 * lib/supabase/client.ts ships a browser client — so the app layer was one
 * fetch() away from being skipped.
 *
 * ── THE TWO HALVES, EACH PROVEN SEPARATELY BELOW ───────────────────────────
 *   1. GRANT   — `authenticated` may no longer name sender_role,
 *                sender_user_id, is_bot or created_at at all.
 *   2. TRIGGER — tg_chat_messages_derive_sender fills the sender in from
 *                auth.uid() before the row lands.
 * The NEUTRALISATION tests re-open each half in a rolled-back transaction and
 * show the outcome changes. A guard nobody has watched fail is not a guard.
 *
 * ── ON THE THREE AFTER TRIGGERS ────────────────────────────────────────────
 * They still branch on the stored sender_role and are deliberately unchanged.
 * That value is now derived rather than supplied, so what they trust is
 * trustworthy — and fixing it at the one place it is WRITTEN survives the
 * fourth reader somebody adds later. The tests below assert the end state that
 * actually matters: a couple can no longer cause a reveal, and a real vendor
 * reply still can.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** Columns the browser must not be able to decide. */
const SENDER_COLUMNS = ['sender_role', 'sender_user_id'] as const;
/** Same defect, different hat: who authored it, and when it happened. */
const PROVENANCE_COLUMNS = [...SENDER_COLUMNS, 'is_bot', 'created_at'] as const;
/** Columns a legitimate send must still be able to write. */
const CALLER_COLUMNS = ['thread_id', 'event_id', 'vendor_profile_id', 'body'] as const;
/** The AFTER INSERT triggers that act on the stored role. */
const ROLE_READING_TRIGGERS = [
  'reveal_vendor_name_on_chat',
  'chat_messages_unlock_vendor_name',
  'on_vendor_first_reply',
] as const;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asService(): Promise<void> {
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}
/**
 * Defensive on purpose. Several tests below deliberately provoke a refusal
 * INSIDE an explicit transaction, which leaves the block aborted — and in that
 * state every statement, including the set_config() calls here, errors with
 * 25P02. An un-tolerant reset() throws before the enclosing `finally` can
 * ROLLBACK, and the whole remaining file dies on a cascade that has nothing to
 * do with what is being asserted.
 */
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}

/** ROLLBACK first — an aborted block refuses everything else until it ends. */
async function rollbackAndReset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await reset();
}

async function canInsertColumn(role: string, column: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege($1, 'public.chat_messages', $2, 'INSERT') AS ok`,
    [role, column],
  );
  return r.rows[0]!.ok;
}

/** Run `fn` as `uid`, returning the error message or null if it was allowed. */
async function attempt(uid: string, sql: string, params: unknown[]): Promise<string | null> {
  await asUser(uid);
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

const F = {
  couple: '',
  vendorUser: '',
  outsider: '',
  vendorId: '',
  eventId: '',
  threadId: '',
};

async function createUser(email: string, accountType: 'customer' | 'vendor') {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('forge-couple@chat.test', 'customer');
  F.vendorUser = await createUser('forge-vendor@chat.test', 'vendor');
  F.outsider = await createUser('forge-outsider@chat.test', 'customer');

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Forgery Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.vendorUser],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Forgery Test Event', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );

  // PENDING on purpose — the vendor has not accepted and has never replied, so
  // any name reveal observed below can only have come from a forged row.
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'pending') RETURNING thread_id`,
    [F.eventId, F.vendorId, F.couple],
  );
  F.threadId = th.rows[0]!.thread_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the table, the sender columns and the four roles all still exist', async () => {
  // Without this, "the forgery is refused" would also be true of a table that
  // had been renamed, or a column that no longer exists to forge.
  const cols = await db.query<{ attname: string; attnotnull: boolean }>(
    `SELECT a.attname, a.attnotnull FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relname = 'chat_messages' AND a.attnum > 0 AND NOT a.attisdropped`,
  );
  assert.ok(cols.rows.length > 0, 'public.chat_messages is missing from the replay');
  const present = new Set(cols.rows.map((r) => r.attname));
  for (const c of [...PROVENANCE_COLUMNS, ...CALLER_COLUMNS]) {
    assert.ok(present.has(c), `chat_messages.${c} is gone — re-decide this test, do not inherit it`);
  }
  assert.equal(
    cols.rows.find((r) => r.attname === 'sender_role')!.attnotnull,
    true,
    'sender_role stopped being NOT NULL. The trigger is what satisfies it now; if the column ' +
      'became nullable, a row with no sender at all can land and this suite no longer covers that.',
  );

  const roles = await db.query<{ enumlabel: string }>(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'chat_sender_role' ORDER BY e.enumsortorder`,
  );
  const labels = roles.rows.map((r) => r.enumlabel).sort();
  assert.deepEqual(
    labels,
    ['coordinator', 'couple', 'system', 'vendor'],
    'chat_sender_role changed shape. Every added value is a new costume an attacker could ' +
      'have worn; add it to the forgery loop below rather than leaving it untested.',
  );
});

test('META: the three AFTER triggers that read sender_role are still wired', async () => {
  // The whole reason the sender must not be forgeable. If these ever go away,
  // this suite is guarding a value nothing consumes and should be re-argued.
  const r = await db.query<{ tgname: string }>(
    `SELECT t.tgname FROM pg_trigger t
      WHERE t.tgrelid = 'public.chat_messages'::regclass AND NOT t.tgisinternal`,
  );
  const present = new Set(r.rows.map((x) => x.tgname));
  const missing = ROLE_READING_TRIGGERS.filter((t) => !present.has(t));
  assert.deepEqual(
    missing,
    [],
    `${missing.join(', ')} no longer exists. These are the triggers that unmask a vendor's real ` +
      `name off the stored role — if they are gone, re-decide what this test protects.`,
  );
  assert.ok(
    present.has('chat_messages_derive_sender'),
    'the BEFORE INSERT derivation trigger is missing — half the fix did not replay',
  );

  // ...and it must be BEFORE, or it cannot correct the row the AFTER triggers read.
  const timing = await db.query<{ is_before: boolean }>(
    `SELECT (t.tgtype & 2) = 2 AS is_before FROM pg_trigger t
      WHERE t.tgrelid = 'public.chat_messages'::regclass AND t.tgname = 'chat_messages_derive_sender'`,
  );
  assert.equal(
    timing.rows[0]!.is_before,
    true,
    'chat_messages_derive_sender is not a BEFORE trigger. An AFTER trigger cannot change the ' +
      'row, so the forged value would still be what lands and what the reveal triggers read.',
  );
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  // Two vacuous DB tests have shipped in this repo because the connection owned
  // the table and skipped RLS. Assert the probe is a real unprivileged session.
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me,
            pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relname = 'chat_messages'`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated', 'SET ROLE did not take');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table — it would bypass RLS');
  assert.equal(r.rows[0]!.bypass, false, 'the probing role has BYPASSRLS');
});

test('META: service_role keeps INSERT on every column — this is a narrowing, not a demolition', async () => {
  // Every system notice, Auto-Reply Assistant message and demo seed is written
  // with the service key and MUST still be able to state its own sender.
  const denied: string[] = [];
  for (const c of PROVENANCE_COLUMNS) {
    if (!(await canInsertColumn('service_role', c))) denied.push(c);
  }
  assert.deepEqual(
    denied,
    [],
    `service_role lost INSERT on ${denied.join(', ')}. lib/chat-actions.ts posts 'system' rows and ` +
      `vendor-autoreply posts is_bot rows through that key; revoking there breaks them instead of ` +
      `protecting anyone.`,
  );
});

/* ── 1 · THE CLOSURE (half one: the grant) ─────────────────────────────────── */

test('authenticated and anon hold NO INSERT on the provenance columns', async () => {
  const open: string[] = [];
  for (const role of ['anon', 'authenticated']) {
    for (const c of PROVENANCE_COLUMNS) {
      if (await canInsertColumn(role, c)) open.push(`${role}.${c}`);
    }
  }
  assert.deepEqual(
    open,
    [],
    `${open.join(', ')} is writable by the browser. has_column_privilege folds table-level grants ` +
      `in, so a table-wide GRANT INSERT re-opens these even with no column grant in sight.`,
  );
});

test('authenticated CAN still write the columns a real message needs', async () => {
  // The other direction. A revoke that took the whole table with it would pass
  // every test above and break messaging outright.
  const denied: string[] = [];
  for (const c of CALLER_COLUMNS) {
    if (!(await canInsertColumn('authenticated', c))) denied.push(c);
  }
  assert.deepEqual(denied, [], `authenticated cannot write ${denied.join(', ')} — nobody can send a message`);
});

test('authenticated holds no UPDATE anywhere on the table', async () => {
  // There is no UPDATE policy today, so this changes no behaviour. It is here
  // so that adding an "edit your own message" policy later cannot silently
  // hand the sender columns back through a different verb.
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('authenticated', 'public.chat_messages', 'UPDATE') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, false, 'authenticated regained UPDATE on chat_messages');
  const cols: string[] = [];
  for (const c of PROVENANCE_COLUMNS) {
    const g = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated', 'public.chat_messages', $1, 'UPDATE') AS ok`,
      [c],
    );
    if (g.rows[0]!.ok) cols.push(c);
  }
  assert.deepEqual(cols, [], `authenticated can UPDATE ${cols.join(', ')}`);
});

/* ── 2 · BEHAVIOURAL — the attack, run for real ───────────────────────────── */

test('BEHAVIOURAL: a couple CANNOT post a message stamped as anyone but themselves', async () => {
  // The exact attack, once per costume. Catalog privileges and real behaviour
  // have disagreed before, so this becomes the role and tries it.
  for (const role of ['vendor', 'system', 'coordinator', 'couple']) {
    const msg = await attempt(
      F.couple,
      `INSERT INTO public.chat_messages
         (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
       VALUES ($1,$2,$3,$4,$5::public.chat_sender_role,$6)`,
      [F.threadId, F.eventId, F.vendorId, F.vendorUser, role, `forged as ${role}`],
    );
    assert.ok(msg, `a couple session inserted a row claiming sender_role='${role}'`);
    assert.match(
      msg,
      /permission denied/i,
      `expected a permission failure for sender_role='${role}', got: ${msg}`,
    );
  }
});

test('BEHAVIOURAL: a couple cannot badge a message as the bot, nor backdate it', async () => {
  for (const [col, value] of [
    ['is_bot', 'true'],
    ['created_at', `'2020-01-01T00:00:00Z'::timestamptz`],
  ] as const) {
    const msg = await attempt(
      F.couple,
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, ${col})
       VALUES ($1,$2,$3,$4,${value})`,
      [F.threadId, F.eventId, F.vendorId, `forged ${col}`],
    );
    assert.ok(msg, `a couple session set ${col} itself`);
    assert.match(msg, /permission denied/i, `expected a permission failure for ${col}, got: ${msg}`);
  }
});

test('BEHAVIOURAL: a legitimate send still works and is stamped from auth.uid()', async () => {
  // A fix that breaks messaging is worse than the bug. Send exactly what the
  // app now sends — no sender columns at all — as each party.
  const send = async (uid: string, body: string) => {
    const msg = await attempt(
      uid,
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
       VALUES ($1,$2,$3,$4)`,
      [F.threadId, F.eventId, F.vendorId, body],
    );
    assert.equal(msg, null, `a legitimate send was refused: ${msg}`);
  };
  await send(F.couple, 'Hi! Are you free on the 14th?');
  await send(F.vendorUser, 'Yes — sending a quote now.');

  await asService();
  const rows = await db.query<{ sender_role: string; sender_user_id: string; is_bot: boolean }>(
    `SELECT sender_role, sender_user_id, is_bot FROM public.chat_messages
      WHERE thread_id = $1 ORDER BY created_at`,
    [F.threadId],
  );
  await reset();
  assert.equal(rows.rows.length, 2, 'both legitimate messages landed');
  assert.deepEqual(
    rows.rows.map((r) => r.sender_role),
    ['couple', 'vendor'],
    'the database did not derive the sender from who was signed in',
  );
  assert.deepEqual(
    rows.rows.map((r) => r.sender_user_id),
    [F.couple, F.vendorUser],
    'sender_user_id was not stamped from auth.uid()',
  );
  assert.deepEqual(rows.rows.map((r) => r.is_bot), [false, false], 'is_bot defaulted wrong');
});

test('BEHAVIOURAL: the vendor name was NOT unmasked by the couple, and IS by the real reply', async () => {
  // The consequence that made this urgent, asserted end to end rather than by
  // reasoning about the triggers. Ordering note: the test above sent a real
  // vendor reply, so the reveal here is attributable to THAT and not to any
  // forged row — every forged attempt in this file was refused outright.
  await asService();
  const vp = await db.query<{ revealed: string | null; unlocked: string | null }>(
    `SELECT name_revealed_at AS revealed, real_name_unlocked_at AS unlocked
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  const th = await db.query<{ vendor_first_reply_at: string | null }>(
    `SELECT vendor_first_reply_at FROM public.chat_threads WHERE thread_id = $1`,
    [F.threadId],
  );
  await reset();
  assert.ok(vp.rows[0]!.revealed != null, 'a genuine vendor reply no longer reveals the name');
  assert.ok(vp.rows[0]!.unlocked != null, 'a genuine vendor reply no longer unlocks the real name');
  assert.ok(th.rows[0]!.vendor_first_reply_at != null, 'a genuine vendor reply no longer stamps the thread');
});

test('BEHAVIOURAL: someone who is not a party to the thread is refused', async () => {
  // The derivation returns NULL for a stranger, and the trigger raises rather
  // than letting RLS produce a bare policy violation a moment later.
  const msg = await attempt(
    F.outsider,
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
     VALUES ($1,$2,$3,$4)`,
    [F.threadId, F.eventId, F.vendorId, 'I do not belong here'],
  );
  assert.ok(msg, 'a stranger inserted a message into someone else’s conversation');
  assert.match(
    msg,
    /not a party to this conversation|row-level security/i,
    `expected a party/RLS refusal, got: ${msg}`,
  );
});

/* ── 3 · NEUTRALISATION — each half proven to be load-bearing ─────────────── */

test('NEUTRALISATION: re-granting the columns re-opens the INSERT — but the TRIGGER still corrects it', async () => {
  // Half one removed. If the refusal above came from something other than the
  // ACL this would not change; it does. And with the ACL out of the way, the
  // second half is exposed on its own: the forged value is accepted by the
  // grant and then overwritten by the trigger.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT INSERT (sender_role, sender_user_id) ON public.chat_messages TO authenticated`);
    const msg = await attempt(
      F.couple,
      `INSERT INTO public.chat_messages
         (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
       VALUES ($1,$2,$3,$4,'vendor'::public.chat_sender_role,$5)`,
      [F.threadId, F.eventId, F.vendorId, F.vendorUser, 'neutralisation probe'],
    );
    assert.equal(msg, null, `the re-grant did not restore the INSERT — the refusal is not attributable to the ACL: ${msg}`);

    await asService();
    const r = await db.query<{ sender_role: string; sender_user_id: string }>(
      `SELECT sender_role, sender_user_id FROM public.chat_messages WHERE body = 'neutralisation probe'`,
    );
    await reset();
    assert.equal(r.rows.length, 1, 'the probe row is missing');
    assert.equal(
      r.rows[0]!.sender_role,
      'couple',
      'with the grant restored the forged sender_role SURVIVED — the trigger is not correcting it, ' +
        'so the GRANT is carrying the whole fix on its own',
    );
    assert.equal(
      r.rows[0]!.sender_user_id,
      F.couple,
      'the forged sender_user_id survived — the trigger is not stamping auth.uid()',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: with BOTH halves removed the original forgery succeeds again', async () => {
  // The full reproduction, so nobody has to take the docblock's word for what
  // this migration prevents. Drop the trigger AND restore the grant, forge a
  // vendor reply, and watch the reveal fire — then roll all of it back.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER chat_messages_derive_sender ON public.chat_messages`);
    await db.exec(`GRANT INSERT (sender_role, sender_user_id) ON public.chat_messages TO authenticated`);

    // A second vendor whose name has never been revealed, so the reveal below
    // is unambiguously caused by the forged row.
    const victimUser = await createUser('forge-victim@chat.test', 'vendor');
    const vp = await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name)
       VALUES ($1, 'Unmasked Studio')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
       RETURNING vendor_profile_id`,
      [victimUser],
    );
    const victimId = vp.rows[0]!.vendor_profile_id;
    const th = await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'pending') RETURNING thread_id`,
      [F.eventId, victimId, F.couple],
    );

    const msg = await attempt(
      F.couple,
      `INSERT INTO public.chat_messages
         (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
       VALUES ($1,$2,$3,$4,'vendor'::public.chat_sender_role,$5)`,
      [th.rows[0]!.thread_id, F.eventId, victimId, victimUser, 'words the supplier never wrote'],
    );
    assert.equal(msg, null, `removing both halves did not restore the forgery: ${msg}`);

    await asService();
    const after_ = await db.query<{ revealed: string | null }>(
      `SELECT name_revealed_at AS revealed FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [victimId],
    );
    await reset();
    assert.ok(
      after_.rows[0]!.revealed != null,
      'the forged vendor reply did not trigger the name reveal — the reveal path this migration ' +
        'protects may have moved, and this suite is no longer testing the real consequence',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: the trigger really is what refuses a non-party (not just RLS)', async () => {
  // The derivation raises its own error. Removing it must change the message —
  // otherwise the "not a party" branch is dead code riding on RLS's refusal.
  const withTrigger = await attempt(
    F.outsider,
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
     VALUES ($1,$2,$3,$4)`,
    [F.threadId, F.eventId, F.vendorId, 'probe'],
  );
  assert.match(withTrigger ?? '', /not a party to this conversation/i, 'the trigger did not raise');

  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER chat_messages_derive_sender ON public.chat_messages`);
    const withoutTrigger = await attempt(
      F.outsider,
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
       VALUES ($1,$2,$3,$4)`,
      [F.threadId, F.eventId, F.vendorId, 'probe'],
    );
    assert.ok(withoutTrigger, 'with the trigger gone a stranger got in — RLS is not holding either');
    assert.doesNotMatch(
      withoutTrigger,
      /not a party to this conversation/i,
      'the same message appears with the trigger dropped, so it is not the trigger producing it',
    );
  } finally {
    await rollbackAndReset();
  }
});
