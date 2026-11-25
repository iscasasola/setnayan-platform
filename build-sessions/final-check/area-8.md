# Final check · Area 8 · Admin (/admin/* and the internal pages)

> CHECKER 8 of 8. Report only, never a fix. Check commit: main @ fb3f72d (frozen). Phase A = code pass (SOURCE: CODE).
> Phase B (browser walk on staging) waits for the controller's address. Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6.
> Marks per page: OFFLINE = NEEDED / READ-ONLY IS ENOUGH / NOT NEEDED · SHAPE = what it is TODAY → what it SHOULD be (PAGE / FULL-SCREEN POPUP / SMALL POPUP).

## BLOCKERS

None found.

## Progress

### Pages (71)

- [ ] /admin
- [ ] /admin/account-deletions
- [ ] /admin/accounts
- [ ] /admin/admin-log
- [x] /admin/app-performance · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: overview (default + bare-address landing), connection-logs, funnels, growth, intelligence, offline, operations, seo, visits, interconnections, browser-blocks, slow-loads
- [ ] /admin/approvals
- [ ] /admin/ask
- [ ] /admin/background-videos
- [ ] /admin/booking-fees
- [x] /admin/budget-planner · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/business · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · views checked: own (identity, brand icon, loader, Sentry, compliance), privacy, data-sheet, integrations (secrets view not readable, see NOTES)
- [x] /admin/catalogue · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/categories · OFFLINE: NOT NEEDED · SHAPE: today PAGE (map + full-screen Sheet drawer) → should PAGE
- [x] /admin/categories/requests · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/chat-flags
- [ ] /admin/colours
- [ ] /admin/completions
- [x] /admin/compliance/data-sheet · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/concierge-abuse
- [ ] /admin/corrections
- [x] /admin/data-privacy · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: controls, coverage, deletions, checklist, documents (+ documents/[doc] route)
- [x] /admin/demand · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/demo-vendors/inquiries
- [ ] /admin/directory
- [ ] /admin/discount-codes/new
- [ ] /admin/disputes
- [ ] /admin/editorial-review
- [x] /admin/email-delivery · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/event-deletions
- [ ] /admin/force-majeure
- [ ] /admin/founder-seats
- [ ] /admin/fraud
- [ ] /admin/gifts
- [ ] /admin/help
- [ ] /admin/help/guides
- [ ] /admin/hub-music
- [x] /admin/integrations · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/integrity-watch
- [ ] /admin/launch-offer
- [ ] /admin/live-studio-channels
- [ ] /admin/money
- [ ] /admin/more
- [ ] /admin/offers
- [ ] /admin/pakanta
- [ ] /admin/papic-storage
- [ ] /admin/pax-changes
- [ ] /admin/payment-options
- [ ] /admin/payments
- [ ] /admin/payments/supplier-refunds
- [ ] /admin/payouts
- [x] /admin/pricing · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: pricing, setnayan-ai, papic-shots, price-bands, free-windows, plan-contents
- [ ] /admin/receipts
- [ ] /admin/repost-watch
- [ ] /admin/reviews
- [ ] /admin/search-memory
- [ ] /admin/secrets · NOT CHECKED: this session's permission settings refuse every read of `apps/web/app/admin/secrets/` (lead and checker both tried); needs a session that may open it
- [ ] /admin/settings/payment-methods
- [ ] /admin/studio
- [ ] /admin/subscriptions
- [x] /admin/switches · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · incl. #demo-mode and the /api/admin/demo-mode/toggle route
- [ ] /admin/team
- [x] /admin/ugat · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: menus (default), onboarding, brain, screens
- [x] /admin/ugat/map · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/user-reports
- [x] /admin/vendor-partnerships · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/vendor-recommendations · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/venues/new
- [ ] /admin/verification-docs
- [ ] /admin/verify
- [ ] /admin/website-media
- [ ] /admin/work

### Forwards (36) — each must land where the kit says, with its ?tab=

- [x] /admin/addons → /admin/pricing · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/brain → /admin/ugat?tab=brain · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/compliance → /admin/business · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/connection-logs → /admin/app-performance?tab=connection-logs · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/demo-vendors → /admin/accounts?tab=demo-vendors · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/discount-codes → /admin/studio?tab=discount-codes · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/events → /admin/accounts?tab=events · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/funnels → /admin/app-performance?tab=funnels · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/growth → /admin/app-performance?tab=growth · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/insights → /admin/app-performance · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/intelligence → /admin/app-performance?tab=intelligence · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/journal-spotlights → /admin/studio?tab=journal-spotlights · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/menus → /admin/ugat?tab=menus · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/moodboard-library → /admin/studio?tab=moodboard-library · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/notifications → /admin/email-delivery · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/npc-readiness → /admin/data-privacy?tab=checklist · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/offline → /admin/app-performance?tab=offline · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/onboarding → /admin/ugat?tab=onboarding · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/operations-hiring → /admin/app-performance?tab=operations · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/patiktok → /admin/studio?tab=patiktok · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/price-bands → /admin/pricing?tab=price-bands · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/queues → /admin/work · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/real-stories → /admin/studio?tab=real-stories · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/recaps → /admin/studio?tab=recaps · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/referrals → /admin/studio?tab=referrals · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/reveal-studio → /admin/studio?tab=reveal-studio · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/seo → /admin/app-performance?tab=seo · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/settings → /admin/business · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/settings/demo-mode → /admin/switches · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/social-queue → /admin/studio?tab=social-queue · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/songs → /admin/studio?tab=songs · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/spotlight-awards → /admin/studio?tab=spotlight-awards · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/users → /admin/accounts?tab=users · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/vendors → /admin/accounts?tab=vendors · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/venues → /admin/accounts?tab=venues · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/website → /admin/studio?tab=website · lands ✓ (code: target + `?tab=` key read by the host page)

## Findings

> IDs: `L-n` = area-wide (checker 8 itself) · `A`–`I` = one id per group of pages (A money · B pricing & catalogue ·
> C home, work & shell · D accounts · E verify & disputes · F watch desks & media · G studio · H app performance & Ugat ·
> I settings & system). Every finding cites code by file + a greppable string, never a line number.

### Area-wide

#### L-1 · Government-ID shelf is read with the service role behind the layout gate only
PAGE      /admin/verification-docs
BUTTON    —
STEPS     1. Open `apps/web/app/admin/verification-docs/page.tsx`. 2. Follow `buildVerificationDocsReport` and `verificationDocSupplierNames`.
EXPECTED  The page calls `requireAdmin()` itself before any service-role read (the rule written in `lib/admin/require-admin.ts`: "a Next.js layout is NOT a safe auth boundary … Every admin PAGE that touches the service-role client must call requireAdmin() itself").
ACTUAL    No `requireAdmin` in the page. `lib/verification-docs-server.ts` (`buildVerificationDocsReport`) and `lib/verification-doc-suppliers.server.ts` both call `createAdminClient()`; only `app/admin/layout.tsx` gates. The shelf lists strangers' government-ID files and supplier names. (The view/delete actions are gated; the listing is not.)
SHOTS     phase B: n/a (access, not layout) — confirm a non-admin sign-in gets 404
RULE      Task check 2 (admin gates, server-side) · `lib/admin/require-admin.ts` contract
SEVERITY  money-signin
SOURCE    CODE

#### L-2 · Three more pages lean on the layout gate alone
PAGE      /admin/demand · /admin/venues/new · /admin/more
BUTTON    —
STEPS     1. Open each `page.tsx`. 2. Look for `requireAdmin`.
EXPECTED  Every /admin page checks for an admin server-side itself.
ACTUAL    None of the three calls `requireAdmin()`. Exposure is small: `/admin/demand` reads through the RLS client (`demand_radar_admin` re-gates in SQL) but its `after(() => maybeRefreshDemandRadar())` runs a service-role rebuild on any request that reaches the page; `/admin/venues/new` draws a form whose `createVenue` action is gated; `/admin/more` is a static menu. Listed for consistency with the rule, not as a leak.
SHOTS     phase B: n/a
RULE      Task check 2 (admin gates)
SEVERITY  wrong
SOURCE    CODE

