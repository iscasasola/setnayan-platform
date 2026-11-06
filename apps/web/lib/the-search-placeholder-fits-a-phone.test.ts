/**
 * the-search-placeholder-fits-a-phone.test.ts — the public search box's words are not cut off on a phone.
 *
 * ── THE DEFECT (live check 2026-10-23, `home__cr375.png`) ──────────────────
 * The front-door box read "Search suppliers, stories and guid…" at 375 px. On a touch screen the input is
 * 16 px (smaller and iOS zooms the page on focus — so the fix is never a smaller font), and at 16 px the
 * sentence needed ~262 px of a box that holds 255 at 375 and 200 at 320.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 * The derived placeholder stays within the 320 px box. A unit test cannot load the font, so the budget is in
 * characters, set from the measurement: 200 px of room at 320 / 16 px; "Suppliers, stories, guides" (26
 * characters) measured 182 px in Chromium and WebKit. Re-measure before raising it: on a 320×800 touch page
 * (`hasTouch`), read the visible `.fd-searchbox input`'s clientWidth minus its padding, and the width of a
 * hidden span carrying the input's computed `font` with the candidate text — both engines.
 *
 * SABOTAGE: make publicSearchPlaceholder() return `Search ${…} and ${last}` again (36 characters) → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_SEARCH_NOUNS, publicSearchPlaceholder } from './public-search-nouns';

const BUDGET_CHARS = 26;

test('the placeholder fits the 320 px box', () => {
  const words = publicSearchPlaceholder();
  assert.ok(
    words.length <= BUDGET_CHARS,
    `"${words}" is ${words.length} characters; the 320 px box shows about ${BUDGET_CHARS} at the 16 px touch size. ` +
      'Shorten the words, never the font (iOS zooms an input under 16 px).',
  );
});

test('and still promises every noun', () => {
  const words = publicSearchPlaceholder().toLowerCase();
  for (const noun of PUBLIC_SEARCH_NOUNS) assert.ok(words.includes(noun), `the placeholder dropped "${noun}"`);
});
