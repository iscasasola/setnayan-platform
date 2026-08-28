/**
 * THE WAKE READS AS A WAKE — to the mourner who is not signed in.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
 * Every by-event word resolver read `public.events` through the COOKIE-SCOPED
 * session client. Measured against production, not read off a migration: that
 * table's three SELECT policies are all `roles={authenticated}`, so the number
 * admitting `anon` is ZERO. A signed-out read therefore came back empty, `!data`
 * was true, and the resolver fell through to WEDDING_PROFILE.
 *
 * 🚨 SO THE FUNERAL WORK HAD A BACK DOOR. PR #4793 exists precisely so a wake
 * never speaks in wedding words — solemn register, no countdown, "A gift of
 * sympathy" instead of a money dance. But the mourner who scans a wake's QR
 * arrives SIGNED OUT, which is the arm every one of these surfaces is reached
 * through: the join door said "the couple", and the wake's role picker offered
 * "Maid of honor", "Ring bearer" and "Veil sponsor". The register that whole
 * stream was built to protect was arriving wrong through the one door nobody
 * reviewing it was standing in.
 *
 * ⚠ THE COLUMN GRANT WAS NEVER THE BLOCKER.
 * `has_column_privilege('anon','public.events','event_type','SELECT')` is TRUE;
 * RLS is what refuses the row. "Add the grant" is the obvious wrong fix, and
 * this repo's per-column allowlist trap on `events` is a DIFFERENT trap. Do not
 * let the two be confused.
 *
 * ── WHAT THIS PINS, AND WHY IT IS A CLASS GUARD ─────────────────────────────
 * Not the four call sites — those were only the ones we found. The invariant is
 * about the MECHANISM: the event's own type must be resolved through a read that
 * cannot be refused, so that no surface can silently answer "wedding" because it
 * was not allowed to look. Naming the four surfaces would be the same
 * hand-enumerated list that let a third host-check clone ship.
 *
 * ── MUTATIONS, EACH MEASURED BY OCCURRENCE COUNT ────────────────────────────
 * · point the event read back at the session client (`createAdminClient` →
 *   `await createClient` in readEventTypeRow) → admin-scoped events reads
 *   1 → 0 · RED.
 * · delete the read entirely → events reads 1 → 0 · RED (the floor fires).
 * · strip the by-event resolvers out of the signed-out surfaces → resolver call
 *   sites 6 → 0 · RED (the floor fires).
 * An unmeasured mutation proves nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The ONE module that turns an event id into that event's words + role set. */
const RESOLVERS = 'lib/event-type-profile.ts';

/** The trees a visitor reaches without ever signing in: the public event site
 *  and the join door. Derived from the tree, never listed by hand. */
const SIGNED_OUT_TREES = [join('app', '[slug]'), join('app', 'join')];

/** The by-event resolvers. Each takes only an event id, so each MUST read the
 *  event itself — which is exactly why the read's scope is the whole story. */
const BY_EVENT_RESOLVERS = [
  'eventWordsForEvent(',
  'resolveRoleSetForEvent(',
  'resolveRoleSetKeyForEvent(',
  'resolveProfileByEvent(',
];

function sourceFilesUnder(rel: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
    }
  };
  walk(join(WEB, rel));
  return out;
}

test('the event read behind every by-event resolver is SERVICE-ROLE scoped', () => {
  const src = readFileSync(join(WEB, RESOLVERS), 'utf8');

  // Every read of `events` in this module, with the code just above it — which
  // is where the client that makes it is constructed.
  const reads: { scoped: 'admin' | 'session' | 'unknown'; at: number }[] = [];
  let i = 0;
  while ((i = src.indexOf(".from('events')", i)) !== -1) {
    const before = src.slice(Math.max(0, i - 400), i);
    const admin = before.lastIndexOf('createAdminClient(');
    const session = before.lastIndexOf('await createClient(');
    reads.push({
      scoped: admin === -1 && session === -1 ? 'unknown' : admin > session ? 'admin' : 'session',
      at: src.slice(0, i).split('\n').length,
    });
    i += 5;
  }

  // FLOOR. If the read has moved or been renamed this scan sees nothing, and
  // "no session-scoped reads" would then be true for the wrong reason.
  assert.ok(
    reads.length >= 1,
    `${RESOLVERS} contains no \`.from('events')\` read at all — this guard has ` +
      'gone blind, not clean. An empty sweep is never a pass.',
  );

  const notAdmin = reads.filter((r) => r.scoped !== 'admin');
  assert.deepEqual(
    notAdmin.map((r) => `${RESOLVERS}:${r.at} (${r.scoped})`),
    [],
    'The event-type read must use the service-role client. Read through the ' +
      'cookie-scoped session client it is REFUSED for every signed-out visitor — ' +
      'public.events has no SELECT policy admitting anon — and the resolver then ' +
      "falls back to WEDDING_PROFILE. That is how a wake came to say 'the couple' " +
      'to the mourner who scanned its QR.',
  );
});

test('a refused read and a missing event are no longer the same answer', () => {
  const src = readFileSync(join(WEB, RESOLVERS), 'utf8');
  // The read cannot throw its way to a wedding either: the catch arm must return
  // null (no row), which the caller then degrades — rather than the profile.
  assert.ok(
    /catch\s*\{\s*return null;\s*\}/.test(src),
    `${RESOLVERS}: the event-type read must degrade to "no row", not straight to a ` +
      'profile. Conflating a refused read with a missing event is how the defect ' +
      'came to read as the design.',
  );
});

test('the signed-out surfaces resolve their words through those resolvers', () => {
  const hits: string[] = [];
  for (const tree of SIGNED_OUT_TREES) {
    for (const file of sourceFilesUnder(tree)) {
      const src = readFileSync(file, 'utf8');
      if (BY_EVENT_RESOLVERS.some((r) => src.includes(r))) hits.push(relative(WEB, file));
    }
  }
  // FLOOR, not a list. Four surfaces were found by hand (the join door, the face
  // notice, the post-event story, the guest column card) plus the join door's
  // two server actions. Pinning WHICH ones would be the hand-enumerated list
  // that let a third host-check clone ship; pinning that there are several
  // catches the scan going blind.
  assert.ok(
    hits.length >= 4,
    `only ${hits.length} signed-out-reachable surfaces resolve words by event id ` +
      '— either the resolvers were renamed or this scan no longer reaches the ' +
      `trees it walks. Found: ${hits.join(', ') || '(none)'}`,
  );
});
