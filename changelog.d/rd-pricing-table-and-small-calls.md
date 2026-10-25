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
