/**
 * The result banner for "Tell the host", read back off the URL.
 *
 * The send action redirects to `?note=sent` or `?note=error`. Anything else in
 * that slot — a typo, a stale bookmark, a hand-edited address bar — must resolve
 * to NO banner rather than to a default. "Sent." is a claim about whether the
 * host got the message; the one outcome worth guarding against is a page that
 * says it while nothing was written.
 *
 * Pure, no imports, so the rule is testable without rendering the page.
 */
export type NoteFlash = 'sent' | 'error';

export function parseNoteFlash(raw: unknown): NoteFlash | null {
  return raw === 'sent' || raw === 'error' ? raw : null;
}
