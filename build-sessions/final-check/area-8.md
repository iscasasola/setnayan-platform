# Final check · Area 8 · Admin (/admin/* and the internal pages)

> CHECKER 8 of 8. Report only, never a fix. Check commit: main @ fb3f72d (frozen). Phase A = code pass (SOURCE: CODE).
> Phase B (browser walk on staging) waits for the controller's address. Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6.
> Marks per page: OFFLINE = NEEDED / READ-ONLY IS ENOUGH / NOT NEEDED · SHAPE = what it is TODAY → what it SHOULD be (PAGE / FULL-SCREEN POPUP / SMALL POPUP).

## BLOCKERS

None found.

## Progress

### Pages (71)

- [ ] /admin
- [x] /admin/account-deletions · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/accounts · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: users, vendors, events, venues, demo-vendors
- [ ] /admin/admin-log
- [x] /admin/app-performance · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: overview (default + bare-address landing), connection-logs, funnels, growth, intelligence, offline, operations, seo, visits, interconnections, browser-blocks, slow-loads
- [ ] /admin/approvals
- [ ] /admin/ask
- [x] /admin/background-videos · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/booking-fees
- [x] /admin/budget-planner · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/business · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · views checked: own (identity, brand icon, loader, Sentry, compliance), privacy, data-sheet, integrations (secrets view not readable, see NOTES)
- [x] /admin/catalogue · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/categories · OFFLINE: NOT NEEDED · SHAPE: today PAGE (map + full-screen Sheet drawer) → should PAGE
- [x] /admin/categories/requests · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/chat-flags · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=chat-flags) → should PAGE
- [x] /admin/colours · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/switches?view=colours; preview inline, sticky save bar, no overlay) → should PAGE
- [x] /admin/completions · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/compliance/data-sheet · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/concierge-abuse · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=ai-abuse) → should PAGE · tabs checked: queue, enforcement
- [x] /admin/corrections · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=corrections; inline address form + confirm popups) → should PAGE
- [x] /admin/data-privacy · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: controls, coverage, deletions, checklist, documents (+ documents/[doc] route)
- [x] /admin/demand · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/demo-vendors/inquiries · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/directory · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/discount-codes/new
- [x] /admin/disputes · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/editorial-review · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=editorial) + record PAGE /admin/editorial-review/[editorialId] → should PAGE + record PAGE
- [x] /admin/email-delivery · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/event-deletions · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/force-majeure · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (the [flagId] record: PAGE → PAGE)
- [ ] /admin/founder-seats
- [x] /admin/fraud · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/gifts · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/offers?view=gifts; grant forms inline by ?grant_vendor= / ?grant_user=) → should PAGE
- [ ] /admin/help
- [ ] /admin/help/guides
- [x] /admin/hub-music · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (one sub-surface finding below)
- [x] /admin/integrations · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/integrity-watch · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=integrity) → should PAGE · tabs checked: reviews, listings, inquiries, prices
- [ ] /admin/launch-offer
- [x] /admin/live-studio-channels · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/switches?view=live-watch) → should PAGE
- [ ] /admin/money
- [ ] /admin/more
- [ ] /admin/offers
- [x] /admin/pakanta · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/papic-storage · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/app-performance?tab=papic-storage) → should PAGE
- [x] /admin/pax-changes · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [ ] /admin/payment-options
- [ ] /admin/payments
- [ ] /admin/payments/supplier-refunds
- [ ] /admin/payouts
- [x] /admin/pricing · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: pricing, setnayan-ai, papic-shots, price-bands, free-windows, plan-contents
- [ ] /admin/receipts
- [x] /admin/repost-watch · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=repost) → should PAGE
- [x] /admin/reviews · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=reviews) → should PAGE
- [ ] /admin/search-memory
- [ ] /admin/secrets · NOT CHECKED: this session's permission settings refuse every read of `apps/web/app/admin/secrets/` (lead and checker both tried); needs a session that may open it
- [ ] /admin/settings/payment-methods
- [x] /admin/studio · OFFLINE: NOT NEEDED · SHAPE: today PAGE (tab host, `?tab=`) → should PAGE · tabs checked: website, reveal-studio, real-stories, storytellers, recaps, patiktok, songs, moodboard-library, social-queue, journal-spotlights, spotlight-awards (forwards to /admin/offers?view=badges, which renders the same `SpotlightAwardsSurface`), discount-codes and referrals (forward to /admin/offers?view=…, which renders the same studio surfaces; links to discount-codes/new and discount-codes/[id]/edit resolve), plus the views it mounts: background-videos, website-media, hub-music
- [ ] /admin/subscriptions
- [x] /admin/switches · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · incl. #demo-mode and the /api/admin/demo-mode/toggle route
- [x] /admin/team · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/ugat · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: menus (default), onboarding, brain, screens
- [x] /admin/ugat/map · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/user-reports · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=user-reports) → should PAGE
- [x] /admin/vendor-partnerships · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/vendor-recommendations · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/venues/new · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should FULL-SCREEN POPUP
- [x] /admin/verification-docs · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/verify · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: applications (pending_review, in_review, approved, auto, rejected, demoted, all), visibility (hidden, verified, archived, all), ?shop=
- [x] /admin/website-media · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
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

#### L-7 · The house confirm is a native dialog with its own scrim
PAGE      every /admin page that confirms (`ConfirmForm`, `ConfirmButton`, `useConfirm()`; shared with other areas)
BUTTON    any confirm, e.g. "Delete account", "Delete ‹category›"
STEPS     1. Press a control that asks "Are you sure?".
EXPECTED  The shared `Sheet` with the ONE shared backdrop token (dim + blur), opening at half on a phone (HOUSE_DESIGN_STANDARD K3.1: "No page builds its own scrim").
ACTUAL    `app/_components/confirm-dialog.tsx` `ConfirmDialog` is a portalled `<dialog>` opened with `showModal()`, with its own scrim `backdrop:bg-black/50 backdrop:backdrop-blur-sm` and a hand-written `shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)]`. It dims and blurs, but not with the shared backdrop, and it is the layer that ends up on top of a Sheet (D-28, B-20). Three checkers found it independently.
SHOTS     phase B: 375 px light, a confirm opened from a list and from inside a sheet
RULE      HOUSE_DESIGN_STANDARD Part K3 · D2 (Sheet is the one floating surface)
SEVERITY  look
SOURCE    CODE

#### L-8 · "Catalogue · Escalated" is never enforced
PAGE      /admin/categories (and every catalogue write)
BUTTON    "Delete ‹category›" · "Combine" · hide for everyone · retire
STEPS     1. Sign in as an admin whose Team grid gives Catalogue = Basic only. 2. Delete, combine or hide a category or service.
EXPECTED  `lib/admin/areas.ts` `ADMIN_AREA_LIST` row `catalogue`: Escalated = "hide for everyone · combine · retire", so these presses are refused without it.
ACTUAL    No `requireAdminCan('catalogue', …)` exists anywhere in `apps/web`; the categories actions check only "is admin" (`requireAdmin`/`requireAdminAction`). Same family as B-2 (prices), D-1 and D-3 (deletions), D-4 (plans): the area grid on /admin/team promises limits the server does not hold.
SHOTS     phase B: n/a (server-side)
RULE      Admin areas × levels (DECISION_LOG 2026-11-13) · task check 2
SEVERITY  money-signin
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

### Group D · Accounts & people

#### D-1 · Approving a deletion marks it "approved" before any area, self or internal check runs
PAGE      /admin/account-deletions
BUTTON    "Approve + delete" · "Approve + blacklist" · "Reject (keep account)"
STEPS     1. Sign in as an admin with no Deletions area. 2. Approve a pending request, or Reject one.
EXPECTED  Deletions · Escalated ("approve a deletion", `lib/admin/areas.ts`) is checked before anything is written.
ACTUAL    `approveRequest` (account-deletions/actions.ts) checks only "is admin", then writes `status: 'approved'`. Only after that do `deleteUser`/`blacklistUser` run `requireAdminCan` and the internal and self guards. If any of them refuses, the request reads "approved" and the account stays open. It can no longer be rejected, because `loadPendingRequest` expects `pending`. `rejectRequest` has no area check at all.
SHOTS     phase B: — (server-side)
RULE      Admin areas × levels (DECISION_LOG 2026-11-13) · gate first
SEVERITY  money-signin
SOURCE    CODE

#### D-2 · The internal-account guard on erasure lets the erase run when its read fails
PAGE      /admin/account-deletions   (same action behind /admin/accounts tab: users "Delete account")
BUTTON    "Approve + delete" · "Run erasure again"
STEPS     1. Approve a request for an internal (§ 10a) account while the `users` read is refused.
EXPECTED  An unread target refuses the erase.
ACTUAL    users/actions.ts `deleteUser` reads with `const { data: target } = await admin.from('users').select('is_internal')…` and drops the error. `if (target?.is_internal)` passes when `target` is null, so `eraseUserAccount` runs, and lib/erasure/purge.ts has no internal check. This page still offers both approve buttons on internal rows.
SHOTS     phase B: — (server-side)
RULE      Honest states (CLAUDE.md §5.4) · admin access
SEVERITY  money-signin
SOURCE    CODE

#### D-3 · Removing an event never checks Deletions · Escalated
PAGE      /admin/event-deletions   (and /admin/accounts tab: events)
BUTTON    "Remove it for good" · "Keep it, and tell them why" · tab events "Delete"
STEPS     1. Sign in as an admin with no areas. 2. Remove a money-held event, or press Delete on the Events tab.
EXPECTED  "remove an event" is Deletions · Escalated (`ADMIN_AREA_LIST`), so it should be refused.
ACTUAL    `approveEventDeletion`, `rejectEventDeletion` (event-deletions/actions.ts) and `deleteEvent` (events/actions.ts) each call only a local "is admin" `requireAdmin`. None of these files contains `requireAdminCan`.
SHOTS     phase B: — (server-side)
RULE      Admin areas × levels (DECISION_LOG 2026-11-13)
SEVERITY  money-signin
SOURCE    CODE

#### D-4 · The supplier invite gives a free paid plan without the Plans or Gifts gate
PAGE      /admin/accounts   (tab: vendors)
BUTTON    "Create invite link" (with "Plan they get for free" = Plus/Pro/Ultra)
STEPS     1. Admin with no Plans or Gifts area. 2. Invite a supplier with Pro free until a date up to a year away.
EXPECTED  The same gate as `setVendorTier` (`requireAdminCan('plans','escalated')`) or `issueVendorSkuComp` (gifts_comps).
ACTUAL    `createAdminVendorInvite` (vendors/actions.ts) checks only "is admin". It writes `offer_tier`/`offer_until`, which the claim applies as `tier_source = 'admin_comp'`.
SHOTS     phase B: — (server-side)
RULE      Admin areas × levels · money
SEVERITY  money-signin
SOURCE    CODE

