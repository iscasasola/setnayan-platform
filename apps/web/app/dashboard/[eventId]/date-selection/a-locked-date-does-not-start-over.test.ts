/**
 * a-locked-date-does-not-start-over.test.ts — final check A2-P9 (25 Nov 2026, plan batch A-5).
 *
 * Once any supplier is confirmed, the date is set and only support changes it (Event settings says so; the date's
 * writer refuses). Pick your date said "Congratulations. Let's start with your date." with three ways to pick a new one.
 * Now every path shows the date and why, and a refused supplier read is said, never taken for "none booked".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const page = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8'));

test('a set date is decided before any path to pick one', () => {
  const check = page.indexOf('if ((bookedCount ?? 0) > 0) {');
  assert.ok(check > 0, 'the page asks whether a supplier is booked');
  for (const door of ["if (path === 'direct')", "if (path === 'guided')", 'Congratulations. Let&apos;s start with your date.']) {
    assert.ok(check < page.indexOf(door), `${door} is reachable on a set date`);
  }
  assert.match(page, /\.in\('status', CONFIRMED_VENDOR_STATUSES as unknown as string\[\]\)/, 'the same rule as Event settings and the writer');
  assert.match(page, /<PageMasthead title="Your date is set" \/>/);
  assert.match(page, /formatEventDateWithPrecision\(event\.event_date, precision\)/, 'the date itself is shown');
  assert.match(page, /It&rsquo;s set because a supplier is booked on it\./, 'and why');
});

test('a refused supplier read is said, never read as "none booked"', () => {
  const refused = page.indexOf('if (bookedErr) {');
  assert.ok(refused > 0 && refused < page.indexOf('if ((bookedCount ?? 0) > 0) {'));
  assert.ok(page.indexOf('<ReadRefusedNotice what="whether your date is set" />', refused) > refused);
});
