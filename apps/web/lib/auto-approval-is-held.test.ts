import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AUTO_APPROVAL_HELD, AUTO_APPROVAL_HELD_REASON, holdAutoApproval, type AutoVerifyDecision } from './auto-verify';
import { stripComments } from './strip-comments';

/**
 * AUTOMATIC APPROVAL STAYS HELD while W1-B34 is open (fake "TEST — NOT VALID" papers can read as
 * Recognised). The check still runs and is logged; a clean pass still waits for a person.
 */

const pass: AutoVerifyDecision = { decision: 'verify', checks: [], reason: 'All 6 checks passed.' };
const fail: AutoVerifyDecision = { decision: 'to_admin', checks: [], reason: 'The BIR paper could not be read.' };

test('the hold is on', () => {
  assert.equal(AUTO_APPROVAL_HELD, true, 'releasing automatic approval needs B34 closed and the owner’s word');
});

test('a clean pass goes to a person while held', () => {
  const out = holdAutoApproval(pass);
  assert.equal(out.decision, 'to_admin');
  assert.equal(out.reason, AUTO_APPROVAL_HELD_REASON);
});

test('a failing check keeps its own reason', () => {
  assert.deepEqual(holdAutoApproval(fail), fail);
});

test('released, a clean pass verifies', () => {
  assert.equal(holdAutoApproval(pass, false).decision, 'verify');
});

test('the server applies the hold before it decides or logs', () => {
  const src = stripComments(readFileSync(new URL('./auto-verify.server.ts', import.meta.url), 'utf8'));
  assert.match(src, /decided = holdAutoApproval\(decideAutoVerify\(/);
});
