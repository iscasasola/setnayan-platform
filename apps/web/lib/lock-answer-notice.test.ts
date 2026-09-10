/**
 * A REFUSED ANSWER MUST SAY SOMETHING.
 *
 * 🔴 WHAT THIS PINS. `vendorAgreeToLock` ends with
 * `redirect('/vendor-dashboard?lock_agree=<status>')`, and until this module
 * nothing anywhere read that value: a supplier who pressed Agree and was
 * refused got the same page, the same card, and no message. Nine different
 * refusals were indistinguishable from a dead button.
 *
 * These assertions are about SENTENCES A SHOP OWNER READS — that each refusal
 * is distinct, actionable, and free of the words the database uses. The
 * companion db test proves the LIST is complete against the live RPC bodies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lockAgreeNotice,
  lockDeclineNotice,
  LOCK_AGREE_STATUSES,
  LOCK_DECLINE_STATUSES,
} from '@/lib/lock-answer-notice';

test('no status ⇒ no notice (an ordinary page load stays clean)', () => {
  assert.equal(lockAgreeNotice(undefined), null);
  assert.equal(lockAgreeNotice(null), null);
  assert.equal(lockAgreeNotice(''), null);
  assert.equal(lockDeclineNotice(undefined), null);
});

test('every AGREE outcome has its own sentence, and no two are the same', () => {
  const seen = new Map<string, string>();
  for (const s of LOCK_AGREE_STATUSES) {
    const n = lockAgreeNotice(s, { competing: 2 });
    assert.ok(n, `${s} has no notice`);
    assert.ok(n!.text.length > 20, `${s} notice is too short to help anybody`);
    assert.ok(!seen.has(n!.text), `${s} reuses the sentence for ${seen.get(n!.text)}`);
    seen.set(n!.text, s);
  }
});

test('every DECLINE outcome has its own sentence', () => {
  const seen = new Set<string>();
  for (const s of LOCK_DECLINE_STATUSES) {
    const n = lockDeclineNotice(s);
    assert.ok(n, `${s} has no notice`);
    assert.ok(!seen.has(n!.text), `${s} reuses another sentence`);
    seen.add(n!.text);
  }
});

test('a refusal never shows the shop owner a status code or a table name', () => {
  const jargon = /event_vendors|lock_request|rpc|null|status\b|vendor_id|42501|23505/i;
  for (const s of LOCK_AGREE_STATUSES) {
    assert.doesNotMatch(lockAgreeNotice(s)!.text, jargon, `agree/${s} leaks jargon`);
  }
  for (const s of LOCK_DECLINE_STATUSES) {
    assert.doesNotMatch(lockDeclineNotice(s)!.text, jargon, `decline/${s} leaks jargon`);
  }
});

test('not_verified says WHY and what to do about it', () => {
  const n = lockAgreeNotice('not_verified')!;
  assert.equal(n.tone, 'refused');
  assert.match(n.text, /has not approved your shop/i);
  assert.match(n.text, /verification/i);
});

test('resolve_others_first names how many people are waiting when we know', () => {
  assert.match(lockAgreeNotice('resolve_others_first', { competing: 3 })!.text, /3 other couples/i);
  assert.match(lockAgreeNotice('resolve_others_first', { competing: 1 })!.text, /1 other couple is/i);
  // Unknown count still refuses, without inventing a number.
  const vague = lockAgreeNotice('resolve_others_first', { competing: null })!;
  assert.match(vague.text, /Other couples/i);
  assert.doesNotMatch(vague.text, /\d/);
});

test('an unknown status is still reported as a refusal, never as silence', () => {
  const n = lockAgreeNotice('some_status_added_in_sql_next_week')!;
  assert.equal(n.tone, 'refused');
  assert.match(n.text, /Nothing changed/i);
});

test('only the two success/no-op outcomes are non-refusals', () => {
  const refused = LOCK_AGREE_STATUSES.filter((s) => lockAgreeNotice(s)!.tone === 'refused');
  assert.ok(refused.length >= 7, `only ${refused.length} agree refusals carry a refusal tone`);
  assert.equal(lockAgreeNotice('ok')!.tone, 'ok');
  assert.equal(lockAgreeNotice('already')!.tone, 'noop');
});
