/**
 * SEC-5 — Setnayan AI price-tier lock on `events.event_type` (test:db, every
 * migration replayed into PGlite).
 *
 * THE HOLE THIS LOCKS: Setnayan AI is priced by EVENT TYPE (the owner-locked
 * A/B/C/D/E ladder — that is deliberate product design and is not what this
 * changes). The charge is resolved from `events.event_type` read LIVE at
 * checkout, the delivered reach is re-derived from the live type on every read,
 * and `event_type` is column-GRANTed to `authenticated` — so a host could PATCH
 * their own event to a cheap tier through PostgREST, buy Setnayan AI, and PATCH
 * back to `wedding`, keeping wedding-tier AI for a fraction of the price.
 *
 * Migration 20271007917549 adds the DATA-layer guard (a server action is
 * irrelevant — the attack is a direct PATCH) plus a purchase-time tier snapshot.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A DB test that talks to Postgres as the table OWNER bypasses RLS and column
 * grants, so every "denied" assertion passes for the wrong reason. Worse for a
 * TRIGGER guard: a test can pass because the trigger never fired at all. Five
 * defences:
 *
 *   1. META asserts `current_user` is literally 'authenticated' and that the
 *      role cannot BYPASSRLS. It runs FIRST, so an owner-session regression
 *      fails loudly instead of silently greening the suite.
 *   2. REACHABILITY: the very same UPDATE statement is run twice — once BEFORE
 *      any Setnayan AI order exists (must SUCCEED) and once after (must FAIL).
 *      A guard that never fires cannot produce both outcomes, and a broken
 *      statement cannot produce the first.
 *   3. A DIFFERENTIAL CONTROL: the blocked statement is re-run as `service_role`
 *      and asserted to SUCCEED — so a denial is attributable to the guard, not
 *      to a typo'd column, a missing row, or an unrelated CHECK.
 *   4. A POSITIVE CONTROL: the same host, in the same session, still updates a
 *      host-editable column, and still makes a SAME-tier type change.
 *   5. The full attack is replayed end to end (PATCH down → buy → PATCH back),
 *      not just the isolated UPDATE.
 *
 * ⚠ HARNESS ARTIFACT: replay-migrations.ts runs a blanket
 * `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role`
 * after the replay loop. That means column GRANTs are NOT what is under test
 * here — the TRIGGER is, and a trigger fires regardless of privileges. The
 * grant side of the events table is covered by events-column-privileges.db.test.ts.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import {
  AI_TIER_BY_EVENT_TYPE,
  AI_TIER_DEFAULT,
  setnayanAiTierForEventType,
} from '../../lib/setnayan-ai-type-pricing';

let replay: ReplayResult;
let db: PGlite;

let hostUid: string;
/** The event the attack is run against (starts as a Tier D `gender_reveal`). */
let eventId: string;
/** A second event with NO Setnayan AI order — the untouched-onboarding control. */
let freeEventId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

/** Impersonate the event's own host: uid claim + role claim + SET ROLE. */
async function asHost(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, hostUid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/** Run a statement, returning the error message (or null when it succeeded). */
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

/**
 * THE attack statement, isolated so the before/after reachability pair is
 * byte-identical.
 *
 * `events_wedding_fields_consistency` requires ceremony_type + venue_setting to
 * be non-NULL exactly when event_type = 'wedding', so the real-world escalation
 * PATCH carries all three columns — every one of them host-writable. Writing it
 * this way keeps the test on the attacker's actual path instead of a
 * single-column variant that a CHECK would have stopped anyway.
 */
const RETYPE_TO_WEDDING = `UPDATE public.events
     SET event_type = 'wedding', ceremony_type = 'catholic', venue_setting = 'banquet_hall'
   WHERE event_id = $1`;

/** Undo the above (the consistency CHECK forces the two companions back to NULL). */
function retypeAwayFromWedding(target: string): string {
  return `UPDATE public.events
             SET event_type = '${target}', ceremony_type = NULL, venue_setting = NULL
           WHERE event_id = $1`;
}

async function typeOf(id: string): Promise<string | null> {
  const r = await db.query<{ event_type: string | null }>(
    `SELECT event_type FROM public.events WHERE event_id = $1`,
    [id],
  );
  return r.rows[0]?.event_type ?? null;
}

async function tierSnapshotOf(id: string): Promise<string | null> {
  const r = await db.query<{ t: string | null }>(
    `SELECT setnayan_ai_tier_at_purchase AS t FROM public.events WHERE event_id = $1`,
    [id],
  );
  return r.rows[0]?.t ?? null;
}

/** Create a Setnayan AI order for an event, privileged (the real checkout path). */
async function createAiOrder(
  forEventId: string,
  status: string,
  ref: string,
  serviceKey = 'SETNAYAN_AI',
): Promise<void> {
  await reset();
  await db.query(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, 'Setnayan AI', 99, $4::public.order_status, $5)`,
    [forEventId, hostUid, serviceKey, status, ref],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('sec5-host@example.com') RETURNING id`,
  );
  hostUid = u.rows[0]!.id;

  // Tier D (₱99) — the cheap tier the attacker would buy at.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('SEC-5 Attack Event', 'gender_reveal') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  const ev2 = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('SEC-5 Unpurchased Event', 'gender_reveal') RETURNING event_id`,
  );
  freeEventId = ev2.rows[0]!.event_id;

  for (const id of [eventId, freeEventId]) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type)
       VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
      [id, hostUid],
    );
  }
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0. META — the session must genuinely be un-privileged ───────────────────

