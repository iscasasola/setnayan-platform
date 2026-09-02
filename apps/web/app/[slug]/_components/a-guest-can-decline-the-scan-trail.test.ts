/**
 * A GUEST CAN DECLINE THE SCAN TRAIL — and can reach the switch to do it.
 *
 * `guests.scan_tracking_opt_out` shipped on 2026-05-13 citing RA 10173 and, for
 * fifteen months, nothing anywhere could turn it on. It is one of the columns
 * `tests/db/gates-have-handles.baseline.txt` calls a gate with no handle. This
 * file guards the handle; `lib/scan-trail.test.ts` guards the gate.
 *
 * 🛡 ANCHORED TO WHAT A REGRESSION WOULD REMOVE. This repo has shipped at least
 * six source-reading guards that stayed green while the thing they guarded was
 * gone — one matched a bare identifier that a surviving `import` line satisfied.
 * The checks below match bound actions and mounted JSX, not names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOTICE = join(HERE, 'scan-trail-notice.tsx');
const SITE_BODY = join(HERE, 'site-body.tsx');
const GUEST_ACTIONS = join(HERE, '..', 'actions.ts');

/** Comments stripped: every file here explains itself in prose that names the
 *  exact strings these assertions look for. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

test('ANCHOR — the three files were read and stripping left code behind', () => {
  for (const [name, path] of [
    ['scan-trail-notice.tsx', NOTICE],
    ['site-body.tsx', SITE_BODY],
    ['[slug]/actions.ts', GUEST_ACTIONS],
  ] as const) {
    assert.ok(code(path).length > 400, `${name}: stripped to nothing — every assertion is vacuous`);
  }
});

test('the switch is MOUNTED on the guest site, not merely imported', () => {
  const src = code(SITE_BODY);
  assert.match(
    src,
    /<ScanTrailNotice\s+eventId=/,
    'the scan-trail switch is not rendered — the column is a gate with no handle again',
  );
});

test('the switch is NOT hidden behind the selfie test that gates the face notice', () => {
  // FaceDataNotice renders only for `photo_source === 'selfie'`. Every guest
  // leaves a scan trail, so putting this control inside that branch would hide
  // it from most of the people it exists for.
  const src = code(SITE_BODY);
  const mount = src.slice(src.indexOf('<ScanTrailNotice'));
  const line = mount.slice(0, mount.indexOf('/>') + 2);
  assert.ok(
    !/photo_source/.test(line),
    'the scan-trail switch has been gated on the guest having a selfie',
  );
  // The face notice keeps its own gate — this must be an addition, not a move.
  assert.match(src, /photo_source === 'selfie'/, 'the face notice lost its selfie gate');
});

test('the control is wired to the action — a form with no action is a dead switch', () => {
  const src = code(NOTICE);
  assert.match(
    src,
    /setGuestScanTracking\.bind\(/,
    'the toggle is no longer bound to the server action',
  );
  assert.match(src, /action=\{toggle\}/, 'the form is not wired to the bound action');
  // It must offer the OPPOSITE of the stored value, or the button does nothing.
  assert.match(src, /guestId,\s*!optedOut\)/, 'the toggle no longer flips the stored value');
});

test('the control reads the stored value at render, so it cannot show the wrong position', () => {
  const src = code(NOTICE);
  assert.match(src, /readScanOptOut\(eventId, guestId\)/, 'the current setting is no longer read');
  assert.match(
    src,
    /scan_tracking_opt_out === true/,
    'the display no longer requires a positive true — a failed read could claim the guest is untracked',
  );
});

test('the OFF state tells the guest what it costs', () => {
  // The trail's only reader is the first-arrival greeting. A guest who turns
  // this off stops being welcomed on arrival, and finding that out by accident
  // is how a privacy control earns a reputation for breaking things.
  const src = code(NOTICE);
  assert.match(
    src,
    /greet you the same way every time/,
    'the cost sentence is gone — the OFF state now claims a free lunch',
  );
});

test('a guest can only ever move their OWN switch', () => {
  const src = code(GUEST_ACTIONS);
  const fn = src.slice(src.indexOf('export async function setGuestScanTracking'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 1);
  assert.ok(body.length > 200, 'setGuestScanTracking is missing — the switch has no writer');
  assert.match(body, /readGuestSession\(\)/, 'the action does not read the guest session');
  assert.match(
    body,
    /session\.event_id !== eventId \|\| session\.guest_id !== guestId/,
    'the action does not pin the session to BOTH the event and the guest',
  );
  // The write must be pinned the same way, or a valid session for one guest
  // could move a row selected by something else.
  assert.match(
    body,
    /\.eq\('event_id', eventId\)\s*\.eq\('guest_id', guestId\)/,
    'the update is not pinned to both the event and the guest',
  );
});

test('the guest control never wears the gold — it fails contrast as text', () => {
  // The Tailwind slot NAMED `terracotta` is the atelier GOLD (3.37:1, under the
  // 4.5:1 floor); the action colour lives in the slot named `mulberry`.
  const src = code(NOTICE);
  assert.equal(
    (src.match(/text-terracotta/g) ?? []).length,
    0,
    'gold is being used as text on a guest-facing privacy control',
  );
});
