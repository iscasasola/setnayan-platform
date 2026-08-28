/**
 * birthday-milestone-from-age.ts — answering the details screen's "Milestone"
 * from an age the flow is already holding.
 *
 * 🔴 THE DEFECT. Owner, 2026-08-28, looking at the details screen of his own
 * 40th: *"some of these were answered already like, Celebrant, Turning, what
 * kind of milestone (40)."* He is right, and the shape of it is worse than a
 * repeat: three screens earlier the flow had **skipped the party-type question
 * because it knew the answer**, and then asked the same thing again here under a
 * different word. *The flow proved it knew, and asked anyway.*
 *
 * 🔑 WHY THIS IS NOT `birthdayWhoFromAge` WITH A DIFFERENT RETURN TYPE. The two
 * questions use two vocabularies that were written years apart: the `who`
 * question offers four broad options (kids · milestone · adult · golden), while
 * this field offers ten specific rungs (`1st_birthday` … `100th` ·
 * `adult_regular`). One is not derivable from the other — `kids` covers three of
 * these rungs — so the age is mapped to each of them SEPARATELY, from the age.
 * Collapsing them would have made one question's coarser answer decide the
 * other's finer one.
 *
 * ── THE MAPPING IS READ OFF THE OPTIONS' OWN WORDS, as its sibling's is ─────
 *   1                    → `1st_birthday`
 *   7                    → `7th_birthday`
 *   2–12, otherwise      → `kids_regular`
 *   18                   → `18th_debut`
 *   60 · 75 · 80 · 90 · 100 → their own rungs, EXACTLY (not "60 and over")
 *   past every debut     → `adult_regular`
 *
 * ⚠ **21 RETURNS NULL, DELIBERATELY, AND IT IS THE MOST IMPORTANT LINE HERE.**
 * The owner-locked ladder makes 21 a man's debut, and this field has no
 * `21st_debut` rung — only one labelled *"18th (debut)"*. Answering a man's 21st
 * with an option that says 18th would be putting a wrong word in his mouth about
 * his own party, and answering `adult_regular` would erase the milestone. When
 * no option is TRUE, asking is the honest answer. Adding the rung is a product
 * decision about what a customer is offered, not one a mapping may take.
 *
 * ⚠ AND THE ELDER RUNGS ARE EXACT AGES, NOT FLOORS. A 61st is not a 60th and
 * `adult_regular` is the truthful answer for it; the ladder names 60 as the
 * milestone, not "60 onwards". The sibling's `golden` option says "60+" in its
 * own label, which is why the two functions disagree at 61 **on purpose**.
 *
 * 🔑 AND IT ONLY EVER PRE-ANSWERS. The field is never removed, never locked, and
 * a wrong guess costs one tap — the same contract the party-type answer keeps.
 */
import { milestoneAges, type Sex } from '@/lib/event-anchor';
import { KIDS_MAX_AGE } from '@/lib/onboarding/birthday-who-from-age';

/** The rungs the birthday `milestone_type` field offers, in its own order. */
export type BirthdayMilestoneKey =
  | '1st_birthday'
  | '7th_birthday'
  | 'kids_regular'
  | '18th_debut'
  | '60th'
  | '75th'
  | '80th'
  | '90th'
  | '100th'
  | 'adult_regular';

/** The elder rungs, each an EXACT age. */
const ELDER: ReadonlyMap<number, BirthdayMilestoneKey> = new Map([
  [60, '60th'],
  [75, '75th'],
  [80, '80th'],
  [90, '90th'],
  [100, '100th'],
]);

/**
 * The rung an age answers, or null when there is nothing honest to answer with.
 *
 * Null means ASK, and it is a real answer in four cases: no readable age; a
 * teenager below their debut (none of the rungs is true of a 15-year-old); a
 * 21st, which has no rung of its own; and 19–20 with no sex on file, where the
 * age is past a woman's debut and short of a man's and is genuinely undecidable.
 */
export function birthdayMilestoneFromAge(
  age: number | null | undefined,
  sex: Sex = null,
): BirthdayMilestoneKey | null {
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 1 || age > 130) return null;

  if (age === 1) return '1st_birthday';
  if (age === 7) return '7th_birthday';
  if (age <= KIDS_MAX_AGE) return 'kids_regular';

  // The debut ages taken from the app's OWN ladder, never re-typed: 18 for
  // women, 21 for men, both when we do not know which.
  const debuts = milestoneAges(sex).filter((a) => a === 18 || a === 21);
  if (age === 18 && debuts.some((d) => d === 18)) return '18th_debut';
  // 21 is a debut with no rung to name it — see the docblock. Ask.
  if (debuts.some((d) => d === age)) return null;

  const elder = ELDER.get(age);
  if (elder) return elder;

  // Adult only once we are past EVERY debut age still in play, so an unknown sex
  // is never told their 19th is an ordinary adult birthday when it might be a
  // debut.
  if (age >= Math.max(...debuts) + 1) return 'adult_regular';

  return null;
}