#### L-3 · Admin never goes dark: the console is not on the dark ready-list
PAGE      every /admin page
BUTTON    Preferences › Dark (the appearance switch)
STEPS     1. Pick Dark. 2. Open any /admin page.
EXPECTED  Every signed-in screen works in dark (kit § 5.7; DARK_MODE_STANDARD § 1 gives admin its own monochrome dark family).
ACTUAL    `lib/appearance.ts` `DARK_READY` has no `/admin` entry, so the whole console paints Light. `app/admin/_components/admin-look.css` says so itself: "DARK IS WRITTEN, NOT YET SWITCHED ON … its screens have not been swept for hard-coded colours". The per-page K2 findings below list the light-only colours that block switching it on.
SHOTS     phase B: 1280 px + 375 px with Dark chosen
RULE      HOUSE_DESIGN_STANDARD Part K2 · DARK_MODE_STANDARD § 1 (Admin = monochrome) · kit § 5.7
SEVERITY  look
SOURCE    CODE

#### L-4 · The admin dark set gives static cards a shadow
PAGE      every /admin page (once dark is switched on)
BUTTON    —
STEPS     1. Open `app/admin/_components/admin-look.css`, block `html.dark:has([data-admin-look])`.
EXPECTED  In dark the page is flat, cards are one step lighter, and static cards carry no shadow.
ACTUAL    The dark block sets `--sn-frame-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 14px 30px -14px …` and `--sn-frame-shadow-tile`, so every `.sn-frame` / `.sn-tile` / `.sn-row` would wear a lift shadow in dark.
SHOTS     phase B: only if dark is switched on for admin by then
RULE      HOUSE_DESIGN_STANDARD Part K2.1 ("no shadows") · Part I.4 (shadows only on floating overlays)
SEVERITY  look
SOURCE    CODE

#### L-5 · 39 pages load with the overview's skeleton
PAGE      /admin/admin-log · /admin/approvals · /admin/ask · /admin/background-videos · /admin/booking-fees · /admin/business · /admin/chat-flags · /admin/colours · /admin/compliance/data-sheet · /admin/corrections · /admin/data-privacy · /admin/demand · /admin/editorial-review · /admin/email-delivery · /admin/event-deletions · /admin/founder-seats · /admin/fraud · /admin/gifts · /admin/hub-music · /admin/integrations · /admin/integrity-watch · /admin/launch-offer · /admin/live-studio-channels · /admin/offers · /admin/pakanta · /admin/papic-storage · /admin/pax-changes · /admin/repost-watch · /admin/search-memory · /admin/secrets · /admin/subscriptions · /admin/switches · /admin/team · /admin/user-reports · /admin/vendor-partnerships · /admin/vendor-recommendations · /admin/verification-docs · /admin/website-media · /admin/work
BUTTON    —
STEPS     1. Open any listed page on a slow connection.
EXPECTED  The skeleton draws only what that page draws (HOUSE_DESIGN_STANDARD F1: "Every loading.tsx mirrors its loaded layout").
ACTUAL    None of these has a `loading.tsx` of its own, so each shows `app/admin/loading.tsx` — the OVERVIEW's ghost ("Action queues panel — terracotta-tinted card + 4 queue tiles", "Stats — 8 tiles", "Nav tiles — 6 tiles"). That ghost also uses a hand-made terracotta frame (`border-terracotta/20 bg-terracotta/[0.03]`) on the monochrome console.
SHOTS     phase B: 375 px light on a throttled load of /admin/approvals and /admin/booking-fees
RULE      HOUSE_DESIGN_STANDARD F1 · CLAUDE.md §3 Loading ("the skeleton draws only what the page draws") · kit § 5.9
SEVERITY  wrong
SOURCE    CODE

#### L-6 · Every form button spins while it works
PAGE      every /admin page with a form (shared `SubmitButton`; other areas share it too)
BUTTON    any submit, e.g. "Save", "Approve"
STEPS     1. Press a submit button. 2. Watch it while the action runs.
EXPECTED  No spinners; a slow action names its step (HOUSE_DESIGN_STANDARD D1).
ACTUAL    `app/_components/submit-button.tsx` `SubmitButton` draws a spinning icon (`className="h-4 w-4 animate-spin"` inside `sn-m-busy`) while pending.
SHOTS     phase B: 375 px light, mid-press
RULE      CLAUDE.md §3 Loading ("No animate-pulse, no spinners") · HOUSE_DESIGN_STANDARD D1
SEVERITY  look
SOURCE    CODE

_Group findings follow as each group of pages is done._

### Group B · Pricing & catalogue

#### B-1 · A failed sign-up discount read counts as 0%: it is shown, and saving with it wipes sign-up prices
PAGE      /admin/pricing   (tabs: papic-shots, setnayan-ai)
BUTTON    "Save shot prices" · "Save" (band price)
STEPS     1. The `platform_settings.onboarding_discount_pct` read is refused. 2. Open the tab. 3. Press save.
EXPECTED  A refused discount read says "Couldn't read" and blocks the save.
ACTUAL    `readOnboardingDiscountPct(settings?.onboarding_discount_pct)` returns `DEFAULT_ONBOARDING_DISCOUNT_PCT` (0) and the error is never read: in `price-control-actions.ts` `savePapicLadder` and `saveAiBandPrice` (`const { data: settings }`), and in both surfaces. `storedSignupPriceFor(…, 0)` writes NULL, which erases every Papic rung's sign-up price, or the band's. On screen, the "At set-up" column and "the saving above would make this" show the regular price as the sign-up price.
SHOTS     phase B: 375 px light
RULE      Honest states · CLAUDE.md §5.4
SEVERITY  money-signin
SOURCE    CODE

#### B-2 · Most price writes skip the "Prices & promos · Escalated" check that row saves enforce
PAGE      /admin/pricing   (tabs: pricing, setnayan-ai, papic-shots, free-windows)
BUTTON    "Save booking fee" · "Save" (sign-up discount) · "Save shot prices" · "Move" / "Save" (AI bands) · "Create … free window"
STEPS     1. Sign in as an admin with only Basic in Prices & promos. 2. "Save this price" is refused. 3. Any of the buttons above saves.
EXPECTED  Every price change checks `requireAdminCan('prices_promos','escalated')`. `lib/admin/areas.ts` says Escalated = "change a price · codes · launch offer · free windows".
ACTUAL    `actions.ts` row saves call `requireAdminCan`. `price-control-actions.ts` (`saveBookingFeeSchedule`, `savePapicLadder`, `saveSignupDiscount`, `setEventTypeBand`, `saveAiBandPrice`, `savePapicProductPrice`) and `_surfaces/free-windows-actions.ts` call only `requireAdminAction()`.
SHOTS     —
RULE      Admin gates (area powers)
SEVERITY  money-signin
SOURCE    CODE

#### B-3 · Setnayan AI prices fall back to prices typed in code
PAGE      /admin/pricing   (tab: setnayan-ai)
BUTTON    "Save" (Regular price)
STEPS     1. The catalogue read fails, or a band's SKU row is missing. 2. Open the tab.
EXPECTED  The price comes only from `platform_retail_catalog_v2`. With no row, the tab says "Couldn't read".
ACTUAL    `_surfaces/ai-prices-surface.tsx`: `regularPhp: row ? … : sku ? AI_TIER_FALLBACK_PHP[band] : null` fills "Regular price" with a peso amount typed in code. When a row is just missing (not a failed read), `locked` is false and Save stays live.
SHOTS     phase B: 375 px light
RULE      No typed prices · CLAUDE.md §1 Money
SEVERITY  money-signin
SOURCE    CODE