#### D-5 · A failed cancel of unpaid bills is swallowed and the event is removed anyway
PAGE      /admin/event-deletions
BUTTON    "Remove it for good"
STEPS     1. Remove an event while the `orders` update is refused.
EXPECTED  Stop with a failure. Otherwise unpaid bills outlive the event.
ACTUAL    `approveEventDeletion` only logs `strandErr` (`console.error('[event-deletions] could not cancel unpaid bills'`) and goes on to delete. `orders.event_id` is SET NULL, so the stranded-bill case the comment warns about happens silently. The `status: 'approved'` update is also unchecked.
SHOTS     phase B: — (server-side)
RULE      Honest states · money
SEVERITY  money-signin
SOURCE    CODE

#### D-6 · Comp-grant service picker shows a failed catalog read as "No catalog SKUs found."
PAGE      /admin/accounts   (tab: users, comp grants panel; also tab: vendors)
BUTTON    "Comp grants" → "Issue comp grant"
STEPS     1. Open Comp grants while a catalog read is refused.
EXPECTED  "Couldn't read" (the `services === null` path).
ACTUAL    `fetchV2CustomerCatalog`, `fetchV2BundleCatalog` and `fetchV2VendorCatalog` (lib/v2-catalog.ts) return `[]` on error and never throw, so users-surface `catch { compGrantServices = null }` never fires. A whole category drops out, or the panel says "No catalog SKUs found." The vendors tab has the same problem: `readPersonalInvitePlanPrices` lists plans with no price.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4) · prices from the catalog
SEVERITY  money-signin
SOURCE    CODE

#### D-7 · Peso amounts formatted by hand, and a typed peso example, on the comp-grant form
PAGE      /admin/accounts   (tab: users)
BUTTON    "Issue comp grant"
STEPS     1. Open Comp grants. 2. Read the SKU prices, the value hint, the success banner and the grant cards.
EXPECTED  `formatPhp` / `formatPhpRounded`. No peso number typed into copy.
ACTUAL    users-surface has `₱{(s.price_centavos / 100).toLocaleString()}`, `₱{formatCount(COMP_GRANT_CO_REVIEW_PESOS)}` and `placeholder="2499"`. users/actions.ts banner: `₱${COMP_GRANT_CO_REVIEW_PESOS.toLocaleString('en-PH')}`. `formatRetailValueCentavos` (lib/comp-grants.ts) is hand-rolled. The threshold itself is code (`COMP_GRANT_CO_REVIEW_PESOS = 10_000`).
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 money · lib/php.ts
SEVERITY  money-signin
SOURCE    CODE

#### D-8 · A comma in the Users or Venues search breaks the read and shows "Couldn't read"
PAGE      /admin/accounts   (tab: users, venues)
BUTTON    Search box (Enter) · "Apply filters"
STEPS     1. Users: search `Cruz, Ana`. 2. Venues: search `Marriott, Manila` (the placeholder suggests commas).
EXPECTED  Results. The Events tab already sanitises this (`eventWordFilters`, F-W2-37).
ACTUAL    Raw `q` is put straight into PostgREST `.or()`. users-surface: `` `email.ilike.%${q}%,display_name…` ``. venues-surface: `` `name.ilike.%${q}%,slug.ilike.%${q}%` ``. The comma splits the filter, PostgREST errors, and the tab shows its read failure.
SHOTS     phase B: 375 px light
RULE      Every control does something real (design-and-wiring B5)
SEVERITY  broken
SOURCE    CODE

#### D-9 · "Keep it" can fail to record yet still notifies the couple
PAGE      /admin/event-deletions
BUTTON    "Keep it, and tell them why"
STEPS     1. Reject while the `event_deletion_requests` update is refused.
EXPECTED  A failure is shown and nothing is sent.
ACTUAL    `rejectEventDeletion` runs `await createAdminClient().from('event_deletion_requests').update(…)` with no error check, then calls `emitNotification`. The row stays pending, the couple gets a reply that was never recorded, and the admin sees nothing.
SHOTS     phase B: 375 px light
RULE      A failure must render as a failure (design-and-wiring B6)
SEVERITY  broken
SOURCE    CODE

#### D-10 · The face-tagging switch on the Events tab never says whether it worked
PAGE      /admin/accounts   (tab: events)
BUTTON    "On" / "Auto" / "Off" (Face tagging column)
STEPS     1. Toggle face tagging on a row. The write is refused or does not land.
EXPECTED  "The database refused the face-tagging change", as `/admin/events/[eventId]` shows.
ACTUAL    `setEventFaceMode` redirects to `/admin/accounts?tab=events&error=face_mode_failed` (or `saved=face_mode_on`). accounts/page.tsx never passes `error`/`saved` to `EventsSurface`, so both outcomes are silent.
SHOTS     phase B: 375 px light
RULE      Honest states · Toast rule (CLAUDE.md §3)
SEVERITY  wrong
SOURCE    CODE

#### D-11 · Rollups are silently cut at 1,000 rows on the Events and Demo tabs
PAGE      /admin/accounts   (tab: events, demo-vendors)
BUTTON    —
STEPS     1. Events tab with 200 events whose guests total more than 1,000. 2. Demo tab with more than 1,000 demo shops.
EXPECTED  Paged reads, or a disclosure when a read is capped.
ACTUAL    events-surface reads `guests` and `event_std_views` (one row per day) with `.in('event_id', eventIds)` and no paging, so Guests and STD views undercount while reading as measured. demo-vendors-surface asks for `.limit(BATCH_SCAN_LIMIT)` (2000) and 5000, but the 1,000-row ceiling (noted in lib/vendor-earnings.ts) caps them first. Per-folder, per-city and Empty-categories shrink, and the "floors" note (`>= BATCH_SCAN_LIMIT`) never fires.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### D-12 · The Delete and Blacklist confirms promise a hard-delete cascade that no longer happens
PAGE      /admin/accounts   (tab: users)
BUTTON    "Delete account" · "Delete and block this email"
STEPS     1. ⋯ on a person → Delete account. 2. Read the confirm.
EXPECTED  The true erasure words, like account-deletions' `ERASURE_WORDS` ("Orders and payments are kept…").
ACTUAL    The confirm says "Hard-delete … Their auth identity is gone; all related data cascade-deletes" and "The user is hard-deleted". `deleteUser` only anonymises through `eraseUserAccount` ("no auth.users DELETE is issued").
SHOTS     phase B: 375 px light
RULE      Words must be true (brand.md)
SEVERITY  wrong
SOURCE    CODE

#### D-13 · The Demo tab contradicts itself and points to retired addresses
PAGE      /admin/accounts   (tab: demo-vendors)
BUTTON    "/explore?demo=1"
STEPS     1. Open the Demo suppliers tab and read the warning, then "View as a couple".
EXPECTED  One true statement, and links whose labels match where they go.
ACTUAL    The warning says "Demo shops are public … marked (DEMO ONLY)". The next section says "hidden from the public marketplace by default. Append ?demo=1 to any /vendors URL", but `/vendors` now forwards to `/for-suppliers` (next.config.ts). The button is labelled "/explore?demo=1" but its href is `/?browse=1&demo=1`. A footer still reads "PR 1 (this PR) …".
SHOTS     phase B: 375 px light
RULE      Words must be true · no dev text
SEVERITY  wrong
SOURCE    CODE

