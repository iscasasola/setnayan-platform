/**
 * A CARD NAMES *THIS* CONVERSATION'S SUPPLIER — migration 20271229461225,
 * proven as a REAL `authenticated` session (SET ROLE + JWT claims), never as the
 * superuser the replay otherwise runs as.
 *
 * A chat message can carry a CARD — a proposal, a meeting, a change order, a
 * deal amendment, an offered service. The card renders with Setnayan's chrome,
 * the supplier's price and a live button; the body is only what somebody typed.
 * `authenticated` holds INSERT on all five columns (the supplier writes them
 * under their own session), and until this migration NOTHING asked whether the
 * row they point at belongs to this conversation.
 *
 * 🔑 THE ATTACK IS NOT "READ SOMETHING YOU MAY NOT READ". Couple-side RLS on
 * vendor_proposals / event_appointments / proposal_amendments is EVENT-scoped,
 * not vendor-scoped, so a couple may legitimately read every supplier's rows on
 * their own event. The ids are not secret. The attack is pasting one into the
 * WRONG THREAD, where the platform then vouches for it under another supplier's
 * name. That is why RLS cannot refuse it: a policy is row-level, never
 * value-level.
 *
 * ── WHAT IS MEASURED HERE ───────────────────────────────────────────────────
 *   · CROSS-VENDOR — supplier B's card pasted into supplier A's thread, SAME
 *     event. The event_id matches, so only the vendor conjunct can refuse it.
 *   · CROSS-EVENT  — supplier A's card from the couple's OTHER event pasted into
 *     this thread. The vendor_profile_id matches, so only the event conjunct can
 *     refuse it.
 *   Both directions are here on purpose: each one is the only witness to one
 *   half of the comparison, so dropping either conjunct turns this file red.
 *
 * 🔑 EVERY REFUSAL HAS A POSITIVE CONTROL beside it — the honest card, same
 * session, same thread, ACCEPTED and counted in the table. Every refusal also
 * asserts the forged row is ABSENT afterwards, read back OUTSIDE any
 * transaction: a statement that raised and a row that did not land are two
 * different facts and only the second one is the property.
 * And every door has a NEUTRALISATION — the trigger is switched off and the same
 * forgery is shown to LAND — so a refusal can never be "permission denied" for
 * some reason that has nothing to do with this rule.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { FIXTURE_COVER, FIXTURE_INCLUSION } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;

const TRIGGER = 'chat_messages_card_names_this_conversation';
const FN = 'tg_chat_messages_card_names_this_conversation';
/** The word the database refuses with. Distinguishable, on purpose. */
const MARKER = 'CARD_NOT_THIS_CONVERSATION';

/** Every card column, and whether the referenced row is event-scoped. */
const CARDS = [
  { col: 'offered_service_id', label: 'offered service', eventScoped: false },
  { col: 'proposal_id', label: 'proposal', eventScoped: true },
  { col: 'appointment_id', label: 'meeting', eventScoped: true },
  { col: 'change_order_id', label: 'change request', eventScoped: true },
  { col: 'amendment_id', label: 'deal change', eventScoped: true },
] as const;

type CardCol = (typeof CARDS)[number]['col'];
/** One owner's set of cards, keyed by the chat_messages column that links them. */
type CardSet = Record<CardCol, string>;

