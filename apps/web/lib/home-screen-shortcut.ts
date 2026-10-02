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
 * (`saveMethodFor`, lib/guest-one-path.ts): an iPhone/iPad gets Safari's
 * steps, Android gets Chrome's, anything else gets both.
 *
 * Server-only by use (the thank-you is a server component); pure, no I/O. Kept
 * OUT of lib/guest-landing.ts on purpose — that module is read by client
 * components, and the shared bundle has no room for words only one server page
 * prints.
 */

export const HOME_SCREEN_LINE = 'Keep it handy — add this event to your home screen';

export type HomeScreenSteps = { phone: string; steps: string };

const IPHONE: HomeScreenSteps = { phone: 'iPhone (Safari)', steps: 'Tap Share → Add to Home Screen.' };
const ANDROID: HomeScreenSteps = { phone: 'Android (Chrome)', steps: 'Tap ⋮ → Add to Home screen.' };

/** The steps for this phone — both when the phone cannot be told. */
export function homeScreenStepsFor(userAgent: string | null | undefined): HomeScreenSteps[] {
  const ua = userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return [IPHONE];
  if (/Android/i.test(ua)) return [ANDROID];
  return [IPHONE, ANDROID];
}
