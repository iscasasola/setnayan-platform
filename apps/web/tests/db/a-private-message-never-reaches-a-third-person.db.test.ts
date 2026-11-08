/**
 * A PRIVATE MESSAGE NEVER REACHES A THIRD PERSON — notices · digest · search · export.
 * Supplier Build 3 · lane B · migration 20271329968207.
 *
 * ⚖ DECISION_LOG 🔒 2026-11-09 — a chat_messages row with recipient_user_id is
 *   read by its sender and its recipient only (admin only through a report);
 *   the AI never reads it; only the recipient is notified.
 *
 * `a-private-message-and-who-is-in-the-chat.db.test.ts` proves the READ (RLS),
 * the unread counters, hearts, the push webhook and the SECURITY DEFINER audit.
 * This file proves the four paths that carry a message — or the fact of one —
 * AWAY from the chat, each against every third person on the conversation
 * (the other host, the coordinator, the shop's team member) and a stranger:
 *
 *   1 · NOTICES — a private insert (the browser's own write, the only way one
 *       can exist: no server path names a recipient — pinned by
 *       lib/a-private-message-never-reaches-a-third-person.test.ts) writes no
 *       `notifications` row and no report flag for anybody, and every AFTER
 *       INSERT trigger on chat_messages is one this file has judged.
 *   2 · DIGEST — the only chat-shaped number any digest reads is the admin's
 *       open `chat_message_flags` count (lib/admin/queue-counts.ts); a private
 *       message adds nothing to it. No digest module reads chat_messages (the
 *       unit file walks their imports).
 *   3 · SEARCH — the inbox search runs over the rows on screen; the one
 *       message-shaped thing in a row is the preview, read under the viewer's
 *       own session. The REAL `previewFor` + `matchesSearch` run over the REAL
 *       preview read here, and a third person's search never finds the words.
 *       No SQL function searches chat_messages at all.
 *   4 · EXPORT — the export's chat read is lifted out of
 *       lib/personal-data-export.ts and run as written, through BOTH doors (the
 *       person's own session, and the admin's service role). The private line
 *       is in its sender's file and nobody else's — and the sabotage run shows
 *       the admin door leans on that filter alone.
 *
 * Run (from apps/web): tsx --test tests/db/a-private-message-never-reaches-a-third-person.db.test.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { stripComments } from '../../lib/strip-comments';
import { matchesSearch, previewFor } from '../../lib/conversation-list';

let replay: ReplayResult;
let db: PGlite;

const PRIVATE_FILE = '20271329968207_a_private_message_reaches_two_people_and_is_words_only.sql';

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
/** Run `fn` as a signed-in user under the real `authenticated` role. */
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
/** Run `fn` as the service role — the admin client's door. */
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setClaimRole('service_role');
  await db.exec(`SET ROLE service_role`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}

