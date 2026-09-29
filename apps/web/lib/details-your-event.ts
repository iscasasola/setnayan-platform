/**
 * lib/details-your-event.ts — WHICH "YOUR EVENT" ITEMS AN EVENT SHOWS IN
 * DETAILS, WHAT EACH IS CALLED, AND WHETHER IT IS FILLED IN.
 *
 * Details part 2a (owner 2026-09-28, DECISION_LOG "OPTION B — EVERYTHING MADE
 * ONCE LIVES IN DETAILS…": *Your event (Names · Date · Venues · Parents &
 * hosts)*, plus the march — "THE WEDDING MARCH ON THE INVITATION TELLS EACH
 * ENTOURAGE MEMBER THEIR ROLE…").
 *
 * 🔑 THE PLAN ADAPTS TO EVERY EVENT TYPE — BUILT IN, NOT BOLTED ON (owner rule,
 * via the controller 2026-09-29). Nothing here asks `event_type === 'wedding'`
 * and nothing here types a wedding word. Each item asks the question that is
 * actually true of it, from data the event type already carries:
 *
 *   · NAMES — two named people at the centre (`EventWords.twoPeople`, read
 *     from the profile's `person_a`/`person_b`). Their labels are those words
 *     (`peopleLabels`). An event with one honoree has no names-only writer
 *     today (its name is set at creation), so the item is not shown — never a
 *     box that would write a second person's column for it.
 *   · DATE · VENUES — every event has a day and a place.
 *   · PARENTS — only where the event's OWN role set offers a role in the
 *     invitation's "Parents" group. Hosts are every event's, so the item stays
 *     ("Hosts") when there are no parent roles.
 *   · THE MARCH — only where the event's role set offers a role the entourage
 *     prints (`ENTOURAGE_ROLES`). Named from `EventWords.eventWord`.
 *
 * Pure: no I/O, no React.
 */
import type { EventWords } from '@/app/[slug]/_lib/event-words';
import { ENTOURAGE_ROLES, entourageGroupOfRole } from '@/lib/entourage';
import type { EventItemKey } from '@/lib/maker-details-items';

/** What an event type says about itself, as these items need it. */
export type YourEventKind = {
  words: Pick<EventWords, 'twoPeople' | 'solemn' | 'eventWord'>;
  /** The event's role set (`resolveRoleSetForEvent(...).offeredRoles`). */
  offeredRoles: readonly string[];
};

/** Does the event's role set offer a parent role the invitation prints? */
export function parentsOffered(kind: Pick<YourEventKind, 'offeredRoles'>): boolean {
  return kind.offeredRoles.some((r) => entourageGroupOfRole(r) === 'parents');
}

/** Does the event's role set offer any role the entourage prints? */
export function marchOffered(kind: Pick<YourEventKind, 'offeredRoles'>): boolean {
  const printed = new Set<string>(ENTOURAGE_ROLES);
  return kind.offeredRoles.some((r) => printed.has(r));
}

/** The "Your event" items this event shows, in the navigator's order. */
export function yourEventItems(kind: YourEventKind): EventItemKey[] {
  const out: EventItemKey[] = [];
  if (kind.words.twoPeople) out.push('names');
  out.push('date', 'venues', 'parents');
  if (marchOffered(kind)) out.push('march');
  return out;
}

/** "wedding" → "Wedding". */
function capital(s: string): string {
  const t = s.trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
}

/** Each item's navigator label — every event word from the event type. */
export function yourEventLabel(key: EventItemKey, kind: YourEventKind): string {
  switch (key) {
    case 'names':
      return 'Names';
    case 'date':
      return 'Date';
    case 'venues':
      return 'Venues';
    case 'parents':
      return parentsOffered(kind) ? 'Parents & hosts' : 'Hosts';
    case 'march':
      return `${capital(kind.words.eventWord) || 'The'} March`;
  }
}

/** Where each item shows — the Maker's own stage and print names. */
export function yourEventUsedOn(key: EventItemKey, kind: YourEventKind): string[] {
  switch (key) {
    case 'names':
      return ['The hero', 'Every print', 'Every pass'];
    case 'date':
      // A solemn event has no countdown (`EventWords.solemn`).
      return kind.words.solemn ? ['The hero', 'Every print'] : ['The hero', 'The countdown', 'Every print'];
    case 'venues':
      return ['The Day', 'Every print'];
    case 'parents':
      return parentsOffered(kind) ? ['The Invitation', 'Kindly reply'] : ['Kindly reply'];
    case 'march':
      return ['The Invitation', 'The Entourage card'];
  }
}

/** The facts "done" is derived from — all already stored; no new column. */
export type YourEventFacts = {
  /** The two first names as stored (`bride_name` / `groom_name`, split). */
  names: readonly [string, string];
  /** `events.event_date`, and whether it is a whole day (`event_date_precision`). */
  date: { value: string | null; dayPrecise: boolean };
  /** How many venues the Event Hub resolves (`resolveEventVenues`). */
  venueCount: number;
  parentCount: number;
  hostCount: number;
  /** How many lines walk (`buildEntourage`). */
  marchLines: number;
};

export function yourEventDone(key: EventItemKey, f: YourEventFacts): boolean {
  switch (key) {
    case 'names':
      return f.names[0].trim() !== '' && f.names[1].trim() !== '';
    case 'date':
      return Boolean(f.date.value) && f.date.dayPrecise;
    case 'venues':
      return f.venueCount > 0;
    case 'parents':
      return f.parentCount > 0 || f.hostCount > 0;
    case 'march':
      return f.marchLines > 0;
  }
}

/**
 * The two people's labels — the profile's own `person_a` / `person_b` words
 * ("bride" → "Bride"), or null when the type has no two named people.
 */
export function peopleLabels(personA: string | null | undefined, personB: string | null | undefined): [string, string] | null {
  const a = capital(personA ?? '');
  const b = capital(personB ?? '');
  return a && b ? [a, b] : null;
}

/**
 * A stored combined name → first + last, the Personalization page's own split
 * (first token is the first name, the rest the last name — lossless with the
 * onboarding's `[first, last].join(' ')`).
 */
export function splitStoredName(full: string | null | undefined): { first: string; last: string } {
  const t = (full ?? '').trim();
  if (!t) return { first: '', last: '' };
  const parts = t.split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

/** The date row's label, in the event's own word: "Wedding date", "Birthday date". */
export function yourEventDateLabel(words: Pick<EventWords, 'eventWord'>): string {
  return `${capital(words.eventWord) || 'Event'} date`;
}

/**
 * The stored date as its precision allows — a day, a month or a year — the way
 * the Personalization page documents it. Null when there is no date.
 */
export function dateDisplayOf(value: string | null | undefined, precision: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  if (precision === 'year') return String(y);
  if (precision === 'month') return at.toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return at.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
