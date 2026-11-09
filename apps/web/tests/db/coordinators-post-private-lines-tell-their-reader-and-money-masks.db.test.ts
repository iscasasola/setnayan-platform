/**
 * COORDINATORS POST · A PRIVATE LINE TELLS ITS ONE READER · THE ₱ MASK HOLDS IN THE STREAM · THE RECIPIENT'S
 * EXPORT · EVERY BLOCKER COUNTS SERVER-SIDE. Supplier Build 3 · lane B · round 3 · migration 20271333348826.
 *
 * ⚖ 03-FINAL-RULINGS 2026-11-09 (owner):
 *   • coordinators/planners ARE chat members and post like hosts — they only cannot leave and cannot read
 *     other people's private lines;
 *   • a private line: "Only the recipient is notified" — in-app, the recipient only, none of the words;
 *   • a coordinator without Budget & payments reads every amount in the chat as "₱ — hosts only", the
 *     stream included, stripped server-side (SECURITY INVOKER readers — RLS is not widened);
 *   • the recipient's data export carries the private lines sent TO them (RA 10173 access right);
 *   • the blocker hold count is server-side per blocker for EVERY blocker, change-approval included.
 *
 * Every test runs as the real `authenticated` role over the full migration replay (PGlite).
 *
 * Run (from apps/web): tsx --test tests/db/coordinators-post-private-lines-tell-their-reader-and-money-masks.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { HOSTS_ONLY, maskPesos } from '../../lib/money-mask';

let replay: ReplayResult;
let db: PGlite;

const ROUND3_FILE = '20271333348826_coordinators_post_private_lines_reach_their_one_reader_and_money_masks.sql';

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

let seq = 0;
const uniq = () => `r3-${++seq}`;

async function newUser(firstName: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  const id = r.rows[0]!.id;
  await db.query(`UPDATE public.users SET first_name = $2 WHERE user_id = $1`, [id, firstName]);
  return id;
}

type World = {
  eventId: string;
  hostA: string;
  hostB: string;
  coordinator: string;
  supplier: string;
  stranger: string;
  shop: string;
  threadId: string;
};
async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Ben');
  const coordinator = await newUser('Cora');
  const supplier = await newUser('Sol');
  const stranger = await newUser('Xia');
  const shop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
       RETURNING vendor_profile_id`,
      [supplier, `Shop ${uniq()}`],
    )
  ).rows[0]!.vendor_profile_id;
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple'), ($1,$3,'couple'), ($1,$4,'coordinator')`,
    [eventId, hostA, hostB, coordinator],
  );
  const threadId = (
    await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
      [eventId, shop, hostA],
    )
  ).rows[0]!.thread_id;
  const added = await as(hostA, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1,$2) AS r`, [threadId, hostB])).rows[0]!.r);
  assert.equal(added, 'added');
  return { eventId, hostA, hostB, coordinator, supplier, stranger, shop, threadId };
}

/** The browser's own write (the column grant of 20271329968207). */
async function send(w: World, uid: string, body: string, recipient?: string): Promise<{ id: string; role: string }> {
  return as(uid, async () => {
    const cols = ['thread_id', 'event_id', 'vendor_profile_id', 'body'];
    const vals: unknown[] = [w.threadId, w.eventId, w.shop, body];
    if (recipient) {
      cols.push('recipient_user_id');
      vals.push(recipient);
    }
    const r = await db.query<{ message_id: string; sender_role: string }>(
      `INSERT INTO public.chat_messages (${cols.join(', ')})
       VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING message_id, sender_role::text AS sender_role`,
      vals,
    );
    return { id: r.rows[0]!.message_id, role: r.rows[0]!.sender_role };
  });
}
async function readable(w: World, uid: string): Promise<string[]> {
  return as(uid, async () =>
    (await db.query<{ body: string }>(
      `SELECT body FROM public.chat_messages WHERE thread_id = $1 ORDER BY created_at`, [w.threadId])).rows.map((r) => r.body));
}
const noticesFor = async (uid: string) =>
  (await db.query<{ title: string; body: string | null; related_url: string | null; type: string }>(
    `SELECT title, body, related_url, type::text AS type FROM public.notifications WHERE user_id = $1 ORDER BY created_at`,
    [uid])).rows;