let seq = 0;
const uniq = () => `pm3-${++seq}`;

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
  hostA: string; // asked — the thread's opener
  hostB: string; // a second host, ADDED to this conversation
  coordinator: string;
  supplier: string; // the shop's owner
  teammate: string; // on the shop's team
  stranger: string;
  shop: string;
  threadId: string;
};
async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Ben');
  const coordinator = await newUser('Cora');
  const supplier = await newUser('Sol');
  const teammate = await newUser('Tess');
  const stranger = await newUser('Xia');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [supplier, `Shop ${uniq()}`],
  );
  const shop = v.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin')`,
    [shop, teammate],
  );
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple'), ($1,$3,'couple'), ($1,$4,'coordinator')`,
    [eventId, hostA, hostB, coordinator],
  );
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
    [eventId, shop, hostA],
  );
  const threadId = t.rows[0]!.thread_id;
  const w = { eventId, hostA, hostB, coordinator, supplier, teammate, stranger, shop, threadId };
  const added = await as(hostA, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1,$2) AS r`, [threadId, hostB])).rows[0]!.r);
  assert.equal(added, 'added');
  return w;
}

/** Insert as `uid` — the browser's write (the column grant of 20271329968207). */
async function send(w: World, uid: string, body: string, recipient?: string): Promise<string> {
  return as(uid, async () => {
    const cols = ['thread_id', 'event_id', 'vendor_profile_id', 'body'];
    const vals: unknown[] = [w.threadId, w.eventId, w.shop, body];
    if (recipient) {
      cols.push('recipient_user_id');
      vals.push(recipient);
    }
    try {
      const r = await db.query<{ message_id: string }>(
        `INSERT INTO public.chat_messages (${cols.join(', ')})
         VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING message_id`,
        vals,
      );
      return r.rows[0]!.message_id;
    } catch (e) {
      throw new Error(`send "${body}" failed: ${(e as Error).message}`);
    }
  });
}

const everyone = (w: World) => ({
  hostA: w.hostA,
  hostB: w.hostB,
  coordinator: w.coordinator,
  supplier: w.supplier,
  teammate: w.teammate,
  stranger: w.stranger,
});
type Who = keyof ReturnType<typeof everyone>;

/**
 * The private pairs a conversation can hold — host→supplier, supplier→host,
 * host→coordinator (from either host), host→host, shop teammate→host. Each
 * names who wrote, who it is for, and so who is a THIRD person. (A coordinator
 * cannot WRITE a chat line in this schema at all — tg_chat_messages_derive_sender
 * has no coordinator branch, "sender is not a party" — so there is no
 * coordinator→anyone pair to prove; they are a recipient or a third person.)
 */
const PAIRS: Array<{ from: Who; to: Who }> = [
  { from: 'hostA', to: 'supplier' },
  { from: 'supplier', to: 'hostA' },
  { from: 'hostA', to: 'coordinator' },
  { from: 'hostB', to: 'coordinator' },
  { from: 'hostA', to: 'hostB' },
  { from: 'teammate', to: 'hostB' },
];

test('the private-message migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === PRIVATE_FILE), `${PRIVATE_FILE} was skipped during replay`);
});

// ── 1 · notices ─────────────────────────────────────────────────────────────

test('notices: a private message writes no notification and no report flag for anybody, in every pair', async () => {
  const w = await newWorld();
  const p = everyone(w);
  const counts = async () => {
    const r = await db.query<{ n: number; f: number; h: number }>(
      `SELECT (SELECT count(*)::int FROM public.notifications) AS n,
              (SELECT count(*)::int FROM public.chat_message_flags) AS f,
              (SELECT count(*)::int FROM net._http_calls) AS h`,
    );
    return r.rows[0]!;
  };
  await db.query(
    `INSERT INTO vault.secrets (name, secret) VALUES ('notify_webhook_secret', 'test-only-not-a-secret')
     ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret`);
  try {
    for (const { from, to } of PAIRS) {
      const before = await counts();
      await send(w, p[from], `psst ${from} to ${to}`, p[to]);
      const afterPrivate = await counts();
      assert.deepEqual(afterPrivate, before, `a private ${from}→${to} line wrote a notice, a flag or a push`);
    }
    // The control: a shared line still goes out — the measurement can see a push.
    const before = await counts();
    await send(w, w.hostA, 'Shared with everyone');
    assert.equal((await counts()).h, before.h + 1, 'a shared message must still reach the push webhook');
  } finally {
    await db.exec(`DELETE FROM vault.secrets WHERE name = 'notify_webhook_secret'`);
  }
});

test('notices: every AFTER INSERT trigger on chat_messages is one this lane judged', async () => {
  // An AFTER INSERT trigger is where a message turns into something ELSE — a
  // notice, a push, a stamp other people read. A new one fails here until
  // someone decides whether a private row may set it off.
  const r = await db.query<{ tgname: string; proname: string; def: string }>(
    `SELECT t.tgname, p.proname, pg_get_triggerdef(t.oid) AS def
       FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = 'public.chat_messages'::regclass AND NOT t.tgisinternal
        AND (t.tgtype & 2) = 0 /* not BEFORE */ ORDER BY 1`);
  const got = r.rows.map((x) => `${x.tgname} → ${x.proname}`);
  console.log('AFTER triggers on chat_messages:', JSON.stringify(got));
  assert.deepEqual(got, AUDITED_AFTER_TRIGGERS);
  const webhook = r.rows.find((x) => x.tgname === 'chat_messages_notify_webhook');
  assert.match(webhook?.def ?? '', /WHEN \(\(new\.recipient_user_id IS NULL\)\)/, 'the push webhook must fire for shared rows only');
  // None of the others writes a notice or calls out.
  for (const x of r.rows.filter((y) => y.tgname !== 'chat_messages_notify_webhook')) {
    const src = (await db.query<{ s: string }>(`SELECT prosrc AS s FROM pg_proc WHERE proname = $1`, [x.proname])).rows
      .map((y) => y.s).join('\n');
    assert.doesNotMatch(src, /\bnotifications\b|http_post|emit_notification/i, `${x.proname} writes a notice or calls out`);
  }
});

const AUDITED_AFTER_TRIGGERS: string[] = [
  // Fires for shared rows only (WHEN, 20271329968207) — asserted above.
  'chat_messages_notify_webhook → notify_chat_message_webhook',
  // Lifts the supplier's name on the thread once a message lands; no body, no notice.
  'chat_messages_unlock_vendor_name → tg_chat_messages_unlock_vendor_name',
  // Sets chat_threads.updated_at = NEW.created_at. No body and no notice; shared lines
  // only since 20271332497337 (WHEN recipient_user_id IS NULL) — the test below.
  'on_chat_message_inserted → bump_chat_thread_updated_at',
  // vendor_first_reply_at — a response-time stamp; no body, no notice.
  'on_vendor_first_reply → stamp_vendor_first_reply',
  // name_revealed_at — the reveal mechanic; no body, no notice.
  'reveal_vendor_name_on_chat → reveal_vendor_name_on_first_reply',
  // The find-lock on a shop's first inquiry; no body, no notice.
  'stamp_find_lock_on_inquiry → stamp_find_lock_on_inquiry',
];

test(
  'notices: a private line does not move the thread in a third person’s list (closed by 20271332497337 — the bump is shared-only)',
  async () => {
    const w = await newWorld();
    await send(w, w.hostA, 'Shared with everyone');
    const stamp = () =>
      as(w.hostB, async () =>
        (await db.query<{ u: string }>(`SELECT updated_at::text AS u FROM public.chat_threads WHERE thread_id = $1`, [w.threadId]))
          .rows[0]!.u);
    const seen = await stamp();
    await db.query(`SELECT pg_sleep(0.01)`);
    await send(w, w.hostA, 'Only for the supplier', w.supplier);
    assert.equal(await stamp(), seen, 'Ben’s list moved because of a line he cannot read');
  },
);

// ── 2 · digest ──────────────────────────────────────────────────────────────

test('digest: the admin digest’s one chat number (open report flags) is unmoved by private lines', async () => {
  // lib/admin/queue-counts.ts — key 'chat-flags', table chat_message_flags,
  // status 'open'. A flag is the "admin only through a report" door.
  const w = await newWorld();
  const p = everyone(w);
  const open = async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_message_flags WHERE status = 'open'`)).rows[0]!.n;
  const before = await open();
  for (const { from, to } of PAIRS) await send(w, p[from], `between ${from} and ${to}`, p[to]);
  assert.equal(await open(), before);
});

