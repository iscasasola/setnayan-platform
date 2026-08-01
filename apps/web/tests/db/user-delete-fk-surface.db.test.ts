/**
 * Deleting a user must not be refused by a foreign key nobody decided on.
 *
 * ── THE MISTAKE THIS GUARD EXISTS TO PREVENT ───────────────────────────────
 * On 2026-08-01 a single FK was fixed — `vendor_ig_oauth_state.initiated_by`,
 * which had no ON DELETE clause and therefore defaulted to NO ACTION (refuse),
 * with three abandoned Instagram handshakes blocking the owner's own account.
 *
 * That fix treated an instance as an instance. The class query took ten seconds
 * and returned TWENTY-ONE. Four were actively blocking: oauth_state (30 rows),
 * event_moderators (2), slug_change_log (1), event_manual_vendors (1).
 *
 * Fixing one member of a pattern and moving on is the same error as trusting a
 * name grep: it checks the thing in front of you instead of the shape.
 *
 * ── WHAT THIS ASSERTS ──────────────────────────────────────────────────────
 * Every single-column FK onto `auth.users` either has a delete behaviour
 * (SET NULL / CASCADE), or is named in the baseline with a written reason.
 * Refusing IS a legitimate choice — a financial record that must survive its
 * author is a real thing. What is not legitimate is refusing BY DEFAULT,
 * because nobody wrote an ON DELETE clause.
 *
 * ⚠ NOTE THE DIRECTION. This does not demand CASCADE everywhere. Cascading an
 * authorship stamp would delete an event's moderator list because the person
 * who sent the invitations left. The event record belongs to the event.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const BASELINE = path.join(__dirname, 'user-delete-refusing-fks.baseline.txt');

function readBaseline(): Map<string, string> {
  const out = new Map<string, string>();
  if (!fs.existsSync(BASELINE)) return out;
  for (const raw of fs.readFileSync(BASELINE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [k, ...rest] = line.split('|');
    out.set((k ?? '').trim(), rest.join('|').trim());
  }
  return out;
}

/**
 * Single-column FKs onto EITHER users table whose delete action is NO ACTION
 * ('a') or RESTRICT ('r').
 *
 * ⚠ THE `public.users` HALF WAS MISSING UNTIL 2026-08-02, AND THAT IS WHY THIS
 * GUARD PASSED WHILE THE DELETE STAYED BROKEN. The original query filtered on
 * `confrelid = 'auth.users'::regclass` alone. Of the 30 blockers still live
 * after the first sweep, exactly FOUR pointed at auth.users — the same four the
 * baseline already listed — and the other TWENTY-SIX pointed at public.users
 * and were simply invisible here.
 *
 * They are not a separate problem. `public.users.user_id -> auth.users(id)` is
 * ON DELETE CASCADE, so deleting an auth user ALWAYS cascades into public.users
 * and detonates every FK pointing there. A guard scoped to one of the two
 * tables is a guard scoped to a fraction of the delete.
 */
async function refusingFks(): Promise<string[]> {
  const { rows } = await db.query<{ k: string }>(`
    SELECT con.conrelid::regclass::text || '.' || a.attname AS k
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid IN ('auth.users'::regclass, 'public.users'::regclass)
       AND con.confdeltype IN ('a', 'r')
       AND array_length(con.conkey, 1) = 1
     ORDER BY 1
  `);
  return rows.map((r) => r.k);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

test('META · auth.users exists in the replay and has inbound FKs', async () => {
  // Anti-vacuity: if auth.users were missing, refusingFks() would throw or
  // return empty and every assertion below would pass for the wrong reason.
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_constraint
      WHERE contype='f' AND confrelid='auth.users'::regclass`,
  );
  assert.ok((rows[0]?.n ?? 0) > 20, 'suspiciously few FKs onto auth.users — the replay looks wrong');
});

test('META · public.users is in scope too, and cascades from auth.users', async () => {
  // The second half of the anti-vacuity check, added 2026-08-02. Both halves
  // matter for a different reason: if public.users dropped out of refusingFks()
  // the guard would go quiet again on 26 of the 30 blockers it exists to catch.
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_constraint
      WHERE contype='f' AND confrelid='public.users'::regclass`,
  );
  assert.ok(
    (rows[0]?.n ?? 0) > 50,
    'suspiciously few FKs onto public.users — the widened scope is not actually reaching it',
  );

  // And the link that makes them one delete rather than two.
  const { rows: link } = await db.query<{ d: string }>(
    `SELECT con.confdeltype AS d FROM pg_constraint con
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE con.contype='f' AND con.conrelid='public.users'::regclass
        AND con.confrelid='auth.users'::regclass AND a.attname='user_id'`,
  );
  assert.equal(
    link[0]?.d,
    'c',
    'public.users.user_id no longer CASCADEs from auth.users — if that changed, the whole ' +
      'reasoning behind sweeping public.users FKs needs revisiting.',
  );
});

