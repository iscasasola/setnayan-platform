/**
 * The email a person typed into the sign-in card, carried across the /login
 * route's full-page redirect on a failed attempt (the form is empty on the far
 * side). sessionStorage only — never the URL (an address is personal data) —
 * read once and removed. Every access is guarded: storage can throw or be empty.
 */
const KEY = 'sn-signin-email';

export function rememberTypedEmail(email: string): void {
  try {
    if (email) sessionStorage.setItem(KEY, email);
  } catch {
    /* private window / blocked storage: the box above still works */
  }
}

export function recallTypedEmail(): string {
  try {
    const v = sessionStorage.getItem(KEY) ?? '';
    sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return '';
  }
}
