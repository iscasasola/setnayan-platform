/**
 * A MASKED COORDINATOR READS NO AMOUNT BY ANY ROUTE — Supplier Build 3 · lane B · round 4 · migration 20271333705710.
 *
 * ⚖ FINAL RULINGS 2026-11-09: a coordinator without Budget & payments reads every amount as "₱ — hosts only",
 *   "stripped server-side". Round 3 masked the chat SCREEN; this proves the DATABASE: signed in as that coordinator,
 *   every route the measurement found (the migration header lists them) returns no row or a masked value — and
 *   hosts and the shop still read the real figures.
 *
 * The coordinator here also holds a Suppliers delegate grant WITHOUT Budget (the default coordinator grant,
 * lib/delegate-areas.ts) — the worst case: it opens the delegate routes (vendor_proposals, change orders, payment
 * asks, reuse requests) on top of the member routes (chat lines, amendments).
 *
 * Realtime cannot run in PGlite. What it reads is proved instead: postgres_changes delivers a row only when the
 * subscriber's RLS admits it, carrying only the columns the subscriber may SELECT — so the policy and the column
 * grant asserted here are the realtime closure.
 *
 * Run (from apps/web): tsx --test tests/db/a-masked-coordinator-reads-no-amount-by-any-route.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { HOSTS_ONLY } from '../../lib/money-mask';

let replay: ReplayResult;
let db: PGlite;
const ROUND4_FILE = '20271333705710_a_masked_coordinator_reads_no_amount_by_any_route.sql';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(reset);

async function reset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
const q = <T>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);

let seq = 0;
const uniq = () => `r4-${++seq}`;
async function newUser(name: string): Promise<string> {
  const id = (await q<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`]))[0]!.id;
  await q(`UPDATE public.users SET first_name = $2 WHERE user_id = $1`, [id, name]);
  return id;
}

type World = {
  eventId: string; host: string; coordinator: string; supplier: string; shop: string; threadId: string;
  booking: string; proposal: string; amendment: string; moneyLine: string; plainLine: string;
};
async function newWorld(coordinatorAreas: Record<string, string> = { vendors: 'edit' }): Promise<World> {
  const host = await newUser('Ana');
  const coordinator = await newUser('Cora');
  const supplier = await newUser('Sol');
  const shop = (await q<{ v: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`,
    [supplier, `Shop ${uniq()}`]))[0]!.v;
  const eventId = (await q<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id AS e`))[0]!.e;
  await q(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple'), ($1,$3,'coordinator')`,
    [eventId, host, coordinator]);
  await q(`INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
           VALUES ($1, $2, 'wedding_planner_external', $3::jsonb, NOW())`,
    [eventId, coordinator, JSON.stringify({ areas: coordinatorAreas })]);
  const booking = (await q<{ v: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, deposit_paid_php)
     VALUES ($1, 'photographer', 'Lumina', 'contracted', $2, 99000, 20000) RETURNING vendor_id AS v`,
    [eventId, shop]))[0]!.v;
  const threadId = (await q<{ t: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status, agreed_price_centavos)
     VALUES ($1,$2,$3,'accepted', 9900000) RETURNING thread_id AS t`, [eventId, shop, host]))[0]!.t;
  const send = (uid: string, body: string) => as(uid, async () =>
    (await q<{ m: string }>(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
                             VALUES ($1,$2,$3,$4) RETURNING message_id AS m`, [threadId, eventId, shop, body]))[0]!.m);
  const moneyLine = await send(host, 'The deposit is ₱20,000 and PHP 79,000 on the day');
  const plainLine = await send(supplier, 'See you at 2pm');
  await q(`INSERT INTO public.chat_decision_topics (thread_id, title, opened_by_user_id) VALUES ($1, 'Pay ₱2,000 for the drone?', $2),
                                                                                         ($1, 'Venue walk-through', $2)`,
    [threadId, host]);
  const proposal = (await q<{ p: string }>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until)
     VALUES ($1, $2, 'Full day — ₱99,000', 9900000, 'sent', (NOW() AT TIME ZONE 'Asia/Manila')::date + 7) RETURNING proposal_id AS p`,
    [shop, eventId]))[0]!.p;
  const amendment = (await q<{ a: string }>(
    `INSERT INTO public.proposal_amendments (event_id, vendor_profile_id, thread_id, base_proposal_id, raised_by, status, note)
     VALUES ($1, $2, $3, $4, 'vendor', 'proposed', 'Add ₱4,500 for the drone') RETURNING amendment_id AS a`,
    [eventId, shop, threadId, proposal]))[0]!.a;
  await q(`INSERT INTO public.proposal_amendment_items (amendment_id, event_id, vendor_profile_id, item_kind, label, amount_php)
           VALUES ($1, $2, $3, 'addon', 'Drone', 4500)`, [amendment, eventId, shop]);
  await q(`INSERT INTO public.vendor_change_orders (event_vendor_id, event_id, vendor_profile_id, raised_by, title, delta_amount_php)
           VALUES ($1, $2, $3, 'vendor', 'One more hour', 5000)`, [booking, eventId, shop]);
  await q(`INSERT INTO public.vendor_payment_asks (event_id, vendor_profile_id, event_vendor_id, amount_php) VALUES ($1, $2, $3, 20000)`,
    [eventId, shop, booking]);
  await q(`INSERT INTO public.vendor_reuse_requests (vendor_profile_id, target_event_id, status, quoted_total_php)
           VALUES ($1, $2, 'quoted', 12000)`, [shop, eventId]);
  return { eventId, host, coordinator, supplier, shop, threadId, booking, proposal, amendment, moneyLine, plainLine };
}

/** Every route the migration header lists, read as `uid` — what each one hands back. */
async function routes(w: World, uid: string) {
  return as(uid, async () => {
    const one = async <T>(sql: string, params: unknown[]) => {
      try {
        return { rows: await q<T>(sql, params), refused: null as string | null };
      } catch (e) {
        await db.exec('ROLLBACK').catch(() => {});
        return { rows: [] as T[], refused: (e as Error).message };
      }
    };
    return {
      chatLines: await one<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 ORDER BY created_at`, [w.threadId]),
      chatLinesRead: await one<{ body: string }>(`SELECT body FROM public.chat_thread_messages_read($1)`, [w.threadId]),
      agreedPrice: await one<{ p: string | null }>(`SELECT agreed_price_centavos::text AS p FROM public.chat_threads WHERE thread_id = $1`, [w.threadId]),
      threadRow: await one<{ id: string }>(`SELECT thread_id AS id, updated_at FROM public.chat_threads WHERE thread_id = $1`, [w.threadId]),
      topics: await one<{ title: string }>(`SELECT title FROM public.chat_decision_topics WHERE thread_id = $1 ORDER BY title`, [w.threadId]),
      amendments: await one<{ note: string | null }>(`SELECT note FROM public.proposal_amendments WHERE amendment_id = $1`, [w.amendment]),
      amendmentsRead: await one<{ note: string | null }>(`SELECT note FROM public.chat_amendments_read($1::uuid[])`, [[w.amendment]]),
      items: await one<{ a: string | null }>(`SELECT amount_php::text AS a FROM public.proposal_amendment_items WHERE amendment_id = $1`, [w.amendment]),
      itemsRead: await one<{ a: string | null }>(`SELECT amount_php::text AS a FROM public.chat_amendment_items_read($1::uuid[])`, [[w.amendment]]),
      proposals: await one<{ t: string | null }>(`SELECT total_centavos::text AS t FROM public.vendor_proposals WHERE proposal_id = $1`, [w.proposal]),
      proposalsRead: await one<{ t: string | null; title: string }>(`SELECT total_centavos::text AS t, title FROM public.chat_quotes_read($1,$2)`, [w.eventId, w.shop]),
      changeOrders: await one<{ a: string }>(`SELECT delta_amount_php::text AS a FROM public.vendor_change_orders WHERE event_id = $1`, [w.eventId]),
      paymentAsks: await one<{ a: string }>(`SELECT amount_php::text AS a FROM public.vendor_payment_asks WHERE event_id = $1`, [w.eventId]),
      reuse: await one<{ a: string | null }>(`SELECT quoted_total_php::text AS a FROM public.vendor_reuse_requests WHERE target_event_id = $1`, [w.eventId]),
      lineItems: await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_vendor_line_items WHERE event_id = $1`, [w.eventId]),
      payments: await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_vendor_payments WHERE event_id = $1`, [w.eventId]),
    };
  });
}
const FIGURE = /\d{1,3}(,\d{3})+|\b\d{4,}\b/;

test('the round-4 migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === ROUND4_FILE), `${ROUND4_FILE} was skipped during replay`);
});

test('signed in as a masked coordinator, EVERY route hands back no row or a masked value', async () => {
  const w = await newWorld();
  const r = await routes(w, w.coordinator);
  console.log('masked coordinator, route by route:', JSON.stringify(r));

  // chat lines — the money line is withheld from the table; the reader draws it masked; the plain line still reads.
  assert.deepEqual(r.chatLines.rows.map((x) => x.body), ['See you at 2pm'], 'a line naming an amount reached the coordinator');
  assert.deepEqual(r.chatLinesRead.rows.map((x) => x.body),
    [`The deposit is ${HOSTS_ONLY} and ${HOSTS_ONLY} on the day`, 'See you at 2pm']);
  // the frozen deal total — refused per column; the thread itself still reads.
  assert.match(r.agreedPrice.refused ?? '', /permission denied/i, 'chat_threads.agreed_price_centavos is selectable');
  assert.equal(r.threadRow.rows.length, 1, 'the coordinator lost the thread itself');
  // decision titles — the one naming an amount is withheld, the other stays.
  assert.deepEqual(r.topics.rows.map((x) => x.title), ['Venue walk-through']);
  // amendments and their lines.
  assert.equal(r.amendments.rows.length, 0, 'an amendment note naming an amount reached the coordinator');
  assert.ok(r.amendmentsRead.rows.length === 1 && !FIGURE.test(r.amendmentsRead.rows[0]!.note ?? ''), JSON.stringify(r.amendmentsRead));
  assert.equal(r.items.rows.length, 0, 'an amendment line reached the coordinator');
  assert.ok(r.itemsRead.rows.length === 1 && r.itemsRead.rows[0]!.a === null, JSON.stringify(r.itemsRead));
  // quotes — none from the table; the reader returns what the delegate grant admits, every figure gone.
  assert.equal(r.proposals.rows.length, 0, 'a quote total reached the coordinator from the table');
  assert.equal(r.proposalsRead.rows.length, 1);
  assert.equal(r.proposalsRead.rows[0]!.t, null);
  assert.ok(!FIGURE.test(r.proposalsRead.rows[0]!.title), r.proposalsRead.rows[0]!.title);
  // the supplier tabs' own money tables.
  for (const k of ['changeOrders', 'paymentAsks', 'reuse'] as const) {
    assert.equal(r[k].refused, null, `${k} errored instead of withholding`);
    assert.equal(r[k].rows.length, 0, `${k} reached the coordinator`);
  }
  assert.equal(r.lineItems.rows[0]!.n + r.payments.rows[0]!.n, 0);
});

test('hosts and the shop still read every real figure (nobody else is masked)', async () => {
  const w = await newWorld();
  for (const [who, uid] of [['host', w.host], ['shop', w.supplier]] as const) {
    const r = await routes(w, uid);
    assert.ok(r.chatLines.rows.some((x) => x.body.includes('₱20,000')), `${who} lost the money line`);
    assert.ok(r.chatLinesRead.rows.some((x) => x.body.includes('₱20,000')), `${who} reads the reader unmasked`);
    assert.equal(r.proposals.rows[0]?.t, '9900000', `${who} lost the quote total`);
    assert.equal(r.proposalsRead.rows[0]?.t, '9900000');
    assert.equal(r.amendments.rows[0]?.note, 'Add ₱4,500 for the drone', `${who} lost the amendment note`);
    assert.equal(Number(r.items.rows[0]?.a), 4500, `${who} lost the amendment line`);
    assert.equal(Number(r.changeOrders.rows[0]?.a), 5000, `${who} lost the change order`);
    assert.equal(Number(r.paymentAsks.rows[0]?.a), 20000, `${who} lost the payment ask`);
    assert.equal(Number(r.reuse.rows[0]?.a), 12000, `${who} lost the reuse quote`);
    assert.equal(r.topics.rows.length, 2, `${who} lost a decision`);
    // The frozen total is closed to EVERY browser role: no app code read it on a session (measured — it is written
    // and read on the service role only), so closing it per column takes nothing a host or the shop was shown.
    assert.match(r.agreedPrice.refused ?? '', /permission denied/i);
  }
});

test('a coordinator WITH Budget & payments reads the figures (the grant is the line)', async () => {
  const w = await newWorld({ vendors: 'edit', budget: 'view' });
  const r = await routes(w, w.coordinator);
  assert.ok(r.chatLines.rows.some((x) => x.body.includes('₱20,000')));
  assert.equal(r.proposals.rows[0]?.t, '9900000');
  assert.equal(Number(r.paymentAsks.rows[0]?.a), 20000);
  assert.equal(r.items.rows.length, 1);
});

test('a masked coordinator still reads and posts their OWN line with an amount', async () => {
  const w = await newWorld();
  const mine = await as(w.coordinator, async () =>
    (await q<{ body: string }>(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
                                VALUES ($1,$2,$3,'I can cover ₱500 of the tip') RETURNING body`, [w.threadId, w.eventId, w.shop]))[0]!.body);
  assert.equal(mine, 'I can cover ₱500 of the tip', 'INSERT … RETURNING refused the author their own line');
});

