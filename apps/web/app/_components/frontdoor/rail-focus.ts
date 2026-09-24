/**
 * rail-focus.ts — does this URL collapse the rail to one section's menu?
 *
 * Owner 2026-09-21: inside an event, Memories, People, the shop or HQ, the rail
 * shows only that section's menu plus one row back. The shell draws; this
 * decides, as a pure function so a test can execute the rule rather than grep
 * for its spelling.
 */

/**
 * Which drawing the way-back row wears, named rather than handed over.
 *
 * 🔴 IT IS A NAME BECAUSE A COMPONENT CANNOT CROSS THIS BOUNDARY. `RailFocus`
 * is built in a SERVER layout and read by `front-door-shell.tsx`, which is
 * `'use client'`. This field was typed `LucideIcon`, so
 * `dashboard/[eventId]/layout.tsx` passed `icon: LayoutGrid` — the component
 * itself — and React refused to serialise it:
 *
 *   Functions cannot be passed directly to Client Components…
 *   {$$typeof: …, render: function, displayName: …}        ← a forwardRef
 *
 * That throw is in the EVENT LAYOUT, so it took out every page inside an
 * event — Overview, Guests, Seat plan, all of them — with a 500, in
 * production, for about an hour on 2026-09-23. The rail row it was decorating
 * is one line of chrome.
 *
 * 🔑 A STRING CANNOT DO THIS. The shell owns the mapping (`FOCUS_ICONS`), so
 * the only thing that crosses is a word, and a caller cannot reach for a
 * component even by accident. Adding a drawing means adding a key here and an
 * entry there — both on the same side of the boundary as the icons themselves.
 */
export type RailFocusIcon = 'events';

export type RailFocus = {
  href: string;
  label: string;
  /**
   * The drawing on the way-back row. Defaults to `ArrowLeft`.
   *
   * 🔑 IT EXISTS BECAUSE ONE OF THE FOUR ROWS IS NOT A "BACK" (owner
   * 2026-09-23, on the events row: *"icon does not need to show a back
   * button, keep the events icons"*). "My Home" from HQ, the shop or an
   * account spoke still reads as a way back and keeps the arrow; the events
   * row is named after where it GOES, so it wears that place's own icon.
   */
  icon?: RailFocusIcon;
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
