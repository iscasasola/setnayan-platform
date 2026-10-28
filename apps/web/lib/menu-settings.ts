/**
 * menu-settings.ts — WHERE EACH MENU'S SETTINGS ARE ENTERED: one ⚙, one spot, one sheet title per menu.
 *
 * Owner, 2026-10-26, verbatim: *"Settings button must all be located at ideally the same spot per menu for
 * consistency"* · *"each menu has their own settings. Keep it on their respective menus"*. Approved 2026-10-27
 * (DECISION_LOG "APPROVED — SETTINGS PER MENU, ALL SIX CALLS AS RECOMMENDED"; prototype
 * `prototypes/settings_per_menu_2026-10-26/` § 1, PLAN.md § 1 · § 5 row A).
 *
 *   · THE DOOR — `MenuSettingsButton` (`app/_components/menu-settings-button.tsx`): Memories' icon-only ⚙
 *     (`ActionButton tone="neutral" iconOnly icon={Settings}`, 44 px), at the RIGHT END OF THE MENU'S FIRST CONTROL
 *     ROW (the element marked `data-first-row`). Pages have no visible title row (`PageMasthead` is `sr-only`), so
 *     the first control row is the title row.
 *   · THE SHEET — titled "<Menu> settings"; under the title, one short line whose ⓘ holds the shared sentence
 *     (`MENU_SETTINGS_TIP`): this menu's settings only, the event's own facts are under Home's ⚙.
 *   · HOME HAS NO MENU ⚙ — Home's settings ARE Event Settings, behind the header ⚙ on the cover. Two gears never
 *     share a screen.
 *   · SUPPLIERS — was `reserved` (owner call 3: no ⚙ until it owns a setting). REVERSED 2026-10-27 (DECISION_LOG
 *     "SUPPLIERS GETS ITS ⚙ — THE SUPPLIER SETTINGS MOVE THERE"; owner *"what are the settings for suppliers?"* ·
 *     *"and move them to suppliers"*): How you see costs, Supplier payments, Budget and the booked suppliers' photos
 *     moved here from Event Details. Its ⚙ ends the Find · Build · Booked row, which is also its pinned row.
 *
 * This map is the port-control list of DOORS (`SETTINGS_ENTRY`); the rows behind each door are listed by
 * `SETTINGS_ROWS` as each menu's sheet is built (PLAN § 2 · § 7). `live` flips to true in the PR that mounts the
 * menu's ⚙, and `every-menu-has-one-settings-button.test.ts` then demands exactly one, in the first row.
 *
 * Neutral module (no `'use client'`): the guard and the client button both read it.
 */

/** The menus (and the one Hub tool, Prints) that own a settings sheet. Home is deliberately absent. */
export type SettingsMenu = 'guests' | 'hub' | 'prints' | 'memories' | 'suppliers' | 'people';

export type SettingsEntry = {
  /** Where the door sits. Every menu: the right end of its first control row. Suppliers: the spot, reserved. */
  door: 'first-row-gear' | 'reserved';
  /** The sheet's title — and the ⚙'s accessible name. */
  sheet: string;
  /** The one short line under the sheet's title (its ⓘ holds `MENU_SETTINGS_TIP`). */
  line: string;
  /** Mounted on main yet. Flipped in the PR that mounts it; the guard follows. */
  live: boolean;
};

/** The ⓘ every menu sheet carries, word for word (prototype § 1). */
export const MENU_SETTINGS_TIP =
  'Settings for this menu only. The event’s own facts — names, date, venues, money, who helps — are under ⚙ on Home.';

export const SETTINGS_ENTRY: Record<SettingsMenu, SettingsEntry> = {
  guests: {
    door: 'first-row-gear',
    sheet: 'Guests settings',
    line: 'How guests get in, what you ask, when the list closes.',
    live: true,
  },
  hub: {
    door: 'first-row-gear',
    sheet: 'Event Hub settings',
    line: 'What guests see, your address and QR, the look, the tools.',
    live: false,
  },
  prints: {
    door: 'first-row-gear',
    sheet: 'Print settings',
    line: 'What every print shares.',
    live: false,
  },
  memories: {
    door: 'first-row-gear',
    sheet: 'Memories settings',
    line: 'How your photos are grouped, shared and kept.',
    live: true,
  },
  suppliers: {
    door: 'first-row-gear',
    sheet: 'Suppliers settings',
    line: 'How you see costs, what you owe, their photos.',
    live: true,
  },
  // 👥 PEOPLE (owner 2026-10-28, "People and Groups approved"): the account's People page ends its pinned row with ⚙,
  // the 27 Oct template. Its one row is the People search's own switch — "Can people find you by name?" — the same
  // `users.discoverable_by_name` the profile's Privacy section writes (also drawn there; one writer, two seats).
  people: {
    door: 'first-row-gear',
    sheet: 'People settings',
    line: 'Who can find you by name.',
    live: true,
  },
};

export const SETTINGS_MENUS = Object.keys(SETTINGS_ENTRY) as SettingsMenu[];

export function isSettingsMenu(v: string): v is SettingsMenu {
  return (SETTINGS_MENUS as string[]).includes(v);
}
