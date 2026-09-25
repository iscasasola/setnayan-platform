/**
 * THE CINEMATIC REVEAL STOPS AT THE SAVE-THE-DATE.
 *
 * Owner 2026-09-14, looking at his own invitation: *"reveal should only be at
 * the save the date. remove it from this part of the event hub."* Asked whether
 * that meant the Event Hub alone or the invite link's first door as well, he
 * chose BOTH — so `cinematicRevealPlays` stayed ONE rule instead of splitting
 * into two that could drift.
 *
 * ── 🔴 THIS FILE USED TO ASSERT THE OPPOSITE, AND THAT IS WHY IT SURVIVES ───
 * It was `the-reveal-reaches-the-invitation.test.ts`, written on 2026-08-29 for
 * the owner's earlier ruling — *"event hub should also have the cinematic
 * reveal"*. Renamed and inverted rather than deleted, because the REASON the
 * old ruling existed is the cost of the new one and must not be lost: the
 * save-the-date window ENDS 90 days out (`STD_THRESHOLD_DAYS`), and inside
 * those 90 days is when most guests actually open the link. A couple who buys
 * the Cinematic Reveal now has an opening that plays only while the wedding is
 * still distant. The owner was shown that and chose this; it is a taste
 * decision about where a veil belongs, not something to "fix" later.
 *
 * ── WHAT THIS FILE PINS ─────────────────────────────────────────────────────
 * 1. The reveal covers exactly ONE stage. Not the invitation, not the day — a
 *    veil between a guest and their table number at the venue is a toll gate —
 *    and not the story, which has its own cover. Each exclusion is an owner
 *    ruling, so widening it means deleting an assertion and saying why.
 *
 * 2. 🔒 A WAKE CAN NEVER SEE A CINEMATIC VEIL. A solemn event is now excluded
 *    twice again (it never enters the save_the_date phase AND its profile has
 *    no `save_the_date` surface) — but the surface flag is still asserted here
 *    on its own, because a fence that is only redundant today is the one that
 *    fails silently tomorrow. Derived from the REAL `WAKE_PROFILE` through the
 *    REAL `resolveWeddingOnlyParts`, never a hand-typed `false`.
 *
 * 3. The rule is read off the shipped profiles rather than restated: whichever
 *    types may show the Save-the-Date film are exactly the types that may show
 *    its openings. `wedding-only-parts.ts` already defines that part as "The
 *    Save-the-Date cinematic film AND ITS FIVE REVEAL OPENINGS" — one part.
 *
 * ── 2026-09-25 · THE COUPLE MAY NOW WIDEN IT, PER EVENT ─────────────────────
 * The owner let each couple pick the stages (Save the Date · Invitation · On
 * the Day — "they can pick where the want to keep it"). This file still holds
 * the DEFAULT — a couple who never chose, which is every call below (no
 * `revealStages`) — and that default did not move. The couple's choice is held
 * by `the-couple-picks-where-the-reveal-plays.test.ts`.
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
/** The ONE stage the owner left the reveal on (2026-09-14). */
const REVEAL_PHASES: LifecyclePhase[] = ['save_the_date'];

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

test('the reveal plays on the save-the-date, and only there', () => {
  for (const phase of REVEAL_PHASES) {
    assert.equal(
      revealIn(phase, { weddingOnlyParts: resolveWeddingOnlyParts(WEDDING_PROFILE) }),
      true,
      `a wedding should get the reveal in ${phase}`,
    );
  }
});

test('the reveal does NOT play on the invitation, the day itself, or the story afterwards', () => {
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
