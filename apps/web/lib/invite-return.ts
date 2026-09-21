/**
 * invite-return.ts — where saving the invitation look sends the couple back to.
 *
 * ⚖ Owner 2026-09-21: *"pressing buttons inside the guest list should not
 * clear the whole page. only the body."* The Share the link tab used to LEAVE
 * the guest list for /guests/invite; it now renders that page's panel in the
 * list's own body (`?gview=share`). But the look picker's save action always
 * redirected to /guests/invite — so choosing a look from inside the tab would
 * have thrown the couple off the guest list, the exact thing the tab exists
 * to stop.
 *
 * 🔒 AN ALLOWLIST OF TWO, NEVER A URL FROM THE FORM. The form says WHICH of the
 * two known pages it sits on; it cannot name a destination. Anything
 * unrecognised — a missing field, a tampered value, a full URL — falls back to
 * the invite page, which is where every save went before this existed.
 *
 * PURE — executed by its test.
 */

export type InviteReturn = 'invite' | 'guests-share';

export function parseInviteReturn(raw: unknown): InviteReturn {
  return raw === 'guests-share' ? 'guests-share' : 'invite';
}

export function inviteReturnPath(
  eventId: string,
  to: InviteReturn,
  theme?: 'saved' | 'error',
): string {
  const base =
    to === 'guests-share'
      ? `/dashboard/${eventId}/guests?gview=share`
      : `/dashboard/${eventId}/guests/invite`;
  if (!theme) return base;
  return `${base}${base.includes('?') ? '&' : '?'}theme=${theme}`;
}