test('the readers’ door closes behind them: a read after one, in the SAME transaction, is still withheld', async () => {
  const w = await newWorld();
  const after = await as(w.coordinator, async () => {
    await db.exec('BEGIN');
    await q(`SELECT * FROM public.chat_quotes_read($1,$2)`, [w.eventId, w.shop]);
    await q(`SELECT * FROM public.chat_thread_messages_read($1)`, [w.threadId]);
    const p = await q<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_proposals WHERE event_id = $1`, [w.eventId]);
    const m = await q<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE message_id = $1`, [w.moneyLine]);
    await db.exec('COMMIT');
    return { p: p[0]!.n, m: m[0]!.n };
  });
  assert.deepEqual(after, { p: 0, m: 0 }, 'the masking readers left their door open');
});

test('realtime: both chat tables are published under RLS, and the frozen total is not a selectable column', async () => {
  const pub = await q<{ t: string }>(
    `SELECT tablename AS t FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
       AND tablename IN ('chat_messages','chat_threads','vendor_proposals','proposal_amendments','proposal_amendment_items',
                         'vendor_change_orders','vendor_payment_asks','vendor_reuse_requests','chat_decision_topics') ORDER BY 1`);
  // Only these two of the closed tables stream at all; postgres_changes applies the subscriber's RLS to each row.
  assert.deepEqual(pub.map((x) => x.t), ['chat_messages', 'chat_threads']);
  const rls = await q<{ r: boolean }>(`SELECT bool_and(relrowsecurity) AS r FROM pg_class WHERE oid IN ('public.chat_messages'::regclass, 'public.chat_threads'::regclass)`);
  assert.equal(rls[0]!.r, true);
  for (const role of ['anon', 'authenticated']) {
    const c = await q<{ ok: boolean }>(`SELECT has_column_privilege($1, 'public.chat_threads', 'agreed_price_centavos', 'SELECT') AS ok`, [role]);
    assert.equal(c[0]!.ok, false, `${role} can SELECT agreed_price_centavos — a realtime payload would carry it`);
  }
});

