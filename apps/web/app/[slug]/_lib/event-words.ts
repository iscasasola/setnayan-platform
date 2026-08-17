/**
 * THE GUEST TREE'S WORDS FOR WHO IS THROWING THIS EVENT.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The Event Hub asked the event type exactly ONE question — `surfaceEnabled(…,
 * 'website')`, i.e. "may this event have a public page at all?" — and never
 * asked it for the WORDS. Meanwhile every one of the 16 seeded types has
 * carried a full `terminology` block in production the whole time (birthday →
 * `celebrant`, corporate → `organizer`, graduation → `graduate`, travel →
 * `organizer`, everything else → `host`; wedding → `couple`).
 *
 * The result a PERSON met: a graduation's guests were told "The couple will
 * assign seats closer to the day", "The couple hasn't published the program",
 * "Every shot lands in the couple's gallery". Measured 2026-08-17: ~79
 * wedding-only words are READ BY A GUEST across the Hub.
 *
 * ── THE OWNER'S RULING, 2026-08-17 — THIS IS A SORT, NOT A STRIP ────────────
 * "of course there are parts that is dedicated for weddings but there are parts
 * that should also work for non wedding/other events."
 *
 * So this helper is deliberately NARROW. It serves ONLY the parts whose JOB is
 * universal and whose WORDS assume a wedding — the seating rooms, the gift
 * page, the day-of hub, the empty plates. It must never be used to neutralise a
 * part that exists BECAUSE it is a wedding (the two-name masthead, the love
 * story, the bride's and groom's sides, the cinematic reveals, the tea
 * ceremony). Those keep every wedding word they have; hiding them for other
 * types is a separate mechanism that does not exist yet.
 *
 * ── THE SAFETY PROPERTY, AND IT IS ASSERTED ─────────────────────────────────
 * 🔒 A WEDDING MUST READ BYTE-IDENTICALLY TO BEFORE THIS FILE EXISTED.
 * `organizerNoun` is `'couple'` for the wedding profile, so every rewritten
 * sentence reproduces its old text exactly. `event-words.test.ts` pins the
 * literal strings; if a future edit changes what a wedding guest reads, that
 * test fails rather than the change shipping quietly. Prod is 3 weddings, 2
 * simple events and 1 date — so the wedding arm is the ONLY arm anyone has
 * ever seen, and it is the one that must not move.
 *
 * ── DEGRADING ───────────────────────────────────────────────────────────────
 * `resolveProfile` already degrades to `WEDDING_PROFILE` for 'wedding' and
 * `GENERIC_PROFILE` (`organizerNoun: 'host'`) for anything else on any DB
 * error, and is React-`cache()`d per request. A hiccup therefore reads "the
 * host", which is correct-but-plain for every non-wedding type — never wrong.
 */
import { resolveProfile, type EventTypeProfile } from '@/lib/event-type-profile';

/** The typographic apostrophe the guest tree writes everywhere. Never `'`. */
const APOSTROPHE = '’';

export type EventWords = {
  /** Bare noun, lower case — 'couple' · 'host' · 'celebrant' · 'graduate'. */
  organizer: string;
  /** 'the couple' — mid-sentence. */
  theOrganizer: string;
  /** 'The couple' — sentence-initial. */
  TheOrganizer: string;
  /** 'the couple’s' — mid-sentence possessive. */
  theOrganizerPossessive: string;
  /** 'The couple’s' — sentence-initial possessive. */
  TheOrganizerPossessive: string;
  /** 'wedding' · 'birthday' · 'graduation' · 'event'. */
  eventWord: string;
};

/** 'couple' → 'couple’s'. A noun already ending in s takes the bare mark
 *  ('parents' → 'parents’'), which is why this is a function and not a `+ "’s"`
 *  at each call site. No seeded value ends in s today; one added later would
 *  otherwise read "parents’s". */
function possessiveOf(noun: string): string {
  return noun.endsWith('s') ? `${noun}${APOSTROPHE}` : `${noun}${APOSTROPHE}s`;
}

/**
 * Pure — derive the words from an already-resolved profile. Exported so tests
 * and any caller that ALREADY holds a profile (several pages resolve one for
 * the surface gate) can avoid a second resolve.
 */
export function eventWordsFromProfile(profile: EventTypeProfile): EventWords {
  // A blank/whitespace noun would render "The  will assign seats". The seeds are
  // all populated, but this file is downstream of an admin-editable table.
  const organizer = profile.terminology.organizerNoun?.trim() || 'host';
  const eventWord = profile.terminology.eventWord?.trim() || 'event';
  const possessive = possessiveOf(organizer);
  return {
    organizer,
    theOrganizer: `the ${organizer}`,
    // Only the article takes the capital — "The couple", never "The Couple".
    TheOrganizer: `The ${organizer}`,
    theOrganizerPossessive: `the ${possessive}`,
    TheOrganizerPossessive: `The ${possessive}`,
    eventWord,
  };
}

/** Resolve the words for an event type. `null` → wedding, matching every other
 *  guest-tree call site (`resolveProfile(event.event_type ?? 'wedding')`). */
export async function eventWordsFor(
  eventType: string | null | undefined,
): Promise<EventWords> {
  return eventWordsFromProfile(await resolveProfile(eventType ?? 'wedding'));
}
