/**
 * open-shop-account.ts — WHO is opening this shop, and may they? A pure decision.
 *
 * ── THE RULING (owner 2026-09-22, verbatim: "approved. account inside step 3") ──
 * A stranger at `/open-shop` used to be bounced to `/login?next=/open-shop&as=vendor`
 * first (2026-07-10 "login FIRST so we can check the account"). From this build the
 * wizard runs signed OUT as well: step 3 — *Who you are* — carries a password beside
 * the name, number and company email, and ONE submit creates the account and the shop
 * together. Someone who already has an account presses "Sign in" on that step; the
 * popup opens over the wizard and what they typed stays (the seam, 2026-08-12).
 *
 * ── WHY THIS IS A MODULE AND NOT A BRANCH IN THE ACTION ──────────────────────
 * `becomeVendor` is a `'use server'` action that ends every refusal in `redirect()`,
 * which throws a framework signal — a test cannot call it and read an answer. So the
 * decision lives here, takes plain values, returns a plain value, and
 * `open-shop-account.test.ts` EXECUTES it. The action only translates form fields in
 * and redirects out.
 *
 * ── WHAT IT DECIDES ──────────────────────────────────────────────────────────
 *   existing  — there is a session: the shop is opened on that account. The password
 *               and the terms box are IGNORED even if a hand-built POST sends them;
 *               a signed-in person is never re-asked to agree on this path.
 *   create    — no session, a usable email, a password of at least the minimum, and
 *               an affirmative agreement: create the account, then the shop, in one go.
 *   refuse    — no session and something missing. Every refusal NAMES ITS STEP
 *               (`four-steps.test.ts`): the wizard holds all four steps on one form and
 *               nothing is written until submit, so a refusal that lands on the wrong
 *               step throws away everything typed after it.
 *
 * The agreement's own parse (`hasAgreedToTerms`) and its sentence live in
 * `lib/terms-agreement.ts` — ONE implementation of that gate. This module takes the
 * already-decided boolean and the sentence, so it can never drift from that file.
 */
import { OPEN_SHOP_ERRORS } from '@/lib/open-shop-validation';

/** Same floor as `/signup` (`password.length < 8` → `password_too_short`). */
export const OPEN_SHOP_PASSWORD_MIN = 8;

/**
 * The refusals this path can add on top of `OPEN_SHOP_ERRORS`. The password and
 * breach sentences are the SAME words `/signup`'s `ERROR_COPY` uses, so the two doors
 * never explain one rule two ways.
 */
export const OPEN_SHOP_ACCOUNT_ERRORS = {
  password: 'Password must be at least 8 characters.',
  passwordLeaked:
    'This password has appeared in a known data breach. Please choose a different one — it only takes a moment and it protects your account.',
  blacklisted:
    'This email cannot be used to create a Setnayan account. Please use a different email, or contact support if you think this is a mistake.',
  emailTaken:
    'That email already has a Setnayan account. Sign in to keep going — what you typed stays.',
  accountFailed: 'We could not create your account just now. Try again in a moment.',
} as const;

export type OpenShopAccountDecision =
  | { kind: 'existing' }
  | { kind: 'create'; email: string; password: string }
  | { kind: 'refuse'; step: 3 | 4; error: string };

export type OpenShopAccountInput = {
  /** A signed-in user exists for this request. */
  hasSession: boolean;
  /** The company email, already shape-checked by the caller (null = unusable). */
  email: string | null;
  /** The password field as posted — empty string when absent. */
  password: string;
  /** `hasAgreedToTerms(formData.get(TERMS_FIELD))`, decided by lib/terms-agreement. */
  termsAgreed: boolean;
  /** `TERMS_REQUIRED_MESSAGE` from the same file — the one sentence for that refusal. */
  termsError: string;
};

/**
 * Order of refusals follows the order of the screens: a missing email or password is
 * a step-3 problem and is reported before the step-4 agreement, so the vendor is sent
 * to the EARLIEST screen that needs them and walks forward from there.
 */
export function decideOpenShopAccount(input: OpenShopAccountInput): OpenShopAccountDecision {
  if (input.hasSession) return { kind: 'existing' };
  if (!input.email) return { kind: 'refuse', step: 3, error: OPEN_SHOP_ERRORS.contactEmail };
  if (input.password.length < OPEN_SHOP_PASSWORD_MIN) {
    return { kind: 'refuse', step: 3, error: OPEN_SHOP_ACCOUNT_ERRORS.password };
  }
  if (!input.termsAgreed) return { kind: 'refuse', step: 4, error: input.termsError };
  return { kind: 'create', email: input.email, password: input.password };
}

/**
 * Supabase's `signUp` does not always SAY an email is taken. With email enumeration
 * protection on it returns a success-shaped user whose `identities` array is EMPTY,
 * and the newer message form is "User already registered". Both mean the same thing
 * to this door: send them to Sign in, keep what they typed.
 */
export function signUpSaysEmailTaken(result: {
  error: { message?: string | null } | null;
  identities: unknown[] | null | undefined;
}): boolean {
  if (result.error) return /already (registered|exists)/i.test(result.error.message ?? '');
  return Array.isArray(result.identities) && result.identities.length === 0;
}
