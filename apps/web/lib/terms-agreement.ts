/**
 * terms-agreement.ts — the agreement a person makes at sign-up, and its version.
 *
 * ── THE DEFECT (CTRL-B3 build 2, measured 2026-09-22) ───────────────────────
 * `/signup` carried **browsewrap**: a footnote BELOW the submit button reading
 * *"By signing up, you agree to our Terms and Privacy."* The only checkboxes on
 * the page were "Include my wedding in Stories" and "Stay signed in" — neither
 * about the agreement. Nothing was recorded, so there was nothing to produce
 * later either.
 *
 * Browsewrap is materially weaker in Philippine courts and under the NPC's
 * consent standard than a clickwrap the person performs.
 *
 * ── THE VERSION ────────────────────────────────────────────────────────────
 * 🔑 DERIVED FROM THE TERMS PAGE'S OWN EFFECTIVE DATE, not invented here.
 * `/terms` renders `meta="Effective 2026-06-30 · governed by the laws of the
 * Republic of the Philippines"`, and a guard holds the two together — an
 * agreement recorded against a version nobody can look up is not evidence of
 * anything, and a hand-typed second copy is how those drift apart.
 */

/**
 * The version a new agreement is recorded against: the effective date shown on
 * `/terms`, ISO. Bump this ONLY when that page's effective date changes — the
 * guard `terms-are-agreed-not-assumed.test.ts` fails if the two disagree.
 */
export const TERMS_VERSION = '2026-06-30';

/** The form field the checkbox posts. One name, so no door can invent a second. */
export const TERMS_FIELD = 'terms_agreed';

/**
 * Did this submission carry an affirmative agreement?
 *
 * ⚠ FAILS CLOSED, and the shape matters: an unticked HTML checkbox posts
 * NOTHING AT ALL — the key is simply absent. So every falsy reading (absent,
 * empty, "off", "false", a stray value) must be a refusal, or the one state
 * that means "they did not tick it" would be the state that let them through.
 */
export function hasAgreedToTerms(value: FormDataEntryValue | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'on' || v === 'yes' || v === 'true' || v === '1';
}

/** What a refused sign-up is told. Names the act, not the field. */
export const TERMS_REQUIRED_MESSAGE =
  'Please agree to the Terms and Privacy Policy to create your account.';