#### D-14 · Team "Add" and "Save" give no sign anything happened, and a second press opens another request
PAGE      /admin/team
BUTTON    "Add" · "Save" · "Take all away"
STEPS     1. Add an admin. The two-admin request opens. 2. The screen is unchanged and the fields keep their text. 3. Press Add again.
EXPECTED  "Waiting on a second admin in Approvals", and one pending request per person, as `requestTeamMemberGrant` does.
ACTUAL    `addAdminOp`, `saveAdminAreasOp` and `takeAllAreasAwayOp` (team-ops.server.ts) only `revalidatePath`, with no flag or banner. `addAdminOp` and `raiseEscalatedRequest` insert without a pending check, and no unique index on `admin_approval_requests` stops the duplicate.
SHOTS     phase B: 375 px light
RULE      Success is a small toast (CLAUDE.md §3) · design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### D-15 · A failed owner check shows the owner as an ordinary admin with "No areas yet"
PAGE      /admin/team
BUTTON    —
STEPS     1. Load Team while the `is_platform_owner` RPC is refused.
EXPECTED  "Couldn't check the owner", never an unlocked row.
ACTUAL    `readIsPlatformOwner` returns `null` on error. The page only adds ids `=== true` to `ownerIds`, so the owner's row loses "🔒 Owner · everything" and shows the editable grid, and the summary falls to "No areas yet — can open /admin and do nothing". The server refuses a save, so only the display is wrong.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### D-16 · Deletion queue prints "vendor" as the account kind
PAGE      /admin/account-deletions
BUTTON    —
STEPS     1. A supplier files a deletion request. 2. Read the pending card line.
EXPECTED  "Supplier".
ACTUAL    page.tsx `u?.account_type === 'customer' ? 'Couple' : (u?.account_type ?? 'unknown')` prints the raw `vendor` (and `admin`, `unknown`).
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### D-17 · Banned words in placeholders on the Accounts tabs
PAGE      /admin/accounts   (tab: vendors, users)
BUTTON    —
STEPS     1. Vendors: read the invite's Supplier email field. 2. Users: read the comp-grant Rationale field.
EXPECTED  No "vendor", no "Monogram" (say Logo Maker).
ACTUAL    invite-vendor-form.tsx `placeholder="hello@vendorbusiness.ph"`. users-surface rationale `placeholder="… gifting Animated Monogram as remediation."`.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### D-18 · Two filled main buttons on one screen in three Accounts tabs
PAGE      /admin/accounts   (tab: venues, vendors, demo-vendors)
BUTTON    "Add venue" + "Apply filters" · "Create invite link" + "Download the card" · "/explore?demo=1" + "Create demo suppliers"
STEPS     1. Open each tab (vendors: after an invite succeeds).
EXPECTED  One accent-filled main per scope.
ACTUAL    venues-surface: masthead link `bg-mulberry` and `button-primary`. invite-vendor-form: `button-primary` and `ActionButton … main` in the same card. demo-vendors-surface: `bg-ink … text-cream` link and `DemoVendorActions` `tone="brand" main`.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### D-19 · Filled danger outside a confirm, with a second danger button beside it
PAGE      /admin/account-deletions
BUTTON    "Approve + delete" + "Approve + blacklist"
STEPS     1. Open a pending request card.
EXPECTED  A filled danger only as the single action of a confirm sheet, and no second button in the main's colour.
ACTUAL    `actionButtonClass('danger', { main: true })` on the card, next to `actionButtonClass('danger')` (outlined in the same danger colour).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### D-20 · Filled danger button on the queue card, outside a confirm sheet
PAGE      /admin/event-deletions
BUTTON    "Remove it for good"
STEPS     1. Open a pending removal.
EXPECTED  A filled danger only as the single action of a confirm sheet.
ACTUAL    page.tsx `className={actionButtonClass('danger', { main: true })}` sits inline on the card.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### D-21 · Hard-coded light-only colours and typed sizes across the Accounts tabs (67)
PAGE      /admin/accounts
BUTTON    —
STEPS     1. Grep the surfaces, `person-more.tsx`, `invite-vendor-form.tsx` and `demo-vendor-actions.tsx`.
EXPECTED  Colour and type tokens only.
ACTUAL    67 hits. Examples: `bg-sky-100 text-sky-800` ("Team & roles", vendors-surface); `bg-white/70` (users-surface grants panel); `border-red-200 bg-red-50 text-red-900` (demo-vendor-actions); half-pixel `text-[11.5px]` and `style={{ color: 'rgb(var(--color-danger))' }}` (users-surface); `text-[9px]` (venues-surface).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-22 · Typed pixel sizes on the venue form (12)
PAGE      /admin/venues/new
BUTTON    —
STEPS     1. Open the form.
EXPECTED  The `text-sn-*` scale.
ACTUAL    venue-form.tsx uses `text-[10px]` 12 times, for example the labels "Slug *" and "Venue type *" and the hints "Decimal degrees. PH range…".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-23 · Typed pixel sizes on the event-removals queue (8)
PAGE      /admin/event-deletions
BUTTON    —
STEPS     1. Open the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    page.tsx has 8 hits: `text-[13px]` ("Asked …", "What you did about the money", "Why people left" lines) and `text-[12px]` ("Removing destroys its photos…").
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-24 · Typed pixel sizes on the account-deletions queue (4)
PAGE      /admin/account-deletions
BUTTON    —
STEPS     1. Open the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    page.tsx has `text-[12px]` (request id, Status pill) and `labelClassName="text-[13px] …"` (internal-account InfoTip).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-25 · Typed pixel size on the demo inquiries Status pill (1)
PAGE      /admin/demo-vendors/inquiries
BUTTON    —
STEPS     1. Open the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    page.tsx Status pill: `rounded-full px-2.5 py-0.5 text-[12px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-26 · Native selects with 3 or more options on the Accounts tabs (2)
PAGE      /admin/accounts   (tab: vendors, venues)
BUTTON    Status · "Filter by type"
STEPS     1. Open either filter.
EXPECTED  `PickMenu`.
ACTUAL    vendors-surface `<select name="status">` (All, Published, Draft, Renewals). venues-surface `<select name="type">` (17 options).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### D-27 · Native select for venue type on the create form
PAGE      /admin/venues/new
BUTTON    "Venue type *"
STEPS     1. Open the type field.
EXPECTED  `PickMenu`.
ACTUAL    venue-form.tsx `<select name="venue_type">` over `VENUE_TYPES` (16 options).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### D-28 · A confirm dialog opens on top of the ⋯ sheet
PAGE      /admin/accounts   (tab: users)
BUTTON    "Sign out everywhere" · "Delete account" · "Delete and block this email"
STEPS     1. ⋯ on a person (Sheet). 2. Press a danger row.
EXPECTED  Never a popup on top of a popup.
ACTUAL    `PersonMore` renders a `Sheet`, and its children are `ConfirmForm`s whose `ConfirmDialog` (`<dialog>`) opens over the open sheet.
SHOTS     phase B: 375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### D-29 · The long comp-grant form opens at the foot of the list, out of sight
PAGE      /admin/accounts   (tab: users)
BUTTON    "Comp grants" (⋯ sheet)
STEPS     1. With a long list, ⋯ → Comp grants.
EXPECTED  FULL-SCREEN POPUP (RiseScreen, ✕ back to the list) for a 5-part form: scope, service checklist, value, expiry, rationale.
ACTUAL    `buildToggleHref` targets `#u-<id>` (the row), but `CompGrantsPanel` renders after `</TemplateSection>`, below up to 200 rows.
SHOTS     phase B: 375 px light + desktop
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### D-30 · The one-off venue create form is its own page
PAGE      /admin/venues/new
BUTTON    "Add venue" (venues tab)
STEPS     1. Venues tab → Add venue.
EXPECTED  FULL-SCREEN POPUP over the Venues tab (long form: 8 fields and 17 ceremony checkboxes; nobody bookmarks it).
ACTUAL    A standalone page (venues/new/page.tsx) that leaves the tab, with Cancel → `/admin/venues`.
SHOTS     phase B: 375 px light + desktop
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### D-31 · The Accounts skeleton draws a bordered table, but the default Users tab is a row list
PAGE      /admin/accounts
BUTTON    —
STEPS     1. Load /admin/accounts (Users).
EXPECTED  A skeleton with the page's shape: masthead, chip row, search, avatar rows.
ACTUAL    accounts/loading.tsx re-exports `TablePageSkeleton` (5-column bordered table). Users draws `PeopleFilterChips` and `TemplateRows` with no table.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading
SEVERITY  look
SOURCE    CODE

#### D-32 · The People skeleton draws a table but none of the head numbers or group cards
PAGE      /admin/directory
BUTTON    —
STEPS     1. Load /admin/directory.
EXPECTED  The head-number strip, the group cards and the list.
ACTUAL    directory/loading.tsx is `TablePageSkeleton`. The page draws `TabLanding` (head numbers and cards) before the list.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading
SEVERITY  look
SOURCE    CODE

**Group D notes**

- D-11 assumes PostgREST's 1,000-row limit, based on the repo's own notes (lib/vendor-earnings.ts, lib/admin/growth-stats.ts). The live max-rows setting was not checked. The Venues tab stats read (`venue_directory.select('venue_type')`, no paging) would cap the same way past 1,000 venues; the directory's current size is unknown.
- /admin/directory shows two page titles: `TabLanding`'s "People" masthead plus the mounted Users tab's "Users" masthead. This is not on the checklist.
- Outside my pages: the shared `ConfirmDialog` (app/_components/confirm-dialog.tsx) is a `<dialog>` used across the whole app (K3). That is the lead's call.
- The Users tab copy says "Reverse via the Blacklisted filter", and account-deletions says "Users → Blacklisted", but the filter chip is labelled "Blocked".
- The checkout is at 653100823, a progress-list commit on top of fb3f72d with no admin code changes, so findings hold for fb3f72d.

### Group E · Verify, fraud & disputes

#### E-1 · A settlement the database refused, or one that succeeded, is never shown to the admin
PAGE      /admin/disputes
BUTTON    "It did not arrive" / "The payment stands" / "Accept — waive the fee"
STEPS     1. Two admins open the same "The downpayment never reached me" row. 2. A settles it. 3. B then presses "It did not arrive".
EXPECTED  B is told it was already settled. A sees a success line.
ACTUAL    settleDepositDispute and settlePaymentDispute redirect to `?settled=already|no_dispute|ok`. page.tsx `Props.searchParams` has no `settled`, so the row just disappears. bookingFeeDispute `decide` redirects `?fee_dispute=already|no_dispute|not_admin|accepted|rejected`, but BookingFeeDisputesSection shows only `result === 'error'`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 (a failure must render as a failure) · CLAUDE.md §5.4
SEVERITY  money-signin
SOURCE    CODE

#### E-2 · A resolved force-majeure flag can be re-resolved, overwriting the refund record
PAGE      /admin/force-majeure/[flagId]
BUTTON    "Apply Dismissed" (any "Resolve as" choice)
STEPS     1. Open a flag already resolved as "Refund issued". 2. The "Resolve as" list still shows. Open "Dismissed" and press Apply.
EXPECTED  A resolved flag is closed to re-resolution, like resolveDispute's `.eq('status', 'open')` guard.
ACTUAL    The `RecordSection label="Actions"` renders whatever `isResolved` is. force-majeure/actions.ts `resolveFlag` updates by `.eq('flag_id', flagId)` only. It overwrites `status` and `resolution_notes` (the refund amount and channel) and notifies the couple again.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 · design-and-wiring B6
SEVERITY  money-signin
SOURCE    CODE

#### E-3 · Booking fee dispute shows "Fee ₱0" and a confident "no chat / no save" when its reads fail
PAGE      /admin/disputes   (Booking fee disputes section)
BUTTON    "Accept — waive the fee" / "Reject — the fee stands"
STEPS     1. A dispute is under_review. 2. The booking_fee_charges, chat_threads or event_vendors read fails.
EXPECTED  "Couldn't read" for each failed read. The evidence does not lean toward a waiver.
ACTUAL    booking-fee-disputes-section.tsx only logs `chargesRes.error`. `peso(c?.amount_charged_centavos ?? null)` turns null into Number(null) = 0, so the row reads "Fee ₱0 · bill unknown". `threads`/`saves` errors are never read, so it says "No chat was started from Setnayan." and "No save from Find.". `shopsRes` error is unchecked, so names read "Unnamed shop".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### E-4 · Dispute evidence silently disappears on a failed read
PAGE      /admin/disputes
BUTTON    "Reservation policy evidence" / "Delivery handover" / "receipt"
STEPS     1. Open the queue while the event_vendor_policy_acknowledgements or booking_handovers read is refused, or a receipt presign throws.
EXPECTED  "Couldn't read" on the row, as QuoteVersionsEvidence already says ("Couldn't read this supplier's quote versions").
ACTUAL    `fetchPolicyAcknowledgementsByVendor` and `fetchHandoversByVendor` use `const { data } =` and drop the error, so the forfeit evidence is just missing. payment-disputes-section.tsx has `catch { receiptByPayment.set(r.payment_id, null) }`, so the row says " · no receipt on file". page.tsx `[{ data: vendorData }, { data: openerData }]` drops errors, so rows read "Unnamed supplier" with TierChip "Free".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### E-5 · A failed booking lookup makes a flag read "Whole event" and hides the deposit
PAGE      /admin/force-majeure/[flagId]
BUTTON    —
STEPS     1. Open a flag tied to a booking while the event_vendors, events or users lookup fails.
EXPECTED  Say the booking and deposit could not be read.
ACTUAL    `eventRes`, `vendorRes`, `coupleRes` and `handlerRes` errors are never read. With vendor null the page shows "Scope: Whole event" and drops the "Deposit" row (state and proof). Handler reads "Unassigned"; event and filed-by read "—". `depositProofDisplayUrl(...).catch(() => null)` also hides the receipt without saying so.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### E-6 · Re-verification fee shows "Free" when the price read fails, and the fee chip uses a hand-made ₱ formatter
PAGE      /admin/verify   (tab: demoted; fee chip on every application card)
BUTTON    —
STEPS     1. Open ?status=demoted with a demoted shop listed. 2. The service_catalog read fails.
EXPECTED  "Couldn't read". Money formatted through lib/php.ts.
ACTUAL    lib/vendor-verification.ts `resolveApplicationFeeCentavos` returns 0 on error ("charging 0"), so DemotedVendorCard reads "Re-verification fee: Free". `feeLabelForCentavos` formats with `formatPhpCentavos`, a hand-made `₱${(centavos / 100).toLocaleString('en-PH'…)}`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · §5.4
SEVERITY  money-signin
SOURCE    CODE

