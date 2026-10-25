/**
 * 🧭 THE CALMER "COVER YOUR EVENT" HEADER — owner 2026-10-26, verbatim: *"Yes — build the new Suppliers header as
 * shown."* (on `shots-2026-10-25/thumb-room/header-after-{390,1280}.png`).
 *
 *   1  the bar's fill is the covered share — 0…100, never NaN
 *   2  the title row: "Cover your event ⓘ" then the quiet "N of M covered" on its right; the thin bar under it
 *   3  the bench's "Covered N of M" line is not drawn under the calm header (it publishes the count instead)
 *   4  a SETTLED date ('anchored') draws no banner under it; a conflict (every other tone) still does
 *   5  "free that day" is in the ⓘ
 *   6  the count is read, never pressed — no button, no link
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { EXPLORE_INFO_DATE } from '@/lib/explore-info-copy';
import { coverPercent } from './_components/cover-ring';

const read = (p: string) => stripComments(readFileSync(join(__dirname, p), 'utf8'));
const SHELL = read('_components/services-takeover.tsx');
const BENCH = read('_components/shortlist-categories.tsx');
const RING = read('_components/cover-ring.tsx');

test('1 · the bar fills by the covered share', () => {
  assert.equal(coverPercent({ covered: 6, total: 14 }), 43);
  assert.equal(coverPercent({ covered: 14, total: 14 }), 100);
  assert.equal(coverPercent({ covered: 0, total: 0 }), 0);
  assert.equal(coverPercent(null), 0);
  assert.equal(coverPercent({ covered: 9, total: 4 }), 100);
});

test('2 · the title row carries the quiet count on its right, and the bar sits under the title', () => {
  const sec = SHELL.slice(SHELL.indexOf('function ServiceSection('), SHELL.indexOf('function ExploreInfoToggle('));
  assert.ok(sec.length > 0, 'ServiceSection moved — re-anchor');
  const h2 = sec.slice(sec.indexOf('<h2'), sec.indexOf('</h2>'));
  assert.match(h2, /\{showInfo \? <ExploreInfoToggle \/> : null\}[\s{}]*\{showInfo \? <CoverCount \/> : null\}/, 'the count left the title row');
  const after = sec.slice(sec.indexOf('</h2>'), sec.indexOf('</header>'));
  assert.match(after, /\{showInfo \? <CoverBar \/> :/, 'the thin bar is not under the title');
  assert.match(sec, /return showInfo \? <CoverRingProvider>\{section\}<\/CoverRingProvider> : section;/, 'nothing carries the bench’s count up to the title');
  assert.match(RING, /data-cover-count=""[^>]*className="ml-auto /, 'the count is not pushed to the right');
  assert.match(RING, /<Count value=\{ring\.covered\} id="sup-ring-covered" \/> of <Count value=\{ring\.total\} id="sup-ring-total" \/> covered/);
  assert.match(RING, /data-cover-bar=""[\s\S]*?role="progressbar"/);
  assert.match(RING, /h-\[3px\]/, 'the bar is no longer thin');
});

test('3 · under the calm header the bench draws no "Covered N of M" line — it publishes the count', () => {
  assert.match(BENCH, /const coverInHeader = useCoverHeaderOwnsTheCount\(\) && replan;/);
  assert.match(BENCH, /usePublishCoverRing\(ringCovered, stripTiles\.length, coverInHeader\);/, 'the header never hears the count');
  assert.match(
    BENCH,
    /\{replan && stripTiles\.length > 0 && coverInHeader \? null : replan && stripTiles\.length > 0 \? \(\s*<p className="rowsum"/,
    'the "Covered N of M" line draws under the calm header again — the count twice',
  );
});

test('4 · a settled date draws no banner under the calm header; a conflict still does', () => {
  assert.match(
    BENCH,
    /\{convergence && !\(coverInHeader && convergence\.tone === 'anchored'\) \? \(\s*<div className=\{`convrg t-\$\{convergence\.tone\}`\}/,
    'the settled-date banner is back, or a warning tone is hidden with it',
  );
  // Only 'anchored' is hidden — never the conflict, a narrowing build, or "Booking these suppliers sets your date".
  assert.doesNotMatch(BENCH, /convergence\.tone === '(?:conflict|narrowing|converged)'\)\s*\?\s*null/);
});

test('5 · "free that day" lives in the ⓘ', () => {
  assert.match(EXPLORE_INFO_DATE, /free that day/);
  const info = SHELL.slice(SHELL.indexOf('function ExploreInfoToggle('), SHELL.indexOf('function SectionStub('));
  assert.match(info, /\{EXPLORE_INFO_DATE\}/, 'the ⓘ no longer says what the date banner said');
});

test('6 · the count is read, never pressed', () => {
  const count = RING.slice(RING.indexOf('export function CoverCount('), RING.indexOf('export function CoverBar('));
  assert.doesNotMatch(count, /<button|<a\s|onClick|href=/, 'a frame only on what you press — the count is not a control');
});
