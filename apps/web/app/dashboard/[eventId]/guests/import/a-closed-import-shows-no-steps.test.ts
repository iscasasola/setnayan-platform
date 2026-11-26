/**
 * a-closed-import-shows-no-steps.test.ts — final check A2-P5 (25 Nov 2026, plan batch A-5).
 *
 * Guest import either works (its steps) or is closed until December 19 (`guestImportGate`: the owner's own notice).
 * It never shows "1 · Get the guest list file" and its downloads above a notice that says the upload is not open yet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const page = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8'));

test('closed: the notice alone; open: the steps and the upload', () => {
  const gate = page.indexOf('{notYet ? (\n        <GuestImportWaits');
  const open = page.indexOf(') : (', gate);
  const step = page.indexOf('1 · Get the guest list file');
  const form = page.indexOf('<GuestImportForm');
  assert.ok(gate >= 0, 'the page decides on the gate before drawing any step');
  assert.ok(step > open && form > open, 'the steps and the upload are drawn only in the open branch');
  assert.equal(page.split('<GuestImportWaits').length - 1, 1, 'one notice');
  assert.match(page, /\{notYet \? null : \(\s*<p className="text-sm text-ink\/60">\s*Get the guest list file/, 'no "fill it in and upload" line while closed');
});