#### E-7 · Peso amounts formatted by hand instead of lib/php.ts
PAGE      /admin/disputes · /admin/force-majeure/[flagId] · /admin/pax-changes
BUTTON    —
STEPS     1. Open any row that shows an amount.
EXPECTED  formatPhp / formatPhpRounded only.
ACTUAL    `peso` helpers in payment-, deposit- and booking-fee-disputes-section.tsx; page.tsx PolicyEvidence `₱${Math.round(p.downpayment_amount_php).toLocaleString('en-PH')}`; actions.ts settlePaymentDispute title `₱${Number(pay.amount_php ?? 0)…}`, which tells both parties "₱0" when the amount is missing; [flagId] change orders `toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })`; pax-changes/page.tsx `peso`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (lib/php.ts)
SEVERITY  money-signin
SOURCE    CODE

#### E-8 · "Download" sends a team-member admin to the public home page with no reason
PAGE      /admin/verification-docs
BUTTON    "Download" (and "Delete")
STEPS     1. Sign in as is_team_member (not is_internal). The admin layout lets them in through `isAdminProfile`. 2. Press Download.
EXPECTED  The page is hidden from people who can't use it, or the press says why it is refused.
ACTUAL    The local `requireAdmin` in verification-docs/actions.ts checks only `is_internal` and does `redirect('/')`. The signed-URL path is otherwise sound: gated first, minted server-side, 120 s, attachment.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5 (a press reaches a real action or destination)
SEVERITY  broken
SOURCE    CODE

#### E-9 · Verify actions land on the wrong surface or tab
PAGE      /admin/verify   (tabs: visibility, in_review, ?shop=)
BUTTON    "Approve → Verified", "Archive", "Run deep search", "Read it again"
STEPS     1. Listing visibility, then Approve → Verified, then confirm. 2. Or: In review tab, then Run deep search.
EXPECTED  Come back to the same surface, tab or shop with the result.
ACTUAL    approveVendor and archiveVendor redirect to `/admin/verify?approved=1` / `?archived=1` (Applications › Pending). runVendorDeepSearchAction (`?deep_search=1`) and openApplicationDocument with intent=read (`?reread=1`) drop `status` and `shop`, so "the dossier is on the application card" points at a card not on screen. verifyVendorExperience sends `?exp_verified=1`, which FlashBanner never reads.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  broken
SOURCE    CODE

#### E-10 · Three verify queues show "empty" copy when the read failed
PAGE      /admin/verify   (tabs: visibility, auto, demoted)
BUTTON    —
STEPS     1. Make the visibility read, the admin_audit_log auto-check read, or the demoted read fail.
EXPECTED  Only the "couldn't load" line.
ACTUAL    VisibilitySurface shows its FormFlash and then, because `vendors.length === 0`, "Queue is empty for this filter. Try widening the status.". The auto tab shows the `autoReadFailed` banner plus "No shop has been verified automatically yet.". The demoted tab's `const { data: demotedVendors }` drops the error and shows "No suppliers currently demoted."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  wrong
SOURCE    CODE

#### E-11 · A storage failure still draws "Nothing here." on both shelves
PAGE      /admin/verification-docs
BUTTON    —
STEPS     1. The R2 listing fails.
EXPECTED  Only the TemplateFail.
ACTUAL    `buildVerificationDocsReportWith` leaves `objects = []`, so `verificationDocShelves` draws "Left over 0" and "In use 0", each with `TemplateEmpty` "Nothing here.". This sits under the fail line that says the page is "showing nothing rather than an empty list".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  wrong
SOURCE    CODE

#### E-12 · Wipe + ban request gives no sign it was opened; a second press crashes
PAGE      /admin/fraud
BUTTON    "Open two-admin wipe + ban request"
STEPS     1. Confirm fraud → wipe + ban, type the reason and the name, press. 2. Press again.
EXPECTED  The dialog closes with "sent — waiting for a second admin", and the card shows the request is pending.
ACTUAL    wipe-ban-dialog.tsx never calls `setOpen(false)` on success, and page.tsx never reads admin_approval_requests. The second press throws "A wipe + ban request for this supplier is already pending…", which lands on the admin crash page.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Toast (success is a small toast)
SEVERITY  wrong
SOURCE    CODE

#### E-13 · Refusals arrive as the crash page instead of a plain reason
PAGE      /admin/disputes   (also /admin/fraud, /admin/force-majeure/[flagId], /admin/completions)
BUTTON    "Apply resolution" · "Un-suspend (keep watching)" · "Apply Refund issued" · "Keep review closed"
STEPS     1. Two admins resolve the same dispute. 2. The second one presses Apply resolution.
EXPECTED  A plain reason plus Try again, on the same screen.
ACTUAL    `resolveDispute` throws "Dispute already resolved (status: …). Refresh the page."; unsuspendVendor, resolveFlag and forceCompleteVendor/upholdNonDelivery throw the same way. Plain `<form action>` → app/admin/error.tsx "This surface crashed". A production build replaces the thrown message with a generic one.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Toast (failure gives a plain reason + Try again)
SEVERITY  wrong
SOURCE    CODE

#### E-14 · Banned words on the dispute and fraud desks
PAGE      /admin/disputes · /admin/fraud · /admin/force-majeure/[flagId]
BUTTON    —
STEPS     1. Open each page with rows present.
EXPECTED  "reservation fee"; "supplier".
ACTUAL    deposit-disputes-section.tsx "“The downpayment never reached me”" and "No downpayment is in dispute."; page.tsx PolicyEvidence "• Downpayment … non-refundable" and "No-show forfeits the downpayment"; lib/fraud-detection.ts `FRAUD_SIGNAL_LABEL` "reviewed this vendor" and "this vendor is the only thing they touched"; [flagId] "Raised by {co.raised_by}" prints "Raised by vendor".
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### E-15 · Reject, Demote and Founders verification open as hand-made floating `<details>` popovers
PAGE      /admin/verify
BUTTON    "Reject…" · "Demote…" · "Founders verification…"
STEPS     1. Press Reject… on a pending card.
EXPECTED  The shared Sheet: half height on a phone, dimmed page behind.
ACTUAL    `<details className="relative">` with a form `absolute right-0 z-10 … shadow-lg`. Reject holds checkboxes plus a textarea; Founders holds a long paragraph plus a textarea in `w-80`.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### E-16 · Wipe + ban is a hand-made modal
PAGE      /admin/fraud
BUTTON    "Confirm fraud → wipe + ban"
STEPS     1. Press it.
EXPECTED  The shared Sheet.
ACTUAL    wipe-ban-dialog.tsx builds its own `role="dialog" aria-modal="true"` inside `fixed inset-0 z-50` with OverlayBackdrop.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### E-17 · Resolve forms open inline inside a wide table's last column
PAGE      /admin/disputes   (also /admin/completions)
BUTTON    "Resolve" · "Force-complete" · "Uphold non-delivery"
STEPS     1. On a phone, scroll the table sideways to the last column and open Resolve.
EXPECTED  SMALL POPUP (Sheet, 1–2 fields) opened from the row.
ACTUAL    `<details className="min-w-[12rem]">` / `min-w-[13rem]` with a pick or textarea plus a button, inside ConsoleTable `minWidth="72rem"` / `"60rem"`.
SHOTS     phase B: 375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### E-18 · Loading skeletons draw shapes these pages never draw
PAGE      /admin/verify   (also /admin/completions, /admin/force-majeure/[flagId])
BUTTON    —
STEPS     1. Load each page on a slow connection.
EXPECTED  The skeleton draws only what the page draws.
ACTUAL    verify/loading.tsx uses `TablePageSkeleton` (search + sort toolbar and a 5-column table); the page draws pill tabs and cards. completions/loading.tsx draws that toolbar; the page has none. [flagId]/loading.tsx uses `DetailPageSkeleton`, a 2-column layout with a 320 px aside; the page is one 760 px column.
SHOTS     phase B: 375 px light + desktop
RULE      CLAUDE.md §3 Loading
SEVERITY  look
SOURCE    CODE

#### E-19 · Light-only colours and typed pixel sizes (58)
PAGE      /admin/verify
BUTTON    —
STEPS     1. Grep page.tsx and _components.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[10px]` ×17, `text-[11px]` ×15 (incl. free-booking-match-note.tsx), `bg-white` ×8 (e.g. `bg-white/50` empty state), `shadow-lg` ×3, `bg-amber-50 … text-amber-700` "Duplicate reg #", `bg-rose-50 … text-rose-700` "linked acct".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-20 · Light-only colours and typed pixel sizes (28)
PAGE      /admin/disputes
BUTTON    —
STEPS     1. Grep page.tsx and _components.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[12px]` ×22 (page.tsx, quote-versions-evidence.tsx), `text-[13px]` ×4, `bg-ink … text-white` on "The payment stands" in payment- and deposit-disputes-section.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-21 · Light-only colours and typed pixel sizes (15)
PAGE      /admin/force-majeure   (and [flagId])
BUTTON    —
STEPS     1. Grep page.tsx, [flagId]/page.tsx and lib/force-majeure.ts.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[12px]` ×9, `text-[14px]` ×2, `text-[24px]` (the record name), `text-[13px]`, `bg-violet-100 text-violet-800` (`FLAG_STATUS_TONE.mediation`).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-22 · Light-only colours and typed pixel sizes (8)
PAGE      /admin/fraud
BUTTON    —
STEPS     1. Grep page.tsx and wipe-ban-dialog.tsx.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[11px]` ×4 (StateBadge, EvidenceChips), `text-[13px]` ×2, `bg-white` ×2 (wipe-ban-dialog.tsx textarea and input).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-23 · Light-only colours and typed pixel sizes (4)
PAGE      /admin/completions
BUTTON    —
STEPS     1. Grep page.tsx.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `bg-sky-100 text-sky-800` (`STATUS_TONE.vendor_marked`), `text-[12px]` "Off-platform", `text-[13px]` InfoTip label.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group E notes**

