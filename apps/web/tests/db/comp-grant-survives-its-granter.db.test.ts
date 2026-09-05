/**
 * A COMP GRANT MUST OUTLIVE THE ADMIN WHO ISSUED IT.
 *
 * 🚨 WHAT WENT WRONG. `comp_grants.granted_by` referenced `public.users` with
 * ON DELETE CASCADE, so deleting the admin who issued a comp deleted the grant
 * row itself — retail value, rationale, approver, the entire money record of
 * what this company gave away. A staff departure erased the receipts.
 *
 * 🔑 THE ADJACENT COLUMN IS THE PROOF IT WAS A TYPO. `granted_by` and
 * `approved_by` are created in ONE statement, on consecutive lines, in
 * migration 20260515030000 — same table, same parent, opposite ON DELETE
 * actions. Nobody decides that the issuer's departure erases the record while
 * the approver's merely blanks a field.
 *
 * 🔑 THE RULE WAS ALREADY WRITTEN DOWN, AND ALREADY TESTED — JUST NOT HERE.
 * `erasure-completeness.db.test.ts` calls this "the over-deletion trap" and
 * states it outright: *delegate_user_id is CASCADE + NOT NULL (the row is ABOUT
 * them), granted_by/revoked_by are SET NULL (an actor stamp).* Every other actor
 * stamp in the schema obeys it. `comp_grants.granted_by` was the last one that
 * did not — missed rather than excused: the two sweeps that fixed the rest
 * (20271030238978, 20271032282809) converted NO ACTION to SET NULL and never
 * looked at CASCADE columns, so this one was never in their window.
 *
 * ⚠ WHAT THIS TEST CANNOT SEE, AND YOU MUST NOT ASSUME IT DOES. Measured
 * against production 2026-09-06: `comp_grants.granted_by`, `.user_id` and
 * `.rationale` are NOT NULL there, and NO migration in this repo sets them so —
 * the replay this test runs against produces all three nullable. Production and
 * the migration set genuinely disagree. That matters because `ON DELETE SET
 * NULL` on a NOT NULL column does not null anything: it makes the parent DELETE
 * fail with 23502. So the migration's `ALTER COLUMN granted_by DROP NOT NULL`
 * is the half of the fix this suite is STRUCTURALLY BLIND TO — here the column
 * is already nullable, so the line is a no-op and removing it would leave every
 * assertion below green. `test('the column stays nullable')` is the closest
 * this replay can get; the real check was a production pg_attribute query.
 *
 * Run: cd apps/web && npx tsx --test tests/db/comp-grant-survives-its-granter.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let seq = 0;
async function newUser(label: string): Promise<string> {
  seq += 1;
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`granter-${label}-${seq}@test.local`],
  );
  const id = r.rows[0]!.id;
  // comp_grants points at public.users, which the on_auth_user_created trigger
  // mirrors. If that ever stops firing, every assertion here would fail on the
  // INSERT instead of silently passing, so this is checked rather than assumed.
  const mirrored = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.users WHERE user_id = $1`,
    [id],
  );
  assert.equal(mirrored.rows[0]!.n, 1, `FIXTURE: public.users row missing for ${label}`);
  return id;
}

async function issueComp(opts: {
  subject: string;
  granter: string;
  approver?: string | null;
}): Promise<string> {
  const r = await db.query<{ grant_id: string }>(
    `INSERT INTO public.comp_grants
       (source, user_id, scope, rationale, retail_value_centavos, granted_by, approved_by)
     VALUES ('external_promo', $1, 'all_services', $2, 499900, $3, $4)
     RETURNING grant_id`,
    [opts.subject, 'Goodwill after the venue cancelled on them.', opts.granter, opts.approver ?? null],
  );
  return r.rows[0]!.grant_id;
}

const readGrant = async (grantId: string) =>
  (
    await db.query<{
      grant_id: string;
      granted_by: string | null;
      approved_by: string | null;
      retail_value_centavos: number | null;
      rationale: string | null;
      user_id: string | null;
    }>(
      `SELECT grant_id, granted_by, approved_by, retail_value_centavos, rationale, user_id
         FROM public.comp_grants WHERE grant_id = $1`,
      [grantId],
    )
  ).rows[0] ?? null;

// ══ THE HEADLINE ═══════════════════════════════════════════════════════════

test('🚨 deleting the issuing admin keeps the grant, its value and its rationale', async () => {
  const subject = await newUser('subject');
  const admin = await newUser('admin');
  const grantId = await issueComp({ subject, granter: admin });

  const before_ = await readGrant(grantId);
  assert.equal(before_?.granted_by, admin, 'PRECONDITION: the grant records its issuer');
  assert.equal(before_?.retail_value_centavos, 499900, 'PRECONDITION: the money is on the row');

  // The whole defect, in one statement.
  await db.query(`DELETE FROM public.users WHERE user_id = $1`, [admin]);

  const after_ = await readGrant(grantId);
  assert.ok(after_, 'THE DEFECT: the admin left and took the money record with them');
  assert.equal(
    after_!.retail_value_centavos,
    499900,
    'the grant survived but lost what it was worth',
  );
  assert.equal(
    after_!.rationale,
    'Goodwill after the venue cancelled on them.',
    'the grant survived but lost why it was given',
  );
  assert.equal(after_!.user_id, subject, 'the grant survived but forgot who it was for');
  assert.equal(after_!.granted_by, null, 'the actor stamp must be CLEARED, not kept');
});

test('the delete SUCCEEDS — a NOT NULL granted_by would block it, not null it', async () => {
  const subject = await newUser('subject-b');
  const admin = await newUser('admin-b');
  await issueComp({ subject, granter: admin });

  // If granted_by were NOT NULL (as production has it), this DELETE raises
  // 23502 and the admin account becomes undeletable. Asserting the delete
  // completes is the only way this replay can speak to that at all.
  await db.query(`DELETE FROM public.users WHERE user_id = $1`, [admin]);

  const gone = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.users WHERE user_id = $1`,
    [admin],
  );
  assert.equal(gone.rows[0]!.n, 0, 'the admin account could not actually be deleted');
});

test('the column stays nullable — re-adding NOT NULL would silently break SET NULL', async () => {
  const r = await db.query<{ attnotnull: boolean }>(
    `SELECT a.attnotnull
       FROM pg_attribute a
      WHERE a.attrelid = 'public.comp_grants'::regclass
        AND a.attname = 'granted_by' AND a.attnum > 0 AND NOT a.attisdropped`,
  );
  assert.equal(r.rows.length, 1, 'granted_by is missing from comp_grants');
  assert.equal(
    r.rows[0]!.attnotnull,
    false,
    'granted_by is NOT NULL again: ON DELETE SET NULL now BLOCKS deleting an admin ' +
      'instead of clearing the stamp. Drop the NOT NULL or change the FK action.',
  );
});

// ══ WHAT MUST NOT CHANGE ═══════════════════════════════════════════════════

test('the customer’s own deletion still removes their grant (user_id stays CASCADE)', async () => {
  const subject = await newUser('subject-c');
  const admin = await newUser('admin-c');
  const grantId = await issueComp({ subject, granter: admin });

  await db.query(`DELETE FROM public.users WHERE user_id = $1`, [subject]);

  assert.equal(
    await readGrant(grantId),
    null,
    'a comp is the SUBJECT’s personal data — deleting them must take it, per RA 10173',
  );
});

test('approved_by keeps the behaviour it always had', async () => {
  const subject = await newUser('subject-d');
  const admin = await newUser('admin-d');
  const approver = await newUser('approver-d');
  const grantId = await issueComp({ subject, granter: admin, approver });

  await db.query(`DELETE FROM public.users WHERE user_id = $1`, [approver]);

  const row = await readGrant(grantId);
  assert.ok(row, 'the approver’s deletion must not remove the grant');
  assert.equal(row!.approved_by, null, 'the approver stamp should clear');
  assert.equal(row!.granted_by, admin, 'and must not disturb the issuer stamp');
});

// ══ THE RULE, NOT JUST THIS COLUMN ═════════════════════════════════════════

test('every ON DELETE action on comp_grants is the one we intend', async () => {
  const r = await db.query<{ col: string; d: string }>(
    `SELECT a.attname AS col, con.confdeltype AS d
       FROM pg_constraint con
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.conrelid = 'public.comp_grants'::regclass
        AND array_length(con.conkey, 1) = 1
      ORDER BY 1`,
  );
  const byCol = Object.fromEntries(r.rows.map((x) => [x.col, x.d]));

  // 'c' = CASCADE, 'n' = SET NULL. Spelled out so a future reader does not have
  // to remember which letter is which to know what this asserts.
  assert.equal(byCol.granted_by, 'n', 'granted_by must be SET NULL — an actor stamp');
  assert.equal(byCol.approved_by, 'n', 'approved_by must stay SET NULL — an actor stamp');
  assert.equal(byCol.user_id, 'c', 'user_id must stay CASCADE — the row is ABOUT them');
});

/**
 * Columns that LOOK like actor stamps by name, are still CASCADE, and have NOT
 * been through the actor-vs-subject argument. They are listed so the ratchet
 * below can go red on a SEVENTH without going red on these six today.
 *
 * 🛑 THIS IS A BACKLOG, NOT AN APPROVAL. Every one is `CASCADE + NOT NULL`, the
 * same shape `comp_grants.granted_by` had, so each is a candidate for the same
 * defect — deleting the actor destroys somebody else's row. Each also needs its
 * own answer, because a name is not an argument: `initiated_by` on an OAuth
 * state row genuinely IS the SUBJECT of that row (delete the initiator, delete
 * their pending handshake), exactly as `event_delegates.delegate_user_id` is.
 * Settling them was out of scope for the comp_grants fix and is deliberately
 * not guessed at here.
 *
 * 🔑 THE LIST IS TEN, AND THE FIRST DRAFT OF IT WAS SIX. A survey named the six
 * `%granted_by%`-ish ones and missed every `*oauth_state.initiated_by`; the
 * shape-based query below found them. Do not hand-maintain this from a report —
 * re-measure it:
 *   grep -E '^[a-z_]+\.[a-z_]*(_by|_by_user_id)  ' \
 *     apps/web/tests/db/user-fk-behaviour.generated.txt | grep CASCADE
 *
 * To retire a line: make the actor-vs-subject argument, then either convert it
 * (DROP NOT NULL + SET NULL, as the comp_grants migration does) or record why
 * CASCADE is right. Never add a line to keep this test green.
 */
