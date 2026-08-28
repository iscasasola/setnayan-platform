/**
 * anon cannot sign itself up — end-to-end (test:db, every migration replayed).
 *
 * ── WHAT THIS LOCKS ─────────────────────────────────────────────────────────
 * Of 391 base tables in `public`, `anon` — the role behind the publishable key
 * that ships in every page's source — held INSERT on 197. Probed BY EXECUTION
 * against production (2026-08-28, one generated INSERT per table inside
 * BEGIN … ROLLBACK), 193 were refused by RLS and exactly FOUR were admitted:
 * every signup/contact form in the product.
 *
 * Three of the four had no anonymous caller at all — two are written by the
 * SERVICE ROLE, which bypasses RLS entirely, and one has no writer anywhere in
 * the codebase. Migration 20271178066835 closes those three.
 *
 * The fourth, `help_messages`, IS load-bearing: `app/help/actions.ts` posts the
 * public Help form through the VISITOR'S OWN SESSION, and a signed-out
 * visitor's session is `anon`. It is deliberately untouched.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A db test talking to Postgres as the table OWNER bypasses RLS and grants, so
 * every "denied" assertion would pass for the wrong reason. Four defences, in
 * the order they run:
 *
 *   1. META — the impersonated session is really `anon`: `current_user` is
 *      literally 'anon', the role cannot BYPASSRLS, and it does not own the
 *      tables. It runs FIRST so an owner-session regression fails loudly.
 *   2. POSITIVE CONTROL — the same anon session still inserts into
 *      `help_messages` AND the row is really there. Without this, "the three
 *      are closed" could mean the anon role lost everything.
 *   3. DIFFERENTIAL CONTROL — every statement asserted to fail as anon is re-run
 *      as `service_role` and asserted to SUCCEED, which is what makes a denial
 *      attributable to the POLICY rather than to a typo'd column, a missing
 *      table or a CHECK constraint.
 *   4. ANTI-VACUITY — the tables and the columns named here actually exist.
 *
 * 🪤 AND THE TRAP THIS AUDIT NEARLY FELL INTO, asserted rather than remembered:
 * a BEFORE INSERT trigger runs BEFORE the RLS WITH CHECK, so a non-42501 error
 * does NOT mean RLS admitted you. `vendor_services` first came back 23514 —
 * which reads as "passed RLS, failed on data" — purely because the publish-gate
 * trigger fired first. The last test here pins that reading: a DRAFT card,
 * which that trigger does not judge, is refused 42501.
 *
 * ⛔ `relrowsecurity` IS VACUOUS IN THIS REPLAY (a brand-new table reports row
 * security ON with no policy and no ALTER), so nothing here asserts that flag.
 * Every claim below is a statement that must succeed or must be refused.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** The three doors migration 20271178066835 closes. */
const CLOSED = [
  'couple_waitlist_signups',
  'couple_event_type_notify_signups',
  'couple_wedding_type_notify_signups',
] as const;

/** A valid INSERT per closed table — valid so that a refusal is attributable to
 *  the policy and never to the data. Emails are real-shaped: two of the three
 *  carry a format CHECK, and a probe that trips one proves nothing.
 *
 *  The address is parameterised because `couple_waitlist_signups` carries a
 *  UNIQUE on it: a second test reusing one address fails on the constraint and
 *  reads exactly like a refusal that never happened. */
const insertFor = (table: (typeof CLOSED)[number], tag: string): string => {
  const email = `probe-${tag}@example.invalid`;
  switch (table) {
    case 'couple_waitlist_signups':
      return `INSERT INTO public.couple_waitlist_signups (email) VALUES ('${email}')`;
    case 'couple_event_type_notify_signups':
      return `INSERT INTO public.couple_event_type_notify_signups (email, event_type) VALUES ('${email}', 'wedding')`;
    case 'couple_wedding_type_notify_signups':
      return `INSERT INTO public.couple_wedding_type_notify_signups (email, ceremony_type_interested) VALUES ('${email}', 'civil')`;
  }
};

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['anon']);
  await db.exec(`SET ROLE anon`);
}

async function asAuthenticated(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['authenticated']);
  await db.exec(`SET ROLE authenticated`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['service_role']);
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['']);
}

