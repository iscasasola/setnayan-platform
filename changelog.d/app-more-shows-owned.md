## 2026-10-08 · fix(store-shell): the app's More lists only owned services, and disappears when there are none

In the iPhone app (Capacitor store shell) "More" on an event's bottom bar was a dead tap: the shell drops every paid add-on (`STORE_SHELL_HIDDEN_ADDON_KEYS`, App Review 3.1.1), so the services list was empty and the tab fell back to Home `?more=services`, which opens nothing.

- `lib/our-services.ts` — new `ownedOnly` input: in the store shell a card is built only when the event owns the service outright (`added`); never a price, trial, "Free", "Waiting for payment" or "coming soon", and no parts. Its door must still pass `refusesPath`, so a row never opens "Not available in the app".
- `app/dashboard/[eventId]/layout.tsx` — passes `ownedOnly: storeShell` instead of dropping the paid keys up front. The web passes nothing and is unchanged.
- `lib/customer-menu.ts` — in the store shell with no services, the More row is not built (bar, rail and ☰ drawer together). The web always keeps it.
- Guard: `lib/the-app-more-lists-only-owned-services.test.ts`; `the-store-shell-menu-offers-no-refused-door.test.ts` now expects four tabs in the shell when nothing is owned.

⚠ Today every paid controller (`/studio/papic`, `/studio/patiktok`, …) is still refused in the app by middleware (the 2026-09-05 3.1.3(b) gate), so in production the app shows NO More tab for every event until owned controllers are opened in the app and their own in-page buy controls are suppressed — a separate change.

SPEC IMPACT: None (implements DECISION_LOG 2026-10-08 "ROADMAP LOCKED: LEVEL 1" — "the app shows only owned services").
