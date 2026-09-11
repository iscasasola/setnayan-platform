/**
 * THE CHAT CANNOT BE USED TO LEAVE THE APP — migration 20271221089848, proven as
 * a REAL `authenticated` session (SET ROLE + JWT claims), never as the superuser
 * the replay otherwise runs as.
 *
 * Owner, 2026-09-10: "our goal is to let them integrate their event with the
 * vendor they find. not to let them communicate outside the app."
 *
 * Four doors, each measured OPEN in this replay before the migration existed:
 *   C · TEXT   — a direct PostgREST insert skipped the contact screen entirely.
 *   B · URL    — `attachment_url` took `https://wa.me/…`; the attachment route
 *                302'd to it (the route half is lib/chat-attachment-signs-only-
 *                its-own-thread.test.ts).
 *   D · THREAD — a couple posted into a STRANGER'S conversation by pairing their
 *                own event_id with the stranger's thread_id.
 *   D · FILE   — `attachment_r2_key` could name any object, including the other
 *                party's file, which erasure would then delete as "theirs".
 *
 * 🔑 EVERY REFUSAL HAS A POSITIVE CONTROL beside it — the same session, the same
 * thread, the honest version, ACCEPTED. And every door has a NEUTRALISATION: the
 * guard is switched off inside a rolled-back transaction and the same attack is
 * shown to land, so a refusal can never be "permission denied" for a reason
 * that has nothing to do with the rule.
 *
 * ⚖ THE RULES ARE NOT NEW. The text screen is a SQL port of
 * lib/chat-contact-filter.ts; the PARITY test below runs every string in that
 * engine's own two test files, plus a seeded corpus built to sit on every edge a
 * port gets wrong (unicode spaces, emoji at the filler limit, `é` beside a digit
 * word), through BOTH engines under BOTH profiles and demands identical answers.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { FIXTURE_COVER, FIXTURE_INCLUSION } from './live-card-fixture';
import { evaluateMessage, type ContactProfile } from '../../lib/chat-contact-filter';
import { stripComments } from '../../lib/strip-comments';

let replay: ReplayResult;
let db: PGlite;

const LIB = join(import.meta.dirname, '..', '..', 'lib');
const THREAD_FILES = 'setnayan-thread-files';
const GUARD_TRIGGER = 'chat_messages_guard_end_user_write';

const F = {
  couple: '',
  vendorUser: '',
  strangerCouple: '',
  strangerVendorUser: '',
  vendorId: '',
  strangerVendorId: '',
  eventId: '',
  strangerEventId: '',
  threadId: '',
  strangerThreadId: '',
  serviceId: '',
};

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}

type Msg = {
  thread_id?: string;
  event_id?: string;
  vendor_profile_id?: string;
  body?: string;
  attachment_url?: string | null;
  attachment_r2_key?: string | null;
  offered_service_id?: string | null;
};

/** The honest row for this user's own thread, overridable field by field. */
function row(over: Msg = {}): Required<Pick<Msg, 'thread_id' | 'event_id' | 'vendor_profile_id' | 'body'>> & Msg {
  return {
    thread_id: F.threadId,
    event_id: F.eventId,
    vendor_profile_id: F.vendorId,
    body: 'See you at the tasting on the 12th — 150 pax, budget 80000.',
    ...over,
  };
}

function insertSql(m: Msg): { sql: string; params: unknown[] } {
  const cols = Object.keys(m).filter((k) => (m as Record<string, unknown>)[k] !== undefined);
  const params = cols.map((k) => (m as Record<string, unknown>)[k]);
  return {
    sql: `INSERT INTO public.chat_messages (${cols.join(', ')}) VALUES (${cols
      .map((_, i) => `$${i + 1}`)
      .join(', ')})`,
    params,
  };
}

/**
 * Insert `m` as `uid` INSIDE a savepoint-free rolled-back transaction, so an
 * accepted row never leaks into the next test. Returns the error text, or null
 * when the row landed.
 */
