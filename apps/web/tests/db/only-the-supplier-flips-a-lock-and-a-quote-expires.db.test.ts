/**
 * ONLY THE SUPPLIER FLIPS A LOCK · A QUOTE EXPIRES · ONE CALL TIME · THE HOST'S AGREE · DECISION TOPICS
 * Supplier Build 3 · lane B · round 2 · migration 20271332497337.
 *
 * ⚖ FINAL RULINGS 2026-11-09 — "Only the supplier edits the quotation, its payment plan and their forms. Hosts AND the
 *   coordinator never edit them … Three separate supplier locks … A lock hides Ask for a change on that item, and the
 *   server refuses requests. Each flip posts a chat line. A locked quote still expires." · "Accepted quotes never
 *   expire." · the sixth blocker, "expired quotation".
 * ⚖ Approved 2026-11-09 (1) — "Either side may close a decision topic, and anyone may reopen it."
 * ⚖ DECISION_LOG 🤝 2026-11-08 — the host agrees once, when sending the payment proof, that a coordinator / planner
 *   may access the event; the agreement is recorded (who, when).
 *
 * Run (from apps/web): tsx --test tests/db/only-the-supplier-flips-a-lock-and-a-quote-expires.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const FILE = '20271332497337_only_the_supplier_flips_a_lock_and_a_quote_expires.sql';

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
const uniq = () => `lk-${++seq}`;
async function newUser(firstName: string): Promise<string> {
  const r = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  await db.query(`UPDATE public.users SET first_name = $2 WHERE user_id = $1`, [r.id, firstName]);
  return r.id;
}
async function newShop(owner: string, services: string[] = ['photography']): Promise<string> {
  return (
    await one<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1, $2, 'Manila', $3::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`,
      [owner, `Shop ${uniq()}`, services],
    )
  ).v;
}

type World = {
  eventId: string;
  host: string;
  coordinator: string;
  supplier: string;
  viewerTeammate: string;
  stranger: string;
  shop: string;
  threadId: string;
};
async function newWorld(opts: { services?: string[] } = {}): Promise<World> {
  const host = await newUser('Ana');
  const coordinator = await newUser('Cora');
  const supplier = await newUser('Sol');
  const viewerTeammate = await newUser('Vic');
  const stranger = await newUser('Xia');
  const shop = await newShop(supplier, opts.services);
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1,$2,'viewer')`, [shop, viewerTeammate]);
  const eventId = (
    await one<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2099-12-12', 'day') RETURNING event_id AS e`,
    )
  ).e;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple'), ($1,$3,'coordinator')`,
    [eventId, host, coordinator],
  );
  const threadId = (
    await one<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id AS t`,
      [eventId, shop, host],
    )
  ).t;
  return { eventId, host, coordinator, supplier, viewerTeammate, stranger, shop, threadId };
}
async function quote(w: World, status: 'draft' | 'sent' | 'accepted', validUntilSql = `(NOW() AT TIME ZONE 'Asia/Manila')::date + 7`): Promise<string> {
  // Fixtures may hold a date the send trigger would refuse today (a quote that lapsed): seeded with it switched off.
  await db.exec(`ALTER TABLE public.vendor_proposals DISABLE TRIGGER vendor_proposals_valid_until`);
  try {
    return (
      await one<{ p: string }>(
        `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until)
         VALUES ($1, $2, 'Full day coverage', 9900000, $3, ${validUntilSql}) RETURNING proposal_id AS p`,
        [w.shop, w.eventId, status],
      )
    ).p;
  } finally {
    await db.exec(`ALTER TABLE public.vendor_proposals ENABLE TRIGGER vendor_proposals_valid_until`);
  }
}
const locks = (p: string) => one<{ c: boolean; l: boolean }>(`SELECT changes_locked AS c, plan_locked AS l FROM public.vendor_proposals WHERE proposal_id = $1`, [p]);
const lines = async (w: World) =>
  (await db.query<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role = 'system' ORDER BY created_at`, [w.threadId])).rows.map((r) => r.body);

test('the migration is applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((x) => x.file === FILE), `${FILE} was skipped during replay`);
});

// ── 1 · only the supplier flips a lock ──────────────────────────────────────

test('a quote lock: the host and the coordinator are refused, the supplier passes and a line is posted', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent');
  for (const uid of [w.host, w.coordinator, w.viewerTeammate, w.stranger]) {
    // The direct write: RLS hides the row (no UPDATE policy) — nothing changes.
    await as(uid, () => db.query(`UPDATE public.vendor_proposals SET changes_locked = TRUE, plan_locked = TRUE WHERE proposal_id = $1`, [p]));
    assert.deepEqual(await locks(p), { c: false, l: false }, `a non-supplier (${uid}) flipped a quote lock directly`);
    // The door: refused by name.
    const r = await as(uid, () => one<{ r: string }>(`SELECT public.vendor_set_proposal_lock($1, 'changes', TRUE) AS r`, [p]));
    assert.equal(r.r, 'not_allowed');
  }
  assert.equal((await as(w.supplier, () => one<{ r: string }>(`SELECT public.vendor_set_proposal_lock($1, 'changes', TRUE) AS r`, [p]))).r, 'ok');
  assert.equal((await as(w.supplier, () => one<{ r: string }>(`SELECT public.vendor_set_proposal_lock($1, 'plan', TRUE) AS r`, [p]))).r, 'ok');
  assert.deepEqual(await locks(p), { c: true, l: true });
  const said = await lines(w);
  assert.ok(said.some((b) => /^Quotation locked/.test(b)) && said.some((b) => /^Payment plan locked/.test(b)), said.join(' | '));
});

test('the lock COLUMN is the supplier’s whatever policy admits the row — a host-side write is refused by the trigger', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent');
  // Simulate a future policy that admits a host (or a DEFINER writer acting under the host's uid): the row is reached,
  // and the column rule still refuses.
  await setAuthUid(db, w.host);
  const err = await db.query(`UPDATE public.vendor_proposals SET changes_locked = TRUE WHERE proposal_id = $1`, [p]).then(
    () => null,
    (e: Error) => e.message,
  );
  await reset();
  assert.match(err ?? '', /ONLY_THE_SUPPLIER/);
  // The coordinator likewise.
  await setAuthUid(db, w.coordinator);
  const err2 = await db.query(`UPDATE public.vendor_proposals SET plan_locked = TRUE WHERE proposal_id = $1`, [p]).then(
    () => null,
    (e: Error) => e.message,
  );
  await reset();
  assert.match(err2 ?? '', /ONLY_THE_SUPPLIER/);
  // A write that leaves the locks alone is not this trigger's business.
  await setAuthUid(db, w.host);
  await db.query(`UPDATE public.vendor_proposals SET title = title WHERE proposal_id = $1`, [p]);
  await reset();
});

test('a draft: the supplier flips both locks by a plain update; nobody else can', async () => {
  const w = await newWorld();
  const p = await quote(w, 'draft', 'NULL');
  await as(w.supplier, () => db.query(`UPDATE public.vendor_proposals SET changes_locked = TRUE WHERE proposal_id = $1`, [p]));
  assert.equal((await locks(p)).c, true);
  for (const uid of [w.host, w.coordinator]) {
    await as(uid, () => db.query(`UPDATE public.vendor_proposals SET changes_locked = FALSE WHERE proposal_id = $1`, [p]));
  }
  assert.equal((await locks(p)).c, true, 'a host or coordinator unlocked a draft');
});

test('a sent form and the questions set: the host and the coordinator are refused, a viewer teammate too; the supplier passes', async () => {
  const w = await newWorld();
  const form = (await one<{ f: string }>(`INSERT INTO public.vendor_forms (vendor_profile_id, title) VALUES ($1, 'Shot list') RETURNING form_id AS f`, [w.shop])).f;
  await db.query(`INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, sent_by, thread_id) VALUES ($1,$2,$3,'supplier',$4)`, [w.eventId, form, w.shop, w.threadId]);
  await db.query(`INSERT INTO public.event_question_requests (event_id, vendor_profile_id, thread_id) VALUES ($1,$2,$3)`, [w.eventId, w.shop, w.threadId]);
  const formLocked = async () => (await one<{ l: boolean }>(`SELECT locked AS l FROM public.event_form_sends WHERE event_id = $1 AND form_id = $2`, [w.eventId, form])).l;
  const qLocked = async () => (await one<{ l: boolean }>(`SELECT locked AS l FROM public.event_question_requests WHERE event_id = $1 AND vendor_profile_id = $2`, [w.eventId, w.shop])).l;

  for (const uid of [w.host, w.coordinator, w.stranger]) {
    await as(uid, () => db.query(`UPDATE public.event_form_sends SET locked = TRUE WHERE event_id = $1`, [w.eventId]));
    await as(uid, () => db.query(`UPDATE public.event_question_requests SET locked = TRUE WHERE event_id = $1`, [w.eventId]));
    assert.equal((await as(uid, () => one<{ r: string }>(`SELECT public.vendor_set_form_lock('form', $1, $2, TRUE) AS r`, [w.eventId, form]))).r, 'not_allowed');
  }
  assert.equal(await formLocked(), false);
  assert.equal(await qLocked(), false);
  // A viewer on the shop's own team reaches the row through the team policy — the column rule refuses.
  const viewerErr = await attempt(w.viewerTeammate, () => db.query(`UPDATE public.event_form_sends SET locked = TRUE WHERE event_id = $1 AND form_id = $2`, [w.eventId, form]));
  assert.match(viewerErr ?? '', /ONLY_THE_SUPPLIER/);
  assert.equal(await formLocked(), false);

  assert.equal((await as(w.supplier, () => one<{ r: string }>(`SELECT public.vendor_set_form_lock('form', $1, $2, TRUE) AS r`, [w.eventId, form]))).r, 'ok');
  assert.equal((await as(w.supplier, () => one<{ r: string }>(`SELECT public.vendor_set_form_lock('questions', $1, NULL, TRUE) AS r`, [w.eventId]))).r, 'ok');
  assert.equal(await formLocked(), true);
  assert.equal(await qLocked(), true);
  assert.ok((await lines(w)).filter((b) => /^Form locked/.test(b)).length === 2);
});

// ── 2 · the refusal check ───────────────────────────────────────────────────

test('supplier_lock_refusal: may ask while unlocked, refused once locked, nothing for a stranger', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent');
  const ask = (uid: string, kind: string, id: string, ev: string | null = null) =>
    as(uid, async () => (await one<{ r: string | null }>(`SELECT public.supplier_lock_refusal($1, $2, $3) AS r`, [kind, id, ev])).r);
  assert.equal(await ask(w.host, 'quote', p), null);
  assert.equal(await ask(w.coordinator, 'plan', p), null);
  await as(w.supplier, () => db.query(`SELECT public.vendor_set_proposal_lock($1, 'changes', TRUE)`, [p]));
  assert.equal(await ask(w.host, 'quote', p), 'quote_locked');
  assert.equal(await ask(w.coordinator, 'quote', p), 'quote_locked');
  assert.equal(await ask(w.host, 'plan', p), null, 'the plan lock is separate from the quote lock');
  assert.equal(await ask(w.stranger, 'quote', p), 'not_found', 'a stranger learned a lock state');
  assert.equal(await ask(w.host, 'nonsense', p), 'not_found');
});

test('a locked quotation refuses the hosts’ counter-offer at the database; the supplier’s own amendment passes', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent');
  const amend = (raisedBy: 'couple' | 'vendor', base: string | null) =>
    db.query(
      `INSERT INTO public.proposal_amendments (event_id, vendor_profile_id, thread_id, base_proposal_id, raised_by, status)
       VALUES ($1, $2, $3, $4, $5, 'proposed')`,
      [w.eventId, w.shop, w.threadId, base, raisedBy],
    );
  await amend('couple', p); // unlocked: may ask
  await as(w.supplier, () => db.query(`SELECT public.vendor_set_proposal_lock($1, 'changes', TRUE)`, [p]));
  await assert.rejects(amend('couple', p), /QUOTE_LOCKED/);
  await assert.rejects(amend('couple', null), /QUOTE_LOCKED/, 'no base given: the live quote’s lock still holds');
  await amend('vendor', p); // the supplier's own word on their own price
  await as(w.supplier, () => db.query(`SELECT public.vendor_set_proposal_lock($1, 'plan', TRUE)`, [p]));
  await as(w.supplier, () => db.query(`SELECT public.vendor_set_proposal_lock($1, 'changes', FALSE)`, [p]));
  await amend('couple', p); // the plan lock is not the quote lock
});

// ── 3 · a quote expires ─────────────────────────────────────────────────────

test('a lapsed quote cannot be accepted; the writer expires it with a line; accepted and legacy quotes never expire', async () => {
  const w = await newWorld();
  const lapsed = await quote(w, 'sent', `(NOW() AT TIME ZONE 'Asia/Manila')::date - 1`);
  const lastDay = await quote(w, 'sent', `(NOW() AT TIME ZONE 'Asia/Manila')::date`);
  const accepted = await quote(w, 'accepted', `(NOW() AT TIME ZONE 'Asia/Manila')::date - 30`);
  await db.exec(`ALTER TABLE public.vendor_proposals DISABLE TRIGGER vendor_proposals_valid_until`);
  const legacy = (
    await one<{ p: string }>(
      `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until, valid_until_legacy)
       VALUES ($1,$2,'Old quote',100,'sent',NULL,TRUE) RETURNING proposal_id AS p`,
      [w.shop, w.eventId],
    )
  ).p;
  await db.exec(`ALTER TABLE public.vendor_proposals ENABLE TRIGGER vendor_proposals_valid_until`);

  const acceptErr = await attempt(w.host, () => db.query(`SELECT public.respond_vendor_proposal($1, 'accepted')`, [lapsed]));
  assert.match(acceptErr ?? '', /QUOTE_EXPIRED/, 'a quote past its Valid until was accepted');

  assert.equal((await as(w.stranger, () => one<{ n: number }>(`SELECT public.expire_lapsed_quotes($1,$2) AS n`, [w.eventId, w.shop]))).n, 0, 'a stranger expired quotes');
  assert.equal((await as(w.host, () => one<{ n: number }>(`SELECT public.expire_lapsed_quotes($1,$2) AS n`, [w.eventId, w.shop]))).n, 1);
  const status = async (p: string) => (await one<{ s: string }>(`SELECT status AS s FROM public.vendor_proposals WHERE proposal_id = $1`, [p])).s;
  assert.equal(await status(lapsed), 'expired');
  assert.equal(await status(lastDay), 'sent', 'a quote on its last valid day expired early');
  assert.equal(await status(accepted), 'accepted', 'an accepted quote expired');
  assert.equal(await status(legacy), 'sent', 'a legacy quote with no date expired');
  assert.ok((await lines(w)).some((b) => /^Quotation expired · Full day coverage/.test(b)));
  // Running it again changes nothing.
  assert.equal((await as(w.supplier, () => one<{ n: number }>(`SELECT public.expire_lapsed_quotes($1,$2) AS n`, [w.eventId, w.shop]))).n, 0);

  const flipErr = await db.query(`UPDATE public.vendor_proposals SET status = 'expired' WHERE proposal_id = $1`, [accepted]).then(
    () => null,
    (e: Error) => e.message,
  );
  assert.match(flipErr ?? '', /ACCEPTED_NEVER_EXPIRES/);
});

test('a locked quote still expires', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent', `(NOW() AT TIME ZONE 'Asia/Manila')::date - 2`);
  await as(w.supplier, () => db.query(`SELECT public.vendor_set_proposal_lock($1, 'changes', TRUE)`, [p]));
  await as(w.supplier, () => db.query(`SELECT public.expire_lapsed_quotes($1,$2)`, [w.eventId, w.shop]));
  assert.equal((await one<{ s: string }>(`SELECT status AS s FROM public.vendor_proposals WHERE proposal_id = $1`, [p])).s, 'expired');
});

// ── 4 · the call time reader ────────────────────────────────────────────────

test('chat_call_time_for: the earliest tagged timed moment, a TBA chapter gives none, strangers get nothing', async () => {
  const w = await newWorld();
  const booking = (
    await one<{ v: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id) VALUES ($1,'photographer','Sol',$2) RETURNING vendor_id AS v`,
      [w.eventId, w.shop],
    )
  ).v;
  const call = (uid: string) => as(uid, async () => (await one<{ t: string | null }>(`SELECT to_char(public.chat_call_time_for($1,$2) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS t`, [w.eventId, w.shop])).t);
  assert.equal(await call(w.supplier), null, 'a call time before any moment was tagged');
  const block = (label: string, at: string, extra: Record<string, unknown> = {}) =>
    one<{ b: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids, time_tba, parent_block_id, is_public)
       VALUES ($1,$2,$3::timestamptz,$4::uuid[],$5,$6,FALSE) RETURNING block_id AS b`,
      [w.eventId, label, at, extra.tagged === false ? [] : [booking], extra.tba ?? false, extra.parent ?? null],
    );
  const tbaChapter = await block('Reception', '2099-12-12T00:00:00Z', { tba: true });
  await block('Toast', '2099-12-12T01:00:00Z', { parent: tbaChapter.b });
  assert.equal(await call(w.supplier), null, 'a TBA chapter (or a moment inside it) gave a call time');
  await block('Untagged prep', '2099-12-12T00:30:00Z', { tagged: false });
  await block('Ingress', '2099-12-12T02:00:00Z');
  await block('Ceremony', '2099-12-12T05:00:00Z');
  assert.match((await call(w.supplier)) ?? '', /2099-12-12 02:00:00/);
  assert.match((await call(w.host)) ?? '', /2099-12-12 02:00:00/);
  assert.equal(await call(w.stranger), null, 'a stranger read a call time');
});

// ── 5 · the host's Agree for a coordinator / planner ────────────────────────

test('host_agree_coordinator_access: a host agrees once (who, when, a line); the coordinator and the supplier cannot', async () => {
  const w = await newWorld({ services: ['planner_coordinator'] });
  const agree = (uid: string) => as(uid, async () => (await one<{ r: string }>(`SELECT public.host_agree_coordinator_access($1,$2) AS r`, [w.eventId, w.shop])).r);
  assert.equal(await agree(w.host), 'not_booked');
  await db.query(`INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id) VALUES ($1,'misc','Cora & Co',$2)`, [w.eventId, w.shop]);
  assert.equal(await agree(w.coordinator), 'not_a_host');
  assert.equal(await agree(w.supplier), 'not_a_host');
  assert.equal(await agree(w.host), 'ok');
  assert.equal(await agree(w.host), 'already');
  const row = await as(w.supplier, () =>
    one<{ by: string; at: string | null }>(`SELECT consented_by_user_id AS by, granted_at::text AS at FROM public.coordinator_access_consents WHERE event_id = $1 AND vendor_profile_id = $2`, [w.eventId, w.shop]),
  );
  assert.equal(row.by, w.host, 'the supplier cannot read who agreed');
  assert.ok((await lines(w)).some((b) => /^Access agreed/.test(b)));
  // A shop that is not the coordinator trade is never "agreed into" the whole event.
  const p = await newWorld();
  await db.query(`INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id) VALUES ($1,'photographer','Sol',$2)`, [p.eventId, p.shop]);
  assert.equal((await as(p.host, () => one<{ r: string }>(`SELECT public.host_agree_coordinator_access($1,$2) AS r`, [p.eventId, p.shop]))).r, 'not_a_coordinator');
});

test('chat_coordinator_agree_needed: true for a booked coordinator until a host agrees; false to a stranger and a non-coordinator', async () => {
  const w = await newWorld({ services: ['planner_coordinator'] });
  const needed = (uid: string, ev = w.eventId, shop = w.shop) =>
    as(uid, async () => (await one<{ r: boolean }>(`SELECT public.chat_coordinator_agree_needed($1,$2) AS r`, [ev, shop])).r);
  assert.equal(await needed(w.host), false, 'not booked yet: nothing to agree to');
  await db.query(`INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id) VALUES ($1,'misc','Cora & Co',$2)`, [w.eventId, w.shop]);
  assert.equal(await needed(w.host), true);
  assert.equal(await needed(w.supplier), true, 'the supplier sees it waits');
  assert.equal(await needed(w.stranger), false, 'a stranger learns nothing');
  await as(w.host, () => one(`SELECT public.host_agree_coordinator_access($1,$2) AS r`, [w.eventId, w.shop]));
  assert.equal(await needed(w.host), false, 'agreed: the pin goes');
  const p = await newWorld();
  await db.query(`INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id) VALUES ($1,'photographer','Sol',$2)`, [p.eventId, p.shop]);
  assert.equal(await needed(p.host, p.eventId, p.shop), false, 'a photographer is never asked an Agree');
});

// ── 6 · decision topics ─────────────────────────────────────────────────────

test('a decision topic: either side closes it, anyone in the chat reopens it; strangers and direct writes are refused', async () => {
  const w = await newWorld();
  const id = (await as(w.host, () => one<{ t: string }>(`SELECT public.chat_decision_open($1, 'Ceremony venue') AS t`, [w.threadId]))).t;
  const closed = async () => (await one<{ c: string | null }>(`SELECT closed_at::text AS c FROM public.chat_decision_topics WHERE topic_id = $1`, [id])).c;
  const set = (uid: string, c: boolean) => as(uid, async () => (await one<{ r: string }>(`SELECT public.chat_decision_set_closed($1,$2) AS r`, [id, c])).r);

  assert.equal(await set(w.stranger, true), 'not_found');
  assert.equal(await closed(), null);
  assert.equal(await set(w.supplier, true), 'ok', 'the supplier side could not close');
  assert.notEqual(await closed(), null);
  assert.equal(await set(w.supplier, true), 'unchanged');
  assert.equal(await set(w.coordinator, false), 'ok', 'the coordinator could not reopen');
  assert.equal(await closed(), null);
  assert.equal(await set(w.host, true), 'ok', 'the host side could not close');
  assert.equal(await set(w.supplier, false), 'ok');
  const said = await lines(w);
  for (const re of [/^Decision opened · Ceremony venue/, /^Decision closed · Ceremony venue/, /^Decision reopened · Ceremony venue/]) {
    assert.ok(said.some((b) => re.test(b)), `${re} missing: ${said.join(' | ')}`);
  }
  // Read by the conversation, not by a stranger.
  const seen = (uid: string) => as(uid, async () => (await db.query(`SELECT 1 FROM public.chat_decision_topics WHERE topic_id = $1`, [id])).rows.length);
  assert.equal(await seen(w.host), 1);
  assert.equal(await seen(w.supplier), 1);
  assert.equal(await seen(w.coordinator), 1);
  assert.equal(await seen(w.stranger), 0);
  // No direct write path.
  const direct = await attempt(w.host, () => db.query(`INSERT INTO public.chat_decision_topics (thread_id, title) VALUES ($1, 'Sneaky')`, [w.threadId]));
  assert.ok(direct, 'a direct insert went through');
  const opened = await attempt(w.stranger, () => db.query(`SELECT public.chat_decision_open($1, 'Not mine')`, [w.threadId]));
  assert.match(opened ?? '', /NOT_IN_THIS_CHAT/);
});

// ── 7 · a private line does not move the thread ─────────────────────────────

test('the thread’s stamp moves for a shared line and not for a private one', async () => {
  const w = await newWorld();
  const stamp = async () => (await one<{ u: string }>(`SELECT updated_at::text AS u FROM public.chat_threads WHERE thread_id = $1`, [w.threadId])).u;
  const send = (body: string, recipient: string | null) =>
    as(w.host, () =>
      db.query(
        recipient
          ? `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, recipient_user_id) VALUES ($1,$2,$3,$4,$5)`
          : `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,$4)`,
        recipient ? [w.threadId, w.eventId, w.shop, body, recipient] : [w.threadId, w.eventId, w.shop, body],
      ),
    );
  await send('For everyone', null);
  const afterShared = await stamp();
  await db.query(`SELECT pg_sleep(0.01)`);
  await send('Only for Sol', w.supplier);
  assert.equal(await stamp(), afterShared, 'a private line moved the thread for everyone');
});
