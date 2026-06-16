/**
 * Unit suite for the Build 3d-C re-quote-nudge PURE gate/throttle logic
 * (`selectNudgesToSend` + `buildRequoteNudgeBody`). Load-bearing invariants:
 *   • Throttle = ONE nudge per (event, vendor, plan_group); a pending
 *     un-replied nudge opts that service out.
 *   • The vendor must REPLY (repliedSince) before a service is re-nudged.
 *   • De-duped + deterministic — at most one nudge per (vendor, plan_group) run.
 *   • The copy is opportunity-framed and NEVER prints the budget number, and
 *     points at /vendor-dashboard/proposals.
 *
 * The flag-dark guard + the date/location gate are enforced at the call site
 * (runBuild3State returns early when BUILD_3STATE_ENABLED is off; only quoted,
 * date/location-passing vendors ever reach `candidates`), so this suite drives
 * the pure decision the call site delegates to.
 *
 * Run via the repo's `test:unit` script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  selectNudgesToSend,
  buildRequoteNudgeBody,
  nudgeThrottleKey,
  type NudgeCandidate,
  type PriorNudge,
} from './build-requote-nudge';

const cand = (
  vendorProfileId: string,
  planGroupId: string,
  threadId = `t-${vendorProfileId}`,
): NudgeCandidate => ({ vendorProfileId, planGroupId, threadId });

// ── First nudge ──────────────────────────────────────────────────────────────

test('first nudge: a candidate with no prior nudge is eligible', () => {
  const out = selectNudgesToSend({
    candidates: [cand('v1', 'catering')],
    priorNudges: [],
  });
  assert.deepEqual(out, [
    { planGroupId: 'catering', vendorProfileId: 'v1', threadId: 't-v1' },
  ]);
});

// ── Throttle: one pending per (event, vendor, service) ───────────────────────

test('throttle: a PENDING un-replied nudge opts the (vendor, service) out', () => {
  const out = selectNudgesToSend({
    candidates: [cand('v1', 'catering')],
    priorNudges: [{ vendorProfileId: 'v1', planGroupId: 'catering', repliedSince: false }],
  });
  assert.deepEqual(out, []); // still pending → no repeat nudge.
});

test('reply-gate: once the vendor REPLIED, the service is eligible again', () => {
  const out = selectNudgesToSend({
    candidates: [cand('v1', 'catering')],
    priorNudges: [{ vendorProfileId: 'v1', planGroupId: 'catering', repliedSince: true }],
  });
  assert.deepEqual(out, [
    { planGroupId: 'catering', vendorProfileId: 'v1', threadId: 't-v1' },
  ]);
});

test('throttle is per-(vendor, service): a pending nudge on one service never gates another service of the same vendor', () => {
  const out = selectNudgesToSend({
    candidates: [cand('v1', 'catering'), cand('v1', 'photography')],
    // Pending on catering only.
    priorNudges: [{ vendorProfileId: 'v1', planGroupId: 'catering', repliedSince: false }],
  });
  // catering opted out; photography is fresh → eligible.
  assert.deepEqual(out, [
    { planGroupId: 'photography', vendorProfileId: 'v1', threadId: 't-v1' },
  ]);
});

test('throttle is per-vendor: a pending nudge for v1 never gates v2 on the same service', () => {
  const out = selectNudgesToSend({
    candidates: [cand('v1', 'catering'), cand('v2', 'catering')],
    priorNudges: [{ vendorProfileId: 'v1', planGroupId: 'catering', repliedSince: false }],
  });
  assert.deepEqual(out, [
    { planGroupId: 'catering', vendorProfileId: 'v2', threadId: 't-v2' },
  ]);
});

// ── De-dupe + determinism ────────────────────────────────────────────────────

test('de-dupe: the same (vendor, service) appearing twice this run nudges at most once', () => {
  const out = selectNudgesToSend({
    candidates: [
      cand('v1', 'attire', 'thread-x'),
      cand('v1', 'attire', 'thread-x'),
    ],
    priorNudges: [],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0]!.vendorProfileId, 'v1');
});

test('order follows first appearance in candidates (deterministic)', () => {
  const out = selectNudgesToSend({
    candidates: [cand('vB', 'catering'), cand('vA', 'photography')],
    priorNudges: [],
  });
  assert.deepEqual(
    out.map((o) => o.vendorProfileId),
    ['vB', 'vA'],
  );
});

test('empty candidates → empty result', () => {
  assert.deepEqual(selectNudgesToSend({ candidates: [], priorNudges: [] }), []);
});

test('nudgeThrottleKey is stable + composite (vendor + plan_group)', () => {
  assert.equal(nudgeThrottleKey('v1', 'catering'), 'v1::catering');
  assert.notEqual(nudgeThrottleKey('v1', 'catering'), nudgeThrottleKey('v1', 'photography'));
});

// ── Copy guardrails ──────────────────────────────────────────────────────────

test('copy: opportunity-framed, names couple + category, points at proposals, and NEVER prints a budget number', () => {
  const body = buildRequoteNudgeBody({
    coupleLabel: 'Maria & Jose',
    categoryLabel: 'Catering',
  });
  assert.match(body, /Maria & Jose/);
  assert.match(body, /Catering/);
  assert.match(body, /\/vendor-dashboard\/proposals/);
  assert.match(body, /new proposition/i);
  // Withheld budget: no peso sign and no run of digits that could be an amount.
  assert.ok(!body.includes('₱'), 'must not contain a peso amount');
  assert.ok(!/\d{3,}/.test(body), 'must not contain a budget-like number');
  // Opportunity-framed, not a rejection.
  assert.ok(!/reject|too expensive|cannot afford|declined/i.test(body));
});

test('copy: blank labels fall back to safe generics', () => {
  const body = buildRequoteNudgeBody({ coupleLabel: '   ', categoryLabel: '' });
  assert.match(body, /A couple/);
  assert.match(body, /this service/);
});
