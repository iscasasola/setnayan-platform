## 2026-11-14 · style(couple): Sponsors and Manpower onto the design template (RW-308i leftovers)

- **A real page name** — the event's one pinned row drew NOTHING on `/sponsors` and `/manpower` (no menu row claimed them, so
  `eventPinPlaceOf` returned null and only the tab's generic name showed). Guests now holds Sponsors and Suppliers holds
  Manpower (`lib/customer-menu.ts` `alsoMatch`), with their words in `EVENT_HELD_PAGE_WORDS` — the row reads
  "Guests · Sponsors" / "Suppliers · Manpower", and the rail lights the owning tab (rule 1).
- **A 44 px way back** — both "Back to …" links (28 px pill / 20 px slate link) are 44 px links in the accent (rules 3 · 14).
- **No dashed boxes** — Sponsors' "Add" trigger (drawn once per role slot) is the shared pill, not a dashed box (rule 3).

SPEC IMPACT: None — implements the approved design template; no decision changed.
