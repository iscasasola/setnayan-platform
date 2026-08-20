/**
 * human-auth-error.ts — a refused sign-in must say something a PERSON can act
 * on.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * Owner 2026-08-20, screenshotting the sign-in panel with a red banner reading
 * exactly `{}`: *"a blank error"*.
 *
 * `{}` is the fingerprint of an error OBJECT that has been stringified —
 * `JSON.stringify(new Error('boom'))` is `'{}'`, because an Error's own
 * properties are not enumerable. Whatever produced it, the banner printed it
 * verbatim, because the banner prints whatever string it is handed. Verified
 * live: `/login?error=%7B%7D` renders `hr-si-banner--error">{}</p>`, while
 * `?error=Test%20message%20here` renders the sentence — so the banner works
 * and was being handed junk.
 *
 * 🔑 ONE GATE, NOT N CHECKS. Sign-in messages arrive from at least four
 * places — the `/login` route's `?error=`, the in-place panel action, the
 * OAuth start action, and the desktop loopback — and `?error=` is a QUERY
 * PARAM, so anyone can type anything into it. Sanitising at each producer is
 * N chances to forget and the next producer makes N+1. This runs at the one
 * place they all converge: the render.
 *
 * ⚖ IT FAILS TOWARD THE GENERIC SENTENCE, never toward silence. A refusal a
 * person cannot read is bad; a refusal that renders NOTHING is worse — they
 * are left staring at a form that appears to have done nothing at all.
 */

/**
 * What we say when the underlying message cannot be shown to a person.
 * Deliberately actionable rather than apologetic: it names the two things
 * that are actually worth trying.
 */
export const GENERIC_SIGN_IN_ERROR =
  'We could not sign you in. Check your email and password, or try again in a moment.';

/**
 * Messages the provider gives us that are TRUE but unreadable, mapped to what
 * the person should actually understand.
 *
 * 🔑 `provider is not enabled` IS THE ONE THAT BIT US. Google sign-in is
 * gated by TWO switches — `NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED` decides whether
 * the button is drawn, and the Supabase project decides whether the provider
 * answers. On 2026-08-20 the first was ON and the second OFF, so the button
 * was drawn and could never work. The auth log recorded
 * `"error":"provider is not enabled"` at `/authorize`, status 400. Until
 * somebody flips the second switch, the honest thing is to send the person to
 * the door that does work rather than to explain our configuration to them.
 */
const KNOWN: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /provider is not enabled|validation_failed|unsupported provider/i,
    'That sign-in option is not available right now. Use your email and password below.',
  ],
  [
    /invalid login credentials/i,
    'That email and password do not match. Check both and try again.',
  ],
  [
    /email not confirmed/i,
    'Open the confirmation link we emailed you, then sign in.',
  ],
  [
    /rate limit|too many requests/i,
    'Too many tries. Wait a minute, then try again.',
  ],
  [
    /captcha/i,
    'The security check did not pass. Reload the page and try again.',
  ],
];

/**
 * True when a string is something we would be willing to show a person.
 *
 * The test is deliberately about SHAPE, not a deny-list of known-bad values —
 * a deny-list is a bill you have to keep paying, and the next machine string
 * will not be `{}`. Anything that looks like serialized data, carries no
 * letters, or is a bare token rather than a sentence is refused.
 */
export function isHumanReadable(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 4) return false;
  // Serialized data of any shape: {}, [], {"code":…}, <html>, …
  if (/^[[{<]/.test(s)) return false;
  // No letters at all ⇒ nothing to read.
  if (!/\p{L}/u.test(s)) return false;
  // A bare machine token: one word, no spaces, snake/kebab/dotted.
  if (!/\s/.test(s) && /[_.]|-{1}/.test(s)) return false;
  return true;
}

/**
 * The sentence to show for a raw sign-in error, or `null` when there is no
 * error at all.
 *
 * ⚠ `null` IN MEANS `null` OUT. This is a formatter, not a detector: inventing
 * a failure for somebody who has not had one would paint an error banner over
 * a form they have not submitted.
 */
export function humanAuthError(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;

  for (const [pattern, message] of KNOWN) {
    if (pattern.test(s)) return message;
  }
  return isHumanReadable(s) ? s : GENERIC_SIGN_IN_ERROR;
}