#### B-4 · Booking fee form fills in code values when the settings read fails, and still offers Save
PAGE      /admin/pricing   (tab: pricing)
BUTTON    "Save booking fee"
STEPS     1. The `platform_settings` read is refused. 2. Open the Supplier booking fee section.
EXPECTED  "Couldn't read" with saving off. The minimum is read, not typed.
ACTUAL    `pricing-surface.tsx` ("Falls back to the locked code schedule") fills the rate, threshold and tail from `BOOKING_FEE`. `booking-fee-form.tsx` then says "save once to store it", which writes the code values over the real ones. `minPhp={BOOKING_FEE.minPhp}` is a peso number typed in `lib/booking-fee.ts`.
SHOTS     phase B: 375 px light
RULE      Honest states · no typed prices
SEVERITY  money-signin
SOURCE    CODE

#### B-5 · Peso amounts are formatted by hand all over the pricing tabs
PAGE      /admin/pricing   (all tabs)
BUTTON    —
STEPS     1. Open any tab and read a price.
EXPECTED  Every peso amount goes through `lib/php.ts` (`formatPhp` / `formatPhpRounded`).
ACTUAL    Examples: `catalog-editor.tsx` `pesoShort` (`₱${n.toLocaleString('en-PH')}`, and "Free" at 0) plus "to sign up". The local `const peso` in `signup-discount-card.tsx`, `ai-bands-editor.tsx`, `papic-ladder-editor.tsx` and `papic-rest-editor.tsx`. `booking-fee-form.tsx` examples. `price-bands-surface.tsx` `function peso`. `free-windows-surface.tsx` `₱{formatPeso(…)}`. `plan-contents-surface.tsx` `Price:`. The `price-control-actions.ts` error message `₱${band.toLocaleString`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (format only via `lib/php.ts`)
SEVERITY  money-signin
SOURCE    CODE

#### B-6 · Budget planner saves hide every failure, and a typo clears a price
PAGE      /admin/budget-planner
BUTTON    "Save" (band row, benchmark row) · "Save settings"
STEPS     1. Type "12k" in Benchmark and press Save. 2. Or save while the write is refused. 3. Or save the engine settings before the config row exists.
EXPECTED  A refusal shows a plain reason. Bad input is refused, never stored as "blank".
ACTUAL    The inline `action={async (fd) => { 'use server'; await updateLeafBenchmark(fd); }}` throws away `{ ok:false, error }`, and the same holds for `updateBudgetBand` and `updateAllocationConfig`. `parsePhp` turns non-numeric text into null, which clears the benchmark (a band median becomes 0). `updateAllocationConfig` `.update().eq('config_key','default')` changes 0 rows and still reports nothing.
SHOTS     phase B: 375 px light
RULE      Honest states · every press reaches a real result
SEVERITY  money-signin
SOURCE    CODE

#### B-7 · Free windows says there are no services when the catalogue read fails
PAGE      /admin/pricing   (tab: free-windows)
BUTTON    "Create couple free window"
STEPS     1. The catalogue read fails. 2. Open the tab.
EXPECTED  "Couldn't read the services" with Create turned off.
ACTUAL    `fetchV2CustomerCatalog()` (`lib/v2-catalog.ts`) does `if (error || !data) return []`, so the form says "No live customer SKUs found in the catalog." and Create stays live.
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  money-signin
SOURCE    CODE

#### B-8 · Under a failed catalogue read, empty-state copy still shows beneath the banner
PAGE      /admin/pricing   (tabs: pricing, papic-shots)
BUTTON    —
STEPS     1. The retail or supplier catalogue read is refused. 2. Open the tab.
EXPECTED  Nothing below the banner claims an empty state.
ACTUAL    `pricing-surface.tsx` still mounts `PriceCatalogBrowser` with `retailRes.data ?? []`. The formula card says "No price on sale has a cost yet.", the Off view says "Nothing is switched off.", and the counts leave out the rows that failed. In `papic-ladder-surface.tsx`, `PapicRestEditor` draws an empty frame: the Thank You price disappears and nothing says it couldn't be read.
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  money-signin
SOURCE    CODE

#### B-9 · Supplier free windows print the plan's code key ("Solo" / "Enterprise")
PAGE      /admin/pricing   (tab: free-windows)
BUTTON    —
STEPS     1. Create a supplier free window for Plus or Ultra. 2. Read its row under "Scheduled & past windows".
EXPECTED  "Plus" / "Ultra".
ACTUAL    `free-windows-surface.tsx`: `Suppliers → {row.promoted_vendor_tier ?? '—'} tier, free` with `capitalize` prints "Solo tier" and "Enterprise tier".
SHOTS     phase B: 375 px light
RULE      Words: supplier plans Free · Verified · Plus · Pro · Ultra
SEVERITY  wrong
SOURCE    CODE

#### B-10 · Supplier add-on rows say "(Supplier Ultra)"
PAGE      /admin/pricing   (tab: pricing)
BUTTON    —
STEPS     1. Kind ▾ Supplier. 2. Read the type line under an add-on's price.
EXPECTED  "Ultra". The owner ruled on 14 Nov "NO 'SUPPLIER'" (`TIER_LABEL` comment in `lib/vendor-tier-caps.ts`).
ACTUAL    `pricing-surface.tsx` `VENDOR_OFFERING_LABEL`: 'Add-on · +1 branch (Supplier Ultra)', and the same for seat, category, service card, wait list and booking per date.
SHOTS     phase B: 375 px light
RULE      Words: plan names
SEVERITY  wrong
SOURCE    CODE

#### B-11 · Plan contents has no Event Ultra
PAGE      /admin/pricing   (tab: plan-contents)
BUTTON    "Which plan ▾"
STEPS     1. Open "Which plan ▾" and look at Event plans.
EXPECTED  Free · Event Plus · Event Pro · Event Ultra (`EVENT_PLANS` has four columns; `PLAN_PRICE_CODES.ultra`).
ACTUAL    `plan-contents-surface.tsx` `EVENT_VIEWS = ['ev-free','ev-plus','ev-pro']`, and `plan-contents-actions.ts` `EVENT_PLAN_CODES` leaves out `EVENT_ULTRA`. Event Ultra's Papic credits cannot be seen or changed here.
SHOTS     phase B: 375 px light
RULE      Couple plans: Free · Event Plus · Event Pro · Event Ultra
SEVERITY  wrong
SOURCE    CODE

#### B-12 · Plan contents tells the admin two things that are not true
PAGE      /admin/pricing   (tab: plan-contents)
BUTTON    "edited on Papic shot prices" (on the Free plan)
STEPS     1. Read the "Which plan" ⓘ. 2. Pick Free and follow the link.
EXPECTED  The copy matches what the app does.
ACTUAL    The tip says a change is "confirmed by a second admin in Approvals, the same as a price", but price saves now apply at once (`actions.ts` "A PRICE CHANGE APPLIES AT ONCE"). The link says the free grant is edited on Papic shot prices, but that tab says "Not editable here yet — changing it still needs a migration" (`papic-rest-editor.tsx`).
SHOTS     phase B: 375 px light
RULE      Honest copy
SEVERITY  wrong
SOURCE    CODE

#### B-13 · The Catalogue home shows the word "Journal"
PAGE      /admin/catalogue
BUTTON    "Journal Spotlights" (chip on the Stories & social card)
STEPS     1. Open /admin/catalogue. 2. Read the Stories & social card's chips and its line.
EXPECTED  Articles, never Journal.
ACTUAL    `lib/admin/admin-pages.ts` `v('journal-spotlights', 'Journal Spotlights', …)`, drawn by `_components/tab-landing.tsx` as a chip and in the card's line.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### B-14 · Categories counts and lists say "0" and "none waiting" when a read fails
PAGE      /admin/categories
BUTTON    "Show ▾ Requests" · "List ▾ Event types / Religions"
STEPS     1. The supplier-requests, search-words or event-types read is refused. 2. Read the counts line and the list.
EXPECTED  "—", which the page's own banner promises ("anything that reads '—' below is unknown, not zero").
ACTUAL    In `page.tsx` only services is guarded. `${formatCount(cats.requests.length)} requests` and `words waiting` print 0. The event-types and religions counts print "0 event types · 0 in the picker…". `list-pane.tsx` says "No supplier requests waiting." / "No words waiting." on the failure path.
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE

#### B-15 · Service requests state guesses as facts when reads fail
PAGE      /admin/categories/requests   (and the row door /admin/categories/requests/[requestId])
BUTTON    request row › Decision
STEPS     1. `loadRequestTree()` returns null, or the shop-name or card-count read fails. 2. Open the list, then a request.
EXPECTED  "Couldn't read" for each fact that failed.
ACTUAL    `list-view.tsx` `categoryOf` → "A retired category" on every filed row. `nameOf` → "a shop" when the `vendor_profiles` error is set. `request-view.tsx` passes `cards={cards ?? 0}` to `DecisionForm`, which then says "No cards to move — the shop has not made one here yet." (`cardsMoveLine`).
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE

#### B-16 · Picking a kind with no prices says 'Nothing matches "".'
PAGE      /admin/pricing   (tab: pricing)
BUTTON    "Kind ▾"
STEPS     1. Leave search empty. 2. Pick a kind with nothing on sale (e.g. Bundles).
EXPECTED  An empty state that says nothing of that kind is on sale.
ACTUAL    `catalog-editor.tsx` falls to `<EmptyState title={`Nothing matches "${q}".`}` with q = "", which reads "Try part of the name, or the product code."
SHOTS     phase B: 375 px light
RULE      Empty, loading and failure never look alike
SEVERITY  wrong
SOURCE    CODE

#### B-17 · Two accent buttons in one price card and in the formula card
PAGE      /admin/pricing   (tab: pricing)
BUTTON    "Save this price" + "Retire it" · "Save this price" + "Remove for good" · "Save formula" + "Apply to all rows with a cost"
STEPS     1. Open a row, then press Retire this price (or Remove for good). 2. Press "Change the numbers" in the formula card.
EXPECTED  One main button per card. A filled danger only as the single action of a confirm sheet.
ACTUAL    `catalog-editor.tsx` `SaveSection` (`tone="brand" main`) sits beside `CardFooter` (`tone="warn" main` / `tone="danger" main`). `RemoveAllBar` draws a filled danger "Remove all N" inline. `pricing-formula-card.tsx` draws "Save formula" (`brand main`) next to "Apply to all…" (`tone="brand"`, same colour).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### B-18 · The event-type panel has nine filled Save buttons
PAGE      /admin/categories   (List ▾ Event types › a type)
BUTTON    "Save" (×8) + "Save onboarding content"
STEPS     1. Open an event type. 2. Open its sections.
EXPECTED  One main button per panel.
ACTUAL    `event-type-panel.tsx` uses `className={SAVE}` (`bg-ink … text-cream`, `ui.tsx`) 8 times; 5 of them submit the same `form={formId}`. `onboarding-editor.tsx` adds a filled `bg-mulberry` "Save onboarding content".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### B-19 · "Reset to default content" uses window.confirm
PAGE      /admin/categories   (List ▾ Event types › a type › Onboarding content)
BUTTON    "Reset to default content"
STEPS     1. Press Reset to default content.
EXPECTED  The shared confirm `Sheet`.
ACTUAL    `onboarding-editor.tsx`: `if (!confirm('Reset this type to the built-in default onboarding? …'))`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD K3
SEVERITY  look
SOURCE    CODE

#### B-20 · Delete and Combine confirm with a dialog on top of the drawer Sheet
PAGE      /admin/categories   (map › a category or service drawer)
BUTTON    "Delete ‹category›" · "Combine"
STEPS     1. Open a category in the map (it opens as a full Sheet). 2. Open the red fold and press Delete or Combine.
EXPECTED  No popup on top of a popup.
ACTUAL    `in-place.tsx` `DeleteCategory` / `CombineService` call `useConfirm()`, which renders a `<dialog>` (`app/_components/confirm-dialog.tsx`) inside `MapDrawer`'s `Sheet` (`four-level-map.tsx`).
SHOTS     phase B: 375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### B-21 · Native `<select>` with 3+ options (2 on this page)
PAGE      /admin/categories
BUTTON    faith select · prepared-job pick
STEPS     1. Ask the search box to add a service, or open a prepared job card.
EXPECTED  `PickMenu`.
ACTUAL    `ask-prefill.tsx` `<select name="faith">` (Everyone + every religion); `prepared-job-card.tsx` `<select name={f.field}>` (catalogue options).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### B-22 · The budget planner's loading skeleton draws a grid of picture tiles
PAGE      /admin/budget-planner
BUTTON    —
STEPS     1. Navigate to the page and watch it load.
EXPECTED  A skeleton of row lists, a settings form and a table.
ACTUAL    `budget-planner/loading.tsx` exports `GridPageSkeleton` (9 `h-44` tiles with image blocks); the page draws none.
SHOTS     phase B: 375 px light
RULE      Skeleton draws only what the page draws (CLAUDE.md §3 Loading)
SEVERITY  look
SOURCE    CODE

#### B-23 · The Catalogue home's loading skeleton draws a toolbar and list rows
PAGE      /admin/catalogue
BUTTON    —
STEPS     1. Navigate to the page and watch it load.
EXPECTED  The head-numbers card plus the card grid that `TabLanding` draws.
ACTUAL    `catalogue/loading.tsx` uses `ListPageSkeleton` (a `ToolbarSkeleton` plus 8 rows); the page has no toolbar and no list.
SHOTS     phase B: 375 px light
RULE      Skeleton draws only what the page draws
SEVERITY  look
SOURCE    CODE

#### B-24 · Light-only colours and typed sizes on the pricing tabs (107)
PAGE      /admin/pricing   (all tabs)
BUTTON    —
STEPS     1. Grep the tab files.
EXPECTED  Colour and size tokens only.
ACTUAL    107 hits, e.g. `bg-emerald-100 text-emerald-800` / `bg-sky-100` / `bg-amber-100` (`free-windows-surface.tsx` `STATUS_STYLE`), `text-white/80` and `rounded-[var(--sn-frame-radius)]` (`catalog-editor.tsx`), and `text-[15px]` / `text-[11px]` (`ai-bands-editor.tsx`, `pricing-formula-card.tsx`).
SHOTS     phase B: 375 px light (+ desktop)
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### B-25 · Light-only colours and typed sizes in Categories (109)
PAGE      /admin/categories
BUTTON    —
STEPS     1. Grep `app/admin/categories` (outside requests/).
EXPECTED  Colour and size tokens only.
ACTUAL    109 hits, e.g. `bg-white` (`onboarding-editor.tsx`, `request-controls.tsx`, `prepared-job-card.tsx`), `bg-sky-50 text-sky-700` (`what-couples-choose.tsx`), `border-sky-300` (`list-pane.tsx`), `shadow-sm` (the `page.tsx` flash banner), and `text-[13px]` ×20.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### B-26 · Light-only colours and typed sizes in Service requests (24)
PAGE      /admin/categories/requests
BUTTON    —
STEPS     1. Grep `categories/requests`.
EXPECTED  Colour and size tokens only.
ACTUAL    24 hits, e.g. `bg-white` on the "Search services" box and the picked card (`decision-form.tsx`), `bg-success-600 text-white` hand-made buttons (`BUTTON` map), and `text-[11px]` / `text-[12.5px]` (`list-view.tsx`).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### B-27 · Light-only colours and typed sizes in the budget planner (36)
PAGE      /admin/budget-planner
BUTTON    —
STEPS     1. Grep `budget-planner/page.tsx`.
EXPECTED  Colour and size tokens only.
ACTUAL    36 hits, e.g. `bg-white/70` on both column-header strips, `text-[12px]` ×30, and the hand-made `rounded-md bg-terracotta-700 … text-cream` Save buttons.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group B notes**