const UNREVIEWED_CASCADING_ACTOR_STAMPS = [
  // ── almost certainly CORRECT, but nobody has written it down ──────────────
  // A pending OAuth handshake IS the initiator's own row: nothing survives them
  // that anyone else can use, and a dangling state row would be a liability
  // rather than a record. Listed for completeness, not as suspects.
  'live_studio_channel_oauth_state.initiated_by',
  'oauth_state.initiated_by',
  'patiktok_oauth_state.initiated_by',
  'vendor_ig_oauth_state.initiated_by',

  // ── genuine candidates for the comp_grants defect ─────────────────────────
  // Each records that somebody ACTED on a row other people also rely on: an
  // approval request, a consent, an encoder claim, a motion, an invite, a lock
  // proposal. If deleting the actor deletes the row, a third party loses
  // something that was never theirs to lose — the over-deletion trap exactly.
  'admin_approval_requests.initiated_by',
  'coordinator_access_consents.consented_by_user_id',
  'live_studio_encoder_claims.requested_by',
  'vendor_admin_motions.proposed_by',
  'vendor_invites.invited_by_user_id',
  'vendor_lock_proposals.proposed_by_user_id',
];

/** Every single-column FK onto a users table whose column name reads as "who acted". */
const ACTOR_STAMP_PREDICATE = `
  con.contype = 'f'
  AND con.confrelid IN ('auth.users'::regclass, 'public.users'::regclass)
  AND array_length(con.conkey, 1) = 1
  AND (a.attname LIKE '%\\_by' OR a.attname LIKE '%\\_by\\_user\\_id')`;

