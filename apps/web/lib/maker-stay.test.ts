/**
 * maker-stay.test.ts — 🧷 A MAKER SAVE LANDS WHERE THE COUPLE ALREADY IS.
 *
 * Owner, 2026-09-28: *"a lot of times. it reloads the whole page. which
 * shouldn't"*. A Maker save redirected to `return_to` + `?saved=1` — a new
 * query, so a new page key, so the App Router swapped the whole Maker for the
 * launch route's grid skeleton and mounted it fresh. `lib/maker-stay.ts` points
 * every Maker save at the address the couple is on, and `resolveReturnTo`
 * honours it verbatim. This holds:
 *   1. which forms are pointed back (and which are left alone);
 *   2. `resolveReturnTo` keeps the address EXACTLY (no `?saved=1`), still
 *      behind the open-redirect fence;
 *   3. the shell's submit listener runs in the CAPTURE phase (before React
 *      reads the form) and stamps both fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAKER_STAY_FIELD, makerStayReturn } from './maker-stay';
import { resolveReturnTo } from './editor-return';
import { stripComments } from './strip-comments';

const E = 'ev-1';
const HERE = `/dashboard/${E}/launch`;
const base = { eventId: E, here: HERE, drafts: false, method: 'post' };

test('a form returning into this Maker lands on the address the couple is on', () => {
  for (const rt of [
    `/dashboard/${E}/launch?stage=rsvp&scene=w1&chain=up.w1.2`,
    `/dashboard/${E}/launch?tool=love-story`,
    `/dashboard/${E}/launch`,
  ]) {
    assert.equal(makerStayReturn({ ...base, returnTo: rt }), HERE, rt);
  }
  // …whatever the couple's own address carries (a deep link they opened on).
  assert.equal(
    makerStayReturn({ ...base, here: `${HERE}?tool=hero`, returnTo: `${HERE}?scene=w1` }),
    `${HERE}?tool=hero`,
  );
});

test('a DRAFT form with no return_to lands here too — never bounced to a /website sub-page and back', () => {
  assert.equal(makerStayReturn({ ...base, returnTo: null, drafts: true }), HERE);
  assert.equal(makerStayReturn({ ...base, returnTo: '', drafts: true }), HERE);
});

test('everything else is left exactly as it was', () => {
  // A live form with no return_to (the Details API post, the address field).
  assert.equal(makerStayReturn({ ...base, returnTo: null }), null);
  // A form that returns somewhere else on purpose.
  assert.equal(makerStayReturn({ ...base, returnTo: `/dashboard/${E}/studio/website-pro` }), null);
  // Another event's Maker, a look-alike path.
  assert.equal(makerStayReturn({ ...base, returnTo: `/dashboard/other/launch` }), null);
  assert.equal(makerStayReturn({ ...base, returnTo: `/dashboard/${E}/launchpad` }), null);
  // A search (GET) is never a save.
  assert.equal(makerStayReturn({ ...base, returnTo: HERE, method: 'GET' }), null);
  // Not in the Maker at all (the same panel on its own sub-page).
  assert.equal(makerStayReturn({ ...base, here: `/dashboard/${E}/website/colors`, returnTo: HERE, drafts: true }), null);
});

test('resolveReturnTo keeps a Maker stay VERBATIM — a `?saved=1` would re-key the page', () => {
  const fd = new FormData();
  fd.set('return_to', `${HERE}?tool=hero`);
  fd.set(MAKER_STAY_FIELD, '1');
  assert.equal(resolveReturnTo(fd, '/dashboard/x/website/widgets?saved=1', '?saved=1'), `${HERE}?tool=hero`);
  // Without the stay the old behaviour is untouched.
  const plain = new FormData();
  plain.set('return_to', HERE);
  assert.equal(resolveReturnTo(plain, '/x', '?saved=1'), `${HERE}?saved=1`);
  // The fence still holds: a hostile return_to with the stay falls back.
  const hostile = new FormData();
  hostile.set('return_to', 'https://evil.example/dashboard/x');
  hostile.set(MAKER_STAY_FIELD, '1');
  assert.equal(resolveReturnTo(hostile, '/fallback', '?saved=1'), '/fallback');
});

test('the shell stamps both fields in the CAPTURE phase, on every Maker form', () => {
  const shell = stripComments(
    readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx'), 'utf8'),
  );
  assert.match(shell, /addEventListener\('submit', onSubmit, true\)/, 'capture phase — before React reads the form');
  const body = shell.slice(shell.indexOf('const onSubmit = '), shell.indexOf("addEventListener('submit', onSubmit, true)"));
  assert.match(body, /makerStayReturn\(/);
  assert.match(body, /setHiddenField\(form, 'return_to', next\)/);
  assert.match(body, /setHiddenField\(form, MAKER_STAY_FIELD, '1'\)/);
  // A React action form carries no method attribute; `form.method` would read 'get'.
  assert.match(body, /form\.getAttribute\('method'\) \?\? 'post'/);
  assert.doesNotMatch(body, /method: form\.method\b/);
});
