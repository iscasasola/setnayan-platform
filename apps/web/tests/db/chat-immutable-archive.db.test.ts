/**
 * Chat = immutable evidence layer — END-TO-END DB verification (executed, not
 * prose). Covers migration 20270926679942_chat_thread_archive_immutable and the
 * append-only posture the base chat schema already had:
 *
 *   1. ARCHIVE-NOT-DELETE — the couple's remove path stamps
 *      chat_threads.archived_at (an UPDATE); the thread + every message SURVIVE.
 *   2. IMMUTABILITY (RLS) — an authenticated thread party CANNOT DELETE a
 *      chat_thread (no FOR DELETE policy) NOR mutate/delete a chat_message
 *      (INSERT+SELECT only). Only service-role paths (which bypass RLS) remove.
 *   3. ACTIVE-LIST FILTER — the `archived_at IS NULL` predicate the inbox uses
 *      folds the archived thread out of the active list; a re-add (archived_at
 *      → NULL) resumes it with its history intact.
 *   4. RETENTION still works — service-role purge_expired_chat() hard-deletes an
 *      OLD thread with no orders row, and RETAINS one whose event carries an
 *      order (10-yr legal-hold floor). Archive doesn't change either outcome.
 *
 * Run: pnpm --filter @setnayan/web test:db
 * In-process PGlite replays the real supabase/migrations under real RLS.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** JWT role-claim seam Supabase's auth.role() reads (for the guard trigger). */
async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function createUser(email: string, accountType: 'customer' | 'vendor' = 'customer') {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

/** Impersonate an authenticated user (uid + role claim + SET ROLE). */
async function asCouple(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asService(): Promise<void> {
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

// Shared fixtures.
const F = {
  couple: '',
  vendorUser: '',
  vendorId: '',
  eventId: '',
  threadId: '',
} as { couple: string; vendorUser: string; vendorId: string; eventId: string; threadId: string };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('immutable-couple@chat.test', 'customer');
  F.vendorUser = await createUser('immutable-vendor@chat.test', 'vendor');

  // Vendor profile (vendor-type signup auto-provisions one; adopt/ensure it).
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Immutable Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.vendorUser],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;

  // Non-wedding event so the fixture needn't satisfy wedding-field checks.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Immutable Chat Event', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );

  // A thread with two messages (couple inquiry + vendor reply = the evidence).
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.eventId, F.vendorId, F.couple],
  );
  F.threadId = th.rows[0]!.thread_id;
  await db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
     VALUES
       ($1, $2, $3, $4, 'couple', 'Hi! Are you available and how much for 120 pax?'),
       ($1, $2, $3, NULL,  'vendor', 'Yes — ₱85,000 all-in for 120 pax.')`,
    [F.threadId, F.eventId, F.vendorId, F.couple],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

// ── 1. ARCHIVE-NOT-DELETE ────────────────────────────────────────────────────

test('couple can ARCHIVE the thread (archived_at UPDATE) — RLS-allowed', async () => {
  await asCouple(F.couple);
  const r = await db.query(
    `UPDATE public.chat_threads SET archived_at = now() WHERE thread_id = $1`,
    [F.threadId],
  );
  await reset();
  assert.equal(r.affectedRows, 1, 'the couple member could stamp archived_at');
});

test('archiving preserves the thread AND every message (evidence intact)', async () => {
  await asService();
  const thread = await db.query<{ archived_at: string | null }>(
    `SELECT archived_at FROM public.chat_threads WHERE thread_id = $1`,
    [F.threadId],
  );
  const msgs = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.chat_messages WHERE thread_id = $1`,
    [F.threadId],
  );
  await reset();
  assert.equal(thread.rows.length, 1, 'thread row still exists');
  assert.ok(thread.rows[0]!.archived_at != null, 'archived_at is stamped');
  assert.equal(msgs.rows[0]!.n, 2, 'both messages survive the archive');
});

// ── 2. IMMUTABILITY (RLS) ────────────────────────────────────────────────────

test('couple CANNOT hard-delete a chat_thread (no FOR DELETE policy)', async () => {
  await asCouple(F.couple);
  const r = await db.query(
    `DELETE FROM public.chat_threads WHERE thread_id = $1`,
    [F.threadId],
  );
  await reset();
  // RLS with no DELETE policy: the statement runs but matches 0 rows.
  assert.equal(r.affectedRows, 0, 'DELETE denied → 0 rows affected, thread untouched');

  await asService();
  const still = await db.query(
    `SELECT 1 FROM public.chat_threads WHERE thread_id = $1`,
    [F.threadId],
  );
  await reset();
  assert.equal(still.rows.length, 1, 'thread still present after the denied delete');
});

