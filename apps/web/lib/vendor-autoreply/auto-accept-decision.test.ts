/**
 * Phase 4A pure-predicate tests — evaluateAutoAccept encodes the §4A contract:
 * auto-accept IFF flag on · vendor opted in · thread pending · score exists ·
 * score ≥ threshold · not trust-flagged (unknown = flagged, fail-closed) ·
 * under the daily auto-accept cap · tier eligible · a token is AVAILABLE.
 * The no-token skip is the ONLY one that flags a waiting lead for the vendor.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutoAcceptWelcome,
  evaluateAutoAccept,
  type AutoAcceptGateInput,
} from './auto-accept-decision';

function passing(overrides: Partial<AutoAcceptGateInput> = {}): AutoAcceptGateInput {
  return {
    flagEnabled: true,
    config: { autoAcceptEnabled: true, threshold: 78, dailyCap: 10 },
    inquiryStatus: 'pending',
    compatScore: 85,
    trustFlagged: false,
    tierEligible: true,
    tokenAvailable: true,
    autoAcceptsToday: 0,
    ...overrides,
  };
}

test('every bar cleared → accept', () => {
  assert.deepEqual(evaluateAutoAccept(passing()), { accept: true });
});

test('flag off → never (flag-dark contract)', () => {
  const d = evaluateAutoAccept(passing({ flagEnabled: false }));
  assert.deepEqual(d, { accept: false, reason: 'flag_off', flagWaitingLead: false });
});

test('no config row / auto-accept not opted in → never', () => {
  assert.equal(evaluateAutoAccept(passing({ config: null })).accept, false);
  const d = evaluateAutoAccept(
    passing({ config: { autoAcceptEnabled: false, threshold: 78, dailyCap: 10 } }),
  );
  assert.deepEqual(d, { accept: false, reason: 'not_configured', flagWaitingLead: false });
});

test('thread not pending (accepted / declined / null) → never re-accepts', () => {
  for (const status of ['accepted', 'declined', null]) {
    const d = evaluateAutoAccept(passing({ inquiryStatus: status }));
    assert.deepEqual(d, { accept: false, reason: 'not_pending', flagWaitingLead: false });
  }
});

test('no compat score → never guesses an accept', () => {
  const d = evaluateAutoAccept(passing({ compatScore: null }));
  assert.deepEqual(d, { accept: false, reason: 'no_compat_score', flagWaitingLead: false });
});

test('threshold: below fails, at-threshold passes (>= semantics)', () => {
  assert.deepEqual(evaluateAutoAccept(passing({ compatScore: 77 })), {
    accept: false,
    reason: 'below_threshold',
    flagWaitingLead: false,
  });
  assert.deepEqual(evaluateAutoAccept(passing({ compatScore: 78 })), { accept: true });
});

test('trust-flagged lead → never, and NOT a waiting-lead flag', () => {
  const d = evaluateAutoAccept(passing({ trustFlagged: true }));
  assert.deepEqual(d, { accept: false, reason: 'trust_flagged', flagWaitingLead: false });
});

test('trust check errored (null) → fail-closed, never treated as a pass', () => {
  const d = evaluateAutoAccept(passing({ trustFlagged: null }));
  assert.deepEqual(d, { accept: false, reason: 'trust_unknown', flagWaitingLead: false });
});

test('daily auto-accept cap reached → never (cap 0 = never at all)', () => {
  const atCap = evaluateAutoAccept(passing({ autoAcceptsToday: 10 }));
  assert.deepEqual(atCap, { accept: false, reason: 'cap_reached', flagWaitingLead: false });
  const capZero = evaluateAutoAccept(
    passing({ config: { autoAcceptEnabled: true, threshold: 78, dailyCap: 0 } }),
  );
  assert.deepEqual(capZero, { accept: false, reason: 'cap_reached', flagWaitingLead: false });
  assert.equal(evaluateAutoAccept(passing({ autoAcceptsToday: 9 })).accept, true);
});

test('free tier (cannot accept in-app at all) → never, no token flag', () => {
  const d = evaluateAutoAccept(passing({ tierEligible: false }));
  assert.deepEqual(d, { accept: false, reason: 'tier_ineligible', flagWaitingLead: false });
});

test('NO token → no accept (no hold) + the ONLY waiting-lead flag', () => {
  const d = evaluateAutoAccept(passing({ tokenAvailable: false }));
  assert.deepEqual(d, { accept: false, reason: 'no_token', flagWaitingLead: true });
});

test('token probe errored (null) → fail-closed AND no "out of tokens" flag', () => {
  const d = evaluateAutoAccept(passing({ tokenAvailable: null }));
  assert.deepEqual(d, { accept: false, reason: 'token_unknown', flagWaitingLead: false });
});

test('no-token flag only fires when every OTHER bar was already cleared', () => {
  // Trust-flagged + no token → the trust skip wins; no misleading token flag.
  const d = evaluateAutoAccept(passing({ trustFlagged: true, tokenAvailable: false }));
  assert.equal(d.accept, false);
  if (!d.accept) {
    assert.equal(d.reason, 'trust_flagged');
    assert.equal(d.flagWaitingLead, false);
  }
});

test('welcome copy cites up to 3 reasons and survives an empty business name', () => {
  const withReasons = buildAutoAcceptWelcome('Blooms & Co.', [
    'Fits your budget',
    '4.8★',
    'Verified',
    'Free on your dates',
  ]);
  assert.match(withReasons, /Blooms & Co\. accepted your inquiry automatically/);
  assert.match(withReasons, /Fits your budget · 4\.8★ · Verified/);
  assert.doesNotMatch(withReasons, /Free on your dates/);

  const bare = buildAutoAcceptWelcome('  ', []);
  assert.match(bare, /This vendor accepted your inquiry automatically/);
  assert.doesNotMatch(bare, /Why you match/);
});
