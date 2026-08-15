// ============================================================================
// Who may open a celebration's public page — the four audiences
// ============================================================================
// Owner, 2026-08-15: "it is the owner's choice if they want this in public or
// link only or tagged accounts only (no tagged account means it is private for
// them)." Asked who counts as tagged, the owner chose: anyone on the GUEST LIST
// who has an account.
//
// 🔴 READ THIS BEFORE ADDING A FIFTH VALUE.
// `canViewSlugEvent()` used to open with `if (visibility !== 'private') return
// true;` across 31 call sites. Adding 'invited_accounts' under that spelling
// would have made the most private new setting in the product **completely
// public everywhere**, instantly. Hours earlier the same exclusion shape on the
// same column had a live consequence: the editorial loaders asked
// `.neq(…, 'private')`, so a link-only celebration was eligible for the public
// stories shelf and the sitemap.
//
// 🔑 AN EXCLUSION TEST OVER A GROWING SET ADMITS EVERY FUTURE MEMBER BY DEFAULT.
// Say what IS allowed. `openToStrangers()` is the allow-list, and a new value is
// closed until somebody deliberately opens it here.

/**
 * Every value `events.landing_page_visibility` may hold, widest audience first.
 * Mirrors the CHECK constraint in migration 20271142156675.
 */
export const EVENT_VISIBILITIES = [
  'public',
  'unlisted',
  'invited_accounts',
  'private',
] as const;

export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

/** Anything unreadable fails to the most private value, never the most open. */
export function normalizeVisibility(raw: string | null | undefined): EventVisibility {
  return (EVENT_VISIBILITIES as readonly string[]).includes(raw ?? '')
    ? (raw as EventVisibility)
    : 'private';
}

/**
 * May a stranger — nobody signed in, no guest cookie — open this page?
 *
 * 🔑 THE ALLOW-LIST. Only these two are open to the world; everything else has
 * to earn its way in through `canViewSlugEvent`. A value added to
 * `EVENT_VISIBILITIES` without being added here is CLOSED, which is the safe
 * direction and is the whole point of the list existing.
 */
export function openToStrangers(v: EventVisibility): boolean {
  return v === 'public' || v === 'unlisted';
}

/**
 * May this page be LISTED — the stories shelf, the sitemap, anywhere a person
 * who was not sent the link could stumble on it?
 *
 * Narrower than `openToStrangers` on purpose: 'unlisted' is readable by anyone
 * holding the link and must still never be advertised. That distinction is the
 * entire meaning of "link only", and losing it is the bug fixed in
 * `showcase-db.ts` on 2026-08-15.
 */
export function listablePublicly(v: EventVisibility): boolean {
  return v === 'public';
}

/**
 * Does this setting decide access by who the viewer IS, rather than by whether
 * they hold the link?
 *
 * Used to decide whether the guest-list lookup is worth running at all — it is
 * a database round trip, and only this one value needs it.
 */
export function requiresInvitedAccount(v: EventVisibility): boolean {
  return v === 'invited_accounts';
}
