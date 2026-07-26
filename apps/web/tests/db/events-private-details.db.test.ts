/**
 * SEC-2b — a wedding GUEST must not be able to SELECT the couple's birth dates,
 * budget, wizard_state or Google account off the events row.
 * End-to-end (test:db, every migration replayed into PGlite).
 *
 * THE HOLE THIS CLOSES: `public.current_event_ids()` (20260512000000:178) is
 * `SELECT event_id FROM event_members WHERE user_id = auth.uid()` — no
 * member_type filter. `event_member_can_read` (20260512000000:242) is
 * `FOR SELECT TO authenticated USING (event_id IN current_event_ids())`, and RLS
 * is ROW-level, so a plain wedding GUEST (member_type='guest', seeded by
 * app/join/[eventId]) read the ENTIRE events row. 20271007100000 took the
 * credentials off it and deliberately deferred these eleven personal columns,
 * because the COUPLE reads them with the SAME `authenticated` role. This is
 * that follow-up.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ IF YOU ARE HERE TO RELAX THE GUARD, RE-RUN THE MUTATION CHECK.
 *
 * This repo has shipped VACUOUS DB tests twice. A psql/PGlite connection that
 * OWNS the table skips RLS *and* column privileges, so every "denied" assertion
 * passes no matter what the policy says. A green run alone proves nothing.
 * Before trusting one, prove the suite can still FAIL.
 *
 * Baseline: 19 subtests, 19 pass. Three mutations were run on 2026-07-26, each
 * restored afterwards and re-verified at 19/19:
 *
 *   M3 · the whole point — REMOVE THE FIX.
 *        Replace the migration file with `SELECT 1;`.
 *        → 12 of 19 FAIL (3, 6, 7, 8, 9, 10, 11, 12, 15, 16, 18, 19).
 *        The 7 survivors are exactly the controls: the two META probes that
 *        assert the session is unprivileged and that the guest IS admitted by
 *        the row policy, the two guest POSITIVE controls, the two SEC-2 union
 *        checks, and coverage-17 (which has nothing to complain about when
 *        nothing is denied). Controls are supposed to survive.
 *
 *   M2 · isolate the LOCK from the view — keep events_host, but replace the two
 *        `EXECUTE format('REVOKE …' / 'GRANT …')` statements with `NULL;` and
 *        delete the migration's own post-condition block.
 *        → 4 of 19 FAIL (3, 6, 7, 8). Every one of them is a guest-denial test,
 *        which is the proof that those four assert the GRANT and not the view.
 *
 *   M1 · isolate the RE-APPLY — comment out the
 *        `db.exec(readFileSync(…PRIVATE_MIGRATION_FILE…))` line in before().
 *        → 5 of 19 FAIL (3, 6, 7, 8, 12). Note this is NOT a clean "no fix"
 *        state: the migration still runs inside the replay loop, so the view
 *        exists — the harness's blanket `GRANT ALL ON ALL TABLES` is what
 *        re-opens the columns and hands anon/authenticated a write on the view
 *        (hence 12). That is exactly why before() re-applies the file.
 *
 * If M3 ever passes, the suite has gone vacuous — stop and fix the harness
 * before touching the migration.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * Five defences, beyond the mutation check above:
 *
 *   1. `META: the impersonated session is really un-privileged` asserts
 *      current_user is literally 'authenticated', that the role has no
 *      BYPASSRLS, and that it does not own public.events. It runs FIRST.
 *   2. A POSITIVE CONTROL: the same guest, in the same session, successfully
 *      SELECTs the guest-visible slice INCLUDING event_date. If the role/JWT
 *      wiring were broken everything would fail and the denials would be
 *      meaningless.
 *   3. A DIFFERENTIAL CONTROL: every statement asserted to fail as
 *      `authenticated` is re-run as `service_role` and asserted to SUCCEED.
 *      That makes a denial attributable to the GRANT rather than to a typo'd
 *      column, a missing row, or an RLS row filter.
 *   4. An RLS CONTROL: the test proves the guest's membership really does open
 *      the row (they read display_name off it), so "no rows" can never be
 *      mistaken for "column denied".
 *   5. A HOST CONTROL: the couple and an accepted moderator read every one of
 *      the eleven columns through public.events_host in the same run. A fix
 *      that closed the guest by breaking the couple would fail here.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { MIGRATIONS_DIR, createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { SELECT_MIGRATION_FILE } from '../../lib/security/events-column-select-privileges';
import {
  GUEST_READABLE_SAMPLE,
  HOST_VIEW,
  PRIVATE_MIGRATION_FILE,
  PRIVATE_SELECT_COLUMNS,
  SEC2_LOCKED_COLUMNS,
} from '../../lib/security/events-private-details';

let replay: ReplayResult;
let db: PGlite;

let hostUid: string;
let guestUid: string;
let moderatorUid: string;
let coordinatorUid: string;
let otherHostUid: string;
let eventId: string;
let otherEventId: string;

const BIRTH_DATE = '1994-03-02';
const BUDGET = 93_000_000;
const DRIVE_EMAIL = 'the.couple@gmail.com';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

/** Impersonate a signed-in user: uid claim + role claim + SET ROLE. */
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
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

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // ── HARNESS ARTIFACT, not a prod behaviour ────────────────────────────────
  // replay-migrations.ts runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,
  // authenticated, service_role` AFTER the replay loop, to emulate the Supabase
  // default privileges that normally fire at CREATE TABLE time. That blanket
  // grant re-adds the table-level SELECT both migrations revoked, so without
  // re-applying we would be testing the pre-fix schema.
  //
  // Order matters and is load-bearing: SEC-2 FIRST, then SEC-2b. SEC-2b's
  // allow-list is "what the role can read right now, minus my deny-set", so
  // running it against a blanket-granted table WITHOUT replaying SEC-2 first
  // would legitimately re-grant master_qr_token — which is precisely the union
  // property `the SEC-2 deny-set survives` below exists to pin. This mirrors
  // prod, where the two migrations applied in this order.
  //
  // We re-execute the REAL migration files, never a reconstruction.
  await db.exec(readFileSync(join(MIGRATIONS_DIR, SELECT_MIGRATION_FILE), 'utf8'));
  await db.exec(readFileSync(join(MIGRATIONS_DIR, PRIVATE_MIGRATION_FILE), 'utf8'));

  const mk = async (email: string): Promise<string> => {
    const u = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
      [email],
    );
    return u.rows[0]!.id;
  };
  hostUid = await mk('sec2b-host@example.com');
  guestUid = await mk('sec2b-guest@example.com');
  moderatorUid = await mk('sec2b-moderator@example.com');
  coordinatorUid = await mk('sec2b-coordinator@example.com');
  otherHostUid = await mk('sec2b-other-host@example.com');

  const mkEvent = async (name: string): Promise<string> => {
    const ev = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, venue_name)
       VALUES ($1, 'birthday', 'Manila Hotel') RETURNING event_id`,
      [name],
    );
    return ev.rows[0]!.event_id;
  };
  eventId = await mkEvent('SEC-2b Event');
  otherEventId = await mkEvent('SEC-2b Other Event');

  // Real private data on BOTH rows — the second one is what proves the host
  // view does not leak sideways between events.
  await db.query(
    `UPDATE public.events
        SET partner_a_birth_date        = $2::date,
            partner_a_birth_time        = '07:30:00'::time,
            partner_b_birth_date        = '1993-11-17'::date,
            partner_b_birth_time        = '19:05:00'::time,
            bazi_birthdata_consent_at   = now(),
            estimated_budget_centavos   = $3,
            budget_band                 = 'classic',
            wizard_state                = '{"set_estimated_budget":{"centavos":93000000},"monogram":{"initials":"MC&JD"}}'::jsonb,
            photo_delivery_folder_id    = 'drive-folder-abc',
            photo_delivery_folder_name  = 'Maria & Jose Wedding',
            photo_delivery_account_email = $4
      WHERE event_id IN ($1, $5)`,
    [eventId, BIRTH_DATE, BUDGET, DRIVE_EMAIL, otherEventId],
  );

  for (const [uid, type] of [
    [hostUid, 'couple'],
    [guestUid, 'guest'],
    // The moderator's DASHBOARD access comes from event_moderators, not from a
    // member_type — they are seeded as a plain guest member on purpose, so that
    // "the moderator can read" cannot be an accident of member_type.
    [moderatorUid, 'guest'],
    [coordinatorUid, 'coordinator'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [eventId, uid, type],
    );
  }
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [otherEventId, otherHostUid],
  );
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external', '{}'::jsonb, now())`,
    [eventId, moderatorUid],
  );
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0. Meta: the session must genuinely be un-privileged ────────────────────