async function sendAs(uid: string, m: Msg): Promise<string | null> {
  const { sql, params } = insertSql(m);
  await db.exec('BEGIN');
  try {
    await asUser(uid);
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}

/** Same, but with the guard trigger DISABLED for the transaction (neutralisation). */
async function sendAsWithoutGuard(uid: string, m: Msg, extraSql = ''): Promise<string | null> {
  const { sql, params } = insertSql(m);
  await db.exec('BEGIN');
  try {
    await db.exec(`ALTER TABLE public.chat_messages DISABLE TRIGGER ${GUARD_TRIGGER}`);
    if (extraSql) await db.exec(extraSql);
    await asUser(uid);
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}

/** The refusal word lib/chat-send.ts maps to the contact-block copy. */
function markerTheAppReads(): string {
  const src = stripComments(readFileSync(join(LIB, 'chat-send.ts'), 'utf8'));
  const m = src.match(/const CHAT_CONTACT_REFUSAL_MARKER = '([^']+)'/);
  assert.ok(m?.[1], 'lib/chat-send.ts no longer declares CHAT_CONTACT_REFUSAL_MARKER');
  assert.ok(
    /error\.message\.includes\(CHAT_CONTACT_REFUSAL_MARKER\)/.test(src),
    'lib/chat-send.ts no longer maps the database refusal to the contact-block message',
  );
  return m[1];
}

/**
 * The folder lib/chat-send.ts files an upload under, READ FROM SOURCE and
 * filled in the way `uploadPublicAsset` fills it (`${prefix}/${uuid}-${name}`).
 * The positive control uses THIS, so the app and the database cannot drift
 * apart without this file going red: change either and every attachment dies.
 */
function refTheAppWrites(threadId: string, uid: string, name = 'venue-contract.pdf'): string {
  const src = stripComments(readFileSync(join(LIB, 'chat-send.ts'), 'utf8'));
  const m = src.match(/pathPrefix:\s*`([^`]+)`/);
  assert.ok(m?.[1], 'lib/chat-send.ts no longer names a pathPrefix for the chat upload');
  const prefix = m[1]
    .replace('${thread.thread_id}', threadId)
    .replace('${user.id}', uid);
  assert.ok(!prefix.includes('${'), `chat-send's upload prefix uses a value this test cannot fill: ${m[1]}`);
  return `r2://${THREAD_FILES}/${prefix}/0b6c6f1e-2f4a-4c7e-9d51-3a1f0e9b7c21-${name}`;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('exit-couple@chat.test', 'customer');
  F.vendorUser = await mkUser('exit-vendor@chat.test', 'vendor');
  F.strangerCouple = await mkUser('exit-stranger-couple@chat.test', 'customer');
  F.strangerVendorUser = await mkUser('exit-stranger-vendor@chat.test', 'vendor');

  const mkVendor = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
         RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
  F.vendorId = await mkVendor(F.vendorUser, 'Exit Test Band');
  F.strangerVendorId = await mkVendor(F.strangerVendorUser, 'Somebody Else’s Caterer');

  const mkEvent = async (name: string, coupleUid: string) => {
    const id = (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [id, coupleUid],
    );
    return id;
  };
  F.eventId = await mkEvent('Exit Test Wedding', F.couple);
  F.strangerEventId = await mkEvent('Somebody Else’s Wedding', F.strangerCouple);

  const mkThread = async (eventId: string, vendorId: string, by: string) =>
    (
      await db.query<{ thread_id: string }>(
        `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
         VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
        [eventId, vendorId, by],
      )
    ).rows[0]!.thread_id;
  F.threadId = await mkThread(F.eventId, F.vendorId, F.couple);
  F.strangerThreadId = await mkThread(F.strangerEventId, F.strangerVendorId, F.strangerCouple);

  F.serviceId = (
    await db.query<{ vendor_service_id: string }>(
      `WITH s AS (
     INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
     VALUES ($1, 'photography', 40000, 'Free extra hour', '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT vendor_service_id FROM s`,
      [F.vendorId],
    )
  ).rows[0]!.vendor_service_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the probing role is authenticated, not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean; super: boolean }>(
    `SELECT current_user AS me,
            pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super
       FROM pg_class c WHERE c.oid = 'public.chat_messages'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated', 'SET ROLE did not take');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table');
  assert.equal(r.rows[0]!.bypass, false, 'the probing role has BYPASSRLS');
  assert.equal(r.rows[0]!.super, false, 'the probing role is a superuser');
});

test('META: RLS really bites this session — a stranger cannot post into our thread at all', async () => {
  // If RLS were vacuous here, every "refused" below could be the superuser
  // path misbehaving. A plain non-member send must fail on its own.
  const err = await sendAs(F.strangerCouple, row());
  assert.ok(err, 'a total stranger posted into a thread they are no party to — RLS is not enforced in this probe');
});

test('META: the guard is a BEFORE INSERT trigger, SECURITY DEFINER, search_path pinned, not callable by a browser', async () => {
  const t = await db.query<{ is_before: boolean; is_insert: boolean; enabled: string }>(
    `SELECT (t.tgtype & 2) = 2 AS is_before, (t.tgtype & 4) = 4 AS is_insert, t.tgenabled::text AS enabled
       FROM pg_trigger t
      WHERE t.tgrelid = 'public.chat_messages'::regclass AND t.tgname = $1`,
    [GUARD_TRIGGER],
  );
  assert.equal(t.rows.length, 1, `${GUARD_TRIGGER} is missing from chat_messages`);
  assert.equal(t.rows[0]!.is_before, true, 'the guard is not BEFORE — it could not refuse the row');
  assert.equal(t.rows[0]!.is_insert, true, 'the guard does not fire on INSERT');
  assert.equal(t.rows[0]!.enabled, 'O', 'the guard trigger is disabled');

  const fns = await db.query<{ proname: string; prosecdef: boolean; cfg: string[] | null; anon: boolean; auth: boolean }>(
    `SELECT p.proname, p.prosecdef, p.proconfig AS cfg,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname IN ('tg_chat_messages_guard_end_user_write', 'chat_contact_categories')`,
  );
  const by = new Map(fns.rows.map((r) => [r.proname, r]));
  const guard = by.get('tg_chat_messages_guard_end_user_write');
  const rules = by.get('chat_contact_categories');
  assert.ok(guard && rules, 'one of the two functions did not replay');
  assert.equal(guard.prosecdef, true, 'the guard must be SECURITY DEFINER to reach the un-granted rule function');
  assert.ok(
    (guard.cfg ?? []).some((c) => c.startsWith('search_path=')),
    'a SECURITY DEFINER function with no pinned search_path can be hijacked',
  );
  for (const f of [guard, rules]) {
    assert.equal(f.anon, false, `${f.proname} is EXECUTE-able by anon — it would be an RPC`);
    assert.equal(f.auth, false, `${f.proname} is EXECUTE-able by authenticated — it would be an RPC`);
  }
});

/* ── C · THE TEXT ─────────────────────────────────────────────────────────── */

const CONTACT_ATTEMPTS: Array<[who: 'couple' | 'vendor', body: string]> = [
  ['couple', 'call me 0917 880 7163'],
  ['couple', 'zero nine one seven eight eight zero seven one six three'],
  ['couple', 'add me on viber na lang po'],
  ['vendor', 'email me at band.bookings@gmail.com'],
  ['vendor', 'wa.me/639171234567'],
  ['vendor', 'IG: @exitband.ph'],
];

test('C · a direct insert carrying contact details is REFUSED, for either party, with the marker the app reads', async () => {
  const marker = markerTheAppReads();
  let refused = 0;
  for (const [who, body] of CONTACT_ATTEMPTS) {
    const uid = who === 'couple' ? F.couple : F.vendorUser;
    const err = await sendAs(uid, row({ body }));
    assert.ok(err, `${who} sent contact details straight past the database: ${JSON.stringify(body)}`);
    assert.ok(err.includes(marker), `refused for the wrong reason (${err}) — expected the ${marker} guard`);
    refused += 1;
  }
  console.log(`# C · contact attempts refused: ${refused}/${CONTACT_ATTEMPTS.length}`);
  assert.equal(refused, CONTACT_ATTEMPTS.length);
});

test('C · positive control — ordinary conversation still sends, both ways', async () => {
  for (const [uid, body] of [
    [F.couple, 'See you at the tasting on the 12th — 150 pax, budget 80000.'],
    [F.vendorUser, 'Salamat po! Our 4-hour set is Php 9,000 per hour, minimum 4 hours, 20 staff.'],
    [F.couple, 'Can we do 2026-12-12 14:30 instead?'],
  ] as const) {
    const err = await sendAs(uid, row({ body }));
    assert.equal(err, null, `an honest message was refused: ${JSON.stringify(body)} → ${err}`);
  }
});

test('C · a CARD row is read with the card rules — a deliverable name passes, a number does not', async () => {
  // "Offered: Instagram teaser reel" is exactly what lib/offer-service-core.ts
  // posts; the chat rules would refuse it (app_name), the card rules exist to
  // allow it. The same card with a phone number is still refused.
  const honest = await sendAs(
    F.vendorUser,
    row({ body: 'Offered: Instagram teaser reel', offered_service_id: F.serviceId }),
  );
  assert.equal(honest, null, `the card rules refused an offered service's own name: ${honest}`);
  const plainSameText = await sendAs(F.vendorUser, row({ body: 'Offered: Instagram teaser reel' }));
  assert.ok(plainSameText, 'a PLAIN message naming Instagram passed — the chat rules are not being applied');
  const smuggled = await sendAs(
    F.vendorUser,
    row({ body: 'Offered: call 0917 880 7163', offered_service_id: F.serviceId }),
  );
  assert.ok(smuggled?.includes(markerTheAppReads()), 'a card row carried a phone number past the card rules');
});

test('C · NEUTRALISED: with the guard off, the same contact message lands (the door was real)', async () => {
  const err = await sendAsWithoutGuard(F.couple, row({ body: 'call me 0917 880 7163' }));
  assert.equal(err, null, `with the guard disabled the send still failed (${err}) — the refusal above is not the guard's`);
});

test('C · the service role is the server and is not screened (system notices, the assistant)', async () => {
  await db.exec('BEGIN');
  try {
    await setAuthRole('service_role');
    await db.exec('SET ROLE service_role');
    await db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, body)
       VALUES ($1, $2, $3, 'system', 'Setnayan: your supplier accepted — reply here, not on Viber.')`,
      [F.threadId, F.eventId, F.vendorId],
    );
  } finally {
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
});

/* ── B · THE LEGACY URL ───────────────────────────────────────────────────── */

test('B · authenticated and anon hold no INSERT on attachment_url', async () => {
  for (const role of ['authenticated', 'anon']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege($1, 'public.chat_messages', 'attachment_url', 'INSERT') AS ok`,
      [role],
    );
    assert.equal(r.rows[0]!.ok, false, `${role} can still write attachment_url`);
  }
  // The sibling the app DOES write keeps its grant — a narrowing, not a demolition.
  const k = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('authenticated', 'public.chat_messages', 'attachment_r2_key', 'INSERT') AS ok`,
  );
  assert.equal(k.rows[0]!.ok, true, 'attachment_r2_key lost its INSERT grant — every file send would fail');
});

const DOORS_OUT = ['https://wa.me/639171234567', 'viber://chat?number=639171234567', 'https://m.me/exitband'];

test('B · a WhatsApp / Viber / Messenger link as a file is REFUSED', async () => {
  let refused = 0;
  for (const url of DOORS_OUT) {
    const err = await sendAs(F.couple, row({ body: 'here is the contract', attachment_url: url }));
    assert.ok(err, `attachment_url accepted ${url}`);
    refused += 1;
  }
  console.log(`# B · attachment_url doors refused: ${refused}/${DOORS_OUT.length}`);
});