- completions/actions.ts `openUpheldDispute`: a booking with no order (couple-to-supplier money is off-platform) fails the vendor_disputes `CHECK (payout_id OR order_id)`. The insert is only logged, so an upheld non-delivery may never count toward demotion, and the admin is not told. This is outside the checklist and not checked against prod.
- fraud/page.tsx: the banned card says "Appeal routed to the help center.", but `executeFraudWipeBan` opens the help ticket only `if (appealEmail)`.
- deposit-disputes-section.tsx signs receipts inside an uncaught `Promise.all`. If the presigner throws, the whole /admin/disputes page goes to the error boundary. Unsure whether the presigner can throw.
- Gate order is correct in every action on these pages, including `bookingFeeDispute` (app/_actions), which is the one action imported from outside app/admin: the admin check runs before any `createAdminClient()` use. Verify's `openApplicationDocument` re-derives the document key from the application and signs it server-side after the check.
- HEAD is 653100823, which is fb3f72d plus one commit that touches only build-sessions/final-check/area-8.md. App code is identical to fb3f72d.

### Group G · Studio & media

#### G-1 · The referral reward has no setter, but the copy says "set the reward below"
PAGE      /admin/studio   (tab: referrals → /admin/offers?view=referrals)
BUTTON    —
STEPS     1. Open the Referrals view. 2. Read the switch's help line, then look under "Reward per side".
EXPECTED  A control that sets the reward amount, or a door to the page that sets it.
ACTUAL    `referrals-surface.tsx` says "Turn it on to run the program — then set the reward below", but "Reward per side" only displays it. Nothing in app/ writes `referral_reward_php`; only `app/admin/switches/page.tsx` and `lib/referrals.ts` read it.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5/B6 (every press reaches a real action) · money read from platform_settings
SEVERITY  money-signin
SOURCE    CODE

#### G-2 · Pesos are formatted by hand on Discount codes and Referrals
PAGE      /admin/studio   (tab: discount-codes, referrals)
BUTTON    —
STEPS     1. Open Discount codes and look at a capped code ("50% up to …"). 2. Open Referrals and look at "Reward per side".
EXPECTED  Money formatted through `lib/php.ts` (`formatCentavosPhp` / `formatPhp`).
ACTUAL    `discount-codes-surface.tsx` `formatPesos` uses its own `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' … })`. `referrals-surface.tsx` uses `` `₱${rewardPhp.toLocaleString('en-PH')}` `` in two places (the tile and the InfoTip).
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · checklist 4 (money format)
SEVERITY  money-signin
SOURCE    CODE

#### G-3 · On Journal Spotlights, failed reads show as empty, "not for sale" or "no approval pending"
PAGE      /admin/studio   (tab: journal-spotlights)
BUTTON    "Start 2-admin approval"
STEPS     1. Make the spotlights, `service_catalog` or `admin_approval_requests` read fail. 2. Open the tab.
EXPECTED  "Couldn't read" for each read that failed.
ACTUAL    `fetchAllSpotlightsForAdmin` returns `[]` on error, which shows "No drafts…" and "Nothing published yet." `fetchSponsoredSlotPrice` returns null, so the banner states the SKU "is inactive in the pricing catalog". `pendingRes.data ?? []` drops the error, so a sponsored draft waiting for a second admin offers "Start 2-admin approval" again.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### G-4 · Any signed-in account can upload into the homepage background-video folder
PAGE      /admin/background-videos
BUTTON    "Upload video"
STEPS     1. Signed in as any couple or supplier, POST /api/upload with `{ bucket: 'media', pathPrefix: 'homepage-bg/slot-0', … }`.
EXPECTED  An admin check on the server for the site's own `homepage-bg/` folder, the same way `hub-music/` gets one.
ACTUAL    `app/api/upload/route.ts` runs an admin test (`hubMusicUploadRule` + `isAdminProfile`) only for `hub-music/`. `homepage-bg/…` has no id segment, so `tenancyForPathPrefix` returns null and the presign is granted. Publishing a slot is still gated in `saveBackgroundVideo`; the stray files then show up as left-over files on /admin/website-media.
SHOTS     —
RULE      checklist 2(b): API routes an admin page calls must check admin on the server
SEVERITY  money-signin
SOURCE    CODE

#### G-5 · "Open couple page ↗" goes to /{public_id}, which is not an Event Hub address
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Open couple page ↗"
STEPS     1. With a Save-the-Date video waiting for review, press "Open couple page ↗".
EXPECTED  The couple's Event Hub (`publicEventPath(slug)`).
ACTUAL    `std-video-moderation.tsx` builds `` href={`/${row.publicId}`} ``. `/[slug]` finds events by `slug` (`theOneEventRead` `.ilike('slug', …)`, `event_public_stamp`), and slugs come from the display name (`generateUniqueSlug`). The link therefore 404s.
SHOTS     phase B: 375 px light
RULE      checklist 1 (dead link)
SEVERITY  broken
SOURCE    CODE

#### G-6 · The "Show the reveal on couple sites" switch saves a value nothing reads
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Show the reveal on couple sites"
STEPS     1. Flip the switch. 2. Press "Save — make it live". 3. Open any Event Hub.
EXPECTED  The switch changes something, or it is removed.
ACTUAL    `studio.tsx` writes `draft.enabled`. Its own hint says it "No longer switches the reveal on", and `lib/reveal-access.ts` / `reveal-overlay.tsx` say `config.enabled` "is NOT an input". No reader of `fetchRevealConfig()` uses `.enabled`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5 (no control that does nothing)
SEVERITY  broken
SOURCE    CODE

#### G-7 · On a phone, homepage widgets cannot be reordered
PAGE      /admin/studio   (tab: website)
BUTTON    "↑" / "↓" (aria "Move … up/down")
STEPS     1. At 375 px, open the Website editor. 2. Try to reorder a widget.
EXPECTED  The Move buttons, which the file's own docblock promises for touch users.
ACTUAL    `app/admin/website/widget-list.tsx` wraps the Move pair in `hidden flex-col gap-1 sm:flex`, so below 640 px only HTML5 `draggable` is left. Phase B should confirm that touch drag does nothing.
SHOTS     phase B: 375 px light
RULE      checklist 1
SEVERITY  broken
SOURCE    CODE

#### G-8 · When the Reveal Studio read fails, the locked defaults are shown as the live house settings
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Save — make it live"
STEPS     1. Make the `reveal_studio_config` read fail. 2. Open the tab.
EXPECTED  "Couldn't read", with the editor withheld.
ACTUAL    `fetchRevealConfig` (`lib/reveal-config.ts`) has `catch { return DEFAULT_REVEAL_CONFIG; }`, and `RevealStudio initial={config}` draws those defaults as fact. Pressing "Save — make it live" would overwrite the real house config.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states (a default stated as fact)
SEVERITY  wrong
SOURCE    CODE

