/**
 * THE INBOX SEARCH — ONE FUNCTION THE FIELD CALLS (owner 2026-10-28, verbatim: *"search will always be the same"* ·
 * *"search searches for the name and the message"*).
 *
 * The field is the app's ONE search (the shipped `ThumbRow` field, in the frosted thumb row — owner: *"thumb bar"*).
 * In this slice (C1) it matches the other side's NAME over the rows already loaded — instant, no round trip. Searching
 * the MESSAGE TEXT needs a server-side, RLS-scoped, indexed read (a migration), which is slice C5: it lands HERE, behind
 * this same signature, and the field does not change. `lib/the-chat-inbox-is-one-search.test.ts` holds both halves —
 * the field calls this and nothing else, and this matches names, not the preview line (a preview is one message, so
 * matching it would look like message search while silently missing every older message).
 */

export type InboxSearchRow = { threadId: string; name: string };

/** Case- and accent-insensitive, every word must appear in the name. Empty query → every row. */
export function searchInboxRows<R extends InboxSearchRow>(rows: readonly R[], query: string): R[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((r) => {
    const name = fold(r.name);
    return words.every((w) => name.includes(w));
  });
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