test('couple CANNOT delete or edit a chat_message (append-only)', async () => {
  await asCouple(F.couple);
  const del = await db.query(
    `DELETE FROM public.chat_messages WHERE thread_id = $1`,
    [F.threadId],
  );
  // UPDATE is refused HARDER than it used to be, and the assertion moved to
  // match. Until migration 20271132839561 `authenticated` held table-wide
  // UPDATE and was stopped only by the absence of an UPDATE policy — RLS with
  // no policy matches 0 rows silently, which is what this test asserted. That
  // migration revoked the privilege outright (so that adding an "edit your own
  // message" policy later cannot quietly hand back sender_role), and a missing
  // privilege raises 42501 instead of returning 0 rows. Same guarantee, louder.
  let updRefused = false;
  let updMessage = '';
  try {
    await db.query(`UPDATE public.chat_messages SET body = 'REDACTED' WHERE thread_id = $1`, [
      F.threadId,
    ]);
  } catch (err) {
    updRefused = true;
    updMessage = err instanceof Error ? err.message : String(err);
  }
  await reset();
  assert.equal(del.affectedRows, 0, 'message DELETE denied (0 rows)');
  assert.ok(updRefused, 'a couple session UPDATED a chat message');
  assert.match(updMessage, /permission denied/i, `expected a privilege refusal, got: ${updMessage}`);

  await asService();
  const bodies = await db.query<{ body: string }>(
    `SELECT body FROM public.chat_messages WHERE thread_id = $1 ORDER BY created_at`,
    [F.threadId],
  );
  await reset();
  assert.equal(bodies.rows.length, 2, 'both messages intact');
  assert.ok(!bodies.rows.some((b) => b.body === 'REDACTED'), 'no message body was rewritten');
});

// ── 3. ACTIVE-LIST FILTER + RE-ADD RESUME ────────────────────────────────────

test('archived thread is folded OUT of the active-list predicate', async () => {
  await asCouple(F.couple);
  const active = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.chat_threads
      WHERE event_id = $1 AND archived_at IS NULL`,
    [F.eventId],
  );
  await reset();
  assert.equal(active.rows[0]!.n, 0, 'archived thread excluded from the active list');
});

test('re-adding the vendor (archived_at → NULL) RESUMES the same thread', async () => {
  await asCouple(F.couple);
  // Mirrors the upsert un-archive in startThreadByVendorEmail / submitInquiry.
  const r = await db.query(
    `UPDATE public.chat_threads SET archived_at = NULL WHERE thread_id = $1`,
    [F.threadId],
  );
  const active = await db.query<{ thread_id: string }>(
    `SELECT thread_id FROM public.chat_threads
      WHERE event_id = $1 AND archived_at IS NULL`,
    [F.eventId],
  );
  await reset();
  assert.equal(r.affectedRows, 1, 'un-archive UPDATE landed');
  assert.equal(active.rows.length, 1, 'thread is back in the active list');
  assert.equal(active.rows[0]!.thread_id, F.threadId, 'SAME thread resumed (not a new one)');

  await asService();
  const msgs = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.chat_messages WHERE thread_id = $1`,
    [F.threadId],
  );
  await reset();
  assert.equal(msgs.rows[0]!.n, 2, 'resumed thread keeps its full history');
});

// ── 4. RETENTION SWEEP (service-role) still works ────────────────────────────

test('purge_expired_chat: OLD thread w/o orders is purged; thread w/ an order is retained', async () => {
  // Two fresh events far in the past — one with an order (legal hold), one bare.
  await asService();
  const mk = async (label: string) => {
    const e = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date)
       VALUES ($1, 'birthday', (now() - interval '7 years')::date) RETURNING event_id`,
      [label],
    );
    const eid = e.rows[0]!.event_id;
    const t = await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, created_at)
       VALUES ($1, $2, $3, now() - interval '7 years') RETURNING thread_id`,
      [eid, F.vendorId, F.couple],
    );
    return { eid, tid: t.rows[0]!.thread_id };
  };
  const bare = await mk('Old bare event');
  const paid = await mk('Old paid event');
  // Put the "paid" event under the 10-yr floor via an orders row.
  await db.query(
    `INSERT INTO public.orders (event_id, user_id, description, requested_total_php, reference_code)
     VALUES ($1, $2, 'Deposit', 5000, $3)`,
    [paid.eid, F.couple, `IMMUT${Date.now().toString(36).toUpperCase()}`],
  );

  const purged = await db.query<{ n: number }>(`SELECT public.purge_expired_chat(5) AS n`);
  const bareGone = await db.query(`SELECT 1 FROM public.chat_threads WHERE thread_id = $1`, [bare.tid]);
  const paidKept = await db.query(`SELECT 1 FROM public.chat_threads WHERE thread_id = $1`, [paid.tid]);
  await reset();

  assert.ok((purged.rows[0]!.n ?? 0) >= 1, 'sweep purged at least the bare old thread');
  assert.equal(bareGone.rows.length, 0, 'old thread with no orders was purged');
  assert.equal(paidKept.rows.length, 1, 'old thread whose event has an order was RETAINED (legal hold)');
});
