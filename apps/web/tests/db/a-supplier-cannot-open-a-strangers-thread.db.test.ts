/**
 * A SUPPLIER CANNOT DROP A CONVERSATION INTO A STRANGER'S INBOX — migration
 * 20271222816187, proven as REAL `authenticated` sessions (SET ROLE + JWT
 * claims), never as the superuser the replay otherwise runs as.
 *
 * Found by N4 (#5435, "found, not fixed"); MEASURED OPEN by N5 on origin/main
 * before this migration existed: a supplier follows their OWN shop (no rule
 * against it), which satisfies the RESTRICTIVE follow gate, and then
 * chat_threads_member_insert's supplier arm admits a thread on ANY event_id —
 * 1 row, on a stranger couple's event.
 *
 * 🔑 Every refusal carries the guard's own marker, sits beside the openers that
 * must keep working (the couple on their own event, a shop's agent on a
 * customer event they were given, the service role that pre-seeds a claimed
 * invite's thread, the supplier answering a thread the couple opened), and the
 * attack is NEUTRALISED once: with the guard disabled inside a rolled-back
 * transaction it lands, so "refused" means this rule.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271222816187_a_supplier_cannot_open_a_strangers_thread.sql';
const MARKER = 'CHAT_THREAD_SIDE_REFUSED';
const GUARD = 'chat_threads_guard_sides';

const F = {
  couple: '',
  strangerCouple: '',
  supplier: '',
  agent: '',
  vendorId: '',
  serviceId: '',
  eventId: '', // the couple's
  strangerEventId: '', // somebody else's — the supplier has no part in it
  agentEventId: '', // a customer event the shop's agent was given
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
 * Run `steps` as `who` ('service_role' or a user id) inside a rolled-back
 * transaction. The error text (null = it landed) and rows the LAST step touched.
 */
async function attempt(
  who: string,
  steps: Array<[sql: string, params: unknown[]]>,
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
    let n = 0;
    for (const [sql, params] of steps) n = (await db.query(sql, params)).affectedRows ?? 0;
    return { err: null, n };
  } catch (e) {
    return { err: (e as Error).message, n: 0 };
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}
function refusedByGuard(r: { err: string | null }, what: string): void {
  assert.ok(r.err, `${what} LANDED — a supplier opened a conversation on an event they are not part of`);
  assert.ok(r.err.includes(MARKER), `${what} was refused for the wrong reason: ${r.err}`);
}
function landed(r: { err: string | null; n: number }, what: string): void {
  assert.equal(r.err, null, `${what} was refused: ${r.err}`);
  assert.equal(r.n, 1, `${what} touched ${r.n} rows — nothing was proven`);
}

const FOLLOW = `INSERT INTO public.vendor_follows (follower_user_id, vendor_profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
const OPEN = `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`;
const follow = (uid: string): [string, unknown[]] => [FOLLOW, [uid, F.vendorId]];
const open = (eventId: string, uid: string): [string, unknown[]] => [OPEN, [eventId, F.vendorId, uid]];

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
  F.couple = await mkUser('opener-couple@thread.test', 'customer');
  F.strangerCouple = await mkUser('opener-stranger-couple@thread.test', 'customer');
  F.supplier = await mkUser('opener-supplier@thread.test', 'vendor');
  F.agent = await mkUser('opener-agent@thread.test', 'vendor');

  F.vendorId = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Opener Test Band')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [F.supplier],
    )
  ).rows[0]!.v;
  F.serviceId = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
       VALUES ($1, 'photography', 40000, 'Free extra hour') RETURNING vendor_service_id AS s`,
      [F.vendorId],
    )
  ).rows[0]!.s;

  const ev = async (name: string, coupleUid: string) => {
    const id = (
      await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS e`, [name])
    ).rows[0]!.e;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [id, coupleUid]);
    return id;
  };
  F.eventId = await ev('Opener Test Wedding', F.couple);
  F.strangerEventId = await ev('Somebody Else’s Wedding', F.strangerCouple);
  F.agentEventId = await ev('A Customer the Agent Was Given', F.strangerCouple);

  // The agent arm: a team member of the shop, assigned the service that sits on
  // the customer's event — the relationship the insert policy's third arm reads.
  const member = (
    await db.query<{ m: string }>(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'agent') RETURNING vendor_team_member_id AS m`,
      [F.vendorId, F.agent],
    )
  ).rows[0]!.m;
  await db.query(`INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id) VALUES ($1, $2)`, [F.serviceId, member]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
     VALUES ($1, 'misc', 'Opener Test Band', 'shortlisted', $2, $3)`,
    [F.agentEventId, F.vendorId, F.serviceId],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · anti-vacuity ─────────────────────────────────────────────────────── */

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

test('META: the probing role is authenticated, not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean; super: boolean }>(
    `SELECT current_user AS me,
            pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super
       FROM pg_class c WHERE c.oid = 'public.chat_threads'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated', 'SET ROLE did not take');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table');
  assert.equal(r.rows[0]!.bypass, false, 'the probing role has BYPASSRLS');
  assert.equal(r.rows[0]!.super, false, 'the probing role is a superuser');
});