#### G-9 · When the Spotlight Awards read fails, it shows "No awards for this month yet" and zeroes
PAGE      /admin/studio   (tab: spotlight-awards → /admin/offers?view=badges)
BUTTON    —
STEPS     1. Make the `vendor_spotlight_awards` read fail. 2. Open the view.
EXPECTED  "Couldn't read".
ACTUAL    `fetchSpotlightAwards` (`lib/spotlight-awards.ts`) does `console.error` then `return []`. The surface then shows "Total awards 0 · Auto-picked 0 · Featured 0" (its local `Stat value: number`) and the empty state.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-10 · Moodboard colour tags look empty when their read fails, and "Save tags" then deletes them
PAGE      /admin/studio   (tab: moodboard-library)
BUTTON    "Save tags"
STEPS     1. Make the `moodboard_asset_color_ranges` read fail. 2. Open an asset. 3. Press "Save tags".
EXPECTED  "Couldn't read" for the tags, and no save over an unread state.
ACTUAL    `moodboard-library-surface.tsx` does `const { data: ranges } = await admin.from('moodboard_asset_color_ranges')` and drops the error, so every asset shows no tags. `saveColorRanges` deletes all existing ranges and inserts the current ones, so saving wipes the real tags.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-11 · Social queue: a failed evergreen read says "No evergreen items yet", and the autopilot form saves defaults
PAGE      /admin/studio   (tab: social-queue)
BUTTON    "Save" (Autopilot)
STEPS     1. Make the `social_evergreen_items` read fail, or the `social_publish_settings` read fail. 2. Open the tab.
EXPECTED  "Couldn't read", and the settings form withheld (as on Referrals).
ACTUAL    `evergreenErr` is only logged. "Evergreen library · 0" and "No evergreen items yet — add a few…" render, and it is the only section not wrapped in `QueueSection loadFailed`. When settings fail to load, `AutopilotStrip` still draws the checkbox form over the hard-coded defaults ("(defaults shown)"), and "Save" would write them.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-12 · When the background-videos read fails, the page shows an empty editor with no message
PAGE      /admin/background-videos   (also studio tab: background-videos)
BUTTON    —
STEPS     1. Make the `homepage_background_videos` read fail. 2. Open the page.
EXPECTED  "Couldn't read".
ACTUAL    `fetchRows` in `lib/background-videos.ts` does `const { data } = …; return (data …) ?? []` and drops the error. `BackgroundVideosManager` then draws no main card and an empty "Bottom pillar icons (5)" grid.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-13 · "Journal" is used where people should read "Articles"
PAGE      /admin/studio   (tab: journal-spotlights)
BUTTON    "Journal Spotlights" (rail tab)
STEPS     1. Open the Studio rail or picker. 2. Open the tab.
EXPECTED  Articles (e.g. "Article spotlights", "Article").
ACTUAL    The rail label `'Journal Spotlights'` in `studio/page.tsx` `RAIL`. The picker label `v('journal-spotlights', 'Journal Spotlights', …)` in `lib/admin/admin-pages.ts`. The masthead `title="Journal Spotlights"`, the field label "Journal article" and the InfoTip "Pick a Journal article", all in `journal-spotlights-surface.tsx`.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-14 · Reveal Studio calls the couple's Event Hub a "couple site"
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Show the reveal on couple sites"
STEPS     1. Open the tab and read the InfoTip, the switch and the save message.
EXPECTED  Event Hub.
ACTUAL    `reveal-studio-surface.tsx` InfoTip: "every Save-the-Date couple site… go live on couple sites". `studio.tsx`: the switch "Show the reveal on couple sites" and the save message "Saved — live on couple sites."
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-15 · The social queue shows "Monogram" and can show "vendor"
PAGE      /admin/studio   (tab: social-queue)
BUTTON    —
STEPS     1. Look at a monogram consent under Take-downs or "Couple creations — ready to post". 2. Look at a verified supplier with no services under "New verified suppliers".
EXPECTED  Logo Maker / logo, and supplier.
ACTUAL    `SHARE_ARTIFACT_LABEL.monogram = 'Monogram'` (`lib/social-sharing.ts`) is rendered in card headers, and the image has `alt="Couple monogram"`. The fallback `: 'vendor'` in `social-queue-surface.tsx` renders "A new vendor in …" and goes into the public `vendorFeatureCaption`.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-16 · The Music Maker delivery copy says "couple's site"
PAGE      /admin/pakanta
BUTTON    "Finished song file"
STEPS     1. On an active row, read the upload help line. 2. Deliver a song.
EXPECTED  Event Hub, as the next line of the same file already says.
ACTUAL    In `pakanta-deliver.tsx`, the help text says "It auto-plays on the couple's site once delivered…", and the success line says "Delivered and now playing on the couple’s site."
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-17 · Several Studio tabs have more than one main (filled) button on one screen
PAGE      /admin/studio   (tabs: moodboard-library, songs, spotlight-awards, social-queue, reveal-studio)
BUTTON    see ACTUAL
STEPS     1. Open each tab.
EXPECTED  One main button per screen, sheet or card.
ACTUAL    Moodboard: "Generate random prompt", "Upload + tag", "Save tags", "Save sample to slot N" (all `tone="brand" main`) and "Reject with this reason" (`danger main`, not in a confirm sheet). Songs: "Merge" and "Search" (both `.button-primary`). Spotlight: "Run now" and "Add award" (both brand `main`). Social queue `ScheduledPostCard`: "Save copy" and "Post now" in one card. Reveal: "Save — make it live", plus the selected speed and preview pills filled in the same `ACCENT`.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### G-18 · Studio tabs use browser confirm and alert boxes
PAGE      /admin/studio   (tabs: songs, spotlight-awards)
BUTTON    "Delete {song}" (trash) · "Merge" · "Remove award"
STEPS     1. Delete a song, merge two songs, or remove an award.
EXPECTED  The shared Sheet / ConfirmForm.
ACTUAL    `songs-danger-controls.tsx` uses `window.confirm(` (DeleteSongButton, MergeSongsFields) and `window.alert('Those are the same song…')`. `spotlight-awards/_components/spotlight-actions.tsx` uses `window.confirm('Remove this award?')`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### G-19 · Reveal Studio uses a native select with 10 options
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Default template"
STEPS     1. Open the Default template dropdown.
EXPECTED  PickMenu (FieldPick).
ACTUAL    1 native `<select>` in `reveal-studio/studio.tsx`, one option per `REVEAL_TEMPLATE_IDS` (10).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### G-20 · Studio tabs have about 183 hard-coded colour, size and shadow values
PAGE      /admin/studio
BUTTON    —
STEPS     1. Switch the theme to dark (once admin is on DARK_READY).
EXPECTED  Colour tokens by job and the `text-sn-*` sizes.
ACTUAL    About 183 hits outside comments, including:
          - `reveal-studio/studio.tsx`: `background: '#0e0e10'`, `from-[#1c1c20] to-[#0b0b0c]`, `rounded-[2rem] … shadow-xl`, `color: '#b23b3b'`
          - `real-stories-surface.tsx` INPUT/BTN_SECONDARY `bg-white`; `social-queue-surface.tsx` `bg-sky-100 text-sky-800` and `bg-white/70`
          - about 130 `text-[11–13px]`
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### G-21 · Studio's own loading.tsx draws a form the page never draws
PAGE      /admin/studio
BUTTON    —
STEPS     1. Open /admin/studio (or any `?tab=`) on a slow connection.
EXPECTED  A skeleton of the rail plus a list, matching the page.
ACTUAL    `studio/loading.tsx` re-exports `FormPageSkeleton`: a max-w-2xl framed card with 6 label/input pairs and a button. It has no nav rail. The default Website tab is a list of widget rows.
SHOTS     phase B: 375 px light + desktop
RULE      CLAUDE.md §3 Loading (the skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE

#### G-22 · Deleting a single file asks with a browser confirm box
PAGE      /admin/website-media   (also studio tab: website-media)
BUTTON    "Delete" (row)
STEPS     1. Press Delete on a left-over file.
EXPECTED  The shared Sheet / ConfirmForm.
ACTUAL    `media-table.tsx` `handleDelete` calls `window.confirm(\`Delete this file permanently?…`)`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### G-23 · Website media has about 73 Tailwind palette classes and typed sizes
PAGE      /admin/website-media
BUTTON    —
STEPS     1. View the page in dark.
EXPECTED  Tokens by job.
ACTUAL    About 73 hits: `page.tsx` `border-amber-200 bg-amber-50 … text-amber-900` and `border-slate-200 bg-slate-50 … text-slate-700`; `clear-folder-button.tsx` `bg-red-600 … text-white` and `bg-white … text-slate-900`; `media-table.tsx` `bg-red-50 text-red-800`; plus `text-[12–16px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### G-24 · Removing a track opens a browser confirm on top of the Edit sheet
PAGE      /admin/hub-music   (also studio tab: hub-music)
BUTTON    Remove (in the track sheet)
STEPS     1. Tap a track title to open its Sheet. 2. Press Remove.
EXPECTED  One layer: a confirm inside the sheet, or the shared confirm.
ACTUAL    `hub-music-manager.tsx` `remove()` calls `window.confirm(\`Remove “…” from Event Hub music?…`)` while the `Sheet` (`EditTrack`) is open, so one popup sits on top of another.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE (no popup on a popup)
SEVERITY  look
SOURCE    CODE

#### G-25 · Background videos uses 12 typed pixel sizes
PAGE      /admin/background-videos
BUTTON    —
STEPS     1. View the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    In `background-videos-manager.tsx`, 8 `text-[12px]` and 4 `text-[13px]` (e.g. the "Upload video" label and "Main · slot 1"), plus `bg-black`/`text-white/50` on the video frame.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### G-26 · Music Maker queue uses typed pixel sizes
PAGE      /admin/pakanta
BUTTON    —
STEPS     1. View the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    5 hits: `page.tsx` has `text-[15px]` (couple names) and `text-[13px]` (InfoTip labels); `pakanta-deliver.tsx` has `text-[13px]` ("Deliver finished song").
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

**Group G notes**

- Outside my pages: `app/admin/discount-codes/_components/voucher-form.tsx` (behind discount-codes/new and [id]/edit) formats pesos by hand (`₱{formatPeso(...)}` via `toLocaleString`) and types peso example amounts in its "Maximum discount (₱)" help ("₱500 cap on a ₱2,000 service"). /admin/discount-codes/new is also a candidate for a FULL-SCREEN POPUP.
- Outside my pages: `app/admin/switches/page.tsx` also builds `` `₱${s.referral_reward_php.toLocaleString('en-PH')}` `` by hand.
- On Real Stories and Storytellers, the "migration missing" panel tells an admin to run `supabase db push --db-url "$SUPABASE_DB_URL"` by hand, which CLAUDE.md §5.5 forbids. It only shows when that migration is missing.
- Unsure, not reported: the Referrals KPI tiles (cap 500) and the Patiktok status chips (cap 60) count only the most recent rows but read as totals. I did not test G-7's touch drag on a real phone.
- The checkout is on 653100823, which is fb3f72d plus one progress-list commit; there is no diff under `apps/web/app/admin`.

### Group F · Watch desks & media

#### F-1 · Gift limit shows the built-in default as the live setting when its read fails
PAGE      /admin/gifts
BUTTON    "Save gift limit"
STEPS     1. The platform_settings read of gift_limit_pct is refused. 2. Open Gifts & comps.
EXPECTED  "Couldn't read" where the % sits, and no Save over a value nobody read.
ACTUAL    lib/gift-limit-settings.server.ts `getGiftLimitPct` catch → `GIFT_LIMIT_PCT_DEFAULT`. gifts/page.tsx prefills `GiftLimitForm` with it, and `ShopGiftsLedger`'s ⓘ states "capped at {giftLimitPct}%" as fact.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states (a default setting stated as fact)
SEVERITY  money-signin
SOURCE    CODE

#### F-2 · Peso amounts are formatted by hand on Gifts
PAGE      /admin/gifts
BUTTON    — (the "What's free" and "Services to make free" checkboxes, and the Active comp grants "Value" column)
STEPS     1. Open Gifts & comps. 2. Read the tier and service prices and the Value column.
EXPECTED  Every amount formatted through lib/php.ts `formatPhp` / `formatPhpRounded`.
ACTUAL    gifts/page.tsx has `₱{formatPeso(sku.price_php)}` and `₱{formatPeso(s.retail_price_php)}` (`formatPeso` = toLocaleString). The Value column uses lib/comp-grants.ts `formatRetailValueCentavos`, which returns `₱${pesos.toLocaleString(…)}`. badge-rewards-ledger.tsx `stateWords` types a literal "→ ₱0".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 money · brief §4
SEVERITY  money-signin
SOURCE    CODE

#### F-3 · A refused catalogue read empties the deal and free-window price pickers without saying so
PAGE      /admin/gifts   (Supplier cohort deals · Couple free windows)
BUTTON    "Create deal" / "Create free window"
STEPS     1. The vendor_billing_catalog or platform_retail_catalog_v2 read is refused. 2. Open Gifts & comps.
EXPECTED  "Couldn't read the catalogue" in the What's free / Services rows, and Create held back.
ACTUAL    lib/v2-catalog.ts `fetchV2VendorCatalog` and `fetchV2CustomerCatalog` return `[]` on error (`if (error || !data) return [];`). `tierSkus.map` and `customerCatalog.map` then draw no checkboxes and no notice. The Services column falls back to raw codes (`coupleTitleFor.get(code) ?? code`).
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### F-4 · The price evidence chips format pesos by hand
PAGE      /admin/integrity-watch   (tab: prices)
BUTTON    —
STEPS     1. With the plausibility scanner on, open the Prices tab. 2. Read the evidence chips on a flag.
EXPECTED  Amounts via lib/php.ts `formatPhp` / `formatPhpRounded`.
ACTUAL    page.tsx `evidenceChips` has `const peso = (n) => \`₱${Math.round(n).toLocaleString('en-PH')}\``, used for "lock ₱…" and "below own median (₱…)".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 money · brief §4
SEVERITY  money-signin
SOURCE    CODE