test('B · NEUTRALISED: re-grant the column by accident and the guard still refuses; drop the guard too and it lands', async () => {
  const regrant = 'GRANT INSERT (attachment_url) ON public.chat_messages TO authenticated';
  // Grant back, guard ON → the trigger alone holds the line.
  await db.exec('BEGIN');
  let err: string | null = null;
  try {
    await db.exec(regrant);
    await asUser(F.couple);
    const q = insertSql(row({ attachment_url: DOORS_OUT[0] }));
    await db.query(q.sql, q.params);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  } finally {
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
  assert.ok(err?.includes('attachment_url is retired'), `with the grant restored the guard did not refuse: ${err}`);
  // Grant back AND guard off → the door, exactly as it was.
  const open = await sendAsWithoutGuard(F.couple, row({ attachment_url: DOORS_OUT[0] }), regrant);
  assert.equal(open, null, `with grant + no guard the insert still failed (${open}) — the proof is vacuous`);
});

/* ── D · THE THREAD ───────────────────────────────────────────────────────── */

test('D · nobody can post into a stranger’s conversation by pairing their own id with its thread', async () => {
  const attempts: Array<[label: string, uid: string, m: Msg]> = [
    ['couple · own event + stranger thread + stranger supplier', F.couple,
      row({ thread_id: F.strangerThreadId, vendor_profile_id: F.strangerVendorId })],
    ['couple · own event + stranger thread + own supplier', F.couple,
      row({ thread_id: F.strangerThreadId })],
    ['supplier · own shop + stranger thread + stranger event', F.vendorUser,
      row({ thread_id: F.strangerThreadId, event_id: F.strangerEventId })],
  ];
  let refused = 0;
  for (const [label, uid, m] of attempts) {
    const err = await sendAs(uid, m);
    assert.ok(err, `ACCEPTED: ${label}`);
    assert.match(err, /not between this event and this supplier/, `${label} refused for another reason: ${err}`);
    refused += 1;
  }
  console.log(`# D · stranger-thread injections refused: ${refused}/${attempts.length}`);
  // Positive control: both parties, their own thread.
  assert.equal(await sendAs(F.couple, row()), null, 'the couple can no longer post into their own thread');
  assert.equal(await sendAs(F.vendorUser, row({ body: 'Thank you po!' })), null, 'the supplier can no longer reply');
});

test('D · NEUTRALISED: with the guard off, the stranger-thread injection lands (the door was real)', async () => {
  const err = await sendAsWithoutGuard(
    F.couple,
    row({ thread_id: F.strangerThreadId, vendor_profile_id: F.strangerVendorId }),
  );
  assert.equal(err, null, `with the guard disabled the injection still failed (${err}) — the proof is vacuous`);
});

/* ── D · THE FILE ─────────────────────────────────────────────────────────── */

test('D · a file is accepted ONLY in the sender’s own folder of this thread', async () => {
  const own = refTheAppWrites(F.threadId, F.couple);
  assert.equal(
    await sendAs(F.couple, row({ body: 'contract attached', attachment_r2_key: own })),
    null,
    `the couple's OWN upload, in the folder lib/chat-send.ts writes (${own}), was refused`,
  );
  assert.equal(
    await sendAs(F.vendorUser, row({ body: 'signed copy', attachment_r2_key: refTheAppWrites(F.threadId, F.vendorUser) })),
    null,
    'the supplier’s own upload was refused',
  );

  const base = `r2://${THREAD_FILES}/chat/${F.threadId}`;
  const foreign: Array<[string, string]> = [
    ['the OTHER party’s file in this thread', `${base}/${F.vendorUser}/0b6c-contract.pdf`],
    ['a file in a stranger’s thread', `r2://${THREAD_FILES}/chat/${F.strangerThreadId}/${F.couple}/x.pdf`],
    ['the thread folder with no sender', `${base}/x.pdf`],
    ['another bucket, same path', `r2://setnayan-vendor-verification/chat/${F.threadId}/${F.couple}/gov.png`],
    ['a leading space', ` ${own}`],
    ['a leading tab', `\t${own}`],
    ['an upper-case scheme', own.replace('r2://', 'R2://')],
    ['a traversal out of the folder', `${base}/${F.couple}/../${F.vendorUser}/0b6c-contract.pdf`],
    ['a dot segment', `${base}/${F.couple}/./x.pdf`],
    ['a backslash', `${base}/${F.couple}/..\\x.pdf`],
    ['the bare folder', `${base}/${F.couple}/`],
    ['a public URL', 'https://wa.me/639171234567'],
  ];
  let refused = 0;
  for (const [label, key] of foreign) {
    const err = await sendAs(F.couple, row({ body: 'file', attachment_r2_key: key }));
    assert.ok(err, `ACCEPTED ${label}: ${JSON.stringify(key)}`);
    assert.match(err, /your own file in this conversation/, `${label} refused for another reason: ${err}`);
    refused += 1;
  }
  console.log(`# D · foreign attachment refs refused: ${refused}/${foreign.length}`);
});

test('D · NEUTRALISED: with the guard off, the other party’s file is accepted (the door was real)', async () => {
  const err = await sendAsWithoutGuard(
    F.couple,
    row({ attachment_r2_key: `r2://${THREAD_FILES}/chat/${F.threadId}/${F.vendorUser}/0b6c-contract.pdf` }),
  );
  assert.equal(err, null, `with the guard disabled the foreign ref still failed (${err}) — the proof is vacuous`);
});

/* ── PARITY · the SQL rules ARE the shipped rules ─────────────────────────── */

/** Every quoted string in the shipped engine's own tests. */
function vectorsFromShippedTests(): string[] {
  const out = new Set<string>();
  for (const f of ['chat-contact-filter.test.ts', 'chat-contact-filter.profiles.test.ts']) {
    const src = readFileSync(join(LIB, f), 'utf8');
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
      const raw = m[1] ?? m[2] ?? '';
      try {
        const s = JSON.parse(`"${raw.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`) as string;
        if (s.length > 0 && !s.includes('\u0000')) out.add(s);
      } catch {
        /* a literal JSON cannot read — skipped, and the floor below still holds */
      }
    }
  }
  return [...out];
}