test('META: RLS bites this session — with the guard off and no follow, the follow gate refuses on its own', async () => {
  // (With the guard on, the BEFORE trigger answers first — so switch it off to
  // see the policy layer by itself.)
  const r = await attempt(F.supplier, [open(F.strangerEventId, F.supplier)], { withoutGuard: true });
  assert.ok(r.err, 'a thread landed with no follow at all — RLS is not enforced in this probe');
  assert.match(r.err, /chat_threads_follow_gate/);
});

/* ── 1 · the door ─────────────────────────────────────────────────────────── */

test('a supplier who follows their own shop still cannot open a thread on a stranger’s event', async () => {
  let refused = 0;
  const variants: Array<[string, Array<[string, unknown[]]>]> = [
    ['plain insert', [follow(F.supplier), open(F.strangerEventId, F.supplier)]],
    ['insert … ON CONFLICT DO NOTHING (the app’s upsert shape)', [
      follow(F.supplier),
      [`${OPEN} ON CONFLICT (event_id, vendor_profile_id) DO NOTHING`, [F.strangerEventId, F.vendorId, F.supplier]],
    ]],
    ['naming the couple as its creator', [follow(F.supplier), open(F.strangerEventId, F.strangerCouple)]],
    ['on a customer event only the shop’s AGENT was given', [follow(F.supplier), open(F.agentEventId, F.supplier)]],
  ];
  for (const [what, steps] of variants) {
    refusedByGuard(await attempt(F.supplier, steps), what);
    refused += 1;
  }
  console.log(`# supplier opener attempts refused: ${refused}/${variants.length}`);
  assert.equal(refused, variants.length);
});

test('NEUTRALISED: with the guard off, the same attack lands — so the refusal is this rule', async () => {
  landed(
    await attempt(F.supplier, [follow(F.supplier), open(F.strangerEventId, F.supplier)], { withoutGuard: true }),
    'the attack with the guard disabled',
  );
});

/* ── 2 · every opener that must keep working ─────────────────────────────── */

test('the couple opens a conversation on their own event', async () => {
  landed(await attempt(F.couple, [follow(F.couple), open(F.eventId, F.couple)]), 'the couple’s own inquiry');
});

test('the couple’s resume (upsert on the existing pair) still passes', async () => {
  await db.query(OPEN, [F.eventId, F.vendorId, F.couple]); // the thread already exists
  try {
    const r = await attempt(F.couple, [
      follow(F.couple),
      [`${OPEN} ON CONFLICT (event_id, vendor_profile_id) DO NOTHING`, [F.eventId, F.vendorId, F.couple]],
    ]);
    assert.equal(r.err, null, `the couple’s resume was refused: ${r.err}`);
  } finally {
    await db.query(`DELETE FROM public.chat_threads WHERE event_id = $1 AND vendor_profile_id = $2`, [F.eventId, F.vendorId]);
  }
});

test('a shop’s agent opens a conversation on a customer event they were given', async () => {
  landed(await attempt(F.agent, [follow(F.agent), open(F.agentEventId, F.agent)]), 'the agent’s opener');
});

test('the service role (a claimed invite’s pre-seeded thread) is untouched', async () => {
  landed(await attempt('service_role', [open(F.strangerEventId, F.supplier)]), 'the service-role pre-seed');
});

test('the supplier still ANSWERS a conversation the couple opened', async () => {
  const t = (
    await db.query<{ t: string }>(`${OPEN} RETURNING thread_id AS t`, [F.eventId, F.vendorId, F.couple])
  ).rows[0]!.t;
  try {
    landed(
      await attempt(F.supplier, [
        [`UPDATE public.chat_threads SET inquiry_status = 'accepted', accepted_at = now() WHERE thread_id = $1`, [t]],
      ]),
      'the supplier accepting the couple’s inquiry',
    );
  } finally {
    await db.query(`DELETE FROM public.chat_threads WHERE thread_id = $1`, [t]);
  }
});

/* ── 3 · the object ───────────────────────────────────────────────────────── */

test('the guard stays SECURITY INVOKER, a live BEFORE INSERT OR UPDATE trigger, and no RPC', async () => {
  const r = await db.query<{ secdef: boolean; auth: boolean; anon: boolean; live: boolean }>(
    `SELECT p.prosecdef AS secdef,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.chat_threads'::regclass
                      AND t.tgname = $1 AND (t.tgtype & 2) = 2 AND (t.tgtype & 4) = 4
                      AND (t.tgtype & 16) = 16 AND t.tgenabled = 'O') AS live
       FROM pg_proc p WHERE p.oid = 'public.tg_chat_threads_guard_sides()'::regprocedure`,
    [GUARD],
  );
  assert.deepEqual(r.rows[0], { secdef: false, auth: false, anon: false, live: true });
});