const F = {
  couple: '',
  vendorUser: '',
  rivalVendorUser: '',
  outsider: '',
  vendorId: '',
  rivalVendorId: '',
  eventId: '',
  otherEventId: '',
  threadId: '',
  rivalThreadId: '',
  // A · this thread's supplier, on this thread's event — the honest card.
  honest: {} as CardSet,
  // B · the RIVAL supplier, on the SAME event — cross-vendor forgery.
  rival: {} as CardSet,
  // C · this thread's supplier, on the couple's OTHER event — cross-event forgery.
  otherEvent: {} as CardSet,
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

let seq = 0;
/** A fresh message_id, so every attempt can be looked for by name afterwards. */
async function newId(): Promise<string> {
  seq += 1;
  const r = await db.query<{ id: string }>(`SELECT gen_random_uuid()::text AS id`);
  return r.rows[0]!.id;
}

async function rowExists(messageId: string): Promise<boolean> {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.chat_messages WHERE message_id = $1`,
    [messageId],
  );
  return r.rows[0]!.n > 0;
}

type Extra = Partial<Record<CardCol, string>> & { event_id?: string; thread_id?: string };

/**
 * Insert one message as `uid`, OUTSIDE any explicit transaction, so whether the
 * row landed is a real post-state fact rather than something a ROLLBACK decided.
 * A failed INSERT leaves nothing behind, so there is nothing to clean up.
 */
async function send(
  uid: string | null,
  messageId: string,
  extra: Extra,
  body = 'Here is the package we discussed.',
): Promise<string | null> {
  const cols = ['message_id', 'thread_id', 'event_id', 'vendor_profile_id', 'body'];
  const vals: unknown[] = [
    messageId,
    extra.thread_id ?? F.threadId,
    extra.event_id ?? F.eventId,
    F.vendorId,
    body,
  ];
  for (const { col } of CARDS) {
    if (extra[col]) {
      cols.push(col);
      vals.push(extra[col]);
    }
  }
  const sql = `INSERT INTO public.chat_messages (${cols.join(', ')}) VALUES (${cols
    .map((_, i) => `$${i + 1}`)
    .join(', ')})`;
  try {
    if (uid) await asUser(uid);
    await db.query(sql, vals);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

/** The same insert with THIS trigger switched off, inside a rolled-back txn. */
async function sendWithoutGuard(uid: string, messageId: string, extra: Extra): Promise<string | null> {
  await db.exec('BEGIN');
  try {
    await db.exec(`ALTER TABLE public.chat_messages DISABLE TRIGGER ${TRIGGER}`);
    const err = await send(uid, messageId, extra);
    return err;
  } finally {
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
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
  F.couple = await mkUser('card-couple@chat.test', 'customer');
  F.vendorUser = await mkUser('card-vendor@chat.test', 'vendor');
  F.rivalVendorUser = await mkUser('card-rival@chat.test', 'vendor');
  F.outsider = await mkUser('card-outsider@chat.test', 'customer');

  const mkVendor = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        // A signup trigger already makes a profile for a 'vendor' account, so
        // this adopts that row rather than racing it.
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
         RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
  F.vendorId = await mkVendor(F.vendorUser, 'Our Photographer');
  F.rivalVendorId = await mkVendor(F.rivalVendorUser, 'The Rival Photographer');

  // BOTH events belong to the SAME couple. That is what makes the forgery
  // reachable without reading anything they are not entitled to read.
  const mkEvent = async (name: string) => {
    const id = (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [id, F.couple],
    );
    return id;
  };
  F.eventId = await mkEvent('The Wedding');
  F.otherEventId = await mkEvent('The Same Couple’s Other Party');

  const mkThread = async (eventId: string, vendorId: string) =>
    (
      await db.query<{ thread_id: string }>(
        `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
         VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
        [eventId, vendorId, F.couple],
      )
    ).rows[0]!.thread_id;
  F.threadId = await mkThread(F.eventId, F.vendorId);
  // The couple's OWN, legitimate thread with the rival — this is how they come
  // to hold the rival's ids in the first place.
  F.rivalThreadId = await mkThread(F.eventId, F.rivalVendorId);

  /** Build one full set of cards owned by (vendorId, eventId). */
  const mkCards = async (vendorId: string, eventId: string, tag: string): Promise<CardSet> => {
    const service = (
      await db.query<{ vendor_service_id: string }>(
        // A published service must carry a cover photo AND at least one
        // inclusion (the vendor_services publish guards), and both must be
        // there by the time the statement ends — hence one CTE, exactly as
        // tests/db/the-chat-cannot-leave-the-app.db.test.ts builds it.
        `WITH s AS (
           INSERT INTO public.vendor_services
             (vendor_profile_id, category, starting_price_php, primary_photo_r2_key)
           VALUES ($1, 'photography', 40000, $2)
           RETURNING vendor_service_id, vendor_profile_id
         ), i AS (
           INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
           SELECT vendor_service_id, vendor_profile_id, $3 FROM s
         )
         SELECT vendor_service_id FROM s`,
        [vendorId, FIXTURE_COVER, FIXTURE_INCLUSION],
      )
    ).rows[0]!.vendor_service_id;

    const proposal = (
      await db.query<{ proposal_id: string }>(
        `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status)
         VALUES ($1, $2, $3, 9900000, 'sent') RETURNING proposal_id`,
        [vendorId, eventId, `${tag} — full day coverage`],
      )
    ).rows[0]!.proposal_id;

    const appointment = (
      await db.query<{ appointment_id: string }>(
        `INSERT INTO public.event_appointments (event_id, vendor_profile_id, kind, type, status, initiated_by)
         VALUES ($1, $2, 'video', 'consultation', 'proposed', 'vendor') RETURNING appointment_id`,
        [eventId, vendorId],
      )
    ).rows[0]!.appointment_id;

    const eventVendor = (
      await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name)
         VALUES ($1, 'photographer', $2) RETURNING vendor_id`,
        [eventId, `${tag} booking`],
      )
    ).rows[0]!.vendor_id;

    const changeOrder = (
      await db.query<{ change_order_id: string }>(
        `INSERT INTO public.vendor_change_orders
           (event_id, vendor_profile_id, event_vendor_id, raised_by, delta_amount_php, status, title)
         VALUES ($1, $2, $3, 'vendor', 5000, 'proposed', $4) RETURNING change_order_id`,
        [eventId, vendorId, eventVendor, `${tag} extra hour`],
      )
    ).rows[0]!.change_order_id;

    const amendment = (
      await db.query<{ amendment_id: string }>(
        `INSERT INTO public.proposal_amendments
           (event_id, vendor_profile_id, base_proposal_id, raised_by, status, note)
         VALUES ($1, $2, $3, 'vendor', 'proposed', $4) RETURNING amendment_id`,
        [eventId, vendorId, proposal, `${tag} revised deal`],
      )
    ).rows[0]!.amendment_id;

    return {
      offered_service_id: service,
      proposal_id: proposal,
      appointment_id: appointment,
      change_order_id: changeOrder,
      amendment_id: amendment,
    };
  };

  F.honest = await mkCards(F.vendorId, F.eventId, 'Ours');
  F.rival = await mkCards(F.rivalVendorId, F.eventId, 'The rival’s');
  F.otherEvent = await mkCards(F.vendorId, F.otherEventId, 'Our other party’s');
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the probing role is authenticated, does not own the table, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean; sup: boolean }>(
    `SELECT current_user AS me,
            pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT rolsuper     FROM pg_roles WHERE rolname = current_user) AS sup
       FROM pg_class c WHERE c.oid = 'public.chat_messages'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated', 'SET ROLE did not take — every refusal below would be the superuser');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table');
  assert.equal(r.rows[0]!.bypass, false, 'the probing role has BYPASSRLS');
  assert.equal(r.rows[0]!.sup, false, 'the probing role is a superuser');
});