/** Deterministic PRNG so a failure reproduces. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tokens chosen to sit on every edge a port gets wrong. */
const TOKENS = [
  '0917', '880', '7163', '09178807163', '+63', '63', '9', '09', '12345678901', '1', '20', '150', '80000',
  '2026-09-17', '14:30', '₱9,000', 'Php', '(0917)', '917-880-7163',
  'zero', 'one', 'Two', 'THREE', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'éone', 'one2', '_one', 'o9',
  ' ', '  ', '-', '.', ',', ', ', '(', ')', '/', ':', '_', '+', '\t', '\n', '\u00a0', '\u2003', '\u3000', '\ufeff',
  '\u200b', '\u{1F600}', '\u{1F600}'.repeat(10), '\u00e9', '\u00f1', '\u2014', "'", '"',
  'my number is', 'call me at', 'add me on', 'message me on setnayan', 'Message me on Setnayan', 'hit me up',
  "let's chat on", 'lets talk via', 'outside the app', 'off the platform', 'off platform', "here's my gcash",
  'this is my email', 'my cell',
  'viber', 'Viber', 'IG', 'ig', 'big', 'fb', 'FB', 'facebook', 'messenger', 'whats app', 'WhatsApp', 'wassap', 'wsp',
  'telegram', 'insta', 'Instagram', 'snapchat', 'tiktok', 'TikTok', 'wechat', 'kakaotalk', 'imessage', 'signal app',
  'line app', 'blue app', 'Purple  App', 'green app',
  'facebook.com/juan', 'wa.me/1', 'm.me/x', 't.me/y', 'fb.me', 'instagr.am/z', 'box.com', 'x.com', 'viber.ph/a',
  'https://', 'www.',
  '@juan', '@Juan_photos', '@Shangri-La', 'a@b.co', 'juan.dc@gmail.com', 'juan (at) gmail (dot) com', 'juan at gmail dot com',
  '[at]', '[dot]', 'x@', '@@x',
  'Instagram teaser reel', 'TikTok highlights package', '150 pax', '20 staff', 'minimum 4 hours', 'per hour',
];

