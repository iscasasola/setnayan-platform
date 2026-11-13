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
  /** ⑤ Prototype v16 (`v4`): signed out, none of Google / Apple / Email was picked yet. The browser's own — the server
   *  never sends it (a POST without a way is an email POST). */
  way: 'Pick how you’ll sign in.',
} as const;

export type OpenShopAccountDecision =
  | { kind: 'existing' }
  | { kind: 'create'; email: string; password: string }
  | { kind: 'refuse'; step: 5; error: string };

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
 * Order of refusals follows the order of the boxes: a missing email or password is reported before the
 * agreement. All three sit on step 5 — "Your account" (owner 2026-11-06, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS
 * ANSWERED": the account step is LAST, so the Terms, the sign-in-in-place and the commit share one screen; prototype
 * v16 moved name · number · role to their own step 4, "About you", before it).
 */
export function decideOpenShopAccount(input: OpenShopAccountInput): OpenShopAccountDecision {
  if (input.hasSession) return { kind: 'existing' };
  if (!input.email) return { kind: 'refuse', step: 5, error: OPEN_SHOP_ERRORS.contactEmail };
  if (input.password.length < OPEN_SHOP_PASSWORD_MIN) {
    return { kind: 'refuse', step: 5, error: OPEN_SHOP_ACCOUNT_ERRORS.password };
  }
  if (!input.termsAgreed) return { kind: 'refuse', step: 5, error: input.termsError };
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

/**
 * 🔁 THE PREFILLED EMAIL BELONGS TO THE ACCOUNT THAT SUBMITS (walk 13 Nov 2026, F-W1-13).
 *
 * Signed in, step 5's company email is prefilled with the ACCOUNT's email. The wizard keeps its state across a change
 * of account (the sign-in pane, another tab), so the box could still hold the OLD account's address when "Open my
 * shop" is pressed — and the shop saved it. The form now posts what it was prefilled with
 * (`PREFILLED_ACCOUNT_EMAIL_FIELD`); an address that is still exactly that prefill was never chosen by the person, so it
 * is re-read from the account that actually submits. An address they typed themselves is kept as typed.
 */
export const PREFILLED_ACCOUNT_EMAIL_FIELD = 'prefilled_account_email';

export function accountEmailAtSubmit(input: {
  /** The email the form posted (already cleaned). */
  posted: string | null;
  /** What the box was prefilled with from the account the page was drawn for (already cleaned), or null. */
  prefilled: string | null;
  /** The email of the account that is submitting, or null (signed out). */
  sessionEmail: string | null;
}): string | null {
  const { posted, prefilled, sessionEmail } = input;
  if (!posted || !prefilled || !sessionEmail) return posted;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return same(posted, prefilled) && !same(prefilled, sessionEmail) ? sessionEmail.trim().toLowerCase() : posted;
}

/**
 * 🪪 THE TYPED NAME WINS (owner 13 Nov 2026, the open question on #7613 / walk F-W1-02). When the name a supplier typed
 * on "About you" differs from the name on the Google, Apple or other account they open the shop with, the TYPED name is
 * the shop owner's name — the account's name never overwrites it. The account name is only a fallback when nothing was
 * typed. (This reverses the 2026-08-10 "the account name wins, read-only" lock.)
 *
 * 🔒 app/open-shop/the-walk-round-1.test.ts
 */
export function shopOwnerNameOf(typed: string | null | undefined, account: string | null | undefined): string | null {
  const t = (typed ?? '').trim();
  if (t) return t;
  const a = (account ?? '').trim();
  return a || null;
}
