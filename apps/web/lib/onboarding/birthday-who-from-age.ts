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
 *   • "A milestone (18 / 21)"    → the debut, 18 for women and 21 for men
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
import { milestoneAges, type Sex } from '@/lib/event-anchor';

/** The option keys offered by the birthday `who` question, in its own order. */
export type BirthdayWhoKey = 'kids' | 'milestone' | 'adult' | 'golden';

/** Oldest age still described by "A kids' party". */
export const KIDS_MAX_AGE = 12;
/** Youngest age described by "A golden one (50+)". */
export const GOLDEN_MIN_AGE = 50;

/**
 * The debut ages, taken from the app's OWN ladder rather than re-typed here:
 * 18 for women, 21 for men, and both when we do not know which.
 *
 * 🔑 THE DEBUT IS THE LINE BETWEEN A CHILD'S PARTY AND AN ADULT ONE. Owner,
 * 2026-08-20, about his own account: *"i am turning 40. that is not a kids'
 * party. that is an adult party since that is already above 21 (debut for
 * men)."* That is the rule this function now encodes — the boundary is a fact
 * about the person, not a number somebody picked.
 */
function debutAges(sex: Sex): number[] {
  return milestoneAges(sex).filter((a) => a === 18 || a === 21);
}

/**
 * The option an age answers, or null when there is nothing to answer with.
 *
 * ⚠ NULL IS A REAL ANSWER HERE AND IT MEANS "ASK". Three cases return it, and
 * the middle one is the reason this function was rewritten:
 *
 *   • a missing, fractional, negative or absurd age — nothing to reason from;
 *   • **a teenager below their debut.** The four options are a kids' party, the
 *     debut itself, an adult birthday and a golden one — and NONE of them is
 *     true of a 15-year-old. The previous cut of this function drew its line at
 *     12 and therefore answered "An adult birthday" for a 13-year-old, which is
 *     the exact mistake the owner corrected in the other direction. **When no
 *     option is true, asking is the honest answer**; guessing puts words in
 *     somebody's mouth on their own child's party;
 *   • an age whose meaning DEPENDS on a sex we do not hold — 19 and 20 are past
 *     a woman's debut but short of a man's, so with `sex` unknown they are
 *     genuinely undecidable and the flow asks.
 *
 * Everything at or above the debut resolves, which is why the owner's own case
 * (40, sex not on file) still answers without a question: 40 is above BOTH
 * debut ages, so it cannot be ambiguous.
 */
export function birthdayWhoFromAge(
  age: number | null | undefined,
  sex: Sex = null,
): BirthdayWhoKey | null {
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 1 || age > 130) return null;
  if (age <= KIDS_MAX_AGE) return 'kids';

  const debuts = debutAges(sex);
  if (debuts.includes(age)) return 'milestone';
  if (age >= GOLDEN_MIN_AGE) return 'golden';

  // Adult only once we are past EVERY debut age still in play. With sex on file
  // that is their own debut; without it, the older of the two — so an unknown
  // sex can never be told their 19th is an adult party when it might be a debut.
  const adultFrom = Math.max(...debuts) + 1;
  if (age >= adultFrom) return 'adult';

  return null;
}
