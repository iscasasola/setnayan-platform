/**
 * name-style.ts — THE EVENT'S NAME STYLE: how every FORMAL surface prints a
 * person's five name parts.
 *
 * Owner, verbatim, 2026-09-30 (DECISION_LOG "THE COUPLE PICKS A NAME STYLE"):
 * *"when we have their full name, for example Mr. Manuel Cortez Casasola. We
 * can pick the name style as well. Mr. Casasola, Manuel C. / Mr. Manuel C.
 * Casasola / Mr. Manuel Cortez Casasola"*. ONE event-wide choice, exactly
 * these three:
 *
 *   · Full            "Mr. Manuel Cortez Casasola"   — the default = today
 *   · Middle initial  "Mr. Manuel C. Casasola"
 *   · Surname first   "Mr. Casasola, Manuel C."
 *
 * A suffix is always kept ("… Casasola II"). A missing part is SKIPPED
 * CLEANLY: no middle name → "Mr. Manuel Casasola"; no first name under Surname
 * first → "Mr. Casasola", never "Mr. Casasola, " and never "Mr. , Manuel".
 *
 * WHERE IT IS STORED: `events.print_details.name_style` — the event's existing
 * settings jsonb (no new table, no new column). Every writer of that column
 * read-modify-writes through `parsePrintDetails` / `serializePrintDetails`
 * (lib/print-pieces.ts), so each one carries this key. Absent = Full.
 *
 * WHAT IT APPLIES TO: the formal surfaces — the entourage (sponsors included)
 * on the Event Hub, /everyone and the printed Entourage card; the printed
 * per-guest cards; the tickets (digital and printed); the name lists; and the
 * couple's invite message `{name}`. A name the couple TYPED as a Display name
 * is printed as given — it is their choice for that person, and no style
 * rewrites it (`guestFullName`).
 *
 * Pure and import-free on purpose: the Maker's dropdown, the guest pages and
 * the print server all read it, and none may disagree about a style's words.
 */

export const NAME_STYLES = ['full', 'middle-initial', 'surname-first'] as const;
export type NameStyle = (typeof NAME_STYLES)[number];

/** Full — today's name, so an event that never chose reads exactly as before. */
export const DEFAULT_NAME_STYLE: NameStyle = 'full';

/** The dropdown's three choices — the owner's own example under each. */
export const NAME_STYLE_CHOICES: ReadonlyArray<{ key: NameStyle; label: string; example: string }> = [
  { key: 'full', label: 'Full', example: 'Mr. Manuel Cortez Casasola' },
  { key: 'middle-initial', label: 'Middle initial', example: 'Mr. Manuel C. Casasola' },
  { key: 'surname-first', label: 'Surname first', example: 'Mr. Casasola, Manuel C.' },
];

/** A stored value → a style. Anything unknown is Full, never a guess. */
export function nameStyleFrom(raw: unknown): NameStyle {
  return typeof raw === 'string' && (NAME_STYLES as readonly string[]).includes(raw)
    ? (raw as NameStyle)
    : DEFAULT_NAME_STYLE;
}

/** The style an event chose, read off `events.print_details` as stored. */
export function nameStyleOfPrintDetails(printDetails: unknown): NameStyle {
  if (!printDetails || typeof printDetails !== 'object' || Array.isArray(printDetails)) return DEFAULT_NAME_STYLE;
  return nameStyleFrom((printDetails as Record<string, unknown>).name_style);
}

export type NameParts = {
  name_prefix?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  name_suffix?: string | null;
};

const part = (s: string | null | undefined): string => (s ?? '').trim();

/**
 * "Cortez" → "C." — each word of the middle name as its initial, the same rule
 * the place card uses. Blank → ''.
 */
export function middleInitials(middle: string | null | undefined): string {
  return part(middle)
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => `${w[0]!.toUpperCase()}.`)
    .join(' ');
}

const join = (xs: readonly string[]): string => xs.filter(Boolean).join(' ');

/**
 * The five parts as ONE line in the event's style. NULL when nothing is left,
 * so a caller drops the line rather than printing an empty one.
 *
 * Full is byte-identical to the composition every formal surface printed
 * before the style existed: each part trimmed, blanks skipped, one space.
 */
export function styledName(parts: NameParts, style: NameStyle = DEFAULT_NAME_STYLE): string | null {
  const prefix = part(parts.name_prefix);
  const first = part(parts.first_name);
  const last = part(parts.last_name);
  const suffix = part(parts.name_suffix);
  if (style === 'full') {
    return join([prefix, first, part(parts.middle_name), last, suffix]) || null;
  }
  const mi = middleInitials(parts.middle_name);
  if (style === 'surname-first' && last && (first || mi)) {
    /* "Mr. Casasola, Manuel C." — and a suffix after a comma of its own
       ("Mr. Casasola, Manuel C., II"), the reference-list convention, so a
       "II" never reads as part of the given name. */
    const given = join([first, mi]);
    return `${join([prefix, last])}, ${given}${suffix ? `, ${suffix}` : ''}`;
  }
  /* Middle initial — and Surname first when there is no surname or nothing
     before it to put after a comma: the parts in their usual order, so a
     missing part is skipped cleanly and never leaves a dangling comma. */
  return join([prefix, first, mi, last, suffix]) || null;
}

/**
 * 🎟 THE NAME A TICKET PRINTS — the Digital ticket (`passCardGuestName`) and the
 * Printed ticket batch (`loadGuestPasses`) share this one rule.
 *
 * ⚖ FULL KEEPS THE TICKET'S OWN LINE: a ticket has always printed prefix ·
 * first · last · suffix with NO middle name (a small card, one line), and Full
 * is "today". Middle initial and Surname first print their style. The parts
 * lead and the Display name is the fallback — the ticket's order since it
 * shipped — and a row with neither is "Guest", never a blank card.
 */
export function ticketName(
  g: NameParts & { display_name?: string | null },
  style: NameStyle = DEFAULT_NAME_STYLE,
): string {
  const line =
    style === 'full'
      ? join([part(g.name_prefix), part(g.first_name), part(g.last_name), part(g.name_suffix)])
      : styledName(g, style);
  return line || part(g.display_name) || 'Guest';
}