test('the round-3 migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === ROUND3_FILE), `${ROUND3_FILE} was skipped during replay`);
});

// ── 1 · coordinators post like hosts ────────────────────────────────────────

test('a coordinator posts in the chat, stamped as coordinator — a stranger is still refused', async () => {
  const w = await newWorld();
  const line = await send(w, w.coordinator, 'Cora here — I will be at the venue by 2pm');
  assert.equal(line.role, 'coordinator');
  const who = (await db.query<{ sender_user_id: string }>(
    `SELECT sender_user_id FROM public.chat_messages WHERE message_id = $1`, [line.id])).rows[0]!;
  assert.equal(who.sender_user_id, w.coordinator, 'the sender is derived from the session');
  for (const uid of [w.hostA, w.hostB, w.supplier]) {
    assert.ok((await readable(w, uid)).includes('Cora here — I will be at the venue by 2pm'), 'every member reads it');
  }
  const refused = await attempt(w.stranger, () =>
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,'hi')`,
      [w.threadId, w.eventId, w.shop]));
  assert.match(refused ?? '', /not a party to this conversation|row-level security/i);
  // A host who is also somehow a coordinator stays a host (the couple branch runs first).
  assert.equal((await send(w, w.hostA, 'Ana here')).role, 'couple');
});

test('a coordinator cannot be a costume: a coordinator of ANOTHER event is not a party here', async () => {
  const w = await newWorld();
  const other = await newWorld();
  const refused = await attempt(other.coordinator, () =>
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,'hi')`,
      [w.threadId, w.eventId, w.shop]));
  assert.ok(refused, 'a coordinator of another event posted into this chat');
});

test('a coordinator still cannot read other people’s private lines — and can write their own', async () => {
  const w = await newWorld();
  await send(w, w.hostA, 'Only for Sol', w.supplier);
  assert.ok(!(await readable(w, w.coordinator)).includes('Only for Sol'));
  await send(w, w.coordinator, 'Only for Ana, from Cora', w.hostA);
  assert.ok((await readable(w, w.hostA)).includes('Only for Ana, from Cora'));
  for (const third of [w.hostB, w.supplier, w.stranger]) {
    assert.ok(!(await readable(w, third)).includes('Only for Ana, from Cora'), 'a third person read the coordinator’s private line');
  }
});

// ── 2 · only the recipient is notified ──────────────────────────────────────

test('a private line writes ONE in-app notice, the recipient’s, with none of the words — a shared line writes none', async () => {
  const w = await newWorld();
  const everyone = [w.hostA, w.hostB, w.coordinator, w.supplier, w.stranger];
  const count = async () => Object.fromEntries(await Promise.all(everyone.map(async (u) => [u, (await noticesFor(u)).length])));

  const before0 = await count();
  await send(w, w.hostA, 'Shared with everyone — ₱5,000 deposit');
  assert.deepEqual(await count(), before0, 'a shared line wrote a notifications row (the push route owns shared lines)');

  const secret = 'the surprise is on the 12th';
  await send(w, w.hostA, secret, w.supplier);
  const after1 = await count();
  for (const u of everyone) assert.equal(after1[u], before0[u] + (u === w.supplier ? 1 : 0), 'only the recipient is told');
  const [n] = await noticesFor(w.supplier);
  assert.equal(n!.type, 'chat_message');
  assert.match(n!.title, /^Private message from /);
  assert.ok(!`${n!.title} ${n!.body ?? ''}`.includes(secret), 'the notice copied the private words');
  assert.equal(n!.related_url, `/vendor-dashboard/messages/${w.threadId}`, 'the shop opens its own inbox');

  await send(w, w.supplier, 'for you only', w.hostB);
  const [toBen] = await noticesFor(w.hostB);
  assert.equal(toBen!.related_url, `/dashboard/${w.eventId}/messages/${w.threadId}`, 'a host opens the event’s chat');
  assert.ok(!`${toBen!.title} ${toBen!.body ?? ''}`.includes('for you only'));
  assert.equal((await noticesFor(w.hostA)).length, 0, 'the sender is never told about their own line');
});

