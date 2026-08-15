/**
 * vendor-event-creation-copy.ts — the refusal sentence, with NO boundary.
 *
 * 🪤 THIS EXISTS BECAUSE THE COPY IS NEEDED ON BOTH SIDES. The rule itself
 * (`lib/vendor-event-creation.ts`) reads the database and is `server-only`;
 * the onboarding wizard that must SHOW the refusal is `'use client'`. Putting
 * the sentence in the server module made a client component import a
 * server-only one, which `scripts/lint-server-only-boundary.mjs` exists to
 * catch and which breaks the production build.
 *
 * Same split as `onboarding/simple/_components` field names, for the same
 * reason: a pure string has no business carrying an IO boundary with it.
 */

/**
 * The one sentence a shop account sees instead of a create screen.
 *
 * 🔑 IT NAMES THE WAY FORWARD. The old behaviour was a SILENT flick back to the
 * shop overview with no message — indistinguishable from a broken button, and
 * the reason an audit found it at all. Nothing in the product told a supplier
 * that planning happens on a personal account, so being bounced taught them
 * nothing. **A refusal that does not say what to do instead is half a refusal.**
 *
 * ⚠ Deliberately NOT "please try again": retrying is exactly what cannot work,
 * the same reasoning that gives the duplicate-life-event refusal its own branch
 * rather than the generic error.
 */
export const SHOP_ACCOUNT_CANNOT_CREATE_COPY =
  'This is your business account, so it doesn’t plan celebrations. To plan your own, sign up with a personal account using a different email — your shop stays exactly as it is.';
