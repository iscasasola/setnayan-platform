/**
 * THE FOUR LAUNCH-PHASE CHOICES — and deliberately NOT in a client file.
 *
 * 🔴 `launchPhaseLabel()` used to be exported from `media-panels.tsx`, which
 * carries `'use client'`, and the SERVER editor page called it. In a production
 * build a client export is a REFERENCE, not a function, and React refuses:
 * "Attempted to call X() from the server but X is on the client."
 *
 * It was the SECOND such import on that one page — `done`/`todo` from
 * `editor-shell.tsx` were the first, and together they returned a 500 to the
 * couple for the whole website editor (production 2026-09-23, digest
 * 2184633741). Fixing one would have left the page broken.
 *
 * 🔑 A `'use client'` FILE IS A BOUNDARY, NOT A FOLDER. A component may be
 * RENDERED across it; a plain function may not be CALLED across it. Types are
 * erased and are fine either way.
 *
 * `a-server-page-calls-no-client-function.test.ts` now fails the build if a
 * route entry ever imports a callable value from a client module again.
 */
export const LAUNCH_PHASE_CHOICES = [
  { key: 'save_the_date', label: 'Save the Date', hint: 'The announcement. Asks nothing of guests yet.' },
  { key: 'rsvp', label: 'Invitation', hint: 'The invitation guests reply to.' },
  { key: 'event', label: 'On the day', hint: 'The page guests use at the celebration itself.' },
  { key: 'editorial', label: 'After', hint: 'The page guests revisit afterwards. Replies are closed.' },
] as const;

export type LaunchPhaseKey = (typeof LAUNCH_PHASE_CHOICES)[number]['key'];

export function launchPhaseLabel(key: LaunchPhaseKey): string {
  return LAUNCH_PHASE_CHOICES.find((c) => c.key === key)?.label ?? key;
}