#### F-5 · The "Live Watch channels" menu item opens a 404 while the Live Watch flag is off
PAGE      /admin/live-studio-channels
BUTTON    "Live Watch channels" (Switches & delivery › What ▾)
STEPS     1. Run with NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED off. 2. Open Switches & delivery and pick Live Watch channels.
EXPECTED  The view is hidden while the flag is off (the page's own comment says the nav entry is conditional).
ACTUAL    lib/admin/admin-pages.ts lists `v('live-watch', 'Live Watch channels', …)` unconditionally. The page calls `if (!liveStudioRoamEnabled()) notFound();`, so the whole /admin/switches?view=live-watch answers 404.
SHOTS     phase B: 375 px light
RULE      design-and-wiring A3 / B5 (every press reaches a real destination)
SEVERITY  broken
SOURCE    CODE

#### F-6 · Editorial unlock, resolve and re-scan ignore write failures, and a failed unlock still tells the couple "approved"
PAGE      /admin/editorial-review   (record page /admin/editorial-review/[editorialId])
BUTTON    "Unlock for couple — all red flags resolved" · "Mark OK — no change" · "Save rewrite" · "Re-scan editorial"
STEPS     1. Open a flagged editorial. 2. Press Unlock (or Mark OK) while the event_editorial update is refused.
EXPECTED  The failure is shown, and nothing is sent to the couple.
ACTUAL    [editorialId]/actions.ts: `unlockForCouple`, `resolveFlag` and `triggerRescan` run `await admin.from('event_editorial').update(…)` without reading `error`. `unlockForCouple` then sends `notifyCoupleEditorialDecision` "Your editorial is approved" anyway.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 (a failure must render as a failure) · brief: moderation actions show failures
SEVERITY  broken
SOURCE    CODE

#### F-7 · "Block uploader" can block nobody and still record "Uploader blocked"
PAGE      /admin/user-reports
BUTTON    "Block uploader"
STEPS     1. On an open photo or user report, press Block uploader. 2. The event_blocked_users upsert fails, or the photo is a seat photo with no guest_id.
EXPECTED  The failure is shown and the report stays open.
ACTUAL    actions.ts `resolveReport`: `await admin.from('event_blocked_users').upsert(…)` drops `error`, and a null `guestId` skips the block silently. The report is still stamped `ACTION_NOTE.block` "Uploader blocked (event-scoped)…" and status `actioned`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 · brief: moderation actions show failures
SEVERITY  broken
SOURCE    CODE

#### F-8 · The Liveliness switches and Icon tile colours save but change nothing ("applies in the next update")
PAGE      /admin/colours
BUTTON    "Curved edge on the band" · "First frame overlaps the band" · "Press ring" · the Icon tiles colour fields
STEPS     1. Toggle a Liveliness switch or change a tile colour. 2. Press Save. 3. Look at any app screen.
EXPECTED  No pressable "not yet" control. (Band and Frames are not "next update": `.sn-band` and `.sn-frame` in globals.css already read their tokens.)
ACTUAL    lib/app-colours.ts `appColourTokens` emits no `touches`, and nothing in app/ reads `--sn-cat-*`. colours-editor.tsx tags them `NEXT_UPDATE` / "· applies in the next update", and gives Band and Frames the same stale tag.
SHOTS     phase B: 375 px light + desktop
RULE      design-and-wiring B5 (no pressable "coming soon")
SEVERITY  broken
SOURCE    CODE

#### F-9 · The Corrections page crashes when a shop name or error message contains "%"
PAGE      /admin/corrections
BUTTON    "Move the address"
STEPS     1. Move the address of a shop named e.g. "100% Events" (or hit a DB error whose text has %). 2. The action redirects with `?address_moved=` / `?error=`.
EXPECTED  A success or error notice.
ACTUAL    page.tsx runs `decodeURIComponent(search.address_moved)` and `decodeURIComponent(search.error)` on searchParams Next has already decoded. A bare "%" throws URIError, so the page fails right after a successful move.
SHOTS     phase B: 375 px light
RULE      brief severity: error on valid input
SEVERITY  broken
SOURCE    CODE

#### F-10 · A failed users read turns into "0 strikes", on screen and in the strike count it writes
PAGE      /admin/concierge-abuse   (tabs: queue, enforcement)
BUTTON    "Confirm abuse (+1 strike)" · "Lift enforcement (−1 strike)"
STEPS     1. The users read is refused. 2. Confirm abuse on a user who already has 3 strikes (full banned).
EXPECTED  The read error is shown; nothing is written from an unread count.
ACTUAL    actions.ts drops the error on `select('concierge_abuse_strike_count')` and uses `?? 0`, so Confirm writes 1 strike / 'warning' over a full ban and Lift writes 0 / 'none'. page.tsx `usersById` also drops its error: the queue shows "0 strikes · No enforcement" and "No matched accounts resolved."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-11 · A raw enforcement code reaches the user's notification and the admin's notice
PAGE      /admin/concierge-abuse
BUTTON    "Confirm abuse (+1 strike)" · "Lift enforcement (−1 strike)"
STEPS     1. Confirm abuse on a flag. 2. Read the user's notification and the page notice.
EXPECTED  The worded level, e.g. "Trial banned" (`ENFORCEMENT_LEVEL_LABEL`).
ACTUAL    actions.ts sends the title `Account flagged for review (${newLevel})`, e.g. "(trial_banned)". page.tsx prints "Account enforcement level is now <strong>{search.confirmed}</strong>" and "New level: {search.lifted}" as raw keys.
SHOTS     phase B: 375 px light
RULE      brief §4 (words a person reads)
SEVERITY  wrong
SOURCE    CODE

#### F-12 · The enforcement desk calls itself read-only and retired, but its strike buttons are live, under three different names
PAGE      /admin/concierge-abuse
BUTTON    "Clear (false positive)" · "Confirm abuse (+1 strike)" · "Lift enforcement (−1 strike)"
STEPS     1. Open the page. 2. Read the masthead, the tab title and the ⓘ.
EXPECTED  One name, and a status line that matches what the buttons do.
ACTUAL    The masthead says "Today's Focus enforcement" (a retired SKU), metadata says "Setnayan AI enforcement · Admin", and the ⓘ "About the Concierge rule" says "Read-only — retired as a separate concept." Meanwhile all three forms write strikes and send notifications.
SHOTS     phase B: 375 px light
RULE      brief §4 · docs/brand.md (one word per thing)
SEVERITY  wrong
SOURCE    CODE

#### F-13 · Escalating an appeal closes it; no "two-admin queue" exists to receive it
PAGE      /admin/reviews
BUTTON    "Escalate"
STEPS     1. Escalate a pending self-review appeal. 2. Look for it in any queue.
EXPECTED  The appeal lands in a queue someone works, as the notice promises.
ACTUAL    actions.ts `escalateAppeal` sets `decided_at` + `decision: 'escalated'`. The page notice says "Appeal escalated to the two-admin queue." Nothing reads escalated appeals: lib/admin/queue-counts.ts counts `decided_at IS NULL` only, and the fake-flag ⓘ promises the same missing queue.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 (trace to the page that shows the result)
SEVERITY  wrong
SOURCE    CODE

#### F-14 · Reject or Escalate from a stale page overwrites an appeal that was already decided
PAGE      /admin/reviews
BUTTON    "Reject appeal" · "Escalate"
STEPS     1. Admin A override-publishes an appeal. 2. Admin B, on an older copy of the page, presses Reject.
EXPECTED  "Already decided", nothing changed.
ACTUAL    actions.ts `rejectAppeal` and `escalateAppeal` update with `.eq('appeal_id', appealId)` only (no `decided_at IS NULL` guard). The decision flips to rejected while the review stays live, and the reviewer is emailed "The original review will not be published."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-15 · An escalated user report shows as "Resolved" and drops out of every view
PAGE      /admin/user-reports
BUTTON    "Escalate"
STEPS     1. Escalate an open report (including an RA 10173 "take my photo down"). 2. Look for it.
EXPECTED  It stays visible as escalated until a person settles it.
ACTUAL    actions.ts maps `escalate: 'actioned'`. The page shows "✓ Resolved" for every non-open row, and `STATUS_FILTERS` has no escalated view.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### F-16 · A refused grants read shows every channel as "Not connected"
PAGE      /admin/live-studio-channels
BUTTON    "Connect"
STEPS     1. The live_studio_channel_grants read is refused. 2. Open the pool.
EXPECTED  "Couldn't read the connections".
ACTUAL    lib/live-studio-channel-grants.ts `fetchPoolChannelGrants` returns an empty Map on error. Every row then shows `grantSummary` "Not connected", the count line says "0 ready to claim", and each row offers a filled "Connect".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-17 · The "don't disconnect a checked-out channel" guard is skipped when its read fails
PAGE      /admin/live-studio-channels
BUTTON    "Disconnect"
STEPS     1. The status read fails. 2. Press Disconnect on a channel an event is holding.
EXPECTED  Refuse (fail closed).
ACTUAL    actions.ts `disconnectChannel`: `const { data: current } = await admin…select('status')` drops `error`. A null `current` skips the refusal, and `revokePoolChannelGrant` runs mid-event.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### F-18 · OAuth error codes and raw status values are shown to the admin
PAGE      /admin/live-studio-channels
BUTTON    "Connect a Setnayan channel" / "Re-connect"
STEPS     1. Start a channel connect that fails (state expired, exchange failed, not configured). 2. Read the red notice and a channel's status line.
EXPECTED  Plain words.
ACTUAL    app/api/oauth/youtube/pool/start and the callback redirect with `error=exchange_failed`, `no_refresh_token`, `not_configured:…`, `state_failed:<db text>`. page.tsx prints `{flashError}` verbatim. `statusLine` prints `${row.status}`, e.g. "checked_out".
SHOTS     phase B: 375 px light
RULE      brief §4
SEVERITY  wrong
SOURCE    CODE

#### F-19 · Failed reads show "No QR flags" and "No shop holds an allowance"
PAGE      /admin/repost-watch
BUTTON    "Scan QR codes" · "Allow"
STEPS     1. The vendor_qr_media_flags or card_claim_word_allowances read is refused. 2. Open the page.
EXPECTED  "Couldn't read" in place of the empty line.
ACTUAL    page.tsx shows the `qrError` FormFlash and then still renders `qrRows.length === 0 ? <TemplateEmpty>No QR flags…`. card-checks-admin.tsx logs `allowRes.error` and renders "No shop holds an allowance." A `shopsRes` error hides the Allow form silently.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-20 · A refused editorial read shows as "not found"
PAGE      /admin/editorial-review   (record page /admin/editorial-review/[editorialId])
BUTTON    a queue row (TemplateRow href)
STEPS     1. Open a record while the event_editorial read is refused.
EXPECTED  "Couldn't read this editorial".
ACTUAL    [editorialId]/page.tsx: `const { data: row } = await admin…maybeSingle(); if (!row) notFound();` drops `error`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-21 · Storage totals can be quietly cut off at the database's row limit and still shown as measured
PAGE      /admin/papic-storage
BUTTON    —
STEPS     1. Let papic_photos or papic_guest_captures hold more than 1,000 rows. 2. Open the page.
EXPECTED  The totals are paged to the end or marked as a lower bound.
ACTUAL    page.tsx reads each table once with `.limit(ROW_CAP)` (200,000) and no paging. The server's row cap (1,000 per lib/vendor-earnings.ts) returns `error: null`, and the `capped` warning fires only at `ROW_CAP * 2`. The ratio, GB and per-event numbers then show as fact. unsure: the cap is a project setting, not in the repo.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 (the measurement must reach the render)
SEVERITY  wrong
SOURCE    CODE

#### F-22 · "Made 2 copys"
PAGE      /admin/papic-storage
BUTTON    "Fill in missing Memory lane copies"
STEPS     1. Press it with 2+ photos to fill.
EXPECTED  "Made 2 copies".
ACTUAL    backfill-tiles-button.tsx renders `copy{result.filled === 1 ? '' : 's'}`.
SHOTS     phase B: 375 px light
RULE      brief §4
SEVERITY  wrong
SOURCE    CODE

#### F-23 · A failed supplier or user search says "No suppliers match"
PAGE      /admin/gifts
BUTTON    "Search"
STEPS     1. Search suppliers or users while the read is refused.
EXPECTED  "Couldn't search".
ACTUAL    page.tsx: `const { data } = await admin.from('vendor_profiles')…ilike(…)` and the matching users `.or(…)` read drop `error`, then render "No suppliers match “x”." / "No user matches “x”." A refused `grant_vendor` / `grant_user` read leaves the grant panel missing with no notice.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-24 · A refused open-count read hides the tab badge, which looks the same as "none open"
PAGE      /admin/integrity-watch   (tabs: reviews, listings, inquiries, prices)
BUTTON    the Reviews / Listings / Inquiries / Prices tabs
STEPS     1. A count read is refused. 2. Look at the tabs.
EXPECTED  "—" on that tab.
ACTUAL    page.tsx `const { count: openReviews } = await admin…` (and `openListings`, `openInquiries`, `openPrices`) drops `error`, and `{openReviews ? \` · ${openReviews}\` : ''}` hides the badge.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-25 · "Reset to current" replaces the live colour set at once, though it reads like "discard my draft"
PAGE      /admin/colours
BUTTON    "Reset to current"
STEPS     1. With a custom set saved, change a colour. 2. Press Reset to current to undo the change.
EXPECTED  A discard of the draft, or a clear label and confirm for an app-wide revert.
ACTUAL    colours-editor.tsx posts `op=reset`. actions.ts `saveAppColours` → `writeColours(userId, null, …)` saves NULL straight away, so every screen goes back to the code defaults and the saved custom set is gone.
SHOTS     phase B: 375 px light
RULE      brief §4 (words match the action)
SEVERITY  wrong
SOURCE    CODE

#### F-26 · Two brand buttons in the supplier grant frame
PAGE      /admin/gifts
BUTTON    "Set tier" + "Comp Papic Challenges"
STEPS     1. Search a supplier and press Comp this supplier.
EXPECTED  One main button per frame; others neutral.
ACTUAL    page.tsx: "Set tier" is `actionButtonClass('brand', { main: true })`, and "Comp Papic Challenges" is `actionButtonClass('brand')` (accent-outlined) in the same `FRAME`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-27 · Two filled accent buttons on one screen
PAGE      /admin/papic-storage
BUTTON    "Fill in missing Memory lane copies" + "Make small copies of old photos"
STEPS     1. Open the page while there are oversized covers.
EXPECTED  At most one main button.
ACTUAL    backfill-tiles-button.tsx and old-photos-button.tsx both draw raw `<button>`s with `bg-[var(--sn-accent)] … text-[var(--sn-on-accent)]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-28 · A second green button next to the green main button
PAGE      /admin/editorial-review   (record page)
BUTTON    "Unlock for couple — all red flags resolved" + "Mark OK — no change"
STEPS     1. Open an editorial whose red flags are resolved but grammar flags are still pending.
EXPECTED  The second button is neutral.
ACTUAL    [editorialId]/page.tsx: Unlock is `actionButtonClass('ok', { main: true })`, and each pending `FlagCard`'s Mark OK is `actionButtonClass('ok')`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-29 · The "Use #…" fix buttons share Save's green
PAGE      /admin/colours
BUTTON    "Save" + "Use #xxxxxx"
STEPS     1. Pick an unreadable colour so a fix button appears.
EXPECTED  The fix buttons are neutral.
ACTUAL    colours-editor.tsx: Save is `ActionButton tone="ok" main`, and `CheckLine`'s fix is `ActionButton tone="ok"`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-30 · The "● Vulgar" chip is white text on a pale pink background
PAGE      /admin/editorial-review   (record page)
BUTTON    —
STEPS     1. Open an editorial with a red flag.
EXPECTED  A readable chip.
ACTUAL    [editorialId]/page.tsx `FlagCard`: `bg-[var(--sn-danger-soft)] text-white`, where `--sn-danger-soft` is #F3E1DC in light mode.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-31 · Hard-coded light-only sizes and colours
PAGE      /admin/integrity-watch
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    7 lines in page.tsx: `text-[12px]`×5, `text-[13px]`, `text-[14px]`, and `bg-white/70` + `rounded-[var(--m-r-md)]` on the note input.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-32 · Hard-coded light-only sizes and colours
PAGE      /admin/repost-watch
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    16 lines in page.tsx: `text-[12px]`×10, `text-[13px]`×4, and `bg-white/70` on both note inputs.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-33 · Hard-coded type sizes
PAGE      /admin/chat-flags
BUTTON    —
STEPS     1. Open the page.
EXPECTED  `text-sn-*`.
ACTUAL    5 lines in page.tsx: `text-[12px]`×3 (status, category and id chips) and `text-[13px]`×2 (InfoTip labels).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-34 · Hard-coded light-only sizes and colours
PAGE      /admin/concierge-abuse
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    12 lines in page.tsx: `bg-white/70` on 3 textareas, `text-[24px]` and `style={{ color: \`rgb(var(--color-${tone}))\` }}` in `Metric`, `text-[15px]`, `text-[12px]`, and hand-made banners `border-success-300/60 bg-success-50`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-35 · Hard-coded light-only colours and hand-rolled buttons
PAGE      /admin/user-reports
BUTTON    "Hide content" · "Block uploader" · "Escalate" · "Dismiss"
STEPS     1. Open the page.
EXPECTED  Tokens and `ActionButton`.
ACTUAL    15 lines in page.tsx: `bg-white/70`×5 (hand-rolled SubmitButton classes and the empty state), `text-[12px]`×8, `text-[13px]`×2, and `bg-warn-50` on Escalate.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-36 · Hard-coded light-only sizes and colours
PAGE      /admin/reviews
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    7 lines in page.tsx: `bg-white/60` (Supplier reason box), `text-[12px]`×4, `text-[13px]`×2, `min-h-[60px]`, and hand-made `rounded-lg border border-warn-200 bg-warn-50/60` frames.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-37 · Hard-coded sizes and colours
PAGE      /admin/corrections
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    4 lines in page.tsx: `style={{ color: 'rgb(var(--color-warn))' }}` (held name), `text-[13px]`×2, `text-[15px]`, and `text-[12px]` on the status chip.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-38 · Tailwind palette colours in place of tokens
PAGE      /admin/editorial-review   (queue + record page)
BUTTON    —
STEPS     1. Open the queue and a record.
EXPECTED  Tokens only.
ACTUAL    13 lines. page.tsx `statusMap`: `text-green-600`, `text-yellow-600`. [editorialId]/page.tsx `StatusBadge`: `bg-gray-100 text-gray-600`, `bg-green-100 text-green-700`, `bg-yellow-100`. `FlagCard`: `bg-yellow-500 text-white`, `text-green-900`, `text-[24px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-39 · Hard-coded type sizes and hand-rolled buttons
PAGE      /admin/live-studio-channels
BUTTON    "Connect" · "Release" · "Disconnect" · "Save"
STEPS     1. Open the page.
EXPECTED  `text-sn-*` and `ActionButton`.
ACTUAL    7 lines in page.tsx: `text-[14px]`×3, `text-[15px]`×2, `text-[13px]`×2. Buttons are local `PRESS`/`BTN_*` class strings (e.g. `BTN_BRAND = … bg-[var(--sn-accent)]`), not `ActionButton`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-40 · Hard-coded type sizes
PAGE      /admin/papic-storage
BUTTON    —
STEPS     1. Open the page.
EXPECTED  `text-sn-*`.
ACTUAL    9 lines: `text-[13px]` (old-photos-button.tsx ×3, backfill-tiles-button.tsx ×3, page.tsx) and `text-[15px]` (page.tsx, backfill-tiles-button.tsx).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-41 · Tailwind palette colours and hard-coded sizes
PAGE      /admin/gifts
BUTTON    —
STEPS     1. Open the page with `?createError=` or `?error=`.
EXPECTED  Tokens only.
ACTUAL    17 lines: `border-rose-200 bg-rose-50 … text-rose-900` (error banners), `style={{ color: 'rgb(var(--color-warn))' }}` / `rgb(var(--color-success))`, `text-[11px]`×4, `text-[14px]`×4, and `w-[200px]` (page.tsx); `text-[13px]` in shop-gifts-ledger.tsx and gift-limit-form.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-42 · Hard-coded colours and sizes in the editor chrome (not counting the preview swatches)
PAGE      /admin/colours
BUTTON    the mood cards
STEPS     1. Open the page.
EXPECTED  Tokens only, outside the swatches that show the draft.
ACTUAL    17 lines in colours-editor.tsx: mood card `bg-white shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.3)]`, `border-black/5`, `border-black/10`, `text-[12px]`×10, `text-[13px]`×4. Plus `text-[26px]` and `text-[12px]` in colours-sample.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group F notes**

- The own loading files `app/admin/concierge-abuse/loading.tsx` (`TablePageSkeleton`: a search toolbar and a bordered 5-column table the page never draws) and `app/admin/reviews/loading.tsx` never show. Middleware `adminMergedForward` sends both addresses to /admin/work?view=… (307) before they render, so they are dead files.
- The Apply / Decline confirm on /admin/corrections (`ConfirmForm` → `app/_components/confirm-dialog.tsx`) is a native `<dialog>`, not the shared `Sheet`. It is a shared component, so I did not judge it per page.
- Outside my pages: `lib/v2-catalog.ts` `fetchV2VendorCatalog` / `fetchV2CustomerCatalog` turn a refused read into `[]` for every caller, and `lib/comp-grants.ts` `formatRetailValueCentavos` hand-formats ₱ on the per-user comp pages too.
- F-21 depends on the project's PostgREST max-rows, which is not in the repo. `lib/vendor-earnings.ts` says it is 1,000.
- F-4 and the Prices tab only render while `plausibilityScannerEnabled()` is on. Checked in code only.
