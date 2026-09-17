/**
 * a-samahan-is-told-who-joined.test.ts — DAY-21.
 *
 * The samahan notice machine was finished except for one case. `samahan-notify.ts`
 * ships a service-role roster fan-out, a collapse window reasoned from the group's
 * own one-story-per-hour limit, pure recipient rules split out so they can be
 * exercised without a database, and a documented fail-toward-ringing posture on the
 * collapse read. And its kind enum was `{ story, message }`. A group was told what
 * was POSTED and never who ARRIVED.
 *
 * ── WHAT THIS PINS, AND IN WHICH WAY ───────────────────────────────────────────
 * Split deliberately, because the two halves can only be checked by different
 * means and pretending otherwise is how a guard ships inert:
 *
 *   EXERCISED — the pure rules. `join` is a real kind with its own type, its own
 *   destination and its own words, and the words stay true under collapse.
 *
 *   PARSED — two things no unit test can execute, because `samahan-notify.ts` is
 *   `server-only` (a node test cannot import it at all) and the join action is a
 *   `'use server'` module that redirects:
 *     · the join action actually CALLS the fan-out with `kind: 'join'`, above its
 *       `redirect` — a call registered below an unreachable `redirect()` never
 *       registers, and the symptom is exactly the silence this row is about;
 *     · the collapse read still narrows on `type` AND `related_url`. `join` and
 *       `story` deliberately share one URL, so narrowing on the URL alone would
 *       make a standing story notice silence a join, and vice versa.
 *
 * Source is read through the repo's ONE comment stripper, so a rule that survives
 * only as prose describing it counts as MISSING — including the prose above.
 *
 * ⚠ THE ENUM VALUE ITSELF IS NOT RE-PINNED HERE. `every-notice-type-exists-in-the-
 * database.test.ts` already derives both sides from the code and fails if a union
 * member has no `ALTER TYPE … ADD VALUE`. A second hand-written copy of that check
 * would be a list of the types somebody thought of, which is the exact failure that
 * guard was written to avoid.
 *
 * 🛡 Sabotage-checked, each one still PARSING and still TYPECHECKING (a mutation
 * that breaks the module proves nothing — the run goes green on zero tests, and
 * `# tests 0` reads exactly like a pass). The subtest count is printed on every
 * run for the same reason.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  NOTICE_TYPE,
  samahanNoticeCopy,
  samahanNoticeUrl,
  type SamahanNoticeKind,
} from '@/lib/samahan-notice-rules';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const notify = stripComments(readFileSync(join(WEB, 'lib', 'samahan-notify.ts'), 'utf8'));
const joinAction = stripComments(
  readFileSync(join(WEB, 'app', 'samahan', 'join', '[token]', 'actions.ts'), 'utf8'),
);

const COMMUNITY = 'cmt-barkada';

test('EXERCISED · `join` is a real notice kind, not a label on an existing one', () => {
  const kinds = Object.keys(NOTICE_TYPE) as SamahanNoticeKind[];
  console.log(`  kinds: ${kinds.join(' · ')}`);
  assert.ok(kinds.includes('join'), 'joining is not one of the samahan notice kinds');

  // Its own enum value — sharing `samahan_story` would make the collapse read
  // treat an arrival and a clip as the same standing notice.
  assert.equal(NOTICE_TYPE.join, 'samahan_join');
  const types = Object.values(NOTICE_TYPE);
  assert.equal(new Set(types).size, types.length, 'two samahan kinds share one notification type');
});

test('EXERCISED · the words stay true when a second joiner is collapsed away', () => {
  const { title, body } = samahanNoticeCopy('join', 'Ana', 'Barkada');
  console.log(`  join copy: "${title}" / "${body}"`);
  assert.match(title, /\bAna\b/, 'the notice does not say who joined');
  assert.match(title, /\bBarkada\b/, 'the notice does not say which samahan');

  /*
   * The load-bearing one. Two arrivals inside the collapse window produce ONE
   * notice, so the body must send the reader somewhere COMPLETE rather than
   * imply the title is the whole story. A body that only restated the title
   * would be true and still leave a member wrong about who is in their group.
   */
  assert.doesNotMatch(body, /\bAna\b/, 'the body repeats the one name the title already vouched for');
  assert.match(
    body,
    /everyone|all|who(?:'s| is)? (?:here|in)/i,
    'the body must point at the complete list, because a second joiner is collapsed away',
  );

  // An unnamed joiner must never render as an empty gap or "undefined".
  const blank = samahanNoticeCopy('join', '   ', '');
  console.log(`  blank-name copy: "${blank.title}"`);
  assert.doesNotMatch(blank.title, /undefined|null|\s{2,}|^\s|\s$/);
});

test('EXERCISED · a join points at the samahan, and shares that URL with a story on purpose', () => {
  assert.equal(samahanNoticeUrl(COMMUNITY, 'join'), `/dashboard/samahan/${COMMUNITY}`);
  assert.equal(samahanNoticeUrl(COMMUNITY, 'join'), samahanNoticeUrl(COMMUNITY, 'story'));
  assert.notEqual(samahanNoticeUrl(COMMUNITY, 'join'), samahanNoticeUrl(COMMUNITY, 'message'));
});

test('PARSED · the collapse read narrows on the TYPE as well as the URL', () => {
  /*
   * Because `join` and `story` share a destination, the type predicate is the
   * only thing keeping one from silencing the other. Matched as an ordered pair
   * inside one chained read rather than as two independent greps, so a `type`
   * filter that had drifted onto some other query cannot satisfy this.
   */
  const chain =
    /\.from\('notifications'\)[\s\S]{0,400}?\.eq\('type',\s*type\)[\s\S]{0,200}?\.eq\('related_url',\s*relatedUrl\)/;
  const hits = notify.match(new RegExp(chain, 'g'))?.length ?? 0;
  console.log(`  collapse reads narrowing on type AND related_url: ${hits}`);
  assert.equal(hits, 1, 'the collapse read no longer narrows on both the type and the URL');
});

test('PARSED · the join action calls the fan-out with `join`, above its redirect', () => {
  const call = /notifySamahanCoMembers\(\{[\s\S]{0,300}?kind:\s*'join'[\s\S]{0,80}?\}\)/g;
  const calls = joinAction.match(call) ?? [];
  console.log(`  notifySamahanCoMembers({ …kind: 'join' }) call sites: ${calls.length}`);
  assert.equal(calls.length, 1, 'the join path does not tell the samahan somebody arrived');

  /*
   * `redirect()` THROWS. Anything below it is unreachable, so an `after()`
   * registered there is never registered — and the failure is invisible: the
   * member still lands in their samahan and nobody is told, which is
   * byte-identical to the defect this row exists to fix.
   */
  const at = joinAction.search(call);
  const lastRedirect = joinAction.lastIndexOf('redirect(');
  console.log(`  call at ${at}, final redirect at ${lastRedirect}`);
  assert.ok(at > 0, 'the fan-out call was not found at all');
  assert.ok(
    at < lastRedirect,
    'the fan-out is registered below the redirect that throws, so it can never run',
  );

  // And it must be deferred, like every other samahan emit — never in front of
  // the response the joining member is waiting on.
  assert.match(
    joinAction.slice(Math.max(0, at - 120), at + 40),
    /after\(\s*\(\)\s*=>/,
    'the fan-out is not deferred through `after()`',
  );
});
