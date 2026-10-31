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
 *   · HOME'S ⚙ IS EVENT SETTINGS — the same door, at the right end of the cover band (its pinned line's right end once
 *     it has stuck), drawn AT REST too (owner 2026-10-29, verbatim: *"on event dashboard> home the header does not show
 *     the settings icon like the other pages with settings icon. keep it there"* — it was `invisible` until the band
 *     stuck). Its sheet is the event's own facts: names · date · venues · parents (DECISION_LOG 2026-10-27 "INFO SPLITS
 *     BY WHAT IT IS ABOUT"). Still one gear per screen: Home mounts no other.
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

/** The menus (and the one Hub tool, Prints) that own a settings sheet — Home's is Event Settings. */
export type SettingsMenu = 'home' | 'guests' | 'hub' | 'prints' | 'memories' | 'suppliers' | 'people' | 'today' | 'customers' | 'supplier-hub' | 'home' | 'guests' | 'hub' | 'prints' | 'memories' | 'suppliers' | 'people' | 'today' | 'customers' | 'shop';

export type SettingsEntry = {
  /**
   * Where the door sits. Every menu: the right end of its first control row. Home: the right end of its cover band —
   * the band IS Home's first row (no selector), and the same spot is its pinned line's right end. `reserved`: the spot,
   * held empty.
   */
  door: 'first-row-gear' | 'cover-gear' | 'reserved';
  /** The sheet's title — and the ⚙'s accessible name. */
  sheet: string;
  /** The one short line under the sheet's title (its ⓘ holds `MENU_SETTINGS_TIP`). */
  line: string;
  /** Mounted on main yet. Flipped in the PR that mounts it; the guard follows. */
  live: boolean;
  /**
   * The ⓘ under the sheet's title, when it is not the couple menus' shared sentence (`MENU_SETTINGS_TIP` speaks of
   * "the event's own facts … under ⚙ on Home", which a supplier's page has no Home for).
   */
  tip?: string;
};

/** The ⓘ every menu sheet carries, word for word (prototype § 1). */
export const MENU_SETTINGS_TIP =
  'Settings for this menu only. The event’s own facts — names, date, venues, money, who helps — are under ⚙ on Home.';

/**
 * 🪪 HOME'S ⚙ FOR A HELPER (owner 2026-10-31, DECISION_LOG "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW OF HOME ⚙
 * EVENT SETTINGS"): the same door and the same sheet, whose one row is "Your access" — so its line says that, never the
 * hosts' "Names, date, venues…" a helper cannot change.
 */
export const HOME_HELPER_SHEET = {
  line: 'What you can open on this event.',
  tip: 'The hosts set what each helper can open. The event’s own facts stay with them.',
} as const;