test('no NEW actor stamp may CASCADE — the known ones are pinned, not blessed', async () => {
  // ⚠ THIS GUARD WAS WRONG WHEN FIRST WRITTEN, AND THE BUG IS WORTH KEEPING IN
  // MIND. It matched only '%granted_by%', '%approved_by%', '%revoked_by%' and
  // '%created_by%' while calling itself "no actor-stamp column ANYWHERE" — so
  // it passed green over six CASCADE columns named initiated_by, requested_by,
  // proposed_by, invited_by_user_id and consented_by_user_id, none of which its
  // patterns could match. A guard whose NAME is broader than its QUERY is a
  // false green: it reports on a population it never looked at. The predicate
  // now matches the shape ("…_by" / "…_by_user_id") rather than a hand-listed
  // set of verbs, and the known offenders are pinned by name below.
  const r = await db.query<{ tbl: string; col: string }>(
    `SELECT con.conrelid::regclass::text AS tbl, a.attname AS col
       FROM pg_constraint con
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE ${ACTOR_STAMP_PREDICATE}
        AND con.confdeltype = 'c'
      ORDER BY 1, 2`,
  );
  const cascading = r.rows.map((x) => `${x.tbl}.${x.col}`);

  const unexpected = cascading.filter((c) => !UNREVIEWED_CASCADING_ACTOR_STAMPS.includes(c));
  assert.deepEqual(
    unexpected,
    [],
    'a NEW actor stamp CASCADEs, so deleting the actor destroys somebody else’s record. ' +
      'Make the actor-vs-subject argument (see erasure-completeness.db.test.ts) and either ' +
      'convert it to SET NULL or say why CASCADE is right — do not add it to the pinned list.',
  );

  // The ratchet only tightens. A pinned line that no longer cascades has been
  // fixed and must be deleted, so the list can never quietly outlive its truth.
  const stale = UNREVIEWED_CASCADING_ACTOR_STAMPS.filter((c) => !cascading.includes(c));
  assert.deepEqual(
    stale,
    [],
    'these are pinned as still-CASCADE but no longer are — delete them from ' +
      'UNREVIEWED_CASCADING_ACTOR_STAMPS rather than leaving a stale exemption',
  );

  // And the column this PR exists for must not be among them.
  assert.ok(
    !cascading.includes('comp_grants.granted_by'),
    'comp_grants.granted_by is CASCADE again — the fix was reverted',
  );
});

test('META · the roll-call is not vacuous — actor stamps really are being examined', async () => {
  // The guard above passes trivially if the LIKE patterns match nothing at all
  // (a rename, a typo'd escape). Prove the population is real and populated.
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM pg_constraint con
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE ${ACTOR_STAMP_PREDICATE}`,
  );
  assert.ok(
    r.rows[0]!.n >= 40,
    `only ${r.rows[0]!.n} actor stamps found — the pattern stopped matching, so the ` +
      'CASCADE roll-call above is passing over an empty set',
  );
});
