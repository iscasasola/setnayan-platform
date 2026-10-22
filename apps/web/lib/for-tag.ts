/**
 * lib/for-tag.ts — the "For <name>" tag, as both surfaces draw it (owner 22 Oct 2026).
 *
 * Who the event is FOR is decided in `readEventSubjects` (lib/honoree-dependent-link.ts) and
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
