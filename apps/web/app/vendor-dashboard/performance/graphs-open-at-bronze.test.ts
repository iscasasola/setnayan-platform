/**
 * graphs-open-at-bronze.test.ts — J5 on the page (badge-unlock_v6). The adapter's rules are executed in
 * lib/graph-unlocks.test.ts and the reads in tests/db/graphs-open-at-bronze.db.test.ts; this holds the WIRING:
 *   1 · a graph its badge has not opened is never drawn — skipped before the one card builder, no greyed card;
 *   2 · each shut badge leaves ONE plain line under the carousel, from the adapter's own words;
 *   3 · the section decides on the server from the one unlock read, passes the decision down, and reads the gifts
 *       graph only once Gifts given Bronze has OPENED it (never on "we couldn't tell").
 * Each assertion was broken on purpose and went red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const CAROUSEL = read('_components/analytics-carousel.tsx');
const SECTION = read('_components/one-analytics-section.tsx');

test('1 · a hidden graph is skipped before the one card builder — never drawn, never greyed', () => {
  const skip = CAROUSEL.indexOf('if (hidden.has(k)) continue;');
  const build = CAROUSEL.indexOf('const g = specs[winOf(k)][k as GraphKey];');
  assert.ok(skip > 0, 'the carousel no longer skips a graph its badge has not opened');
  assert.ok(build > skip, 'the skip must come before the card is built');
  assert.match(CAROUSEL, /const hidden = useMemo\(\(\) => new Set\(props\.unlocks\?\.hidden \?\? \[\]\), \[props\.unlocks\]\);/);
});

test('2 · each shut badge leaves one plain line under the carousel, in the drawing’s words; an unread one says Couldn’t load', () => {
  const carousel = CAROUSEL.indexOf('<SnapCarousel');
  const lines = CAROUSEL.indexOf('data-graph-unlock-lines');
  assert.ok(lines > carousel, 'the lines must sit under the carousel, where the graphs would be');
  assert.match(CAROUSEL, /\(props\.unlocks\?\.locked \?\? \[\]\)\.flatMap\(\(l\) => \{\s*const line = lockedLine\(l\);/, 'the line is the adapter’s lockedLine, never words of the page’s own');
  assert.match(CAROUSEL, /<p className="font-semibold text-ink">\{LOCKED_HEAD\}<\/p>/, 'the drawing’s head');
  assert.match(CAROUSEL, /\(props\.unlocks\?\.unsure \?\? \[\]\)[\s\S]{0,160}COULDNT_LOAD/, 'a badge we could not read says Couldn’t load');
});

test('3 · decided on the server from the one unlock read; the gifts graph is read only once its badge opened it', () => {
  assert.match(SECTION, /const unlockRead = safeRead\(readGraphUnlockFacts\(bookingsAdmin, profile\.vendor_profile_id\), null, 'graph_unlocks'\);/);
  assert.match(SECTION, /const unlocks = graphUnlocks\(facts\);/);
  assert.match(SECTION, /const giftsOpen = badgeGate\('gifts_given', facts\) === 'open';/, 'the gifts graph must wait for OPEN, not "not locked"');
  assert.match(SECTION, /const \[gifts30, gifts12, giftExamples\] = giftsOpen\s*\?/, 'the gifts read must run only when the badge opened it');
  assert.match(SECTION, /unlocks=\{\{ hidden: \[\.\.\.unlocks\.hidden\], locked: unlocks\.locked, unsure: unlocks\.unsure \}\}/);
  // The counts are main's own counters — no second count (the audit removed one).
  assert.match(SECTION, /readFiveStarCount\(bookingsAdmin, profile\.vendor_profile_id\)/);
  assert.match(SECTION, /readGiftPoints\(bookingsAdmin, profile\.vendor_profile_id\)/);
  // Trusted by opens no graph yet (BADGE_GRAPHS.trusted_by = []), so its count is not read on every load.
  assert.doesNotMatch(SECTION, /shop_trusted_by_count/);
  assert.doesNotMatch(SECTION, /trustedBy: unlockFacts|unlockFacts\.trustedBy/);
  assert.match(SECTION, /gifts=\{giftsOpen \? \{ '30': gifts30, '12': gifts12 \} : null\}/);
  // The unlock read sits AFTER the Verified lock's early return — an unverified shop reads none of it.
  assert.ok(SECTION.indexOf('const unlockRead') > SECTION.indexOf("canUse('analytics'"), 'an unverified shop must not run the unlock read');
});

test('4 · Invites is not counted yet: the section hands the carousel no Invites data, so its card is never drawn', () => {
  assert.doesNotMatch(SECTION, /\binvites=\{/, 'Invites data reached the carousel before anything records an import');
  assert.match(CAROUSEL, /invites: props\.invites !== undefined \? invitesSpec\(props\.invites\) : null/);
});
