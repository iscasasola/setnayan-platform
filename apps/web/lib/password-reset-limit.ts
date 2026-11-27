/**
 * The password-reset limiter's numbers, in one place (final check A1-065, 25 Nov 2026): the action enforces them and
 * the /forgot-password refusal names the wait FROM them. It used to say "wait a minute" for a 15-minute window, so a
 * person who waited a minute was refused again.
 */
export const PASSWORD_RESET_PER_EMAIL_LIMIT = 3;
export const PASSWORD_RESET_PER_IP_LIMIT = 10;
export const PASSWORD_RESET_WINDOW_MS = 15 * 60_000;

/** The refusal a person reads, with the real wait. */
export function passwordResetWaitMessage(windowMs: number = PASSWORD_RESET_WINDOW_MS): string {
  const minutes = Math.max(1, Math.round(windowMs / 60_000));
  return `Too many reset requests in a row — please wait ${minutes} minute${minutes === 1 ? '' : 's'}, then try again.`;
}
