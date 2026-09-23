/**
 * WHERE A RENAME LANDS — a NAME, never a path.
 *
 * `updateEventSlug` used to write `/dashboard/${eventId}/invitation` into all
 * seven of its redirects. That is correct exactly once: on the invitation page.
 * The same form is now also the couple's address field on `/launch`, and a
 * hard-coded landing there is a save that succeeds and teleports — the page
 * they were working on disappears, and the only way to read it is as a bug.
 *
 * 🔒 THE CALLER PICKS A NAME AND THIS MAP BUILDS THE URL. A server action's
 * bound argument is encoded and sent to the browser; treating one as a path to
 * redirect to is an open redirect waiting for somebody to replay it. A key that
 * is not in this record cannot produce a URL at all, so the refusal is
 * structural rather than a check somebody has to remember to write.
 *
 * ⚠ This lives OUTSIDE the `'use server'` module on purpose: such a file may
 * export async functions and nothing else, so a type and a lookup table cannot
 * sit beside the action that uses them.
 */
export type SlugReturn = 'invitation' | 'launch';

const PATHS: Record<SlugReturn, (eventId: string) => string> = {
  invitation: (id) => `/dashboard/${id}/invitation`,
  launch: (id) => `/dashboard/${id}/launch`,
};

/** The page to send the couple back to. Falls back to the invitation page. */
export function slugReturnPath(eventId: string, to: SlugReturn | undefined): string {
  return (PATHS[to as SlugReturn] ?? PATHS.invitation)(eventId);
}
