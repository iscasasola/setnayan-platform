/**
 * sign-in-door.ts — after a FAILED password sign-in, what to tell the person.
 * Pure; executed by `sign-in-door.test.ts`.
 *
 * ── THE DEFECT (owner 2026-09-23, measured on prod the same day) ──────────
 * Three of eleven real accounts — the owner's own among them — are Google-only:
 * no password exists. When one of them types a password, GoTrue answers
 * "Invalid login credentials" and the card says "That email and password do
 * not match." That sentence is false in exactly the way this redesign exists
 * to kill: the password does not fail to match, IT DOES NOT EXIST, and the
 * advice (try another, reset one) can never work. A third of the live accounts
 * were locked out with misleading help.
 *
 * ── THE RULE (owner's constraint, not a preference) ───────────────────────
 * The door is revealed ONLY AFTER a failed password attempt. Telling anyone who
 * merely types an email which provider it uses confirms the account exists
 * and leaks its provider to a prober; after a failed attempt they have already
 * shown they know the address. So this module takes the auth refusal as its
 * FIRST input and returns the refusal unchanged unless it was a credentials
 * refusal — the lookup result is never consulted for any other error, and the
 * server module that performs the lookup is called only from that branch.
 *
 * ── AND NEVER SWALLOW THE REAL ERROR ─────────────────────────────────────
 * A lookup that could not run must not become "wrong password" either — that
 * is the same defect one layer down. If we cannot tell, we say we cannot tell.
 * An email with NO account gets the ordinary mismatch sentence: the door must
 * never confirm that an address is unknown.
 */

export type SignInDoor =
  /** The lookup could not run (refused, timed out, threw). */
  | { kind: 'unknown' }
  /** No account for that email. Say nothing that confirms it. */
  | { kind: 'none' }
  | { kind: 'account'; hasPassword: boolean; providers: string[] };

export type KnownProvider = 'google' | 'apple';

export type FailedSignInExplanation = {
  /** The sentence the card shows (already human; passes humanAuthError as-is). */
  message: string;
  /** The door the account actually uses, when that is the answer. */
  provider: KnownProvider | null;
};

/** GoTrue's own refusal for a wrong OR missing password. Same regex humanAuthError keys on. */
export const CREDENTIALS_REFUSAL = /invalid login credentials/i;

export const SIGN_IN_DOOR_MESSAGES = {
  /** The shipped sentence, kept for the true case and for "no account" alike. */
  mismatch: 'That email and password do not match. Check both and try again.',
  couldNotTell:
    'We could not sign you in, and we could not check how this account signs in. Try again in a moment.',
  noPasswordYet:
    'This account has no password yet. Use “Forgot password?” below to set one, and sign in with it.',
  google: 'This account signs in with Google.',
  apple: 'This account signs in with Apple.',
} as const;

/** The providers the card has buttons for. Anything else is "no password yet". */
function knownProvider(providers: string[]): KnownProvider | null {
  const set = new Set(providers.map((p) => p.toLowerCase()));
  if (set.has('google')) return 'google';
  if (set.has('apple')) return 'apple';
  return null;
}

/**
 * Decide the sentence. `door` is only ever read when `authMessage` is the
 * credentials refusal; for every other refusal the auth sentence passes through
 * untouched (rate limits, captcha, unconfirmed email keep their own words).
 */
export function explainFailedSignIn(input: {
  authMessage: string;
  door: SignInDoor | null;
}): FailedSignInExplanation {
  const { authMessage, door } = input;
  if (!CREDENTIALS_REFUSAL.test(authMessage)) return { message: authMessage, provider: null };
  if (door === null || door.kind === 'unknown') {
    // Never "wrong password" when we could not check. Say so.
    return { message: door === null ? authMessage : SIGN_IN_DOOR_MESSAGES.couldNotTell, provider: null };
  }
  if (door.kind === 'none') return { message: authMessage, provider: null };
  if (door.hasPassword) return { message: authMessage, provider: null };
  const provider = knownProvider(door.providers);
  if (provider === 'google') return { message: SIGN_IN_DOOR_MESSAGES.google, provider };
  if (provider === 'apple') return { message: SIGN_IN_DOOR_MESSAGES.apple, provider };
  return { message: SIGN_IN_DOOR_MESSAGES.noPasswordYet, provider: null };
}

/**
 * What the card prints under the provider sentence, given whether the OAuth
 * buttons are on screen at all (the phone shell hides them: Google refuses to
 * run inside a WebView). A door the person cannot see is not help.
 */
export function providerNextStep(provider: KnownProvider, oauthVisible: boolean): string {
  const name = provider === 'google' ? 'Google' : 'Apple';
  return oauthVisible
    ? `Use the ${name} button above.`
    : `Open setnayan.com in Safari or Chrome and use the ${name} button there.`;
}

/**
 * The `?provider=` query value on the /login route is untrusted text; only the
 * two doors the card has buttons for are ever honoured.
 */
export function parseProviderParam(raw: string | string[] | undefined): KnownProvider | null {
  return raw === 'google' || raw === 'apple' ? raw : null;
}
