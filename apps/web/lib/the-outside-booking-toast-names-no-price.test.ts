/**
 * the-outside-booking-toast-names-no-price.test.ts — final check A6-38(a), owner 27 Nov 2026: "Drop the word free".
 * The toast a supplier sees after adding a booking from outside Setnayan carries no price word.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const FILES = ['vendor-dashboard/calendar/dates-notices.ts', 'vendor-dashboard/customers/page.tsx'];

for (const f of FILES) {
  test(`${f}: the outside-booking toast says what happened, with no price word`, () => {
    const src = stripComments(readFileSync(join(APP, f), 'utf8'));
    const m = src.match(/client_imported:\s*\{[^}]*text:\s*'([^']+)'/);
    assert.ok(m, 'client_imported toast found');
    assert.equal(m![1], 'Booking from outside added. It holds that date on your schedule now.');
    assert.doesNotMatch(m![1], /\bfree\b/i);
  });
}
