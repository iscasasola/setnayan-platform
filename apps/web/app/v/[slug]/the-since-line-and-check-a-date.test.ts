/**
 * Supplier website by plan (owner-approved 2026-10-30) — slice 2 on the shop page itself:
 *   · the ONE "since" fact line (In business since · N events › · On Setnayan since) replaces the old pill + line;
 *   · "Check a date" sits in the action row beside Share, under the same `bookable` gate as Inquire, and in the rail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the page draws the since line, fed by the by-kind counter', () => {
  assert.match(PAGE, /<ShopSinceLine[\s\S]{0,400}events=\{shopEventsByKind\}/);
  assert.match(PAGE, /eventsByKind\(\{\s*completed: completedEvents,/, 'the events count must be the Track record rows');
  assert.doesNotMatch(PAGE, /\+ weddings</, 'the old "N+ weddings" pill came back beside the events count');
});

test('Check a date sits in the action row, after Share, inside the bookable gate — and in the desktop rail', () => {
  const row = PAGE.indexOf('<ShareButton title={displayLabel} className="button-secondary inline-flex items-center gap-2" />');
  assert.ok(row > 0, 'the action row moved — update this test with the markup');
  const gate = PAGE.lastIndexOf('{bookable ? (', row);
  const door = PAGE.indexOf('<CheckADateLink', row);
  assert.ok(gate > 0 && door > row && door - row < 800, 'Check a date is not beside Share in the action row');
  assert.equal((PAGE.match(/<CheckADateLink/g) ?? []).length, 2, 'Check a date is on the action row and the rail only');
});