- Area-wide, for the lead: the `catalogue` admin area (Escalated = "hide for everyone · combine · retire", `lib/admin/areas.ts`) is never enforced; no `requireAdminCan('catalogue', …)` exists anywhere. Delete, combine and hide in `app/admin/categories/*actions*.ts` check only that the caller is an admin.
- App-wide: the shared `app/_components/confirm-dialog.tsx` is a native `<dialog>`, not `Sheet`, so every `useConfirm()` caller inherits a K3 miss.
- `price-bands/actions.ts` and `budget-planner/actions.ts` each hand-roll their own admin check instead of `requireAdminAction`; it matches `isAdminProfile` today. `price-bands/actions.ts` also does `throw new Error(error.message)` when the recompute RPC fails, so the admin gets an error page instead of a plain sentence.
- The Free windows "Delete" removes a window in one press with no confirm. It is not on the checklist, but it cannot be undone.
- I walked `/admin/categories/requests/[requestId]` as the row door of the requests list; its findings are folded into B-15.

### Group H · App performance & Ugat

#### H-1 · A failed sales read shows ₱0 and flat bars under a "Live" pill
PAGE      /admin/app-performance   (tab: overview, also the bare address)
BUTTON    —
STEPS     1. Open Insights › Overview. 2. The monetization read is refused.
EXPECTED  The sales card says "Couldn't read" or "—" where the peso figures would be.
ACTUAL    `fetchAppPerformanceStats` falls back to `fallback.monetization` (`totalPhp: 0`), and `CockpitSurface` still prints `php.format(perf.monetization.totalPhp)` as ₱0, each stream as ₱0 and flat `StackedBars`, under `pill="live"`. The only sign of the failure is the top banner "Some metrics couldn't load".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states · brief checklist 3
SEVERITY  money-signin
SOURCE    CODE

#### H-2 · Peso amounts are formatted by hand, not through lib/php.ts
PAGE      /admin/app-performance   (tabs: overview, intelligence, operations)
BUTTON    —
STEPS     1. Open Overview (Sales card, Expenses & Receipts), Intelligence (Market pulse) and Operations (Hiring roadmap).
EXPECTED  Every peso figure goes through `formatPhp` or `formatPhpRounded`.
ACTUAL    There are four hand-rolled formatters. overview-surface.tsx `const php = new Intl.NumberFormat('en-PH', { style: 'currency'`. expenses.tsx has the same `php`. intelligence-surface.tsx has `phpFmt`. operations-surface.tsx has a local `function formatPhp` that returns `` `₱${n.toLocaleString('en-PH')}` ``, so it shadows the real helper's name.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · brief checklist 4
SEVERITY  money-signin
SOURCE    CODE

#### H-3 · On the entity map, every failed count reads 0 and "live", orders and billing included
PAGE      /admin/ugat/map
BUTTON    the Orders and Billing nodes; Tables › any table
STEPS     1. Open the Entity map. 2. Any head count is refused. 3. Open the Orders or Billing node, or a table.
EXPECTED  "Couldn't read" or "—", never 0.
ACTUAL    In lib/ugat/data.ts, `headCount` does `if (error) { logQueryError(...); return 0; }`, and the wallets sum also returns 0. The console prints 0 with "live" for "Pending payment" and "Active subscriptions". A failed table load sets `total: 0`, which reads "0 rows · live".
SHOTS     phase B: desktop
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### H-4 · The Billing node shows a typed "Commission 0%"
PAGE      /admin/ugat/map
BUTTON    the Billing node
STEPS     1. Open the Entity map. 2. Click the Billing node.
EXPECTED  A fee or commission rate is read from where it lives (`platform_settings` booking-fee columns) and names who it applies to.
ACTUAL    ugat-console.tsx has `kv.push(['Commission', '0%'])`: a constant typed into the code, shown in the supplier-billing card even though suppliers pay the booking fee read by `getBookingFeeSchedule`.
SHOTS     phase B: desktop
RULE      CLAUDE.md §1 "Never write a price into code" · brief checklist 4
SEVERITY  money-signin
SOURCE    CODE

#### H-5 · Every AI-brain chunk shows a dead "Edit" button, next to "Coming soon" chips
PAGE      /admin/ugat   (tab: brain)
BUTTON    "Edit" · "Unanswered questions · Coming soon" · "Cost Watch · Coming soon"
STEPS     1. Open Root map › AI brain. 2. Open any topic.
EXPECTED  No placeholder controls. A control either works or is not there.
ACTUAL    brain-surface.tsx `ChunkRowView` renders `<button ... disabled title="Edit coming with the next refresh.">Edit</button>` on every row. The tab strip renders `ComingSoonTab` twice.
SHOTS     phase B: 375 px light
RULE      design-and-wiring §B5
SEVERITY  broken
SOURCE    CODE

#### H-6 · A refused Resolve, Ignore or Archive save says "Saved ✓"; Archive also leaves the faults in the archive
PAGE      /admin/app-performance   (tab: connection-logs)
BUTTON    "Archive all active" · "Resolve" · "Ignore"
STEPS     1. Open Problems › Every trace. 2. Press "Archive all active" and have `resolveAllActive` return `{ ok:false }`.
EXPECTED  A plain failure reason plus Try again, and the rows go back to Active.
ACTUAL    `save.run` only treats a throw as failure, so `{ ok:false }` gets the "Saved" beat. `archiveAll` ignores the result, so the rows stay under "Resolved archive". `resolveOne` reverts silently after showing "Saved".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 · design-and-wiring §B6
SEVERITY  wrong
SOURCE    CODE

