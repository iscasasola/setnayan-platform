/**
 * 🧭 THE CALMER "COVER YOUR EVENT" HEADER — owner 2026-10-26, verbatim: *"Yes — build the new Suppliers header as
 * shown."* (on `shots-2026-10-25/thumb-room/header-after-{390,1280}.png`).
 *
 *   1  the bar's fill is the covered share — 0…100, never NaN
 *   2  ⟳ OVERTURNED 2026-11-12 (owner, the organized-Find prototype, "Yes, build it"): the "Cover your event" block
 *      folds into the PINNED ROW — "N of M covered" beside Find ▾ ("nothing added yet" with nothing listed) and the
 *      thin bar along the row's foot. The heading stays for a screen reader only; no ⓘ on the row.
 *   3  the bench's "Covered N of M" line is not drawn under the calm header (it publishes the count instead)
 *   4  a SETTLED date ('anchored') draws no banner under it; a conflict (every other tone) still does
 *   5  ⟳ (2026-11-12) the page-level ⓘ left with the header; the words stay in lib/explore-info-copy.ts
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

test('2 · (2026-11-12) the count sits in the pinned row beside Find ▾, the bar along its foot; the header is for a screen reader', () => {
  const at = SHELL.indexOf('data-suppliers-stick=""');
  const row = SHELL.slice(SHELL.lastIndexOf('<div', at), SHELL.indexOf('<MenuSettingsButton', at));
  assert.match(SHELL, /mode === 'find' \? \(\s*<CoverCount \/>/, 'Find’s count is not the row’s count');
  assert.match(row, /\{mode === 'find' \? <CoverBar \/> : null\}/, 'the bar is not along the pinned row');
  assert.match(SHELL, /<CoverRingProvider>\s*<section ref=\{rootRef\}/, 'the row cannot hear the bench’s count');
  const sec = SHELL.slice(SHELL.indexOf('function ServiceSection('), SHELL.indexOf('function SectionStub('));
  assert.match(sec, /<header className=\{folded \? 'sr-only' : 'mb-4'\}>/, 'the folded header is drawn on the page again');
  assert.doesNotMatch(sec, /<CoverCount|<CoverBar|<Explain/, 'the old header block is back — the count twice');
  assert.match(RING, /<Count value=\{ring\.covered\} id="sup-ring-covered" \/> of <Count value=\{ring\.total\} id="sup-ring-total" \/>/);
  assert.match(RING, /COVER_NOTHING_YET = 'nothing added yet'/);
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
    // 🔔 Since the one notice system (14 Nov 2026) the banner is a live notice drawn where it stands.
    /\{convergence && !\(coverInHeader && convergence\.tone === 'anchored'\) \? \(\s*(?:\/\/[^\n]*\n\s*)*<InlineNotice\s+kind="live"/,
    'the settled-date banner is back, or a warning tone is hidden with it',
  );
  // Only 'anchored' is hidden — never the conflict, a narrowing build, or "Booking these suppliers sets your date".
  assert.doesNotMatch(BENCH, /convergence\.tone === '(?:conflict|narrowing|converged)'\)\s*\?\s*null/);
});

test('5 · (2026-11-12) the ⓘ words stay one place — "free that day" is still said in the copy module', () => {
  assert.match(EXPLORE_INFO_DATE, /free that day/);
});

test('6 · the count is read, never pressed', () => {
  const count = RING.slice(RING.indexOf('export function CoverCount('), RING.indexOf('export function CoverBar('));
  assert.doesNotMatch(count, /<button|<a\s|onClick|href=/, 'a frame only on what you press — the count is not a control');
});
