/**
 * the-live-wall-says-when-it-cannot-read.test.ts — a failure that looked like a
 * setting.
 *
 * ── The defect (register LAU-33) ────────────────────────────────────────────
 * `app/[slug]/_lib/loaders.ts` built the day-of live photo wall inside a `try`
 * whose failure path was:
 *
 *     } catch { liveWall = null; }
 *
 * `null` ALSO means "this couple does not own LIVE_WALL" and "they turned the
 * guest mirror off". So an RLS denial, a statement timeout or schema drift
 * rendered **byte-identically to a deliberate off-state** — the section was
 * simply absent. The error was not even bound, so there was no log line either.
 *
 * 🔑 THE PRECEDENT, and its rule 2 is the one that bites:
 * `lib/guests-read-is-honest.test.ts` and
 * `app/vendor-dashboard/reads-are-honest.test.ts`.
 * **A LOG LINE NEVER CHANGED A PIXEL — the measurement has to reach the RENDER.**
 * That is why the third test here is about JSX and not about a boolean.
 *
 * ── The three halves this holds ─────────────────────────────────────────────
 *   1. The DECISION is pure and executed, not asserted by regex.
 *   2. The LOADER binds the error and raises the flag — a discarded `catch {}`
 *      is the defect itself.
 *   3. The RENDER has an arm for it. A flag computed and never drawn is the
 *      same defect wearing a boolean.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';
import {
  liveWallReadState,
  LIVE_WALL_UNREADABLE_LINE,
  type LiveWallReadInput,
} from './live-wall-read-state';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const LOADER = 'app/[slug]/_lib/loaders.ts';
const BODY = 'app/[slug]/_components/site-body.tsx';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const base: LiveWallReadInput = { isLive: true, mirrorOn: true, hasData: true, unreadable: false };

test('a failed read is NOT the same answer as a deliberate off-state', () => {
  // The whole defect in one assertion: these two must differ.
  const failed = liveWallReadState({ ...base, hasData: false, unreadable: true });
  const off = liveWallReadState({ ...base, mirrorOn: false });
  assert.notEqual(failed, off, 'a failed read still reports the off-state');
  assert.equal(failed, 'unreadable');
  assert.equal(off, 'off');
});

test('the ordinary paths are unchanged', () => {
  assert.equal(liveWallReadState(base), 'show');
  assert.equal(liveWallReadState({ ...base, isLive: false }), 'off', 'not the day');
  assert.equal(liveWallReadState({ ...base, mirrorOn: false }), 'off', 'mirror off');
  assert.equal(
    liveWallReadState({ ...base, hasData: false }),
    'off',
    'owned, live, readable, simply no tiles yet — that is not an error',
  );
});

test('a read that FAILED is never reported as data, even if some tiles came back', () => {
  // Half a wall presented as the whole wall is the same lie in a smaller
  // costume, so `unreadable` outranks `hasData`.
  assert.equal(liveWallReadState({ ...base, hasData: true, unreadable: true }), 'unreadable');
});

test('a false alarm is impossible on the path nobody read', () => {
  // When the mirror is off we never attempted a read, so there is nothing to
  // have failed. Announcing trouble there would cry wolf on the common path.
  assert.equal(liveWallReadState({ ...base, mirrorOn: false, unreadable: true }), 'off');
  assert.equal(liveWallReadState({ ...base, isLive: false, unreadable: true }), 'off');
});

test('the loader BINDS the error and raises the flag — it does not discard it', () => {
  const src = read(LOADER);

  assert.doesNotMatch(
    src,
    /\}\s*catch\s*\{\s*liveWall = null;\s*\}/,
    'the bare `catch { liveWall = null }` is back — the failure has no symptom again',
  );
  assert.match(
    src,
    /catch\s*\(\s*err\s*\)/,
    'the catch must BIND its error; an unbound catch cannot report anything',
  );
  assert.match(src, /liveWallUnreadable = true;/, 'the flag is never raised');
  assert.match(
    src,
    /^\s*liveWallUnreadable,$/m,
    'the flag is raised but never RETURNED, so no surface can act on it',
  );
});

test('THE RENDER has an arm for it — a flag nobody draws is the same defect', () => {
  const src = read(BODY);

  assert.match(
    src,
    /liveWallUnreadable\s*\?/,
    'site-body computes nothing from the flag, so the page still says nothing',
  );
  assert.match(
    src,
    /LIVE_WALL_UNREADABLE_LINE/,
    'the honest line is not rendered anywhere in the day-of body',
  );

  // The arm must be reachable: it can only render when there is NO wall, and it
  // must not swallow the real wall's own condition.
  const armAt = src.indexOf('liveWallUnreadable ?');
  const mountAt = src.indexOf("dayOfPhase === 'live' && plan.liveMediaVisible && liveWall ?");
  assert.ok(armAt > 0 && mountAt > 0, 'could not find both the arm and the wall mount');
  assert.match(
    src.slice(Math.max(0, armAt - 200), armAt),
    /!liveWall/,
    'the unreadable arm must require `!liveWall`, or it competes with the real wall',
  );
});

test('the line tells a guest something true and does not promise a fix', () => {
  assert.ok(LIVE_WALL_UNREADABLE_LINE.length > 25, 'too short to mean anything');
  assert.doesNotMatch(
    LIVE_WALL_UNREADABLE_LINE,
    /error|failed|exception|refused|denied/i,
    'a guest at a wedding is not the audience for our error vocabulary',
  );
  assert.doesNotMatch(
    LIVE_WALL_UNREADABLE_LINE,
    /contact|support|email us/i,
    'do not route a guest to support for a thing the couple owns',
  );
});
