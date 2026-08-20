/**
 * birthday-who-from-age.ts — answering "Who's the birthday for?" from an age
 * the app already knows.
 *
 * The Year page prints the age on the row somebody taps ("Your birthday —
 * turning 40") and the create flow then asked them which age bracket their own
 * birthday was in. Owner, 2026-08-20: *"it also knows my birthday to be 40th.
 * why do i get asked for this?"*
 *
 * PURE, and deliberately its own module: the mapping is a product judgement
 * about four labels, so it is unit-testable without a wizard, and the wizard
 * imports a decision rather than embedding one.
 *
 * ── THE MAPPING IS READ OFF THE OPTIONS' OWN WORDS ─────────────────────────
 * `lib/onboarding/type-questions.ts` offers exactly four, and each states its
 * own range except one:
 *   • "A kids' party"            → no number given; a child's party
 *   • "A milestone (18 / 21)"    → the two numbers named
 *   • "A golden one (50+)"       → 50 and over
 *   • "An adult birthday"        → the only option with NO qualifier
 * So `adult` is the residue, which is why an unmapped age must land there and
 * never anywhere else.
 *
 * ⚠ THESE LABELS DO NOT MATCH THE OWNER-LOCKED MILESTONE LADDER, and this
 * module deliberately does NOT paper over that. The ladder is 1 · 7 · 18 (F) /
 * 21 (M) · 60 — it contains no 50, and it has two rungs (1 and 7) that the
 * "kids' party" option covers without naming. Reconciling the two is a copy and
 * product decision about what a customer is offered, not something a mapping
 * function may decide on its own: silently sorting a 60-year-old into an option
 * whose label says "50+" is honest, but silently *renaming* the option is not.
 * Mapping to what the labels SAY is the only choice that cannot mislead.
 *
 * 🔑 AND IT ONLY EVER PRE-ANSWERS. The screen is never removed and the answer is
 * never locked: a wrong guess costs one tap, an absent guess costs the question
 * being asked, which is exactly today's behaviour.
 */

/** The option keys offered by the birthday `who` question, in its own order. */
export type BirthdayWhoKey = 'kids' | 'milestone' | 'adult' | 'golden';

/** Oldest age still described by "A kids' party". */
export const KIDS_MAX_AGE = 12;
/** The two ages the milestone option names outright. */
export const MILESTONE_AGES: readonly number[] = [18, 21];
/** Youngest age described by "A golden one (50+)". */
export const GOLDEN_MIN_AGE = 50;

/**
 * The option an age answers, or null when there is nothing to answer with.
 *
 * Null — not a guess — for a missing, fractional, negative or absurd age: the
 * caller's contract is "pre-answer only when you actually know", and a bad
 * value must leave the question standing rather than fill it in wrongly.
 */
export function birthdayWhoFromAge(age: number | null | undefined): BirthdayWhoKey | null {
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 1 || age > 130) return null;
  if (age <= KIDS_MAX_AGE) return 'kids';
  if (MILESTONE_AGES.includes(age)) return 'milestone';
  if (age >= GOLDEN_MIN_AGE) return 'golden';
  return 'adult';
}