test('the private notice is not callable by anyone (trigger-only)', async () => {
  const w = await newWorld();
  const refused = await attempt(w.hostA, () => db.query(`SELECT public.tg_chat_messages_private_tells_its_reader()`));
  assert.match(refused ?? '', /permission denied|trigger functions can only be called as triggers/i);
});

// ── 3 · the ₱ mask, server-side ─────────────────────────────────────────────

async function grantBudget(w: World, uid: string, level: 'view' | null): Promise<void> {
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external', $3::jsonb, NOW())`,
    [w.eventId, uid, JSON.stringify({ areas: level ? { budget: level } : { mood_board: 'view' } })],
  );
}
const hidden = (w: World, uid: string) =>
  as(uid, async () =>
    (await db.query<{ h: boolean }>(`SELECT public.chat_money_hidden($1,$2) AS h`, [w.eventId, w.shop])).rows[0]!.h);

test('chat_money_hidden: TRUE for a coordinator without Budget & payments, FALSE for everyone else', async () => {
  const w = await newWorld();
  assert.equal(await hidden(w, w.coordinator), true);
  for (const uid of [w.hostA, w.hostB, w.supplier, w.stranger]) assert.equal(await hidden(w, uid), false);

  // A coordinator the hosts gave a delegate grant WITHOUT budget stays masked …
  await grantBudget(w, w.coordinator, null);
  assert.equal(await hidden(w, w.coordinator), true, 'an areas map that does not name budget grants no money');
  // … one WITH budget reads the money.
  const w2 = await newWorld();
  await grantBudget(w2, w2.coordinator, 'view');
  assert.equal(await hidden(w2, w2.coordinator), false, 'a coordinator granted Budget & payments reads the amounts');
});

test('the stream reader masks every peso in a body for the coordinator — and nobody else', async () => {
  const w = await newWorld();
  await send(w, w.hostA, 'We can do ₱5,000 down and PHP 12,500.50 on the day');
  await send(w, w.supplier, 'Noted, see you at 2pm');
  const viaReader = (uid: string) =>
    as(uid, async () =>
      (await db.query<{ body: string }>(`SELECT body FROM public.chat_thread_messages_read($1)`, [w.threadId])).rows.map((r) => r.body));

  const cora = await viaReader(w.coordinator);
  assert.ok(cora.includes(`We can do ${HOSTS_ONLY} down and ${HOSTS_ONLY} on the day`), JSON.stringify(cora));
  assert.ok(!cora.some((b) => /\d,\d{3}/.test(b)), 'a figure reached the coordinator through the stream reader');
  assert.ok(cora.includes('Noted, see you at 2pm'), 'words without money pass untouched');

  for (const uid of [w.hostA, w.hostB, w.supplier]) {
    assert.ok((await viaReader(uid)).includes('We can do ₱5,000 down and PHP 12,500.50 on the day'), 'a host/the shop lost the amounts');
  }
  assert.deepEqual(await viaReader(w.stranger), [], 'the reader returns what RLS returns — nothing for a stranger');
  // The reader never shows the coordinator a private line it could not read directly.
  await send(w, w.hostA, 'Only for Sol: ₱1,000 tip', w.supplier);
  assert.ok(!(await viaReader(w.coordinator)).some((b) => b.includes('tip')));
});