#### H-7 · Overview prints zeros and "nothing yet" copy when non-money reads fail
PAGE      /admin/app-performance   (tab: overview; also slow-loads)
BUTTON    —
STEPS     1. Open Overview. 2. The population, breakdowns, reports or load-times read fails.
EXPECTED  "—" or "Couldn't read" in each affected card.
ACTUAL    In `CockpitSurface`, `ContextTile` "Users", "Suppliers" and "Services" print `nf.format(...)` as 0, "Events by type" says "No events yet.", "Abuse reports" says "0 … open right now", and "Page loads" says "Not enough loads measured yet (0 of N needed)". Only the top banner admits the failure. The slow-loads footer also reads "0 measured" via `formatCount(data.overall.n)`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-8 · "Fastest movers" says "not enough data" for every entity row, and its footnote is false
PAGE      /admin/app-performance   (tab: overview)
BUTTON    —
STEPS     1. Open Overview › Growth › Fastest movers.
EXPECTED  An entity row is either measured, or says it is not computed.
ACTUAL    `leaders` hard-codes `pct: null` for New users, New suppliers, New services and New events, so `LeaderRow` always prints "not enough data" whatever the volume. The footnote says "Entity rows show net-new counts; their prior-window % lands with the Action Center PR", but no count is drawn and the Action Center is already live.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-9 · Operations says it is "Live" over a view that never refreshes; failed reads read as "not calculated yet"
PAGE      /admin/app-performance   (tab: operations)
BUTTON    —
STEPS     1. Open Operations & Hiring.
EXPECTED  Stale numbers are labelled stale, and a failed read says "Couldn't read".
ACTUAL    The Sec about text says "Live — refreshed when stale, each time this page opens", and Facts shows "Signups (last 7d)". But `refreshBottleneckSignalsIfStale` calls `refresh_bottleneck_signals`, which no migration creates (the matview is from 2026-05-20). If `getBottleneckSignals` errors, it returns null and the page says "These numbers haven't been calculated yet". If `getRecentAlerts` errors, it returns `[]` and the alerts section is silently hidden.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-10 · The Sentry smoke test reports success on a network failure
PAGE      /admin/app-performance   (tab: operations)
BUTTON    "Trigger Sentry test error"
STEPS     1. Press it while the fetch fails (offline, or a proxy drop).
EXPECTED  It says the test did not reach the server.
ACTUAL    smoke-test-panel.tsx `runSentryTest` has `catch (err) { setLastResult({ ok: true, ... via: 'network-error-from-throw' }) }`, so it shows "sentry test fired ✓".
SHOTS     phase B: 375 px light
RULE      design-and-wiring §B6 · CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### H-11 · Growth "Export CSV" writes 0 where a read failed
PAGE      /admin/app-performance   (tab: growth)
BUTTON    "Export CSV"
STEPS     1. Open Growth while the population or conversion read fails (the page shows "—"). 2. Press Export CSV.
EXPECTED  The CSV marks unread values, or carries an errors row.
ACTUAL    app/admin/growth/export/route.ts `toCsv` writes `p.accountHolders`, `c.rate` and the rest straight from the zero fallbacks and never writes `stats.errors`.
SHOTS     phase B: desktop
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-12 · Lead-score signals say "Website" and "Monogram"
PAGE      /admin/app-performance   (tab: intelligence)
BUTTON    —
STEPS     1. Open Intelligence › Lead scores. 2. Read the Signals column (lg and up).
EXPECTED  "Event Hub" and "Logo Maker".
ACTUAL    intelligence-surface.tsx `leadSignals` has `r.websiteConfigured ? 'Website'` and `r.monogramConfigured ? 'Monogram'`.
SHOTS     phase B: desktop
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### H-13 · The entity map says "Vendors" and "vendor" in node names and blurbs
PAGE      /admin/ugat/map
BUTTON    the Vendors node (and others)
STEPS     1. Open the Entity map. 2. Open the Vendors, Threads or Package node.
EXPECTED  "Suppliers" or "supplier".
ACTUAL    lib/ugat/graph.ts: `name: 'Vendors'`, `blurb: 'vendor orgs · free-during-launch profiles'`, `'couple ↔ vendor — answering is free'`, `'what a vendor sells …'`. These render in the node card (`ug-nm` and the status line).
SHOTS     phase B: desktop
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### H-14 · A failed brain-chunk read shows 0 counts and "No chunks authored yet" in all eight topics
PAGE      /admin/ugat   (tab: brain)
BUTTON    —
STEPS     1. Open AI brain while the `concierge_brain_chunks` read fails.
EXPECTED  "—" in the KPI cards and no empty-state copy.
ACTUAL    brain-surface.tsx does `const chunks = ((rows ?? [])`. The page passes numbers (0) to `KpiStatCard` (which would print "—" for `null`), and every topic says "No chunks authored yet — content authoring is a parallel workstream." The error banner shows underneath.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-15 · Menu edits report success when the database refuses them
PAGE      /admin/ugat   (tab: menus)
BUTTON    "Save" (rename) · icon pick · "No icon" · "Hide from menu" · "Reset to default" · "Upload"
STEPS     1. Rename a slot and press Save. 2. The upsert is refused.
EXPECTED  A failure with its reason, and no audit row.
ACTUAL    menus/actions.ts `setSlotLabel`, `setSlotLucideIcon`, `setSlotHidden`, `resetSlot` and `uploadSlotIcon` `await admin.from('nav_slot_override').upsert(...)` (or `.delete()`) without reading `error`. They still call `audit(...)`, and the editor's `save.run` shows "Saved". Hide and Reset give no feedback at all.
SHOTS     phase B: 375 px light
RULE      design-and-wiring §B6 · CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### H-16 · Comparisons don't name their period
PAGE      /admin/app-performance   (tabs: overview › Expenses, funnels)
BUTTON    —
STEPS     1. Read the delta beside "this month" under Monthly digital spend. 2. Read the Funnels "vs previous" column.
EXPECTED  Each comparison says what it compares against ("vs last month", "of previous step").
ACTUAL    charts.tsx `DeltaPct` prints "vs prev period" for a month-on-month delta. funnels-surface.tsx `header: 'vs previous'` is step-to-step conversion but reads like a period comparison.
SHOTS     phase B: desktop
RULE      brief checklist (charts name their exact period)
SEVERITY  wrong
SOURCE    CODE

#### H-17 · Two gold-filled controls on the Problems screen
PAGE      /admin/app-performance   (tab: connection-logs)
BUTTON    "Archive all active" + the selected type pill ("All")
STEPS     1. Open Problems with active faults.
EXPECTED  One accent-filled main verb per screen.
ACTUAL    connection-logs-client.tsx: the Archive button is `bg-[#A9834B] … text-white`, and the selected filter pill is `border-[#A9834B] bg-[#A9834B] text-white`, the same filled gold.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### H-18 · The fault-detail popup is hand-rolled
PAGE      /admin/app-performance   (tab: connection-logs)
BUTTON    "Inspect fault" (row)
STEPS     1. Press any trace row.
EXPECTED  The shared layer: `RiseScreen` for this long JSON detail (or `Sheet`).
ACTUAL    `InspectModal` is `<div className="fixed inset-0 z-50 …">` holding its own `role="dialog" aria-modal="true"`, with a `bg-white` panel.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### H-19 · The entity-map side card and scrim are hand-rolled
PAGE      /admin/ugat/map
BUTTON    any node, edge or finding
STEPS     1. Click a node on the map.
EXPECTED  The shared `Sheet` or `RiseScreen` (the node card is long, so a full-screen popup on a phone).
ACTUAL    ugat-console.css: `.ug-card { position: fixed; … width: 460px; transform: translateX(100%) }` plus its own `.ug-scrim`. The console renders `<aside className="ug-card…" aria-hidden={!panelOpen}>` with no shared layer or page lock.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### H-20 · The Overview Range picker is a native select with an Apply button
PAGE      /admin/app-performance   (tab: overview, also the bare address)
BUTTON    "Apply"
STEPS     1. Open Overview and look at Range.
EXPECTED  `PickMenu` via `InsightsParamPick`, as Growth, Visits and Funnels already use.
ACTUAL    1 native select with 3 options: overview-surface.tsx `<select id="range" name="range">` (GROWTH_RANGE_OPTIONS) plus `button-secondary` "Apply".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### H-21 · The loading skeleton draws a tile grid the tabs don't have
PAGE      /admin/app-performance   (tabs: growth, intelligence, seo, visits)
BUTTON    —
STEPS     1. Navigate to ?tab=growth (or intelligence, seo, visits).
EXPECTED  A skeleton of the tab's single column of hairline rows.
ACTUAL    app-performance/loading.tsx is `GridPageSkeleton` (9 bordered `h-44` tiles in 3 columns), and `tabSkeleton` falls back to it for these tabs. Since 14 Nov the tabs draw single-column rows with "no tiles (T18)".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading ("draws only what the page draws")
SEVERITY  look
SOURCE    CODE

#### H-22 · About 225 hard-coded light-only styles across the app-performance tabs
PAGE      /admin/app-performance   (all tabs)
BUTTON    —
STEPS     1. Grep the tab files.
EXPECTED  Colour tokens by job, the `text-sn-*` type scale, no spinners or pulses.
ACTUAL    64 hex, 127 `text-[Npx]`, 7 default-palette classes, 17 numbered token classes, 4 `bg-white`, 2 `rounded-[..]`, 1 `hover:shadow-md`, 3 `animate-pulse` and 1 `animate-spin`. Examples: connection-logs-client.tsx `text-[#1B1A17]` and `bg-slate-200 text-slate-800`; charts.tsx `color: '#2E4A2A'`; overview-surface.tsx `bg-warn-50 … text-[11px]` and `animate-pulse`; seo-rerun-button.tsx `animate-spin`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### H-23 · 58 hard-coded light-only styles across the Root map tabs
PAGE      /admin/ugat   (tabs: menus, onboarding, brain, screens)
BUTTON    —
STEPS     1. Grep the tab files.
EXPECTED  Tokens and the type scale only.
ACTUAL    26 `text-[Npx]`, 27 numbered token classes, 2 default-palette classes and 3 `bg-white`. Examples: brain-surface.tsx `bg-sky-100 … text-sky-800` and `bg-warn-50/80`; onboarding-surface.tsx `bg-success-50/60 … text-success-800`; menu-registry-editor.tsx `bg-white`; page.tsx tab strip `text-terracotta-700`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### H-24 · The entity map has its own light-only colour set
PAGE      /admin/ugat/map
BUTTON    —
STEPS     1. Grep ugat-console.css.
EXPECTED  House tokens, with a paired dark set.
ACTUAL    78 lines with hex and 16 with `rgba(`, and no dark variant. Examples: `--ug-ok: #3e8b59`, `--ug-e-vendor: #8a5fb0; --ug-e-vendor-bg: #f1eaf8`, `color: #fff`, `border-bottom: 1px solid #000`.
SHOTS     phase B: desktop
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group H notes**

