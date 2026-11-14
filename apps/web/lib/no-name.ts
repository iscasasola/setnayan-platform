/**
 * 🪪 RW-64 (walk 13 Nov 2026): IS THIS A NAME, OR A STAND-IN FOR ONE?
 *
 * "Someone —" reached three screens as if it were somebody's name — the From-your-people picker, the reply page
 * ("Someone — · Not you? Switch") and the account switcher. It is two stand-ins run together: People's placeholder for
 * a name it does not show (`ROSTER_UNNAMED`, "Someone") and an empty name part stored as a dash (the shape
 * `isPlaceholderNameWord` already drops from guest names). Neither is a name.
 *
 * `realNameOrNull` keeps a real name as typed (trimmed) and answers null for one made only of the placeholder word and
 * marks with no letter or digit — so each screen falls back to its own no-name words instead of printing a stand-in.
 * PURE.
 */
/** The word People shows for a connection whose name is not shown — a placeholder, never a name to copy (F-W3-22).
 *  Lives here (a pure module) so every screen that must not print it can ask, server or client. */
export const ROSTER_UNNAMED = 'Someone';

export function realNameOrNull(name: string | null | undefined): string | null {
  const v = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!v) return null;
  // Every word that carries a letter or a digit, in any script.
  const words = v.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return null;
  if (words.length === 1 && words[0]!.toLowerCase() === ROSTER_UNNAMED.toLowerCase()) return null;
  return words.join(' ');
}
