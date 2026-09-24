/**
 * apps/web/lib/integrations/project-number.ts
 *
 * THE CLOUD PROJECT NUMBER, DERIVED FROM THE CLIENT ID.
 *
 * ── WHY ITS OWN FILE ───────────────────────────────────────────────────────
 * 🪤 `registry.ts` imports `server-only`, so nothing can import it from a test
 * — the import throws before a single assertion runs. A pure decision that
 * lives beside a server-only import is a decision nothing can hold down. So the
 * rule moves here and the registry re-exports it; the repo has made this split
 * before for the same reason.
 */

/**
 * The Google Cloud project number the Picker needs, read off the OAuth client
 * id — which has the shape `<project number>-<random>.apps.googleusercontent.com`.
 *
 * 🔑 DERIVED, NEVER STORED. A column of its own would be a second source of
 * truth for one fact, free to drift the moment somebody rotates the client —
 * and the drift shows up as a Picker that refuses to open, with both values
 * looking perfectly plausible in the console.
 *
 * ⛔ Returns null rather than a guess for a missing or malformed id. The Picker
 * is then simply not offered, which is the honest state; a half-read number
 * would produce a window that opens and fails.
 */
export function projectNumberFromClientId(clientId: string | null | undefined): string | null {
  if (typeof clientId !== 'string') return null;
  const m = /^(\d{6,})-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.exec(clientId.trim());
  return m ? (m[1] as string) : null;
}
