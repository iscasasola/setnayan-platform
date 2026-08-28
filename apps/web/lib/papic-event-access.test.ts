/**
 * Guard suite for the Papic Buong Araw (SKU PAPIC_GUEST) event-type predicate.
 *
 * Phase-0 gate 0h of `Papic_Access_Scope_Council_Verdict_2026-07-20.md` scoped
 * the pass to types where the host writes the guest roster. That TYPE axis was
 * collapsed by OWNER DECISION on 2026-08-01 — "Drop the travel exclusion —
 * offer Papic everywhere" — so what these tests now lock is the opposite
 * property: **no live event type may fall outside the offer**, plus the two
 * things that must survive the widening (the `rsvp` surface gate, and the
 * fail-closed default for a type newer than the ruling).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ANCHOR_BY_TYPE } from './event-anchor';
import {
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  WEDDING_PROFILE,
  type EventTypeProfile,
} from './event-type-profile';
import { AI_TIER_BY_EVENT_TYPE } from './setnayan-ai-type-pricing';
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
 * DO enable `rsvp`. That is why the phase sets — not the surface check — are
 * what actually scope the pass.
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
  // Pinned as a literal so NARROWING the pass stays a deliberate edit with a
  // test diff attached. All 16 live types, since the owner's 2026-08-01
  // "offer Papic everywhere" — the first eight are the original closed-roster
  // set, the last eight were freed by that ruling.
  assert.deepEqual([...PAPIC_ACCESS_PHASE_1_TYPES], [
    'wedding',
    'debut',
    'birthday',
    'christening',
    'gender_reveal',
    'graduation',
    'simple_event',
    'travel',
    'anniversary',
    'reunion',
    'celebration',
    'gala_night',
    'corporate',
    'tournament',
    'date',
    'hangout',
    // Added with the type (2026-08-24, W4-WORDS) under the standing 2026-08-01
    // "offer Papic everywhere" ruling — see the array's own comment.
    'wake',
  ]);
});

test('EVERY live event type is offered Papic — "everywhere" means everywhere', () => {
  // ⚠ THE POINT OF THIS TEST: it is driven from the ROSTER, not from a list
  // copied out of papic-event-access.ts. Asserting the Phase-1 array against a
  // literal (above) only proves the array did not change; it cannot notice a
  // type the PRODUCT has and Papic does not. That is exactly the gap that let
  // "offer Papic everywhere" ship on 2026-08-01 while eight of the sixteen
  // types were still denied.
  //
  // The roster source is the union of the two authored per-type maps that must
  // already be touched whenever a type is added:
  //   • ANCHOR_BY_TYPE      (lib/event-anchor.ts — "the AUTHORED SOURCE OF TRUTH")
  //   • AI_TIER_BY_EVENT_TYPE (lib/setnayan-ai-type-pricing.ts)
  // Both carry exactly the 16 rows of `public.event_type_vocab` that are
  // status='active' AND enabled=true (verified against prod 2026-08-01).
  //
  // 🪤 A type created from /admin/event-types needs NO code change, so no unit
  // test can see it. This catches the case a DEVELOPER can cause. The DB case is
  // deliberately left fail-closed by `phaseForType()` — see the test below.
  const roster = [
    ...new Set([...Object.keys(ANCHOR_BY_TYPE), ...Object.keys(AI_TIER_BY_EVENT_TYPE)]),
  ].sort();

  assert.equal(roster.length, 17, `the live roster is 17 types, got ${roster.length}`);

  const denied: string[] = [];
  for (const eventType of roster) {
    // Test BOTH controllers. The anniversary carve-out that survived until
    // 2026-08-01 was invisible to any test that only passed communityId: null.
    for (const communityId of [null, 'S89C-0000000001']) {
      const decision = papicGuestPassAccess({ profile: profileFor(eventType), communityId });
      if (!decision.allowed) denied.push(`${eventType} (community_id=${communityId})`);
    }
  }

  assert.deepEqual(
    denied,
    [],
    `OWNER DECISION 2026-08-01 — "Drop the travel exclusion — offer Papic ` +
      `everywhere." These live types are NOT offered Papic: ${denied.join(', ')}. ` +
      `Add them to PAPIC_ACCESS_PHASE_1_TYPES, or get an owner decision to ` +
      `narrow the offer and update this test with it.`,
  );
});

test('anniversary no longer splits on the controller', () => {
  // Until 2026-08-01 `phaseForType()` early-returned Phase 2 for a Samahan-owned
  // anniversary BEFORE consulting any phase list — so putting `anniversary` in
  // PHASE_1 would have been a no-op edit that read like a fix. Locked so the
  // split cannot creep back in unnoticed.
  const profile = profileFor('anniversary');

  for (const communityId of [null, undefined, 'S89C-0000000001']) {
    const decision = papicGuestPassAccess({ profile, communityId });
    assert.equal(decision.allowed, true, `anniversary with community_id=${communityId}`);
    assert.equal(decision.allowed === true ? decision.phase : null, 1);
  }
});

test('travel is ALLOWED — the exclusion was dropped by owner decision 2026-08-01', () => {
  // OWNER DECISION 2026-08-01: "Drop the travel exclusion — offer Papic
  // everywhere." This test is the inverse of the one it replaces; if it starts
  // failing, someone has re-added a deny for travel. That is an owner call, not
  // a bug fix — check DECISION_LOG.md before "restoring" anything.
  const profile = profileFor('travel');
  assert.ok(
    profile.enabledSurfaces.includes('rsvp'),
    'fixture must mirror prod (migration 20270804110223 added rsvp to every non-wedding row)',
  );

  const decision = papicGuestPassAccess({ profile });
  assert.equal(decision.allowed, true, 'travel must be offered Papic');
  assert.equal(decision.allowed === true ? decision.phase : null, 1);

  // Allowed at EVERY phase, since it sits in the Phase-1 set.
  for (const phase of [1, 2, 3] as const) {
    assert.equal(papicGuestPassAllowed({ profile, phase }), true, `travel at phase ${phase}`);
  }
  // …and it IS in a phase set — being absent from all of them would fail closed.
  const sets: readonly string[] = [
    ...PAPIC_ACCESS_PHASE_1_TYPES,
    ...PAPIC_ACCESS_PHASE_2_TYPES,
    ...PAPIC_ACCESS_PHASE_3_TYPES,
  ];
  assert.equal(sets.includes('travel'), true);
});

test('date + hangout are ALLOWED — the fail-closed default no longer catches them', () => {
  // ⚠ THIS TEST IS THE INVERSE OF THE ONE IT REPLACES. Until 2026-08-01 these
  // two sat in no phase set and were denied `type_out_of_scope`; a prior
  // instruction had explicitly left them untiered. The owner withdrew that on
  // 2026-08-01 — "offer Papic everywhere" — so they are Phase 1 like the rest.
  // If this starts failing, someone re-narrowed the offer. Check DECISION_LOG.md
  // before "restoring" anything.
  for (const eventType of ['date', 'hangout'] as const) {
    const profile = profileFor(eventType);
    assert.ok(profile.enabledSurfaces.includes('rsvp'), `${eventType} fixture carries rsvp`);
    const decision = papicGuestPassAccess({ profile });
    assert.equal(decision.allowed, true, `${eventType} must be offered Papic`);
    assert.equal(decision.allowed === true ? decision.phase : null, 1);
  }
});

test('simple_event is in scope, but still needs the RSVP surface', () => {
  // PROD shape: the profile ROW carries `rsvp` (migration 20270804110223 added
  // it to every non-wedding row), and simple_event joined PHASE_1 on
  // 2026-07-31 — the free 50-pt pool arms at create and onboarding sells all
  // three paid Pool rungs on this type, so the gate must not retract it.
  const withRsvp: EventTypeProfile = {
    ...SIMPLE_PROFILE,
    enabledSurfaces: [...SIMPLE_PROFILE.enabledSurfaces, 'rsvp'],
  };
  const live = papicGuestPassAccess({ profile: withRsvp });
  assert.equal(live.allowed, true, 'prod simple_event carries rsvp ⇒ allowed');
  assert.equal(live.allowed === true ? live.phase : null, 1);

  // FALLBACK shape: the hardcoded SIMPLE_PROFILE (used only when the DB read
  // fails) has no `rsvp`, and the surface check still governs — being in a
  // phase set is necessary, never sufficient. A degraded read closes the door
  // rather than guessing it open.
  const degraded = papicGuestPassAccess({ profile: SIMPLE_PROFILE });
  assert.equal(degraded.allowed, false);
  assert.equal(
    degraded.allowed === false ? degraded.reason : null,
    'no_rsvp_surface',
  );
});

test('a type outside every phase set is denied (fail-closed)', () => {
  const decision = papicGuestPassAccess({ profile: profileFor('pet_adoption_party') });
  assert.equal(decision.allowed, false, 'a new event type must not inherit the pass');
  assert.equal(decision.allowed === false ? decision.reason : null, 'type_out_of_scope');
});

test('Phases 2 and 3 are empty, and no type is in two phases at once', () => {
  // The ladder was collapsed on 2026-08-01, not deleted: it stays as the
  // re-tiering mechanism (and keeps the self-join-hardening / CSAM-matcher /
  // NPC Circular 16-02 gates greppable in the source). Emptiness is asserted so
  // a half-move — a type left in BOTH a higher phase and PHASE_1 — is caught;
  // PHASE_1 wins the lookup, so such a row would be a silent lie.
  assert.deepEqual([...PAPIC_ACCESS_PHASE_2_TYPES], []);
  assert.deepEqual([...PAPIC_ACCESS_PHASE_3_TYPES], []);

  for (const eventType of [...PAPIC_ACCESS_PHASE_2_TYPES, ...PAPIC_ACCESS_PHASE_3_TYPES]) {
    assert.ok(
      !(PAPIC_ACCESS_PHASE_1_TYPES as readonly string[]).includes(eventType),
      `${eventType} is in Phase 1 AND a later phase — the later phase is dead text`,
    );
  }

  // The ladder still WORKS: a type parked at a higher phase would be denied
  // today and reachable under an explicit override. Proven with a hypothetical
  // so the mechanism is tested without re-narrowing a live type.
  const parked = profileFor('some_future_gated_type');
  assert.equal(papicGuestPassAllowed({ profile: parked }), false);
  assert.equal(
    papicGuestPassAllowed({ profile: profileFor('corporate'), phase: 1 }),
    true,
    'corporate is Phase 1 since 2026-08-01 — it was Phase 3',
  );
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
