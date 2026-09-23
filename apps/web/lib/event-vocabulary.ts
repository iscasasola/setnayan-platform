/**
 * event-vocabulary.ts — the words one event is BADGED with and the words it
 * can be FOUND by, in one neutral place.
 *
 * ─── WHY IT LEFT `command-data.ts` ───────────────────────────────────────
 * That module is `server-only`, so nothing here could be exercised directly —
 * a guard would have had to read the source as text and assert on strings,
 * which is how a rule ends up "checked" by matching the comment that explains
 * it. These are pure functions over a string and a date; they belong where a
 * test can call them. `command-data.ts` imports and re-exports them, so every
 * existing caller is untouched.
 *
 * ─── 🔴 THE DEFECT THIS FILE ENDS ────────────────────────────────────────
 * An event's searchable text was its name plus its RENDERED subtitle, and the
 * subtitle puts the type through `eventTypeBadge` — which maps `wedding` to
 * "KASAL" before the text is ever searched. The English word was translated
 * away, and then we searched the translation. Measured live on
 * www.setnayan.com, signed in as the owner, 2026-09-23:
 *
 *     ?q=wedding  → 24 results, ZERO of them his
 *     ?q=kasal    → 2 results, BOTH of his weddings
 *     ?q=birthday → 1 result, none of them his
 *
 * Only `debut` survived, by the coincidence of badge and word being identical.
 * Owner: *"when i searched wedding, it should also show my wedding event."*
 *
 * 🔑 A BADGE IS A DISPLAY DECISION. Renaming one for design reasons silently
 * changed what a person could find, and nothing could notice. So the index
 * reads the DATA, and `EVENT_TYPE_BADGE` is free to say whatever it likes.
 *
 * ⚠ THERE IS A THIRD COPY OF THE BADGE MAP AND THIS FILE CANNOT SEE IT.
 * `app/dashboard/(account)/samahan/[communityId]/page.tsx` declares its own
 * `EVENT_TYPE_BADGE` + `eventTypeBadge` + `shortDate`, with a comment calling
 * them module-private. That copy is NOT covered by the invariant below: a type
 * added there and nowhere else would render a badge that nothing can find.
 * Folding it in is a real cleanup and deliberately not bundled into this
 * behaviour change.
 */

/** `YYYY-MM-DD` split field-by-field, or null.
 *
 * 🔑 NEVER `new Date(iso)`. `events.event_date` is a DATE, and
 * `new Date('2026-12-12')` is midnight UTC — the 11th west of Greenwich. That
 * is the bug that printed a 12 Dec wedding as 11 Dec on 41 screens
 * (`DECISION_LOG.md` 2026-08-04). One parser, used by everything that reads
 * this column, so the two cannot drift apart again. */
export function parseEventDate(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * event_type → short badge. Filipino term where one is well established
 * (kasal · binyag · kaarawan · anibersaryo), else an uppercased English label.
 */
export const EVENT_TYPE_BADGE: Record<string, string> = {
  wedding: 'KASAL',
  christening: 'BINYAG',
  baptism: 'BINYAG',
  debut: 'DEBUT',
  birthday: 'KAARAWAN',
  anniversary: 'ANIBERSARYO',
};

export function eventTypeBadge(type: string): string {
  return (
    EVENT_TYPE_BADGE[type] ??
    type
      .split(/[_\s]+/)
      .filter(Boolean)
      .join(' ')
      .toUpperCase()
  );
}

/**
 * What an event of this type may be TYPED as — both languages, both spellings.
 *
 * ⚠ THIS MUST NOT BECOME A SECOND VOCABULARY. Every key of
 * `EVENT_TYPE_BADGE` has to appear here, and each list has to contain its own
 * badge word — otherwise a type is badged one way and findable another, which
 * is the same class of bug one step along. `event-vocabulary.test.ts` asserts
 * both directions, so a new event type cannot be added to one map and
 * forgotten in the other.
 */
export const EVENT_TYPE_TERMS: Record<string, ReadonlyArray<string>> = {
  wedding: ['wedding', 'kasal'],
  christening: ['christening', 'baptism', 'binyag'],
  baptism: ['baptism', 'christening', 'binyag'],
  debut: ['debut', '18th', 'eighteenth'],
  birthday: ['birthday', 'kaarawan'],
  anniversary: ['anniversary', 'anibersaryo'],
};

/** The month and year an event sits in, as words somebody would type. */
function dateTerms(iso: string | null): string[] {
  const d = parseEventDate(iso);
  if (!d) return [];
  return [
    d.toLocaleDateString('en-US', { month: 'long' }),
    d.toLocaleDateString('en-US', { month: 'short' }),
    String(d.getFullYear()),
  ];
}

/**
 * Everything an event can be found BY, and none of it rendered.
 *
 * Deliberately generous: a person hunting their own wedding types whatever
 * comes to mind — the couple's names, "kasal", "wedding", "December",
 * "Tagaytay". The list is theirs already, so widening what matches INSIDE it
 * cannot leak anything: scope decides which rows exist before matching runs.
 */
export function eventSearchTerms(
  eventType: string,
  eventDate: string | null,
  place: string | null,
  /** `EventStance | null` at the only call site — an unknown stance is not
   *  'invited', which is the same reading the subtitle beside it takes. */
  stance: string | null,
): string {
  const type = eventType.toLowerCase();
  const typed = EVENT_TYPE_TERMS[type] ?? [
    // An unmapped type stays findable by its own words — 'family_reunion'
    // becomes "family reunion family_reunion". A missing map entry must cost
    // the synonyms, never the event itself.
    type.replace(/[_\s]+/g, ' '),
    type,
  ];
  return [
    ...typed,
    // The badge too, so the Filipino word a person SEES on the card always
    // finds it — even for a type nobody thought to map.
    eventTypeBadge(eventType).toLowerCase(),
    ...dateTerms(eventDate),
    place ?? '',
    stance === 'invited' ? 'invited guest' : 'organiser organizer mine',
  ]
    .filter(Boolean)
    .join(' ');
}