- Not checked: the `demand` and `papic-storage` tabs of /admin/app-performance and the `search` tab of /admin/ugat. They mount other pages (/admin/demand, /admin/papic-storage, /admin/search-memory).
- Operations tab: loading it runs `runHiringAlertSweep`, which can fire alerts and send emails on a plain GET. Its ⓘ also prints the owner's personal email address.
- Unsure: on the SEO tab, "Our true answer" uses `getBookingFeeSchedule`, which falls back to a locked default rate when its read is refused, so a default could be shown as fact.
- Unsure: the Funnels "First booking thread" step reads `chat_threads` with no `.limit`, so a server row cap could undercount it without saying so.
- Not verified in a browser: `addExpense`, `attachReceipt` and `uploadSlotIcon` throw on bad input or missing R2. A `<form action>` should then land on `app/admin/error.tsx` rather than an inline message.

### Group I · Settings & system

#### I-1 · Config saves ignore a failed platform_settings write and still say "Saved." (Maya endpoint, AI paywall)
PAGE      /admin/integrations   (also /admin/switches for the paywall)
BUTTON    "Save" (Maya card, Resend card, OAuth cards) · the "Setnayan AI paywall" pick on Switches
STEPS     1. Change the Maya Checkout endpoint or the paywall mode. 2. Press Save or Confirm while the platform_settings update is refused.
EXPECTED  A failed write shows a failure, like `saveOAuthField` / `savePayersSeeMaya` already do (`?error=save_failed`).
ACTUAL    integrations/actions.ts `saveMayaConfig`, `setAiPaywall`, `saveResendConfig` and `saveOAuthConfig` all run `await admin.from('platform_settings').update(...)` and never read `error`, then redirect `?saved=1` (or `/admin/switches?saved=paywall`).
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4) · design-and-wiring B6
SEVERITY  money-signin
SOURCE    CODE

#### I-2 · "Clear saved key(s)" always reports cleared, and the message always talks about email
PAGE      /admin/integrations
BUTTON    "Clear saved keys" (Maya) · "Clear saved secret" (OAuth) · "Clear saved key" (Resend, OpenAI)
STEPS     1. Press Clear on the Maya card. 2. The clear fails, or it succeeds.
EXPECTED  A failure says so. On success the notice names the integration that was cleared.
ACTUAL    `clearMayaSecrets`, `clearOAuthSecret`, `clearIntegrationSecret` and `clearResendKey` drop the `SecretWriteResult` from `clearIntegrationSecretColumns` and always redirect `?cleared=1`. page.tsx then renders "Key cleared — email now falls back to the Vercel env (if set)." for every card, including the Maya payment keys.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  money-signin
SOURCE    CODE

#### I-3 · A failed settings read prints a VAT of 0, a 1970 "Last updated" and the default brand icon as facts, and leaves the loader Save armed
PAGE      /admin/business
BUTTON    "Save loading animation" · "Upload brand icon"
STEPS     1. Open /admin/business while the platform_settings read is refused.
EXPECTED  Every field says "Couldn't read" and every save is off, as the banner promises ("Saving is off until they load").
ACTUAL    `fetchPlatformSettingsMeasured` returns FALLBACK, and the page still shows "Default VAT rate (%)" 0, `Last updated ${new Date(settings.updated_at)…}` (epoch) and "Using the default gold Setnayan mark." `getLoaderSettings()` falls back to `DEFAULT_LOADER_CONFIG` on its own failed read, and `LoaderAppearanceCard` still posts `saveLoaderAppearance` with those defaults.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  money-signin
SOURCE    CODE

#### I-4 · Referral reward formatted by hand with "₱" + toLocaleString
PAGE      /admin/switches
BUTTON    — (the "Referral program" row line)
STEPS     1. Open /admin/switches and read the Referral program row.
EXPECTED  The amount is formatted through lib/php.ts `formatPhp`.
ACTUAL    switches/page.tsx: `` `₱${s.referral_reward_php.toLocaleString('en-PH')}` ``.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (lib/php.ts only)
SEVERITY  money-signin
SOURCE    CODE

#### I-5 · Partnership fees formatted by hand, and a peso amount typed into a placeholder
PAGE      /admin/vendor-partnerships
BUTTON    — (Open proposals line, the Fee / Discount column, the "Additional fee (centavos)" field)
STEPS     1. Open the page and read a proposal's fee or the fee input.
EXPECTED  Fees go through `formatPhp`, and no peso amount is typed in copy.
ACTUAL    page.tsx `formatFee`: `` `₱${(cents / 100).toLocaleString('en-PH')}` ``, `'₱0'`, `'Included (₱0)'`. The placeholder reads "e.g. 100000 = ₱1,000 · leave blank = unknown".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · brand.md claim 1
SEVERITY  money-signin
SOURCE    CODE

#### I-6 · The owner's numbers lost their only editor in the Settings → Business move
PAGE      /admin/business   (/admin/settings forwards here)
BUTTON    —
STEPS     1. Open /admin/settings. 2. Look for "Deep Search searches" per month, the trust step, the real-guests minimum and the Today numbers.
EXPECTED  They stay editable: `saveBusinessIdentity` still writes them when posted (`formData.has('deep_search_runs_per_month')`, `trust_search_step`, `proof_real_guests_min`, `grow_few_inquiries_28d`, `today_soon_ask_hours`…).
ACTUAL    Only settings/_surfaces/settings-surface.tsx (`SettingsSurface`) renders those inputs, and only tests import it. `BusinessIdentityForm` posts none of them, so no page can change them, although the page doc says "nothing dropped".
SHOTS     phase B: 375 px light
RULE      design-and-wiring A4 (every way in moves with it) · B5
SEVERITY  broken
SOURCE    CODE

#### I-7 · Recommendation map and supplier-flag queue show 0 and "nothing pending" when the reads fail
PAGE      /admin/vendor-recommendations
BUTTON    —
STEPS     1. Open the page while `vendor_service_recommendations` or `vendor_recommendation_feedback` is refused.
EXPECTED  "Couldn't read", never zero or empty.
ACTUAL    Errors are only logged (`logQueryError('AdminVendorRecommendations (map)'…)`), then `recRes.data ?? []` and `feedbackRes.data ?? []` feed TemplateNums ("Total recs 0", "Pending flags 0") and "No recommendations yet — add one below." / "No pending flags." The leaf/SKU pickers and the name lookups (`const { data: vendors }`, `const { data: extra }`) fail silently too.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### I-8 · Open proposals header says "(0)" and "No proposals awaiting" on a failed read
PAGE      /admin/vendor-partnerships
BUTTON    — (the Open proposals heading and its ⓘ)
STEPS     1. Open the page while the proposals read is refused.
EXPECTED  The heading says "not measured", as the Live partnerships heading does.
ACTUAL    page.tsx: `right={`(${proposed.length})`}` and tip `'No proposals awaiting a recipient response.'` both come from `proposedRowsRaw ?? []`, so they claim zero above the ErrorState "Couldn't read the open proposals".
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### I-9 · Error notice says "vendor"
PAGE      /admin/vendor-partnerships
BUTTON    "Propose partnership (lands in supplier inbox)"
STEPS     1. Pick the same shop as Recommending and Recommended. 2. Press Propose.
EXPECTED  "A supplier cannot partner with themselves."
ACTUAL    actions.ts `createPartnershipHq`: `?error=A+vendor+cannot+partner+with+themselves.`, shown through `FormFlash`.
SHOTS     phase B: 375 px light
RULE      brand.md Word rules (supplier, never vendor)
SEVERITY  wrong
SOURCE    CODE

