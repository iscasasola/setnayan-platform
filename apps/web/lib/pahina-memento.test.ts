/**
 * After-Event memento — the guest-only gate on a SHARED path (design §11).
 *
 * `buildAfterEventMemento()` is the whole decision surface behind the memento:
 * the call site in `site-body.tsx` is `model ? <PahinaKeepsake … /> : null`.
 * The suite carries the three claims this PR is accountable for.
 *
 *   1. THE ANONYMOUS FENCE. The memento mounts inside `phasedBody`, which is
 *      shared by both identity tiers. No input other than `identityKind:
 *      'guest'` may produce a model — not an `attending` reply, not an
 *      `arrived` flag, not both. This is the claim that matters most: a leak
 *      here would put a named guest's presence on a stranger's screen.
 *   2. THE PHASE FENCE. Only the editorial (After-Event) body qualifies.
 *      Before the wedding the same ticket is already mounted as
 *      `variant="accepted"` on the RSVPed fork; a second one would double it.
 *   3. PROOF OF PRESENCE. Either signal qualifies on its own, `checked_in`
 *      outranks `rsvp`, and a guest with neither gets silence.
 *
 * Gate-neutralisation check (2026-07-26): replacing the `identityKind !==
 * 'guest'` denial with `if (false) return null` makes the four anonymous tests
 * below fail; replacing the `body !== 'editorial'` denial likewise fails the
 * three phase tests. Both were run and both failed as expected, which is the
 * proof these tests exercise the gate rather than merely coexisting with it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAfterEventMemento } from './pahina-memento';
import type { RsvpStatus } from './guests';
import type { SiteBodyKind, SiteIdentityKind } from './site-body-plan';

/** Every reply state the schema allows — so "all of them" is literally all. */
const ALL_RSVP: readonly RsvpStatus[] = [
  'pending',
  'attending',
  'declined',
  'maybe',
];
const ALL_BODIES: readonly SiteBodyKind[] = [
  'editorial',
  'save_the_date',
  'normal',
];

function build(
  overrides: Partial<Parameters<typeof buildAfterEventMemento>[0]> = {},
) {
  return buildAfterEventMemento({
    identityKind: 'guest' as SiteIdentityKind,
    body: 'editorial' as SiteBodyKind,
    rsvpStatus: 'attending' as RsvpStatus,
    arrived: false,
    ...overrides,
  });
}

// ── 1. The anonymous fence ──────────────────────────────────────────────────

test('anonymous never gets a memento, whatever else is true', () => {
  for (const rsvpStatus of ALL_RSVP) {
    for (const arrived of [false, true]) {
      assert.equal(
        build({ identityKind: 'anonymous', rsvpStatus, arrived }),
        null,
        `anonymous leaked with rsvp=${rsvpStatus} arrived=${arrived}`,
      );
    }
  }
});

test('anonymous is denied even on the exact editorial body that qualifies a guest', () => {
  // The pair that proves the tier is what denies, not the phase: identical
  // inputs, only the tier differs, and only the guest gets a model.
  const inputs = { body: 'editorial' as SiteBodyKind, rsvpStatus: 'attending' as RsvpStatus, arrived: true };
  assert.equal(build({ ...inputs, identityKind: 'anonymous' }), null);
  assert.deepEqual(build({ ...inputs, identityKind: 'guest' }), {
    variant: 'attended',
    proof: 'checked_in',
  });
});

test('anonymous is denied on every body kind', () => {
  for (const body of ALL_BODIES) {
    assert.equal(build({ identityKind: 'anonymous', body }), null, `leaked on body=${body}`);
  }
});

test('the tier check runs BEFORE the presence checks', () => {
  // An anonymous caller carrying the strongest possible presence signal is
  // still denied — the denial cannot be bought with better evidence.
  assert.equal(
    build({ identityKind: 'anonymous', rsvpStatus: 'attending', arrived: true }),
    null,
  );
});

// ── 2. The phase fence ──────────────────────────────────────────────────────

test('only the editorial body mounts the memento', () => {
  assert.notEqual(build({ body: 'editorial' }), null);
  assert.equal(build({ body: 'normal' }), null);
  assert.equal(build({ body: 'save_the_date' }), null);
});

test('an attending guest gets nothing before the wedding (the RSVPed fork owns the ticket)', () => {
  assert.equal(build({ body: 'normal', rsvpStatus: 'attending' }), null);
  assert.equal(build({ body: 'normal', rsvpStatus: 'attending', arrived: true }), null);
});

test('a checked-in guest still gets nothing on the save-the-date body', () => {
  assert.equal(build({ body: 'save_the_date', arrived: true }), null);
});

// ── 3. Proof of presence ────────────────────────────────────────────────────

test('an attending reply alone earns the memento', () => {
  assert.deepEqual(build({ rsvpStatus: 'attending', arrived: false }), {
    variant: 'attended',
    proof: 'rsvp',
  });
});

test('a door check-in alone earns it — including for a guest who declined', () => {
  // Optional in most events, but when it exists it is the harder evidence:
  // they physically came. Declining and then showing up is a real outcome.
  assert.deepEqual(build({ rsvpStatus: 'declined', arrived: true }), {
    variant: 'attended',
    proof: 'checked_in',
  });
  assert.deepEqual(build({ rsvpStatus: 'pending', arrived: true }), {
    variant: 'attended',
    proof: 'checked_in',
  });
});

test('check-in outranks the reply when both are present', () => {
  assert.deepEqual(build({ rsvpStatus: 'attending', arrived: true }), {
    variant: 'attended',
    proof: 'checked_in',
  });
});

test('a guest with no proof of presence gets silence', () => {
  for (const rsvpStatus of ['pending', 'declined', 'maybe'] as const) {
    assert.equal(
      build({ rsvpStatus, arrived: false }),
      null,
      `rsvp=${rsvpStatus} should not earn a memento`,
    );
  }
});

test('the variant can only ever be the attended ticket', () => {
  // Structural: the call site takes `.variant` straight into PahinaKeepsake, so
  // a model that could say 'accepted' would mount the wrong ticket after the
  // wedding. Pin it across every qualifying combination.
  for (const rsvpStatus of ALL_RSVP) {
    for (const arrived of [false, true]) {
      const model = build({ rsvpStatus, arrived });
      if (model) assert.equal(model.variant, 'attended');
    }
  }
});
