/**
 * A PARTY TO A CONVERSATION MAY CHANGE ONLY WHAT THEIR SIDE MAY CHANGE —
 * migration 20271222263716, proven as REAL `authenticated` sessions (SET ROLE +
 * JWT claims), never as the superuser the replay otherwise runs as.
 *
 * Owner, 2026-09-10: "our goal is to let them integrate their event with the
 * vendor they find. not to let them communicate outside the app."
 *
 * Measured OPEN by N1 before this migration (1 row each, as a real couple):
 *   · move the thread into any supplier's inbox (vendor_profile_id);
 *   · accept their own inquiry (inquiry_status / accepted_at);
 *   · stamp a lock at a price (locked_at / agreed_price_centavos / locked_by_user_id).
 *
 * 🔑 Every refusal is checked for the RIGHT reason (the guard's own marker), sits
 * beside the legitimate path that must still work — supplier accept/decline,
 * couple displace/revive, opening and resuming a thread, the server's lock —
 * and the whole set is NEUTRALISED once: with the guard disabled inside a
 * rolled-back transaction the same attack lands, so "refused" means the guard.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MARKER = 'CHAT_THREAD_SIDE_REFUSED';
const GUARD = 'chat_threads_guard_sides';

const F = {
  couple: '',
  supplier: '',
  strangerSupplier: '',
  admin: '',
  vendorId: '',
  strangerVendorId: '',
  otherVendorId: '',
  otherSupplier: '',
  eventId: '',
  otherEventId: '',
  pending: '', // pending thread couple ↔ supplier
  accepted: '', // accepted thread couple ↔ otherSupplier
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

/**
 * Run `sql` as `who` inside a rolled-back transaction. `who` is a user id, or
 * 'service_role'. Returns the error text (null = it landed) and rows affected.
 */
async function attempt(
  who: string,
  sql: string,
  params: unknown[] = [],
  opts: { withoutGuard?: boolean } = {},
): Promise<{ err: string | null; n: number }> {
  await db.exec('BEGIN');
  try {
    if (opts.withoutGuard) await db.exec(`ALTER TABLE public.chat_threads DISABLE TRIGGER ${GUARD}`);
    if (who === 'service_role') {
      await setRole('service_role');
      await db.exec('SET ROLE service_role');
    } else {
      await asUser(who);
    }
    const r = await db.query(sql, params);
    return { err: null, n: r.affectedRows ?? 0 };
  } catch (e) {
    return { err: (e as Error).message, n: 0 };
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}
function refusedByGuard(r: { err: string | null }, what: string): void {
  assert.ok(r.err, `${what} LANDED — the guard did not refuse it`);
  assert.ok(r.err.includes(MARKER), `${what} was refused for the wrong reason: ${r.err}`);
}
function landed(r: { err: string | null; n: number }, what: string): void {
  assert.equal(r.err, null, `${what} was refused: ${r.err}`);
  assert.equal(r.n, 1, `${what} touched ${r.n} rows — RLS did not admit the row, so this proves nothing`);
}

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
  F.couple = await mkUser('rewrite-couple@thread.test', 'customer');
  F.supplier = await mkUser('rewrite-supplier@thread.test', 'vendor');
  F.otherSupplier = await mkUser('rewrite-other-supplier@thread.test', 'vendor');
  F.strangerSupplier = await mkUser('rewrite-stranger@thread.test', 'vendor');
  F.admin = await mkUser('rewrite-admin@thread.test', 'customer');
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [F.admin]);

  const shop = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
  F.vendorId = await shop(F.supplier, 'Rewrite Test Band');
  F.otherVendorId = await shop(F.otherSupplier, 'Rewrite Test Florist');
  F.strangerVendorId = await shop(F.strangerSupplier, 'Somebody Else’s Caterer');

  const ev = async (name: string) => {
    const id = (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [id, F.couple]);
    return id;
  };
  F.eventId = await ev('Rewrite Test Wedding');
  F.otherEventId = await ev('The Same Couple’s Other Party');

  const thread = async (vendorId: string, status: string) =>
    (
      await db.query<{ thread_id: string }>(
        `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
         VALUES ($1, $2, $3, $4::chat_inquiry_status) RETURNING thread_id`,
        [F.eventId, vendorId, F.couple, status],
      )
    ).rows[0]!.thread_id;
  F.pending = await thread(F.vendorId, 'pending');
  F.accepted = await thread(F.otherVendorId, 'accepted');
  // The couple follows the stranger's shop, so a NEW thread to it passes the
  // follow gate — the insert refusals below are then the guard, not the gate.
  await db.query(`INSERT INTO public.vendor_follows (follower_user_id, vendor_profile_id) VALUES ($1, $2)`, [F.couple, F.strangerVendorId]);
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · META ─────────────────────────────────────────────────────────────── */

