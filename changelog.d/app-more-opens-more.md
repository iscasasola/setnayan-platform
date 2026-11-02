## 2026-10-21 · fix(store-shell): the iPhone app's bottom bar drops More (Home · Guests · Suppliers · Hub)

Owner, testing TestFlight build 5 on the demo event: *"pressing more on the bottom nav jumps me to home. but i do not see the other services there"* → *"if all is at home already, then we can remove more"*.

- Cause: More lists the five services, all paid. The store shell drops every paid add-on (`STORE_SHELL_HIDDEN_ADDON_KEYS`, App Review 3.1.1), so in the app the list was always empty, `CustomerBottomNav` never mounted the sheet, and the tab fell back to its address — Home `?more=services`. The iPad rail and the ☰ drawer had the same dead row.
- `lib/customer-menu.ts` — `buildEventMenuSections` does not build the `studio` (More) row in the store shell. The app bar is four tabs; the rail and ☰ lose the same row. The web is unchanged.
- Guard: `lib/the-app-bar-has-no-more.test.ts` (no More in the shell across 24 event shapes; every destination More offered in the app is linked from Home or ☰; the web keeps More). `the-store-shell-menu-offers-no-refused-door.test.ts` now expects four tabs in the shell.

SPEC IMPACT: None in code terms; supersedes open PR #6420's "owned services in the app" More (the 2026-10-19 review notes say a web extra unlocks nothing in the app). Owner ruling recorded in chat 2026-10-21.