function seededCorpus(n: number): string[] {
  const rnd = mulberry32(20260910);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const k = 1 + Math.floor(rnd() * 8);
    let s = '';
    for (let j = 0; j < k; j += 1) s += TOKENS[Math.floor(rnd() * TOKENS.length)]!;
    out.push(s);
  }
  return out;
}

/** Hand-picked edges: the filler limit in UTF-16 units, unicode spaces, empties. */
const EDGES = [
  '', ' ', '\n\t ', '\u00a0', '\ufeff', '\u2028', '\u1680 \u205f',
  // exactly 20 / 21 units of filler between halves of a number (chat gap = 20)
  `0917${'x'.repeat(20)}8807163`, `0917${'x'.repeat(21)}8807163`,
  // an emoji is TWO units in JS: 10 emoji = 20 units, 11 = 22
  `0917${'😀'.repeat(10)}8807163`, `0917${'😀'.repeat(11)}8807163`,
  `0917${'😀'.repeat(9)}x8807163`, `0917${'😀'.repeat(10)}x8807163`,
  // card gap = 2 units: one emoji fits, one emoji plus a char does not
  '0917😀8807163', '0917😀x8807163', '0917 - 880 7163', '0917, 880, 7163',
  // é is a word character to Postgres but not to JS
  'éone two three', 'call éviber', 'x@éjuan', 'é@juan', 'caféfacebook', 'éig',
  'zero nine one seven eight eight zero seven one six three',
  'Php 9,000 per hour, minimum 4 hours, 150 pax, 20 staff',
  'Valid 2026-09-17 - 2026-12-31',
  'Message me on Viber, not on Setnayan', 'We reply on Setnayan or add me on WhatsApp',
  'my\u00a0number', 'hit\u2003me\u3000up', 'whats\u00a0app', 'whats\u200bapp', 'add\u2003me\u00a0on viber',
  'Reception @Shangri-La', 'email@', 'a@b.c', 'a@b.cc',
];

