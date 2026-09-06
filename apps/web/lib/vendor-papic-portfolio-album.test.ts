/**
 * What a supplier's PRIVATE portfolio album shows — never the host's, never a
 * capture. Every rule is pinned the same way vendor-own-captures.test.ts pins
 * its own gallery, so the two never drift onto the same visibility bar by
 * accident.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  portfolioAlbumSummary,
  portfolioCreditsSpent,
  visiblePortfolioPhotos,
} from './vendor-papic-portfolio-album';

const row = (over: Partial<Parameters<typeof visiblePortfolioPhotos>[0][number]> = {}) => ({
  photo_id: 'p1',
  event_id: 'e1',
  r2_object_key: 'papic/vendor-v/portfolio/e1/p1.jpg',
  credits_spent: 1,
  created_at: '2026-12-12T14:00:00.000Z',
  hidden_at: null,
  nsfw_checked: true,
  ...over,
});

test('an unscreened import is shown to nobody — not even the supplier who imported it', () => {
  assert.equal(visiblePortfolioPhotos([row({ nsfw_checked: false })]).length, 0);
  assert.equal(visiblePortfolioPhotos([row({ nsfw_checked: null })]).length, 0);
});

test('a taken-down photo leaves the album', () => {
  assert.equal(visiblePortfolioPhotos([row({ hidden_at: '2026-12-13T00:00:00Z' })]).length, 0);
});

test('a row with no object key is skipped rather than tiled blank', () => {
  assert.equal(visiblePortfolioPhotos([row({ r2_object_key: null })]).length, 0);
});

test('a good import comes through with its key and credit cost', () => {
  const [p] = visiblePortfolioPhotos([row()]);
  assert.equal(p?.r2Key, 'papic/vendor-v/portfolio/e1/p1.jpg');
  assert.equal(p?.creditsSpent, 1);
  assert.equal(p?.eventId, 'e1');
});

test('a garbled credits_spent never reads as free or negative', () => {
  const [zero] = visiblePortfolioPhotos([row({ credits_spent: 0 })]);
  const [neg] = visiblePortfolioPhotos([row({ credits_spent: -5 })]);
  const [nan] = visiblePortfolioPhotos([row({ credits_spent: Number.NaN })]);
  assert.equal(zero?.creditsSpent, 1);
  assert.equal(neg?.creditsSpent, 1);
  assert.equal(nan?.creditsSpent, 1);
});

test('the summary counts what is SHOWN, not what was fetched', () => {
  const photos = visiblePortfolioPhotos([
    row({ photo_id: 'a' }),
    row({ photo_id: 'b' }),
    row({ photo_id: 'hidden', hidden_at: '2026-12-13T00:00:00Z' }),
    row({ photo_id: 'unscreened', nsfw_checked: false }),
  ]);
  assert.equal(portfolioAlbumSummary(photos), '2 photos');
});

test('an empty album says so plainly instead of showing a zero', () => {
  assert.equal(portfolioAlbumSummary([]), 'Nothing imported yet.');
});

test('singulars read as singulars', () => {
  assert.equal(portfolioAlbumSummary(visiblePortfolioPhotos([row()])), '1 photo');
});

test('a taken-down import does not count toward spend', () => {
  // Mirrors fetchVendorPapicPointsSpent's `.is('hidden_at', null)` filter on
  // vendor_papic_captures — both spend readers feed one "left" total, so a
  // hidden row must agree on both sides about whether it still counts.
  const spent = portfolioCreditsSpent([
    { credits_spent: 1, hidden_at: null },
    { credits_spent: 1, hidden_at: null },
    { credits_spent: 1, hidden_at: '2026-12-13T00:00:00Z' },
  ]);
  assert.equal(spent, 2, 'a hidden row does not count toward spend, same as a hidden capture');
});

test('spend on an empty ledger is zero, not a garbled default', () => {
  assert.equal(portfolioCreditsSpent([]), 0);
});