// ── 3 · search ──────────────────────────────────────────────────────────────

/**
 * The inbox preview read, as both inboxes write it (lib/vendor-conversation-
 * inputs.server.ts and app/dashboard/[eventId]/messages/page.tsx: newest first,
 * capped at 600, first row per thread wins), under the viewer's own session —
 * reduced by the same rule, then rendered by the REAL previewFor.
 */
async function previewAs(w: World, uid: string, selfRole: 'vendor' | 'couple'): Promise<string> {
  const rows = await as(uid, async () =>
    (await db.query<{ thread_id: string; sender_role: string; body: string | null }>(
      `SELECT thread_id, sender_role, body, created_at FROM public.chat_messages
        WHERE thread_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 600`,
      [[w.threadId]])).rows);
  const last = new Map<string, { sender_role: string; body: string | null }>();
  for (const m of rows) if (!last.has(m.thread_id)) last.set(m.thread_id, m);
  return previewFor(last.get(w.threadId), selfRole);
}

test('search: a third person’s search over the inbox never finds another pair’s private words', async () => {
  const p0 = { hostA: 'couple', hostB: 'couple', coordinator: 'couple', supplier: 'vendor', teammate: 'vendor', stranger: 'couple' } as const;
  for (const { from, to } of PAIRS) {
    const w = await newWorld();
    const p = everyone(w);
    await send(w, w.hostA, 'Shared with everyone');
    const secret = `zebra${from}${to}`; // one word, nowhere else in the world
    await send(w, p[from], `the ${secret} plan`, p[to]);
    for (const who of Object.keys(p) as Who[]) {
      const preview = await previewAs(w, p[who], p0[who]);
      const found = matchesSearch({ displayName: 'A celebration', preview, labels: [] }, secret);
      if (who === from || who === to) {
        assert.ok(found, `${who} (${from}→${to}) should find their own private line — preview "${preview}"`);
      } else {
        assert.ok(!found, `${who} found the private ${from}→${to} line by searching — preview "${preview}"`);
        assert.ok(!preview.includes(secret), `${who}'s preview carries the private ${from}→${to} words`);
      }
    }
  }
});

test('search (sabotage): the same preview read on the service role WOULD let a third person find the words', async () => {
  // Proves the test above measures RLS, not an accident of the world: the
  // restrictive policy is the only thing between the preview and the words.
  const w = await newWorld();
  await send(w, w.hostA, 'Shared with everyone');
  await send(w, w.hostA, 'the zebrasabotage plan', w.supplier);
  const rows = await asService(async () =>
    (await db.query<{ thread_id: string; sender_role: string; body: string | null }>(
      `SELECT thread_id, sender_role, body, created_at FROM public.chat_messages
        WHERE thread_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 600`,
      [[w.threadId]])).rows);
  const preview = previewFor(rows[0], 'couple');
  assert.ok(matchesSearch({ displayName: 'A celebration', preview, labels: [] }, 'zebrasabotage'));
});