test('META: the impersonated session is really `authenticated`, not the owner', async () => {
  await asHost();
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.events'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the authenticated role can BYPASSRLS — the whole suite would be meaningless');
  assert.notEqual(row.owner, 'authenticated', 'authenticated owns public.events');
});

test('META: the guard trigger is actually attached to public.events', async () => {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgrelid = 'public.events'::regclass
        AND tgname IN ('trg_guard_events_ai_price_tier','trg_stamp_events_ai_tier_at_purchase')`,
  );
  assert.equal(r.rows[0]!.n, 2, 'the SEC-5 triggers did not attach — every assertion below is vacuous');
});

// ── 1. TIER-MAP PARITY — the SQL mirror must not drift from the TS map ──────

test('the SQL tier function matches AI_TIER_BY_EVENT_TYPE key for key', async () => {
  await reset();
  for (const [eventType, expected] of Object.entries(AI_TIER_BY_EVENT_TYPE)) {
    const r = await db.query<{ t: string }>(`SELECT public.setnayan_ai_price_tier($1) AS t`, [eventType]);
    assert.equal(
      r.rows[0]!.t,
      expected,
      `tier drift for '${eventType}': SQL says ${r.rows[0]!.t}, lib/setnayan-ai-type-pricing.ts says ${expected}`,
    );
  }
});

test('the SQL tier function defaults unmapped + NULL types exactly like the TS map', async () => {
  await reset();
  const unmapped = 'a_type_that_does_not_exist';
  assert.equal(setnayanAiTierForEventType(unmapped), AI_TIER_DEFAULT);
  const r = await db.query<{ unmapped: string; nul: string }>(
    `SELECT public.setnayan_ai_price_tier($1) AS unmapped, public.setnayan_ai_price_tier(NULL) AS nul`,
    [unmapped],
  );
  assert.equal(r.rows[0]!.unmapped, AI_TIER_DEFAULT, 'an untiered type must not be a free escape hatch');
  assert.equal(r.rows[0]!.nul, AI_TIER_DEFAULT);
});

test('every event type registered in event_type_vocab is explicitly tiered', async () => {
  await reset();
  const r = await db.query<{ event_type: string }>(`SELECT event_type FROM public.event_type_vocab`);
  const untiered = r.rows
    .map((x) => x.event_type)
    .filter((t) => !Object.prototype.hasOwnProperty.call(AI_TIER_BY_EVENT_TYPE, t));
  assert.deepEqual(
    untiered,
    [],
    `these registered event types fall through to the ${AI_TIER_DEFAULT} default instead of being priced deliberately`,
  );
});

// ── 2. REACHABILITY — the identical statement before vs after the purchase ──
//
// This pair is the anti-vacuity core: the SAME SQL must succeed pre-purchase
// and fail post-purchase. A guard that never fires cannot do that.

test('REACHABILITY (a): before any AI order, the host may re-type across tiers', async () => {
  await asHost();
  const err = await tryQuery(RETYPE_TO_WEDDING, [eventId]);
  assert.equal(err, null, 'onboarding regression — a host with no AI order must be free to fix their event type');
  assert.equal(await typeOf(eventId), 'wedding');

  // Put it back to Tier D for the attack sequence below.
  const back = await tryQuery(retypeAwayFromWedding('gender_reveal'), [eventId]);
  assert.equal(back, null);
  assert.equal(await typeOf(eventId), 'gender_reveal');
});

// ── 3. THE ATTACK, end to end ───────────────────────────────────────────────

test('ATTACK: cheap-tier purchase then re-type to wedding is REFUSED', async () => {
  // Step 1 — the host is already on the ₱99 Tier D type (set above).
  assert.equal(await typeOf(eventId), 'gender_reveal');

  // Step 2 — they buy Setnayan AI. The order is created by the checkout action
  // (service-role) and sits IN FLIGHT: apply-then-pay means up to 24 hrs of
  // manual reconciliation before it is approved. That window is the attack
  // window, so the guard must already bite here.
  await createAiOrder(eventId, 'submitted', 'SEC5REF1');

  // Step 3 — the attack: PATCH back up to the ₱1,499 tier.
  await asHost();
  const err = await tryQuery(RETYPE_TO_WEDDING, [eventId]);
  assert.notEqual(err, null, 'THE SEC-5 HOLE IS OPEN — a host re-priced Setnayan AI by editing event_type');
  assert.match(String(err), /price tier/i);
  assert.equal(await typeOf(eventId), 'gender_reveal', 'the type must not have moved');
});

test('the same statement SUCCEEDS as service_role (denial is the guard, not a broken statement)', async () => {
  await asService();
  const err = await tryQuery(RETYPE_TO_WEDDING, [eventId]);
  assert.equal(err, null, 'service_role must stay able to correct an event type — admin escape hatch');
  assert.equal(await typeOf(eventId), 'wedding');

  // Restore for the remaining cases.
  await db.query(retypeAwayFromWedding('gender_reveal'), [eventId]);
});

test('an in-flight order that is CANCELLED releases the lock', async () => {
  await reset();
  await db.query(`UPDATE public.orders SET status = 'cancelled' WHERE reference_code = 'SEC5REF1'`);

  await asHost();
  const err = await tryQuery(RETYPE_TO_WEDDING, [eventId]);
  assert.equal(err, null, 'a couple whose order fell through must be free to re-type again');
  await db.query(retypeAwayFromWedding('gender_reveal'), [eventId]);

  // Re-arm with a PAID order for the rest of the suite.
  await createAiOrder(eventId, 'paid', 'SEC5REF2');
});

// ── 4. THE LINE IS AROUND MONEY, NOT THE COLUMN ─────────────────────────────

test('POSITIVE CONTROL: a SAME-tier type change is still allowed after purchase', async () => {
  // gender_reveal → date: both Tier D. Nothing about the money moves.
  await asHost();
  const err = await tryQuery(`UPDATE public.events SET event_type = 'date' WHERE event_id = $1`, [eventId]);
  assert.equal(err, null, 'a same-tier correction must not be taxed by the guard');
  assert.equal(await typeOf(eventId), 'date');
  await asService();
  await db.query(`UPDATE public.events SET event_type = 'gender_reveal' WHERE event_id = $1`, [eventId]);
});

test('POSITIVE CONTROL: an ordinary host edit is untouched', async () => {
  await asHost();
  const err = await tryQuery(`UPDATE public.events SET display_name = 'Renamed by host' WHERE event_id = $1`, [
    eventId,
  ]);
  assert.equal(err, null, 'the guard must not leak onto unrelated columns');
});

test('an event with NO AI order is completely unaffected', async () => {
  await asHost();
  const err = await tryQuery(RETYPE_TO_WEDDING, [freeEventId]);
  assert.equal(err, null);
  assert.equal(await typeOf(freeEventId), 'wedding');
  const back = await tryQuery(retypeAwayFromWedding('simple_event'), [freeEventId]);
  assert.equal(back, null, 'even an A → E move is fine while no money is committed');
});

test('CHEAPER → DEARER is refused cleanly rather than silently upgraded', async () => {
  // The upgrade case the owner called out: legitimate product behaviour, but no
  // billing is built for it, so it must be a clean refusal (not a free upgrade).
  await asHost();
  const err = await tryQuery(`UPDATE public.events SET event_type = 'debut' WHERE event_id = $1`, [eventId]);
  assert.notEqual(err, null, 'D → B is a free tier upgrade');
  assert.match(String(err), /price tier/i);
});

test('DEARER → CHEAPER is refused too (a downgrade would de-sync the snapshot)', async () => {
  await asService();
  await db.query(RETYPE_TO_WEDDING, [eventId]);
  await asHost();
  const err = await tryQuery(retypeAwayFromWedding('birthday'), [eventId]);
  assert.notEqual(err, null, 'A → C after purchase must not be a self-service move either');
  assert.match(String(err), /price tier/i);
  await asService();
  await db.query(retypeAwayFromWedding('gender_reveal'), [eventId]);
});

// ── 5. THE PURCHASE-TIME SNAPSHOT ───────────────────────────────────────────

test('the tier is SNAPSHOT when the paid entitlement turns on', async () => {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('sec5-snapshot@example.com') RETURNING id`,
  );
  const uid = u.rows[0]!.id;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('SEC-5 Snapshot Event', 'birthday') RETURNING event_id`,
  );
  const id = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [id, uid],
  );

  assert.equal(await tierSnapshotOf(id), null, 'nothing bought yet — no snapshot');

  // The real activation path (lib/sku-activation.ts) runs as service_role.
  await asService();
  await db.query(`UPDATE public.events SET setnayan_ai_active = TRUE WHERE event_id = $1`, [id]);
  assert.equal(await tierSnapshotOf(id), 'C', 'birthday is Tier C — the entitlement must record WHICH tier was bought');
});

test('the snapshot is never re-baselined by a later re-activation', async () => {
  await reset();
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('SEC-5 Renewal Event', 'birthday') RETURNING event_id`,
  );
  const id = ev.rows[0]!.event_id;
  await asService();
  await db.query(`UPDATE public.events SET setnayan_ai_active = TRUE WHERE event_id = $1`, [id]);
  assert.equal(await tierSnapshotOf(id), 'C');

  // Admin re-types (allowed for service_role), then the entitlement cycles.
  await db.query(RETYPE_TO_WEDDING, [id]);
  await db.query(`UPDATE public.events SET setnayan_ai_active = FALSE WHERE event_id = $1`, [id]);
  await db.query(`UPDATE public.events SET setnayan_ai_active = TRUE WHERE event_id = $1`, [id]);
  assert.equal(
    await tierSnapshotOf(id),
    'C',
    'a re-approval must not silently re-baseline the purchased tier to whatever the type says now',
  );
});

