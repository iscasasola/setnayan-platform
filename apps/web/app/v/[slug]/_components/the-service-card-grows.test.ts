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
// 2026-11-12 ONE SERVICE CARD: the card's door is the face's client button — that is where the tapped box is handed on.
const VIEW = readFileSync(join(HERE, '../../../_components/service-face-door.tsx'), 'utf8');

const ORDER = [...(SHEET.match(/GROWN_SECTION_ORDER = \[([^\]]+)\] as const/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

test('facts first, media last — the approved order', () => {
  assert.deepEqual(ORDER, ['included', 'not', 'serves', 'record', 'reviews', 'events', 'photos', 'clip', 'inspiration']);
  // …and the sections are PUSHED in that order (the array the body maps over).
  const pushed = [...SHEET.matchAll(/sections\.push\(\{\s*key: '([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(pushed, ORDER, 'a section moved — media must stay at the bottom');
});

test('it rises full screen from the tapped card, on <body>, and the bars step away', () => {
  assert.match(SHEET, /import \{[^}]*\briseFromRect\b[^}]*\} from '@\/lib\/rise-motion';/, 'the one rise, not a hand-rolled motion');
  assert.match(SHEET, /riseFromRect\(el, from\.getBoundingClientRect\(\)\);/, 'the open rise from the card');
  assert.match(SHEET, /riseFromRect\(el, from\.getBoundingClientRect\(\), \{ reverse: true \}\)/, '✕ must fall back into the card');
  assert.match(SHEET, /useChromeAway\(true\);/);
  assert.match(SHEET, /return host \? createPortal\(layer, host\) : null;/, 'drawn inside the page again');
  assert.match(SHEET, /className="fixed inset-0 z-50 flex h-\[100dvh\] flex-col/, 'full screen, never a bottom sheet');
  assert.doesNotMatch(SHEET, /rounded-t-3xl|max-h-\[90vh\]/, 'the old bottom-sheet frame is back');
  // The card hands its own box to the gallery, the gallery hands it to the grown card.
  assert.match(VIEW, /onClick=\{\(e\) => onOpen\(e\.currentTarget\.parentElement\)\}/);
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

test('⤴ ruling 5976 — the hero morphs out of the tapped cover over the house 0.7 s; reduced motion never moves it', () => {
  const code = stripComments(SHEET);
  assert.match(code, /heroClipFrom\(hero\.getBoundingClientRect\(\), cover\.getBoundingClientRect\(\), card\.getBoundingClientRect\(\), el\.getBoundingClientRect\(\)\)/);
  assert.match(code, /duration: RISE_MS,\s*easing: RISE_EASE,/, 'the morph runs on the rise\'s own clock, never a typed duration');
  assert.doesNotMatch(code, /duration: 520|520\s*ms/, 'the prototype\'s 520 ms was overruled by "0.7s"');
  assert.match(code, /if \(!el \|\| !hero \|\| !cover \|\| reduceMotion\(\)/, 'reduced motion: the clip stays still (the layer crossfades)');
  assert.match(code, /morphHero\(from, false\);\s*riseFromRect\(el, from\.getBoundingClientRect\(\)\);/, 'measured BEFORE the rise transforms the layer');
  assert.match(code, /morphHero\(from, true\);/, '✕ closes the hero back into the cover');
  // The face marks its cover so the morph can find it.
  const FACE = readFileSync(join(HERE, '../../../_components/service-face.tsx'), 'utf8');
  assert.match(FACE, /data-service-face-cover=""/);
  // The hero plays the card's photos — the face's own cover show (#7532), not a second slideshow.
  assert.match(code, /<ServiceFaceCoverShow photos=\{heroShow\} \/>/);
});

test('🃏 ruling 5970 — hide per card, 👁 Couple view and the opens are the SHOP\'s only; couples get the card without the hidden', () => {
  const code = stripComments(SHEET);
  // The eye is drawn only for the shop.
  assert.match(code, /\{owner \? \(\s*<button[\s\S]{0,200}?onClick=\{\(\) => setCoupleView\(\(v\) => !v\)\}/);
  // Curating = the shop, not in the couple view; everyone else leaves a hidden item OUT.
  assert.match(code, /const curating = owner !== null && !coupleView;/);
  assert.match(code, /const leftOut = \(key: string \| null\) => !curating && isHidden\(key\);/);
  assert.match(code, /owner \? owner\.hidden\.has\(key\) : \(c\.hiddenOnCard \?\? \[\]\)\.includes\(key\)/);
  // The greyed words, exactly.
  assert.match(code, /Hidden on this card\n/);
  // The opens have no hide: drawn for the shop in BOTH views, and a failed read never reads as zero.
  assert.match(code, /owner\.opens === null\s*\? 'Opens couldn’t load'/);
  // Reviews are never a hidable.
  assert.doesNotMatch(code, /hidable\([^)]*review/i);
});

test('📅 events show WITHOUT names — the record\'s anonymised lines, drawn once', () => {
  const code = stripComments(SHEET);
  assert.match(code, /c\.record\?\.ledger \?\? \[\]/, 'Events read the floored, anonymised ledger — never a new event read');
  assert.match(code, /record=\{\{ \.\.\.c\.record, ledger: \[\] \}\}/, 'the ledger is not drawn twice');
  assert.doesNotMatch(code, /display_name|couple_display_name|event_id/, 'no name or event id reaches the grown card');
});
