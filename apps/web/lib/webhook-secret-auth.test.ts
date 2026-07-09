/**
 * Webhook shared-secret auth (node:test via tsx).
 *
 * Locks the 2026-07-09 fail-CLOSED fix: an unset NOTIFY_WEBHOOK_SECRET must
 * REJECT (the old behavior accepted every request unauthenticated), and the
 * header must match exactly when the secret is set.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { webhookSecretAuthorized } from './webhook-secret-auth';

test('fail CLOSED: missing/empty configured secret rejects every request', () => {
  assert.equal(webhookSecretAuthorized('anything', undefined), false);
  assert.equal(webhookSecretAuthorized('anything', null), false);
  assert.equal(webhookSecretAuthorized('anything', ''), false);
  // Even a request that "guesses" emptiness is rejected — no unauthenticated path.
  assert.equal(webhookSecretAuthorized('', undefined), false);
  assert.equal(webhookSecretAuthorized(null, undefined), false);
});

test('secret set: exact match authorizes, anything else rejects', () => {
  assert.equal(webhookSecretAuthorized('s3cret', 's3cret'), true);
  assert.equal(webhookSecretAuthorized('s3cret-wrong', 's3cret'), false);
  assert.equal(webhookSecretAuthorized('S3CRET', 's3cret'), false);
  assert.equal(webhookSecretAuthorized('', 's3cret'), false);
  assert.equal(webhookSecretAuthorized(null, 's3cret'), false);
  assert.equal(webhookSecretAuthorized(undefined, 's3cret'), false);
  // Length mismatch short-circuits without throwing (timingSafeEqual guard).
  assert.equal(webhookSecretAuthorized('s3', 's3cret'), false);
});
