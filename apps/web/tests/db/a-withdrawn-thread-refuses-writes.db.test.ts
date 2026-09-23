/**
 * A WITHDRAWN CONVERSATION REFUSES WRITES — migration
 * `20271243991251_withdrawn_thread_refuses_writes.sql`, proven as a REAL
 * `authenticated` session (SET ROLE + JWT claims), never as the superuser the
 * replay otherwise runs as.
 *
 * Owner, 2026-09-23: "fix the withdrawn wording now since you're free."
 *
 * ── WHAT WAS OPEN, MEASURED BEFORE THE MIGRATION ────────────────────────────
 * `withdrawInquiry` writes ONLY `archived_at`, so a withdrawn thread is still
 * `inquiry_status = 'pending'`. The pages now gate on `isThreadClosed()`, but a
 * page already open when the couple withdrew can still post, and
 * `acceptInquiry` never reads `archived_at` — it goes straight to
 * `.update({ inquiry_status: 'accepted' })` and the write SUCCEEDS.
 *
 * 🔑 **WHY A FIXTURE IS THE HONEST PROOF HERE, WHERE IT WAS NOT FOR THE COPY.**
 * The closing-copy rule is a pure function and a unit test executes it. This is
 * a refusal that only exists inside Postgres, reachable through nine different
 * insert sites. Nothing above the database can prove it; only rows can.
 *
 * ⚖ **AND THE LEGITIMATE PATHS MUST STILL WORK** — each refusal sits beside the
 * write it must NOT break: the couple re-adding the vendor (un-withdrawing),
 * ordinary bookkeeping on a withdrawn thread, and every write on a live one.
 *
 * 🔑 **NEUTRALISED ONCE.** With both policies dropped inside a rolled-back
 * transaction the same attacks land, so "refused" means the guard and not a
 * fixture that could never have worked in the first place.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  couple: '',
  supplier: '',
  supplierB: '',
  vendorId: '',
  vendorIdB: '',
  eventId: '',
  live: '', // pending, not withdrawn
  withdrawn: '', // pending + archived_at set — what a withdrawal actually looks like
};

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}

/** Did it throw? Returns the message, or null when the write landed. */
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/*
  ⚠ COLUMNS ON PURPOSE. `authenticated` holds INSERT on 14 columns of
  `chat_messages` and NOT on `sender_role`, `sender_user_id`, `is_bot`,
  `created_at` or `attachment_url` — that is the sender-not-forgeable design,
  and a trigger stamps them. Naming them here does not test the policy, it
  earns a flat "permission denied for table chat_messages" BEFORE RLS is
  consulted, which reads exactly like a refusal and is not one.
*/
const insertMessage = (threadId: string) =>
  db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
     VALUES ($1, $2, (SELECT vendor_profile_id FROM public.chat_threads WHERE thread_id = $1), 'still typing')`,
    [threadId, F.eventId],
  );

const acceptThread = (threadId: string) =>
  db.query(
    `UPDATE public.chat_threads SET inquiry_status = 'accepted', accepted_at = now() WHERE thread_id = $1`,
    [threadId],
  );

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('withdrawn-couple@thread.test', 'customer');
  F.supplier = await mkUser('withdrawn-supplier@thread.test', 'vendor');
  F.supplierB = await mkUser('withdrawn-supplier-b@thread.test', 'vendor');

  // ON CONFLICT: a 'vendor' auth user already gets a profile from the
  // on_auth_user_created trigger, so a bare INSERT collides on user_id.
  const shop = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
           RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
  F.vendorId = await shop(F.supplier, 'Withdrawn Test Studio');
  F.vendorIdB = await shop(F.supplierB, 'Withdrawn Test Florist');

  // 'birthday', not 'wedding' — 'wedding' trips a CHECK in this schema.
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
      ['Withdrawn Test Party'],
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );

  /* ⚠ ONE THREAD PER (event, vendor) PAIR — chat_threads_event_id_vendor_profile_id_key.
     "Setnayan keeps one per pair" is enforced, so the live and withdrawn
     fixtures must sit on DIFFERENT suppliers, not two threads to the same one. */
  const thread = async (vendorId: string, archived: boolean) =>
    (
      await db.query<{ thread_id: string }>(
        `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status, archived_at)
         VALUES ($1, $2, $3, 'pending', $4) RETURNING thread_id`,
        [F.eventId, vendorId, F.couple, archived ? new Date().toISOString() : null],
      )
    ).rows[0]!.thread_id;
  F.live = await thread(F.vendorId, false);
  F.withdrawn = await thread(F.vendorIdB, true);
});

after(async () => {
  await reset();
  await replay?.close?.();
});

test('the fixture is what a withdrawal really looks like: archived_at set, status still pending', async () => {
  const { rows } = await db.query<{ inquiry_status: string; archived: boolean }>(
    `SELECT inquiry_status, (archived_at IS NOT NULL) AS archived FROM public.chat_threads WHERE thread_id = $1`,
    [F.withdrawn],
  );
  assert.equal(rows[0]!.inquiry_status, 'pending', 'withdrawInquiry does not touch the status — that is the bug');
  assert.equal(rows[0]!.archived, true);
});

test('a withdrawn thread takes no new message from a real session', async () => {
  await asUser(F.couple);
  const err = await refused(() => insertMessage(F.withdrawn));
  await reset();
  assert.ok(err, 'the insert landed — a withdrawn thread accepted a new message');
  assert.match(
    err,
    /chat_messages_withdrawn_guard|row-level security/i,
    `refused for the WRONG REASON — a permission or constraint error is not this guard: ${err}`,
  );
  assert.doesNotMatch(err, /permission denied/i, 'a missing GRANT is not a refusal by the policy');
});

test('a withdrawn thread cannot be moved to accepted — the supplier defect', async () => {
  await asUser(F.supplierB); // the withdrawn thread belongs to supplier B
  const err = await refused(() => acceptThread(F.withdrawn));
  await reset();
  assert.ok(err, 'the accept landed — a withdrawn inquiry was accepted');
  assert.match(err, /chat_threads_withdrawn_accept_guard/, `refused for the wrong reason: ${err}`);
  const { rows } = await db.query<{ inquiry_status: string }>(
    `SELECT inquiry_status FROM public.chat_threads WHERE thread_id = $1`,
    [F.withdrawn],
  );
  // RLS on UPDATE hides the row rather than raising; either way it must NOT accept.
  assert.equal(rows[0]!.inquiry_status, 'pending', 'a withdrawn inquiry was accepted');
});

test('the live thread is untouched — both writes still work', async () => {
  await asUser(F.couple);
  const msgErr = await refused(() => insertMessage(F.live));
  await reset();
  assert.equal(msgErr, null, `a live thread refused a message: ${msgErr}`);

  await asUser(F.supplier);
  await acceptThread(F.live);
  await reset();
  const { rows } = await db.query<{ inquiry_status: string }>(
    `SELECT inquiry_status FROM public.chat_threads WHERE thread_id = $1`,
    [F.live],
  );
  assert.equal(rows[0]!.inquiry_status, 'accepted', 'a live inquiry could not be accepted — the guard over-blocks');
});

test('UN-WITHDRAWING still works — the guard must not trap the thread', async () => {
  await asUser(F.couple);
  const err = await refused(() =>
    db.query(`UPDATE public.chat_threads SET archived_at = NULL WHERE thread_id = $1`, [F.withdrawn]),
  );
  await reset();
  assert.equal(err, null, `re-adding the vendor was refused: ${err}`);
  const { rows } = await db.query<{ archived: boolean }>(
    `SELECT (archived_at IS NOT NULL) AS archived FROM public.chat_threads WHERE thread_id = $1`,
    [F.withdrawn],
  );
  assert.equal(rows[0]!.archived, false, 'the thread stayed withdrawn — the couple cannot resume it');
  // put it back for the neutralise check
  await db.query(`UPDATE public.chat_threads SET archived_at = now() WHERE thread_id = $1`, [F.withdrawn]);
});

test('NEUTRALISED: with the policies dropped, both attacks land — so "refused" means the guard', async () => {
  await db.exec('BEGIN');
  try {
    await db.exec(`DROP POLICY IF EXISTS chat_messages_withdrawn_guard ON public.chat_messages`);
    await db.exec(`DROP POLICY IF EXISTS chat_threads_withdrawn_accept_guard ON public.chat_threads`);

    await asUser(F.couple);
    const msgErr = await refused(() => insertMessage(F.withdrawn));
    await reset();
    assert.equal(msgErr, null, 'the message insert was refused even with the guard dropped — the fixture proves nothing');

    await asUser(F.supplierB);
    const acceptErr = await refused(() => acceptThread(F.withdrawn));
    await reset();
    assert.equal(acceptErr, null, `the accept was refused with the guard dropped — the fixture proves nothing: ${acceptErr}`);
    const { rows } = await db.query<{ inquiry_status: string }>(
      `SELECT inquiry_status FROM public.chat_threads WHERE thread_id = $1`,
      [F.withdrawn],
    );
    assert.equal(rows[0]!.inquiry_status, 'accepted', 'the accept did not land with the guard dropped — the fixture proves nothing');
  } finally {
    await reset();
    await db.exec('ROLLBACK');
  }
});
