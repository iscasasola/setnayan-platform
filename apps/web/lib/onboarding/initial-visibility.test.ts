/**
 * The visibility a new event's website is born with.
 *
 * Small file, load-bearing rule. It is the only place the anonymous-draft
 * carve-out is enforced, because the RLS policy that would otherwise enforce it
 * (`20270823141500_events_anon_cannot_publish.sql`) CANNOT fire on the
 * onboarding path — that insert runs as service-role and bypasses RLS. The
 * policy stays green while doing nothing, which is exactly the shape of guard
 * this project has been bitten by before.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLandingVisibility } from './initial-visibility';

test('initial visibility · a real account gets a site that works by link immediately', () => {
  // The owner's ruling: "the event websites should be visible upon creation."
  assert.equal(initialLandingVisibility({ isAnonymous: false }), 'unlisted');
});

test('initial visibility · an anonymous draft stays PRIVATE', () => {
  // Somebody typed two real people's names into a signup flow and has not made
  // an account. Publishing that by link is not what was asked for and nobody
  // consented to it.
  assert.equal(initialLandingVisibility({ isAnonymous: true }), 'private');
});

test('initial visibility · it fails CLOSED on anything that is not a definite false', () => {
  // The flag arrives from several call sites, one of which reads it off an auth
  // user (`user.is_anonymous`) where it can be undefined. A truthiness test
  // would have made undefined mean "not anonymous" — i.e. publish. It must mean
  // "we do not know", i.e. private.
  for (const sloppy of [undefined, null, 0, '', NaN]) {
    assert.equal(
      initialLandingVisibility({ isAnonymous: sloppy as unknown as boolean }),
      'private',
      `isAnonymous=${String(sloppy)} must not publish — only a literal false may`,
    );
  }
});

test('initial visibility · never returns public — launch is what makes a site public', () => {
  // Defaulting to `public` would index the site, list it on the aggregate
  // surfaces, and fire the guest announcement emails — silently converting the
  // paid Save-the-Date reveal into a mailing button.
  for (const anon of [true, false]) {
    assert.notEqual(initialLandingVisibility({ isAnonymous: anon }), 'public');
  }
});
