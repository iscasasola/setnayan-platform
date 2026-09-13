/**
 * Unit suite for the FREE first-venue-shortlist carve-out
 * (owner-locked 2026-07-09 · Pricing.md § 00).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAI_FREE_ASSIST_CATEGORIES,
  SAI_FREE_ASSIST_PLAN_GROUP_IDS,
  FIRST_VENUE_SHORTLIST_CAP,
  isSaiAssistFreeForCategory,
  isSaiAssistFreeForPlanGroup,
  isSaiAssistFreeDecisionId,
  isFirstVenueShortlistOfferAvailable,
  freeVenueAssistBenchHref,
  firstVenueShortlistConfirmation,
  FIRST_VENUE_SHORTLIST_UPSELL,
} from './setnayan-ai-free-assist';

test('the free category set is exactly the reception venue', () => {
  assert.deepEqual([...SAI_FREE_ASSIST_CATEGORIES], ['venue']);
});

test('isSaiAssistFreeForCategory: venue is free, everything else is gated', () => {
  assert.equal(isSaiAssistFreeForCategory('venue'), true);
  // The ceremony side must stay gated (disjoint categories by design).
  assert.equal(isSaiAssistFreeForCategory('religious_venue'), false);
  assert.equal(isSaiAssistFreeForCategory('church_fees'), false);
  assert.equal(isSaiAssistFreeForCategory('catering'), false);
  assert.equal(isSaiAssistFreeForCategory('photographer'), false);
  assert.equal(isSaiAssistFreeForCategory(null), false);
  assert.equal(isSaiAssistFreeForCategory(undefined), false);
  assert.equal(isSaiAssistFreeForCategory(''), false);
});

test('plan-group derivation resolves to exactly reception_venue', () => {
  assert.deepEqual([...SAI_FREE_ASSIST_PLAN_GROUP_IDS], ['reception_venue']);
  assert.equal(isSaiAssistFreeForPlanGroup('reception_venue'), true);
  assert.equal(isSaiAssistFreeForPlanGroup('ceremony_venue'), false);
  assert.equal(isSaiAssistFreeForPlanGroup('catering'), false);
  assert.equal(isSaiAssistFreeForPlanGroup(null), false);
});

test('cockpit decision ids: pick/start on reception_venue only', () => {
  assert.equal(isSaiAssistFreeDecisionId('pick:reception_venue'), true);
  assert.equal(isSaiAssistFreeDecisionId('start:reception_venue'), true);
  assert.equal(isSaiAssistFreeDecisionId('pick:ceremony_venue'), false);
  assert.equal(isSaiAssistFreeDecisionId('start:catering'), false);
  assert.equal(isSaiAssistFreeDecisionId('role:principal_sponsors'), false);
  assert.equal(isSaiAssistFreeDecisionId('pay:abc123'), false);
  assert.equal(isSaiAssistFreeDecisionId('reception_venue'), false);
  assert.equal(isSaiAssistFreeDecisionId(':reception_venue'), false);
  assert.equal(isSaiAssistFreeDecisionId(''), false);
  assert.equal(isSaiAssistFreeDecisionId(null), false);
});

test('offer visibility: empty venue shortlist ⇒ offered', () => {
  assert.equal(isFirstVenueShortlistOfferAvailable([]), true);
  // Non-venue picks do NOT consume the offer.
  assert.equal(
    isFirstVenueShortlistOfferAvailable([
      { category: 'catering' },
      { category: 'religious_venue' },
      { category: 'photographer' },
    ]),
    true,
  );
});

test('offer visibility: ANY venue pick — Sai-built or manual — consumes it', () => {
  assert.equal(
    isFirstVenueShortlistOfferAvailable([{ category: 'venue' }]),
    false,
  );
  assert.equal(
    isFirstVenueShortlistOfferAvailable([
      { category: 'catering' },
      { category: 'venue' },
    ]),
    false,
  );
});

test('the shortlist cap is 5', () => {
  assert.equal(FIRST_VENUE_SHORTLIST_CAP, 5);
});

test('bench href deep-links the reception tile on the vendors surface', () => {
  assert.equal(
    freeVenueAssistBenchHref('S89E-ABC123DEF0'),
    '/dashboard/S89E-ABC123DEF0/vendors?open=reception',
  );
});

test('confirmation copy: pluralizes and carries the sub pricing', () => {
  assert.equal(
    firstVenueShortlistConfirmation(5),
    'Sai shortlisted 5 venues that fit your date, budget & area — this is what the full Sai does. ₱499 first 28 days → ₱799/28d.',
  );
  assert.match(firstVenueShortlistConfirmation(1), /1 venue that/);
  assert.doesNotMatch(firstVenueShortlistConfirmation(1), /1 venues/);
});

test('upsell line carries the carve-out pricing (₱499 → ₱799)', () => {
  assert.match(FIRST_VENUE_SHORTLIST_UPSELL, /₱499 first 28 days/);
  assert.match(FIRST_VENUE_SHORTLIST_UPSELL, /₱799 per 28 days/);
});
