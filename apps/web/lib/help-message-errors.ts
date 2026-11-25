/**
 * The only words a `/help?error=` link can show (final check A1-083, 25 Nov 2026).
 *
 * `submitHelpMessage` used to redirect with the database's own error text, and the page printed whatever the URL
 * carried. The action now sends one of these codes; the page maps it with `ownMessageFromParam`, so a crafted link
 * shows our generic sentence, never its own words. The typed subject and message ride back in `subject` / `body`
 * (the page already pre-fills from those), so a failed send never loses what the person wrote.
 */
export const HELP_MESSAGE_ERRORS = {
  missing: 'Add your email, a subject and a message, then send again.',
  not_sent: 'We couldn’t send your message just now. Your words are still here: press Send to try again.',
} as const;

export type HelpMessageErrorCode = keyof typeof HELP_MESSAGE_ERRORS;

/** What an unknown `?error=` shows: ours, never the link's. */
export const HELP_MESSAGE_ERROR_FALLBACK = HELP_MESSAGE_ERRORS.not_sent;

/** A `?submitted=` reference is shown back only when it is shaped like one of our public ids. */
export function helpReferenceFromParam(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return /^[A-Z0-9][A-Z0-9-]{3,39}$/i.test(s) ? s : null;
}
