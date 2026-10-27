## 2026-10-27 · feat(menu-settings): one ⚙ per menu, in one spot — Memories is its first caller (settings per menu A)

Owner, 2026-10-26: *"Settings button must all be located at ideally the same spot per menu for consistency"*;
approved 2026-10-27 (DECISION_LOG "APPROVED — SETTINGS PER MENU, ALL SIX CALLS AS RECOMMENDED"; prototype
`prototypes/settings_per_menu_2026-10-26/`, PLAN.md row A).

- `app/_components/menu-settings-button.tsx` — `MenuSettingsButton`: Memories' icon-only ⚙ (`ActionButton
  tone="neutral" iconOnly icon={Settings}`, presses at 44) opening a `Sheet` titled "<Menu> settings", drawn into
  `<body>`. Under the title, the menu's one short line; its ⓘ holds the shared sentence ("Settings for this menu only.
  The event's own facts — names, date, venues, money, who helps — are under ⚙ on Home.").
- `lib/menu-settings.ts` — `SETTINGS_ENTRY`, the port-control map of doors: menu → `{ door: 'first-row-gear', sheet,
  line, live }`. Suppliers' spot is `reserved` (no ⚙ until it owns a setting). Home is not in it — Home's ⚙ is the
  cover's and opens Event Settings.
- Memories mounts the shared door in place of its own gear + sheet; same look, same rows; its first row is marked
  `data-first-row`.
- Guard `app/_components/every-menu-has-one-settings-button.test.ts` (each live menu mounted at exactly one site,
  none for the rest; Memories renders one ⚙ at its first row's right end and none for a guest; Home mounts none) —
  five sabotages, each red. `the-add-photos-sheet-clears-the-bar.test.ts` now also holds the shared door's sheet to
  the `OnBody` portal.

SPEC IMPACT: `DECISION_LOG.md` row "SETTINGS BUTTON — SAME SPOT PER MENU" (corpus); PLAN.md build record § A.