test('the SQL mask and the TS twin agree (lib/money-mask.ts)', async () => {
  for (const text of ['₱5,000', 'PHP 12,500.50 total', 'php-300', '₱ 1,234 and ₱99', 'no money here', 'Room 1,200 sqm']) {
    const sql = (await db.query<{ m: string }>(`SELECT public.chat_mask_pesos($1) AS m`, [text])).rows[0]!.m;
    assert.equal(sql, maskPesos(text), `SQL and TS disagree on "${text}"`);
  }
});

test('the quote and amendment readers null every amount for the coordinator; hosts and the shop read them', async () => {
  const w = await newWorld();
  const proposal = (
    await db.query<{ proposal_id: string }>(
      `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until)
       VALUES ($1, $2, 'Full day — ₱99,000', 9900000, 'sent', (NOW() AT TIME ZONE 'Asia/Manila')::date + 7) RETURNING proposal_id`,
      [w.shop, w.eventId],
    )
  ).rows[0]!.proposal_id;
  const amendment = (
    await db.query<{ amendment_id: string }>(
      `INSERT INTO public.proposal_amendments (event_id, vendor_profile_id, thread_id, base_proposal_id, raised_by, status, note)
       VALUES ($1, $2, $3, $4, 'vendor', 'proposed', 'Add ₱4,500 for the drone') RETURNING amendment_id`,
      [w.eventId, w.shop, w.threadId, proposal],
    )
  ).rows[0]!.amendment_id;
  await db.query(
    `INSERT INTO public.proposal_amendment_items (amendment_id, event_id, vendor_profile_id, item_kind, label, amount_php)
     VALUES ($1, $2, $3, 'addon', 'Drone (₱4,500)', 4500)`,
    [amendment, w.eventId, w.shop],
  );
  const read = (uid: string) =>
    as(uid, async () => ({
      quotes: (await db.query<{ total_centavos: number | null; title: string }>(
        `SELECT total_centavos, title FROM public.chat_quotes_read($1,$2)`, [w.eventId, w.shop])).rows,
      direct: (await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM public.vendor_proposals WHERE event_id = $1 AND vendor_profile_id = $2`,
        [w.eventId, w.shop])).rows[0]!.n,
      amendments: (await db.query<{ note: string | null }>(
        `SELECT note FROM public.chat_amendments_read($1::uuid[])`, [[amendment]])).rows,
      items: (await db.query<{ amount_php: string | null; label: string }>(
        `SELECT amount_php::text, label FROM public.chat_amendment_items_read($1::uuid[])`, [[amendment]])).rows,
    }));

  const cora = await read(w.coordinator);
  console.log('coordinator through the readers:', JSON.stringify(cora));
  assert.equal(cora.quotes.length, cora.direct, 'the quote reader returns exactly what RLS returns');
  for (const q of cora.quotes) {
    assert.equal(q.total_centavos, null);
    assert.ok(!q.title.includes('99,000'), 'a figure survived in the quote title');
  }
  for (const a of cora.amendments) assert.ok(!(a.note ?? '').includes('4,500'), 'a figure survived in the amendment note');
  for (const i of cora.items) {
    assert.equal(i.amount_php, null);
    assert.ok(!i.label.includes('4,500'));
  }

  // The host reads every figure through the readers.
  const host = await read(w.hostA);
  assert.ok(host.quotes.length === 1 && Number(host.quotes[0]!.total_centavos) === 9900000, 'the host lost the quote total');
  assert.ok(host.items.length === 1 && Number(host.items[0]!.amount_php) === 4500, 'the change’s amount is the host’s to read');
  // The shop reads what ITS RLS returns (amendment lines only once booked — proposal_amendment_items_read), unmasked.
  const shop = await read(w.supplier);
  const shopDirect = await as(w.supplier, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.proposal_amendment_items WHERE amendment_id = $1`, [amendment]))
      .rows[0]!.n);
  assert.equal(shop.items.length, shopDirect, 'the item reader returns exactly what the shop’s RLS returns');
  assert.ok(shop.items.every((i) => Number(i.amount_php) === 4500), 'the shop lost its own figure');
  assert.ok(shop.quotes.length === 1 && Number(shop.quotes[0]!.total_centavos) === 9900000, 'the shop lost its quote total');
  const x = await read(w.stranger);
  assert.deepEqual([x.quotes.length, x.amendments.length, x.items.length], [0, 0, 0], 'a stranger reads nothing through a reader');
});

test('every round-3 reader is SECURITY INVOKER and not callable by anon (RLS is not widened)', async () => {
  const r = await db.query<{ proname: string; prosecdef: boolean; anon: boolean }>(
    `SELECT p.proname, p.prosecdef, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('chat_thread_messages_read','chat_quotes_read','chat_amendments_read','chat_amendment_items_read','chat_money_hidden')
      ORDER BY 1`);
  assert.equal(r.rows.length, 5);
  for (const f of r.rows) {
    assert.equal(f.anon, false, `${f.proname} is callable by anon`);
    // chat_money_hidden answers one yes/no about the caller and returns no row; the four readers must not bypass RLS.
    assert.equal(f.prosecdef, f.proname === 'chat_money_hidden', `${f.proname} has the wrong security mode`);
  }
});

// ── 4 · the recipient's export ──────────────────────────────────────────────

test('the recipient reads the private lines sent TO them by recipient_user_id (the export read) — a third person reads none', async () => {
  const w = await newWorld();
  await send(w, w.hostA, 'Only for Sol — one', w.supplier);
  await send(w, w.coordinator, 'Only for Sol — two', w.supplier);
  await send(w, w.hostA, 'Shared');
  const received = (uid: string, subject: string) =>
    as(uid, async () =>
      (await db.query<{ body: string }>(
        `SELECT message_id, thread_id, sender_role, body, created_at FROM public.chat_messages
          WHERE recipient_user_id = $1 ORDER BY created_at`, [subject])).rows.map((r) => r.body));
  assert.deepEqual(await received(w.supplier, w.supplier), ['Only for Sol — one', 'Only for Sol — two']);
  for (const third of [w.hostB, w.stranger]) assert.deepEqual(await received(third, w.supplier), [], 'a third person read the recipient’s lines');
  // The coordinator reads only the line they wrote.
  assert.deepEqual(await received(w.coordinator, w.supplier), ['Only for Sol — two']);
});

// ── 5 · every blocker counts server-side, change-approval included ──────────

test('chat_blocker_shown counts the change-approval blocker per person, per key — a stranger gets nothing', async () => {
  const w = await newWorld();
  const key = 'adjustment:00000000-0000-4000-8000-000000000001';
  const shown = (uid: string, k = key) =>
    as(uid, async () =>
      (await db.query<{ n: string | null }>(
        `SELECT public.chat_blocker_shown($1, 'change_approval', $2)::text AS n`, [w.threadId, k])).rows[0]!.n);
  assert.equal(await shown(w.hostA), '1');
  assert.equal(await shown(w.hostA), '2', 'a second show counts — the hold counter is the server’s');
  assert.equal(await shown(w.hostB), '1', 'each person counts separately');
  assert.equal(await shown(w.coordinator), '1', 'a coordinator counts separately');
  assert.equal(await shown(w.supplier), '1', 'the shop counts separately');
  assert.equal(await shown(w.hostA, 'adjustment:00000000-0000-4000-8000-000000000002'), '1', 'a new change is a new blocker');
  let strangerCount: string | null = null;
  try {
    strangerCount = await shown(w.stranger);
  } catch (e) {
    assert.match((e as Error).message, /permission|not a (party|member)/i);
  }
  assert.equal(strangerCount, null, 'a stranger counted a show on a chat they are not in');
});
