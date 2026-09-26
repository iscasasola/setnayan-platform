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

/**
 * 🎟 THE AGREEMENT A GUEST GAVE ON THE RSVP PAGE, carried to the account they
 * make one tap later (owner 2026-09-27: *"Ok"* to the Terms tick on the RSVP
 * Send step; Save-to-account stays ONE tap).
 *
 * The RSVP page's tick is the affirmative act. The account is made on the NEXT
 * screen — by Google or Apple, which return through `app/auth/callback`, or by
 * the emailed link. Neither of those screens asks again, so the agreement has
 * to travel from one to the other: an httpOnly cookie, set by the RSVP save
 * ONLY when the tick was posted, holding the version agreed to. The callback
 * records it on a new account with none on record.
 *
 * 🔒 NEVER A HIDDEN FORM FIELD. A pre-set `terms_agreed=on` in a form is the
 * "hidden consent" this repo has already removed once (`consent-is-affirmative
 * .test.ts`). A cookie the browser cannot read and no page can pre-fill is set
 * by the server, from the tick, and nothing else.
 */
export const RSVP_TERMS_COOKIE = 'sn_rsvp_terms';

/** 30 days — long enough to cover "Not now" today and "Save to my account" from Me next week. */
export const RSVP_TERMS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Does the carried cookie say they agreed to the version in force now? A
 * cookie from an older version is not an agreement to this one.
 */
export function rsvpTermsCarried(value: string | null | undefined): boolean {
  return value === TERMS_VERSION;
}

/** What a refused sign-up is told. Names the act, not the field. */
export const TERMS_REQUIRED_MESSAGE =
  'Please agree to the Terms and Privacy Policy to create your account.';

/**
 * 🔁 THE ONE-TIME RE-ASK (owner 2026-09-25: re-prompt the accounts with no
 * agreement on record — *"yes"*).
 *
 * The clickwrap shipped 2026-09-22, but only the email doors ever recorded it:
 * a Google or Apple sign-up (`app/auth/callback`) never wrote
 * `terms_accepted_at`, and an email sign-up between 09-22 and #5990 lost it too.
 * Measured in production 2026-09-26: all 3 accounts created since 09-22 had
 * none — one Google, one email, one Apple.
 *
 * So a signed-in account made on or after the clickwrap date with no agreement
 * on record is asked ONCE, and the ask covers every door that forgets, today
 * and later. Older accounts pre-date the clickwrap and are not swept in.
 *
 * ⚠ FAILS OPEN on a missing read (`null` profile, no `created_at`): an account
 * we could not load is not asked — this screen stands in front of the whole
 * dashboard, and a failed read must never lock a couple out of their event.
 */
export const CLICKWRAP_SINCE = '2026-09-22';

export function needsTermsAgreement(
  profile: { terms_accepted_at?: string | null; created_at?: string | null } | null,
  opts: { isAnonymous?: boolean } = {},
): boolean {
  if (!profile || opts.isAnonymous) return false;
  if (profile.terms_accepted_at) return false;
  if (!profile.created_at) return false;
  return profile.created_at.slice(0, 10) >= CLICKWRAP_SINCE;
}
