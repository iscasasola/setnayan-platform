import test from 'node:test';
import assert from 'node:assert/strict';

import { shopFindability, findabilityNotice } from './vendor-shop-findable';

test('a live shop is findable and says nothing', () => {
  const state = shopFindability({ publicVisibility: 'verified', railShowing: false });
  assert.deepEqual(state, { findable: true, reason: 'live' });
  assert.equal(findabilityNotice(state), null);
});

test('THE GAP: approved but not listed is told, in plain words', () => {
  // Production holds a shop in exactly this state — verification_state
  // 'verified' (so the first-steps rail is null) and public_visibility 'hidden'.
  const state = shopFindability({ publicVisibility: 'hidden', railShowing: false });
  assert.deepEqual(state, { findable: false, reason: 'not_listed' });
  const notice = findabilityNotice(state);
  assert.ok(notice, 'a shop no couple can reach must be told why');
  assert.match(notice.title, /can’t find you/i);
  assert.ok(notice.cta, 'and given somewhere to ask');
});

test('the rail and the banner are never on screen together', () => {
  for (const visibility of ['hidden', 'verified', 'archived', null, 'nonsense']) {
    const state = shopFindability({ publicVisibility: visibility, railShowing: true });
    assert.equal(state.reason, 'still_getting_verified');
    assert.equal(
      findabilityNotice(state),
      null,
      'while the rail is speaking the banner must stay silent',
    );
  }
});

test('archived says it is closed, and does NOT claim the work is lost', () => {
  const state = shopFindability({ publicVisibility: 'archived', railShowing: false });
  assert.equal(state.reason, 'archived');
  const notice = findabilityNotice(state);
  assert.ok(notice);
  assert.match(notice.body, /untouched/i);
});

test('FAILS TOWARD SPEAKING: junk, null and unknown states never read as live', () => {
  for (const bad of [null, undefined, '', 'VERIFIED', 'coming_soon', 0, {}, []]) {
    const state = shopFindability({ publicVisibility: bad, railShowing: false });
    assert.equal(
      state.findable,
      false,
      `an unreadable visibility (${JSON.stringify(bad)}) must never claim the shop is live`,
    );
  }
});

test('NO FIX BUTTON WHERE THERE IS NO FIX — the ask goes to a human, never to a control', () => {
  for (const visibility of ['hidden', 'archived']) {
    const notice = findabilityNotice(shopFindability({ publicVisibility: visibility, railShowing: false }));
    assert.ok(notice?.cta);
    assert.match(
      notice.cta.href,
      /^\/help/,
      'a vendor cannot write public_visibility — a button that pretends otherwise refuses in silence',
    );
  }
});

test('the copy promises no message we do not send', () => {
  // `transitionVendorVisibility` writes an audit row and calls no notifier, so
  // "we will email you" would be a promise nothing keeps.
  for (const visibility of ['hidden', 'archived']) {
    const notice = findabilityNotice(shopFindability({ publicVisibility: visibility, railShowing: false }));
    const words = `${notice?.title} ${notice?.body}`.toLowerCase();
    for (const promise of ['we’ll email', "we'll email", 'we will email', 'we’ll let you know', 'notify you']) {
      assert.ok(!words.includes(promise), `copy must not promise "${promise}"`);
    }
  }
});
