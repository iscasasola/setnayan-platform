// Unit tests for the deploy drift doctor's pure classifier.
// Run: node --test scripts/deploy-drift-doctor.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeployDrift } from './deploy-drift-doctor.mjs';

test('classifyDeployDrift: up to date — zero commits behind is never drift', () => {
  const r = classifyDeployDrift({ behindCount: 0, oldestPendingAgeSec: null, graceSec: 1200 });
  assert.equal(r.drift, false);
  assert.equal(r.reason, 'up-to-date');
});

test('classifyDeployDrift: within grace — behind but the oldest pending commit is fresh', () => {
  const r = classifyDeployDrift({ behindCount: 3, oldestPendingAgeSec: 60, graceSec: 1200 });
  assert.equal(r.drift, false);
  assert.equal(r.reason, 'within-grace');
});

test('classifyDeployDrift: past grace — the oldest pending commit is older than the window', () => {
  const r = classifyDeployDrift({ behindCount: 7, oldestPendingAgeSec: 3600, graceSec: 1200 });
  assert.equal(r.drift, true);
  assert.equal(r.reason, 'behind');
});

test('classifyDeployDrift: exactly at the grace boundary counts as still fresh (< not <=)', () => {
  const r = classifyDeployDrift({ behindCount: 1, oldestPendingAgeSec: 1200, graceSec: 1200 });
  assert.equal(r.drift, true);
  assert.equal(r.reason, 'behind');
});

test('classifyDeployDrift: behind with unknown age never reports healthy — inconclusive age is still drift', () => {
  const r = classifyDeployDrift({ behindCount: 2, oldestPendingAgeSec: null, graceSec: 1200 });
  assert.equal(r.drift, true);
  assert.equal(r.reason, 'behind-unknown-age');
});

test('classifyDeployDrift: negative behindCount (should not happen, but must not crash or drift)', () => {
  const r = classifyDeployDrift({ behindCount: -1, oldestPendingAgeSec: null, graceSec: 1200 });
  assert.equal(r.drift, false);
  assert.equal(r.reason, 'up-to-date');
});
