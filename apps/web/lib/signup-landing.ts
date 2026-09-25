/**
 * signup-landing.ts — where a brand-new account goes next, and what the "You" card
 * may write. Pure: executed by `signup-landing.test.ts`.
 *
 * ── THE RULING (owner 2026-09-22, verbatim: "small card for signup") ─────────
 * `/signup` is the same small card as sign-in. What that card no longer asks —
 * first name, last name — moves to ONE card right after the account exists:
 * "You" (`/signup/you`): a photo (optional), a display name, an @account name
 * with a live availability check, the formal name folded away, a phone. Done or
 * Later; everything on it also lives under Profile & settings.
 *
 * ── WHO SEES THE YOU CARD ─────────────────────────────────────────────────
 * Couples. A vendor arriving through `/signup?as=vendor` lands on `/open-shop`,
 * whose step 3 already asks their name (and, since 2026-09-22, creates the
 * account when there is none) — a You card in front of it would ask the same
 * name twice on the same afternoon.
 *
 * ── THE @ACCOUNT NAME IS SET HERE ONCE, NEVER RENAMED HERE ───────────────────
 * `users.slug` is written by exactly one rename path (`updateUserSlug` on the
 * profile page: a 24-hour rename cap, a change log, forwarding). A brand-new
 * account has NO slug, so the You card may set it for the FIRST time with the
 * same shape rules and the same conflict check — and only while it is still
 * empty. `planYouCard` refuses to carry a slug for an account that already has
 * one; the page never renders the field in that case, and the plan is the
 * second lock behind the screen.
 */
import { signInDestination } from '@/lib/sign-in-landing';
import { SLUG_FORMAT } from '@/lib/slug-availability';
import { isReservedSlug } from '@/lib/reserved-slugs';
import {
  planPersonalInfoPatch,
  PRESENCE_MARKERS,
  type FormLike,
} from '@/lib/profile-personal-info-patch';

export type SignupAccountType = 'customer' | 'vendor';

export const YOU_PATH = '/signup/you';

/** The You card's own address, carrying the destination it hands on to. */
export function youHref(next: string): string {
  return next && next !== '/' ? `${YOU_PATH}?next=${encodeURIComponent(next)}` : YOU_PATH;
}

/**
 * After `signUp` signs the new account in: couples meet the You card; vendors go
 * straight on (their `next` is already `/open-shop`, whose step 3 asks the name).
 *
 * Where the new account ends up is the SIGN-IN rule (`signInDestination`,
 * lib/sign-in-landing.ts) — applied here AND by the You card on its way out
 * (`app/signup/you/page.tsx` · `actions.ts`), never a second copy of it.
 *
 * 🪤 WHY (audit GUEST_SIGNUP_FLOW_MAP_2026-09-25 §C): `/signup` → `signUp` →
 * the You card → `redirect(next)` dropped a brand-new couple on the FRONT DOOR
 * whenever `next` was `/`, while `/auth/callback` (Google / Apple) and `/login`
 * mapped the same `/` to the dashboard. Two doors, two answers to one question.
 * Now every door says the same thing:
 *   · came from somewhere (an event's page, a shop, the onboarding resume) →
 *     back there, whole;
 *   · came from nowhere (`/`) → `/dashboard`, which itself opens the person's
 *     own event when they organise exactly one (`landingJumpTarget`,
 *     lib/event-board.ts) and is the dashboard home otherwise.
 */
export function signupLanding(input: { accountType: SignupAccountType; next: string }): string {
  const next = signInDestination(input.next);
  if (input.accountType === 'vendor') return next;
  if (next.startsWith(YOU_PATH)) return next;
  return youHref(next);
}

/**
 * Same window `lib/oauth-signup.ts` uses to tell a brand-new OAuth account from
 * an established one: wide enough for the consent round trip, tight enough that
 * nobody with history is inside it. ± tolerates clock skew.
 */
export const BRAND_NEW_WINDOW_MS = 120_000;

export function isBrandNewAccount(input: {
  createdAt: string | null | undefined;
  now: number;
  windowMs?: number;
}): boolean {
  if (!input.createdAt) return false;
  const created = Date.parse(input.createdAt);
  if (!Number.isFinite(created)) return false;
  return Math.abs(input.now - created) < (input.windowMs ?? BRAND_NEW_WINDOW_MS);
}

/**
 * The sentences, shared with the profile page's rename action word for word so
 * the same mistake is never explained two ways.
 */
export const YOU_ERRORS = {
  displayName: 'Add a display name.',
  slugShape: 'Use 3–32 characters: lowercase letters, numbers, and hyphens only.',
  slugReserved: 'That handle is reserved. Please pick another.',
  slugJustTaken: 'That handle was just taken. Please pick another.',
} as const;

export type YouCardPlan =
  | { ok: true; patch: Record<string, unknown>; slug: string | null }
  | { ok: false; error: string };

/**
 * What the You card may write. Name / formal name / phone / photo go through the
 * SAME plan builder the profile page uses (`planPersonalInfoPatch`), so the two
 * screens can never disagree about a field. The display name is required here —
 * it is the one thing the card exists to ask — where the profile page lets it be
 * cleared.
 */
export function planYouCard(
  form: FormLike,
  existing: { slug: string | null; accountType?: string | null },
  nowIso: string = new Date().toISOString(),
): YouCardPlan {
  const displayName = String(form.get('display_name') ?? '').trim();
  if (!displayName) return { ok: false, error: YOU_ERRORS.displayName };

  const base = planPersonalInfoPatch(form, null, new Date(0).toISOString());
  if (!base.ok) return base;
  const patch: Record<string, unknown> = { ...base.patch };
  // The photo control posts nothing when cleared; the presence marker tells a
  // cleared photo from a form without the control (profile-personal-info-patch).
  if (!form.has(PRESENCE_MARKERS.profile_photo_url)) delete patch.profile_photo_url;

  let slug: string | null = null;
  const requested = String(form.get('slug') ?? '')
    .trim()
    .toLowerCase();
  if (requested && existing.slug === null) {
    if (!SLUG_FORMAT.test(requested)) return { ok: false, error: YOU_ERRORS.slugShape };
    if (isReservedSlug(requested)) return { ok: false, error: YOU_ERRORS.slugReserved };
    slug = requested;
  }
  // The Public Event Summary (Stories) consent — INTERIM HOME. It left /signup
  // with the brand panel; its final home is event creation, per event (build 2).
  // Until then it is asked here, couples only, unticked, in event-neutral words
  // (owner 2026-09-22: "why is it asking about wedding? we have multiple
  // events"). Same field name, same 'yes' value, same guardrails as before; the
  // account type is checked here as well as on the screen so a forged POST
  // cannot write the column for a vendor row (mirrors signUp).
  if (existing.accountType !== 'vendor' && form.get('public_summary_consent') === 'yes') {
    patch.public_summary_consent_at = nowIso;
  }
  // An account that already has an @name keeps it: renaming lives on the profile
  // page, behind its cap and its change log. A posted slug is ignored, not applied.
  return { ok: true, patch, slug };
}
