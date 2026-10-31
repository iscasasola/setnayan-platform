## 2026-10-31 · fix(prints): the Prints page's ⚙ opens Print settings, not Event Hub settings — one ⚙ per page

Owner, relayed 2026-10-31: the Prints page (its own page since #7020) drew the Event Hub's ⚙ (`HubSettingsGear`) at the
right end of its top bar. That sheet — Look · Your Event Hub · What guests see — changes nothing on a print. Agreed:
*"the ⚙ on Prints opens Prints' own settings, if there is a real Prints setting."* There is one: `StudioPrintSettings`,
the ONE print settings sheet (Your Event Hub look ◆ · the print words · ticket style · special message · thank-you).

- `maker-shell.tsx`: on `printsPage` the bar's Settings spot draws `<StudioTool part="print-settings-door" />` instead of
  `HubSettingsGear`; the Event Hub pages keep `HubSettingsGear` exactly as before.
- `studio-prints-settings.tsx`: new `StudioPrintSettingsDoor` — the house door (`MenuSettingsButton menu="prints"`, the
  same 44 px ⚙ every menu has) wired to the same store the sheet reads (`usePrintSettingsOpen` / `setPrintSettingsOpen`),
  reached through the one lazy door `StudioTool` (no new stand-in in the Maker's first load). The sheet itself is
  untouched — its fields stay mounted while shut.
- `menu-settings-button.tsx`: `children` is optional — with none, the button is the door alone and the caller's own
  sheet answers `open` (Prints' sheet must keep its fields mounted, which a children-only-while-open frame cannot).
- `lib/menu-settings.ts`: `prints` flips `live: true` — `every-menu-has-one-settings-button.test.ts` now holds it at
  exactly one mount.
- `studio-prints-carousel.tsx`: the slides' own ⚙ (the phone toolbar's ⚙ beside Download, and the computer column's
  "Print settings" row) are removed — they opened the same sheet; the page now has one ⚙, the top bar's.
- `lib/studio-details.ts` (found while walking it): on a phone the full-screen Studio panel was
  `100dvh − 44px` from the screen's foot — written when the Maker's bar was the screen's top. Since the Hub keeps the
  app's nav (2026-10-30) that reached over the Maker's own bar and the bottom nav: measured in `/dev/maker-lab?prints=1`
  at 390, the panel ran 52 → 844 px over the bar at 51 → 103, so the Prints title, ↶, ✓ and the ⚙ were under the
  carousel (a finger could not reach the old Hub ⚙ either; the slide's ⚙ was the phone's only door). The panel now
  fills the shell's room — `--maker-app-top`/`--fd-bar` and `--maker-nav` — and stops at the nav (measured 103 → 780).
  This applies to every full-screen Studio form on a phone, not only Prints.
- Port baseline regenerated (`SettingsButton` out, `StudioPrintSettingsDoor` in).
- Guard `lib/the-prints-gear-opens-print-settings.test.ts` (sabotaged once: the shell's Prints branch removed → red);
  `prints-carousel-follows-the-prototype.test.ts` claim 4 now reads "no slide draws a ⚙ of its own".

SPEC IMPACT: Small amendment to the approved Prints carousel prototype (`prints_carousel_2026-10-26`): its per-slide
⚙ Print settings moves to the page's top bar ⚙. Surfaced in the PR for owner sign-off; no corpus file edited by this PR.
