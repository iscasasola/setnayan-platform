/**
 * THE CINEMATIC REVEAL REACHES THE INVITATION — AND STOPS THERE.
 *
 * Owner 2026-08-29: *"event hub should also have the cinematic reveal."*
 * "Also" is an addition, not a move.
 *
 * 🔴 WHAT IT WAS. The five cinematic openings — the veil, the flaps, the church
 * doors — already rendered on the Event Hub, gated by ONE line:
 * `revealEnabled: showSaveTheDate`. So they only ever played while the event was
 * still far enough out to sit in its save-the-date window. The moment the page
 * became the invitation, the reveal stopped forever — which is the moment most
 * guests actually open the link. A couple paid for an opening nearly none of
 * their guests would ever meet.
 *
 * ── WHAT THIS FILE PINS, AND WHY EACH ONE IS DERIVED ────────────────────────
 * 1. The reveal covers exactly two stages: the save-the-date window and the
 *    invitation. NOT the day itself — a veil between a guest and their table
 *    number at the venue is a toll gate — and NOT the story afterwards, which
 *    has its own cover. Both exclusions are owner rulings, so a future widening
 *    has to delete an assertion and say why.
 *
 * 2. 🔒 A WAKE CAN NEVER SEE A CINEMATIC VEIL OVER ITS INVITATION, and this is
 *    the assertion that actually earns its keep. Before this change a wake was
 *    excluded TWICE — it never enters the save_the_date phase (gated on the
 *    solemn register) and its profile has no `save_the_date` surface. A wake
 *    DOES reach the invitation, so the first of those two protections is gone
 *    here and the surface flag is the whole fence.
 *    It is derived from the REAL `WAKE_PROFILE` through the REAL
 *    `resolveWeddingOnlyParts`, never from a hand-typed `false` — a hand-typed
 *    fixture would keep passing after somebody enabled the surface on wakes.
 *
 * 3. The rule is read off the shipped profiles rather than restated: whichever
 *    types may show the Save-the-Date film are exactly the types that may show
 *    its openings. `wedding-only-parts.ts` already defines that part as "The
 *    Save-the-Date cinematic film AND ITS FIVE REVEAL OPENINGS" — one part, so
 *    this applies an existing rule rather than inventing a second one.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSiteBodyPlan } from './site-body-plan';
import { type LifecyclePhase } from './invitation-widgets';
import { resolveWeddingOnlyParts } from './wedding-only-parts';
import { WAKE_PROFILE, WEDDING_PROFILE, GENERIC_PROFILE } from './event-type-profile';

const PHASES: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
/** The two stages the owner put the reveal on. */
const REVEAL_PHASES: LifecyclePhase[] = ['save_the_date', 'rsvp'];

function revealIn(
  phase: LifecyclePhase,
  overrides: Partial<Parameters<typeof resolveSiteBodyPlan>[0]> = {},
): boolean {
  return resolveSiteBodyPlan({
    identity: 'anonymous',
    phasesEnabled: true,
    lifecyclePhase: phase,
    stdFilm: true,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: true,
    liveMediaPublic: false,
    widgets: [],
    ...overrides,
  }).revealEnabled;
}

test('the guard is not vacuous — the phase list and the profiles are real', () => {
  assert.equal(PHASES.length, 4, 'the lifecycle has four stages');
  // If these ever scanned empty, every assertion below would be about nothing.
  assert.ok(WEDDING_PROFILE.eventType === 'wedding');
  assert.ok(WAKE_PROFILE.eventType === 'wake');
  assert.equal(WAKE_PROFILE.terminology.register, 'solemn');
});

test('the reveal plays on the save-the-date AND the invitation', () => {
  for (const phase of REVEAL_PHASES) {
    assert.equal(
      revealIn(phase, { weddingOnlyParts: resolveWeddingOnlyParts(WEDDING_PROFILE) }),
      true,
      `a wedding should get the reveal in ${phase}`,
    );
  }
});

test('the reveal does NOT play on the day itself or on the story afterwards', () => {
  for (const phase of PHASES.filter((p) => !REVEAL_PHASES.includes(p))) {
    assert.equal(
      revealIn(phase, { weddingOnlyParts: resolveWeddingOnlyParts(WEDDING_PROFILE) }),
      false,
      `${phase} must open straight to the page — owner ruling, not an oversight`,
    );
  }
});

test('a WAKE can never get a cinematic veil, in ANY stage', () => {
  // Derived from the shipped profile, so enabling the surface on wakes fails
  // here rather than quietly putting a veil over a funeral's invitation.
  const wakeParts = resolveWeddingOnlyParts(WAKE_PROFILE);
  assert.equal(
    wakeParts.save_the_date_film,
    false,
    'the wake profile gained a save-the-date surface — a solemn event must not ' +
      'get the cinematic openings; decide that deliberately before changing this',
  );
  for (const phase of PHASES) {
    assert.equal(revealIn(phase, { weddingOnlyParts: wakeParts }), false, `wake in ${phase}`);
  }
});

test('an event type with no Save-the-Date film gets no openings either', () => {
  // One part, not two — so the ordinary non-wedding types are covered by the
  // same rule as the wake, without naming any of them here.
  const genericParts = resolveWeddingOnlyParts(GENERIC_PROFILE);
  assert.equal(genericParts.save_the_date_film, false, 'GENERIC_PROFILE gained the surface');
  for (const phase of PHASES) {
    assert.equal(revealIn(phase, { weddingOnlyParts: genericParts }), false, `generic in ${phase}`);
  }
});

test('the phases flag still switches the whole thing off', () => {
  for (const phase of PHASES) {
    assert.equal(
      revealIn(phase, {
        phasesEnabled: false,
        weddingOnlyParts: resolveWeddingOnlyParts(WEDDING_PROFILE),
      }),
      false,
      `phasesEnabled=false must collapse the reveal in ${phase}`,
    );
  }
});
