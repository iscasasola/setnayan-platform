/**
 * 📅 SHOP WEBSITE v16 · S5 — CHECK A DATE, ITS EXTRAS, OPENED IN PLACE (owner: "S2–S6 go ahead, one PR each, in order";
 * drawing `prototypes/shop_website_two_looks_2026-11-15/site.src.html` `.leg` · `cadDaySheet` · `pickDate`).
 *
 * The sheet itself shipped with SHOP-02 v7 (`CheckADateSheet`, the shop's `?dates` address); S5 makes every door on the
 * shop page open it IN PLACE with × one step back, and brings the drawing's words for a popular day. Trending (🔥, 10+
 * couples) is ruled (DECISION_LOG 14 Nov, v7) but has no counter on main — it is NOT drawn until one exists.
 * One test per claim; each was sabotaged red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CHECK_DATE_POPULAR } from '@/lib/check-a-date';
import { dayShines } from '@/lib/hot-date';

const WEB = process.cwd();
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SEATS = src('app/v/[slug]/dates/_components/seat-months.tsx');
const CAL = src('app/v/[slug]/dates/_components/check-a-date-calendar.tsx');
const LINK = src('app/v/[slug]/_components/check-a-date-link.tsx');
const SIDE = src('app/v/[slug]/_components/shop-side-card.tsx');

// Sabotage: type "Popular" back into the legend → red.
test('the legend says the drawing’s "Popular day", from the one word', () => {
  assert.equal(CHECK_DATE_POPULAR, 'Popular day');
  assert.match(SEATS, /✦\s*<\/span>\s*\{CHECK_DATE_POPULAR\}\s*<\/li>/);
  assert.doesNotMatch(SEATS, />\s*Popular\s*</, 'a typed "Popular" in the legend');
});

// Sabotage: show the chip on every day / outside the Available sheet / drop dayShines → red.
test('a tapped popular day says "✦ Popular day" beside Available — from the shipped hot-date rule only', () => {
  const at = CAL.indexOf('data-check-date-state="available"');
  assert.ok(at > 0, 'the Available day sheet is gone');
  const after = CAL.slice(at, at + 900);
  assert.match(after, /\{day && dayShines\(day\) \? \(\s*<span[^>]*data-check-date-popular=""[^>]*>\s*✦ \{CHECK_DATE_POPULAR\}\s*<\/span>\s*\) : null\}/);
  assert.equal((CAL.match(/data-check-date-popular=""/g) ?? []).length, 1, 'the popular chip appears outside the Available sheet');
  assert.ok(dayShines('2026-12-12') && !dayShines('2026-07-07'), 'premise: the shipped rule shines a December Saturday, not a July Tuesday');
});

// Sabotage: a plain <a href={datesHref}> again, drop scroll={false} or the note → red.
test('every door on the shop page opens Check a date IN PLACE, with × one step back onto the shop', () => {
  assert.match(LINK, /export function noteDatesFromShop\(\): void \{\s*try \{\s*window\.sessionStorage\.setItem\(DATES_FROM_SHOP_KEY, window\.location\.pathname\);/);
  assert.match(LINK, /<Link\s+href=\{href\}\s+scroll=\{false\}\s+onClick=\{noteDatesFromShop\}/);
  assert.match(SIDE, /<Link\s+href=\{datesHref\}\s+scroll=\{false\}\s+onClick=\{noteDatesFromShop\}[^>]*data-side-card-every-month=""/);
  assert.match(SIDE, /onPick=\{\(d\) => \{\s*noteDatesFromShop\(\);\s*router\.push\(`\$\{datesHref\}&d=\$\{d\}`, \{ scroll: false \}\);/);
  assert.doesNotMatch(SIDE, /<a\s+href=\{datesHref\}/, 'a door that reloads the page instead of rising over it');
});

// Sabotage: draw a 🔥 / "Trending" with no counter behind it → red.
test('Trending (🔥 10+ couples) is not drawn until its counter exists — never a guessed demand mark', () => {
  for (const [name, code] of [['legend', SEATS], ['calendar', CAL], ['side card', SIDE]] as const) {
    assert.doesNotMatch(code, /🔥|Trending/i, `the ${name} draws a trending mark with no counter behind it`);
  }
});
