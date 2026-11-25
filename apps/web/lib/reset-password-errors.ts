import { LEAKED_PASSWORD_MESSAGE } from '@/lib/password-strength';

/**
 * The only words `/reset-password?error=` can show (final check A1-058, 25 Nov 2026). The action used to pass the
 * provider's own text and the page printed the URL as given (a lone "%" gave HTTP 500). The page now maps the param
 * with `ownMessageFromParam` against this list; anything else shows `RESET_NOT_SAVED`.
 */
export const RESET_NOT_SAVED = 'We couldn’t save your new password just now. Please try again.';

/** `validateNewPassword` (lib/account-security.ts) returns these two sentences; kept here word for word. */
export const RESET_PASSWORD_ERRORS: ReadonlyArray<string> = [
  'Password must be at least 8 characters',
  'Passwords do not match',
  'Invalid input',
  LEAKED_PASSWORD_MESSAGE,
  RESET_NOT_SAVED,
];
