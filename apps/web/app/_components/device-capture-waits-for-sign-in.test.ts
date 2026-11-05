/**
 * device-capture-waits-for-sign-in.test.ts — the device id is sent only for a signed-in person.
 *
 * ── THE DEFECT (live check 2026-10-23) ──────────────────────────────────────
 * Every signed-out visit to setnayan.com fired one server-action POST (`recordDeviceHash`). The server
 * records nothing without an account (DPO review 2026-07-12, safeguard 4: "Secured accounts only"), so
 * each visit cost one function call for nothing — and wrote an `sn_did` into a stranger's localStorage.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. The gate says no for a signed-out cookie jar, yes for a Supabase session cookie (plain or chunked),
 *      no once this session has sent it, and no with the flag off.
 *   2. Signed out or flag off, the gate never reads storage.
 *   3. The component asks the gate BEFORE any localStorage write or server call, and re-asks on every
 *      navigation (so a sign-in that lands without a reload is still caught). The "sent" mark is set when
 *      the call is actually made, not when it is scheduled.
 *   4. The server keeps its own gates — the client check is a saving, never the authority.
 *
 * SABOTAGE: make the gate `return flagOn && !alreadyPinged()` → RED (signed out sends again).
 * SABOTAGE: move `localStorage.getItem(DEVICE_ID_KEY)` above the gate in device-capture.tsx → RED.
 * SABOTAGE: put `[]` back as the effect's deps → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { shouldCaptureDevice } from '@/lib/device-capture-gate';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SIGNED_OUT = 'setnayan-client-type=web; sn-theme=light';
const SIGNED_IN = 'setnayan-client-type=web; sb-abcdefghij-auth-token=base64-eyJ4Ijox';
const CHUNKED = 'sb-abcdefghij-auth-token.0=base64-eyJ; sb-abcdefghij-auth-token.1=x';
const never = () => {
  throw new Error('read storage when it had no reason to');
};

test('the gate: signed out never, signed in once, flag off never', () => {
  assert.equal(shouldCaptureDevice(true, SIGNED_OUT, never), false, 'a signed-out visit must not send');
  assert.equal(shouldCaptureDevice(true, '', never), false, 'no cookies at all must not send');
  assert.equal(shouldCaptureDevice(true, SIGNED_IN, () => false), true, 'a signed-in visit must send');
  assert.equal(shouldCaptureDevice(true, CHUNKED, () => false), true, 'a chunked session cookie is signed in');
  assert.equal(shouldCaptureDevice(true, SIGNED_IN, () => true), false, 'once per browser session');
  assert.equal(shouldCaptureDevice(false, SIGNED_IN, never), false, 'flag off sends nothing');
});

test('the component asks the gate before any storage write or server call, on every navigation', () => {
  const src = read('app/_components/device-capture.tsx');
  const gate = src.indexOf('shouldCaptureDevice(');
  assert.ok(gate > 0, 'the component no longer asks the gate');
  for (const after of ['localStorage', 'recordDeviceHash(', 'sessionStorage.setItem']) {
    const at = src.indexOf(after, src.indexOf('useEffect('));
    assert.ok(at > gate, `${after} runs before the sign-in gate`);
  }
  assert.match(src, /\}, \[pathname\]\);/, 'the gate must be re-asked on each navigation, not once per mount');
  const timer = src.slice(src.indexOf('setTimeout('));
  assert.ok(
    timer.indexOf("sessionStorage.setItem(PINGED_KEY") > -1 && timer.indexOf("sessionStorage.setItem(PINGED_KEY") < timer.indexOf('recordDeviceHash('),
    'the "sent" mark must be set inside the timer, when the call is made — a navigation that cancels the timer must leave the next page free to send',
  );
});

test('the server keeps its own gates', () => {
  const action = read('lib/device-capture.ts');
  assert.match(action, /if \(!deviceFingerprintEnabled\(\)\) return;/);
  assert.match(action, /isDataPrivacyControlActive\('device_fingerprint'\)/);
  assert.match(action, /if \(!user \|\| user\.is_anonymous\) return;/);
});
