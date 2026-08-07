/**
 * The couple↔vendor call channel refuses strangers — proven, not assumed.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * `lib/call-webrtc.ts` opens `call:{threadId}` as a PRIVATE Supabase Realtime
 * channel. Supabase evaluates RLS on `realtime.messages` for private channels
 * only, and migration 20271118012278 supplies that RLS via
 * `public.call_rtc_can_access(topic)`.
 *
 * ── WHY A TEST AND NOT JUST THE MIGRATION ──────────────────────────────────
 * This channel was PUBLIC from 2026-07-10 to 2026-08-06 — anyone who learned a
 * thread id could subscribe to that conversation's call setup. The identical
 * hole was found and fixed on the Live Studio transport on 2026-07-21 and never
 * back-ported here: five near-identical WebRTC transports, and the security edit
 * reached two of them. Nothing failed, because nothing tested the OTHER three.
 *
 * So this asserts the predicate REFUSES. A security control that has never been
 * observed saying no is indistinguishable from one that always says yes — the
 * exact failure `lib/guards-can-actually-fire.test.ts` exists for, one layer
 * down.
 *
 * ⚠ WHAT THIS CANNOT COVER. PGlite has no `realtime` schema, so the POLICIES
 * are skipped at replay (the migration's `DO $guard$` block returns early) and
 * cannot be exercised here. What IS exercised is the predicate every policy
 * calls — the part that decides. The policy wiring itself is verified by reading
 * it against the panood pair it was copied from, and by the fact that a wrong
 * answer here would deny every call loudly rather than leak quietly.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close?.();
});

/** Evaluate the predicate with no authenticated session (auth.uid() IS NULL). */
async function canAccess(topic: string | null): Promise<boolean | null> {
  const sql =
    topic === null
      ? 'SELECT public.call_rtc_can_access(NULL) AS ok'
      : 'SELECT public.call_rtc_can_access($1) AS ok';
  const res = await (topic === null
    ? replay.db.query<{ ok: boolean | null }>(sql)
    : replay.db.query<{ ok: boolean | null }>(sql, [topic]));
  return res.rows[0]?.ok ?? null;
}

test('the predicate exists and is SECURITY INVOKER, not DEFINER', async () => {
  const res = await replay.db.query<{ prosecdef: boolean; provolatile: string }>(
    `SELECT p.prosecdef, p.provolatile
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'call_rtc_can_access'`,
  );
  assert.equal(res.rows.length, 1, 'call_rtc_can_access must exist');
  assert.equal(
    res.rows[0]!.prosecdef,
    false,
    'MUST be SECURITY INVOKER. Definer would bypass chat_threads RLS and hand the ' +
      'call to anyone who can name a thread id — the opposite of the fix.',
  );
  assert.equal(res.rows[0]!.provolatile, 's', 'STABLE, so it is usable in a policy');
});

test('it refuses anon, foreign topics and malformed ids — and never throws', async () => {
  // No auth.uid() in the replay harness: every one of these must be a hard no.
  assert.equal(await canAccess(null), false, 'NULL topic');
  assert.equal(await canAccess(''), false, 'empty topic');
  assert.equal(await canAccess('panood-rtc:00000000-0000-0000-0000-000000000000'), false,
    'another transport’s topic must not be authorised by this predicate');
  assert.equal(await canAccess('mesh:00000000-0000-0000-0000-000000000000'), false,
    'the mesh prototype topic is not covered by this policy');
  assert.equal(await canAccess('call:not-a-uuid'), false,
    'a malformed id must return FALSE, never raise — an exception inside an RLS ' +
      'predicate surfaces as an error to the user, not as a denial');
  assert.equal(await canAccess('call:'), false, 'empty id');
  assert.equal(
    await canAccess('call:00000000-0000-0000-0000-000000000000'),
    false,
    'a well-formed id for a thread the caller cannot read must still be FALSE',
  );
});

test('the topic prefix is anchored — a lookalike cannot slip through', async () => {
  // Guards against `LIKE '%call:%'`-style sloppiness in any future edit.
  assert.equal(await canAccess('xcall:00000000-0000-0000-0000-000000000000'), false);
  assert.equal(await canAccess('recall:00000000-0000-0000-0000-000000000000'), false);
  assert.equal(await canAccess('CALL:00000000-0000-0000-0000-000000000000'), false,
    'topic matching is case-sensitive; an uppercase variant is not our topic');
});

