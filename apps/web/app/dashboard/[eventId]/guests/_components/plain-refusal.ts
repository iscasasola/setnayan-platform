/**
 * plainRefusal — A HOST NEVER READS DATABASE WORDS (controller, 2026-10-09, on a refused delete that printed
 * "invalid input syntax for type uuid…" in the toast and in the sheet).
 *
 * A server action that is refused returns `{ ok: false, error }`, and many of those `error`s are the database's own
 * message (`error.message` straight from PostgREST). The page says ONE plain sentence of its own for the failure; the
 * action's words are shown only when they are plainly a sentence written for a person ("The bride and groom can't be
 * removed — they're the foundation of the event."). The raw text goes to the fault report — which already records it
 * (`lib/telemetry/fault-observer.ts`, ACTION_RETURNED_ERROR) — never to the screen.
 *
 * "Plainly a sentence": starts with a capital, ends with . ! or ?, is short, and carries none of the database's
 * vocabulary. When in doubt it is NOT shown — the fallback is.
 */
const DATABASE_WORDS =
  /\b(violates?|constraint|syntax|relation|column|uuid|postgres(?:ql)?|pgrst\d*|jwt|policy|schema|rpc|null value|row-level|foreign key|duplicate key|permission denied|undefined|exception|stack|sql|timeout|fetch failed|ECONN\w*)\b|[_{}\[\]<>]|\bat \S+:\d+/i;

export function isPlainSentence(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 6 || t.length > 160) return false;
  if (!/^[A-Z]/.test(t) || !/[.!?]$/.test(t)) return false;
  return !DATABASE_WORDS.test(t);
}

/** The words the page shows for a refusal: the action's own when they are a plain sentence, else `fallback`. */
export function plainRefusal(raw: string | null | undefined, fallback: string): string {
  return raw && isPlainSentence(raw) ? raw.trim() : fallback;
}

/** "Couldn't delete Daniel Ramos. Try again." / "Couldn't delete 3 guests. Try again." */
export function couldntDelete(who: string): string {
  return `Couldn’t delete ${who}. Try again.`;
}
