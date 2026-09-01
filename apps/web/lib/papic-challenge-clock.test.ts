/**
 * THE CLOCK IS DECIDED IN ONE PLACE, AND A REFUSED READ SAYS SO.
 *
 * Two rules, both of which this surface has broken before in other clothes:
 *
 * 1 · ONE DECIDER. `papic_challenge_is_open()` in the database answers "is this
 *     challenge live right now?". If TypeScript ever re-derives that from
 *     `armedAt` and the wall clock — one `Date.now()` comparison is all it
 *     takes — the couple's screen and the guest's phone can disagree about
 *     whether a prompt is being asked, each passing its own tests. That is the
 *     drift item 3 spent six sessions removing from the spend ceiling, and the
 *     reason `resolveChallengeBoard` carries a NON-AUTHORITATIVE banner.
 *
 * 2 · A REFUSED READ IS NOT AN ABSENCE. "Nothing is armed" and "we could not
 *     find out" are the same empty result to a naive reader, and the second
 *     rendered as the first is exactly how a couple with 180 guests was told
 *     their event was empty (PRs #4579–#4585).
 *
 * 🛡 Every source assertion below is mutation-checked: the guard is written to
 *     match the line it is meant to catch, and a comment cannot satisfy it —
 *     `stripComments` runs first, because a guard that a comment can appease is
 *     a guard that shipped inert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchArmedChallenge } from '@/lib/papic-challenge-clock';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = stripComments(readFileSync(join(HERE, 'papic-challenge-clock.ts'), 'utf8'));

/** A client whose only job is to answer one `.rpc()` call. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  return { rpc: async () => result } as unknown as SupabaseClient;
}

const ROW = {
  mission_id: 'm-1',
  prompt: 'A photo with {host}',
  armed_at: '2026-09-01T10:00:00.000Z',
  source: 'couple',
  capture_kind: 'photo',
  board_slot: 3,
};

test('an armed challenge is reported as armed AND as measured', async () => {
  const r = await fetchArmedChallenge(stubClient({ data: [ROW], error: null }), 'e-1');
  assert.equal(r.measured, true);
  assert.equal(r.armed?.missionId, 'm-1');
  assert.equal(r.armed?.boardSlot, 3);
});

test('nothing armed is measured:true with armed:null — a real, knowable state', async () => {
  const r = await fetchArmedChallenge(stubClient({ data: [], error: null }), 'e-1');
  assert.equal(r.measured, true);
  assert.equal(r.armed, null);
});

test('a REFUSED read is measured:false — never "nothing is armed"', async () => {
  const refused = await fetchArmedChallenge(
    stubClient({ data: null, error: { code: '42501', message: 'permission denied' } }),
    'e-1',
  );
  assert.equal(refused.measured, false, 'a refusal must not read as a measurement');
  assert.equal(refused.armed, null);

  // 🔑 THE ASSERTION THAT MATTERS: the two states must not be the same object.
  // If `measured` were dropped, both would be `{ armed: null }` and every
  // screen would render a refusal as "no challenge is running".
  const genuinelyNone = await fetchArmedChallenge(stubClient({ data: [], error: null }), 'e-1');
  assert.notDeepEqual(
    refused,
    genuinelyNone,
    'a refused read and an un-armed celebration must be distinguishable by the caller',
  );
});

test('the prompt is returned unresolved — token substitution is not this layer’s job', async () => {
  const r = await fetchArmedChallenge(stubClient({ data: [ROW], error: null }), 'e-1');
  assert.equal(
    r.armed?.prompt,
    'A photo with {host}',
    'resolving {host} here would give the couple’s screen its own vocabulary, ' +
      'diverging from papic_guest_missions',
  );
});

// ── RULE 1, ENFORCED AGAINST THE SOURCE ────────────────────────────────────
test('this module calls the resolver and does not re-derive it', async () => {
  assert.match(
    SOURCE,
    /rpc\(\s*'papic_armed_challenge'/,
    'the armed challenge must come from the database resolver',
  );
});

test('no wall-clock comparison lives in this module', async () => {
  // The shapes a second decider would actually take. Each is checked
  // separately so a future edit is told WHICH rule it broke.
  assert.equal(/Date\.now\(\)/.test(SOURCE), false, 'no Date.now() — the database owns the clock');
  assert.equal(/new Date\(/.test(SOURCE), false, 'no Date construction — nothing here compares times');
  assert.equal(
    /armedAt\s*[<>]|armed_at\s*[<>]/.test(SOURCE),
    false,
    'no comparison against armed_at — that is papic_challenge_is_open’s decision',
  );
  assert.equal(
    /papic_window_end/.test(SOURCE),
    false,
    'the capture-window backstop is the resolver’s, not a second copy here',
  );
});
