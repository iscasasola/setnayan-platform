## 2026-11-01 · fix(shell): five walk findings — the Me page's black square, the signed-in bar's search, three lab boxes

- **Event Hub › Me (real, Safari only):** WebKit painted a solid black square (white in dark mode) at the page's top-left
  whenever a Digital ticket picture carrying `drop-shadow` sat below the fold. `TicketPicture` now puts the picture on
  its own compositing layer (`translateZ(0)`), which keeps the shadow and loses the square. Guard:
  `app/[slug]/_components/ticket-shadow-has-its-own-layer.test.ts`.
- **Top bar search (lab only, rule moved into the shell):** the shipped signed-in bars already drew no search; the
  `/dev` lab shells did not say `search={false}`, so the shell's default — the signed-out marketplace box — was squeezed
  to ~74 px ("Sup"). The "signed in → no top-bar search" rule now lives in `topBarSearch` (`shell-page-search.ts`) and
  `FrontDoorShell` reads it, so no mount can forget it. Product output unchanged. Guard:
  `the-signed-in-bar-has-no-search.test.ts`.
- **Account switcher at 1280 (lab only):** `/dev/avatar-sheet-lab` wore only the panel's phone classes; it now wears
  the shipped panel's full class list. Guard: `the-lab-sheet-is-the-shipped-panel.test.ts`.
- **Spotlight tour, supplier Today at 1280 (lab only):** the Today lab padded `px-4` at every width while
  `TodayCounts` bleeds `sm:-mx-6`, so the page measured 1288 px. The lab now pads like the shipped page
  (`px-4 sm:px-6 lg:px-8`). Guard: `the-today-pin-never-bleeds-past-its-gutter.test.ts`.
- **Supplier Customers list (lab only, not changed):** the walked default of `/dev/supplier-lab` is the thumb-row
  fixture (hard-coded "Customer N" rows under the glass), not the Customers screen; the real one
  (`?s=events`) has its title row and two columns at 1280.

SPEC IMPACT: None
