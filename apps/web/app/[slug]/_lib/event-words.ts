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
import {
  resolveProfile,
  resolveProfileByEvent,
  type EventTypeProfile,
} from '@/lib/event-type-profile';
import type { LifecyclePhase } from '@/lib/invitation-widgets';

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
  /**
   * The occasion in mechanical slots — "during the ___", "for this ___".
   * 'celebration' for every pre-existing type (byte-identical), 'gathering'
   * for the funeral. Distinct from `eventWord` on purpose: "No photos were
   * shared for this gathering" reads right where "…for this wake" turns blunt.
   */
  occasion: string;
  /**
   * TRUE only for the solemn register (the funeral). Owner ruling 2026-08-17:
   * a funeral is a tone build across the whole guest tree. Consumers use this
   * to render a deliberately-drafted quiet arm — and to NOT render the things
   * whose presence is the defect (the countdown, the marketing upsells, the
   * save-the-date). The celebratory arm of every such branch must stay
   * byte-identical to what shipped; `event-words.test.ts` pins that.
   */
  solemn: boolean;
  /**
   * IS THIS WORD THE PERSON THE EVENT IS *ABOUT*, RATHER THAN THE PERSON WHO
   * *RUNS* IT? (owner ruling 2026-08-18)
   *
   * The owner kept all five words — `couple` · `host` · `organizer` ·
   * `celebrant` · `graduate` — and he is right that they read better than two
   * would: *"Your greeting is on its way to the celebrant"* is warmer and more
   * accurate than "to the host", and a gift really is for the celebrant.
   *
   * But two of the five name the HONOURED person, not the organiser, and the
   * page has a handful of sentences about ADMIN work — publishing a seating
   * plan, arranging a venue, posting a programme. **At a seven-year-old's
   * birthday the celebrant is the seven-year-old**, so *"The celebrant is still
   * arranging the venue layout"* names the wrong person entirely. Same for a
   * graduation: the graduate is rarely the one doing the seating chart.
   *
   * So the six admin sentences drop the person when this is TRUE, and keep
   * naming them when it is FALSE. Every other sentence — greetings, gifts,
   * whose guest list, whose gallery — names them in all five cases, because
   * there the honoured person IS the right person.
   *
   * 🔒 A WEDDING IS UNAFFECTED and that is not a coincidence: the couple both
   * run the event and are honoured by it, which is exactly why `couple` works
   * where `celebrant` does not.
   */
  organizerIsHonoree: boolean;
};

/**
 * The two words that name who the event is ABOUT. Anything else — including a
 * word added later — is treated as the organiser and keeps being named, which
 * is today's behaviour and the safe direction: naming a real organiser reads
 * fine, naming a child who arranged nothing does not.
 */
const HONOREE_NOUNS = new Set(['celebrant', 'graduate']);

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
  const occasion = profile.terminology.occasionNoun?.trim() || 'celebration';
  const possessive = possessiveOf(organizer);
  return {
    organizer,
    theOrganizer: `the ${organizer}`,
    // Only the article takes the capital — "The couple", never "The Couple".
    TheOrganizer: `The ${organizer}`,
    theOrganizerPossessive: `the ${possessive}`,
    TheOrganizerPossessive: `The ${possessive}`,
    eventWord,
    occasion,
    solemn: profile.terminology.register === 'solemn',
    organizerIsHonoree: HONOREE_NOUNS.has(organizer),
  };
}

/** Resolve the words for an event type. `null` → wedding, matching every other
 *  guest-tree call site (`resolveProfile(event.event_type ?? 'wedding')`). */
export async function eventWordsFor(
  eventType: string | null | undefined,
): Promise<EventWords> {
  return eventWordsFromProfile(await resolveProfile(eventType ?? 'wedding'));
}

/**
 * The lifecycle phase a guest actually receives, after the solemn register has
 * its say. Pure so it is directly testable.
 *
 * A solemn event (the funeral) never enters:
 *  · 'save_the_date' — a date-less or far-out event otherwise opens on the
 *    WEDDING-SHAPED announcement film ("we'll celebrate together at…", a
 *    countdown, add-to-calendar framing). The brief's words: the wake "never
 *    offers a save-the-date". Demoted to the ordinary site.
 *  · 'editorial' — the post-event recap is auto-composed in a joyful voice
 *    ("a celebration their guests won't soon forget"). Until a memorial voice
 *    exists for the composer, a wake keeps its ordinary page after the day,
 *    which reads the solemn thank-you copy instead.
 * 'rsvp' and 'event' pass through: the day-of layer (schedule, live stream,
 * the hub) is exactly what a wake uses — vigil schedule, a stream for family
 * abroad — and its strings carry their own solemn arms.
 *
 * Deliberately keyed on the REGISTER, not on `surfaceEnabled(…,
 * 'save_the_date')`: the general "wedding-only parts stay home for every
 * type" build is S15's, scoped separately (its register entry says the
 * funeral must not ride along with it). This gate changes the funeral alone.
 */
export function solemnAdjustedPhase(
  phase: LifecyclePhase,
  solemn: boolean,
): LifecyclePhase {
  if (!solemn) return phase;
  return phase === 'save_the_date' || phase === 'editorial' ? 'rsvp' : phase;
}

/**
 * Same words, resolved from an EVENT ID rather than a type string.
 *
 * Several deep components — the post-event story, the face notice, the guest
 * column card — receive only `eventId`, never the event row. Threading the
 * words down to them would mean touching every intermediate for a noun. This
 * resolves directly, and `resolveProfileByEvent` is React-`cache()`d per
 * request, so the extra call costs nothing after the first.
 */
export async function eventWordsForEvent(eventId: string): Promise<EventWords> {
  return eventWordsFromProfile(await resolveProfileByEvent(eventId));
}
