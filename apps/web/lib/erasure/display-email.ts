/**
 * 🪦 AN ERASED ACCOUNT'S EMAIL, AS AN ADMIN READS IT (F-W2-39, walk 14 Nov).
 *
 * Erasure (`lib/erasure/purge.ts`) overwrites `users.email` with a tombstone, `erased+<user id>@erased.setnayan.invalid`,
 * so the address is freed and the row keeps a unique value. That tombstone is a storage detail: printed raw it read as a
 * real (and very strange) address on every admin list. On a screen it is "Erased account"; anything else is shown as is.
 * Pure — no I/O — so a server page and a client table can both call it.
 */
export const ERASED_EMAIL_RE = /^erased\+[^@]*@erased\.setnayan\.invalid$/i;

export const ERASED_ACCOUNT_WORDS = 'Erased account';

export function isErasedEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && ERASED_EMAIL_RE.test(email.trim());
}

/** The email as an admin should read it: "Erased account" for a tombstone, the address otherwise, null when there is none. */
export function displayAccountEmail(email: string | null | undefined): string | null {
  if (email == null || email.trim() === '') return null;
  return isErasedEmail(email) ? ERASED_ACCOUNT_WORDS : email;
}
