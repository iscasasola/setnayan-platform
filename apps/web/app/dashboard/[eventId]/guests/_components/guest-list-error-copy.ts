import { plainRefusal } from './plain-refusal';

/**
 * Turn an `?error=` value into something a host can act on.
 *
 * This banner used to render `decodeURIComponent(search.error)` directly, so a
 * server action that redirected with a CODE put the CODE on screen — a host
 * assigning "Bride's Parents" in the bulk bar was shown the literal word
 * `invalid_role` (reported 2026-09-14). Meanwhile some actions redirect with
 * ready-made prose (the one-Bride-per-event message), which must pass through
 * untouched.
 *
 * So: known codes map to a sentence; anything else falls through as-is when it
 * reads like prose, and degrades to a neutral line when it reads like an
 * unmapped code. A raw snake_case token must never reach a couple's screen.
 */
export function guestListErrorCopy(raw: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      // A malformed %-sequence throws; the raw value is still better than a crash.
      return raw;
    }
  })();

  const COPY: Record<string, string> = {
    invalid_role: "That role isn't available for this celebration — pick one from the list.",
    invalid_side: 'Pick Bride, Groom, or Both.',
    no_selection: 'Select at least one guest first.',
    missing_name: 'Please enter both a first and last name.',
    missing_side: 'Pick a side first.',
    missing_group: 'Pick a group first.',
    not_found: "We couldn't find that guest — it may have been removed.",
    forbidden: "You don't have access to change that.",
  };
  if (COPY[decoded]) return COPY[decoded] as string;

  // Prose an action wrote for the host (a plain sentence) is shown. A bare token is an unmapped code, and a database's own
  // message ("invalid input syntax for type uuid…", which has spaces too) is never shown — the neutral line is.
  return plainRefusal(decoded, "That didn't go through — please try again.");
}
