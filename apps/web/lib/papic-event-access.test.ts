/**
 * Guard suite for the Papic Buong Araw (SKU PAPIC_GUEST) event-type predicate.
 *
 * Phase-0 gate 0h of `Papic_Access_Scope_Council_Verdict_2026-07-20.md`: the
 * pass may be sold ONLY where the host writes the guest roster. These tests
 * lock the three things most likely to rot — the Phase-1 type set, the
 * permanent `travel` deny, and the anniversary controller split.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  WEDDING_PROFILE,
  type EventTypeProfile,
} from './event-type-profile';
import {
  PAPIC_ACCESS_CURRENT_PHASE,
  PAPIC_ACCESS_PHASE_1_TYPES,
  PAPIC_ACCESS_PHASE_2_TYPES,
  PAPIC_ACCESS_PHASE_3_TYPES,
  papicGuestPassAccess,
  papicGuestPassAllowed,
} from './papic-event-access';

/**
 * A profile shaped like a real prod row: every non-wedding type got
 * website/save_the_date/rsvp from migration 20270804110223, so these fixtures
 * DO enable `rsvp` — which is exactly why `travel` needs an explicit deny.
 */
function profileFor(eventType: string): EventTypeProfile {
  if (eventType === 'wedding') return WEDDING_PROFILE;
  return { ...GENERIC_PROFILE, eventType };
}

test('Phase 1 ships to phase 1 only', () => {
  assert.equal(PAPIC_ACCESS_CURRENT_PHASE, 1);
});

test('every Phase-1 closed-roster type is allowed today', () => {
  for (const eventType of PAPIC_ACCESS_PHASE_1_TYPES) {
    const decision = papicGuestPassAccess({ profile: profileFor(eventType) });
    assert.equal(decision.allowed, true, `${eventType} must be allowed at Phase 1`);
    assert.equal(decision.phase, 1, `${eventType} phase`);
  }
  // The set itself is the verdict's § 2 rows 1-6 — anniversary is handled by
  // the controller split, not by membership here.
  assert.deepEqual([...PAPIC_ACCESS_PHASE_1_TYPES], [
    'wedding',
    'debut',
    'birthday',
    'christening',
    'gender_reveal',
    'graduation',
  ]);
});

test('personally-owned anniversary is Phase 1; community-owned is not', () => {
  const profile = profileFor('anniversary');

  const personal = papicGuestPassAccess({ profile, communityId: null });
  assert.equal(personal.allowed, true, 'anniversary with community_id IS NULL');
  assert.equal(personal.phase, 1);

  // Omitting communityId entirely means "personal" — same decision.
  assert.equal(papicGuestPassAllowed({ profile }), true);

  const samahan = papicGuestPassAccess({ profile, communityId: 'S89C-0000000001' });
  assert.equal(samahan.allowed, false, 'Samahan-owned anniversary is Phase 2');
  assert.equal(samahan.phase, 2);
  assert.equal(
    samahan.allowed === false ? samahan.reason : null,
    'phase_not_reached',
  );
});

test('travel is an EXPLICIT deny — even though its profile enables rsvp', () => {
  const profile = profileFor('travel');
  // Precondition: the surface check alone would NOT stop travel. If this ever
  // flips, the explicit deny is still correct — travel is roaming + multi-day,
  // so a per-event-day pass is the wrong unit at any surface configuration.
  assert.ok(
    profile.enabledSurfaces.includes('rsvp'),
    'fixture must mirror prod (migration 20270804110223 added rsvp to every non-wedding row)',
  );

  const decision = papicGuestPassAccess({ profile });
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false ? decision.reason : null, 'type_denied_v1');

  // Denied at EVERY phase, not just the shipped one.
  for (const phase of [1, 2, 3] as const) {
    assert.equal(papicGuestPassAllowed({ profile, phase }), false, `travel at phase ${phase}`);
  }
  // …and it is in no phase set.
  const sets: readonly string[] = [
    ...PAPIC_ACCESS_PHASE_1_TYPES,
    ...PAPIC_ACCESS_PHASE_2_TYPES,
    ...PAPIC_ACCESS_PHASE_3_TYPES,
  ];
  assert.equal(sets.includes('travel'), false);
});

test('simple_event is denied by the RSVP surface check, not by name', () => {
  const decision = papicGuestPassAccess({ profile: SIMPLE_PROFILE });
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.allowed === false ? decision.reason : null,
    'no_rsvp_surface',
    'simple_event has no rsvp surface ⇒ no guest identity ⇒ auto-excluded',
  );
  // Belt + braces: it is also in no phase set, so a prod row that DID carry
  // `rsvp` (the 20270804110223 unlock ran on every non-wedding row, and
  // simple_event's profile predates it) is still denied — for scope, not
  // for surface.
  const withRsvp: EventTypeProfile = {
    ...SIMPLE_PROFILE,
    enabledSurfaces: [...SIMPLE_PROFILE.enabledSurfaces, 'rsvp'],
  };
  const fallback = papicGuestPassAccess({ profile: withRsvp });
  assert.equal(fallback.allowed, false);
  assert.equal(
    fallback.allowed === false ? fallback.reason : null,
    'type_out_of_scope',
  );
});

test('a type outside every phase set is denied (fail-closed)', () => {
  const decision = papicGuestPassAccess({ profile: profileFor('pet_adoption_party') });
  assert.equal(decision.allowed, false, 'a new event type must not inherit the pass');
  assert.equal(decision.allowed === false ? decision.reason : null, 'type_out_of_scope');
});

test('Phase 2 + Phase 3 types are known but not yet reachable', () => {
  for (const eventType of [...PAPIC_ACCESS_PHASE_2_TYPES, ...PAPIC_ACCESS_PHASE_3_TYPES]) {
    const decision = papicGuestPassAccess({ profile: profileFor(eventType) });
    assert.equal(decision.allowed, false, `${eventType} must not ship at Phase 1`);
    assert.equal(
      decision.allowed === false ? decision.reason : null,
      'phase_not_reached',
      `${eventType} reason`,
    );
  }
  // Explicit phase override opens them — the flip is one constant, not a rewrite.
  assert.equal(papicGuestPassAllowed({ profile: profileFor('reunion'), phase: 2 }), true);
  assert.equal(papicGuestPassAllowed({ profile: profileFor('corporate'), phase: 2 }), false);
  assert.equal(papicGuestPassAllowed({ profile: profileFor('corporate'), phase: 3 }), true);
});

test('the RSVP surface is required even for an in-scope type', () => {
  const noRsvp: EventTypeProfile = {
    ...GENERIC_PROFILE,
    eventType: 'birthday',
    enabledSurfaces: GENERIC_PROFILE.enabledSurfaces.filter((s) => s !== 'rsvp'),
  };
  const decision = papicGuestPassAccess({ profile: noRsvp });
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false ? decision.reason : null, 'no_rsvp_surface');
});
