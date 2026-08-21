/**
 * ONE LINK LOADS THEIR CALENDAR — the rules the DATABASE has to hold.
 *
 * The subscription link is served to an UNAUTHENTICATED calendar client, so the
 * token in the URL is the whole credential. That puts three obligations on the
 * schema, and each is tested here because each fails SILENTLY in the app:
 *
 *   · exactly ONE live link per person — two working links means the "reset"
 *     somebody just pressed did nothing while reporting success;
 *   · a revoked link can never be brought back to life;
 *   · one person can never read, mint or revoke another person's link.
 *
 * 🔑 EVERY TEST ASSERTS THE OUTCOME, NEVER A THROW. Under RLS a refused write
 * is filtered to ZERO ROWS and resolves happily, so `assert.rejects` reports a
 * missing rejection while the data is perfectly safe. Asserting the value that
 * ended up in the table survives whichever mechanism did the refusing.
 *
 * 🪤 AND EVERY RLS ASSERTION RUNS UNDER `SET ROLE authenticated`. THE REPLAY
 * CONNECTS AS SUPERUSER, WHICH BYPASSES ROW LEVEL SECURITY ENTIRELY — a policy
 * test written without the role switch passes no matter what the policies say,
 * including when there are none. It is the same family as the 2026-08-12
 * finding that a forgery test ran with no `auth.uid()` and went green because
 * RLS refused an anonymous caller, for the wrong reason. `asUser()` below is
 * the only way these tests touch the table.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/**
 * Do this work as a real signed-in person, with RLS actually switched on.
 * Superuser is restored afterwards so the next fixture insert can still seed.
 */
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
  }
}

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

/** 43 URL-safe characters, like the real `randomBytes(32).toString('base64url')`. */
function tok(seed: string): string {
  return (seed + 'x'.repeat(43)).slice(0, 43);
}

test('a person gets exactly one live link, and a second is refused', async () => {
  const me = await newUser('cal-one@example.com');

  await asUser(me, () =>
    db.query(
      `INSERT INTO public.calendar_feed_tokens (user_id, token) VALUES ($1,$2)`,
      [me, tok('a')],
    ),
  );

  // 🔑 THE PARTIAL UNIQUE INDEX IS THE CONTROL, not the action that happens to
  // be written today. Without it a double-click leaves two working links and
  // the person's reset is a no-op that looks like a success.
  let refused = false;
  try {
    await asUser(me, () =>
      db.query(
        `INSERT INTO public.calendar_feed_tokens (user_id, token) VALUES ($1,$2)`,
        [me, tok('b')],
      ),
    );
  } catch {
    refused = true;
  }
  assert.equal(refused, true, 'a second LIVE link was accepted');

  const live = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.calendar_feed_tokens
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [me],
  );
  assert.equal(live.rows[0]!.n, '1');
});

test('revoking frees the slot, and the old row stays', async () => {
  const me = await newUser('cal-rotate@example.com');
  await asUser(me, async () => {
    await db.query(
      `INSERT INTO public.calendar_feed_tokens (user_id, token) VALUES ($1,$2)`,
      [me, tok('c')],
    );
    await db.query(
      `UPDATE public.calendar_feed_tokens SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [me],
    );
    await db.query(
      `INSERT INTO public.calendar_feed_tokens (user_id, token) VALUES ($1,$2)`,
      [me, tok('d')],
    );
  });

  const rows = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.calendar_feed_tokens WHERE user_id = $1`,
    [me],
  );
  // 🔑 THE OLD ROW IS KEPT ON PURPOSE. A leaked link must keep resolving to a
  // refusal; deleting it would let the same string be minted again, and would
  // erase the only record that a reset ever happened.
  assert.equal(rows.rows[0]!.n, '2', 'the revoked row was destroyed');
});

test('a revoked link can never be brought back to life', async () => {
  const me = await newUser('cal-revive@example.com');
  await asUser(me, () =>
    db.query(
      `INSERT INTO public.calendar_feed_tokens (user_id, token, revoked_at)
       VALUES ($1,$2,NOW())`,
      [me, tok('e')],
    ),
  ).catch(() => {
    /* The INSERT policy requires revoked_at IS NULL, so seeding a
       already-revoked row through the person's own session is itself refused —
       which is correct. Seed it as superuser instead; the forgery below is what
       this test is about. */
    return db.query(
      `INSERT INTO public.calendar_feed_tokens (user_id, token, revoked_at)
       VALUES ($1,$2,NOW())`,
      [me, tok('e')],
    );
  });

  // The forgery: un-revoke my own row. It is MY row, so a permissive `FOR ALL`
  // policy would wave this straight through — which is the eight-defect shape
  // the 2026-08-12 sweep found. The UPDATE policy constrains the row that may
  // come OUT, so this changes nothing.
  await asUser(me, () =>
    db.query(
      `UPDATE public.calendar_feed_tokens SET revoked_at = NULL WHERE user_id = $1`,
      [me],
    ),
  ).catch(() => {});

  const after = await db.query<{ revoked: string | null }>(
    `SELECT revoked_at::text AS revoked FROM public.calendar_feed_tokens WHERE user_id = $1`,
    [me],
  );
  assert.notEqual(
    after.rows[0]!.revoked,
    null,
    'A LEAKED LINK CAME BACK TO LIFE — the reset button is now decoration.',
  );
});

test('one person cannot read, mint or revoke another person’s link', async () => {
  const owner = await newUser('cal-owner@example.com');
  const stranger = await newUser('cal-stranger@example.com');

  await asUser(owner, () =>
    db.query(
      `INSERT INTO public.calendar_feed_tokens (user_id, token) VALUES ($1,$2)`,
      [owner, tok('f')],
    ),
  );

  const seen = await asUser(stranger, async () => {
    // READ — the token is the credential, so this is the one that matters most.
    const r = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public.calendar_feed_tokens WHERE user_id = $1`,
      [owner],
    );
    // MINT one in their name.
    await db
      .query(
        `INSERT INTO public.calendar_feed_tokens (user_id, token) VALUES ($1,$2)`,
        [owner, tok('g')],
      )
      .catch(() => {
        /* refused loudly is fine too — the assertions decide */
      });
    // REVOKE theirs — a denial of service on somebody else's calendar.
    await db
      .query(
        `UPDATE public.calendar_feed_tokens SET revoked_at = NOW() WHERE user_id = $1`,
        [owner],
      )
      .catch(() => {});
    return r;
  });
  assert.equal(seen.rows[0]!.n, '0', 'a stranger read somebody else’s link');

  const mine = await db.query<{ n: string; revoked: string | null }>(
    `SELECT count(*)::text AS n, min(revoked_at)::text AS revoked
       FROM public.calendar_feed_tokens WHERE user_id = $1`,
    [owner],
  );
  assert.equal(mine.rows[0]!.n, '1', 'a stranger minted a link in somebody else’s name');
  assert.equal(
    mine.rows[0]!.revoked,
    null,
    'a stranger switched off somebody else’s calendar',
  );
});

test('the token column refuses a short, guessable value', async () => {
  const me = await newUser('cal-short@example.com');
  let refused = false;
  try {
    await asUser(me, () =>
      db.query(
        `INSERT INTO public.calendar_feed_tokens (user_id, token) VALUES ($1,$2)`,
        [me, 'abc123'],
      ),
    );
  } catch {
    refused = true;
  }
  assert.equal(refused, true, 'a 6-character token was accepted as a credential');
});
