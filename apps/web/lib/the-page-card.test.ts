/**
 * the-page-card.test.ts — THE STUDIO PAGES' WORDS (`lib/studio-page-cards.ts`), which the server's page list still reads.
 *
 * 🔁 2026-11-11 (Build 6 Lane F, owner 2026-11-10: *"Studio technically is gone since the pages there will be inside the
 * different scenes it covers"*): the Studio home was the Page card's only user, so both are deleted — the card's render
 * tests (1)(2)(5) and the home's (3) went with them; `lib/no-door-leads-to-the-removed-studio.test.ts` holds that the home
 * stays gone. What is kept is (4), the words, owner 2026-10-08: *"Logo / Topic / Description and a small (i)"*.
 *
 *   (4) THE WORDS — lines that are sentences (never nouns joined by dots), in the house's words.
 *
 * Run: cd apps/web && node --import tsx --test lib/the-page-card.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDIO_PAGE_CARDS } from './studio-page-cards';
import { STUDIO_TILE_KEYS } from './studio-tiles';

test('(4) the words: eleven lines that are sentences — never nouns joined by dots — in the house’s words', () => {
  assert.deepEqual(Object.keys(STUDIO_PAGE_CARDS), [...STUDIO_TILE_KEYS]);
  assert.equal(STUDIO_PAGE_CARDS.story.description, 'How you met, told moment by moment, with photos.');
  for (const key of STUDIO_TILE_KEYS) {
    const c = STUDIO_PAGE_CARDS[key];
    assert.match(c.description, /^[A-Z].*\.$/, `${key}’s line is not a sentence`);
    assert.doesNotMatch(c.description, / · /, `${key}’s line is nouns joined by dots`);
    assert.ok(c.description.length <= 90, `${key}’s line is too long to be one line of a card (${c.description.length})`);
    for (const text of [c.description, c.controls, c.seenAt, c.first]) {
      assert.ok(text.trim().length > 12, `${key} has an empty text`);
      assert.doesNotMatch(text, /\bwebsite\b|\bvendor|\bcelebration/i, `${key} uses a word the house does not (${text})`);
      // A Love Story is told in MOMENTS (owner 2026-10-08) — "chapter" is nowhere on a card or behind its ⓘ.
      assert.doesNotMatch(text, /chapter/i, `${key} says "chapter" (${text})`);
      // Places a guest does not have, and things the app does not do.
      assert.doesNotMatch(text, /Day page|Details page|travels into the bar|programmes|RSVP card|song request/i, `${key} promises something that does not ship (${text})`);
    }
  }
});
