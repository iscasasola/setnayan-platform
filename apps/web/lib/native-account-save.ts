/**
 * "SAVE TO MY ACCOUNT" INSIDE THE PHONE APP — the hand-off from the save's
 * Server Action to the phone app's NATIVE sign-in (lib/native-oauth.ts).
 * Pure: imported by the actions, the component and the tests alike.
 *
 * WHY. On the web the Save press is a Server Action that ends in a redirect to
 * Apple / Google (`signInWithApple` / `signInWithGoogle`). Inside the app that
 * redirect leaves the web view: the provider page opened in Safari, the
 * account was signed in THERE, and the app — the place the guest pressed Save —
 * never saw it. The app has its own door for this since #6330: the Sign in with
 * Apple sheet on iOS and Google in the SYSTEM browser, both returning into the
 * app's own web view (`signInWithProviderNative`).
 *
 * HOW (one rule, the shipped pieces):
 *   1. WHO — `oauthGate(...).native` (lib/oauth-shell-gate.ts), the SAME rule
 *      /login uses: a phone build carrying `SetnayanSignIn/1`, with Apple on.
 *      The web, the desktop app and an older phone build are untouched.
 *   2. The page draws the Save form with `NATIVE_SAVE_FIELD` in it and a client
 *      form (`NativeSaveForm`) that calls the SAME Server Action.
 *   3. The action does everything it always did — the guest pass, the Terms
 *      tick and its cookie, the method its button SAID — and then, instead of
 *      redirecting to the provider, RETURNS `{ native, next }`.
 *   4. The client form hands that to `signInWithProviderNative(native, next)`.
 *      `next` is the SAME `/join/{eventId}/connect` the web door returns to —
 *      the one linking path, whose confirm page asks before any seat binds
 *      (DECISION_LOG 2026-09-30 "A SEAT BECOMES AN ACCOUNT'S ONLY ON PURPOSE").
 *
 * 🔒 The hand-off carries no secret — a provider name and a path on our own
 * site. A tampered field can only turn a web redirect into a return value the
 * plain browser ignores; the request's own user-agent must ALSO pass the gate.
 */
import { classifyShell, oauthGate } from '@/lib/oauth-shell-gate';
import { isSafeNext } from '@/lib/safe-next';

/** The hidden field the native Save form carries ("1"). */
export const NATIVE_SAVE_FIELD = 'native_sign_in';

/** What the save's action hands back to the app instead of a provider redirect. */
export type NativeSaveHandOff = { native: 'apple' | 'google'; next: string };

/**
 * A save action as a plain `<form action>` sees it. On the web the action never
 * hands back (its form carries no `NATIVE_SAVE_FIELD`), so its answer is void
 * there; React's `action` type only admits `Promise<void>`.
 */
export type WebFormAction = (formData: FormData) => Promise<void>;

/** The providers the deployment has switched on (NEXT_PUBLIC_OAUTH_*). */
export type SaveProviders = { apple: boolean; google: boolean };

/**
 * Does this device's Save take the phone app's NATIVE sign-in? The one gate
 * (`oauthGate`), fed the providers the Save button itself reads.
 */
export function saveSignsInNatively(userAgent: string | null | undefined, providers: SaveProviders): boolean {
  const ua = userAgent ?? '';
  return oauthGate(classifyShell(ua, null), ua, {
    any: providers.apple || providers.google,
    apple: providers.apple,
  }).native;
}

/**
 * The action's decision: hand back to the app's native sign-in, or null (the
 * web redirect, exactly as before). Native only when the FORM asked for it
 * (only the native Save form carries the field) AND this request's own
 * user-agent passes the same gate.
 */
export function nativeSaveHandOff(input: {
  posted: unknown;
  userAgent: string | null | undefined;
  providers: SaveProviders;
  method: string;
  next: string;
}): NativeSaveHandOff | null {
  if (input.posted !== '1') return null;
  if (input.method !== 'apple' && input.method !== 'google') return null;
  if (!saveSignsInNatively(input.userAgent, input.providers)) return null;
  return { native: input.method, next: input.next };
}

/**
 * Narrow an action's return value to a hand-off (anything else: nothing to do).
 * Its `next` is judged by THE ONE where-next rule (`isSafeNext`, lib/safe-next.ts)
 * — never a second, weaker prefix check of its own (2026-10-04, train-g audit:
 * `/\\evil.com` and `/\t/evil.com` passed "starts with `/`, not `//`").
 */
export function isNativeSaveHandOff(value: unknown): value is NativeSaveHandOff {
  const v = value as { native?: unknown; next?: unknown } | null | undefined;
  return !!v && (v.native === 'apple' || v.native === 'google') && isSafeNext(v.next);
}
