## 2026-10-19 · fix(store-shell): the app shows no feature price, no upsell without a door, and no "Coming soon"

Sweep 2026-10-19, batch 1 (store-shell-gaps: rows A1, C10, C14); batch 2 (A4) held for the owner.

- **A1.** `/features/<slug>` and `/tl/features/<slug>` for every feature priced anything but `free`
  (`STORE_SHELL_WEB_ONLY_FEATURE_SLUGS` in `lib/store-shell.ts`), plus the `/tl/features` hub, are
  now web-only doorways in the App Store / Play Store shell. Live Watch's page had shown
  "PRICE ₱2,500 · Unlock Live Watch" in the app. Free feature pages stay open.
- **C10.** `/web-only` offers "Back to your dashboard" only to a signed-in person; signed out, it
  offers Sign in.
- **C14 (upsell copy).** In the store shell, `WebsiteProLock` draws no PRO card (inline: nothing;
  page: "This part of your Event Hub is not included in the app."), the supplier voice-match panel
  appears only to a shop that has Advanced, the locked "Upgrade your plan to call clients" pill is
  gone, and the expired day-of tools drop "Upgrade to…" and "See plans".
- **C14 ("Coming soon").** An inline `<head>` script (`storeShellMarkScript`) marks `<html>` with
  `data-store-shell` before first paint, in the Capacitor shell only (never the desktop app), and one
  rule in `globals.css` hides every `[data-coming-soon]`. The pills — or the whole card when
  "Coming soon" is its only state — are marked in 14 files. The web is unchanged.
- **A4 — not changed, owner decision.** Adding `NSLocationWhenInUseUsageDescription` would make the
  "no location" App Privacy answer false (`lib/the-app-declares-what-it-collects.test.ts`); it needs the
  owner to add Precise Location in App Store Connect first.

Guards in `lib/store-shell.test.ts`: the registry walk (every selling feature page refused, every
free one open), the head script checked against `isStoreShellInBrowser`, the CSS/head wiring, and a
TypeScript-AST scan that fails on any JSX "coming soon" outside a `data-coming-soon` element on a
route the store shell can open.

SPEC IMPACT: None.
