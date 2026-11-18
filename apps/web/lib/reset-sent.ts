/**
 * reset-sent.ts — ✉ the password-reset page's SENT state, its pure half (walker W1-B6, 16 Nov 2026).
 *
 * "Sent to <email> · Open your email · Send again in 60s" (`app/forgot-password/_components/reset-sent.tsx`).
 * Pure so the guard can hold the words and the wait without a browser. 🔒 `lib/the-reset-page-says-it-sent.test.ts`.
 */

/** The wait before the link may be sent again — the button stays off until it has passed. */
export const RESEND_AFTER_SECONDS = 60;

/** The resend button's words: the wait while it runs, then the plain action. */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Send again in ${Math.ceil(secondsLeft)}s` : 'Send again';
}

/** The inbox for the common webmail domains; null for any other (the page then says "Open your email" in words). */
const INBOXES: Record<string, string> = {
  'gmail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'googlemail.com': 'https://mail.google.com/mail/u/0/#inbox',
  'yahoo.com': 'https://mail.yahoo.com/',
  'ymail.com': 'https://mail.yahoo.com/',
  'outlook.com': 'https://outlook.live.com/mail/',
  'hotmail.com': 'https://outlook.live.com/mail/',
  'live.com': 'https://outlook.live.com/mail/',
  'icloud.com': 'https://www.icloud.com/mail',
  'me.com': 'https://www.icloud.com/mail',
};

export function inboxFor(email: string): string | null {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return INBOXES[domain] ?? null;
}

/** Kept in THIS tab only (sessionStorage) — never in the URL, never on the server. */
const KEY = 'setnayan.reset.sentTo';

export function rememberResetEmail(email: string): void {
  try {
    const v = email.trim();
    if (v) window.sessionStorage.setItem(KEY, v);
  } catch {
    /* storage refused — the sent state says "your email" */
  }
}

export function readResetEmail(): string | null {
  try {
    return window.sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}