test('the 17 fixed on 2026-08-01 no longer refuse a user delete', async () => {
  // Named individually rather than left to the baseline: each was a real
  // blocker, and a regression here is "this specific one reopened".
  const fixed = [
    'bespoke_monogram_generations.created_by',
    'budget_allocation_decisions.recorded_by',
    'budget_builds.created_by',
    'event_build_picks.picked_by',
    'event_category_build_state.set_by',
    'event_egift_methods.created_by_user_id',
    'event_manual_vendors.created_by_user_id',
    'event_moderators.invited_by_user_id',
    'event_sponsors.created_by_user_id',
    'guest_columns.reviewed_by_user_id',
    'guest_message_blocks.blocked_by',
    'photo_messages.reviewed_by_user_id',
    'scan_events.scanner_user_id',
    'slug_change_log.changed_by',
    'oauth_state.initiated_by',
    'live_studio_channel_oauth_state.initiated_by',
    'patiktok_oauth_state.initiated_by',
  ];
  const stillRefusing = new Set(await refusingFks());
  const regressed = fixed.filter((k) => stillRefusing.has(k));
  assert.deepEqual(
    regressed,
    [],
    `these were given a delete behaviour on 2026-08-01 and refuse again: ${regressed.join(', ')}. A later ADD CONSTRAINT without an ON DELETE clause silently restores NO ACTION.`,
  );
});

test('no FK refuses a user delete without a written reason', async () => {
  const refusing = await refusingFks();
  const baseline = readBaseline();
  const undeclared = refusing.filter((k) => !baseline.has(k));

  assert.deepEqual(
    undeclared,
    [],
    `${undeclared.length} foreign key(s) refuse to let a user be deleted and nobody said why:\n` +
      undeclared.map((k) => `  · ${k}`).join('\n') +
      `\n\nRefusing is a legitimate choice — a record that must outlive its author is a real thing.\n` +
      `Refusing BY DEFAULT, because no ON DELETE clause was written, is not. Either give it a\n` +
      `behaviour (SET NULL for an authorship stamp, CASCADE for state meaningless without the\n` +
      `user) or add a line to tests/db/user-delete-refusing-fks.baseline.txt saying what must\n` +
      `survive and why.`,
  );
});

test('every baseline line still names a refusing FK', async () => {
  const refusing = new Set(await refusingFks());
  const stale = [...readBaseline().keys()].filter((k) => !refusing.has(k));
  assert.deepEqual(stale, [], `baseline lines for FKs that no longer refuse: ${stale.join(', ')}. Delete them.`);
});

