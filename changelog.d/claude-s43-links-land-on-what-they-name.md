## 2026-09-19 · fix(vendor-customers): "Bookings" and "View on calendar" land on what they name (S43 · 3)

`/vendor-dashboard/bookings` and `/vendor-dashboard/calendar` are redirect stubs
into the My Customers hub. Neither carried a fragment, so every link to them
reloaded the hub at the top — the roster — and looked like it went nowhere:
`bookings` is not an accordion key, and the month grid sits below the roster.

- The bookings stub now redirects to `…#bookings`, the always-on Bookings list
  (`<div id="bookings">`). This fixes every Bookings link at once — the Clients
  section's two, Payday's empty state, the "Check inquiries" button and the
  Bookings filter pills — without changing any href.
- A bare `/vendor-dashboard/calendar` (View on calendar, Open calendar, the
  Upcoming KPI) now lands on the month grid (`<div id="calendar">`, new). A link
  with params (`?m=` / `?pool=` from the Availability tools, the day page's back
  link) keeps landing on those tools, as before.
- Both anchors get `scroll-mt-24` so the shell header does not cover them.

The anchors live in `customers/anchors.ts`; `customers/anchors-land.test.ts`
holds the stubs and the hub ids together (sabotage-checked red both ways).
`lint:port-controls` passes unchanged — no href was removed, the baseline is untouched.

SPEC IMPACT: None.
