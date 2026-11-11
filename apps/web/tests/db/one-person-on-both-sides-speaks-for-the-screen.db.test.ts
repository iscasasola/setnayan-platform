/**
 * 🏪 ONE PERSON ON BOTH SIDES SPEAKS FOR THE SCREEN THEY TYPED IN (owner, 11 Nov 2026 — live fault).
 *
 * The owner's one login owns a shop AND hosts a test event that shop serves. He typed "Hello" in the SHOP's chat and it
 * came back as his personal name on the host's side — "it's just me messaging myself". The cause:
 * `tg_chat_messages_derive_sender` derived the side from auth.uid() alone, couple FIRST, so one person on both sides
 * always landed as 'couple'. Migration 20271338442002 adds `chat_messages.sent_as`, the screen's side, which the
 * database honours ONLY when the sender holds that side.
 *
 * What this proves, against the real replayed schema:
 *   1. the same login, sending with sent_as='vendor', is stored as 'vendor' (the shop speaks);
 *   2. the same login, sending with no side, is stored as 'couple' exactly as before (the host's screens send none);
 *   3. sent_as never MINTS a side: a pure host asking for 'vendor', and a pure shop asking for 'couple', are refused;
 *   4. the browser can name `sent_as` and still cannot name sender_role / sender_user_id.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid } from './replay-migrations';

let db: PGlite;

const F = { both: '', host: '', vendorId: '', eventId: '', threadId: '', otherEventId: '', otherThreadId: '' };

async function createUser(email: string, accountType: 'customer' | 'vendor') {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

/** Insert one message as `uid`, naming `sentAs` (or not). Returns the stored row, or the refusal's text. */
async function send(
  uid: string,
  body: string,
  sentAs: string | null,
  where: { eventId: string; threadId: string } = { eventId: F.eventId, threadId: F.threadId },
): Promise<{ role: string; sender: string } | string> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    if (sentAs === null) {
      await db.query(
        `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,$4)`,
        [where.threadId, where.eventId, F.vendorId, body],
      );
    } else {
      await db.query(
        `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, sent_as)
         VALUES ($1,$2,$3,$4,$5::public.chat_sender_role)`,
        [where.threadId, where.eventId, F.vendorId, body, sentAs],
      );
    }
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
  const r = await db.query<{ sender_role: string; sender_user_id: string }>(
    `SELECT sender_role, sender_user_id FROM public.chat_messages WHERE body = $1`,
    [body],
  );
  assert.equal(r.rows.length, 1, `expected exactly one stored row for "${body}"`);
  return { role: r.rows[0]!.sender_role, sender: r.rows[0]!.sender_user_id };
}

before(async () => {
  db = (await createReplayedDb()).db;
  F.both = await createUser('both-sides@shop-self.test', 'vendor');
  F.host = await createUser('host-only@shop-self.test', 'customer');

  // The owner's own shop — "SetnaProd" in the screenshot.
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'SetnaProd')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
    [F.both],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;

  // …and his own test event, where he is a host beside one other host.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('TEST SetnaProd walk', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple'), ($1,$3,'couple')`,
    [F.eventId, F.both, F.host],
  );
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.eventId, F.vendorId, F.both],
  );
  F.threadId = th.rows[0]!.thread_id;

  // A client's event where the owner is ONLY the shop (a real customer of SetnaProd) — "a pure shop" case.
  const ev2 = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('A real client', 'birthday') RETURNING event_id`,
  );
  F.otherEventId = ev2.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [
    F.otherEventId,
    F.host,
  ]);
  const th2 = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.otherEventId, F.vendorId, F.host],
  );
  F.otherThreadId = th2.rows[0]!.thread_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('META: the column, its CHECK and the grant are really there', async () => {
  const col = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'chat_messages' AND a.attname = 'sent_as' AND NOT a.attisdropped`,
  );
  assert.equal(col.rows[0]!.n, 1, 'chat_messages.sent_as is missing');
  const can = async (column: string) =>
    (
      await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege('authenticated', 'public.chat_messages', $1, 'INSERT') AS ok`,
        [column],
      )
    ).rows[0]!.ok;
  assert.equal(await can('sent_as'), true, 'the browser cannot name sent_as — every shop send would be refused');
  assert.equal(await can('sender_role'), false, 'sender_role became browser-writable — the forgery door reopened');
  assert.equal(await can('sender_user_id'), false, 'sender_user_id became browser-writable');
});

test('the SAME login typing in the shop’s chat is stored as the shop', async () => {
  const r = await send(F.both, 'Hello from the shop', 'vendor');
  assert.equal(typeof r, 'object', `the shop's own send was refused: ${String(r)}`);
  assert.deepEqual(r, { role: 'vendor', sender: F.both }, 'one person on both sides still spoke as the host from the shop’s chat');
});

test('the SAME login with no side asked is the host, as before (the host’s screens send none)', async () => {
  const r = await send(F.both, 'Hello from the host', null);
  assert.deepEqual(r, { role: 'couple', sender: F.both });
});

test('sent_as never mints a side: a pure host asking to be the shop is refused', async () => {
  const r = await send(F.host, 'I am the shop now', 'vendor');
  assert.equal(typeof r, 'string', 'a host who is NOT on the shop side was stored as the shop');
  assert.match(r as string, /shop side|not a party|row-level security|permission/i);
});

test('sent_as never mints a side: a pure shop asking to be a host is refused', async () => {
  // Anti-vacuity: on that client's thread the shop CAN speak (so a refusal below is about the side, not the thread).
  const ok = await send(F.both, 'Shop to a real client', 'vendor', { eventId: F.otherEventId, threadId: F.otherThreadId });
  assert.deepEqual(ok, { role: 'vendor', sender: F.both }, `the shop could not post on its own client’s thread: ${String(ok)}`);
  const r = await send(F.both, 'I am a host now', 'couple', { eventId: F.otherEventId, threadId: F.otherThreadId });
  assert.equal(typeof r, 'string', 'a supplier who is NOT a host of this event was stored as a host');
});

test('sent_as takes only a side — never system or coordinator', async () => {
  const r = await send(F.both, 'I am Setnayan', 'system');
  assert.equal(typeof r, 'string', "sent_as='system' was accepted");
});
