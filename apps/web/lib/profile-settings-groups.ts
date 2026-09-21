/**
 * profile-settings-groups.ts — the six groups of "Profile & settings", and the
 * one rule for which of them a URL opens.
 *
 * Owner-approved redesign (prototype, 2026-09-21): twelve sections on one long
 * page became six groups — Profile · Guest details · Privacy · Sign-in &
 * security · Preferences · Account. Every group is still rendered on the
 * server (so every form and server action works unchanged); one is SHOWN at a
 * time by `_components/settings-shell.tsx`.
 *
 * 🔑 EVERY LINK THAT ALREADY POINTS HERE MUST KEEP LANDING. Server actions
 * redirect to `/dashboard/profile?<flash>#<anchor>` and other pages link to
 * `#url-slug` / `#settings`. The resolution order is:
 *
 *   1. `?tab=<group>`                      — an explicit choice wins
 *   2. the group holding `#<anchor>`       — resolved in the browser (the
 *                                            server never sees a hash)
 *   3. a flash param (`?slug_saved=1` …)   — FLASH_PARAM_GROUP below
 *   4. default: Profile on desktop, the group list on a phone
 *
 * Pure on purpose — the page, the client shell and the action all import it.
 */

export const SETTINGS_GROUPS = [
  'profile',
  'guest-details',
  'privacy',
  'security',
  'preferences',
  'account',
] as const;

export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

export const SETTINGS_GROUP_META: Record<SettingsGroup, { label: string; hint: string }> = {
  profile: { label: 'Profile', hint: 'Photo, name, birthday, phone' },
  'guest-details': { label: 'Guest details', hint: 'Meal, allergies, optional details' },
  privacy: { label: 'Privacy', hint: 'Public page, photo with hosts, face profile, your data' },
  security: { label: 'Sign-in & security', hint: 'Email, password, other devices' },
  preferences: {
    label: 'Preferences',
    hint: 'Planner mode, reminders, language, notifications',
  },
  account: { label: 'Account', hint: 'Account ID, help, delete account' },
};

export function isSettingsGroup(v: unknown): v is SettingsGroup {
  return typeof v === 'string' && (SETTINGS_GROUPS as readonly string[]).includes(v);
}

/**
 * The flash params an action redirects with, and the group whose content the
 * message is about. `error` is deliberately absent — it is raised by forms in
 * several groups, so it cannot name one; it shows above whichever is open.
 */
export const FLASH_PARAM_GROUP: Record<string, SettingsGroup> = {
  slug_saved: 'privacy',
  slug_error: 'privacy',
  public_profile_saved: 'privacy',
  discoverable_saved: 'privacy',
  photo_sharing_saved: 'privacy',
  face_forgotten: 'privacy',
  password_changed: 'security',
  signed_out_others: 'security',
  deletion_requested: 'account',
  deletion_cancelled: 'account',
  tour_restarted: 'account',
  // Last: the generic one. A more specific param on the same URL wins.
  saved: 'profile',
};

/**
 * Steps 1 and 3 of the resolution order — everything the SERVER can know.
 * Returns null for "no explicit group" (the default applies). The browser
 * then applies step 2 (the hash) in between, and only when `tab` was absent.
 */
export function groupFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): { group: SettingsGroup | null; fromTab: boolean } {
  const tab = params.tab;
  if (isSettingsGroup(tab)) return { group: tab, fromTab: true };
  for (const [param, group] of Object.entries(FLASH_PARAM_GROUP)) {
    if (params[param]) return { group, fromTab: false };
  }
  return { group: null, fromTab: false };
}
