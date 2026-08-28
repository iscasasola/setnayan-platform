/**
 * solemn-content.ts — the experience-quiz + persona-reveal copy for a SOLEMN
 * event (the funeral, `event_type_profiles.terminology.register = 'solemn'`).
 *
 * ─── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The 2026-08-24 solemn build (W4-WORDS, PR #4793) threaded the register through
 * the GUEST tree — no countdown, no save-the-date, "A gift of sympathy" — and
 * stopped at the front door. ONBOARDING was never threaded, so a family
 * arranging a wake was asked, verbatim and in this order:
 *
 *   "What would make the day unforgettable?"
 *     → "Our guests' experience — everyone leaves saying it was the best
 *        CELEBRATION they've been to."
 *   "How big does it feel?"        → "Grand & full-house — a big celebration,
 *                                     the more the merrier."
 *   "What's the energy of the day?" → "JOYFUL & LIVELY — music, dancing, and a
 *                                     packed floor."
 *   "Where does your CELEBRATION lean?"
 *   "How much do you want to do?"  → "GO ALL OUT — every detail, every wow
 *                                     moment."
 *
 * and was then handed a persona card reading **"The Grand Celebration — the
 * celebration everyone talks about, a packed floor, every guest part of the
 * night."** That is the single worst thing this product can say to anybody, and
 * it was live from the hour the funeral type shipped.
 *
 * ─── WHY CODE AND NOT AN ADMIN ROW ──────────────────────────────────────────
 * `event_type_onboarding.axis_overrides` / `reveal_overrides` exist and would
 * carry this copy — and they FAIL OPEN. `getOnboardingSpec` degrades to the
 * defaults on any read error, so a DB hiccup would put "Joyful & lively" back in
 * front of a grieving family. Same reasoning, same shape, as `WAKE_PROFILE`
 * in lib/event-type-profile.ts, whose own migration says a hiccup "must never
 * flip a wake's page back to 'The celebration is underway'". The admin override
 * still layers on top of THIS base — HQ can still edit the words, it just cannot
 * lose them.
 *
 * ─── KEYED ON THE REGISTER, NEVER ON `eventType === 'wake'` ────────────────
 * Deliberate, and it is the precedent the solemn build already set: the next
 * solemn type (a memorial, an anniversary of a death) inherits this by declaring
 * its register, with no second list to remember.
 *
 * 🔒 AXIS IDS AND OPTION KEYS ARE LOCKED. `resolvePersona` is a pure lookup over
 * (for_whom · feel · energy · roots · effort) × their option keys; changing a key
 * here silently resolves every solemn answer to no persona. Only the WORDS
 * change. `solemn-onboarding.test.ts` pins both directions.
 */
import type { ExpAxis } from '@/app/onboarding/wedding/_data/experience-personas';
import type { GenericPersonaReveal } from './generic-content';

/**
 * The five axes, asked of a bereaved family. Same ids, same option keys, same
 * ORDER as GENERIC_EXP_AXES — a wake answers the same five questions about
 * scale, tone, custom and how much help it wants, because those are the four
 * things the plan is built from. It is only the wording that was a defect.
 */
