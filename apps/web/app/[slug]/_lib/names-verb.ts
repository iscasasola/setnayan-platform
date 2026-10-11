/**
 * THE VERB AFTER THE HOSTS' NAMES AGREES WITH HOW MANY THEY ARE.
 *
 * A guest's walk, 2026-10-11 (fault N21): "Marco & Marga hasn't set up e-gifts
 * yet." / "Marco & Marga hasn't published their wedding recap." — two people,
 * a singular verb.
 *
 * WHO IS TWO is not decided here. It is the masthead's own answer
 * (`splitCoupleNames`): the event type has two people at its centre
 * (`EventWords.twoPeople` — a fact about the event, never punctuation alone:
 * "Ayala & Partners Year-End" is one host) AND the name really is two names.
 * So the cover that stacks "Marco / and / Marga" and the sentence that says
 * "Marco & Marga haven't" can never disagree about the same name.
 *
 * A name that is one line — one person, a company, "the couple" (the fallback
 * when an event has no name), "The host" — keeps the singular.
 *
 * 🛡 app/[slug]/_lib/names-verb.test.ts
 */
import { splitCoupleNames } from '../_components/pahina-masthead';

/** Is this name two people, by the masthead's own rule? */
export function namesAreTwo(displayName: string | null | undefined, twoPeople: boolean): boolean {
  const name = (displayName ?? '').trim();
  return name !== '' && splitCoupleNames(name, twoPeople).second !== null;
}

/** "hasn’t" after one host's name, "haven’t" after two. */
export function hasntAfter(displayName: string | null | undefined, twoPeople: boolean): 'hasn’t' | 'haven’t' {
  return namesAreTwo(displayName, twoPeople) ? 'haven’t' : 'hasn’t';
}
