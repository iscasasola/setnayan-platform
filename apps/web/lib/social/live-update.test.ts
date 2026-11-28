/**
 * 📰 THE 2 PM LIVE POST IS REAL OR IT IS NOTHING (owner, 28 Nov 2026, specs DECISION_LOG "WHAT EACH FACEBOOK SLOT
 * CARRIES"): new verified shops, events held, Sunday totals — from real data only. No data, no post; a fact that
 * could not be read is never zero; no small-number milestones (round totals from the milestone ladder only).
 *
 * Sabotage (measured): `roundTotal` returning the raw count turns "no small numbers" red; composeLiveUpdate falling
 * back to a generic line turns "no data → no post" red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLiveUpdate, inLiveComposeWindow, liveUpdateSourceRef, roundTotal, type LiveFacts } from './live-update';

const none: LiveFacts = { shopsVerified: [], eventsHeld: 0, totals: null };
const unread: LiveFacts = { shopsVerified: null, eventsHeld: null, totals: null };

test('no real update → no post, every day of the week', () => {
  assert.equal(composeLiveUpdate(none, '2026-12-01', false), null);
  assert.equal(composeLiveUpdate(none, '2026-12-06', true), null);
});

test('a fact that could not be read is never turned into a post', () => {
  assert.equal(composeLiveUpdate(unread, '2026-12-01', false), null);
  assert.equal(composeLiveUpdate(unread, '2026-12-06', true), null);
});

test('no small numbers: below the first rung a count is not shown at all', () => {
  assert.equal(roundTotal(0), null);
  assert.equal(roundTotal(9), null);
  assert.equal(roundTotal(10), 10);
  assert.equal(roundTotal(37), 25);
  assert.equal(roundTotal(1234), 1000);
  assert.equal(roundTotal(null), null);
  assert.equal(composeLiveUpdate({ ...none, eventsHeld: 7 }, '2026-12-01', false), null);
  const post = composeLiveUpdate({ ...none, eventsHeld: 57 }, '2026-12-01', false);
  assert.equal(post?.kind, 'events_held');
  assert.match(post!.body, /^50\+ events celebrated on Setnayan this week/);
  assert.doesNotMatch(post!.body, /57/);
});

test('new verified shops are welcomed by name only on a paid size, never counted', () => {
  const post = composeLiveUpdate(
    {
      ...none,
      shopsVerified: [
        { named: true, businessName: 'Hiraya Studio', category: 'Photography', region: 'Cebu' },
        { named: false, businessName: 'Hidden Name', category: 'Catering', region: 'Davao' },
      ],
    },
    '2026-12-01',
    false,
  );
  assert.equal(post?.kind, 'new_shops');
  assert.match(post!.body, /Hiraya Studio · Photography, Cebu/);
  assert.match(post!.body, /A new catering in Davao/);
  assert.doesNotMatch(post!.body, /Hidden Name/);
  assert.doesNotMatch(post!.body, /\b2\b/);
  assert.doesNotMatch(post!.body, /vendor/i);
});

test('Sunday leads with round weekly totals and leaves out small or unread ones', () => {
  const post = composeLiveUpdate(
    {
      ...none,
      eventsHeld: 3,
      totals: { events_created: 130, vendors_verified: 8, guests_invited: null, users_joined: 2600 },
    },
    '2026-12-06',
    true,
  );
  assert.equal(post?.kind, 'weekly_totals');
  assert.match(post!.body, /100\+ events planned/);
  assert.match(post!.body, /2,500\+ people joined/);
  assert.doesNotMatch(post!.body, /suppliers|guests invited|celebrated this week/);
  // Totals are Sunday's only.
  assert.equal(
    composeLiveUpdate({ ...none, totals: { events_created: 130, vendors_verified: 0, guests_invited: 0, users_joined: 0 } }, '2026-12-01', false),
    null,
  );
});

test('one live update per Manila day', () => {
  assert.equal(liveUpdateSourceRef('2026-12-01'), 'live:2026-12-01');
});

test('the live update follows the caption word rules (docs/brand.md; the same list #8437 holds)', () => {
  const BANNED = /\bvendors?\b|vetted|trusting|trusted|every single one|monogram|\breel\b|marketplace,|\bfirst\b|#1|guaranteed|scam-free/i;
  const posts = [
    composeLiveUpdate(
      { shopsVerified: [{ named: true, businessName: 'Hiraya', category: 'Photography', region: 'Cebu' }, { named: false, businessName: '', category: 'Catering', region: 'Davao' }], eventsHeld: null, totals: null },
      '2026-12-01',
      false,
    ),
    composeLiveUpdate({ shopsVerified: [], eventsHeld: 120, totals: null }, '2026-12-01', false),
    composeLiveUpdate(
      { shopsVerified: [], eventsHeld: 60, totals: { events_created: 300, vendors_verified: 40, guests_invited: 5000, users_joined: 900 } },
      '2026-12-06',
      true,
    ),
  ];
  assert.equal(posts.filter(Boolean).length, 3);
  for (const post of posts) {
    assert.doesNotMatch(`${post!.title}\n${post!.body}`, BANNED, post!.kind);
    assert.match(post!.body, /#Setnayan #SetNaYan$/, `${post!.kind} ends with the house tags`);
  }
});

test('the 2 PM post is composed between 10:00 and 13:50, so the same visit can schedule it on Facebook', () => {
  const ph = (t: string) => new Date(`2026-12-01T${t}+08:00`);
  assert.equal(inLiveComposeWindow(ph('09:59:59')), false);
  assert.equal(inLiveComposeWindow(ph('10:00:00')), true);
  assert.equal(inLiveComposeWindow(ph('13:49:59')), true);
  assert.equal(inLiveComposeWindow(ph('13:50:00')), false, 'Facebook needs 10 minutes of lead');
  assert.equal(inLiveComposeWindow(ph('14:10:00')), false);
});