test('META: RLS really bites this session — an outsider cannot post into this thread at all', async () => {
  const id = await newId();
  const err = await send(F.outsider, id, {});
  assert.ok(err, 'a total stranger posted into a thread they are no party to — RLS is not enforced in this probe');
  assert.equal(await rowExists(id), false);
});

test('META: the guard is a BEFORE INSERT trigger, enabled, SECURITY DEFINER, search_path pinned, not an RPC', async () => {
  const t = await db.query<{ is_before: boolean; is_insert: boolean; enabled: string }>(
    `SELECT (t.tgtype & 2) = 2 AS is_before, (t.tgtype & 4) = 4 AS is_insert, t.tgenabled::text AS enabled
       FROM pg_trigger t WHERE t.tgrelid = 'public.chat_messages'::regclass AND t.tgname = $1`,
    [TRIGGER],
  );
  assert.equal(t.rows.length, 1, `${TRIGGER} is missing from chat_messages`);
  assert.equal(t.rows[0]!.is_before, true, 'the guard is not BEFORE — it could not refuse the row');
  assert.equal(t.rows[0]!.is_insert, true, 'the guard does not fire on INSERT');
  assert.equal(t.rows[0]!.enabled, 'O', 'the guard trigger is disabled');

  const f = await db.query<{ secdef: boolean; cfg: string[] | null; anon: boolean; auth: boolean }>(
    `SELECT p.prosecdef AS secdef, p.proconfig AS cfg,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = $1`,
    [FN],
  );
  assert.equal(f.rows.length, 1, `${FN} did not replay`);
  assert.equal(f.rows[0]!.secdef, true, 'the guard must read ground truth, not the caller’s RLS view');
  assert.ok(
    (f.rows[0]!.cfg ?? []).some((c) => c.startsWith('search_path=')),
    'a SECURITY DEFINER function with no pinned search_path can be hijacked',
  );
  assert.equal(f.rows[0]!.anon, false, `${FN} is EXECUTE-able by anon — it would be an RPC`);
  assert.equal(f.rows[0]!.auth, false, `${FN} is EXECUTE-able by authenticated — it would be an RPC`);
});

/* ── 1 · THE POSITIVE CONTROLS ────────────────────────────────────────────── */

test('an ordinary message carrying NO card is accepted, exactly as before', async () => {
  const id = await newId();
  const err = await send(F.couple, id, {}, 'Hi! Are you free on the 12th?');
  assert.equal(err, null, `a plain message was refused: ${err}`);
  assert.equal(await rowExists(id), true, 'the plain message did not land');
});