test('chat_threads: every OTHER column stays selectable by a signed-in session (a new column fails here until granted)', async () => {
  const cols = await q<{ c: string; ok: boolean }>(
    `SELECT column_name AS c, has_column_privilege('authenticated', 'public.chat_threads', column_name, 'SELECT') AS ok
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_threads' ORDER BY ordinal_position`);
  const closed = cols.filter((x) => !x.ok).map((x) => x.c);
  assert.deepEqual(closed, ['agreed_price_centavos'],
    'a chat_threads column is not selectable by authenticated — since 20271333705710 SELECT is granted per column; grant the new one');
});

/**
 * THE ROUTE REGISTER. Every table with an amount column that an event member or delegate can SELECT (the
 * migration's measurement, re-run here) is decided: CLOSED by this file, already budget-only, or OUT OF SCOPE
 * (couple-page money outside the chat and the supplier tabs — listed for the owner, not closed). A new table with
 * an amount on such a policy fails here until someone decides it.
 */
const DECIDED: Record<string, string> = {
  chat_threads: 'CLOSED — agreed_price_centavos per column',
  proposal_amendment_items: 'CLOSED — hosts-only policy; reader masks',
  vendor_proposals: 'CLOSED — hosts-only policy; reader masks',
  vendor_change_orders: 'CLOSED — hosts-only policy',
  vendor_payment_asks: 'CLOSED — hosts-only policy',
  vendor_reuse_requests: 'CLOSED — hosts-only policy',
  event_vendor_line_items: 'ALREADY BUDGET-ONLY — couple or the budget delegate area',
  event_vendor_payments: 'ALREADY BUDGET-ONLY — couple or the budget delegate area',
  event_vendors: 'OPEN — OWNER: the price columns ride on the row a Suppliers delegate reads; per-column needs a schema split. The supplier page masks every figure it draws.',
  orders: 'OUT OF SCOPE — the couple’s Setnayan purchases (current_couple_or_coordinator_event_ids)',
  events: 'OUT OF SCOPE — the event’s own budget band / Papic caps',
  budget_builds: 'OUT OF SCOPE — the budget planner',
  event_costs: 'OUT OF SCOPE — the budget page’s own costs',
  event_gift_records: 'OUT OF SCOPE — gifts',
  event_wish_items: 'OUT OF SCOPE — the wish list',
  manpower_gigs: 'OUT OF SCOPE — Manpower gigs',
  papic_guest_captures: 'OUT OF SCOPE — Papic points',
  papic_limited_snapshots: 'OUT OF SCOPE — Papic billing snapshot',
  booking_change_asks: 'CLOSED — amount_centavos · proposed_plan per column; change_asks_read masks (migration 20271340018194)',
};
test('every amount a member or delegate can SELECT is a decided route', async () => {
  const rows = await q<{ t: string }>(`
    SELECT DISTINCT c.table_name AS t
      FROM information_schema.columns c
      JOIN information_schema.tables tt ON tt.table_schema = c.table_schema AND tt.table_name = c.table_name AND tt.table_type = 'BASE TABLE'
      JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.table_name AND p.permissive = 'PERMISSIVE' AND p.cmd IN ('SELECT','ALL')
     WHERE c.table_schema = 'public'
       AND c.column_name ~* '(centavos|_php$|price|amount|total|deposit|fee|balance|cost)'
       AND c.data_type IN ('integer','bigint','numeric','smallint','real','double precision')
       AND COALESCE(p.qual,'') ~* '(current_event_ids|current_thread_ids|current_moderator|moderator_area|current_couple_or_coordinator|event_members)'
     ORDER BY 1`);
  const found = rows.map((x) => x.t);
  console.log('member/delegate-readable amount tables:', JSON.stringify(found));
  assert.deepEqual(found.filter((t) => !(t in DECIDED)), [], 'a new member-readable amount route — decide it in DECIDED');
});

