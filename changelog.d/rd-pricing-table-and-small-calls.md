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
- **Dark look:** on Candlelight the house secondary's label (`text-link`, slate indigo #3B4E67) read 2.2:1 — the
  second button and the Terms links were near-invisible. Candlelight now carries the dark token block's measured
  link ink (#9DB2CE, 8.3:1): `app/globals.css` candlelight block + `CANDLELIGHT_WORD_TOKENS`
  (`app/[slug]/_lib/pro-site-vars.ts`). This touches every `text-link` word on a Candlelight guest page.
- Same size: the secondary's 1 px border comes out of its padding, so both buttons are 62 px at 390 px.
- Guards: new `app/[slug]/_components/the-save-offer-shows-both-providers.test.ts` (both draw · device's first ·
  primary/secondary · same size · one/none · pressed accepted only if on · email link stays — each seen red under
  sabotage); updated `the-save-button-opens-what-it-says.test.ts`, `the-app-save-signs-in-natively.test.ts`,
  `lib/apple-device.test.ts`.

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "SAVE TO MY ACCOUNT SHOWS BOTH APPLE AND GOOGLE" (owner's "Show both"
verbatim; reverses the one-button rule for this screen only).

## 2026-10-25 · fix(guest-save): the two providers are the LOGIN'S OWN buttons — "Continue with Apple / Google"

Controller follow-up on the "Show both" change above, after the owner asked whether official Sign in with Apple /
Google buttons exist: they do, and /login already draws them. Apple's HIG wants Sign in with Apple in an approved
style and at least as prominent as any other; Google's guidelines want the G and their button. The terracotta
primary + house secondary pair is gone.

- **The Save offer now draws the login's provider buttons** — the same chrome (`OAUTH_BUTTON_CLASS`, now exported
  from `app/_components/oauth-icons.tsx` and used by `oauth-button-row.tsx`, `native-oauth-buttons.tsx`,
  `desktop-oauth-buttons.tsx` and the Save offer: one string for every door), the same marks (`AppleIcon` black
  glyph · `GoogleGIcon`), the same words (`OAUTH_VERB`: "Continue with Apple" · "Continue with Google"), identical
  size. The device's own first. Over them, the heading "Save to my account" with one short line "Nothing to type"
  (plus "— … come along" where the thank-you passes it). "Use my email instead" stays under them.
- Every behaviour of the change above is unchanged: the pressed provider posts, a switched-off one is refused, the
  stall names the pressed provider, native in the phone app, iPad Safari order.
- **Dark looks:** the login row has no dark variant any more (it went with the obsidian login), and white with the
  black Apple glyph is one of Apple's sanctioned styles on a dark ground. The shared chrome's words and edge now take
  `ink-on-light` (the ink for a surface that stays light) instead of the page's `ink`: identical on every light page
  (it falls back to `--color-ink`), and on Candlelight / a dark theme the label stays dark on its white instead of
  cream on white.
- `saveMethodLine` (lib/guest-one-path.ts) is gone — nothing reads it now.
- Guard `the-save-offer-shows-both-providers.test.ts` rewritten: both buttons are the login's buttons (exact class,
  mark, title) · Apple's chrome identical to Google's · the device's first · heading above · email link under ·
  one chrome for all four doors · the label reads on its white under Candlelight — each seen red under sabotage.

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "SAVE TO MY ACCOUNT USES THE LOGIN'S OWN APPLE / GOOGLE BUTTONS".

## 2026-10-25 · feat(pricing): "Free here. Paid elsewhere. / Pay only for the upgrades you need."

Owner 2026-10-25, verbatim: *"make sure they see that while Other websites pay for these services, we give it for
free. And only pay what you need to upgrade."* Built to the approved prototype
`prototypes/pricing_free_plus_addons_2026-10-25/index.html` (corpus 20b2a55c, revision 4). Replaces this PR's earlier
Free-vs-Pro table.

- **Hero** — "Free here. Paid elsewhere. Pay only for the upgrades you need." · Start free · What you can add ↓.
- **Free** ("What you'd pay for elsewhere.") — five lines, each with what other event sites charge (guest caps 30–50 ·
  about ₱2,500 for a full event site · seating charts paid past 15 guests, 3D enterprise-only · check-in only on a paid
  plan · about ₱2,700–₱3,000 a livestream), the printables, "One place, instead of several tools" (at least ₱5,489
  elsewhere · ₱0 here — the two per-event prices summed; seating and check-in marked "extra", not summed), and the
  compact rest of the planner. **No competitor is named.** Every other-site figure lives in `lib/pricing-elsewhere.ts`
  with its source URL and read date (2026-10-25); the "about" and "at least" figures are arithmetic on those.
- **What you can add** ("Pay only for the upgrades you need.") — Event Hub Pro (COUPLE_WEBSITE_PRO, both prices, the
  launch line) with ONE dropdown: "Everything · ₱…" (the ten things it gives) or "Just the parts you need · from ₱…"
  (the eleven `COUPLE_HUB_PART_*` rows, names and blurbs from `lib/hub-parts.ts`, what you pay counts toward the full
  price). Then Papic credits (from the lowest rung; the ⓘ quotes the 100 · 1,000 · 10,000 rungs), Live Watch
  (LIVE_STUDIO, drawn only while its row is on sale), Patiktok (per day, from the row's billing period), Music Maker
  (PAKANTA), Setnayan AI by event type (one dropdown over SETNAYAN_AI · _B · _C · _D, both prices each).
  **Every peso of ours is a `platform_retail_catalog_v2` read** — a missing row draws no figure. The parts and AI bands
  come from one extra read (`readPricingExtras`), since the customer catalogue deliberately leaves them out.
- Below, unchanged: the grouped add-ons catalogue, the Papic estimator, "Everything you get for free", apply-then-pay.
- ⓘ sit beside each item's name (the house `InfoTip`: an (i) always sits beside a visible label), where the prototype
  drew some at the end of a paragraph. The pickers are the house `PickMenu` with a hairline (the page is white).
- Guards: `app/(shell)/pricing/pricing-free-plus-addons.test.ts` (replaces `pricing-free-vs-pro-table.test.ts`) and
  `lib/pricing-elsewhere.test.ts` — each seen red under sabotage. Updated: `setnayan-ai-two-prices.test.ts`,
  `patiktok-paid-verification-free-copy.test.ts`, `public-copy-says-the-house-words.test.ts` (two phrase-exact
  allowances for "other event sites" / "Event website, unlimited guests" — they name other companies' sites),
  `the-couple-books-never-locks.test.ts` (the old "no lock-in" line is gone, so its allowance row went too).

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "/PRICING BUILT TO THE FREE-HERE-PAID-ELSEWHERE PROTOTYPE".