export const SETTINGS_ENTRY: Record<SettingsMenu, SettingsEntry> = {
  /**
   * 🏠 HOME › EVENT SETTINGS (owner 2026-10-29, "keep it there"; DECISION_LOG 2026-10-27 "APPROVED — SETTINGS PER MENU":
   * *"Home's header ⚙ = Event Settings only"* · "INFO SPLITS BY WHAT IT IS ABOUT": names · date · venues · parents; and
   * since 2026-10-30 People with access — owner: *"that shoud be inside home settings"*). The
   * sheet's rows are the editors those facts already have (`open-event-settings.tsx`) — never a second editor.
   */
  home: {
    door: 'cover-gear',
    sheet: 'Event settings',
    // 👥 + People with access, the sheet's last section (owner 2026-10-30, *"that shoud be inside home settings"*).
    line: 'Names, date, venues, parents and who has access.',
    live: true,
    tip: 'The event’s own facts. Each menu — Guests, Suppliers, Memories — keeps its own settings under its own ⚙.',
  },
  guests: {
    door: 'first-row-gear',
    sheet: 'Guests settings',
    line: 'How guests get in, what you ask, when the list closes.',
    live: true,
  },
  /**
   * 🎛 THE EVENT HUB ⚙ (owner 2026-10-30, DECISION_LOG "EVENT HUB PRO (look redesign) — THE APP'S NAV STAYS"): the
   * right end of the Hub's pinned row — [Stage ▾ | Studio ▾] · ↺ · ✓ · ⚙ (`maker-shell.tsx`). Its sheet is "Your Event
   * Hub": Go live · who can view · which version · open browsing · the QR — what the Maker's "Your Event Hub" sheet held.
   */
  hub: {
    door: 'first-row-gear',
    sheet: 'Event Hub settings',
    line: 'What guests see, your address and QR, the look, the tools.',
    live: true,
  },
  /**
   * 🖨 THE PRINTS PAGE ⚙ (owner 2026-10-31, relayed: *"the ⚙ on Prints opens Prints' own settings, if there is a real
   * Prints setting"*): the right end of the Prints page's top bar, where the Hub's ⚙ stood (it opened Hub settings, which
   * change nothing on a print). The door only (`MenuSettingsButton` with no rows): its sheet is the ONE print settings
   * sheet, `StudioPrintSettings` — Your Event Hub look ◆ · the print words · ticket style · special message · thank-you.
   * Mounted once, in `studio-prints-settings.tsx` (`StudioPrintSettingsDoor`); the slides draw no ⚙ of their own.
   */
  prints: {
    door: 'first-row-gear',
    sheet: 'Print settings',
    line: 'What every print shares.',
    live: true,
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
  /**
   * 🧰 THE SUPPLIER'S TODAY ⚙ (owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙
   * PER PAGE": "Today ⚙ notifications + run-the-day"). It ends Today's pinned counts row — and, on a new shop, the
   * "Get your shop live" row (one component, `TodaySettings`, one mount of this door).
   */
  today: {
    door: 'first-row-gear',
    sheet: 'Today settings',
    line: 'How Setnayan reaches you.',
    live: true,
    tip: 'Settings for Today only. Your shop’s own settings stay with your shop.',
  },
  /**
   * 👥 THE SUPPLIER'S CUSTOMERS ⚙ (owner 2026-10-28, same row: "Customers ⚙ getting paid + booking terms + teams/days").
   * It ends Customers' pinned row on People, Dates and Money (one component, `CustomersSettings`, one mount).
   */
  customers: {
    door: 'first-row-gear',
    sheet: 'Customers settings',
    line: 'How you get paid, your schedules and days.',
    live: true,
    tip: 'Settings for Customers only. What couples see on your page stays with your Shop.',
  },
  /**
   * 🗓 THE SUPPLIER'S HUB ⚙ (supplier dashboard v13, prototype `renderViewrow` "Hub ▾ · ⓘ · ⚙"; DECISION_LOG 2026-10-31
   * "SUPPLIER HUB: ONE ROW, ITS ⚙, CREW SEARCH"). Not the couple's Event Hub ⚙ (`hub`). It ends the supplier Hub's one
   * row (`HubSettings`, one mount) and holds what the crew sees — the rest of the v13 sheet has nothing to save to yet.
   */
  'supplier-hub': {
    door: 'first-row-gear',
    sheet: 'Hub settings',
    line: 'What your crew sees on the day.',
    live: true,
    tip: 'Set once for every event. Each event’s own tools are under Set up; each phone’s role is under Crew.',
  },
||||||| 6343be0b08
  /**
   * 🏪 THE SUPPLIER'S SHOP ⚙ (owner 2026-10-31, verbatim *"Yes follow your recommendation"*; DECISION_LOG "SHOP ⚙ — WHAT A
   * SUPPLIER SETS ONCE"): the right end of Shop's pinned row on every Shop section (`ShopSettings`, one mount). It holds
   * what a supplier sets once and rarely touches — Plan and billing · Team · Verification and documents · Notifications ·
   * Shop status — the Home rule: the ⚙ is for rare, account-level things; the page is for the work.
   */
  shop: {
    door: 'first-row-gear',
    sheet: 'Shop settings',
    line: 'Your plan, who helps run the shop, your papers, how we reach you.',
    live: true,
    tip: 'What you set once and rarely touch. What you edit often — details, services, your page, your portfolio — stays on the Shop page.',
  },
};

export const SETTINGS_MENUS = Object.keys(SETTINGS_ENTRY) as SettingsMenu[];

export function isSettingsMenu(v: string): v is SettingsMenu {
  return (SETTINGS_MENUS as string[]).includes(v);
}