test('search: no SQL function searches chat_messages (search runs over RLS-read rows only)', async () => {
  const r = await db.query<{ proname: string }>(
    `SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosrc ~* '\\mchat_messages\\M'
        AND p.prosrc ~* '\\m(ilike|to_tsvector|tsquery|websearch_to_tsquery|plainto_tsquery|similarity|word_similarity)\\M'
      ORDER BY 1`);
  assert.deepEqual(r.rows.map((x) => x.proname), [],
    'a SQL search over chat_messages must filter recipient_user_id itself if SECURITY DEFINER — judge it, then list it here');
});

// ── 4 · export ──────────────────────────────────────────────────────────────

/** The export's chat_messages read, lifted out of the shipped builder as written. */
function exportChatRead(): { select: string; filterColumn: string } {
  const src = stripComments(
    readFileSync(join(import.meta.dirname, '..', '..', 'lib', 'personal-data-export.ts'), 'utf8'),
  );
  const at = src.indexOf(".from('chat_messages')");
  assert.ok(at >= 0, 'the export no longer reads chat_messages by literal — re-point this test');
  assert.equal(src.indexOf(".from('chat_messages')", at + 1), -1, 'a second chat_messages read in the export — prove it too');
  const chain = src.slice(at, src.indexOf('.order(', at));
  const select = /\.select\(\s*'([^']+)'\s*\)/.exec(chain)?.[1];
  const eqs = [...chain.matchAll(/\.eq\(\s*'([a-z_]+)'\s*,\s*user\.id\s*\)/g)].map((m) => m[1]!);
  assert.ok(select, `no select list in the export's chat read: ${chain}`);
  assert.equal(eqs.length, 1, `the export's chat read must name exactly one subject column: ${chain}`);
  assert.match(select, /^[a-z_, ]+$/, 'select list must be plain columns to run here');
  return { select, filterColumn: eqs[0]! };
}

test('export: a private line is in its sender’s file only — through the person’s own door AND the admin’s', async () => {
  const { select, filterColumn } = exportChatRead();
  assert.equal(filterColumn, 'sender_user_id', 'the export reads AUTHORED messages (chat_messages_authored)');
  const w = await newWorld();
  const p = everyone(w);
  const ids = new Map<string, { from: Who; to: Who }>();
  for (const pair of PAIRS) ids.set(await send(w, p[pair.from], `export ${pair.from}→${pair.to}`, p[pair.to]), pair);

  const sql = `SELECT ${select} FROM public.chat_messages WHERE ${filterColumn} = $1 ORDER BY created_at`;
  const measured: Record<string, string[]> = {};
  for (const who of Object.keys(p) as Who[]) {
    const own = await as(p[who], async () => (await db.query<{ message_id: string }>(sql, [p[who]])).rows);
    const admin = await asService(async () => (await db.query<{ message_id: string }>(sql, [p[who]])).rows);
    for (const [door, rows] of [['own session', own], ['admin (service role)', admin]] as const) {
      const privateIn = rows.map((r) => ids.get(r.message_id)).filter((x): x is { from: Who; to: Who } => x != null);
      measured[`${who} · ${door}`] = privateIn.map((x) => `${x.from}→${x.to}`);
      for (const x of privateIn) {
        assert.ok(who === x.from || who === x.to, `${who}'s export (${door}) carries the private ${x.from}→${x.to} line`);
      }
      // …and every private line this person SENT is in their file.
      const sent = PAIRS.filter((x) => x.from === who).map((x) => `${x.from}→${x.to}`).sort();
      assert.deepEqual(privateIn.map((x) => `${x.from}→${x.to}`).sort(), sent, `${who}'s export (${door}) is missing a line they wrote`);
    }
  }
  console.log('private lines per export file:', JSON.stringify(measured));
});

test('export (sabotage): without its subject filter the admin door WOULD carry every private line', async () => {
  // Proves the test above measures the filter, not an accident: the admin's
  // service role bypasses RLS, so the sender filter is the only bound there.
  const { select } = exportChatRead();
  const w = await newWorld();
  const id = await send(w, w.hostA, 'Only for the supplier', w.supplier);
  const unfiltered = await asService(async () =>
    (await db.query<{ message_id: string }>(`SELECT ${select} FROM public.chat_messages WHERE thread_id = $1`, [w.threadId])).rows);
  assert.ok(unfiltered.some((r) => r.message_id === id), 'service role reads the private row when unfiltered');
});
