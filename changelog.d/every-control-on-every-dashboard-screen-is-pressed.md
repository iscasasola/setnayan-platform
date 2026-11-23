## 2026-11-23 · test(rehearsal): every control on every dashboard screen is pressed — the control sweep

Owner 2026-11-23: a guest card's reply dropdown threw the page to the global error screen in production. The e2e
specs measured sizes and overflow; nothing pressed the dropdown. The release rehearsal now presses everything.

- **The sweep** (`apps/web/tests/rehearsal/sweep.spec.ts`), a new step of `release-rehearsal.yml` after the walk:
  signed in as the rehearsal couple and, separately, a rehearsal supplier, it opens every screen under
  `/dashboard/[eventId]` and `/vendor-dashboard` that the app's own route map (`lib/ugat/screens.generated.json`)
  names, and presses every control: buttons, tabs, disclosures and in-page view switches; every native select and
  every dropdown / menu, with EACH option picked and the first choice put back; toggles, pressed and pressed back;
  sheets and dialogs, opened, swept inside, then closed. At 375 px first, then a 1280 px desktop (four parts side by
  side, `sweep_minutes` each, default 80; 0 turns it off).
- **Red on:** an error screen ("Something on our end didn't work." and the other boundaries), any uncaught page error
  or console error, any 5xx from the app. What the rehearsal's own stubs make (refused outside addresses, the storage
  stub) is counted and printed, not failed.
- **Never pressed:** destructive, money and outward-facing controls (delete, pay, send, publish, apply, book, sign,
  sign out …), matched by accessible name in `tests/rehearsal/sweep-rules.ts`; every skip is printed. A plain
  Cancel / Close stays pressable — it closes the sheets the sweep opens. Native confirm boxes are answered "no".
- **The report:** REHEARSAL.md gains "Every control, pressed" (per part: screens, presses, options, dialogs, skips,
  failures) with a numbered failure list (route · control · error text · screenshot); the full per-screen table is
  `SWEEP.md` in the run's artifact.
- **The fixture:** nine guests, one per way a reply can stand (not invited · invited, no reply · yes / no / maybe as
  the guest's answer and as the host's mark · a yes with a plus-one) — the sweep opens each card; a supplier account
  that owns a published, verified shop with three live services, booked on the couple's event; every shipped tour
  key marked seen for both accounts. 39 guests in all (was 30); the walk's "coming" check reads `comingAtStart`.
- **Guards:** `lib/the-control-sweep-skips-what-it-must.test.ts` (the skip list, the error-screen headings of every
  boundary, the noise filter, the route plan); `release-rehearsal-touches-nothing-live.test.ts` now also holds the
  sweep to `assertLocalUrl`. The sweep's browser refuses every non-loopback address, as the walk's does.

No migration, no server action, no app code. The failures the first sweep found are NOT fixed here; they are listed
in the PR for the controller to route.

SPEC IMPACT: None — test harness only; no product behaviour changes.
