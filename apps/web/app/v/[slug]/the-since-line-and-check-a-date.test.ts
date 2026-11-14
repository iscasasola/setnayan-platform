/**
 * Supplier website by plan (owner-approved 2026-10-30) — slice 2 on the shop page itself:
 *   · the ONE "since" fact line (In business since · N events › · On Setnayan since) replaces the old pill + line;
 *   · "Check a date" sits in the action row (Inquire · Add to your event, then Check a date · Share), under `bookable`.
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

test('Check a date sits in the action row, after Add to your event and before Share, inside the bookable gate', () => {
  // Order (prototype public_pages_three_2026-11-13, owner 13 Nov): Inquire · Add to your event, then Check a date · Share.
  const add = PAGE.indexOf('label="Add to your event"');
  assert.ok(add > 0, 'the action row moved — update this test with the markup');
  const door = PAGE.indexOf('<CheckADateLink', add);
  assert.ok(door > add && door - add < 1200, 'Check a date is not beside Add to your event in the action row');
  const share = PAGE.indexOf('<ShareButton title={displayLabel} className="button-secondary inline-flex items-center gap-2" />');
  assert.ok(share > door && share - door < 600, 'Share does not follow Check a date');
  // The row itself opens on `canMessage` since an unverified shop takes messages (DECISION_LOG 2026-11-07, #7373), so
  // the `bookable` gate is no longer the ROW's — it is the door's own, and it must sit between Add and the door.
  const gate = PAGE.lastIndexOf('{bookable ? (', door);
  assert.ok(gate > add && gate < door, 'Check a date is not inside its own bookable gate — an unverified shop would show it');
  // One door: the Pro desktop rail it also sat in was retired 2026-10-30 (slice 4 — the whole card column is sticky now).
  assert.equal((PAGE.match(/<CheckADateLink/g) ?? []).length, 1, 'Check a date is on the action row only');
  // Walk 14 Nov 2026: the About panel ("What their own website can't do") drew a second Check a date under the header one.
  const panel = stripComments(readFileSync(join(HERE, '_components', 'shop-can-do-panel.tsx'), 'utf8'));
  assert.doesNotMatch(panel, /<CheckADateLink\b/, 'the About panel draws a second Check a date button');
});

test('Check a date opens the live landing (#7007) — never a 404', () => {
  // #7065 waited for #7007 (`/v/[slug]/dates`), now on main. The door must point at a page that exists.
  assert.ok(existsSync(join(HERE, 'dates', 'page.tsx')), '/v/[slug]/dates is gone — the door would 404');
  // Since 2026-11-07 the door also carries where the visit came from (`withShopArrival`, lib/shop-back.ts), so the
  // shop's Back stays right after the round trip. It still points at the same landing.
  assert.match(
    PAGE,
    /<CheckADateLink\s+href=\{withShopArrival\(`\/v\/\$\{vendor\.business_slug \?\? slug\}\/dates`, shopArrival\)\}/,
    'the door does not point at /v/<slug>/dates',
  );
});

test('an unchecked year reads as the year alone — never "self-reported" (owner 2026-11-07: "drop it")', () => {
  const LINE = stripComments(readFileSync(join(HERE, '_components', 'shop-since-line.tsx'), 'utf8'));
  assert.doesNotMatch(LINE, /self[- ]reported/i, 'the since line labels an unchecked year again — the ✓ alone marks a checked one');
  assert.match(LINE, /sinceVerified \? \(\s*<BadgeCheck/, 'the ✓ for a DTI-checked year is gone');
});
