/**
 * Supplier website by plan (owner-approved 2026-10-30) — slice 2 on the shop page itself:
 *   · the ONE "since" fact line (In business since · N events › · On Setnayan since) replaces the old pill + line;
 *   · "Check a date" sits in the action row beside Share, under the same `bookable` gate as Inquire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

test('Check a date sits in the action row, after Share, inside the bookable gate', () => {
  const row = PAGE.indexOf('<ShareButton title={displayLabel} className="button-secondary inline-flex items-center gap-2" />');
  assert.ok(row > 0, 'the action row moved — update this test with the markup');
  const gate = PAGE.lastIndexOf('{bookable ? (', row);
  const door = PAGE.indexOf('<CheckADateLink', row);
  assert.ok(gate > 0 && door > row && door - row < 800, 'Check a date is not beside Share in the action row');
  // One door: the Pro desktop rail it also sat in was retired 2026-10-30 (slice 4 — the whole card column is sticky now).
  assert.equal((PAGE.match(/<CheckADateLink/g) ?? []).length, 1, 'Check a date is on the action row only');
});

test('Check a date opens the live landing (#7007) — never a 404', () => {
  // #7065 waited for #7007 (`/v/[slug]/dates`), now on main. The door must point at a page that exists.
  assert.ok(existsSync(join(HERE, 'dates', 'page.tsx')), '/v/[slug]/dates is gone — the door would 404');
  assert.match(PAGE, /<CheckADateLink\s+href=\{`\/v\/\$\{vendor\.business_slug \?\? slug\}\/dates`\}/, 'the door does not point at /v/<slug>/dates');
});

test('an unchecked year reads as the year alone — never "self-reported" (owner 2026-11-07: "drop it")', () => {
  const LINE = stripComments(readFileSync(join(HERE, '_components', 'shop-since-line.tsx'), 'utf8'));
  assert.doesNotMatch(LINE, /self[- ]reported/i, 'the since line labels an unchecked year again — the ✓ alone marks a checked one');
  assert.match(LINE, /sinceVerified \? \(\s*<BadgeCheck/, 'the ✓ for a DTI-checked year is gone');
});
