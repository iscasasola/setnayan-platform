/**
 * A DOOR THAT PRINTS ITS OWN `?error=` KEEPS IT (2026-11-06).
 *
 * Measured on /signup?error=password_leaked before this fix: the server HTML carried the banner "This password
 * has appeared in a known data breach…"; once the page settled the address read /signup, the banner was gone,
 * and a generic "Something went wrong — please try again." toast stood in its place. The app-wide bridge
 * (`toast-from-params.tsx`) had `router.replace`d the address, and the server drew the page again without its
 * error. Same on /reset-password, /join → set password and Profile — ~70 pages read `?error=`.
 *
 * Held here: the decision (behaviour), and the two mechanical promises in the component (source).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { GENERIC_ERROR, planParamToast } from './param-toast';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const plan = (qs: string, shows = false) => planParamToast(new URLSearchParams(qs), shows);

test('no flag → nothing happens (the address is not touched)', () => {
  assert.equal(plan(''), null);
  assert.equal(plan('next=%2Fdashboard&as=supplier'), null);
  assert.equal(plan('msg=hello'), null, 'msg alone is not a flag');
});

test('an error the page already SHOWS gets no second, generic toast', () => {
  assert.deepEqual(plan('error=password_leaked&next=%2Fdashboard', true), { toast: null, search: '?next=%2Fdashboard' });
  assert.deepEqual(plan('error=1&msg=Nope', true), { toast: null, search: '' });
});

test('an error the page does NOT show still toasts — its msg, else the generic line', () => {
  assert.deepEqual(plan('error=1&msg=Could%20not%20save'), { toast: { tone: 'error', message: 'Could not save' }, search: '' });
  assert.deepEqual(plan('error=1'), { toast: { tone: 'error', message: GENERIC_ERROR }, search: '' });
});

test('success flags toast as before, and leave the address', () => {
  assert.deepEqual(plan('saved=1&tab=guests'), { toast: { tone: 'success', message: 'Saved.' }, search: '?tab=guests' });
  assert.deepEqual(plan('created=ABC123'), { toast: { tone: 'success', message: 'Created — ABC123' }, search: '' });
  assert.deepEqual(plan('done=approved', true), { toast: { tone: 'success', message: 'Approved.' }, search: '' });
});

test('every handled flag leaves the address; everything else stays', () => {
  const p = plan('error=x&msg=y&saved=1&next=%2Fa&ref=guest');
  assert.equal(p?.search, '?next=%2Fa&ref=guest');
});

test('the component strips the address WITHOUT asking the server for the page again', () => {
  const code = read('app/_components/toast/toast-from-params.tsx');
  assert.match(code, /window\.history\.replaceState\(/, 'the flags leave via history.replaceState');
  assert.doesNotMatch(code, /router\.replace\(|useRouter\(/, 'router.replace re-draws the page from the server — without its ?error=');
  assert.match(code, /planParamToast\(/, 'one decision, the tested one');
  assert.match(code, /querySelectorAll\('\[role="alert"\]'\)/, 'it asks the page whether it already shows an error');
  assert.match(code, /closest\('\[data-peek-toast\]'\)/, 'a peek toast is not the page');
  // Lives for the whole visit in the root providers: a one-shot ref meant only the first flag of a visit toasted.
  assert.doesNotMatch(code, /useRef\(false\)/, 'handled per address, not once per visit');
  assert.match(code, /handled\.current = null/, 'a clean address resets, so the same flag toasts again later');
});

test('the doors from the walk print their refusal in a role="alert" — so the bridge stays quiet there', () => {
  // /signup: its own banner element.
  assert.match(read('app/signup/page.tsx'), /role="alert" className="hr-si-banner hr-si-banner--error"/);
  // /reset-password and /join → set password: DoorNotice kind="alert" (role="alert").
  assert.match(read('app/reset-password/page.tsx'), /<DoorNotice kind="alert">\{errorMessage\}<\/DoorNotice>/);
  assert.match(read('app/join/[eventId]/set-password/page.tsx'), /<DoorNotice kind="alert">\{errMsg\}<\/DoorNotice>/);
  assert.match(read('app/_components/door/door-shell.tsx'), /alert \? \{ role: 'alert' as const \}/);
  // Profile: FormFlash tone="error" (role="alert").
  assert.match(read('app/dashboard/(account)/profile/page.tsx'), /<FormFlash tone="error">\{decodeURIComponent\(search\.error\)\}<\/FormFlash>/);
  assert.match(read('app/_components/forms/form-flash.tsx'), /if \(tone === 'error'\) \{\s*return \(\s*<p\s+role="alert"/);
});
