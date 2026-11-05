/**
 * GUARD — AN 11TH RUNNING CHALLENGE IS REFUSED, ON THE SERVER (owner ruling 2026-10-24: "a hard cap of 10 active
 * challenges per event, enforced on the SERVER in setCoupleChallengeActiveAction and addLibraryChallengeAction, not
 * just in the UI").
 *
 *   1. The rule: with 10 others running, an activation is refused; with 9 it is allowed; an unread count refuses.
 *   2. Every activation asks it BEFORE it writes — a switch turned on, a library pick, one written by hand (which is
 *      kept switched off when there is no room).
 *
 * Sabotage (2026-10-24): the switch's check removed → 2 red; the cap raised to 11 → 1 red. Restored → green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIVE_CHALLENGE_CAP, activationRefused } from './papic-missions';
import { stripComments } from './strip-comments';

test('1 · the 11th is refused; the 10th is not; an unread count refuses', () => {
  assert.equal(ACTIVE_CHALLENGE_CAP, 10);
  assert.equal(activationRefused(10), true, 'an 11th running challenge was allowed');
  assert.equal(activationRefused(9), false, 'the 10th was refused');
  assert.equal(activationRefused(0), false);
  assert.equal(activationRefused(null), true, 'a failed count let an activation through');
});

test('2 · every activation path asks the cap before it writes', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/studio/papic/actions.ts'), 'utf8'));
  const body = (name: string) => {
    const at = src.indexOf(`export async function ${name}(`);
    assert.ok(at >= 0, `${name} is gone`);
    return src.slice(at, src.indexOf('\nexport async function ', at + 10));
  };
  const toggle = body('setCoupleChallengeActiveAction');
  const check = toggle.indexOf("active === 'true' && activationRefused(await activeChallengesBesides(supabase, eventId, missionId))");
  assert.ok(check > 0, 'turning a challenge on never asks the cap');
  assert.ok(check < toggle.indexOf(".update({ is_active: active === 'true' })"), 'the cap is asked after the write');
  const pick = body('addLibraryChallengeAction');
  // 🎚 2026-10-27: a pick can CHANGE a slot — the cap is asked besides the challenge it replaces (one in, one out).
  const capAt = pick.indexOf('activationRefused(await activeChallengesBesides(supabase, eventId, replacing?.id ?? null))');
  assert.ok(capAt > 0 && capAt < pick.indexOf(".from('papic_missions').insert("), 'a library pick never asks the cap before it inserts');
  const own = body('createCoupleChallengeAction');
  assert.match(own, /const room = !activationRefused\(await activeChallengesBesides\(supabase, eventId, replacing\?\.id \?\? null\)\);[\s\S]*is_active: room,/, 'one written by hand turns on whatever the count');
  // …and a library pick that is not a change still refuses outright at the cap; a change is kept, switched off.
  assert.match(pick, /if \(!replacing && !roomForIt\) \{\s*redirect\(`\$\{returnTo\}\?add=full`\);/, 'an eleventh library pick is no longer refused');
  assert.match(pick, /is_active: roomForIt,/, 'a library pick turns on whatever the count');
});
