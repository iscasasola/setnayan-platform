import type { EventTypeProfile, ProfileSurface } from './event-type-profile';
import { surfaceEnabled } from './event-type-profile';

/**
 * WHICH PARTS OF THE EVENT HUB BELONG TO A WEDDING, AND ONLY A WEDDING.
 *
 * ── THE OWNER'S RULING, 2026-08-17 ──────────────────────────────────────────
 * *"of course there are parts that is dedicated for weddings but there are
 * parts that should also work for non wedding/other events."*
 *
 * The words half of that (S13) is done — every universal sentence now reads the
 * event type's own vocabulary. This is the other half: the parts that exist
 * BECAUSE it is a wedding must not appear on a birthday at all. **Wording them
 * generically would be the wrong fix; a seven-year-old does not need a
 * neutrally-phrased love story, he needs no love story.**
 *
 * ── THE LEAK, MEASURED 2026-08-18 (not inherited — re-checked) ──────────────
 * The event-type profile ALREADY RECORDS that Save-the-Date and monogram are
 * wedding-only: `GENERIC_PROFILE.enabledSurfaces` deliberately omits both, and
 * its own comment says why ("the STD cinematic reveal is a wedding-signature
 * feature and the monogram is couple-initials-shaped — both CONTENT, not a noun
 * swap, so they'd look broken for a non-wedding").
 *
 * **And the guest tree never reads those answers.** Measured across the whole
 * of `app/[slug]` plus `lib/site-body-plan.ts`: `surfaceEnabled` is called with
 * `'website'` eleven times and `'seating'` once. Never `save_the_date`. Never
 * `monogram`. `site-body-plan.ts` does not mention the event type at all — the
 * body is chosen from the CALENDAR alone.
 *
 * So a non-wedding created far enough ahead renders the **wedding Save-the-Date
 * film**, and its hero falls back to a **wedding-style lettered monogram**. The
 * owner saw the third one himself: a **Story tab on a seven-year-old's
 * birthday**.
 *
 * ── WHY THIS IS DATA-DRIVEN AND NOT `eventType === 'wedding'` ───────────────
 * 🔑 A hardcoded string would be wrong the day a vow-renewal type is added — it
 * is not a wedding, and it wants every one of these. So each part asks the
 * question that is ACTUALLY true of it:
 *
 *   · the film and the monogram ask the profile's own SURFACE list, which
 *     already carries the answer and which an admin can change without a deploy
 *   · the love story and the side labels ask whether the type HAS TWO NAMED
 *     PEOPLE (`personA` + `personB`) — because that is what those parts are
 *     about. A wedding has a bride and a groom; a birthday has neither.
 *
 * ── EXHAUSTIVE ON PURPOSE ───────────────────────────────────────────────────
 * `PART_RULE` is a `Record` over the union, so **adding a part without deciding
 * its rule is a TYPE ERROR, not a silent gap**. That is the shape
 * `WIDGET_PHASES` and `WIDGET_SPOTLIGHT` already use in this repo; it is copied
 * deliberately rather than invented.
 */

/** Every part that belongs to a wedding and only a wedding. */
export type WeddingOnlyPart =
  /** The Save-the-Date cinematic film and its five reveal openings. */
  | 'save_the_date_film'
  /** The lettered monogram medallion — couple-initials-shaped by construction. */
  | 'monogram_letters'
  /** "Our love story" — how the two of them met. */
  | 'love_story'
  /** "Bride's side" / "Groom's side" on a guest's seating row. */
  | 'side_labels';

/** How each part decides. Two shapes, both read from the profile. */
type PartRule =
  | { kind: 'surface'; surface: ProfileSurface }
  | { kind: 'two_named_people' };

const PART_RULE: Record<WeddingOnlyPart, PartRule> = {
  save_the_date_film: { kind: 'surface', surface: 'save_the_date' },
  monogram_letters: { kind: 'surface', surface: 'monogram' },
  love_story: { kind: 'two_named_people' },
  side_labels: { kind: 'two_named_people' },
};

export type WeddingOnlyParts = Record<WeddingOnlyPart, boolean>;

/**
 * Which of these parts may this event type show?
 *
 * ⚠ FAILS CLOSED IS WRONG HERE, AND SO IS FAILS OPEN — read this before
 * "simplifying" it. `resolveProfile` degrades to `WEDDING_PROFILE` for a
 * wedding and `GENERIC_PROFILE` for everything else on any error, and
 * GENERIC_PROFILE already excludes both surfaces and has null person names. So
 * a database hiccup lands on "no wedding-only parts", which is the safe answer
 * for the 15 non-wedding types and, for a wedding, only ever loses decoration —
 * never content the couple wrote. There is no third state to invent.
 */
export function resolveWeddingOnlyParts(profile: EventTypeProfile): WeddingOnlyParts {
  const twoNamedPeople = Boolean(
    profile.terminology.personA?.trim() && profile.terminology.personB?.trim(),
  );
  const out = {} as WeddingOnlyParts;
  for (const part of Object.keys(PART_RULE) as WeddingOnlyPart[]) {
    const rule = PART_RULE[part];
    out[part] =
      rule.kind === 'surface' ? surfaceEnabled(profile, rule.surface) : twoNamedPeople;
  }
  return out;
}

/** Every part, for tests and for anything that needs to enumerate them. */
export const WEDDING_ONLY_PARTS = Object.keys(PART_RULE) as WeddingOnlyPart[];