test('the migration wires BOTH policies, or the flag alone takes calls down', async () => {
  // The policies cannot be created under PGlite (no realtime schema), so assert
  // on the migration TEXT: both a SELECT and an INSERT policy must exist, and
  // both must call the predicate. One without the other is a silent half-fix.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { MIGRATIONS_DIR } = await import('./replay-migrations');
  const file = fs
    .readdirSync(MIGRATIONS_DIR)
    .find((f) => f.includes('call_rtc_channel_authorization'));
  assert.ok(file, 'the call-rtc authorization migration must exist');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file!), 'utf8');

  assert.match(sql, /CREATE POLICY call_rtc_participants_can_read/, 'read policy');
  assert.match(sql, /CREATE POLICY call_rtc_participants_can_write/, 'write policy');
  assert.equal(
    (sql.match(/public\.call_rtc_can_access\(realtime\.topic\(\)\)/g) ?? []).length,
    2,
    'BOTH policies must gate on the predicate — a policy that omits it is open',
  );
  assert.match(sql, /FOR SELECT/, 'reads gated');
  assert.match(sql, /FOR INSERT/, 'writes gated');
});

test('the client opens the channel PRIVATE — the half that arms the policies', async () => {
  // RLS on realtime.messages applies to private channels ONLY. Without this
  // flag the policies above are inert and the channel is world-readable, which
  // is precisely the state this codebase shipped in for four weeks.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const src = fs.readFileSync(path.resolve(here, '../../lib/call-webrtc.ts'), 'utf8');
  assert.match(
    src,
    /supabase\.channel\(`call:\$\{room\}`[\s\S]{0,220}?private:\s*true/,
    'call-webrtc.ts must open `call:{room}` with private: true',
  );
});

test('the topic the CLIENT builds is the topic the PREDICATE parses', async () => {
  // 🔴 THE NEAR-MISS THIS EXISTS FOR.
  // `joinCall` builds the channel as `call:${room}`. The room component passed
  // `call:${threadId}`, so the live topic was `call:call:{threadId}` —
  // double-prefixed. On a PUBLIC channel that is invisible: any topic string is
  // accepted and both parties build the same wrong one. On a PRIVATE channel it
  // is total: the predicate reads the id after `call:`, gets `call:{uuid}`,
  // fails the cast, and denies EVERY call.
  //
  // Two files, each correct about itself, wrong about each other — the same
  // shape as the nav overlap and the tag cap. This asserts they agree.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const web = path.resolve(here, '../..');

  const transport = fs.readFileSync(path.join(web, 'lib/call-webrtc.ts'), 'utf8');
  assert.match(
    transport,
    /supabase\.channel\(`call:\$\{room\}`/,
    'the transport must own the `call:` prefix',
  );

  const room = fs.readFileSync(
    path.join(web, 'app/_components/thread-call-room.tsx'),
    'utf8',
  );
  // Line-based, not a fixed-width window: a comment between `joinCall({` and
  // `room:` is exactly what broke the first cut of this assertion, and a magic
  // character budget would break again the next time someone explains something.
  const lines = room.split('\n');
  const start = lines.findIndex((l) => l.includes('joinCall({'));
  assert.ok(start >= 0, 'could not find the joinCall( call site');
  const roomLine = lines
    .slice(start, start + 40)
    .find((l) => /^\s*room:\s*\S/.test(l));
  assert.ok(roomLine, 'could not find what the room passes as `room`');
  const passedValue = roomLine!.replace(/^\s*room:\s*/, '').replace(/,\s*$/, '');
  assert.equal(
    passedValue.trim(),
    'threadId',
    'The room must pass the BARE thread id. Passing `call:${threadId}` double-' +
      'prefixes the topic to `call:call:{id}`, which this migration’s predicate ' +
      'cannot parse — every call would be denied.',
  );

  // And the predicate must slice at exactly the prefix length: 'call:' is 5.
  const { MIGRATIONS_DIR } = await import('./replay-migrations');
  const file = fs
    .readdirSync(MIGRATIONS_DIR)
    .find((f) => f.includes('call_rtc_channel_authorization'))!;
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  assert.match(
    sql,
    /substring\(p_topic FROM 6\)/,
    "'call:' is 5 chars, so the id starts at 6 — if the prefix ever changes, this " +
      'offset must change with it.',
  );
});