for (const { col, label } of CARDS) {
  test(`POSITIVE CONTROL · this supplier's own ${label} is accepted in this thread`, async () => {
    const id = await newId();
    const err = await send(F.vendorUser, id, { [col]: F.honest[col] } as Extra);
    assert.equal(err, null, `the honest ${label} card was refused — the guard is too tight: ${err}`);
    assert.equal(await rowExists(id), true, `the honest ${label} card did not land`);
  });
}

/* ── 2 · CROSS-VENDOR — the rival's card, SAME event ──────────────────────── */

for (const { col, label } of CARDS) {
  test(`CROSS-VENDOR · a couple cannot post the RIVAL's ${label} into this supplier's thread`, async () => {
    const id = await newId();
    const err = await send(F.couple, id, { [col]: F.rival[col] } as Extra);
    assert.ok(err, `a rival's ${label} was ACCEPTED into another supplier's thread`);
    assert.match(
      err,
      new RegExp(MARKER),
      `the ${label} was refused, but not by this rule (no ${MARKER}): ${err}`,
    );
    assert.equal(await rowExists(id), false, `the forged ${label} row LANDED despite the error`);
  });
}

test('CROSS-VENDOR · the supplier cannot do it either — the rule is not about couples', async () => {
  const id = await newId();
  const err = await send(F.vendorUser, id, { proposal_id: F.rival.proposal_id });
  assert.ok(err, 'a supplier passed off a rival’s proposal as their own');
  assert.match(err, new RegExp(MARKER));
  assert.equal(await rowExists(id), false);
});

/* ── 3 · CROSS-EVENT — this supplier's card, from the couple's OTHER event ── */

for (const { col, label, eventScoped } of CARDS) {
  if (!eventScoped) continue;
  test(`CROSS-EVENT · this supplier's ${label} from the couple's OTHER event is refused here`, async () => {
    const id = await newId();
    const err = await send(F.couple, id, { [col]: F.otherEvent[col] } as Extra);
    assert.ok(err, `a ${label} from a different event was ACCEPTED into this thread`);
    assert.match(
      err,
      new RegExp(MARKER),
      `the ${label} was refused, but not by this rule (no ${MARKER}): ${err}`,
    );
    assert.equal(await rowExists(id), false, `the cross-event ${label} row LANDED despite the error`);
  });
}

test('a service is vendor-scoped, not event-scoped — the same service is offerable on any event', async () => {
  // The counterpart to the loop above, and the reason offered_service_id is
  // excluded from it: a supplier sells the same service to everybody. If this
  // ever goes red, somebody has added an event comparison that does not belong.
  const id = await newId();
  const err = await send(F.vendorUser, id, {
    thread_id: F.threadId,
    offered_service_id: F.otherEvent.offered_service_id,
  });
  assert.equal(err, null, `offering this supplier's own service was refused: ${err}`);
  assert.equal(await rowExists(id), true);
});

/* ── 4 · THE RULE APPLIES TO EVERY ROLE, NOT ONLY END-USER SESSIONS ───────── */

test('the service role is fenced too — this is a consistency invariant, not a permission', async () => {
  const id = await newId();
  // uid null => no SET ROLE at all: the replay's own superuser, which is what
  // the service role stands in for here.
  const err = await send(null, id, { proposal_id: F.rival.proposal_id });
  assert.ok(err, 'the server itself could still write a card belonging to another supplier');
  assert.match(err, new RegExp(MARKER));
  assert.equal(await rowExists(id), false);
});

/* ── 5 · NEUTRALISATION ───────────────────────────────────────────────────── */

test('NEUTRALISATION · with this trigger disabled, every forgery LANDS', async () => {
  // Without this, each refusal above could be an FK, a CHECK, a NOT NULL or RLS
  // refusing for a reason that has nothing to do with the rule under test.
  for (const { col, label } of CARDS) {
    const id = await newId();
    const err = await sendWithoutGuard(F.couple, id, { [col]: F.rival[col] } as Extra);
    assert.equal(
      err,
      null,
      `switching ${TRIGGER} off did NOT let the rival's ${label} through — ` +
        `something else is refusing it, so the test above proves nothing about this trigger: ${err}`,
    );
  }
});

test('NEUTRALISATION · the cross-event forgery lands too when the trigger is off', async () => {
  const id = await newId();
  const err = await sendWithoutGuard(F.couple, id, { proposal_id: F.otherEvent.proposal_id });
  assert.equal(err, null, `the cross-event refusal is not this trigger's doing: ${err}`);
});
