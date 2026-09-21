/**
 * rail-focus.ts — does this URL collapse the rail to one section's menu?
 *
 * Owner 2026-09-21: inside an event, Memories, People, the shop or HQ, the rail
 * shows only that section's menu plus one row back. The shell draws; this
 * decides, as a pure function so a test can execute the rule rather than grep
 * for its spelling.
 */

export type RailFocus = {
  href: string;
  label: string;
  /** The word under the icon on the 72px strip. */
  caption: string;
  /** Narrow focus to these path prefixes; absent ⇒ every URL of the layout. */
  paths?: readonly string[];
};

export function isRailFocused(
  focus: RailFocus | undefined,
  pathname: string | null,
  who: { inApp: boolean; signedIn: boolean },
): boolean {
  if (!who.inApp || !who.signedIn || !focus) return false;
  if (!focus.paths) return true;
  const path = pathname ?? '';
  // Trailing slash is load-bearing: `/dashboard/people` must not claim
  // `/dashboard/peoplex`.
  return focus.paths.some((p) => path === p || path.startsWith(p + '/'));
}
