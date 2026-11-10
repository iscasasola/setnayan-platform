/**
 * 🃏 SERVICE CARD GROWN (Build 5 Lane C; owner-approved prototype `service-card-maker.html` @ 8391e487 — DECISION_LOG
 * 2026-11-10 "FACTS FIRST, MEDIA LAST" · "SECTION ROWS PIN AS YOU SCROLL" · "SERVICE CARD GROWN — PROTOTYPE APPROVED";
 * HOUSE_TEMPLATES T4 + T8, which listed both as NO GUARD).
 *
 * The shop page's card tap no longer opens a bottom sheet: it RISES full screen from the card's own box, its cover
 * becomes the hero, facts come first and media last, and one section head pins at a time under the bar. Source-level,
 * like the gallery's other guards (`service-details-dark.test.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../../lib/strip-comments';

const HERE = __dirname;
const SHEET = readFileSync(join(HERE, 'service-details-sheet.tsx'), 'utf8');
const GALLERY = readFileSync(join(HERE, 'services-gallery.tsx'), 'utf8');
const VIEW = readFileSync(join(HERE, '../../../_components/service-card-view.tsx'), 'utf8');

const ORDER = [...(SHEET.match(/GROWN_SECTION_ORDER = \[([^\]]+)\] as const/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

test('facts first, media last — the approved order', () => {
  assert.deepEqual(ORDER, ['included', 'not', 'serves', 'record', 'reviews', 'photos', 'clip', 'inspiration']);
  // …and the sections are PUSHED in that order (the array the body maps over).
  const pushed = [...SHEET.matchAll(/sections\.push\(\{\s*key: '([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(pushed, ORDER, 'a section moved — media must stay at the bottom');
});

test('it rises full screen from the tapped card, on <body>, and the bars step away', () => {
  assert.match(SHEET, /import \{ riseFromRect \} from '@\/lib\/rise-motion';/, 'the one rise, not a hand-rolled motion');
  assert.match(SHEET, /riseFromRect\(el, from\.getBoundingClientRect\(\)\);/, 'the open rise from the card');
  assert.match(SHEET, /riseFromRect\(el, from\.getBoundingClientRect\(\), \{ reverse: true \}\)/, '✕ must fall back into the card');
  assert.match(SHEET, /useChromeAway\(true\);/);
  assert.match(SHEET, /return host \? createPortal\(layer, host\) : null;/, 'drawn inside the page again');
  assert.match(SHEET, /className="fixed inset-0 z-50 flex h-\[100dvh\] flex-col/, 'full screen, never a bottom sheet');
  assert.doesNotMatch(SHEET, /rounded-t-3xl|max-h-\[90vh\]/, 'the old bottom-sheet frame is back');
  // The card hands its own box to the gallery, the gallery hands it to the grown card.
  assert.match(VIEW, /onClick=\{\(e\) => onOpen\?\.\(e\.currentTarget\.parentElement\)\}/);
  assert.match(GALLERY, /from=\{originRef\.current\}/);
});

test('📌 one section head pins at a time under the bar, and a tap glides to its top', () => {
  // Each section WRAPS its own head — that is what lets the next head push the previous one out.
  assert.match(SHEET, /<section key=\{s\.key\} data-grown-sec=\{s\.key\}[\s\S]{0,400}?<button[\s\S]{0,80}?onClick=\{\(\) => glide\(s\.key\)\}[\s\S]{0,80}?className="sticky /);
  assert.match(SHEET, /top: GROWN_BAR_PX,/, 'the heads pin right under the bar');
  assert.match(SHEET, /behavior: reduceMotion\(\) \? 'auto' : 'smooth'/, 'reduced motion must jump, never slide');
  // The bar turns solid and carries the title once the hero has scrolled away.
  assert.match(SHEET, /setPinned\(sc\.scrollTop > \(hero \? hero\.offsetHeight : 0\) - GROWN_BAR_PX\)/);
});

test('the Setnayan exclusive never reaches the grown card', () => {
  const code = stripComments(SHEET);
  assert.doesNotMatch(code, /exclusive_perk|exclusivePerk|hasExclusive/);
});
