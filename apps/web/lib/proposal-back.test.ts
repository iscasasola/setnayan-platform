/**
 * proposal-back.test.ts — the way out of a quote lands where you came from.
 *
 * Owner, live on the payment run, 2026-09-20: *"when i click view proposal, it
 * opens the proposal, but when i press back, it doesn't go back."* The control
 * was hard-coded to the Vendors bench; the person pressing it had arrived from
 * the conversation. See lib/proposal-back.ts for why the thread is RESOLVED
 * rather than carried in a `?from=`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACK_TO_CONVERSATION, proposalBackDoor } from './proposal-back';

const EVENT = '2d4f1144-7816-4367-9c99-6ff0f9a6de10';
const THREAD = 'ab7c1e90-0000-4000-8000-1234567890ab';

test('the couple goes back to THEIR thread, and the control says so', () => {
  const door = proposalBackDoor({ isVendorSide: false, eventId: EVENT, threadId: THREAD });
  assert.equal(door.href, `/dashboard/${EVENT}/messages/${THREAD}`);
  assert.equal(door.label, BACK_TO_CONVERSATION);
  // The bug in one line: the bench is not where they came from.
  assert.notEqual(door.href, `/dashboard/${EVENT}/vendors`);
});

test('the supplier goes back to the same conversation on their own route', () => {
  const door = proposalBackDoor({ isVendorSide: true, eventId: EVENT, threadId: THREAD });
  assert.equal(door.href, `/vendor-dashboard/messages/${THREAD}`);
  assert.equal(door.label, BACK_TO_CONVERSATION);
  // Never the couple's route — a supplier has no /dashboard/<event>.
  assert.ok(!door.href.startsWith('/dashboard/'));
});

test('no thread keeps the destinations the page already had — never a dead end', () => {
  const couple = proposalBackDoor({ isVendorSide: false, eventId: EVENT, threadId: null });
  assert.equal(couple.href, `/dashboard/${EVENT}/vendors`);
  const vendor = proposalBackDoor({ isVendorSide: true, eventId: EVENT, threadId: null });
  assert.equal(vendor.href, '/vendor-dashboard/proposals');
  // A fallback is still a real control with real words.
  for (const d of [couple, vendor]) {
    assert.ok(d.href.startsWith('/'), 'the fallback must be an in-app path');
    assert.ok(d.label.trim().length > 0, 'the fallback must still name a destination');
    assert.notEqual(d.label, BACK_TO_CONVERSATION, 'it does not claim a thread it has not got');
  }
});

test('a deleted celebration never produces /dashboard/null/…', () => {
  for (const eventId of [null, undefined]) {
    for (const threadId of [null, THREAD]) {
      const door = proposalBackDoor({ isVendorSide: false, eventId, threadId });
      assert.ok(
        !door.href.includes('null') && !door.href.includes('undefined'),
        `built ${door.href} from eventId=${String(eventId)} threadId=${String(threadId)}`,
      );
      // With no event there is no couple route to build, so it must fall back.
      assert.equal(door.href, '/vendor-dashboard/proposals');
    }
  }
});

test('every door is an in-app absolute path — never an off-site or scheme URL', () => {
  const cases = [
    { isVendorSide: false, eventId: EVENT, threadId: THREAD },
    { isVendorSide: true, eventId: EVENT, threadId: THREAD },
    { isVendorSide: false, eventId: EVENT, threadId: null },
    { isVendorSide: true, eventId: null, threadId: null },
  ];
  let checked = 0;
  for (const c of cases) {
    const { href } = proposalBackDoor(c);
    assert.match(href, /^\/[a-z]/, `${href} is not a rooted in-app path`);
    // `//host` is a protocol-relative URL — a door out of the app.
    assert.ok(!href.startsWith('//'), `${href} leaves the app`);
    assert.ok(!href.includes(':'), `${href} carries a scheme`);
    checked += 1;
  }
  assert.equal(checked, cases.length, `expected ${cases.length} doors checked, got ${checked}`);
});
