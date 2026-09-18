/**
 * turnstile-error-guidance.ts — what to say, and what to do, when the bot
 * check itself fails.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * 2026-09-18. The owner switched Supabase captcha on. The widget rendered
 * "Verification failed" and nobody could sign in with an email and password.
 * It took the better part of an hour to work out what had happened, and the
 * reason it took that long is one line:
 *
 *     'error-callback': () => { input.value = ''; }
 *
 * Cloudflare passes the ERROR CODE to that callback. We declared no parameter
 * and logged nothing — the page was told exactly what was wrong and discarded
 * it. The person saw a red box with no code; the owner saw a red box with no
 * code; a session with database access and the served bundle in hand was
 * reduced to guessing at hostname lists.
 *
 * 🔑 The measurement existed and never reached anybody. Same shape as the
 * upload that stopped with no event and the refused read that rendered as
 * "no guests yet" — except this one hid the diagnosis of an outage.
 *
 * ⚖ AND A PERSON WHO CANNOT SOLVE THE CHALLENGE NEEDS A DOOR, NOT A REASON.
 * Whatever the code, the honest advice is the same: the other sign-in buttons
 * do not carry a Turnstile token, so they still work. Every message below ends
 * somewhere the person can actually go.
 */

/** Guidance for one Turnstile client-side error code. */
export type TurnstileGuidance = {
  /** What the person reads. Always actionable, never just "failed". */
  message: string;
  /** True when trying again might genuinely work. */
  retryable: boolean;
  /** True when only the owner can fix it — a misconfiguration, not the visitor. */
  ownerMustFix: boolean;
};

/**
 * Cloudflare's documented client error families. Matched on PREFIX, because
 * the codes carry a trailing detail digit that varies (`600***`), and an exact
 * list would silently fall through to the default the first time Cloudflare
 * added one.
 */
const FAMILIES: ReadonlyArray<readonly [RegExp, TurnstileGuidance]> = [
  [
    // 110200 — this domain is not on the widget's hostname list.
    /^1102/,
    {
      message:
        'The security check is not set up for this web address. Signing in with Google or Apple still works, and we have been told about it.',
      retryable: false,
      ownerMustFix: true,
    },
  ],
  [
    // 110100 / 110110 — the site key is wrong or has been deleted.
    /^1101/,
    {
      message:
        'The security check is misconfigured on our side. Signing in with Google or Apple still works, and we have been told about it.',
      retryable: false,
      ownerMustFix: true,
    },
  ],
  [
    // 110500 — this browser cannot run the challenge.
    /^1105/,
    {
      message:
        'This browser cannot run our security check. Try Google or Apple sign-in, or open the page in a different browser.',
      retryable: false,
      ownerMustFix: false,
    },
  ],
  [
    // 110600 — the challenge expired before it was solved.
    /^1106/,
    {
      message: 'The security check timed out. Reload the page and try again.',
      retryable: true,
      ownerMustFix: false,
    },
  ],
  [
    // 300*** / 600*** — transient execution failures. Cloudflare's own advice
    // is to retry.
    /^[36]00/,
    {
      message: 'The security check could not finish. Reload the page and try again.',
      retryable: true,
      ownerMustFix: false,
    },
  ],
  [
    // 1020xx — the visitor is being blocked by a Cloudflare rule.
    /^1020/,
    {
      message:
        'Our security check would not let this connection through. Try Google or Apple sign-in, or a different network.',
      retryable: false,
      ownerMustFix: false,
    },
  ],
];

/**
 * ⚠ ALWAYS RETURNS GUIDANCE. An unrecognised code is the case that matters
 * most — it is the one nobody has seen before — so it gets the most useful
 * generic answer and the code is printed for whoever is looking.
 */
export function turnstileErrorGuidance(code: unknown): TurnstileGuidance {
  const c = String(code ?? '').trim();
  for (const [pattern, guidance] of FAMILIES) {
    if (pattern.test(c)) return guidance;
  }
  return {
    message:
      'Our security check did not load. Signing in with Google or Apple still works, or reload the page to try again.',
    retryable: true,
    ownerMustFix: false,
  };
}

/** The line written to the console, so a code is one F12 away, never an hour. */
export function turnstileErrorLogLine(code: unknown): string {
  const c = String(code ?? '').trim() || 'unknown';
  const g = turnstileErrorGuidance(code);
  return (
    `[turnstile] challenge failed — code ${c}` +
    (g.ownerMustFix ? ' · OWNER ACTION: check the widget config in Cloudflare' : '') +
    ` · https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/`
  );
}