test('META: the probing session is `authenticated`, not the owner, not super, no BYPASSRLS', async () => {
  await asUser(F.couple);
  const r = await db.query<{ me: string; owner: string; sup: boolean; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS sup,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = 'public.chat_threads'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated');
  assert.equal(r.rows[0]!.sup, false);
  assert.equal(r.rows[0]!.bypass, false);
});

test('META: RLS really bites — a stranger supplier updates ZERO rows of this thread', async () => {
  const r = await attempt(F.strangerSupplier, `UPDATE public.chat_threads SET archived_at = now() WHERE thread_id = $1`, [F.pending]);
  assert.equal(r.err, null);
  assert.equal(r.n, 0, 'a stranger reached the thread — RLS is not enforced in this probe');
});

test('META: the guard is a live BEFORE INSERT OR UPDATE trigger, INVOKER, not an RPC', async () => {
  const r = await db.query<{ ok: boolean; secdef: boolean; auth: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.chat_threads'::regclass AND t.tgname = $1
                     AND (t.tgtype & 2) = 2 AND (t.tgtype & 4) = 4 AND (t.tgtype & 16) = 16 AND t.tgenabled = 'O') AS ok,
            (SELECT prosecdef FROM pg_proc WHERE oid = 'public.tg_chat_threads_guard_sides()'::regprocedure) AS secdef,
            has_function_privilege('authenticated', 'public.tg_chat_threads_guard_sides()', 'EXECUTE') AS auth`,
    [GUARD],
  );
  assert.equal(r.rows[0]!.ok, true);
  assert.equal(r.rows[0]!.secdef, false, 'a DEFINER guard sees current_user = its owner and passes everyone');
  assert.equal(r.rows[0]!.auth, false);
});

/* ── 1 · THE THREE DOORS N1 MEASURED, AS THE COUPLE ───────────────────────── */

const COUPLE_ATTACKS: Array<[string, string, () => unknown[]]> = [
  ['move the thread into another supplier’s inbox', `UPDATE public.chat_threads SET vendor_profile_id = $2 WHERE thread_id = $1`, () => [F.pending, F.strangerVendorId]],
  ['move the thread into another event', `UPDATE public.chat_threads SET event_id = $2 WHERE thread_id = $1`, () => [F.pending, F.otherEventId]],
  ['accept their own inquiry', `UPDATE public.chat_threads SET inquiry_status = 'accepted' WHERE thread_id = $1`, () => [F.pending]],
  ['stamp accepted_at', `UPDATE public.chat_threads SET accepted_at = now() WHERE thread_id = $1`, () => [F.pending]],
  ['decline on the supplier’s behalf', `UPDATE public.chat_threads SET inquiry_status = 'declined', declined_at = now() WHERE thread_id = $1`, () => [F.pending]],
  ['stamp a lock at a price', `UPDATE public.chat_threads SET locked_at = now(), agreed_price_centavos = 100, locked_by_user_id = $2 WHERE thread_id = $1`, () => [F.accepted, F.couple]],
  ['change an agreed price alone', `UPDATE public.chat_threads SET agreed_price_centavos = 1 WHERE thread_id = $1`, () => [F.accepted]],
  ['revive to a status it never had', `UPDATE public.chat_threads SET inquiry_status = 'displaced', displaced_from_status = 'accepted' WHERE thread_id = $1`, () => [F.pending]],
];

test('the COUPLE cannot move, accept, decline or lock their own conversation', async () => {
  let refused = 0;
  for (const [what, sql, params] of COUPLE_ATTACKS) {
    refusedByGuard(await attempt(F.couple, sql, params()), `couple: ${what}`);
    refused += 1;
  }
  console.log(`# couple attacks refused: ${refused}/${COUPLE_ATTACKS.length}`);
  assert.equal(refused, COUPLE_ATTACKS.length);
});

test('…and cannot OPEN a thread already accepted or locked (the INSERT half)', async () => {
  const attacks: Array<[string, string]> = [
    ['opened as accepted', `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted')`],
    ['opened locked', `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, locked_at, agreed_price_centavos) VALUES ($1, $2, $3, now(), 100)`],
    ['opened with an answer', `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, accepted_at) VALUES ($1, $2, $3, now())`],
  ];
  for (const [what, sql] of attacks) {
    refusedByGuard(await attempt(F.couple, sql, [F.eventId, F.strangerVendorId, F.couple]), `couple: ${what}`);
  }
  console.log(`# couple insert attacks refused: ${attacks.length}/3`);
});

test('the SUPPLIER cannot lock, move the thread, or make the couple’s moves', async () => {
  const attacks: Array<[string, string, unknown[]]> = [
    ['stamp a lock', `UPDATE public.chat_threads SET locked_at = now(), agreed_price_centavos = 100 WHERE thread_id = $1`, [F.pending]],
    ['move it to another event', `UPDATE public.chat_threads SET event_id = $2 WHERE thread_id = $1`, [F.pending, F.otherEventId]],
    ['set it aside (the couple’s displace)', `UPDATE public.chat_threads SET inquiry_status = 'displaced', displaced_from_status = 'pending' WHERE thread_id = $1`, [F.pending]],
  ];
  for (const [what, sql, params] of attacks) {
    refusedByGuard(await attempt(F.supplier, sql, params), `supplier: ${what}`);
  }
  // An answer only from PENDING: a declined thread cannot be flipped to accepted.
  await db.exec('BEGIN');
  try {
    await db.query(`UPDATE public.chat_threads SET inquiry_status = 'declined' WHERE thread_id = $1`, [F.pending]);
    await asUser(F.supplier);
    let err: string | null = null;
    try {
      await db.query(`UPDATE public.chat_threads SET inquiry_status = 'accepted', accepted_at = now() WHERE thread_id = $1`, [F.pending]);
    } catch (e) {
      err = (e as Error).message;
    }
    assert.ok(err?.includes(MARKER), `supplier re-opened a declined inquiry: ${err ?? 'LANDED'}`);
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
});

test('NEUTRALISATION: with the guard disabled (rolled back) the couple’s move LANDS — the refusals are the guard', async () => {
  const r = await attempt(F.couple, `UPDATE public.chat_threads SET vendor_profile_id = $2 WHERE thread_id = $1`, [F.pending, F.strangerVendorId], { withoutGuard: true });
  landed(r, 'the unguarded move');
  const lock = await attempt(F.couple, `UPDATE public.chat_threads SET locked_at = now(), agreed_price_centavos = 100 WHERE thread_id = $1`, [F.accepted], { withoutGuard: true });
  landed(lock, 'the unguarded lock');
  // …and the ROLLBACK really re-armed it.
  refusedByGuard(await attempt(F.couple, `UPDATE public.chat_threads SET vendor_profile_id = $2 WHERE thread_id = $1`, [F.pending, F.strangerVendorId]), 'post-rollback move');
});

/* ── 2 · EVERY LEGITIMATE PATH STILL WORKS ────────────────────────────────── */

test('supplier ACCEPTS a pending inquiry (lib/chat-actions.ts acceptInquiry)', async () => {
  landed(
    await attempt(F.supplier, `UPDATE public.chat_threads SET inquiry_status = 'accepted', accepted_at = now() WHERE thread_id = $1`, [F.pending]),
    'supplier accept',
  );
});

test('supplier DECLINES a pending inquiry, with a reason (declineInquiry)', async () => {
  landed(
    await attempt(
      F.supplier,
      `UPDATE public.chat_threads SET inquiry_status = 'declined', declined_at = now(), decline_reason = 'Booked that day' WHERE thread_id = $1`,
      [F.pending],
    ),
    'supplier decline',
  );
});

test('couple DISPLACES a rival (pending and accepted) and REVIVES it to exactly where it was', async () => {
  for (const [thread, prior] of [[F.pending, 'pending'], [F.accepted, 'accepted']] as const) {
    landed(
      await attempt(
        F.couple,
        `UPDATE public.chat_threads SET inquiry_status = 'displaced', displaced_from_status = $2::chat_inquiry_status, updated_at = now() WHERE thread_id = $1`,
        [thread, prior],
      ),
      `couple displace from ${prior}`,
    );
  }
  // Revive — set up the displaced state privileged, then revive as the couple.
  await db.exec('BEGIN');
  try {
    await db.query(`UPDATE public.chat_threads SET inquiry_status = 'displaced', displaced_from_status = 'accepted' WHERE thread_id = $1`, [F.accepted]);
    await asUser(F.couple);
    let wrongErr: string | null = null;
    await db.exec('SAVEPOINT s');
    try {
      await db.query(`UPDATE public.chat_threads SET inquiry_status = 'pending', displaced_from_status = NULL WHERE thread_id = $1`, [F.accepted]);
    } catch (e) {
      wrongErr = (e as Error).message;
    }
    await db.exec('ROLLBACK TO SAVEPOINT s');
    assert.ok(wrongErr?.includes(MARKER), `a revive to the WRONG status landed: ${wrongErr ?? 'LANDED'}`);
    const r = await db.query(`UPDATE public.chat_threads SET inquiry_status = 'accepted', displaced_from_status = NULL, updated_at = now() WHERE thread_id = $1`, [F.accepted]);
    assert.equal(r.affectedRows, 1, 'the couple’s revive did not land');
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
});

test('couple OPENS a new thread to a supplier they follow, as a pending inquiry', async () => {
  landed(
    await attempt(
      F.couple,
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`,
      [F.eventId, F.strangerVendorId, F.couple],
    ),
    'couple new thread',
  );
});

test('couple RESUMES an existing thread by the upsert every inquiry path uses (the pair is unchanged)', async () => {
  // Exactly the statement PostgREST builds for `.upsert({event_id, vendor_profile_id,
  // created_by_user_id, archived_at: null}, { onConflict: 'event_id,vendor_profile_id' })`.
  landed(
    await attempt(
      F.couple,
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, archived_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
         SET event_id = EXCLUDED.event_id, vendor_profile_id = EXCLUDED.vendor_profile_id,
             created_by_user_id = EXCLUDED.created_by_user_id, archived_at = EXCLUDED.archived_at`,
      [F.eventId, F.vendorId, F.couple],
    ),
    'couple upsert-resume',
  );
});

test('couple still archives and snapshots pax on their own thread (unguarded columns)', async () => {
  landed(await attempt(F.couple, `UPDATE public.chat_threads SET archived_at = now() WHERE thread_id = $1`, [F.pending]), 'couple archive');
  landed(await attempt(F.couple, `UPDATE public.chat_threads SET pax_at_inquiry = 150, pax_current = 150 WHERE thread_id = $1`, [F.pending]), 'couple pax');
});

test('the SERVER stamps the lock (service role — lockDeal after its checks)', async () => {
  landed(
    await attempt(
      'service_role',
      `UPDATE public.chat_threads SET agreed_price_centavos = 8000000, locked_at = now(), locked_by_user_id = $2 WHERE thread_id = $1`,
      [F.accepted, F.couple],
    ),
    'service-role lock',
  );
});

test('a SECURITY DEFINER body writing the thread (a message bumping updated_at) is not refused', async () => {
  // bump_chat_thread_updated_at runs as its owner when the couple posts: the JWT
  // says authenticated, current_user says owner. The guard must read current_user.
  const r = await attempt(
    F.couple,
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1, $2, $3, 'See you at the tasting.')`,
    [F.accepted, F.eventId, F.otherVendorId],
  );
  assert.equal(r.err, null, `a couple’s ordinary message was refused: ${r.err}`);
});