/* ── The snapshot is defended by TWO independent layers ─────────────────────
 * LAYER 1, the column GRANT: 20271005100000 keeps setnayan_ai_tier_at_purchase
 *   out of the UPDATE/INSERT allow-list, so `authenticated` has no privilege on
 *   it at all and the statement is refused before any trigger runs.
 * LAYER 2, the guard TRIGGER: guard_events_ai_entitlement fires only when
 *   current_user is 'authenticated' or 'anon'.
 *
 * The two tests below exercise them SEPARATELY, because layer 1 masks layer 2 —
 * once the grant is missing, the trigger is unreachable through the very role it
 * targets. Testing only the outer layer would let the trigger rot unnoticed.
 *
 * Verified against prod 2026-07-26:
 * has_column_privilege('authenticated','public.events',
 * 'setnayan_ai_tier_at_purchase', 'UPDATE'|'INSERT'|'SELECT') is FALSE for all
 * three — so layer 1 really is what refuses a host in production.            */

test('the snapshot column is not writable by the host', async () => {
  // LAYER 1 — the grant. No column privilege, so this never reaches the trigger.
  await asHost();
  const priv = await db.query<{ u: boolean; i: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events','setnayan_ai_tier_at_purchase','UPDATE') AS u,
            has_column_privilege('authenticated','public.events','setnayan_ai_tier_at_purchase','INSERT') AS i`,
  );
  assert.equal(priv.rows[0]!.u, false, 'authenticated holds UPDATE on the tier snapshot — a host can forge it');
  assert.equal(priv.rows[0]!.i, false, 'authenticated holds INSERT on the tier snapshot — a host can pre-load it');

  const err = await tryQuery(
    `UPDATE public.events SET setnayan_ai_tier_at_purchase = 'E' WHERE event_id = $1`,
    [eventId],
  );
  assert.notEqual(err, null, 'a host could forge the tier they "bought at" and unlock every re-type');
  assert.match(String(err), /permission denied/i);
});

test('the snapshot guard trigger still refuses even if the column grant is widened', async () => {
  // LAYER 2 — defence in depth. Hand `authenticated` the grant that prod
  // withholds, so the trigger becomes reachable, and prove it still refuses.
  // Without this, deleting the stamp trigger would break nothing visible.
  await reset();
  await db.exec(
    `GRANT UPDATE (setnayan_ai_tier_at_purchase), INSERT (setnayan_ai_tier_at_purchase)
       ON public.events TO authenticated`,
  );
  try {
    await asHost();
    const updateErr = await tryQuery(
      `UPDATE public.events SET setnayan_ai_tier_at_purchase = 'E' WHERE event_id = $1`,
      [eventId],
    );
    assert.notEqual(updateErr, null, 'with the grant present, nothing stopped the host forging the snapshot');
    assert.match(String(updateErr), /not writable by the couple/i);

    // …and the same guard must cover the INSERT path, or the UPDATE guard is
    // simply bypassed by writing the snapshot at creation time.
    const insertErr = await tryQuery(
      `INSERT INTO public.events (display_name, event_type, setnayan_ai_tier_at_purchase)
       VALUES ('SEC-5 Forged Insert', 'birthday', 'E')`,
    );
    assert.notEqual(insertErr, null, 'the UPDATE guard is bypassed by writing the snapshot at INSERT time');
    assert.match(String(insertErr), /not writable by the couple/i);
  } finally {
    await reset();
    await db.exec(
      `REVOKE UPDATE (setnayan_ai_tier_at_purchase), INSERT (setnayan_ai_tier_at_purchase)
         ON public.events FROM authenticated`,
    );
  }
});

test('the snapshot cannot be pre-loaded at INSERT time', async () => {
  // LAYER 1 again, on the INSERT path.
  await asHost();
  const err = await tryQuery(
    `INSERT INTO public.events (display_name, event_type, setnayan_ai_tier_at_purchase)
     VALUES ('SEC-5 Forged Insert', 'birthday', 'E')`,
  );
  assert.notEqual(err, null, 'the UPDATE guard is bypassed by writing the snapshot at INSERT time');
  assert.match(String(err), /permission denied/i);
});

test('a STRANGER cannot freeze a victim event by pointing an order at it', async () => {
  // `orders_owner_write` is only WITH CHECK (user_id = auth.uid()) — it never
  // checks that event_id is yours — so the lock must not be arm-able by someone
  // who is not a member of the event.
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('sec5-stranger@example.com') RETURNING id`,
  );
  const strangerUid = u.rows[0]!.id;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('SEC-5 Victim Event', 'gender_reveal') RETURNING event_id`,
  );
  const victimEventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [victimEventId, hostUid],
  );

  // The stranger's order, aimed at the victim's event.
  await db.query(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'SETNAYAN_AI', 'Griefing order', 99, 'submitted', 'SEC5GRIEF')`,
    [victimEventId, strangerUid],
  );

  await asHost();
  const err = await tryQuery(RETYPE_TO_WEDDING, [victimEventId]);
  assert.equal(err, null, 'a stranger armed the tier lock on an event they do not belong to');
});

// ── 6. The entitlement holder with NO order row is still locked ─────────────

test('a comped entitlement (setnayan_ai_active, no order row) still locks the tier', async () => {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('sec5-comp@example.com') RETURNING id`,
  );
  const uid = u.rows[0]!.id;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('SEC-5 Comped Event', 'birthday') RETURNING event_id`,
  );
  const id = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [id, uid],
  );
  await asService();
  await db.query(`UPDATE public.events SET setnayan_ai_active = TRUE WHERE event_id = $1`, [id]);

  await reset();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  const err = await tryQuery(RETYPE_TO_WEDDING, [id]);
  assert.notEqual(err, null, 'a comp grant is money-equivalent — the tier is still locked');
  assert.match(String(err), /price tier/i);
});
