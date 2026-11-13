/**
 * The person page moves around simply — and says only what is true (owner 13 Nov 2026, DECISION_LOG
 * "THREE PUBLIC PAGES APPROVED" · "SIMPLER TO MOVE AROUND" · "EVENT COVERS SAY THE EVENT NAME ONLY, NO DATE";
 * prototype `public_pages_three_2026-11-13`, Person frame).
 *
 * Three promises, each easy to break by a well-meaning edit that every other suite would pass:
 *   1. "N events" counts PUBLIC events only — the ones the Events section draws — and never prints 0.
 *   2. An event cover prints the event's NAME and kind, never its date.
 *   3. The section bar has a tab ONLY for a section the page drew — "Partnered with" vanishes with its section.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { coverChipLabel, posterKindLabel } from '@/lib/celebration-poster-words';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const PAGE = read('app/u/[userSlug]/page.tsx');
const BAR = read('app/u/_components/section-bar.tsx');
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

test('1 · "N events" counts the public events the page lists, and only when there are some', () => {
  // `listed` is built from `publicWebsiteEvents` alone — the public gate in lib/public-profile.ts.
  assert.match(PAGE, /const \{ user, publicWebsiteEvents \} = resolved;/);
  assert.match(PAGE, /const ongoing = publicWebsiteEvents\.filter\(/);
  assert.match(PAGE, /const listed = ongoing\.length >= 2 \? ongoing : publicWebsiteEvents;/);
  assert.match(PAGE, /const publicEventCount = listed\.length;/, 'the events count is no longer what the Events section draws');
  assert.equal(count(PAGE, /publicEventCount = /), 1, 'a second source for the events count');
  // Never "0 events": the events read swallows an error to [], so zero cannot be told from a refused read.
  assert.match(PAGE, /\{publicEventCount > 0 \? \(\s*<span className="uprof-stat" data-uprof-events-count="">/);
  assert.doesNotMatch(PAGE, /from\('events'\)/, 'the page reads events itself — count only what the public gate passed');
});

test('2 · a cover says the event name and kind — never a date', () => {
  // The renderer reads the date only for the sash's honesty rule; nothing date-shaped reaches the markup.
  assert.doesNotMatch(PAGE, /whenLines/, 'the cover date block is back');
  assert.doesNotMatch(PAGE, /\{when\.(date|weekday)\}/, 'a cover prints the date again');
  assert.doesNotMatch(PAGE, /uprof-(when|wd|dt)\b/, 'the cover date styles are back');
  assert.match(PAGE, /const chip = coverChipLabel\(event\.event_type, section, index, Boolean\(when\.date\)\);/);
  assert.match(PAGE, /<span className="uprof-kind" data-cover-chip="">\s*\{chip\}\s*<\/span>/);

  assert.equal(posterKindLabel('wedding'), 'Wedding');
  assert.equal(posterKindLabel('gender_reveal'), 'Gender reveal');
  assert.equal(posterKindLabel(null), null);
  assert.equal(posterKindLabel('unspecified'), null, 'an unknown kind printed a guess');
  assert.equal(coverChipLabel('wedding', 'coming-up', 0, true), 'Wedding · Up next');
  assert.equal(coverChipLabel('birthday', 'coming-up', 1, true), 'Birthday · Coming soon');
  assert.equal(coverChipLabel('wedding', 'coming-up', 0, false), 'Wedding', 'an undated celebration was called "Up next"');
  assert.equal(coverChipLabel('reunion', 'past', 0, true), 'Reunion');
  for (const chip of [coverChipLabel('wedding', 'coming-up', 0, true), coverChipLabel('debut', 'past', 3, true)]) {
    assert.doesNotMatch(chip ?? '', /\d/, 'a cover chip carries a number — a date has crept in');
  }
});

test('3 · each tab exists only with its section — "Partnered with" stays storyteller-only', () => {
  // Partners are read only for a profile with chapters (shipped rule), and the tab and the section share one gate.
  assert.match(PAGE, /const influenceVendors: CreatorInfluenceVendor\[\] = hasChapters\s*\? await fetchCreatorInfluence\(user\.user_id\)\s*: \[\];/);
  assert.match(PAGE, /const hasPartners = influenceVendors\.length > 0;/);
  assert.match(PAGE, /\.\.\.\(hasPartners \? \[\{ id: 'u-partnered', label: 'Partnered with' \}\] : \[\]\)/);
  assert.match(PAGE, /\{hasPartners \? \(\s*<CreatorInfluence vendors=\{influenceVendors\} \/>/);
  assert.match(PAGE, /\.\.\.\(hasChapters \? \[\{ id: 'u-chapters', label: 'Chapters' \}\] : \[\]\)/);
  assert.match(PAGE, /\{hasChapters \? \(\s*<section id="u-chapters"/);
  assert.match(PAGE, /\.\.\.\(hasEvents \? \[\{ id: 'u-events', label: 'Events' \}\] : \[\]\)/);
  assert.match(PAGE, /\{hasEvents \? \(\s*<section id="u-events"/);
  // Every tab id is a section id the page draws, exactly once.
  for (const id of ['u-events', 'u-chapters', 'u-partnered']) {
    assert.equal(count(PAGE, new RegExp(`<section id="${id}"`)), 1, `${id}: the tab points at no section (or two)`);
  }
  assert.equal(count(PAGE, /<SectionBar tabs=\{sectionTabs\} \/>/), 1);
  // Never offer terms on the public page.
  assert.doesNotMatch(PAGE, /discount_pct|offer_terms|\.terms\b/);
});

test('4 · the bar jumps without writing history, and respects reduced motion', () => {
  assert.doesNotMatch(BAR, /history\.|location\.hash\s*=|localStorage|sessionStorage|router\.push/);
  assert.match(BAR, /href=\{`#\$\{t\.id\}`\}/, 'the tabs are no longer real anchors (no-JS jump)');
  assert.match(BAR, /prefers-reduced-motion: reduce/);
  assert.match(BAR, /\{ passive: true \}/);
  assert.match(PAGE, /@media \(prefers-reduced-motion: reduce\) \{ \.uprof-inner \{ animation: none; \} \}/);
});