/** Run a statement; return its error message, or null when it succeeded. */
async function tryQuery(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 1 · META — the session really is anon ─────────────────────────────────

test('META: the impersonated session is really anon and cannot bypass RLS', async () => {
  await asAnon();
  const who = await db.query<{ u: string; bypass: boolean }>(
    `SELECT current_user AS u,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`,
  );
  assert.equal(who.rows[0]?.u, 'anon', 'the session must actually be anon');
  assert.equal(who.rows[0]?.bypass, false, 'anon must not bypass RLS');
  await reset();
});

test('ANTI-VACUITY: every table and column this file names exists', async () => {
  await reset();
  for (const t of [...CLOSED, 'help_messages']) {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = '${t}'`,
    );
    assert.equal(r.rows[0]?.n, 1, `${t} must exist — a probe on a missing table proves nothing`);
  }
  // The generated INSERTs must be runnable by SOMEBODY, or "refused as anon" is
  // meaningless. asService below proves it; this just fails earlier and clearer.
  await asService();
  for (const t of CLOSED) {
    assert.equal(await tryQuery(insertFor(t, 'vacuity')), null, `${t}: the probe statement itself must be valid`);
  }
  await reset();
});

// ── 2 · THE THREE DOORS ARE SHUT ──────────────────────────────────────────

test('anon cannot insert into any of the three closed signup tables', async () => {
  await asAnon();
  for (const t of CLOSED) {
    const err = await tryQuery(insertFor(t, 'anon'));
    assert.ok(err, `${t}: anon must be refused`);
    assert.match(
      err,
      /row-level security|permission denied/i,
      `${t}: the refusal must come from RLS or the grant, not from the data — got: ${err}`,
    );
  }
  await reset();
});

test('DIFFERENTIAL CONTROL: the service role still writes all three', async () => {
  // This is what makes the refusals above attributable to the policy. Both
  // notify tables are written by server actions through the service role today;
  // if this test ever fails, the migration broke a live writer.
  await asService();
  for (const t of CLOSED) {
    assert.equal(await tryQuery(insertFor(t, 'service')), null, `${t}: service_role must still insert`);
  }
  await reset();
});

test('DIFFERENTIAL CONTROL: a SIGNED-IN caller can still sign up', async () => {
  // 🪤 THIS TEST EXISTS BECAUSE MUTATION TESTING FOUND ITS ABSENCE. Deleting the
  // replacement policy outright — closing the door on `authenticated` as well as
  // `anon` — passed every other assertion in this file AND the migration's own
  // P4 post-condition, because P4 asks `has_table_privilege(...)`. A GRANT IS
  // NOT A POLICY: `authenticated` keeps the privilege and RLS still refuses it
  // when no policy admits it. Only an actual INSERT can tell the two apart.
  await asAuthenticated();
  for (const t of CLOSED) {
    assert.equal(
      await tryQuery(insertFor(t, 'authed')),
      null,
      `${t}: a signed-in caller must still be able to insert — the narrowing must remove the ANONYMOUS arm only`,
    );
  }
  await reset();
});

test('anon holds no privilege at all on the three', async () => {
  await reset();
  for (const t of CLOSED) {
    for (const v of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege('anon', 'public.${t}', '${v}') AS ok`,
      );
      assert.equal(r.rows[0]?.ok, false, `anon must not hold ${v} on ${t}`);
    }
  }
});

test('no surviving policy on the three names anon or PUBLIC', async () => {
  // The grant is one layer; a policy still naming anon means the NEXT grant
  // re-opens the door with nothing to notice it.
  await reset();
  const r = await db.query<{ tablename: string; policyname: string }>(
    `SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY (ARRAY['${CLOSED.join("','")}'])
        AND ('anon' = ANY (roles) OR 'public' = ANY (roles))`,
  );
  assert.deepEqual(
    r.rows,
    [],
    `a policy still admits anon: ${r.rows.map((x) => `${x.tablename}:${x.policyname}`).join(', ')}`,
  );
});

// ── 3 · POSITIVE CONTROL — the door that must stay open ───────────────────

test('POSITIVE CONTROL: a signed-out visitor can still send a Help message', async () => {
  // /help posts through the visitor's OWN session. If this ever fails, the
  // public contact form is broken and the only symptom is a form that does
  // nothing.
  await asAnon();
  assert.equal(
    await tryQuery(
      `INSERT INTO public.help_messages (sender_email, subject, body)
       VALUES ('stranger@example.invalid', 'probe', 'probe')`,
    ),
    null,
    'anon must still be able to write help_messages',
  );
  await reset();
  const seen = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.help_messages WHERE sender_email = 'stranger@example.invalid'`,
  );
  assert.equal(seen.rows[0]?.n, 1, 'the row must really be there — "no error" is not "it worked"');
});

test('help_messages keeps its anon INSERT grant and its anon policy', async () => {
  await reset();
  const g = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('anon', 'public.help_messages', 'INSERT') AS ok`,
  );
  assert.equal(g.rows[0]?.ok, true, 'anon must keep INSERT on help_messages');
  const p = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'help_messages'
        AND policyname = 'help_messages_anyone_insert' AND 'anon' = ANY (roles)`,
  );
  assert.equal(p.rows[0]?.n, 1, 'the public Help form policy must still admit anon');
});

// ── 4 · THE TRAP — a trigger is not a policy ──────────────────────────────

test('a BEFORE trigger firing first does not mean RLS admitted anon', async () => {
  // `vendor_services` came back 23514 in the sweep, which reads as "the row
  // passed RLS and failed on its data". It did not: the publish-gate trigger
  // (20271176775619) raised before the RLS WITH CHECK was ever evaluated. A
  // DRAFT card is not judged by that trigger, so only RLS can answer it.
  await asAnon();
  const err = await tryQuery(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, is_active)
     VALUES (gen_random_uuid(), 'photographer', false)`,
  );
  assert.ok(err, 'anon must not be able to create a service card');
  assert.match(
    err,
    /row-level security|permission denied/i,
    `the refusal must be RLS, not a trigger — got: ${err}`,
  );
  await reset();
});
