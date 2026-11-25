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
- [ ] /admin/app-performance
- [ ] /admin/approvals
- [ ] /admin/ask
- [ ] /admin/background-videos
- [ ] /admin/booking-fees
- [ ] /admin/budget-planner
- [ ] /admin/business
- [ ] /admin/catalogue
- [ ] /admin/categories
- [ ] /admin/categories/requests
- [ ] /admin/chat-flags
- [ ] /admin/colours
- [ ] /admin/completions
- [ ] /admin/compliance/data-sheet
- [ ] /admin/concierge-abuse
- [ ] /admin/corrections
- [ ] /admin/data-privacy
- [ ] /admin/demand
- [ ] /admin/demo-vendors/inquiries
- [ ] /admin/directory
- [ ] /admin/discount-codes/new
- [ ] /admin/disputes
- [ ] /admin/editorial-review
- [ ] /admin/email-delivery
- [ ] /admin/event-deletions
- [ ] /admin/force-majeure
- [ ] /admin/founder-seats
- [ ] /admin/fraud
- [ ] /admin/gifts
- [ ] /admin/help
- [ ] /admin/help/guides
- [ ] /admin/hub-music
- [ ] /admin/integrations
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
- [ ] /admin/pricing
- [ ] /admin/receipts
- [ ] /admin/repost-watch
- [ ] /admin/reviews
- [ ] /admin/search-memory
- [ ] /admin/secrets
- [ ] /admin/settings/payment-methods
- [ ] /admin/studio
- [ ] /admin/subscriptions
- [ ] /admin/switches
- [ ] /admin/team
- [ ] /admin/ugat
- [ ] /admin/ugat/map
- [ ] /admin/user-reports
- [ ] /admin/vendor-partnerships
- [ ] /admin/vendor-recommendations
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

### L-1 · Government-ID shelf is read with the service role behind the layout gate only
PAGE      /admin/verification-docs
BUTTON    —
STEPS     1. Open `apps/web/app/admin/verification-docs/page.tsx`. 2. Follow `buildVerificationDocsReport` and `verificationDocSupplierNames`.
EXPECTED  The page calls `requireAdmin()` itself before any service-role read (the rule written in `lib/admin/require-admin.ts`: "a Next.js layout is NOT a safe auth boundary … Every admin PAGE that touches the service-role client must call requireAdmin() itself").
ACTUAL    No `requireAdmin` in the page. `lib/verification-docs-server.ts` (`buildVerificationDocsReport`) and `lib/verification-doc-suppliers.server.ts` both call `createAdminClient()`; only `app/admin/layout.tsx` gates. The shelf lists strangers' government-ID files and supplier names. (The view/delete actions are gated; the listing is not.)
SHOTS     phase B: n/a (access, not layout) — confirm a non-admin sign-in gets 404
RULE      Task check 2 (admin gates, server-side) · `lib/admin/require-admin.ts` contract
SEVERITY  money-signin
SOURCE    CODE

### L-2 · Three more pages lean on the layout gate alone
PAGE      /admin/demand · /admin/venues/new · /admin/more
BUTTON    —
STEPS     1. Open each `page.tsx`. 2. Look for `requireAdmin`.
EXPECTED  Every /admin page checks for an admin server-side itself.
ACTUAL    None of the three calls `requireAdmin()`. Exposure is small: `/admin/demand` reads through the RLS client (`demand_radar_admin` re-gates in SQL) but its `after(() => maybeRefreshDemandRadar())` runs a service-role rebuild on any request that reaches the page; `/admin/venues/new` draws a form whose `createVenue` action is gated; `/admin/more` is a static menu. Listed for consistency with the rule, not as a leak.
SHOTS     phase B: n/a
RULE      Task check 2 (admin gates)
SEVERITY  wrong
SOURCE    CODE

### L-3 · Admin never goes dark: the console is not on the dark ready-list
PAGE      every /admin page
BUTTON    Preferences › Dark (the appearance switch)
STEPS     1. Pick Dark. 2. Open any /admin page.
EXPECTED  Every signed-in screen works in dark (kit § 5.7; DARK_MODE_STANDARD § 1 gives admin its own monochrome dark family).
ACTUAL    `lib/appearance.ts` `DARK_READY` has no `/admin` entry, so the whole console paints Light. `app/admin/_components/admin-look.css` says so itself: "DARK IS WRITTEN, NOT YET SWITCHED ON … its screens have not been swept for hard-coded colours". The per-page K2 findings below list the light-only colours that block switching it on.
SHOTS     phase B: 1280 px + 375 px with Dark chosen
RULE      HOUSE_DESIGN_STANDARD Part K2 · DARK_MODE_STANDARD § 1 (Admin = monochrome) · kit § 5.7
SEVERITY  look
SOURCE    CODE

### L-4 · The admin dark set gives static cards a shadow
PAGE      every /admin page (once dark is switched on)
BUTTON    —
STEPS     1. Open `app/admin/_components/admin-look.css`, block `html.dark:has([data-admin-look])`.
EXPECTED  In dark the page is flat, cards are one step lighter, and static cards carry no shadow.
ACTUAL    The dark block sets `--sn-frame-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 14px 30px -14px …` and `--sn-frame-shadow-tile`, so every `.sn-frame` / `.sn-tile` / `.sn-row` would wear a lift shadow in dark.
SHOTS     phase B: only if dark is switched on for admin by then
RULE      HOUSE_DESIGN_STANDARD Part K2.1 ("no shadows") · Part I.4 (shadows only on floating overlays)
SEVERITY  look
SOURCE    CODE

### L-5 · 39 pages load with the overview's skeleton
PAGE      /admin/admin-log · /admin/approvals · /admin/ask · /admin/background-videos · /admin/booking-fees · /admin/business · /admin/chat-flags · /admin/colours · /admin/compliance/data-sheet · /admin/corrections · /admin/data-privacy · /admin/demand · /admin/editorial-review · /admin/email-delivery · /admin/event-deletions · /admin/founder-seats · /admin/fraud · /admin/gifts · /admin/hub-music · /admin/integrations · /admin/integrity-watch · /admin/launch-offer · /admin/live-studio-channels · /admin/offers · /admin/pakanta · /admin/papic-storage · /admin/pax-changes · /admin/repost-watch · /admin/search-memory · /admin/secrets · /admin/subscriptions · /admin/switches · /admin/team · /admin/user-reports · /admin/vendor-partnerships · /admin/vendor-recommendations · /admin/verification-docs · /admin/website-media · /admin/work
BUTTON    —
STEPS     1. Open any listed page on a slow connection.
EXPECTED  The skeleton draws only what that page draws (HOUSE_DESIGN_STANDARD F1: "Every loading.tsx mirrors its loaded layout").
ACTUAL    None of these has a `loading.tsx` of its own, so each shows `app/admin/loading.tsx` — the OVERVIEW's ghost ("Action queues panel — terracotta-tinted card + 4 queue tiles", "Stats — 8 tiles", "Nav tiles — 6 tiles"). That ghost also uses a hand-made terracotta frame (`border-terracotta/20 bg-terracotta/[0.03]`) on the monochrome console.
SHOTS     phase B: 375 px light on a throttled load of /admin/approvals and /admin/booking-fees
RULE      HOUSE_DESIGN_STANDARD F1 · CLAUDE.md §3 Loading ("the skeleton draws only what the page draws") · kit § 5.9
SEVERITY  wrong
SOURCE    CODE

### L-6 · Every form button spins while it works
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

