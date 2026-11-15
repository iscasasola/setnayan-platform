/**
 * the-comp-banner-says-what-happens.test.ts — the customer comp banner stops promising a check that never runs.
 *
 * Owner 16 Nov (DECISION_LOG 75a46e3c (7)): KEEP the ₱10,000 rule, reword the banner. A customer/event comp worth
 * more than the § 9.1 limit is granted at once by one admin (`issueCompGrant`); the banner used to say "flag for
 * owner+spouse co-approval … two-admin primitive lands V1.x", which reads as if a second check were coming. It now
 * says what happened: nobody else checks it yet, so tell the owner.
 *
 * What would silently undo it:
 *   1. the old promise comes back ("co-approval", "owner+spouse", "lands V1.x");
 *   2. the limit is typed again instead of read from `COMP_GRANT_CO_REVIEW_PESOS` (the rule the owner kept);
 *   3. the over-limit branch stops telling the admin to tell the owner.
 *
 * Run: cd apps/web && npx tsx lib/the-comp-banner-says-what-happens.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { COMP_GRANT_CO_REVIEW_PESOS } from './rule-constants';

const ACTIONS = join(__dirname, '..', 'app', 'admin', 'users', 'actions.ts');
const body = stripComments(readFileSync(ACTIONS, 'utf8'));
const banner = /const banner = needsReview\s*\?\s*`([^`]*)`/.exec(body)?.[1] ?? '';

test('the rule is kept, at the owner’s number, read from the one constant', () => {
  assert.equal(COMP_GRANT_CO_REVIEW_PESOS, 10_000);
  assert.match(body, /const needsReview = \(retailValueCentavos \?\? 0\) > COMP_GRANT_CO_REVIEW_PESOS \* 100;/);
  assert.doesNotMatch(body, /10_000 \* 100/);
});

test('the over-limit banner says what happened and promises no second check', () => {
  assert.ok(banner, 'the over-limit banner was found');
  assert.match(banner, /COMP_GRANT_CO_REVIEW_PESOS/);
  assert.match(banner, /Nobody else checks a customer comp yet, so tell the owner/);
  assert.doesNotMatch(banner, /co-approval|owner\+spouse|lands V1\.x/i);
  assert.doesNotMatch(body, /co-approval \(exceeds/);
});
