/**
 * lib/home-screen-shortcut.ts — THE ONE QUIET "SHORTCUT TO THIS EVENT" LINE.
 *
 * Owner, 2026-10-03 (DECISION_LOG "AMENDS THE ROW ABOVE — GUESTS GET ONE QUIET
 * 'SHORTCUT TO THIS EVENT' LINE, ONLY AFTER THEY REPLY"): *"yes. for the event
 * they can make a shortcut to their phones for that event"*. ⇒ On the guest's
 * after-reply (thank-you) screen only, once: "Keep it handy — add this event to
 * your home screen", with the steps for THEIR phone.
 *
 * ⛔ NEVER ON THE EVENT HUB, NEVER A POPUP, NEVER REPEATED. The 2026-09-30
 * removal of the Event Hub's "home screen" card stands (lib/event-app-icon.ts
 * says why): this is one line on one screen, and the steps open in place
 * (a `<details>`, no script) only when the guest taps it.
 *
 * 🔑 THE TILE IS THE COUPLE'S. The page carrying the line names the per-event
 * manifest and apple-touch-icon (`eventShortcutMetadata`, lib/event-app-icon.ts),
 * so the shortcut opens THAT event under the couple's own mark — not ours.
 *
 * The phone is read from the user-agent, the same way the Save button reads it
 * (`saveMethodFor`, lib/guest-one-path.ts — both through `deviceOs`,
 * lib/apple-device.ts): an iPhone/iPad gets Safari's
 * steps, Android gets Chrome's, anything else gets both.
 *
 * Server-only by use (the thank-you is a server component); pure, no I/O. Kept
 * OUT of lib/guest-landing.ts on purpose — that module is read by client
 * components, and the shared bundle has no room for words only one server page
 * prints.
 */

import { deviceOs } from './apple-device';
import { isInAppWebview } from './guest-one-path';

export const HOME_SCREEN_LINE = 'Keep it handy — add this event to your home screen';

export type HomeScreenSteps = { phone: string; steps: string };

const IPHONE: HomeScreenSteps = { phone: 'iPhone or iPad (Safari)', steps: 'Tap Share → Add to Home Screen.' };
const ANDROID: HomeScreenSteps = { phone: 'Android (Chrome)', steps: 'Tap ⋮ → Add to Home screen.' };

/** The steps for this phone — both when the phone cannot be told. */
export function homeScreenStepsFor(userAgent: string | null | undefined): HomeScreenSteps[] {
  const ua = userAgent ?? '';
  // An iPad's user-agent may say Macintosh (lib/apple-device.ts); iPad Safari's
  // never reaches a server as anything else, so it gets both — which holds its own.
  const os = deviceOs(ua);
  if (os === 'iphone' || os === 'ipad') return [IPHONE];
  if (os === 'android') return [ANDROID];
  return [IPHONE, ANDROID];
}

/**
 * 🚪 DOES THE LINE SHOW ON THIS SCREEN? (owner 2026-10-21, DECISION_LOG "AFTER THE REPLY: SAVE YOUR PASS · ADD THIS
 * EVENT TO YOUR HOME SCREEN": *"teach them to add a shortcut icon for this event via Safari/Chrome (if they are on
 * safari/chrome)"*). Only after a Yes (the 2026-10-03 row), and only where "Add to Home Screen" EXISTS:
 *
 *   · ⛔ INSIDE THE STORE APP (the Capacitor shell, `isStoreShellSignals`) — there is no Share → Add to Home Screen
 *     in an app's own web view, and the guest already has the app on their phone;
 *   · ⛔ INSIDE A CHAT APP'S BROWSER (Messenger · Instagram · Facebook, `isInAppWebview`) — no such menu either.
 *     Nothing is said there in its place: the page's own bar at the very top (`InAppBar`, the approved ticket flow's
 *     "Open in your browser" frame, 2026-09-29) already opens this same page in Safari / Chrome, where the line is.
 */
export function shortcutLineShows(input: {
  reply: 'yes' | 'no' | 'unreplied';
  userAgent: string | null | undefined;
  /** The request came from the App Store / Play Store app (`isStoreShellRequest`, lib/request-platform.ts). */
  storeShell: boolean;
}): boolean {
  if (input.reply !== 'yes') return false;
  if (input.storeShell) return false;
  return !isInAppWebview(input.userAgent);
}