test('a counter or a proposed plan: a masked coordinator reads no amount — the columns are closed, the reader masks', async () => {
  const w = await newWorld();
  await q(`INSERT INTO public.booking_change_asks (thread_id, event_id, vendor_profile_id, subject, proposal_id, note, asked_by, amount_centavos, proposed_plan, raised_by)
           VALUES ($1, $2, $3, 'quote', $4, 'Can we meet here?', $5, 9000000, NULL, 'host'),
                  ($1, $2, $3, 'plan', $4, '', $5, NULL, '{"installments":[{"seq":0,"amount_centavos":9900000}]}'::jsonb, 'supplier')`,
    [w.threadId, w.eventId, w.shop, w.proposal, w.host]);
  type Row = { kind: string; amount_centavos: string | null; proposed_plan: unknown; money_hidden: boolean };
  const read = (uid: string) => as(uid, () => q<Row>(`SELECT kind, amount_centavos::text AS amount_centavos, proposed_plan, money_hidden
                                                        FROM public.change_asks_read($1) ORDER BY kind`, [w.threadId]));
  // Closed per column: no browser session can SELECT the two money columns, whoever it is.
  for (const uid of [w.coordinator, w.host]) {
    await as(uid, async () => {
      await assert.rejects(q(`SELECT amount_centavos FROM public.booking_change_asks WHERE thread_id = $1`, [w.threadId]), /permission denied/);
    });
    await db.exec('ROLLBACK').catch(() => {});
    await as(uid, async () => {
      await assert.rejects(q(`SELECT proposed_plan FROM public.booking_change_asks WHERE thread_id = $1`, [w.threadId]), /permission denied/);
    });
    await db.exec('ROLLBACK').catch(() => {});
  }
  // The masked coordinator: both asks, what they are, no money.
  const masked = await read(w.coordinator);
  assert.deepEqual(masked.map((r) => [r.kind, r.amount_centavos, r.proposed_plan, r.money_hidden]),
    [['counter', null, null, true], ['plan', null, null, true]]);
  // Hosts and the shop read the real figures.
  for (const uid of [w.host, w.supplier]) {
    const real = await read(uid);
    assert.equal(real.find((r) => r.kind === 'counter')!.amount_centavos, '9000000');
    assert.ok(real.find((r) => r.kind === 'plan')!.proposed_plan, 'the plan rows reach a host / the shop');
    assert.ok(real.every((r) => r.money_hidden === false));
  }
});