test('the 30 decided on 2026-08-02 carry the behaviour they were given', async () => {
  // Named individually, like the 17 above, so a regression reads as "THIS one
  // reopened" rather than "the count changed". The split is the interesting part:
  // an ACTOR stamp survives its author (SET NULL), a row whose SUBJECT is the
  // user does not (CASCADE). Two tables carry BOTH, deliberately.
  const expected: Record<string, 'n' | 'c'> = {
    // ── actor / authorship stamp → SET NULL ──────────────────────────────
    'concierge_abuse_flags.reviewed_by': 'n',
    'concierge_brain_chunks.last_verified_by_user_id': 'n',
    'concierge_plan_templates.admin_edited_by_user_id': 'n',
    'concierge_response_cache.admin_edited_by_user_id': 'n',
    'concierge_unanswered_questions.resolved_by_user_id': 'n',
    'discount_code_eligible_users.added_by_admin_id': 'n',
    'discount_codes.created_by_admin_id': 'n',
    'event_action_log.performed_by_user_id': 'n',
    'event_delegates.granted_by_user_id': 'n',
    'event_delegates.revoked_by_user_id': 'n',
    'event_inspiration_assets.added_by_user_id': 'n',
    'event_playlist_picks.created_by_user_id': 'n',
    'founder_seats.granted_by': 'n',
    'kwento_assignments.assigned_by_user_id': 'n',
    'manpower_gigs.posted_by_user_id': 'n',
    'moodboard_library_assets.uploaded_by': 'n',
    'order_ledger.actor_user_id': 'n',
    'owner_alerts.acknowledged_by': 'n',
    'patiktok_oauth_grants.granted_by': 'n',
    'patiktok_render_jobs.requested_by': 'n',
    'render_jobs.requested_by': 'n',
    'users.concierge_banned_by': 'n',
    'vendor_contracts.uploaded_by_user_id': 'n',
    // ── the user is the row's SUBJECT → CASCADE ──────────────────────────
    'concierge_abuse_flags.flagged_user_id': 'c',
    'discount_code_redemptions.couple_user_id': 'c',
    'event_delegates.delegate_user_id': 'c',
    'founder_time_log.user_id': 'c',
  };

  const { rows } = await db.query<{ k: string; d: string }>(`
    SELECT con.conrelid::regclass::text || '.' || a.attname AS k, con.confdeltype AS d
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid IN ('auth.users'::regclass, 'public.users'::regclass)
       AND array_length(con.conkey, 1) = 1
  `);
  const actual = new Map(rows.map((r) => [r.k, r.d]));

  const wrong = Object.entries(expected)
    .filter(([k, want]) => actual.get(k) !== want)
    .map(([k, want]) => `${k}: want ${want}, got ${actual.get(k) ?? 'MISSING'}`);
  assert.deepEqual(
    wrong,
    [],
    `these were decided on 2026-08-02 and no longer match:\n  ${wrong.join('\n  ')}\n\n` +
      `A later ADD CONSTRAINT without an ON DELETE clause silently restores NO ACTION.`,
  );
});

test('the 13 columns that traded NOT NULL for a nullable author are nullable', async () => {
  // SET NULL against a NOT NULL column does NOT fail when the migration runs. It
  // fails at DELETE time, turning a cleanly-refused delete into a runtime 500 —
  // strictly worse than the bug being fixed. So the nullability is asserted
  // SEPARATELY from the constraint action; passing one and failing the other is
  // exactly the shape of the trap.
  const columns = [
    ['discount_code_eligible_users', 'added_by_admin_id'],
    ['discount_codes', 'created_by_admin_id'],
    ['event_action_log', 'performed_by_user_id'],
    ['event_delegates', 'granted_by_user_id'],
    ['event_inspiration_assets', 'added_by_user_id'],
    ['event_playlist_picks', 'created_by_user_id'],
    ['kwento_assignments', 'assigned_by_user_id'],
    ['manpower_gigs', 'posted_by_user_id'],
    ['order_ledger', 'actor_user_id'],
    ['patiktok_oauth_grants', 'granted_by'],
    ['patiktok_render_jobs', 'requested_by'],
    ['render_jobs', 'requested_by'],
    ['vendor_contracts', 'uploaded_by_user_id'],
  ];
  const { rows } = await db.query<{ t: string; c: string; nn: boolean }>(`
    SELECT c.relname AS t, a.attname AS c, a.attnotnull AS nn
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
  `);
  const notNull = new Set(rows.filter((r) => r.nn).map((r) => `${r.t}.${r.c}`));
  const stillNotNull = columns.map(([t, c]) => `${t}.${c}`).filter((k) => notNull.has(k));
  assert.deepEqual(
    stillNotNull,
    [],
    `still NOT NULL while their FK says SET NULL — every delete touching these rows will 500:\n  ` +
      stillNotNull.join('\n  '),
  );
});

/**
 * ── THE TEST THAT WOULD HAVE CAUGHT THIS ORIGINALLY ────────────────────────
 *
 * Everything above inspects the CATALOG. A catalog assertion says the constraint
 * is spelled correctly; it does not say a delete works. The two came apart badly
 * here: after the first sweep every catalog assertion in this file passed and
 * admin "Delete user" was still broken for any account with activity, because
 * the query was scoped to the wrong parent table.
 *
 * So this one does the actual thing. Build a user with real dependents across
 * both sides of the split, DELETE them, and assert three properties:
 *   1. the delete SUCCEEDS (no FK refusal, no NOT NULL violation on a SET NULL);
 *   2. ACTOR rows SURVIVE with a null author — an event's playlist must not be
 *      emptied because a guest closed their account;
 *   3. SUBJECT rows are GONE — an abuse dossier about a person who exercised
 *      erasure must not outlive them.
 */
