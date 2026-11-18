/**
 * lib/client-words.ts — WHAT A SUPPLIER CALLS THIS CLIENT, AND WHETHER THE NAME IS ONE PERSON OR TWO. Pure.
 *
 * 🔴 WHY (owner, 17 Nov 2026, event "Debut 18"): the supplier's client workspace said "Questions for the couple",
 * "Add a note about this couple…" and a notification said "This couple previously booked you" — on a DEBUT. And
 * "Wanda & Indigo has asked you…" — two people, a singular verb.
 *
 * 🔒 NOTHING NEW IS DECIDED HERE. The noun is the event type's own shipped word, `terminology.organizerNoun` from
 * `resolveProfile` (admin-editable `event_type_profiles`: 'couple' · 'celebrant' · 'host' · 'organizer' · 'family'
 * …) — the same word the couple-side Studio pages already use. Whether a name is two people is the masthead's own
 * shipped rule, `splitCoupleNames` ("Maria & Juan" · "Ana and Leo"). A sentence about EVERY client (the forms
 * library is shared across all of them) says "client" — it is not about this event's kind.
 *
 * 🔒 lib/client-words.test.ts
 */
import type { EventTypeProfile } from '@/lib/event-type-profile';
import { splitCoupleNames } from '@/lib/split-names';

/** The neutral word when the event's kind could not be read — never "couple", which is wrong for every non-wedding. */
export const CLIENT_NOUN_FALLBACK = 'client';

/** The event type's own word for who runs it ("couple" · "celebrant" · "host" …). */
export function clientNounOf(profile: Pick<EventTypeProfile, 'terminology'> | null | undefined): string {
  const n = profile?.terminology.organizerNoun?.trim().toLowerCase();
  return n || CLIENT_NOUN_FALLBACK;
}

/** "Wanda & Indigo" / "Ana and Leo" name two people; "Debut 18" · "A couple" name one subject. */
export function namesTwoPeople(name: string): boolean {
  return splitCoupleNames(name.trim()).second !== null;
}

/** The verb that agrees with the name: `agree('Wanda & Indigo', 'has', 'have')` → "have". */
export function agree(name: string, singular: string, plural: string): string {
  return namesTwoPeople(name) ? plural : singular;
}

/** The returning-client lead line on a first inquiry ("This celebrant previously booked you for Debut 18."). */
export function returningClientLine(noun: string, priorEventName: string): string {
  return `This ${noun} previously booked you for ${priorEventName}.`;
}

/** Strips {@link returningClientLine} off a stored body — any noun, so rows written before this change still strip. */
export const RETURNING_CLIENT_LEAD = /^This [a-z][a-z ]*? previously booked you for [^.]*\.\s*/;
