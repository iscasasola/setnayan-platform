/**
 * 💗 A LIKED PHOTO SAYS ONLY WHAT IS TRUE (controller pre-ship audit of #7562, 2026-11-13).
 *
 *  1. A photo from a REAL shop whose name could not be read is never labelled "Community photo" — that would tell the
 *     couple a supplier's gallery photo came from nobody. It says the supplier could not be loaded, and keeps
 *     "Find who does this ›".
 *  2. "From <shop> · <card> ›" opens the card the photo was FILED UNDER — never the shop's other saved card.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { FIND_INSPIRATION_WORDS as W, likedCardFor, likedSourceWord } from '@/lib/find-inspiration';

test('a real shop with an unreadable name is not a community photo', () => {
  assert.equal(likedSourceWord({ vendorProfileId: 'shop-1' }), W.sourceUnread);
  assert.notEqual(likedSourceWord({ vendorProfileId: 'shop-1' }), W.community);
  assert.equal(likedSourceWord({ vendorProfileId: null }), W.community);
});

test('the strip draws the honest word, not the community word, and keeps "Find who does this"', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/vendors/_components/find-inspiration.tsx'), 'utf8'),
  );
  assert.doesNotMatch(src, /\{W\.community\}/, 'the source line hard-codes "Community photo" again');
  assert.match(src, /\{likedSourceWord\(p\)\}/);
  assert.match(src, /\{W\.findWho\} ›/);
});

test("a liked photo opens its OWN card, never the shop's other saved card", () => {
  const fullBuffet = { serviceId: 'svc-buffet', name: 'Full buffet' };
  assert.equal(likedCardFor('svc-grazing', fullBuffet), null, 'opened Full buffet for a Grazing table photo');
  assert.equal(likedCardFor('svc-buffet', fullBuffet), fullBuffet);
  assert.equal(likedCardFor(null, fullBuffet), fullBuffet, 'a photo that names no card keeps the saved card');
  assert.equal(likedCardFor('svc-buffet', null), null);
});

test('Find routes the liked-photo door through likedCardFor with the photo\'s own card id', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8'),
  );
  assert.match(src, /card: likedCardFor\(p\.serviceId, /);
  const cards = stripComments(readFileSync(join(process.cwd(), 'lib/bench-service-cards.ts'), 'utf8'));
  assert.match(cards, /serviceId: row\.vendor_service_id,/, 'a bench card must carry its own id to be matched');
});