test('END-TO-END · a user with activity can actually be deleted', async () => {
  const leaver = '9a000000-0000-4000-8000-00000000fa01';
  const other = '9a000000-0000-4000-8000-00000000fa02';

  const mkUser = async (id: string, email: string) => {
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, email]);
    // A trigger may already have materialised the profile row; either path is fine.
    await db.query(
      `INSERT INTO public.users (user_id, email) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, email],
    );
  };
  await mkUser(leaver, 'leaver@fk-sweep.test');
  await mkUser(other, 'bystander@fk-sweep.test');

  // events.event_type defaults to 'wedding', and events_wedding_fields_consistency
  // then requires ceremony_type + venue_setting to be present.
  const { rows: ev } = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, ceremony_type, venue_setting)
     VALUES ('FK sweep fixture', 'civil', 'garden') RETURNING event_id`,
  );
  const eventId = ev[0]!.event_id;

  // Every fixture row is addressed by its own primary key from here on. Several
  // of these tables carry migration SEED DATA (moodboard_library_assets ships 92
  // rows), so a bare `count(*) FROM <table>` would measure the seed, not the
  // fixture, and pass or fail for reasons that have nothing to do with the FK.
  // ── ACTOR rows: must survive the delete, de-identified ────────────────────
  const { rows: mb } = await db.query<{ asset_id: string }>(
    `INSERT INTO public.moodboard_library_assets (asset_type, label, storage_path, uploaded_by)
     VALUES ('venue_scene', 'fk sweep', 'fk/sweep.jpg', $1) RETURNING asset_id`,
    [leaver],
  );
  const { rows: oa } = await db.query<{ alert_id: string }>(
    `INSERT INTO public.owner_alerts (alert_type, acknowledged_by)
     VALUES ('weekly_digest', $1) RETURNING alert_id`,
    [leaver],
  );
  // Was NOT NULL until this migration — the interesting half of the fixture.
  const { rows: dc } = await db.query<{ discount_code_id: string }>(
    `INSERT INTO public.discount_codes (code, discount_type, expires_at, created_by_admin_id)
     VALUES ('FKSWEEP1', 'free', now() + interval '30 days', $1)
     RETURNING discount_code_id`,
    [leaver],
  );
  const codeId = dc[0]!.discount_code_id;
  await db.query(
    `INSERT INTO public.discount_code_eligible_users (discount_code_id, user_id, added_by_admin_id)
     VALUES ($1, $2, $3)`,
    [codeId, other, leaver],
  );
  // An event's own content, authored by someone who then leaves. CASCADE here
  // would delete songs from somebody else's wedding.
  const { rows: pp } = await db.query<{ pick_id: string }>(
    `INSERT INTO public.event_playlist_picks (event_id, slot_type, song_label, created_by_user_id)
     VALUES ($1, 'first_dance', 'fk sweep song', $2) RETURNING pick_id`,
    [eventId, leaver],
  );
  // The only auth.users-parented row in the fixture — proves the widened scope
  // did not come at the cost of the half that already worked.
  const { rows: rj } = await db.query<{ job_id: string }>(
    `INSERT INTO public.render_jobs (event_id, sku, requested_by)
     VALUES ($1, 'FK_SWEEP', $2) RETURNING job_id`,
    [eventId, leaver],
  );
  // Same table, both verdicts: the reviewer is a stamp…
  const { rows: fl1 } = await db.query<{ flag_id: string }>(
    `INSERT INTO public.concierge_abuse_flags
       (flagged_user_id, matched_user_ids, similarity_score, signals, reviewed_by)
     VALUES ($1, ARRAY[$2::uuid], 0.91, '{}'::jsonb, $2) RETURNING flag_id`,
    [other, leaver],
  );
  // …and a delegation's granter is a stamp while its holder is the subject.
  await db.query(
    `INSERT INTO public.event_delegates (event_id, delegate_user_id, role, granted_by_user_id)
     VALUES ($1, $2, 'coordinator', $3)`,
    [eventId, other, leaver],
  );
  // Self-referential: a ban must not lift because the admin who issued it left.
  await db.query(`UPDATE public.users SET concierge_banned_by = $1 WHERE user_id = $2`, [
    leaver,
    other,
  ]);

  // ── SUBJECT rows: must disappear with the user ────────────────────────────
  const { rows: fl2 } = await db.query<{ flag_id: string }>(
    `INSERT INTO public.concierge_abuse_flags
       (flagged_user_id, matched_user_ids, similarity_score, signals, reviewed_by)
     VALUES ($1, ARRAY[$2::uuid], 0.77, '{}'::jsonb, $2) RETURNING flag_id`,
    [leaver, other],
  );
  await db.query(
    `INSERT INTO public.event_delegates (event_id, delegate_user_id, role, granted_by_user_id)
     VALUES ($1, $2, 'planner', $3)`,
    [eventId, leaver, other],
  );
  const { rows: ft } = await db.query<{ log_id: string }>(
    `INSERT INTO public.founder_time_log (user_id, week_starting, primary_function, primary_pct)
     VALUES ($1, DATE '2026-08-03', 'engineering', 100) RETURNING log_id`,
    [leaver],
  );

  // ── THE DELETE ────────────────────────────────────────────────────────────
  // Before this migration this line threw a foreign-key violation, which is the
  // entire bug. The assertion sits on the delete itself: the Postgres message
  // names the offending constraint, which is the fastest possible diagnosis.
  await assert.doesNotReject(
    () => db.query(`DELETE FROM auth.users WHERE id = $1`, [leaver]),
    'deleting a user with ordinary activity was refused — a foreign key regressed to NO ACTION/RESTRICT',
  );

  const one = async (sql: string, params: unknown[] = []) =>
    (await db.query<Record<string, unknown>>(sql, params)).rows[0];

  // 1 · The account itself is gone on both sides.
  assert.equal(
    (await one(`SELECT count(*)::int AS n FROM public.users WHERE user_id = $1`, [leaver]))!.n,
    0,
    'public.users row survived — the CASCADE from auth.users is not firing',
  );

  // 2 · ACTOR rows survived, de-identified.
  const survived: Array<[string, string, string, string]> = [
    ['moodboard_library_assets', 'uploaded_by', 'asset_id', mb[0]!.asset_id],
    ['owner_alerts', 'acknowledged_by', 'alert_id', oa[0]!.alert_id],
    ['discount_codes', 'created_by_admin_id', 'discount_code_id', codeId],
    ['discount_code_eligible_users', 'added_by_admin_id', 'discount_code_id', codeId],
    ['event_playlist_picks', 'created_by_user_id', 'pick_id', pp[0]!.pick_id],
    ['render_jobs', 'requested_by', 'job_id', rj[0]!.job_id],
    ['concierge_abuse_flags', 'reviewed_by', 'flag_id', fl1[0]!.flag_id],
  ];
  for (const [table, col, pk, value] of survived) {
    const row = await one(
      `SELECT count(*)::int AS total, count(${col})::int AS still_attributed
         FROM public.${table} WHERE ${pk} = $1`,
      [value],
    );
    assert.equal(row!.total, 1, `${table}: the row did not survive the delete — this is data loss`);
    assert.equal(
      row!.still_attributed,
      0,
      `${table}.${col}: the row survived but still points at the deleted user`,
    );
  }
  assert.equal(
    (await one(`SELECT concierge_banned_by FROM public.users WHERE user_id = $1`, [other]))!
      .concierge_banned_by,
    null,
    'users.concierge_banned_by: the self-referential stamp was not nulled',
  );
  assert.equal(
    (await one(
      `SELECT count(granted_by_user_id)::int AS n FROM public.event_delegates
        WHERE event_id = $1 AND delegate_user_id = $2`,
      [eventId, other],
    ))!.n,
    0,
    'event_delegates.granted_by_user_id: the surviving grant still names the deleted granter',
  );

  // 3 · SUBJECT rows are gone.
  const gone: Array<[string, string, string]> = [
    ['founder_time_log', 'log_id', ft[0]!.log_id],
    ['concierge_abuse_flags', 'flag_id', fl2[0]!.flag_id],
  ];
  for (const [table, pk, value] of gone) {
    assert.equal(
      (await one(`SELECT count(*)::int AS n FROM public.${table} WHERE ${pk} = $1`, [value]))!.n,
      0,
      `${table}: a row whose SUBJECT is the deleted user outlived them`,
    );
  }
  assert.equal(
    (await one(
      `SELECT count(*)::int AS n FROM public.event_delegates
        WHERE event_id = $1 AND delegate_user_id = $2`,
      [eventId, leaver],
    ))!.n,
    0,
    'event_delegates: the access grant TO the deleted user survived — a dangling delegation is a security bug, not untidiness',
  );
});