#### I-10 · Sample switch states "Default — off" as fact while the default follows an env flag
PAGE      /admin/switches
BUTTON    "The sample at /sample" pick
STEPS     1. Leave sample_event_enabled NULL with SAMPLE_EVENT_ENABLED on. 2. Open Switches.
EXPECTED  The default row says what the env says, as the AI paywall row does ("env says ON/OFF").
ACTUAL    settings/_components/sample-event-switch.tsx `OPTIONS`: `{ key: 'default', label: 'Default — off' }`, but lib/sample-event/switch.server.ts resolves NULL from `envFlagEnabled(process.env.SAMPLE_EVENT_ENABLED)`.
SHOTS     phase B: 375 px light
RULE      Honest states (default stated as fact)
SEVERITY  wrong
SOURCE    CODE

#### I-11 · Demo-mode row is labelled "View /vendors"
PAGE      /admin/switches   (#demo-mode)
BUTTON    "View /vendors (demo suppliers visible)" / "View /vendors (without demo)"
STEPS     1. Open Switches › Admins and read the demo rows.
EXPECTED  Supplier wording, naming the real destination (the marketplace on Discover).
ACTUAL    settings/_surfaces/demo-mode-surface.tsx: `` title={`View /vendors ${isOn ? …}`} `` with `href="/?browse=1"`. There is no app/vendors/page.tsx.
SHOTS     phase B: 375 px light
RULE      brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### I-12 · Admin radar copy promises a floor control that does not exist
PAGE      /admin/demand
BUTTON    — (the ⓘ on "Not enough demand data yet")
STEPS     1. Open /admin/demand with no cell above the floor.
EXPECTED  The copy matches the page: no control writes radar_min_n_floor.
ACTUAL    vendor-dashboard/demand/_components/demand-radar-card.tsx (admin branch): "You can lower the floor in platform settings…". The page's own row says "no control in the app writes it today".
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5 (no promise of a control that isn't there)
SEVERITY  wrong
SOURCE    CODE

#### I-13 · Five filled buttons on one screen
PAGE      /admin/business
BUTTON    "Save business identity" · "Upload brand icon" · "Save loading animation" · "Fire Sentry smoke test (admin only)" · "Save compliance facts"
STEPS     1. Open /admin/business and scroll.
EXPECTED  At most one main (filled) button per screen.
ACTUAL    `ActionButton … main` (business-identity-form.tsx), `bg-mulberry` (brand-icon-form.tsx), `button-primary` (loader-appearance-card.tsx), `bg-ink … text-cream` (sentry-smoke-test-button.tsx), `tone="brand" main` (compliance-form.tsx).
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### I-14 · Two filled Saves in one card (Google Drive)
PAGE      /admin/integrations
BUTTON    "Save" + "Save this key"
STEPS     1. Open the Google Drive OAuth card (it has an `ownForm` field).
EXPECTED  One filled button per card.
ACTUAL    oauth-card.tsx: both SubmitButtons are `bg-mulberry … text-cream`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### I-15 · Row "Save" buttons share the main button's colour
PAGE      /admin/vendor-recommendations
BUTTON    "Add recommendation" (brand, filled) + every map row's "Save" (brand, outlined)
STEPS     1. Open the page with map rows.
EXPECTED  Secondary buttons do not wear the main button's colour.
ACTUAL    _editor.tsx `RecommendationRow`: `actionButtonClass('brand')`. `AddRecommendation`: `actionButtonClass('brand', { main: true })`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### I-16 · Native select for the 3-way paywall choice
PAGE      /admin/integrations
BUTTON    "Paywall" select (Use environment default · On · Off)
STEPS     1. Open the Setnayan AI paywall card.
EXPECTED  PickMenu (Switches already draws this choice with `ConfirmPick`).
ACTUAL    1 native `<select name="mode">` with 3 options in integrations/page.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### I-17 · Hard-coded palette, sizes and white (integrations)
PAGE      /admin/integrations
BUTTON    —
STEPS     1. Switch to dark once admin is on DARK_READY.
EXPECTED  Tokens by job only.
ACTUAL    ≈58 lines. page.tsx `bg-emerald-50 … text-emerald-900`, `bg-rose-50 … text-rose-900`, `bg-white px-3 py-2`. known-hash-card.tsx `bg-amber-200/80 text-amber-950`. secret-card / oauth-card / maya-card `bg-emerald-100 text-emerald-900`, `text-[10px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### I-18 · Hard-coded palette, sizes and white (business)
PAGE      /admin/business
BUTTON    —
STEPS     1. As I-17.
EXPECTED  Tokens by job only.
ACTUAL    ≈24 lines. page.tsx `bg-white px-2` (tab icon preview), `text-[14px]`. compliance-form.tsx `border-amber-200/70 bg-amber-50/60 text-amber-900/90`, INPUT `bg-white`, `text-rose-800`. brand-icon-form.tsx `bg-white px-2 shadow-sm`, and a class that does not exist: `file:text-terracotta-700-700`. loader-appearance-card.tsx `bg-white`, `text-[10px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### I-19 · Hard-coded palette and half-pixel sizes (email delivery)
PAGE      /admin/email-delivery
BUTTON    —
STEPS     1. As I-17.
EXPECTED  Tokens and the text-sn scale.
ACTUAL    ≈23 lines. email-delivery-section.tsx TONE `bg-emerald-50 text-emerald-800`, `bg-amber-50 text-amber-800`, `text-[11.5px]` (half pixel), `mt-[18px]`. morning-digest-card.tsx `text-[11.5px]`. notifications-surface.tsx `text-[12px]`. test-resend-button.tsx `text-emerald-800`, `text-rose-700`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### I-20 · Typed and half-pixel sizes (demand)
PAGE      /admin/demand
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    page.tsx `text-[15px] font-semibold` ×2. The shared demand-radar-card.tsx draws `text-[11.5px]` ×4 (half pixel), `text-[24px]`, `text-[13px]` ×~9, `text-[12px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### I-21 · Typed sizes (data privacy)
PAGE      /admin/data-privacy
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    11 × `text-[Npx]`. page.tsx `text-[13px] text-ink/60`, `text-[15px] font-semibold leading-tight`. control-actions.tsx `text-[15px] font-medium`. task-actions.tsx `text-[13px] text-[var(--sn-danger)]`. coverage-panel.tsx `text-[13px] text-[var(--sn-success-deep)]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### I-22 · Typed sizes (supplier recommendations)
PAGE      /admin/vendor-recommendations
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    ≈8 lines. _editor.tsx `labelCls` `text-[13px]`, `text-[12px] text-ink/50`. page.tsx `text-[15px] font-semibold`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### I-23 · Typed sizes (NPC data sheet)
PAGE      /admin/compliance/data-sheet
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    3 × `text-[11px]`: `SEC_HEAD`, the "Holds a Setnayan account" line, the `[TO CONFIRM]` retention note.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

**Group I notes**

- /admin/secrets was not checked. Read and Grep on apps/web/app/admin/secrets/ are refused by this session's permission settings, so its serialisation into client components and its write gates still need a checker who can open it. The `?view=secrets` mount inside /admin/business is the same file.
- /admin/demand `after()`: `maybeRefreshDemandRadar` runs a service-role `refresh_demand_radar_rollups` from a page with no gate of its own. It is throttled to once an hour, rebuilds the same data each time, and the supplier `one-analytics-section.tsx` already fires it, so I did not report it. "Run now" (`runDemandRadarRefresh`) checks admin before any service-role call.
- Server-side admin checks verified: `/api/admin/demo-mode/toggle` (`isAdminProfile` → 403), `/api/admin/sentry-smoke-test` (403), `/api/admin/smoke-test` (404), `/admin/data-privacy/documents/[doc]` (404). /admin/integrations and /admin/email-delivery pass only booleans and non-secret config to the page. No ciphertext or env secret reaches the browser.
- Cosmetic: `TestResendButton` reads `body.id`, but `/api/admin/smoke-test` returns `messageId`, so "Sent — message id …" never shows.
- `ConfirmDialog`, the house confirm behind `ConfirmButton` and `ConfirmForm`, is a portalled native `<dialog>`, not `Sheet`. That is area-wide, so I did not report it per page.
