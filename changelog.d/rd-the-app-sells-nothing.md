## 2026-09-24 · fix(app-store): the store shell sells nothing — re-audit on current main, 16 leaks closed

Apple rejected build 1.0 (1) under 3.1.1 / 3.1.3(b). The owner's 2026-09-05 ruling
limits the Capacitor iOS/Android shell to planning, guests and real-world supplier
bookings. A re-audit of `origin/main` found paid digital features still priced,
sold or usable in that shell. Everything is keyed on `lib/store-shell.ts`. The
desktop app (Tauri, `SetnayanApp/desktop`) and the web are unchanged.

**Route refusals** (`isStoreShellWebOnlyPath` → `/web-only`):
- every `/dashboard/<id>/orders/<x>` page (each is a pay-now screen)
- `/vendor-dashboard/deep-search` (a paid ₱-per-search service)
- `/studio/about/<paid key>` (showed "Get · ₱")
- `/panood/control` and `/panood/program` (Live Studio's control room and program output)
- the marketing pages of paid features, listed in `STORE_SHELL_WEB_ONLY_DOORWAYS`:
  `/papic`, `/setnayan-ai`, `/pakanta`, `/panood`, `/patiktok`, `/pawebsite`,
  `/palogo`, `/pa3d`, `/alaala`, `/pricing`

**`live-studio-roam` added to the hidden keys.** It was missing because the test
derived the hidden list from `ADD_ONS`, and the Live Studio tile joins `ADD_ONS`
only while `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is on. That flag is on in
production (Live Studio is listed on the live `/pricing` page). The test now
derives from the new `EVERY_ADD_ON`, which ignores the flag.

**`/pay/<reference>` refuses every order except a booking fee**
(`storeShellRefusesPayable` together with the new `Payable.isBookingFee`).

**Page gates** (`isStoreShellRequest()`):
- the Mood Board "Make it real" section (render credits)
- the vendor 3D Booth card
- the Sai upsell on the free venue shortlist (`sell={!storeShell}`)
- the Sai offer banner on the vendors page
- the Save-the-Date upsells (cinematic openings, Event Hub PRO)
- the priced wedding-onboarding screens (`plan`, `services`, `summary`, `services_step`),
  plus the services step in `/onboarding/simple` and `/onboarding/[type]`.
  In production the services step is ON; the paywall screens are already off
  because the experience quiz is on.
- vendor tier upgrade panels and teasers
- vendor branch add-on, extra team seats, the Papic credit pack, recommendation prices
- the vendor rail's Plan row and the pipeline "see the plans" link
- the orders ledger's "New order" button and its links to each order

**Features bought on the web no longer light up in the app** (3.1.3(b)):
- Sai on the dashboard and vendors page, only while the paywall is on
  (`storeShellAllowsPaidFeature`)
- an owned Animated Monogram in the app previews like an unowned one

**Two client safety nets:**
- `useIsStoreShell()` withdraws `ChoosePlanSheet`.
- `StoreShellLinkGuard`, mounted once in `app/layout.tsx`, hides any link whose
  target the middleware would refuse. This covers the Event Hub editor's Pro
  "Unlock · ₱" link without editing the editor, which the owner has fenced off.

**Also fixed:** `InlineCheckoutDrawer` detected the app with
`/SetnayanApp/i.test(navigator.userAgent)`, which also matches the desktop UA. As a
result, desktop could not buy anything from the drawer. It now uses the store-shell
predicate.

Held by `apps/web/lib/store-shell.test.ts`: predicate tests that execute, a
derived doorway rule, and one wiring anchor per page.

SPEC IMPACT: None — the ruling is already in DECISION_LOG 2026-09-05 and memory.
Still open for the owner: the Event Hub editor's Pro copy and web-bought Pro
editing tools (editor is fenced), and whether Sai should also go dark in the app
while the paywall is off.
