/**
 * lib/policy-links.ts — the policy pages a signed-in person must be able to reach, ONCE.
 *
 * Read by every menu that carries them, so they can never list different pages:
 *   · the ☰ drawer's small print (`front-door-shell.tsx`, `.fd-smallprint`) — the couple's door, and the drawer every
 *     signed-in tree mounts through `AppRailShell`;
 *   · supplier Settings (`app/vendor-dashboard/settings/settings-view.tsx`), the one screen an owner, an admin and a
 *     scoped team member all reach (More › Settings and the avatar sheet).
 *
 * 🔑 WHY A LIST AND NOT FOUR LINKS IN EACH FILE. App Store review 5.1.1(i) asks that the privacy policy be reachable
 * inside the app. The 2026-10-19 sweep (row A2) could not find a route for the supplier; the drawer's four links were
 * typed by hand in one file, so a second menu had nothing to copy but the words. Held by
 * `lib/every-signed-in-menu-reaches-the-policies.test.ts`, which enumerates the roles from `UserRoleSummary`.
 *
 * ⚠ NONE OF THESE MAY BE REFUSED IN THE STORE SHELL. Middleware's `APP_EXCLUDED_MARKETING_PATHS` and
 * `lib/store-shell.ts` both leave them alone ("legal pages stay reachable because store review requires them"); the
 * guard reads both.
 */
export type PolicyLink = { href: string; label: string };

/** The drawer's second line, in its order and its words. */
export const POLICY_LINKS: readonly PolicyLink[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/acceptable-use', label: 'Acceptable use' },
  { href: '/cookies', label: 'Cookies' },
];

/** The three a store reviewer looks for. Every entry is in `POLICY_LINKS`. */
export const REQUIRED_POLICY_HREFS: readonly string[] = ['/privacy', '/terms', '/acceptable-use'];
