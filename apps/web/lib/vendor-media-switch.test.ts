/**
 * The couple's per-supplier photo switch — and specifically, that it HAS A
 * HANDLE.
 *
 * This project has twice shipped a column that everything read and nothing ever
 * wrote: face auto-tagging sat dead for seven weeks, and the livestream
 * audience flag hid the broadcast from every anonymous viewer on every event.
 * Both looked finished. Neither had a way to flip it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const ACTION = read('..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'vendor-visibility-actions.ts');
const CONTROL = read('..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', '_components', 'vendor-media-controls.tsx');
const PAGE = read('..', 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'page.tsx');
const GALLERY = read('papic-gallery.ts');

test('THE HANDLE: something actually WRITES the column', () => {
  // The whole point. A reader-only column is the failure mode this guards.
  const code = strip(ACTION);
  assert.match(
    code,
    /\.update\(\{\s*papic_captures_hidden/,
    'no write path — this is exactly how two features shipped dead',
  );
});

test('THE HANDLE IS REACHABLE: a control is mounted, not just written', () => {
  // A server action nobody renders is still a dead feature.
  assert.match(strip(CONTROL), /action=\{setVendorCapturesHidden\}/, 'the form must call it');
  assert.match(strip(PAGE), /<VendorMediaControls/, 'and the page must mount the control');
});

test('the gallery actually applies the flag', () => {
  const code = strip(GALLERY);
  assert.match(code, /papic_captures_hidden/, 'the read must consult it');
  assert.match(code, /hiddenVendorIds\.has\(/, 'and filter on it');
});

test('a failed exclusion read hides NOTHING rather than blanking the gallery', () => {
  // Direction matters. This flag only ever REMOVES, so failing open shows too
  // much — visible, and recoverable. Failing closed would blank a couple's
  // whole gallery because a query stumbled.
  const code = strip(GALLERY);
  const idx = code.indexOf('hiddenVendorRows');
  assert.ok(idx > -1);
  const block = code.slice(idx, idx + 600);
  assert.ok(
    !/if\s*\(\s*\w*[Ee]rror\s*\)\s*return/.test(block),
    'an error must not short-circuit into hiding everything',
  );
});

test('the write is scoped by event as well as by row id', () => {
  const code = strip(ACTION);
  assert.match(code, /\.eq\('vendor_id', vendorRowId\)/);
  assert.match(code, /\.eq\('event_id', eventId\)/, 'a mismatched pair must not edit another event');
});

test('the write uses the couple’s own client, never service-role', () => {
  // The couple already owns this row. Escalating would let a bug reach past
  // what they could do by hand.
  const code = strip(ACTION);
  assert.ok(!/createAdminClient/.test(code), 'no service-role on a couple-owned row');
  assert.match(code, /createClient\(\)/);
});

test('the copy does not let a couple think hiding deletes', () => {
  assert.match(
    CONTROL,
    /nothing is deleted/i,
    'hiding is not deleting, and the moment a couple exercises control is the ' +
      'worst moment to be vague about it',
  );
});