export const SOLEMN_EXP_AXES: ExpAxis[] = [
  {
    id: 'for_whom',
    eyebrow: 'What matters',
    question: 'What matters most in the days ahead?',
    options: [
      { key: 'couple', title: 'What the family keeps', desc: 'Photographs, words, and a record of the days — something to return to.' },
      { key: 'guests', title: 'Those who come to pay respects', desc: 'That everyone who visits is received and fed and looked after.' },
      { key: 'both', title: 'Both, equally', desc: 'The family cared for, and the door well kept.' },
    ],
  },
  {
    id: 'feel',
    eyebrow: 'The gathering',
    question: 'How many do you expect?',
    options: [
      { key: 'intimate', title: 'Close family only', desc: 'A quiet wake among the nearest.' },
      { key: 'midsize', title: 'Family and close friends', desc: 'A steady stream over the nights of the lamay.' },
      { key: 'grand', title: 'A large gathering', desc: 'Many will come. The doors stay open.' },
    ],
  },
  {
    id: 'energy',
    eyebrow: 'The tone',
    question: 'How would you like the days to feel?',
    options: [
      { key: 'calm', title: 'Quiet and prayerful', desc: 'Novena nights, soft music, and time to sit.' },
      { key: 'lively', title: 'Warm, and full of stories', desc: 'Coffee, food, and people remembering out loud.' },
      { key: 'refined', title: 'Formal and composed', desc: 'A dignified service, carefully kept.' },
    ],
  },
  {
    id: 'roots',
    eyebrow: 'The customs',
    question: 'How closely will you keep to tradition?',
    options: [
      { key: 'tradition', title: 'The customs kept in full', desc: 'The Mass, the nine nights of prayer, everything as it should be.' },
      { key: 'modern', title: 'Simply and plainly', desc: 'Without the longer observances.' },
      { key: 'blend', title: 'A little of both', desc: 'The customs that matter to you, kept simply.' },
    ],
  },
  {
    id: 'effort',
    eyebrow: 'The help',
    question: 'How much should we take off your hands?',
    options: [
      { key: 'simple', title: 'Only what must be arranged', desc: 'The few essentials, and nothing more.' },
      { key: 'balanced', title: 'The main arrangements', desc: 'The essentials, plus the parts that take time to find.' },
      { key: 'allout', title: 'As much as we can', desc: 'Let us line up everything, so the family need not.' },
    ],
  },
];

/**
 * The reveal, per persona key. Every key in GENERIC_PERSONA_REVEAL is present —
 * a missing one would fall through to "The Grand Celebration", which is the
 * defect this file exists to remove. `solemn-onboarding.test.ts` asserts the key
 * sets are identical.
 *
 * ⚖ `feel` is 'timeless' for ALL SIX, deliberately. It seeds the mood-board
 * palette (`events.mood_feel_key`, an 8-value CHECK), and the celebratory
 * personas seed 'glam' / 'boho' / 'filipiniana'. A wake gets one dignified
 * palette rather than six moods; 'timeless' is a legal value of that CHECK, so
 * nothing can be refused at the commit.
 */
export const SOLEMN_PERSONA_REVEAL: Record<string, GenericPersonaReveal> = {
  keepsake: {
    name: 'Something to Keep',
    tagline: 'A remembrance the family can return to — the photographs, the words, the day itself.',
    feel: 'timeless',
  },
  big_celebration: {
    name: 'The Wide Circle',
    tagline: 'Many will come to pay their respects. We will help you receive them.',
    feel: 'timeless',
  },
  best_of_both: {
    name: 'Held With Care',
    tagline: 'Your family looked after, and everyone who comes received well.',
    feel: 'timeless',
  },
  intimate_romance: {
    name: 'Close and Quiet',
    tagline: 'A small gathering, kept gentle and near.',
    feel: 'timeless',
  },
  modern_statement: {
    name: 'Simple and Clear',
    tagline: 'Plainly and beautifully done, without excess.',
    feel: 'timeless',
  },
  rooted_tradition: {
    name: 'As Tradition Asks',
    tagline: 'The Mass, the nine nights of prayer, and the customs kept — with those far away brought close.',
    feel: 'timeless',
  },
};

/** The register a type's onboarding copy is authored in. Mirrors
 *  `ProfileTerminology['register']` without importing the profile module. */
export type OnboardingRegister = 'celebratory' | 'solemn';

/** The base axes for a register. Admin `axis_overrides` layer on top of this. */
export function baseAxesFor(register: OnboardingRegister, celebratory: ExpAxis[]): ExpAxis[] {
  return register === 'solemn' ? SOLEMN_EXP_AXES : celebratory;
}