test('META: the impersonated session is really `authenticated`, not the owner', async () => {
  await asUser(guestUid);
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.events'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the authenticated role can BYPASSRLS — the whole suite would be meaningless');
  assert.notEqual(row.owner, 'authenticated', 'authenticated owns public.events — grants would not apply to it');

  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.events'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true, 'RLS is disabled on public.events');
  await reset();
});

test('META: the leak this fixes is real — the guest IS admitted by the row policy', async () => {
  // current_event_ids() has no member_type filter, so the guest is a "member".
  // If this ever stops being true the column grant is belt-only, and the
  // denials below would pass for the wrong reason (a row filter, not the grant).
  await asUser(guestUid);
  const admitted = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.current_event_ids() AS t(id) WHERE t.id = $1`,
    [eventId],
  );
  assert.equal(
    admitted.rows[0]!.n,
    1,
    'current_event_ids() no longer admits a plain guest — re-read this test',
  );
  await reset();
});

test('META: the catalog agrees with the deny-set (the revoke actually landed)', async () => {
  for (const col of PRIVATE_SELECT_COLUMNS) {
    const r = await db.query<{ a: boolean; n: boolean; s: boolean }>(
      `SELECT has_column_privilege('authenticated','public.events',$1,'SELECT') AS a,
              has_column_privilege('anon','public.events',$1,'SELECT') AS n,
              has_column_privilege('service_role','public.events',$1,'SELECT') AS s`,
      [col],
    );
    assert.equal(r.rows[0]!.a, false, `authenticated still holds SELECT on ${col}`);
    assert.equal(r.rows[0]!.n, false, `anon still holds SELECT on ${col}`);
    assert.equal(r.rows[0]!.s, true, `service_role LOST SELECT on ${col} — the Drive pipeline is broken`);
  }
});

// ── 1. Positive controls — nothing the guest legitimately does may break ────

test('a GUEST can still read the event fields the guest surfaces need', async () => {
  await asUser(guestUid);

  // Exactly the slice app/_components/account-switcher/get-switcher-data.ts and
  // lib/events.ts fetchUserEvents read. A single denied column fails the WHOLE
  // statement, so this is a real end-to-end assertion, not a privilege lookup.
  const err = await tryQuery(
    `SELECT ${GUEST_READABLE_SAMPLE.join(', ')} FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(err, null, `the guest-visible slice was rejected: ${err}`);

  // The owner's actual sentence: "guests cannot see budget and birthdate. just
  // event date." Pin the "just event date" half explicitly.
  const r = await db.query<{ display_name: string; event_date: string | null }>(
    `SELECT display_name, event_date FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows.length, 1, 'the guest can no longer see the event row at all — switcher/library go blank');
  assert.equal(r.rows[0]!.display_name, 'SEC-2b Event');
  await reset();
});

test('a GUEST can still read the event through the PostgREST embed shape', async () => {
  // lib/events.ts fetchUserEvents is `event_members → events:event_id (…)`.
  // PostgREST resolves an embed as a join, so the events side is still gated by
  // events' own RLS *and* column privileges. Same join, same roles.
  await asUser(guestUid);
  const r = await db.query<{ member_type: string; display_name: string }>(
    `SELECT em.member_type, e.display_name, e.event_date, e.monogram_text, e.concierge_status
       FROM public.event_members em
       JOIN public.events e ON e.event_id = em.event_id
      WHERE em.user_id = $1`,
    [guestUid],
  );
  assert.equal(r.rows.length, 1, 'the guest embed returned nothing — the switcher list would be empty');
  assert.equal(r.rows[0]!.member_type, 'guest');
  await reset();
});

// ── 2. The lock — with a differential control on every denial ───────────────

test('a GUEST CANNOT read any private column (and service_role still can)', async () => {
  const failures: string[] = [];

  for (const col of PRIVATE_SELECT_COLUMNS) {
    const stmt = `SELECT ${col} FROM public.events WHERE event_id = $1`;

    await asUser(guestUid);
    const guestErr = await tryQuery(stmt, [eventId]);
    if (guestErr === null) {
      failures.push(`${col}: GUEST SELECT SUCCEEDED — still leaking`);
      continue;
    }
    if (!/permission denied/i.test(guestErr)) {
      failures.push(`${col}: rejected, but not by privileges → ${guestErr}`);
      continue;
    }

    // DIFFERENTIAL: the identical statement must work as service_role. Without
    // this a denial could mean the column name is a typo or the row is missing.
    await asService();
    const svcErr = await tryQuery(stmt, [eventId]);
    if (svcErr !== null) {
      failures.push(`${col}: service_role ALSO failed (${svcErr}) — the denial above proves nothing`);
    }
  }

  await reset();
  assert.deepEqual(failures, [], `guest-read failures:\n  ${failures.join('\n  ')}`);
});

test('the guest cannot reach the budget or birth data by any PostgREST-expressible route', async () => {
  const attacks: Array<[string, string, 'event' | 'user']> = [
    ['select=*', `SELECT * FROM public.events WHERE event_id = $1`, 'event'],
    [
      'select=estimated_budget_centavos',
      `SELECT estimated_budget_centavos FROM public.events WHERE event_id = $1`,
      'event',
    ],
    [
      'blind-search filter (?estimated_budget_centavos=gt.50000000)',
      `SELECT event_id FROM public.events WHERE event_id = $1 AND estimated_budget_centavos > 50000000`,
      'event',
    ],
    [
      'blind-search filter (?partner_a_birth_date=lt.…)',
      `SELECT event_id FROM public.events WHERE event_id = $1 AND partner_a_birth_date < '2000-01-01'`,
      'event',
    ],
    [
      'order oracle (?order=estimated_budget_centavos)',
      `SELECT event_id FROM public.events WHERE event_id = $1 ORDER BY estimated_budget_centavos`,
      'event',
    ],
    [
      'aggregate leak (?select=estimated_budget_centavos.max())',
      `SELECT max(estimated_budget_centavos) FROM public.events WHERE event_id = $1`,
      'event',
    ],
    [
      'jsonb path into wizard_state (?select=wizard_state->set_estimated_budget)',
      `SELECT wizard_state -> 'set_estimated_budget' FROM public.events WHERE event_id = $1`,
      'event',
    ],
    [
      'embed from a child table (?select=*,events(partner_a_birth_date))',
      `SELECT e.partner_a_birth_date FROM public.event_members em
         JOIN public.events e ON e.event_id = em.event_id WHERE em.user_id = $1`,
      'user',
    ],
  ];

  const failures: string[] = [];
  for (const [label, sql, param] of attacks) {
    await asUser(guestUid);
    const err = await tryQuery(sql, [param === 'user' ? guestUid : eventId]);
    if (err === null) {
      failures.push(`${label}: SUCCEEDED`);
      continue;
    }
    if (!/permission denied/i.test(err)) {
      failures.push(`${label}: rejected, but not by privileges → ${err}`);
    }
  }
  await reset();
  assert.deepEqual(failures, [], `reachable routes:\n  ${failures.join('\n  ')}`);
});

test('a member_type=coordinator and a Samahan-style non-host are equally locked out', async () => {
  // 20270920030000 kept coordinators on some surfaces but not the money/biometric
  // ones. The dashboard layout does not admit a member_type='coordinator' either
  // (only 'couple' or an accepted event_moderators row), so this is the status quo.
  await asUser(coordinatorUid);
  const err = await tryQuery(
    `SELECT estimated_budget_centavos, partner_a_birth_date FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.match(String(err), /permission denied/i, 'a coordinator can still read the private columns');

  const viaView = await db.query(
    `SELECT event_id FROM public.${HOST_VIEW} WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(viaView.rows.length, 0, 'a member_type=coordinator gets rows from the host view');
  await reset();
});

// ── 3. The host read path — the "did you break the couple?" half ────────────

test('the COUPLE reads every private column through the host view', async () => {
  await asUser(hostUid);
  const r = await db.query<Record<string, unknown>>(
    `SELECT ${PRIVATE_SELECT_COLUMNS.join(', ')},
            partner_a_birth_date::text AS birth_date_text,
            partner_a_birth_time::text AS birth_time_text
       FROM public.${HOST_VIEW} WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows.length, 1, 'the couple cannot read their own private columns — the dashboard is broken');
  const row = r.rows[0]!;
  // ::text, not String(value): the PGlite driver hydrates `date`/`time` into JS
  // Date objects, whereas PostgREST hands the app ISO strings. Comparing the
  // text projection tests the DATA, not the driver.
  assert.equal(row.birth_date_text, BIRTH_DATE, 'birth date did not round-trip');
  assert.equal(row.birth_time_text, '07:30:00', 'birth time did not round-trip');
  assert.equal(Number(row.estimated_budget_centavos), BUDGET, 'budget did not round-trip');
  assert.equal(row.photo_delivery_account_email, DRIVE_EMAIL, 'Drive account did not round-trip');
  assert.equal(
    (row.wizard_state as { monogram?: { initials?: string } })?.monogram?.initials,
    'MC&JD',
    'wizard_state did not round-trip as JSONB',
  );

  // `select=*` must work on the view — several readers select a wide slice.
  const star = await tryQuery(`SELECT * FROM public.${HOST_VIEW} WHERE event_id = $1`, [eventId]);
  assert.equal(star, null, `select=* on the host view was rejected: ${star}`);
  await reset();
});

test('an ACCEPTED MODERATOR reads the host view; a plain GUEST gets zero rows', async () => {
  // Same predicate app/dashboard/[eventId]/layout.tsx:122 uses, now in the DB.
  await asUser(moderatorUid);
  const mod = await db.query(
    `SELECT estimated_budget_centavos FROM public.${HOST_VIEW} WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(mod.rows.length, 1, 'an accepted moderator lost the dashboard read — regression');

  await asUser(guestUid);
  const guest = await db.query(`SELECT event_id FROM public.${HOST_VIEW} WHERE event_id = $1`, [eventId]);
  assert.equal(guest.rows.length, 0, 'the host view handed a plain guest the row');

  // ...and not by any filter either: the view must be empty for them, period.
  const anyRow = await db.query(`SELECT count(*)::int AS n FROM public.${HOST_VIEW}`);
  assert.equal((anyRow.rows[0] as { n: number }).n, 0, 'the guest sees rows in the host view');
  await reset();
});

test('the host view does not leak SIDEWAYS between events', async () => {
  // The view is a DEFINER view, so its WHERE clause is the ONLY thing standing
  // between a host and every other couple's budget. This is that single point
  // of failure, tested directly.
  await asUser(hostUid);
  const other = await db.query(
    `SELECT estimated_budget_centavos FROM public.${HOST_VIEW} WHERE event_id = $1`,
    [otherEventId],
  );
  assert.equal(other.rows.length, 0, "a host read ANOTHER couple's private columns through the view");

  const all = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${HOST_VIEW}`);
  assert.equal(all.rows[0]!.n, 1, 'the host view returned more than the caller’s own event');
  await reset();
});

test('the host view is READ-ONLY and closed to anon', async () => {
  // A single-table view with a simple WHERE is auto-updatable, and this one runs
  // with definer rights — a write grant here would bypass couple_can_update_event
  // (and RLS) entirely.
  await asUser(hostUid);
  const upd = await tryQuery(
    `UPDATE public.${HOST_VIEW} SET estimated_budget_centavos = 1 WHERE event_id = $1`,
    [eventId],
  );
  assert.match(String(upd), /permission denied/i, 'the host view is WRITABLE — it bypasses couple_can_update_event');

  const del = await tryQuery(`DELETE FROM public.${HOST_VIEW} WHERE event_id = $1`, [eventId]);
  assert.match(String(del), /permission denied/i, 'the host view is DELETE-able');

  await asAnon();
  const anon = await tryQuery(`SELECT event_id FROM public.${HOST_VIEW}`);
  assert.match(String(anon), /permission denied/i, 'anon can read the host view');
  await reset();
});

test('the host view does NOT re-expose the SEC-2 credentials', async () => {
  // The view is "events minus the credentials". If it ever projected them it
  // would quietly undo 20271007100000 through a new door.
  for (const col of SEC2_LOCKED_COLUMNS) {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [HOST_VIEW, col],
    );
    assert.equal(r.rows[0]!.n, 0, `${HOST_VIEW} projects ${col} — SEC-2 re-opened`);
  }
});

