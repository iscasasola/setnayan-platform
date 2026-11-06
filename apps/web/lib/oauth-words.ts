/**
 * apps/web/lib/oauth-words.ts — THE ONE WORDING OF EVERY GOOGLE / APPLE BUTTON.
 *
 * "Continue with Google" · "Continue with Apple" — on /login, /signup, the wedding onboarding's account screen, the
 * desktop app's and the phone app's rows, and the typed-Google-address door. Every one of those components renders
 * `${OAUTH_VERB} <provider>` from here and takes no `verb` prop, so no door can word the same button differently.
 *
 * 🗣 WHY ONE WORDING (sweep C9, 2026-10-19). /signup said "Sign in with Google / Apple" (a `SIGNUP_OAUTH_VERB`
 * constant, read off the owner's 2026-09-23 sentence "…or directly sign in with Google or Apple") while /login said
 * "Continue with Google / Apple" — one button, two names, one tap apart. "Continue" is right on both: for a new
 * person the tap makes the account, for a returning one it signs them in, and Google's and Apple's own button
 * guidelines both offer "Continue with" for exactly that case. The owner's sentence itself still opens /signup.
 *
 * Client-safe on purpose (no server import): the desktop / phone rows and the address door are client components.
 * Guard: `lib/one-oauth-wording.test.ts`.
 */
export const OAUTH_VERB = 'Continue with';
