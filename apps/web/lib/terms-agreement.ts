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
 *
 * 🔁 BUMPING IT RE-ASKS EVERY ACCOUNT ONCE (`needsTermsAgreement` below) — so
 * bump it for a change people must agree to, never for a wording tidy-up (those
 * move the page's "last updated" date, not its effective date).
 *
 * 2026-10-23 — NO REFUNDS. The Terms' refund line changed from "a full refund
 * whenever we fail to deliver" to "purchases are not refunded, and a paid
 * service you cannot use becomes Papic credits" (#8bec5bd31c, `/refunds`
 * effective 2026-10-23). Every account had agreed to the refund promise; owner
 * 2026-10-25, verbatim "Yes" to: *"after the no-refunds change, should everyone
 * re-agree to the Terms once on next login?"*
 */
export const TERMS_VERSION = '2026-10-23';

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
 * 🔁 THE ONE-TIME RE-ASK — every signed-in account whose agreement on record is
 * not to the Terms in force now is asked ONCE, on its next signed-in page
 * (`app/_components/terms-reaccept/terms-reaccept-sheet.tsx`, mounted by the
 * couple, supplier and admin layouts — never a guest page).
 *
 * History of the rule:
 *   · 2026-09-25 (owner *"yes"*): accounts made since the clickwrap
 *     (2026-09-22) with NO agreement on record — Google / Apple sign-ups never
 *     wrote one — were asked once. Older accounts were left alone.
 *   · 2026-10-25 (owner *"Yes"* to everyone re-agreeing after the no-refunds
 *     change): the ask is now about the VERSION, not the date the account was
 *     made. An agreement to an older `terms_version` — or none at all, which
 *     is what every pre-clickwrap account has — is not an agreement to these
 *     Terms, so everyone is asked once. A new sign-up records `TERMS_VERSION`
 *     and is never asked.
 *
 * ⚠ FAILS OPEN on a read we could not make: a `null` profile (no row, or the
 * read failed) and a profile whose `terms_version` key is ABSENT (the caller
 * never selected it) are not asked — this sheet stands in front of a signed-in
 * page, and a failed read must never lock a couple out of their event. Only a
 * read that came back and SAID null / an older version asks.
 *
 * ISO dates compare as strings, so `<` is "older than".
 */
export function agreedToCurrentTerms(version: string | null | undefined): boolean {
  return typeof version === 'string' && version >= TERMS_VERSION;
}

export function needsTermsAgreement(
  profile: { terms_version?: string | null } | null,
  opts: { isAnonymous?: boolean } = {},
): boolean {
  if (!profile || opts.isAnonymous) return false;
  if (!('terms_version' in profile) || profile.terms_version === undefined) return false;
  return !agreedToCurrentTerms(profile.terms_version);
}

/** What the re-ask says when the save did not land. Names what happened and what to do. */
export const TERMS_SAVE_FAILED_MESSAGE = "We couldn't save that. Check your connection and try again.";

/**
 * ✅ THE SIGN-UP CARD'S ONE TICK, carried through Google / Apple (owner 2026-10-22, "Yes to all" — Host 1 option B,
 * prototype `journey_fixes_2026-10-22.html`): one Terms box ABOVE the email, Google and Apple doors.
 *
 * The email door posts the box with its form. Google and Apple leave the page, so the agreement travels the way the
 * RSVP page's tick already does: an httpOnly cookie set BY THE SERVER from the posted tick
 * (`app/auth/terms-carry-action.ts`), read and spent by `app/auth/callback`, which records it on an account with none
 * on record. Scoped to the callback's path and short-lived — it lives only across one provider round trip.
 *
 * 🔑 NOT OAuth `state`. Supabase's auth server writes and consumes its own `state` on the provider leg; our callback
 * only ever receives `?code=` and the `redirectTo` query — which is a URL anyone can type, i.e. a claim, not a tick.
 */
export const SIGNUP_TERMS_COOKIE = 'sn_signup_terms';
/** Only the callback reads it. */
export const SIGNUP_TERMS_COOKIE_PATH = '/auth/callback';
/** 30 minutes — one Google / Apple round trip, with room for a slow consent screen. */
export const SIGNUP_TERMS_COOKIE_MAX_AGE = 30 * 60;

/** Does the sign-up card's carried cookie say they ticked the version in force now? */
export function signupTermsCarried(value: string | null | undefined): boolean {
  return value === TERMS_VERSION;
}

/**
 * Should the callback record an agreement on this sign-in? Only on a tick the person performed and the server
 * carried: the RSVP page's (on the event-connect route only, as before), or the sign-up card's. Nothing carried →
 * nothing recorded, and the one-time re-ask (`needsTermsAgreement`) still stands in front of the dashboard.
 */
export function carriedTermsAgreement(input: {
  eventConnect: boolean;
  rsvpCookie: string | null | undefined;
  signupCookie: string | null | undefined;
}): boolean {
  return (input.eventConnect && rsvpTermsCarried(input.rsvpCookie)) || signupTermsCarried(input.signupCookie);
}