test('PARITY · the SQL port agrees with lib/chat-contact-filter.ts on every vector, under both profiles', async () => {
  const shipped = vectorsFromShippedTests();
  assert.ok(shipped.length >= 60, `only ${shipped.length} strings read from the shipped tests — the extractor broke`);
  const corpus = [...new Set([...shipped, ...EDGES, ...seededCorpus(2500)])];

  const tally: Record<string, { blocked: number; allowed: number; cats: Set<string> }> = {};
  const mismatches: string[] = [];
  for (const profile of ['chat', 'card'] as ContactProfile[]) {
    const r = await db.query<{ n: number; cats: string[] }>(
      `SELECT t.n::int AS n, public.chat_contact_categories(t.s, $2) AS cats
         FROM unnest($1::text[]) WITH ORDINALITY AS t(s, n)`,
      [corpus, profile],
    );
    assert.equal(r.rows.length, corpus.length, 'the SQL side answered a different number of vectors');
    const t = (tally[profile] = { blocked: 0, allowed: 0, cats: new Set<string>() });
    for (const { n, cats } of r.rows) {
      const s = corpus[n - 1]!;
      const js = evaluateMessage(s, profile).categories;
      if (js.length > 0) t.blocked += 1;
      else t.allowed += 1;
      js.forEach((c) => t.cats.add(c));
      if (JSON.stringify(js) !== JSON.stringify(cats ?? [])) {
        mismatches.push(`${profile} ${JSON.stringify(s)}: ts=${JSON.stringify(js)} sql=${JSON.stringify(cats)}`);
      }
    }
  }
  console.log(
    `# PARITY · vectors: ${corpus.length} (shipped ${shipped.length}) · chat blocked/allowed ${tally.chat!.blocked}/${tally.chat!.allowed}` +
      ` · card blocked/allowed ${tally.card!.blocked}/${tally.card!.allowed} · mismatches ${mismatches.length}`,
  );
  assert.deepEqual(mismatches.slice(0, 25), [], `${mismatches.length} disagreement(s) between the engines`);

  // Anti-vacuity: both verdicts, and every category each profile can fire.
  for (const p of ['chat', 'card']) {
    assert.ok(tally[p]!.blocked >= 200 && tally[p]!.allowed >= 200, `${p}: the corpus stopped exercising both verdicts`);
  }
  assert.deepEqual([...tally.chat!.cats].sort(), ['app_name', 'email', 'euphemism', 'handle', 'phone', 'solicit', 'url']);
  assert.deepEqual([...tally.card!.cats].sort(), ['email', 'handle', 'phone', 'solicit', 'url']);
});
