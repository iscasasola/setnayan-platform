import { signedInFromCookie } from '@/lib/appearance';

/**
 * Should this page view send the device id (`app/_components/device-capture.tsx`)? Pure, so the
 * rule is tested without a browser: the flag is on, a session exists, and this browser session
 * has not already sent it.
 *
 * 🔑 SIGNED OUT → NO. The server action (`lib/device-capture.ts`) records nothing for a visitor
 * with no account — the DPO review's safeguard 4, "Secured accounts only" — so a signed-out call
 * was one server function spent for nothing on every public visit (live check 2026-10-23). The
 * server's own gates stay the authority; this only stops the client asking when the answer is
 * already known to be no.
 *
 * `alreadyPinged` is read LAST and only when signed in, so flag off or signed out touches no
 * storage at all — not even a read.
 */
export function shouldCaptureDevice(flagOn: boolean, cookie: string, alreadyPinged: () => boolean): boolean {
  return flagOn && signedInFromCookie(cookie) && !alreadyPinged();
}
