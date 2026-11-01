## 2026-11-01 · fix(admin,supplier): Categories map fits the window and says a refused services read; worth box loses its spinner; invite fields fit their placeholder

From the 1 Nov walk of the /dev labs.

- **Admin › Categories was 1,856 px wide at 1,280** (sideways scroll). Cause: every InfoTip bubble (`.sn-tip`) inherited
  `white-space: nowrap` from the column heads, so each tip's text was one 1,000+ px line; the closed tips are laid out
  (hidden, not removed) and widened the page, and an opened one ran off the screen. `.sn-tip` now sets its own
  `white-space: normal` (globals.css), which fixes every InfoTip under a nowrap trigger, app-wide.
  🔒 `lib/a-tip-wraps-in-its-own-width.test.ts`
- **A refused services read rendered as "No service yet".** The map now carries `servicesRead` (from `loadCategories`'s
  own `failed`, like `partsRead` / `cardsRead`): the Services column says "Couldn't load the services", category tiles
  read "— services" instead of a "no service" pill, "Needs a look" counts no category as missing a service, a part
  never claims "0 of 0 here", and the page's counts line reads "— services" instead of 0.
  🔒 `app/admin/categories/_components/a-refused-services-read-is-said.test.ts`
- **"What's included" worth box drew a native number spinner.** It is now a numeric text box (numeric keypad, digits-only
  pattern, non-digits dropped as typed) — still a whole number of pesos, as `parseInclusionRows` requires.
  🔒 `app/vendor-dashboard/services/_components/a-worth-box-has-no-spinner.test.ts`
- **Invite a supplier: "hello@vendorbusiness.ph" was cut.** The fields split into three by the WINDOW (`sm:grid-cols-3`),
  so a narrow card gave each ~160 px. They now size by the card (`auto-fit, minmax(14rem, 1fr)`).
  🔒 `app/admin/vendors/_components/the-invite-fields-fit-their-placeholder.test.ts`

Not changed (lab-only / walker limit): the card maker's Preview/Create row sits on the supplier bottom dock in the
product (`--sn-bottomdock-h`); the lab draws no dock, so the row falls back to 64 px above the edge. The shop page's
OpenStreetMap frame renders in iPhone Safari with network; the walker blocked non-local requests.

SPEC IMPACT: None
