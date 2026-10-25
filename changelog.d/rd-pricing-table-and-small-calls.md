## 2026-10-25 · feat(pricing): Free vs Pro table · Patiktok paid per day · verification free for good · "Use my email instead"

Owner 2026-10-25: *"If you have recommendation that follow our design go for it."* Built on the approved prototype
`prototypes/ceremo_deltas_2026-10-25/02_pricing.html` (frame "Pro = Event Hub Pro").

- **/pricing** — "Two ways to plan" is one plain Free vs Pro table. Pro = Event Hub Pro (`COUPLE_WEBSITE_PRO`),
  one-time per event; its figure and the launch-offer line ("₱X while you set up your event — ₱Y after") read the
  row's `retail_price_php` / `onboarding_price_php` through the shared two-price resolver. Papic (from the lowest
  credit rung), Live Watch, Patiktok (`/ day` from its `billing_period`), Music Maker and Setnayan AI (both prices,
  ⓘ "priced by event type") are read from the catalogue. No Plus SKU is active, so the table is Free vs Pro only.
  The public footnote "Provisional pending the holistic pricing review" is gone. Add-ons below are unchanged.
- **Patiktok is paid per day** (owner: *"Patiktok has a per day amount."*) — /features drops its free half
  (`free-plus` → `paid`, reads "₱… / day"); /pricing says the per-day price.
- **Supplier verification is free for good** (owner: *"Free forever."*) — Help, llms.txt and the home "For
  suppliers" overlay no longer say "during launch" / "while we launch".
- **"Use my email instead"** — one quiet text link under the guest's Save button (Me › Keep this invitation),
  opening the shipped email sign-in (`/login`) with the same return as the button (`/join/{eventId}/connect`).
- Guards: `app/(shell)/pricing/pricing-free-vs-pro-table.test.ts`, `lib/patiktok-paid-verification-free-copy.test.ts`,
  `app/[slug]/_components/use-my-email-instead.test.ts` (each seen red under sabotage).

NOT CHANGED, on purpose: /features Setnayan AI "From ₱199" — per-event pricing is ON in production
(`platform_settings.setnayan_ai_per_event_pricing_enabled = true`) and a Date / Hangout / Tournament / Gender
reveal event is charged the Tier D row, so "From ₱199" is what checkout charges. The Maker part "The details" —
already unreachable since 2026-10-24 (no canvas draws `f:details`; not in any ＋ group; never a navigator tile).

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "PRICING TABLE + FOUR SMALL CALLS" (owner rule quoted; Patiktok and
verification rulings recorded verbatim).

## 2026-10-25 · feat(guest-save): "Save to my account" shows BOTH Apple and Google when both are on

Owner 2026-10-25 — asked *"Do you want to keep it that way, or show both Apple and Google buttons to everyone?
Showing both would reverse that rule."*, answered verbatim: *"Show both"*. This REVERSES the guest rule "one button
at a time, we pick the method, never the guest" (2026-09-26) FOR THIS SCREEN ONLY — the guest's "Save to my
account" offer (`app/[slug]/_components/save-to-account.tsx`).

- **Both providers on** → two buttons, the shipped words ("Save to my account" · "with Apple / Google · nothing to
  type"), the same size (56 px, full width). The device's own (`saveMethodFor`: Apple on iPhone/iPad, Google on
  Android/desktop) is FIRST as the terracotta primary; the other is under it as the house secondary
  (`saveProvidersInOrder`, lib/guest-one-path.ts). The "— your name … come along" line rides the first button only.
  "Use my email instead" stays under them. **One provider on** → that one button. **None on** → "Copy my link".
- **The server opens the provider PRESSED.** Each button posts its own provider as `save_method` (the button's
  name/value — `ProviderButton`); `saveMethodFromForm` accepts it while that provider is switched on and REFUSES one
  that is off (no sign-in, the guest is sent back) — never swapped for the other. A field naming no provider still
  falls back to the device rule. The Terms-tick carry, the `/join/{eventId}/connect` return and the plus-one door
  are unchanged (its action reads a provider press as `keep`).
- **Only the pressed button says "Opening Apple…/Google…"** (the other is held disabled), and `ProviderStall` names
  the provider pressed (`pressedSaveMethod`, read from the form's pending submission).
- **Phone app:** both buttons ride the one native form; the press hands back whichever provider was pressed —
  iOS: Apple → the Sign in with Apple sheet, Google → the system browser (ASWebAuthenticationSession); Android:
  both → the system browser (Custom Tabs), as `/login`'s oauthGate does. Guideline 4.8 holds: Apple is offered
  wherever Google is.
- **iPad Safari:** `AppleOnTouch` now decides only the ORDER — both blocks hold both buttons.
- Guards: new `app/[slug]/_components/the-save-offer-shows-both-providers.test.ts` (both draw · device's first ·
  primary/secondary · same size · one/none · pressed accepted only if on · email link stays — each seen red under
  sabotage); updated `the-save-button-opens-what-it-says.test.ts`, `the-app-save-signs-in-natively.test.ts`,
  `lib/apple-device.test.ts`.

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "SAVE TO MY ACCOUNT SHOWS BOTH APPLE AND GOOGLE" (owner's "Show both"
verbatim; reverses the one-button rule for this screen only).
