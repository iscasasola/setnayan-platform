/**
 * lib/for-tag.ts — the "For <name>" tag, as both surfaces draw it (owner 22 Oct 2026).
 *
 * Who the event is FOR is decided in `readEventSubjects` (lib/event-subjects.ts) and
 * signed in `readForTags` (lib/event-for-tag.server.ts). This is only the drawable answer.
 */
export type ForTag = {
  /** The shop's or the loved one's name — printed as "For <name>". */
  name: string;
  /** The shop's round logo, already signed for the browser; null = initials (a person has no photo). */
  markUrl: string | null;
};

/** The words, one place: "For SetnaProd" (the board's chip uppercases it with CSS). */
export function forTagWords(name: string): string {
  return `For ${name.trim()}`;
}

/**
 * Does THIS card's stance slot say "For <name>" instead of its stance?
 *
 * Only an ORGANISER's card, and only with a subject in hand. A helper's or a
 * guest's card keeps "You help with this" / "You're invited" — for them the
 * subject never resolves anyway (it is not their record), and this says so a
 * second time, so a widened read can never put a name on somebody else's card.
 * Holding the subject means you organise it, so the replaced chip loses nothing.
 */
export function cardShowsForTag(
  stance: 'organiser' | 'invited' | 'helper' | null | undefined,
  subject: { name: string } | null | undefined,
): boolean {
  return stance === 'organiser' && !!subject && subject.name.trim().length > 0;
}