test('the SEC-2 deny-set survives this migration (the union property)', async () => {
  // SEC-2b REVOKEs then re-GRANTs on the same table. Its allow-list is computed
  // from LIVE privileges, not from the full catalog — if that ever changed,
  // master_qr_token and the Drive OAuth token would come straight back.
  for (const col of SEC2_LOCKED_COLUMNS) {
    const r = await db.query<{ a: boolean; n: boolean }>(
      `SELECT has_column_privilege('authenticated','public.events',$1,'SELECT') AS a,
              has_column_privilege('anon','public.events',$1,'SELECT') AS n`,
      [col],
    );
    assert.equal(r.rows[0]!.a, false, `SEC-2 REGRESSED: authenticated regained SELECT on ${col}`);
    assert.equal(r.rows[0]!.n, false, `SEC-2 REGRESSED: anon regained SELECT on ${col}`);
  }

  await asUser(guestUid);
  const err = await tryQuery(`SELECT master_qr_token FROM public.events WHERE event_id = $1`, [eventId]);
  assert.match(String(err), /permission denied/i, 'the crew-pairing token is readable again');
  await reset();
});

// ── 4. Writes must be untouched ─────────────────────────────────────────────

test('the COUPLE can still WRITE the private columns (SELECT revoke did not touch UPDATE)', async () => {
  await asUser(hostUid);

  // The budget planner (budget/actions.ts:88) and setEstimatedBudget.
  const budget = await tryQuery(
    `UPDATE public.events SET estimated_budget_centavos = 42000000 WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(budget, null, `the couple can no longer set their budget: ${budget}`);

  // All 17 wizard read-modify-write cycles end in this statement.
  const wizard = await tryQuery(
    `UPDATE public.events SET wizard_state = '{"set_estimated_budget":{"centavos":42000000}}'::jsonb
      WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(wizard, null, `the couple can no longer persist wizard_state: ${wizard}`);

  // And the write is visible back through the host view — read path and write
  // path must agree, or the dashboard shows stale numbers.
  const back = await db.query<{ estimated_budget_centavos: number }>(
    `SELECT estimated_budget_centavos FROM public.${HOST_VIEW} WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(back.rows[0]!.estimated_budget_centavos), 42000000, 'the host view did not see the write');

  // restore for any later test
  await db.query(`UPDATE public.events SET estimated_budget_centavos = $2 WHERE event_id = $1`, [eventId, BUDGET]);
  await reset();
});

test('a GUEST still cannot WRITE the private columns', async () => {
  // couple_can_update_event (20260513040000:91) is already couple-scoped, so
  // this was never open — pinned so a future policy edit cannot open it while
  // everyone is looking at the read side.
  await asUser(guestUid);
  const r = await db.query(
    `UPDATE public.events SET estimated_budget_centavos = 1 WHERE event_id = $1 RETURNING event_id`,
    [eventId],
  );
  assert.equal(r.rows.length, 0, 'a guest WROTE the couple’s budget');
  await reset();

  await asService();
  const svc = await db.query<{ estimated_budget_centavos: number }>(
    `SELECT estimated_budget_centavos FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(svc.rows[0]!.estimated_budget_centavos), BUDGET, 'the guest UPDATE actually landed');
  await reset();
});

// ── 5. Coverage — this is what stops the contract rotting ───────────────────

test('COVERAGE: every events column is granted to authenticated or in a deny-set', async () => {
  // Both migrations snapshot their allow-list at apply time. A column added to
  // public.events later is SELECT-denied to authenticated and NOBODY notices
  // until a page 42501s in production. This is the tripwire.
  const denied = [...SEC2_LOCKED_COLUMNS, ...PRIVATE_SELECT_COLUMNS];
  const r = await db.query<{ column_name: string }>(
    `SELECT c.column_name
       FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'events'
        AND NOT has_column_privilege('authenticated','public.events',c.column_name,'SELECT')
        AND c.column_name <> ALL ($1::text[])
      ORDER BY c.ordinal_position`,
    [denied],
  );
  assert.deepEqual(
    r.rows.map((x) => x.column_name),
    [],
    'these events columns are SELECT-denied but in neither deny-set. If you just ADDED a column, ' +
      'also add: GRANT SELECT (col) ON public.events TO authenticated, anon; ' +
      'GRANT UPDATE (col), INSERT (col) ON public.events TO authenticated; ' +
      'and rebuild public.events_host (copy section 2 of ' +
      PRIVATE_MIGRATION_FILE +
      '). If the column is PRIVATE, add it to PRIVATE_SELECT_COLUMNS instead.',
  );
});

test('COVERAGE: everything authenticated can read on events also exists on the host view', async () => {
  // The view freezes its projection at CREATE time. If a column is added to
  // events and granted, but the view is not rebuilt, every host reader that
  // names it through events_host 42703s. Same tripwire, other direction.
  const r = await db.query<{ column_name: string }>(
    `SELECT c.column_name
       FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'events'
        AND has_column_privilege('authenticated','public.events',c.column_name,'SELECT')
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns v
           WHERE v.table_schema = 'public' AND v.table_name = $1
             AND v.column_name = c.column_name
        )
      ORDER BY c.ordinal_position`,
    [HOST_VIEW],
  );
  assert.deepEqual(
    r.rows.map((x) => x.column_name),
    [],
    `these events columns are readable on the base table but MISSING from public.${HOST_VIEW} — ` +
      'rebuild the view (section 2 of ' + PRIVATE_MIGRATION_FILE + ') so host readers keep working.',
  );
});

test('COVERAGE: every private column IS on the host view', async () => {
  for (const col of PRIVATE_SELECT_COLUMNS) {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [HOST_VIEW, col],
    );
    assert.equal(r.rows[0]!.n, 1, `${col} is denied on events but absent from ${HOST_VIEW} — hosts cannot read it`);
  }
});
