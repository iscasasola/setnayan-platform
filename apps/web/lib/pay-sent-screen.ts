/**
 * lib/pay-sent-screen.ts — the words of the full-screen "sent" moment on /pay,
 * as rules that can be RUN rather than copy buried in a component.
 *
 * ⚖ OWNER 2026-11-17, verbatim: *"Returning to home in 5 seconds. tap to return
 * to Gifts."* Five seconds, a countdown a person can see, Home at zero, and a tap
 * anywhere back to where they came from.
 */

/** How long the sent screen waits before it goes Home. */
export const SENT_SCREEN_SECONDS = 5;

/** "Back to Gifts" → "Gifts"; "Back to your shop" → "your shop". */
export function returnPlace(backLabel: string): string {
  const t = backLabel.trim().replace(/^back to\s+/i, '');
  return t.length > 0 ? t : 'where you were';
}

export function sentScreenWords(
  secondsLeft: number,
  backLabel: string,
): { title: string; body: string; countdown: string; tap: string } {
  const n = Math.max(0, Math.floor(secondsLeft));
  return {
    title: 'Receipt sent',
    body: 'We’re verifying your payment — usually within 24 hours. You’ll get an email once it’s confirmed.',
    countdown: `Returning to home in ${n} ${n === 1 ? 'second' : 'seconds'}`,
    tap: `Tap to return to ${returnPlace(backLabel)}`,
  };
}
