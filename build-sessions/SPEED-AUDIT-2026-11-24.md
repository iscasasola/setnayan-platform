# Speed audit: every page, 24 Nov 2026

> **Read-only.** No app code changed. This doc, plus four helpers in `scripts/audit/`, is the whole PR.
> **For:** the controller and later builders. It ranks every page and groups the fixes into batches that never share a file.
> **Owner rule:** every page loads in under 0.7 s at 390 px, with one batched read per screen.
> **The pattern to copy:** PR #8278, "perf(supplier): Shop and Toolkit reads in one round".

## 1 · The answer

<!-- gen:summary -->
| | pages |
|---|--:|
| Pages traced (every `page.tsx` under `apps/web/app`, `/dev` skipped) | 489 |
| **Over 3 rounds (route, layouts included)** | **459** |
| Over 3 rounds in the page's OWN reads (layouts aside) | 286 |
| 1–3 rounds | 30 |
| 4–9 rounds | 19 |
| 10–19 rounds | 372 |
| 20+ rounds | 68 |
| N+1 loops on a critical path (distinct sites) | 20 |
| Uncached `auth.getUser()` calls on a critical path (distinct sites) | 29 |
<!-- /gen:summary -->

**What this means:**

- **Most of the wait is in four shared files, not in the pages.**
  - The event layout (`app/dashboard/[eventId]/layout.tsx`) is 17 rounds for all 116 host pages.
  - The guest Event Hub layout (`app/[slug]/layout.tsx`) is 12 for the 17 guest pages.
  - The supplier layout is 11, for 91 pages; the admin layout is 10, for 119.

  A page renders beside its layouts, so no page under them can finish sooner, however lean it is. **343 pages** sit under those four, and for **339 pages** a layout is the slowest part of the route or ties with the page. Fixing the layouts (batches L1–L6) takes 5 to 14 rounds off all of them at once.
- **286 pages are over 3 rounds through their own reads.**
  - The worst are long chains of `await`s that do not depend on each other: the Story loader, the supplier's client view, the guest Event Hub, the print page, the shop page, the payment page.
  - Each is the same fix #8278 made: start the reads at once and wait once.
  - **The payment return page (`/pay/[reference]`) writes inside its render.** When a buyer comes back from Maya with an open checkout, `app/pay/[reference]/maya-return.ts:mayaPayState` runs `settleMaya` → `approvePaymentCore`, then `notifyBuyerIfAny` → `emitNotification` (a notice, an email, a push), all before the first byte: about 45 rounds. Approving must finish before the page says "paid". The notice, email and push could move to `after()`. That changes when the email leaves, not what it says, so it is the controller's call.
- **30 pages are already at 3 rounds or fewer.** They are the auth forms, the tour, the sample, the site-editor entry pages and a few token pages.
- **Three shared readers sit under many pages and need their own batch, not a per-page fix:**
  - the entitlement gates (`lib/entitlements.ts`, `lib/couple-website-pro.ts`);
  - who may see a guest page (`lib/slug-access.ts`);
  - the editorial loader (`app/[slug]/_components/editorial/data.ts`).
- **Live, signed out:** every public page measured sent its first byte **under 0.7 s of server wait** (slowest: `/open-shop` 0.67 s, `/features` 0.64 s). The public shell has no signed-in work to do for a stranger. The signed-in pages are where the rounds are.

### How long is a round?

This is an estimate, not a measurement:

- PR #8278 measured the signed-in Shop live: its stream ended about **1.67 s** in.
- This tracer counts **26 rounds** on that page today.
- That puts a round at roughly **60 ms** on the live stack, render time included. Both ends are in Singapore (Vercel `sin1`, Supabase Singapore), so distance is small; most of a round is likely PostgREST and pool time.
- At that rate, **0.7 s holds about 10 rounds before any render time**. #8278's target of 2–3 rounds per screen leaves room for the render and the phone's own network.

## 2 · How it was measured

**The tracer: `scripts/audit/page-rounds.mjs`.** It parses every `page.tsx` (except `app/dev/**`), its layout chain, its `generateMetadata`, and every loader they import, following `@/` and relative imports through re-exports. Then it walks each function's body in statement order.

**What counts as a round:** a Supabase `.from()` / `.rpc()` / `storage`, `auth.getUser()`, `fetch()`, an R2 command, or `functions.invoke`. A round is a trip that must finish before the next can start, so two reads in one `Promise.all` are one round.

**The model.** Each point was checked against Next 15.5's own `create-component-tree.js`:

| Rule | Why |
|---|---|
| **Layouts and the page render in parallel.** A route's rounds are the max of its segments. | A layout's `children` is a `LayoutRouter` (a client element); the page's RSC renders in its own seed-data slot. |
| **An async server child starts only after its parent returns**, so it adds its rounds after the parent's. | This is exactly the wait #8278's `preloadServicesManager` / `preloadOneAnalytics` removed. |
| **A Supabase builder is lazy.** It starts when it is awaited, put in `Promise.all`, `.then`-ed or `Promise.resolve`-d. | That is how PostgREST builders work. |
| **React `cache()` and `askedOnce` (`lib/request-once.ts`) answer once per render.** A second call costs nothing. | `getCurrentUser`, `createClient`, `getDashboardShell`, the `*Once` entitlement readers. |
| **Known runtime branches are taken as they run on a page:** `insideRender()` is true; `onTheCachedHub()` is false except on the cached hub. | `eventSkuActive` takes its batched `skuActiveInRender` reader on a page. |
| **A `prop ?? <Default/>` child drops out when the parent passes that prop.** | `AppRailShell` draws `SignedInCluster` only when no `topBarSlot` is handed in. The supplier and admin layouts hand one in. |
| **Error retries are not a normal open.** `if (res.error) retry`, `x.error ? retry : x` and `if (!error) return` take the happy path. A branch that reaches `redirect()` / `notFound()` is not this page's open. | |
| **Other `if`/`?:` take the slower branch.** | This is the slowest normal open: every list has rows, every check runs. |
| **A paging loop (`for (;;)`, `while`) runs once; an item loop that awaits a read is an N+1**, counted as 3 trips through its body. | |

**Two numbers per page:**

- **now**: statement order, every `await` blocking (what the code does today).
- **after**: dataflow only. Each read starts once the values it uses are ready, and a child's reads start once its props are ready (the #8278 preload). It is the floor a fix in #8278's pattern reaches **without a new RPC**.

**Checked against #8278 itself.** On #8278's branch the tracer counts the Shop's own reads at **16 rounds**, against **26 on main**: 10 fewer. The PR reports 12–14 → 3 for the service list and 6–7 → 2–3 for the carousel. The direction and size agree. The Shop's route total then sits at the supplier layout's 11, which is batch L2.

**Limits, said plainly:**

- It cannot follow dynamic dispatch, class methods or object-of-functions services; those count 0.
- The "slower branch" rule can overstate a page whose slow branch is rare. One example is the event layout's co-host branch (`event_moderators`), which a couple never takes.
- Fewer rounds is not the same as fewer milliseconds. A fat single read can still be slow.
- Use the numbers to **rank** and to **name the chain**. Then confirm a page with the live walk after its fix ships, as #8278 does.

**Live: `scripts/audit/live-ttfb.mjs` and `scripts/audit/live-js-weight.mjs`.**

- Plain GETs on public pages of https://www.setnayan.com, signed out, one request at a time. The site served `4380e47` from `sin1` during the run.
- Each page was asked 3 times and the median kept.
- **Server wait** = TTFB − connect (curl `time_starttransfer − time_pretransfer`). It strips this container's own TLS and proxy hop. `/manifest.json`, a static file, waits about 0.06 s, so anything above that is the render.
- Client JS = every `/_next/static/…js` a page's HTML loads, gzipped as served.
- CI's main-branch builds were all cancelled in the queue on 24 Nov, so the build's per-route "First Load JS" table was not there to read. The live chunks stand in for it, for public pages only.

**To regenerate:**

```bash
node scripts/audit/page-rounds.mjs --json /tmp/rounds.json
```

```bash
node scripts/audit/live-ttfb.mjs > /tmp/ttfb.tsv
```

```bash
node scripts/audit/live-js-weight.mjs > /tmp/js.tsv
```

```bash
node scripts/audit/speed-report.mjs /tmp/rounds.json /tmp/ttfb.tsv /tmp/js.tsv build-sessions/SPEED-AUDIT-2026-11-24.md
```

To see one page's whole critical path:

```bash
node scripts/audit/page-rounds.mjs --route '/dashboard/[eventId]/budget' --explain
```

The tracer needs `typescript`: the workspace's own after `pnpm install`, or `TS_PATH=…`.

## 3 · The floor: shells and layouts

Every page renders beside its layouts. A layout's rounds are therefore the least any page under it can take. The `(shell)` row is for a SIGNED-IN visitor; a stranger skips its `SignedInCluster` (see §7).

<!-- gen:layouts -->
| Layout | Pages under it | Rounds now | What causes them | Kids drawn after it returns | Rounds after |
|---|--:|--:|---|---|--:|
| `app/dashboard/[eventId]/layout.tsx` | 116 | 17 | lib/dashboard-shell.ts:getDashboardShell (8) · lib/logo-plays.server.ts:logoPlaysFor (5) · lib/auth.ts:getCurrentUser (1) · lib/event-membership-once.ts:eventMemberTypeOnce (1) | – | 3 |
| `app/[slug]/layout.tsx` | 17 | 12 | app/[slug]/_lib/hub-look.ts:resolveHubTheme (10) · lib/event-type-profile.ts:resolveProfile (1) | – | 3 |
| `app/vendor-dashboard/layout.tsx` | 91 | 11 | lib/chat-reminders.server.ts:deliverDueChatReminders (7) · <Spotlight> (_components/spotlight) (2) · lib/auth.ts:getCurrentUser (1) · lib/notifications.ts:countUnread (1) | AppRailShell 1, PromoFreeWindowBannerVendor 1, Spotlight 2 | 6 |
| `app/(hub)/layout.tsx` | 3 | 10 | lib/dashboard-shell.ts:getDashboardShell (8) · lib/hub-shell.ts:hubDrawsTheShell (1) · <AppRailShell> (_components/frontdoor/app-rail-shell) (1) | AppRailShell 1 | 3 |
| `app/(shell)/layout.tsx` | 52 | 10 | <AppRailShell> (_components/frontdoor/app-rail-shell) (10) | AppRailShell 10 | 2 |
| `app/admin/layout.tsx` | 119 | 10 | lib/admin-map/admin-row-index.ts:fetchAdminRows (3) · app/_components/account-switcher/get-switcher-data.ts:getSwitcherData (2) · lib/admin/require-admin.ts:requireAdmin (2) · lib/auth.ts:getCurrentUser (1) | AppRailShell 1 | 3 |
| `app/dashboard/(account)/layout.tsx` | 18 | 10 | lib/dashboard-shell.ts:getDashboardShell (8) · lib/auth.ts:getCurrentUser (1) · <AppRailShell> (_components/frontdoor/app-rail-shell) (1) | AppRailShell 1 | 3 |
| `app/dashboard/[eventId]/messages/[threadId]/layout.tsx` | 1 | 10 | <CoupleMessagesPage> (dashboard/[eventId]/messages) (10) | CoupleMessagesPage 10 | 3 |
| `app/vendor-dashboard/messages/[threadId]/layout.tsx` | 1 | 7 | <SupplierChatsPage> (vendor-dashboard/messages) (7) | SupplierChatsPage 7 | 7 |
| `app/(hub)/dashboard/layout.tsx` | 2 | 4 | <DashboardLayout> (dashboard/layout) (4) | DashboardLayout 4 | 4 |
| `app/dashboard/layout.tsx` | 134 | 4 | <Spotlight> (_components/spotlight) (2) · lib/auth.ts:getCurrentUser (1) · lib/user-row.ts:getUserRow (1) | Spotlight 2 | 4 |
| `app/sample/layout.tsx` | 3 | 2 | lib/sample-event/switch.server.ts:sampleOpensHere (2) | – | 1 |
| `app/layout.tsx` | 489 | 1 | lib/app-colours.server.ts:getAppColours (1) | – | 1 |
<!-- /gen:layouts -->

**What to do in each, in #8278's pattern:**

- **L1 · signed-in shell** (`app/_components/frontdoor/signed-in-cluster.tsx` → `lib/dashboard-shell.ts:getDashboardShell` → `lib/chat-reminders.server.ts:deliverDueChatReminders` → `lib/notifications.ts:countUnread`)
  - Where it is drawn (the public shell, account and hub pages), it starts only after `AppRailShell` returns, which is after the layout returns. Its reads are the last thing on the page.
  - The fix: preload `getDashboardShell(user.id)` (already a `cache()`) inside each layout's own batch, so the cluster picks up a finished promise.
  - **`deliverDueChatReminders` is three reads, one claim and one notice per due reminder, all ahead of the bell count.** With nothing due it is one read. With reminders due it is 4 + N rounds on the critical path of every signed-in page.
  - Moving the delivery into `after()` (the bell then shows the reminder on the next open) is an owner call, not a speed fix. Ask first.
- **L2 · supplier layout** (`app/vendor-dashboard/layout.tsx`)
  - `getCurrentUser` → one chrome `Promise.all` (good) → `deliverDueChatReminders(…).then(countUnread)` inside it is the slow leg.
  - Then `<Spotlight>` (2 rounds) and the promo banner start only after the layout returns. Preload both with the chrome batch.
  - The tracer's "after" is 6: the profile → tier probe → deal-banner chain is a true dependency unless one select carries the tier columns, which `vendorProfilePromise` could.
- **L3 · event layout** (`app/dashboard/[eventId]/layout.tsx`), 116 pages.
  - Today, one step after another: `getCurrentUser` → `eventMemberTypeOnce` → (co-host only) `event_moderators` → `getDashboardShell` → `logoPlaysFor` (the moving-logo gate: `eventAnimatedMonogramActive` → `eventSkuActive` → `eventHubOwnership`).
  - Start the shell read, the event row and the logo gate beside the membership read. The membership answer only decides whether to `notFound()`. Gate the render on it, not the reads.
  - Floor: 3.
- **L4 · admin layout** (`app/admin/layout.tsx`)
  - Five `await`s in a row: `getCurrentUser` (1) → profile + unread + switcher (2) → `requireAdmin` (2) → `fetchAdminRows` + `fetchLearnedPicks` (3) → nav slots + queue digest (1).
  - None of the last three needs the one before. Start them with the first batch; `requireAdmin` still decides the render.
  - Floor: 3.
- **L5 · guest Event Hub** (`app/[slug]/layout.tsx` → `app/[slug]/_lib/loaders.ts:loadGuestLook`, and on the pages `lib/slug-access.ts:canViewSlugEvent`)
  - `loadGuestLook` waits for `loadEventShell` → `resolveProfile` → then `resolveHubTheme` (`app/[slug]/_lib/hub-look.ts`, 10 rounds in series) beside `websiteProActiveFor` (an entitlement walk, batch S1). The theme's reads mostly need only the event id: start them with the shell read.
  - `canViewSlugEvent` is a "who are you" waterfall: guest pass → host → seat → booked supplier → invited account. That is up to 16 rounds for a viewer who matches late. It also asks the auth server afresh three times (`lib/slug-access.ts:83`, `:281`, `lib/guest-session.ts:589`: plain `auth.getUser()`, not the cached `getCurrentUser`).
  - The fix: one `getCurrentUser`, then the five "is this person…" reads at once, deciding in the same order.
- **L6 · account / hub / public shells**
  - `app/dashboard/layout.tsx` (134 pages) draws `<Spotlight>` (2 rounds: `readSeenKeys`) only after it returns. Preload it with the layout's `getUserRow` read.
  - The `(shell)`, `(hub)` and `(account)` layouts wait on L1's cluster.

## 4 · The 30 slowest pages

These are ranked by the page's own rounds, with layouts aside: that is the part only the page's builder can fix.

**Two rows to read with care:**

- **#5 `/[slug]`.** The trace's slowest branch is a bare word that turns out to be a SHOP: the page then renders `/v/[slug]`'s body (`renderVendorBySlug`). So #5's fix is #6's. A guest's or a stranger's open of an event is served from the cached hub (`/[slug]/cached/[key]`, 60 s) by the middleware. The live render is for signed-in viewers and hosts.
- **#9 `/pay/[reference]`.** The rounds are the return-from-Maya settle (`mayaPayState` → `settleMaya` → `approvePaymentCore` → notifications, email, push). They are paid only when a checkout is open. See §1. "Route" is the total with layouts. Pages served from a `revalidate` copy (the cached Event Hub, the cached shop, print, E-Gifts, help articles) pay their rounds only on a refill, so they are listed in §7 and not ranked here.

<!-- gen:top30 -->
| # | Route | Role | Page rounds | Route rounds | What causes them | Fix (#8278 pattern) | After | Size |
|--:|---|---|--:|--:|---|---|--:|:-:|
| 1 | `/dashboard/[eventId]/story` | host | **100** | 100 | app/[slug]/_components/editorial/data.ts:loadEditorialData (40) · app/dashboard/[eventId]/story/_lib/load-make-it-yours.ts:loadMakeItYours (17) · app/[slug]/_components/editorial/data.ts:loadEditorialChaptersForEditor (13) | start the 15 serial reads at once (one `Promise.all`) · shared loader `isEditorialProActive` (its own batch) | 4 | L |
| 2 | `/vendor-dashboard/clients/[eventId]` | supplier | **83** | 83 | lib/agree-gifts.server.ts:fetchGiftNeeded (26) · <DetailsDecisions> (vendor-dashboard/clients/[eventId]/_components/details-decisions) (21) · fan-out .map() (6) | start the 19 serial reads at once (one `Promise.all`) · preload <DetailsDecisions> with the page's batch (`preload…` + `cache()`) · shared loader `resolveEventFeeGate`, `getEditorialEligibility`, `fetchGiftNeeded`, `fetchPlatformSettings`, `logoPlaysFor` (its own batch) | 12 | L |
| 3 | `/vendor-dashboard/customers/clients/[eventId]` (sheet) | supplier | **83** | 83 | lib/agree-gifts.server.ts:fetchGiftNeeded (26) · <DetailsDecisions> (vendor-dashboard/clients/[eventId]/_components/details-decisions) (21) · fan-out .map() (6) | start the 19 serial reads at once (one `Promise.all`) · preload <DetailsDecisions> with the page's batch (`preload…` + `cache()`) · shared loader `resolveEventFeeGate`, `getEditorialEligibility`, `fetchGiftNeeded`, `fetchPlatformSettings`, `logoPlaysFor` (its own batch) | 12 | L |
| 4 | `/vendor-dashboard/messages/clients/[eventId]` (sheet) | supplier | **83** | 83 | lib/agree-gifts.server.ts:fetchGiftNeeded (26) · <DetailsDecisions> (vendor-dashboard/clients/[eventId]/_components/details-decisions) (21) · fan-out .map() (6) | start the 19 serial reads at once (one `Promise.all`) · preload <DetailsDecisions> with the page's batch (`preload…` + `cache()`) · shared loader `resolveEventFeeGate`, `getEditorialEligibility`, `fetchGiftNeeded`, `fetchPlatformSettings`, `logoPlaysFor` (its own batch) | 12 | L |
| 5 | `/[slug]` | guest | **79** | 79 | app/v/[slug]/page.tsx:renderVendorBySlug (73) · lib/slug-forwarding.ts:resolveRenamedPath (5) · app/[slug]/_lib/loaders.ts:loadEventShell (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `resolveRenamedPath` (its own batch) | 6 | L |
| 6 | `/v/[slug]` | public (session-aware) | **73** | 73 | app/v/[slug]/page.tsx:fetchVendorAttributeDetails (7) · lib/guest-review-photos.server.ts:resolveGuestReviewPhotoUrls (7) · lib/slug-forwarding.ts:resolveRenamedPath (5) | start the 35 serial reads at once (one `Promise.all`) · N+1 at `app/v/[slug]/page.tsx:781` → one `.in()` read · shared loader `resolveRenamedPath`, `readThisMonthNotBookable`, `readShopWork`, `resolveGuestReviewPhotoUrls`, `fetchVendorPoolBookings`, `loadVendorFeaturedStories` (its own batch) | 6 | L |
| 7 | `/dashboard/[eventId]/messages/vendors/[vendorId]/workspace` (sheet) | host | **69** | 69 | <CoupleThreadBody> (dashboard/[eventId]/messages/[threadId]/_components/couple-thread-body) (19) · 8 reads in series (8) · lib/vendor-payment-methods.server.ts:readPublishedMethodsForCouple (7) | start the 33 serial reads at once (one `Promise.all`) · preload <CoupleThreadBody> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorBudgetSummary`, `readPublishedMethodsForCouple` (its own batch) | 12 | L |
| 8 | `/dashboard/[eventId]/vendors/[vendorId]/workspace` | host | **69** | 69 | <CoupleThreadBody> (dashboard/[eventId]/messages/[threadId]/_components/couple-thread-body) (19) · 8 reads in series (8) · lib/vendor-payment-methods.server.ts:readPublishedMethodsForCouple (7) | start the 33 serial reads at once (one `Promise.all`) · preload <CoupleThreadBody> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorBudgetSummary`, `readPublishedMethodsForCouple` (its own batch) | 12 | L |
| 9 | `/pay/[reference]` | signed-in | **68** | 68 | app/pay/[reference]/maya-return.ts:mayaPayState (47) · lib/payable-by-reference.ts:fetchPayableByReference (6) · lib/payable-by-reference.ts:fetchPayableByReference (6) | start the 10 serial reads at once (one `Promise.all`) · shared loader `fetchPayableByReference`, `fetchPayableByReference`, `fetchPlatformSettings` (its own batch) | 9 | L |
| 10 | `/dashboard/[eventId]/launch` | host | **66** | 66 | <WebsiteEditorPage> (dashboard/[eventId]/website/editor) (47) · lib/couple-website-pro.ts:eventCoupleWebsiteProActive (10) · 2 reads in series (2) | start the 9 serial reads at once (one `Promise.all`) · preload <WebsiteEditorPage> with the page's batch (`preload…` + `cache()`) · shared loader `eventCoupleWebsiteProActive` (its own batch) | 8 | L |
| 11 | `/dashboard/[eventId]/prints` | host | **66** | 66 | <LaunchHubPage> (dashboard/[eventId]/launch) (66) | preload <LaunchHubPage> with the page's batch (`preload…` + `cache()`) | 8 | L |
| 12 | `/dashboard/[eventId]/website/editor` | host | **59** | 59 | lib/post-event-compile.server.ts:readPostEventForMaker (40) · closure (12) · <MakerHeroPanel> (dashboard/[eventId]/launch/_components/maker-made-once) (6) | start the 3 serial reads at once (one `Promise.all`) · preload <MakerHeroPanel> with the page's batch (`preload…` + `cache()`) · shared loader `readPostEventForMaker` (its own batch) | 6 | L |
| 13 | `/dashboard/[eventId]/schedule` | host | **56** | 56 | lib/schedule-release.server.ts:readScheduleRelease (11) · app/dashboard/[eventId]/checklist-actions.ts:ensureChecklistSeeded (10) · lib/schedule-seed.server.ts:seedDefaultChapters (6) | start the 18 serial reads at once (one `Promise.all`) · preload <HostQuestions> with the page's batch (`preload…` + `cache()`) · shared loader `seedNonWeddingRunOfShow`, `seedDefaultChapters`, `readScheduleRelease` (its own batch) · `cache()` on `applyDelegateAccessWindow` (read by layout and page) | 6 | L |
| 14 | `/dashboard/[eventId]/vendors/categories` | host | **48** | 48 | app/dashboard/[eventId]/vendors/_actions/category-search.ts:searchCategoryVendors (42) · lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/supplier-find-read.ts:readFindList (2) | start the 5 serial reads at once (one `Promise.all`) | 9 | L |
| 15 | `/[slug]/find-seat` | guest | **47** | 47 | lib/slug-access.ts:canViewSlugEvent (16) · app/[slug]/_lib/loaders.ts:loadGuestLook (10) · app/[slug]/_lib/part-door.server.ts:partDoorHidden (3) | start the 17 serial reads at once (one `Promise.all`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L |
| 16 | `/admin/payments` | admin | **44** | 44 | app/admin/payments/page.tsx:fetchDeskBills (20) · app/admin/payments/page.tsx:fetchRecordTarget (4) · lib/platform-settings.ts:getEffectiveVatRatePct (3) | start the 16 serial reads at once (one `Promise.all`) · N+1 at `app/admin/payments/page.tsx:552` → one `.in()` read · shared loader `getEffectiveVatRatePct`, `fetchPlatformSettings` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L |
| 17 | `/[slug]/find-my-table` | guest | **37** | 37 | lib/slug-access.ts:canViewSlugEvent (16) · <Shell> ([slug]/find-my-table) (10) · app/[slug]/_lib/room-links.server.ts:loadRoomLinks (3) | start the 9 serial reads at once (one `Promise.all`) · preload <Shell> with the page's batch (`preload…` + `cache()`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L |
| 18 | `/vendor-dashboard/on-the-day/live/[eventId]` | supplier | **37** | 37 | lib/vendor-room-access.ts:fetchVendorRoomEvents (6) · lib/vendor-room-access.ts:fetchVendorRoomEvents (6) · 3 reads in series (3) | start the 17 serial reads at once (one `Promise.all`) · preload <HubToolPanels> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorRoomEvents`, `fetchVendorRoomEvents`, `resolveEventFeeGate`, `readEventScanServices` (its own batch) | 6 | L |
| 19 | `/dashboard` | host | **36** | 36 | <MemoriesSegment> (dashboard/(account)/library/_components/memories-segment) (31) · app/_components/account-switcher/get-switcher-data.ts:getSwitcherData (2) · lib/people-roster.ts:waitingRequestCount (2) | start the 3 serial reads at once (one `Promise.all`) · preload <MemoriesSegment> with the page's batch (`preload…` + `cache()`) | 9 | L |
| 20 | `/dashboard/[eventId]/vendors` | host | **36** | 36 | <BookedSlot> (dashboard/[eventId]/vendors/_components/booked-slot) (8) · app/dashboard/[eventId]/vendors/page.tsx:fetchVendorPhotoMaps (4) · lib/budget-allocation-data.ts:resolveAllocationInputs (4) | start the 15 serial reads at once (one `Promise.all`) · preload <BookedSlot> with the page's batch (`preload…` + `cache()`) · shared loader `resolveAllocationInputs`, `setnayanAiTierInApp`, `readCalendarTruth` (its own batch) | 6 | L |
| 21 | `/vendor/claim/[token]/finalize` | public (session-aware) | **34** | 34 | lib/vendor-invite-actions.ts:applyClaimAutoLink (18) · lib/vendor-invites.ts:fetchClaimLandingByToken (7) · 2 reads in series (2) | start the 9 serial reads at once (one `Promise.all`) · shared loader `fetchClaimLandingByToken`, `applyClaimAutoLink` (its own batch) | 9 | L |
| 22 | `/vendor-dashboard/customers` | supplier | **33** | 33 | <CustomersPipeline> (vendor-dashboard/customers) (33) | preload <CustomersPipeline> with the page's batch (`preload…` + `cache()`) | 10 | L |
| 23 | `/vendor-dashboard/messages/[threadId]` | supplier | **33** | 33 | lib/agree-gifts.server.ts:fetchAgreeGiftBasis (24) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · 2 reads in series (2) | start the 9 serial reads at once (one `Promise.all`) · shared loader `fetchAgreeGiftBasis` (its own batch) | 8 | L |
| 24 | `/vendor-dashboard` | supplier | **33** | 33 | fan-out .map() (15) · lib/vendor-overview.ts:fetchVendorOverviewData (8) · lib/vendor-first-steps.server.ts:fetchVendorFirstStepsState (3) | start the 6 serial reads at once (one `Promise.all`) · preload <PapersRenewalLine> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorOverviewData`, `fetchVendorFirstStepsState` (its own batch) | 7 | L |
| 25 | `/panood/control/[eventId]` | guest | **32** | 32 | lib/live-studio-readiness-server.ts:fetchReadinessFacts (6) · lib/entitlements.ts:eventSkuActive (3) · lib/panood-control-room-access.ts:isLiveStudioSetupHost (2) | start the 21 serial reads at once (one `Promise.all`) · shared loader `eventSkuActive`, `fetchReadinessFacts` (its own batch) | 3 | L |
| 26 | `/dashboard/[eventId]/guests` | host | **31** | 31 | app/dashboard/[eventId]/guests/_components/guest-card-data.ts:loadGuestCard (7) · lib/guest-helper-card.server.ts:loadGuestHelperCard (4) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `loadGuestHelperCard` (its own batch) | 8 | L |
| 27 | `/dashboard/[eventId]` | host | **31** | 31 | <EventDashboard> (dashboard/[eventId]/_components/event-dashboard) (12) · lib/entitlements.ts:eventOwnsSku (8) · fan-out .map() (4) | start the 6 serial reads at once (one `Promise.all`) · preload <EventDashboard> with the page's batch (`preload…` + `cache()`) · shared loader `eventOwnsSku`, `resolveSetnayanAiDisplayPricePhp` (its own batch) | 13 | L |
| 28 | `/dashboard/[eventId]/studio/website-pro` | host | **31** | 31 | lib/event-services.server.ts:readEventServices (30) · lib/auth.ts:getCurrentUser (1) | shared loader `readEventServices` (its own batch) | 4 | L |
| 29 | `/papic/me/[token]` | guest/host | **31** | 31 | <GuestGallery> (papic/me/[token]) (14) · lib/papic-limited.ts:resolveGuestCamera (12) · lib/papic-guest.ts:eventPapicGuestAccess (3) | start the 4 serial reads at once (one `Promise.all`) · preload <GuestGallery> with the page's batch (`preload…` + `cache()`) · shared loader `resolveGuestCamera`, `eventPapicGuestAccess` (its own batch) | 5 | L |
| 30 | `/vendor-dashboard/subscription` (sheet) | supplier | **30** | 30 | <PlanScreen> (vendor-dashboard/subscription/_components/plan-screen) (30) | preload <PlanScreen> with the page's batch (`preload…` + `cache()`) | 6 | L |
<!-- /gen:top30 -->

## 5 · Fix batches, by file area

**Rules for the controller:**

- **No two batches share a file.** A layout or shared-loader batch (L, S) owns the files it lists. A page batch (P) owns only page folders: each `page.tsx` with its own `_components/` and `_lib/`.
- When a page's fix needs a change inside an L or S file, that page waits for that batch. Its row says "shared loader … (its own batch)".
- **Order:** L1–L6 first, because each one fixes every page under it. Then S1–S4. Then the P batches in the owner's order: suppliers and payments, then couples and guests, then admin.
- **Every batch copies #8278:**
  - start each read the moment its inputs exist (a promise, not an `await`);
  - preload async children with the parent's batch through a per-request `cache()`;
  - keep each read's honest-failure shape;
  - pin it with a source test like `the-shop-streams-in-one-round.test.ts`.
- **"Speeds up"** counts the pages whose critical path passes through the batch's files at 2+ rounds, or whose layout it is.

<!-- gen:batches -->
### L1 · Signed-in shell: the bell, reminders and rail account

**Owns:** `app/_components/frontdoor/signed-in-cluster.tsx` · `app/_components/frontdoor/app-rail-shell.tsx` · `app/_components/frontdoor/rail-data.ts` · `lib/dashboard-shell.ts` · `lib/chat-reminders.server.ts` · `lib/notifications.ts`  
**Speeds up:** 280 pages (the file is on their critical path at 2+ rounds, or is their layout)

### L2 · Supplier layout

**Owns:** `app/vendor-dashboard/layout.tsx`  
**Speeds up:** 91 pages (the file is on their critical path at 2+ rounds, or is their layout)

### L3 · Event layout (every host page)

**Owns:** `app/dashboard/[eventId]/layout.tsx` · `lib/logo-plays.server.ts`  
**Speeds up:** 121 pages (the file is on their critical path at 2+ rounds, or is their layout)

### L4 · Admin layout

**Owns:** `app/admin/layout.tsx` · `lib/admin/require-admin.ts` · `lib/admin-map/admin-row-index.ts` · `lib/admin/queue-counts.ts` · `app/_components/account-switcher/get-switcher-data.ts`  
**Speeds up:** 122 pages (the file is on their critical path at 2+ rounds, or is their layout)

### L5 · Guest Event Hub layout + who-may-see-it

**Owns:** `app/[slug]/layout.tsx` · `app/[slug]/_lib/loaders.ts` · `app/[slug]/_lib/hub-look.ts` · `lib/slug-access.ts` · `lib/guest-session.ts` · `lib/booked-supplier.ts` · `lib/guest-membership-session.ts` · `lib/guest-seat-read.ts`  
**Speeds up:** 26 pages (the file is on their critical path at 2+ rounds, or is their layout)

### L6 · Account, hub and public shells

**Owns:** `app/dashboard/layout.tsx` · `app/dashboard/(account)/layout.tsx` · `app/(hub)/layout.tsx` · `app/(hub)/dashboard/layout.tsx` · `app/(shell)/layout.tsx` · `lib/user-row.ts` · `app/_components/spotlight.tsx`  
**Speeds up:** 280 pages (the file is on their critical path at 2+ rounds, or is their layout)

### S1 · Entitlement gates (one batched answer per render)

**Owns:** `lib/entitlements.ts` · `lib/couple-website-pro.ts` · `lib/animated-monogram.ts` · `lib/event-entitlement-client.server.ts` · `lib/event-entitlement-client.ts` · `lib/retired-products.server.ts`  
**Speeds up:** 130 pages (the file is on their critical path at 2+ rounds, or is their layout)

### S2 · The editorial / Story loader

**Owns:** `app/[slug]/_components/editorial/data.ts` · `lib/story-suppliers.server.ts` · `lib/live-wall.ts`  
**Speeds up:** 7 pages (the file is on their critical path at 2+ rounds, or is their layout)

### S3 · Supplier identity reads

**Owns:** `lib/vendor-profile.ts` · `lib/active-shop.ts` · `lib/vendor-role.ts` · `lib/vendor-room-access.ts` · `lib/vendor-room-reads.ts` · `lib/vendor-schedule.ts` · `lib/piece-seats.ts`  
**Speeds up:** 69 pages (the file is on their critical path at 2+ rounds, or is their layout)

### S4 · Settings, profiles and catalogue readers

**Owns:** `lib/platform-settings.ts` · `lib/event-type-profile.ts` · `lib/taxonomy-db.ts` · `lib/taxonomy-read.ts` · `lib/setnayan-ai-server.ts` · `lib/vendor-event-fee-access.server.ts` · `lib/seating.ts`  
**Speeds up:** 76 pages (the file is on their critical path at 2+ rounds, or is their layout)

### P1 · Supplier: shop, services, packages

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 25 · **rounds now (sum):** 264 · **rounds a fix can take off:** 113 · **sizes:** 7 S, 13 M, 5 L

<details><summary>Folders</summary>

- `app/vendor-dashboard/attributes`
- `app/vendor-dashboard/collections/albums`
- `app/vendor-dashboard/collections`
- `app/vendor-dashboard/invite`
- `app/vendor-dashboard/lines`
- `app/vendor-dashboard/moodboard-library`
- `app/vendor-dashboard/packages/[packageId]`
- `app/vendor-dashboard/packages`
- `app/vendor-dashboard`
- `app/vendor-dashboard/repertoire`
- `app/vendor-dashboard/services/[serviceId]`
- `app/vendor-dashboard/services/new/[category]`
- `app/vendor-dashboard/services/new`
- `app/vendor-dashboard/services/requests/[requestId]`
- `app/vendor-dashboard/services/requests/new`
- `app/vendor-dashboard/services/requests`
- `app/vendor-dashboard/services/their-work`
- `app/vendor-dashboard/shop/badges`
- `app/vendor-dashboard/shop`
- `app/vendor-dashboard/shop/promote`
- `app/vendor-dashboard/shop/qrs/[code]`
- `app/vendor-dashboard/shop/qrs`
- `app/vendor-dashboard/shop/store/[shelf]/[item]`
- `app/vendor-dashboard/shop/store/[shelf]`
- `app/vendor-dashboard/shop/store`

</details>

### P2 · Supplier: clients, messages, on-the-day, customers

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 23 · **rounds now (sum):** 492 · **rounds a fix can take off:** 352 · **sizes:** 8 S, 7 M, 8 L

<details><summary>Folders</summary>

- `app/vendor-dashboard/activities`
- `app/vendor-dashboard/clients/[eventId]/challenge-photos`
- `app/vendor-dashboard/clients/[eventId]/cocktail`
- `app/vendor-dashboard/clients/[eventId]/editorial-media`
- `app/vendor-dashboard/clients/[eventId]/mood-board`
- `app/vendor-dashboard/clients/[eventId]`
- `app/vendor-dashboard/clients/[eventId]/production-sheet`
- `app/vendor-dashboard/clients/[eventId]/seat-plan`
- `app/vendor-dashboard/clients/[eventId]/their-event/[part]`
- `app/vendor-dashboard/contracts/[contractId]`
- `app/vendor-dashboard/contracts/new`
- `app/vendor-dashboard/customers/@client/(..)clients/[eventId]`
- `app/vendor-dashboard/customers`
- `app/vendor-dashboard/disputes`
- `app/vendor-dashboard/manpower`
- `app/vendor-dashboard/messages/@client/(..)clients/[eventId]`
- `app/vendor-dashboard/messages/[threadId]`
- `app/vendor-dashboard/messages`
- `app/vendor-dashboard/notifications`
- `app/vendor-dashboard/on-the-day/live/[eventId]`
- `app/vendor-dashboard/on-the-day/live/[eventId]/papic`
- `app/vendor-dashboard/on-the-day`
- `app/vendor-dashboard/spaces`

</details>

### P3 · Supplier: plan, team, money, growth

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 20 · **rounds now (sum):** 200 · **rounds a fix can take off:** 98 · **sizes:** 2 S, 16 M, 2 L

<details><summary>Folders</summary>

- `app/vendor-dashboard/@rise/(.)profile`
- `app/vendor-dashboard/@rise/(.)settings`
- `app/vendor-dashboard/@rise/(.)subscription`
- `app/vendor-dashboard/@rise/(.)team`
- `app/vendor-dashboard/@rise/(.)website`
- `app/vendor-dashboard/booking-fees/[orderId]`
- `app/vendor-dashboard/booking-fees`
- `app/vendor-dashboard/creators`
- `app/vendor-dashboard/deep-search`
- `app/vendor-dashboard/partnerships`
- `app/vendor-dashboard/profile`
- `app/vendor-dashboard/recommendations`
- `app/vendor-dashboard/settings`
- `app/vendor-dashboard/subscription`
- `app/vendor-dashboard/team`
- `app/vendor-dashboard/team/roles/inquiries`
- `app/vendor-dashboard/team/roles`
- `app/vendor-dashboard/theft-watch`
- `app/vendor-dashboard/track-record`
- `app/vendor-dashboard/website`

</details>

### P4 · Payments (pay, receipts, the admin payments desk), claims, open-shop

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 13 · **rounds now (sum):** 250 · **rounds a fix can take off:** 195 · **sizes:** 3 S, 4 M, 6 L

<details><summary>Folders</summary>

- `app/admin/payments`
- `app/admin/payments/supplier-refunds`
- `app/open-shop`
- `app/pay/[reference]`
- `app/proposals/[publicId]`
- `app/receipts/[receiptId]`
- `app/receipts/order/[orderId]`
- `app/receipts/payment/[paymentId]`
- `app/vendor-invite/[slug]`
- `app/vendor/claim/[token]/finalize`
- `app/vendor/claim/[token]`
- `app/vendor/fit/[ref]`
- `app/vendor/lock/[token]`

</details>

### P5 · Host: Studio

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 23 · **rounds now (sum):** 298 · **rounds a fix can take off:** 233 · **sizes:** 4 S, 10 M, 9 L

<details><summary>Folders</summary>

- `app/dashboard/[eventId]/studio/about/[addon]`
- `app/dashboard/[eventId]/studio/guest-columns`
- `app/dashboard/[eventId]/studio/live-studio-control`
- `app/dashboard/[eventId]/studio/mood-board`
- `app/dashboard/[eventId]/studio/pakanta`
- `app/dashboard/[eventId]/studio/panood/broadcast`
- `app/dashboard/[eventId]/studio/panood/cameras`
- `app/dashboard/[eventId]/studio/panood/cameras/print`
- `app/dashboard/[eventId]/studio/panood/setup`
- `app/dashboard/[eventId]/studio/papic/challenges`
- `app/dashboard/[eventId]/studio/papic/crew`
- `app/dashboard/[eventId]/studio/papic/crew/poster`
- `app/dashboard/[eventId]/studio/papic/moderation`
- `app/dashboard/[eventId]/studio/papic/recap`
- `app/dashboard/[eventId]/studio/papic/run-of-show`
- `app/dashboard/[eventId]/studio/patiktok/[templateId]`
- `app/dashboard/[eventId]/studio/patiktok/booth`
- `app/dashboard/[eventId]/studio/patiktok`
- `app/dashboard/[eventId]/studio/photo-delivery`
- `app/dashboard/[eventId]/studio/save-the-date`
- `app/dashboard/[eventId]/studio/save-the-date/stamp`
- `app/dashboard/[eventId]/studio/setnayan-ai`
- `app/dashboard/[eventId]/studio/website-pro`

</details>

### P6 · Host: Event Hub maker, story, logo, invitation, memories

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 19 · **rounds now (sum):** 500 · **rounds a fix can take off:** 426 · **sizes:** 2 S, 5 M, 12 L

<details><summary>Folders</summary>

- `app/dashboard/[eventId]/alaala`
- `app/dashboard/[eventId]/apple-pro`
- `app/dashboard/[eventId]/galleries`
- `app/dashboard/[eventId]/invitation`
- `app/dashboard/[eventId]/invitation/print`
- `app/dashboard/[eventId]/launch`
- `app/dashboard/[eventId]/memories/download-all`
- `app/dashboard/[eventId]/memories/thank-you`
- `app/dashboard/[eventId]/monogram`
- `app/dashboard/[eventId]/prints`
- `app/dashboard/[eventId]/story`
- `app/dashboard/[eventId]/website/editor`
- `app/dashboard/[eventId]/website/hero-photo`
- `app/dashboard/[eventId]/website/living-hero`
- `app/dashboard/[eventId]/website/our-photos`
- `app/dashboard/[eventId]/website/our-story`
- `app/dashboard/[eventId]/website/site-chrome`
- `app/dashboard/[eventId]/website/stories`
- `app/dashboard/[eventId]/website/widgets`

</details>

### P7 · Host: guests, seating, live, people

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 19 · **rounds now (sum):** 202 · **rounds a fix can take off:** 143 · **sizes:** 6 S, 8 M, 5 L

<details><summary>Folders</summary>

- `app/dashboard/[eventId]/access-requests`
- `app/dashboard/[eventId]/event-qr`
- `app/dashboard/[eventId]/guests/[guestId]`
- `app/dashboard/[eventId]/guests/checkin`
- `app/dashboard/[eventId]/guests/claims`
- `app/dashboard/[eventId]/guests/invite`
- `app/dashboard/[eventId]/guests/new`
- `app/dashboard/[eventId]/guests`
- `app/dashboard/[eventId]/guests/send`
- `app/dashboard/[eventId]/guests/souvenirs`
- `app/dashboard/[eventId]/guests/tea-ceremony`
- `app/dashboard/[eventId]/live`
- `app/dashboard/[eventId]/manpower`
- `app/dashboard/[eventId]/nikah`
- `app/dashboard/[eventId]/seating/chart`
- `app/dashboard/[eventId]/seating/lab`
- `app/dashboard/[eventId]/seating`
- `app/dashboard/[eventId]/seating/walkthrough`
- `app/dashboard/[eventId]/sponsors`

</details>

### P8 · Host: suppliers, money, details, the rest

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 21 · **rounds now (sum):** 489 · **rounds a fix can take off:** 378 · **sizes:** 4 S, 6 M, 11 L

<details><summary>Folders</summary>

- `app/dashboard/[eventId]/budget`
- `app/dashboard/[eventId]/date-selection`
- `app/dashboard/[eventId]/details/@field/(.)field/[row]`
- `app/dashboard/[eventId]/details/field/[row]`
- `app/dashboard/[eventId]/details`
- `app/dashboard/[eventId]/documents`
- `app/dashboard/[eventId]/find-date`
- `app/dashboard/[eventId]/messages/@supplier/(..)vendors/[vendorId]/workspace`
- `app/dashboard/[eventId]/messages/[threadId]`
- `app/dashboard/[eventId]/messages`
- `app/dashboard/[eventId]/orders/[orderId]`
- `app/dashboard/[eventId]/orders`
- `app/dashboard/[eventId]/pabuya`
- `app/dashboard/[eventId]`
- `app/dashboard/[eventId]/refer`
- `app/dashboard/[eventId]/schedule`
- `app/dashboard/[eventId]/vendors/[vendorId]/review`
- `app/dashboard/[eventId]/vendors/[vendorId]/workspace`
- `app/dashboard/[eventId]/vendors/categories`
- `app/dashboard/[eventId]/vendors/packages/[bookingId]`
- `app/dashboard/[eventId]/vendors`

</details>

### P9 · Host: account pages, hub, create

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 22 · **rounds now (sum):** 266 · **rounds a fix can take off:** 168 · **sizes:** 9 S, 7 M, 6 L

<details><summary>Folders</summary>

- `app/(hub)/dashboard/@modal/(.)create-event`
- `app/(hub)/dashboard`
- `app/(hub)`
- `app/dashboard/(account)/billing`
- `app/dashboard/(account)/clusters/[clusterId]`
- `app/dashboard/(account)/clusters`
- `app/dashboard/(account)/create-event`
- `app/dashboard/(account)/creator`
- `app/dashboard/(account)/life-flash`
- `app/dashboard/(account)/notifications`
- `app/dashboard/(account)/people/[dependentId]`
- `app/dashboard/(account)/profile/concierge`
- `app/dashboard/(account)/profile`
- `app/dashboard/(account)/samahan/[communityId]`
- `app/dashboard/(account)/search`
- `app/host/accept/[token]`
- `app/onboarding/[type]`
- `app/onboarding/simple`
- `app/onboarding/wedding`
- `app/samahan/chat/[threadId]`
- `app/u/[userSlug]/c/[chapterId]`
- `app/u/[userSlug]`

</details>

### P10 · Guest: Event Hub pages and shop pages (`/[slug]` renders the shop body too)

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 20 · **rounds now (sum):** 759 · **rounds a fix can take off:** 629 · **sizes:** 1 S, 2 M, 17 L

<details><summary>Folders</summary>

- `app/[slug]/avatar`
- `app/[slug]/cached/[key]`
- `app/[slug]/everyone`
- `app/[slug]/find-my-table`
- `app/[slug]/find-seat`
- `app/[slug]/hub`
- `app/[slug]/invite/enter`
- `app/[slug]/invite`
- `app/[slug]/invite/reply`
- `app/[slug]/pabuya`
- `app/[slug]`
- `app/[slug]/print`
- `app/[slug]/request`
- `app/[slug]/seat`
- `app/[slug]/venue`
- `app/[slug]/welcome`
- `app/v/[slug]/cached`
- `app/v/[slug]/guest-review`
- `app/v/[slug]`
- `app/v/[slug]/story/[eventSlug]`

</details>

### P11 · Guest: Papic, live, Panood, join, wall

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 17 · **rounds now (sum):** 225 · **rounds a fix can take off:** 160 · **sizes:** 4 S, 7 M, 6 L

<details><summary>Folders</summary>

- `app/3d_plan/demo/[token]`
- `app/i/[slug]`
- `app/join/[eventId]/connect/confirm`
- `app/join/[eventId]`
- `app/join/crew/[token]`
- `app/live`
- `app/live/screen`
- `app/panood/control/[eventId]`
- `app/panood/program/[eventId]`
- `app/papic/decorate`
- `app/papic/guest`
- `app/papic/join/[token]`
- `app/papic/me/[token]`
- `app/papic/order/[token]`
- `app/papic/pool`
- `app/papic/seat/[token]`
- `app/wall/[eventId]`

</details>

### P12 · Admin: people, suppliers, events

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 33 · **rounds now (sum):** 263 · **rounds a fix can take off:** 185 · **sizes:** 16 S, 13 M, 4 L

<details><summary>Folders</summary>

- `app/admin/account-deletions`
- `app/admin/accounts`
- `app/admin/approvals`
- `app/admin/chat-flags`
- `app/admin/completions`
- `app/admin/compliance/data-sheet`
- `app/admin/concierge-abuse`
- `app/admin/corrections`
- `app/admin/data-privacy`
- `app/admin/demo-vendors/inquiries/[threadId]`
- `app/admin/demo-vendors/inquiries`
- `app/admin/directory`
- `app/admin/disputes`
- `app/admin/event-deletions`
- `app/admin/events/[eventId]`
- `app/admin/force-majeure/[flagId]`
- `app/admin/force-majeure`
- `app/admin/fraud`
- `app/admin/integrity-watch`
- `app/admin/pax-changes`
- `app/admin/repost-watch`
- `app/admin/reviews`
- `app/admin/team`
- `app/admin/user-reports`
- `app/admin/users/[userId]`
- `app/admin/vendor-partnerships`
- `app/admin/vendor-recommendations`
- `app/admin/vendors/[vendorProfileId]/edit`
- `app/admin/vendors/[vendorProfileId]`
- `app/admin/vendors/[vendorProfileId]/plan`
- `app/admin/vendors/[vendorProfileId]/team`
- `app/admin/verification-docs`
- `app/admin/verify`

</details>

### P13 · Admin: money, catalogue, settings, the rest

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 25 · **rounds now (sum):** 254 · **rounds a fix can take off:** 191 · **sizes:** 6 S, 12 M, 7 L

<details><summary>Folders</summary>

- `app/admin/admin-log`
- `app/admin/app-performance`
- `app/admin/booking-fees`
- `app/admin/business`
- `app/admin/catalogue`
- `app/admin/categories`
- `app/admin/categories/requests/[requestId]`
- `app/admin/categories/requests`
- `app/admin/email-delivery`
- `app/admin/gifts`
- `app/admin/help`
- `app/admin/integrations`
- `app/admin/launch-offer`
- `app/admin/live-studio-channels`
- `app/admin/money`
- `app/admin/offers`
- `app/admin`
- `app/admin/pakanta`
- `app/admin/papic-storage`
- `app/admin/payouts`
- `app/admin/settings/payment-methods`
- `app/admin/studio`
- `app/admin/subscriptions`
- `app/admin/switches`
- `app/admin/work`

</details>

### P14 · Public pages, tour, sign-in, the rest

**Owns:** the page folders below (each `page.tsx` with its own `_components/` and `_lib/`), never a file a shared batch owns.  
**Pages over 3 own rounds:** 6 · **rounds now (sum):** 48 · **rounds a fix can take off:** 28 · **sizes:** 1 S, 5 M, 0 L

<details><summary>Folders</summary>

- `app/(shell)/explore/compare`
- `app/(shell)/help`
- `app/signup`
- `app/tour/budget`
- `app/tour/gallery`
- `app/tour/vendors`

</details>

<!-- /gen:batches -->

**Where one page batch's pages run through another page batch's file.** The owner batch changes the file; the other batch's page waits for it, or only starts the read earlier on its own side.

<!-- gen:cross -->
| File on the path | Owned by | Also on the path of (batch · route) |
|---|:-:|---|
| `app/[slug]/_components/editorial/consent-veto.ts` | P10 | `P6 /dashboard/[eventId]/story` |
| `app/[slug]/_components/guest-column-card.tsx` | P10 | `P11 /papic/guest` |
| `app/[slug]/_lib/event-words.ts` | P10 | `P8 /dashboard/[eventId]/pabuya`, `P6 /dashboard/[eventId]/website/our-story`, `P9 /host/accept/[token]`, `P11 /join/[eventId]` +3 |
| `app/[slug]/_lib/main-ground-picture.ts` | P10 | `P5 /dashboard/[eventId]/studio/save-the-date` |
| `app/dashboard/[eventId]/_components/guest-setup/one-link.server.ts` | P8 | `P7 /dashboard/[eventId]/guests/send` |
| `app/dashboard/[eventId]/_components/nikah-imam.ts` | P8 | `P7 /dashboard/[eventId]/nikah` |
| `app/dashboard/[eventId]/guests/_components/invite-message-setup.ts` | P7 | `P6 /dashboard/[eventId]/invitation` |
| `app/dashboard/[eventId]/guests/claims/page.tsx` | P7 | `P8 /dashboard/[eventId]/details/field/[row]` |
| `app/dashboard/[eventId]/launch/_components/details-your-event-load.tsx` | P6 | `P8 /dashboard/[eventId]/details/field/[row]` |
| `app/dashboard/[eventId]/studio/papic/moderation/_components/kwento-queue.tsx` | P5 | `P7 /dashboard/[eventId]/live` |
| `app/dashboard/[eventId]/website/_components/hub-draft-dock.tsx` | P6 | `P8 /dashboard/[eventId]/details` |
| `app/join/[eventId]/_components/join-flow.tsx` | P11 | `P10 /[slug]/invite` |
| `app/vendor-dashboard/shop/_components/autoreply-section.tsx` | P1 | `P2 /vendor-dashboard/customers` |
<!-- /gen:cross -->

**Shared-loader notes:**

- **S1 · entitlements.**
  - `eventHubOwnership` asks four plan SKUs at once, then the parts batch, then the openings SKU, then the prices: four rounds where two would do.
  - `eventSkuActive`, outside a render, walks orders → bundles → basket → promo → comp → internal → founder one by one. That is fine for an action (it must re-read), but every page call must reach `skuActiveInRender`.
  - The tracer found pages where it does not, because they call `eventOwnsSku` (no render branch). See the rows naming `eventOwnsSku`.
- **S2 · editorial.**
  - `loadEditorialData` starts a good `ahead` batch, then still awaits about 25 reads in series after it.
  - Some are true chains (photo ids → tags), but most only need `eventId`. Move them into `ahead`.
  - This one file is most of the Story page (100 rounds), the guest Event Hub's editorial and the print page.
- **S3 · supplier identity.** `fetchOwnVendorProfile` is `resolveActiveShop` → then the profile select: 2 rounds on 59 pages. One select by `user_id` with the active-shop rule in SQL (or `cache()` on the pair) makes it 1.
- **S4 · readers.** `fetchPlatformSettings` (26 pages), `resolveProfileByEvent` (24 pages), `getTaxonomy` and `fetchBooths` each take 2–3 rounds. Wrap each in `cache()` and start it with the page's batch.

## 6 · N+1 loops and fresh sign-in checks on a critical path

<!-- gen:loops -->
| Loop (file:line) | Reads per item | Pages it sits under |
|---|--:|--:|
| `lib/chat-reminders.server.ts:117` | 1 | 228 |
| `lib/papic-guest-blur-gate.ts:226` | 1 | 6 |
| `lib/papic-guest-blur-gate.ts:255` | 1 | 6 |
| `app/v/[slug]/page.tsx:781` | 2 | 4 |
| `app/[slug]/_components/editorial/consent-veto.ts:210` | 1 | 3 |
| `lib/story-suppliers.server.ts:109` | 2 | 3 |
| `lib/vendor-funnel.ts:112` | 1 | 3 |
| `lib/story-arrangement-store.ts:182` | 1 | 2 |
| `lib/verification-docs.ts:902` | 1 | 2 |
| `lib/officiant-auto-resolve.ts:220` | 1 | 2 |
| `lib/inspiration-tags.server.ts:178` | 1 | 2 |
| `app/admin/corrections/page.tsx:113` | 2 | 1 |
| `lib/old-photo-copies.server.ts:35` | 1 | 1 |
| `app/admin/payments/page.tsx:552` | 2 | 1 |
| `app/admin/payments/page.tsx:540` | 6 | 1 |
| `lib/calendar-truth.server.ts:53` | 1 | 1 |
| `lib/guest-connects-hosts.server.ts:188` | 1 | 1 |
| `app/dashboard/[eventId]/studio/papic/actions.ts:921` | 2 | 1 |
| `app/papic/join/[token]/page.tsx:91` | 2 | 1 |
| `app/vendor-dashboard/moodboard-library/actions.ts:621` | 3 | 1 |
<!-- /gen:loops -->

<!-- gen:getuser -->
| Fresh `auth.getUser()` (file:line) | Pages it sits under |
|---|--:|
| `lib/admin/require-admin.ts:38` | 119 |
| `lib/guest-session.ts:589` | 18 |
| `lib/slug-access.ts:83` | 7 |
| `lib/slug-access.ts:281` | 7 |
| `lib/guest-one-path.server.ts:57` | 5 |
| `lib/service-card-hides.server.ts:50` | 4 |
| `app/v/[slug]/_components/add-shop-to-event-data.ts:109` | 4 |
| `lib/shop-view-context.ts:32` | 4 |
| `lib/chat-actions.ts:58` | 3 |
| `lib/onboarding/services-step-server.ts:159` | 3 |
| `lib/articles.server.ts:336` | 2 |
| `app/dashboard/[eventId]/_components/details-guide-home-card.tsx:60` | 2 |
| `app/dashboard/[eventId]/checklist-actions.ts:58` | 2 |
| `lib/articles.server.ts:259` | 1 |
| `lib/guest-one-path.server.ts:76` | 1 |
| `lib/pabuya-recognition.ts:72` | 1 |
| `lib/host-gate.ts:144` | 1 |
| `lib/papic-gallery-scope.ts:40` | 1 |
| `lib/referral-actions.ts:45` | 1 |
| `lib/schedule-seed.server.ts:78` | 1 |
| `lib/schedule-seed.server.ts:172` | 1 |
| `app/dashboard/[eventId]/story/_lib/host-authority.ts:28` | 1 |
| `app/dashboard/[eventId]/vendors/_actions/category-search.ts:482` | 1 |
| `app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts:80` | 1 |
| `lib/papic-host-door.server.ts:27` | 1 |
| `app/dashboard/[eventId]/studio/papic/actions.ts:74` | 1 |
| `app/dashboard/[eventId]/studio/papic/actions.ts:917` | 1 |
| `lib/profile-viewer.ts:83` | 1 |
| `app/vendor-dashboard/moodboard-library/actions.ts:105` | 1 |
<!-- /gen:getuser -->

Each fresh `auth.getUser()` is a trip to the auth server that `getCurrentUser()` (`lib/auth.ts`, a `cache()`) would answer from the request.

## 7 · Live: public pages, signed out

Measured on 24 Nov 2026 against the live site, which served `4380e47` from `sin1`. Three GETs each, median, sorted by server wait. ⚠ marks a server wait over 0.7 s.

<!-- gen:ttfb -->
| Path | Status | TTFB median (s) | Server wait median (s) | Total (s) | HTML on the wire (KB) | JS gz (KB): total · own | Samples (TTFB s) |
|---|:-:|--:|--:|--:|--:|---|---|
| `/open-shop` | 200 | 0.728 | **0.673** | 1.138 | 56.8 | 150.9 · 51.6 | 0.963,0.728,0.687 |
| `/features` | 200 | 0.707 | **0.644** | 1.288 | 92.0 | 118.9 · 19.5 | 0.707,0.867,0.537 |
| `/tour/gallery` | 200 | 0.638 | **0.570** | 0.714 | 17.4 | 102.5 · 3.2 | 0.638,0.710,0.621 |
| `/tour/budget` | 200 | 0.537 | **0.472** | 0.946 | 22.1 | 115.4 · 16.1 | 0.526,0.679,0.537 |
| `/` | 200 | 0.526 | **0.465** | 0.788 | 22.6 | 105.6 · 6.3 | 0.526,0.577,0.485 |
| `/tour/seating` | 200 | 0.526 | **0.463** | 0.548 | 15.9 | – | 0.522,0.526,0.547 |
| `/tour/vendors` | 200 | 0.485 | **0.423** | 0.500 | 16.3 | – | 0.494,0.479,0.485 |
| `/signup` | 200 | 0.449 | **0.389** | 0.652 | 15.8 | 99.4 · 0.1 | 0.449,0.666,0.391 |
| `/samahan` | 200 | 0.433 | **0.376** | 0.621 | 19.2 | – | 0.364,0.553,0.433 |
| `/tl/about` | 200 | 0.438 | **0.373** | 0.441 | 17.5 | – | 0.386,0.451,0.438 |
| `/privacy` | 200 | 0.423 | **0.364** | 0.636 | 44.8 | 99.6 · 0.3 | 0.423,0.388,0.469 |
| `/tour` | 200 | 0.512 | **0.358** | 0.618 | 13.4 | 99.7 · 0.4 | 0.616,0.512,0.425 |
| `/papic/try` | 200 | 0.463 | **0.350** | 0.473 | 14.0 | – | 0.463,0.526,0.417 |
| `/help/topics` | 200 | 0.412 | **0.346** | 0.413 | 14.9 | – | 0.412,0.417,0.369 |
| `/acceptable-use` | 200 | 0.406 | **0.345** | 0.419 | 15.2 | – | 0.383,0.406,0.436 |
| `/refunds` | 200 | 0.405 | **0.345** | 0.412 | 14.8 | – | 0.410,0.405,0.379 |
| `/mood-board` | 200 | 0.402 | **0.342** | 0.418 | 19.4 | – | 0.402,0.412,0.364 |
| `/tl/features` | 200 | 0.404 | **0.341** | 0.823 | 30.7 | – | 0.404,0.392,0.524 |
| `/for-suppliers` | 200 | 0.535 | **0.339** | 0.692 | 23.0 | 110.6 · 11.2 | 0.579,0.535,0.387 |
| `/alaala` | 200 | 0.396 | **0.337** | 0.413 | 17.8 | 275.2 · 175.9 | 0.396,0.409,0.392 |
| `/about` | 200 | 0.410 | **0.336** | 0.773 | 24.9 | 133.1 · 33.7 | 0.493,0.361,0.410 |
| `/cookies` | 200 | 0.397 | **0.336** | 0.599 | 17.1 | – | 0.392,0.397,0.456 |
| `/our-story` | 200 | 0.392 | **0.333** | 0.599 | 20.9 | – | 0.537,0.392,0.354 |
| `/start` | 200 | 0.391 | **0.333** | 0.609 | 16.7 | 102.9 · 3.6 | 0.391,0.369,0.420 |
| `/pawebsite` | 200 | 0.423 | **0.329** | 0.426 | 18.9 | – | 0.389,0.458,0.423 |
| `/pakanta` → `/features` | 307 | 0.388 | **0.328** | 0.389 | 35.6 | – | 0.388,0.377,0.505 |
| `/for-coordinators` | 200 | 0.390 | **0.326** | 0.812 | 25.8 | – | 0.378,0.766,0.390 |
| `/panood` | 200 | 0.381 | **0.326** | 0.557 | 20.1 | – | 0.428,0.359,0.381 |
| `/setnayan-ai` | 200 | 0.383 | **0.326** | 0.568 | 19.7 | 306.1 · 206.8 | 0.383,0.514,0.359 |
| `/suppliers` | 200 | 0.386 | **0.325** | 0.516 | 13.6 | – | 0.386,0.382,0.412 |
| `/articles` | 200 | 0.382 | **0.324** | 0.560 | 20.1 | 100.0 · 0.7 | 0.382,0.396,0.379 |
| `/help` | 200 | 0.384 | **0.324** | 0.995 | 63.2 | 112.3 · 13.0 | 0.384,0.400,0.372 |
| `/sample` | 404 | 0.378 | **0.324** | 0.388 | 9.1 | – | 0.378,0.387,0.376 |
| `/marketplace` | 200 | 0.389 | **0.323** | 0.605 | 19.3 | 135.7 · 36.4 | 0.405,0.389,0.387 |
| `/pricing` | 200 | 0.382 | **0.323** | 0.589 | 24.1 | 103.1 · 3.8 | 0.362,0.382,0.395 |
| `/pa3d` | 200 | 0.412 | **0.322** | 0.594 | 18.6 | – | 0.386,0.412,0.422 |
| `/pricing/plan` | 200 | 0.378 | **0.321** | 0.417 | 14.7 | – | 0.454,0.352,0.378 |
| `/guest-list` | 200 | 0.377 | **0.320** | 0.595 | 19.5 | – | 0.377,0.369,0.388 |
| `/palogo` | 200 | 0.394 | **0.320** | 0.611 | 18.9 | – | 0.378,0.415,0.394 |
| `/schedule` | 200 | 0.380 | **0.319** | 0.601 | 19.1 | – | 0.376,0.387,0.380 |
| `/download` | 200 | 0.376 | **0.318** | 0.402 | 17.9 | – | 0.385,0.376,0.367 |
| `/sample/hub` | 404 | 0.377 | **0.314** | 0.381 | 9.1 | – | 0.377,0.369,0.402 |
| `/forgot-password` | 200 | 0.371 | **0.313** | 0.384 | 11.9 | – | 0.371,0.367,0.383 |
| `/live` | 200 | 0.376 | **0.313** | 0.397 | 11.1 | – | 0.376,0.371,0.394 |
| `/pa3d/try` | 200 | 0.371 | **0.311** | 0.388 | 13.8 | – | 0.371,0.386,0.359 |
| `/patiktok` → `/features` | 307 | 0.374 | **0.311** | 0.393 | 35.5 | – | 0.378,0.374,0.373 |
| `/budget` | 200 | 0.369 | **0.310** | 0.589 | 19.2 | – | 0.365,0.369,0.376 |
| `/waitlist` | 200 | 0.368 | **0.310** | 0.371 | 14.2 | 99.7 · 0.3 | 0.381,0.368,0.364 |
| `/creators` | 200 | 0.377 | **0.309** | 0.380 | 21.1 | – | 0.377,0.425,0.359 |
| `/papic` | 200 | 0.390 | **0.309** | 0.573 | 27.3 | 164.6 · 65.3 | 0.392,0.390,0.373 |
| `/seat-plan` | 200 | 0.370 | **0.309** | 0.420 | 19.2 | – | 0.370,0.365,0.417 |
| `/terms` | 200 | 0.379 | **0.308** | 0.570 | 17.7 | – | 0.396,0.362,0.379 |
| `/monogram` | 200 | 0.367 | **0.304** | 0.394 | 15.2 | – | 0.392,0.358,0.367 |
| `/login` | 200 | 0.367 | **0.299** | 0.368 | 13.0 | 99.4 · 0.1 | 0.372,0.367,0.356 |
| `/manifest.json` | 200 | 0.115 | **0.059** | 0.115 | 0.8 | – | 0.191,0.109,0.115 |
| `/explore/compare` → `/?browse=1` | 307 | 0.116 | **0.055** | 0.116 | 0.1 | – | 0.110,0.133,0.116 |
<!-- /gen:ttfb -->

**Reading it:**

- **No public page measured waits over 0.7 s on the server.** The slowest are `/open-shop` and `/features`, the two biggest pages (58 KB and 94 KB of HTML on the wire).
- TTFB from here adds this container's own connection (about 0.05–0.4 s). A phone in Manila pays its own connection instead.
- **Every public page pays the same 99 KB of shared JS (gzipped).** The heavy ones carry their own on top: `/setnayan-ai` +207 KB, `/alaala` +176 KB, `/papic` +65 KB, `/open-shop` +52 KB. Those four are the client-weight work, separate from the read rounds.
- `/sample` and `/sample/hub` answer 404: the sample is switched off (`sampleOpensHere()`), so that is not a fault. `/pakanta` and `/patiktok` forward to `/features` with a 307. `/explore/compare` without ids forwards in the middleware before any render.

## 8 · Every page

Sorted by route. "Rounds now" is the route total (the max of page and layouts), with the page's own and its slowest layout in brackets. "After" is the floor with every batch done. "Cached N s" marks a `revalidate` copy. "(sheet)" marks an intercepted route that opens over its page on a soft navigation.

<!-- gen:all -->
| Route | Role | Rounds now (page · layout) | What causes them | Fix (#8278 pattern) | After | Size | Batch |
|---|---|---|---|---|--:|:-:|:-:|
| `/` | public (session-aware) | **26** (26 · 10 (hub)) | <FrontDoor> (_components/frontdoor/front-door) (24) · lib/hub-shell.ts:hubDrawsTheShell (1) · 1 read in series (1) | preload <FrontDoor> with the page's batch (`preload…` + `cache()`) · `cache()` on `hubDrawsTheShell` (read by layout and page) | 8 | L | P9 |
| `/[slug]` | guest | **79** (79 · 12 [slug]) | app/v/[slug]/page.tsx:renderVendorBySlug (73) · lib/slug-forwarding.ts:resolveRenamedPath (5) · app/[slug]/_lib/loaders.ts:loadEventShell (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `resolveRenamedPath` (its own batch) | 6 | L | P10 |
| `/[slug]/avatar` | guest | **12** (6 · 12 [slug]) | lib/guest-session.ts:readGuestSession (3) · 1 read in series (1) · lib/event-type-profile.ts:resolveProfile (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `readGuestSession` (its own batch) | 4 | S | P10 |
| `/[slug]/cached/[key]` (cached 60 s) | guest | **80** (80 · 12 [slug]) | app/[slug]/page.tsx:PublicInvitationPage (77) · app/[slug]/cached/[key]/page.tsx:resolve (3) | start each read with its inputs (move `await`s to one wait) | 9 | L | P10 |
| `/[slug]/everyone` | guest | **29** (29 · 12 [slug]) | lib/slug-access.ts:canViewSlugEvent (16) · lib/event-type-profile.ts:resolveProfileByEvent (2) · app/[slug]/everyone/page.tsx:eventRecognisesViewer (2) | start the 11 serial reads at once (one `Promise.all`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L | P10 |
| `/[slug]/find-my-table` | guest | **37** (37 · 12 [slug]) | lib/slug-access.ts:canViewSlugEvent (16) · <Shell> ([slug]/find-my-table) (10) · app/[slug]/_lib/room-links.server.ts:loadRoomLinks (3) | start the 9 serial reads at once (one `Promise.all`) · preload <Shell> with the page's batch (`preload…` + `cache()`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L | P10 |
| `/[slug]/find-seat` | guest | **47** (47 · 12 [slug]) | lib/slug-access.ts:canViewSlugEvent (16) · app/[slug]/_lib/loaders.ts:loadGuestLook (10) · app/[slug]/_lib/part-door.server.ts:partDoorHidden (3) | start the 17 serial reads at once (one `Promise.all`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L | P10 |
| `/[slug]/hub` | guest | **22** (22 · 12 [slug]) | lib/slug-access.ts:canViewSlugEvent (16) · lib/slug-access.ts:isSignedInEventHost (2) · lib/slug-access.ts:isSignedInEventHost (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L | P10 |
| `/[slug]/invite` | guest | **24** (24 · 12 [slug]) | app/[slug]/invite/_lib/load-invite-look.ts:loadInviteLook (14) · <JoinFlow> (join/[eventId]/_components/join-flow) (7) · 2 reads in series (2) | start the 4 serial reads at once (one `Promise.all`) · preload <JoinFlow> with the page's batch (`preload…` + `cache()`) | 7 | L | P10 |
| `/[slug]/invite/enter` | guest | **26** (26 · 12 [slug]) | app/[slug]/_lib/loaders.ts:loadGuestLook (11) · lib/guest-one-path.server.ts:readGuestSessionForEvent (6) · lib/guest-reentry.server.ts:mintReentryCode (2) | start the 10 serial reads at once (one `Promise.all`) · shared loader `readGuestSessionForEvent` (its own batch) | 6 | L | P10 |
| `/[slug]/invite/reply` | guest | **29** (29 · 12 [slug]) | app/[slug]/_lib/loaders.ts:loadGuestLook (11) · lib/guest-one-path.server.ts:readReplyIdentityForEvent (9) · app/[slug]/_lib/loaders.ts:loadEventShell (1) | start the 11 serial reads at once (one `Promise.all`) · shared loader `readReplyIdentityForEvent` (its own batch) | 7 | L | P10 |
| `/[slug]/pabuya` (cached 300 s) | guest | **31** (31 · 12 [slug]) | lib/slug-access.ts:canViewSlugEvent (16) · app/[slug]/pabuya/_lib/gift-page.server.ts:loadGiftPage (8) · app/[slug]/_lib/part-door.server.ts:partDoorHidden (3) | start the 6 serial reads at once (one `Promise.all`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L | P10 |
| `/[slug]/print` (cached 300 s) | guest | **81** (81 · 12 [slug]) | app/[slug]/_components/editorial/data.ts:loadEditorialData (39) · lib/slug-access.ts:canViewSlugEvent (16) · lib/story-pages.ts:loadStoryPages (14) | start the 12 serial reads at once (one `Promise.all`) · shared loader `canViewSlugEvent`, `loadStoryPages` (its own batch) | 7 | L | P10 |
| `/[slug]/recap` | guest | **12** (0 · 12 [slug]) | – | page is fine; the wait is the layout ([slug]/layout) | 3 | – | – |
| `/[slug]/request` | guest | **20** (20 · 12 [slug]) | app/[slug]/invite/_lib/load-invite-look.ts:loadInviteLook (14) · app/[slug]/_lib/event-words.ts:eventWordsForEvent (2) · lib/public-event-url.ts:resolveEventOwnerSlug (2) | start the 5 serial reads at once (one `Promise.all`) | 4 | L | P10 |
| `/[slug]/seat` | guest | **26** (26 · 12 [slug]) | <PersonalPass> ([slug]/seat) (9) · app/[slug]/_lib/room-links.server.ts:loadRoomLinks (3) · lib/seat-pass.ts:eventOwnsCustomQrGuest (3) | start the 9 serial reads at once (one `Promise.all`) · preload <PersonalPass> with the page's batch (`preload…` + `cache()`) · shared loader `eventOwnsCustomQrGuest`, `readGuestSession` (its own batch) | 7 | L | P10 |
| `/[slug]/venue` | guest | **23** (23 · 12 [slug]) | lib/slug-access.ts:canViewSlugEvent (16) · app/[slug]/_lib/room-links.server.ts:loadRoomLinks (3) · lib/seating.ts:fetchBooths (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `canViewSlugEvent` (its own batch) | 7 | L | P10 |
| `/[slug]/welcome` | guest | **29** (29 · 12 [slug]) | lib/qr-look.server.ts:resolveEventQrLook (10) · <PlusOneDoor> ([slug]/welcome/_components/plus-one-door) (7) · lib/guest-session.ts:readGuestSession (3) | start the 10 serial reads at once (one `Promise.all`) · preload <PlusOneDoor> with the page's batch (`preload…` + `cache()`) · shared loader `readGuestSession`, `resolveEventQrLook` (its own batch) | 8 | L | P10 |
| `/3d_plan/demo/[token]` | public | **9** (9 · 0) | app/_actions/plan3d-demo-actions.ts:resolvePlan3DGuestToken (9) | start each read with its inputs (move `await`s to one wait) | 6 | S | P11 |
| `/about` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/acceptable-use` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/admin` | admin | **22** (22 · 10 admin) | app/admin/work/page.tsx:AdminWorkLanding (14) · <FocusHome> (admin/_components/focus-home) (6) · lib/admin/require-admin.ts:requireAdmin (2) | preload <FocusHome> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L | P13 |
| `/admin/account-deletions` | admin | **10** (5 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/accounts` | admin | **10** (9 · 10 admin) | <VendorsSurface> (admin/accounts/_surfaces/vendors-surface) (7) · lib/admin/require-admin.ts:requireAdmin (2) | preload <VendorsSurface> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/addons` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/admin-log` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P13 |
| `/admin/app-performance` | admin | **10** (10 · 10 admin) | <CockpitSurface> (admin/app-performance/_surfaces/overview-surface) (8) · lib/admin/require-admin.ts:requireAdmin (2) | preload <CockpitSurface> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/approvals` | admin | **10** (7 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/ask` | admin | **10** (2 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/background-videos` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/background-videos.ts:fetchBackgroundVideosForAdmin (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/booking-fees` | admin | **14** (14 · 10 admin) | lib/admin/suppliers-to-review.server.ts:readSuppliersToReview (5) · 4 reads in series (4) · lib/admin/require-admin.ts:requireAdmin (2) | start the 8 serial reads at once (one `Promise.all`) · shared loader `readSuppliersToReview` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 3 | L | P13 |
| `/admin/brain` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/budget-planner` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/business` | admin | **10** (9 · 10 admin) | lib/platform-settings.ts:fetchPlatformSettingsMeasured (3) · <ComplianceSurface> (admin/settings/_surfaces/compliance-surface) (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 3 serial reads at once (one `Promise.all`) · preload <ComplianceSurface> with the page's batch (`preload…` + `cache()`) · shared loader `fetchPlatformSettingsMeasured` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/catalogue` | admin | **10** (5 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · app/admin/categories/_components/load.ts:loadCategories (2) · <TabLanding> (admin/_components/tab-landing) (1) | `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/categories` | admin | **17** (17 · 10 admin) | <EventTypePanel> (admin/categories/_components/event-type-panel) (4) · lib/admin/require-admin.ts:requireAdmin (2) · app/admin/categories/_components/load.ts:loadVocab (2) | start the 7 serial reads at once (one `Promise.all`) · preload <EventTypePanel> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 5 | L | P13 |
| `/admin/categories/requests` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P13 |
| `/admin/categories/requests/[requestId]` | admin | **10** (5 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P13 |
| `/admin/chat-flags` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/colours` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/completions` | admin | **10** (5 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/compliance` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/compliance/data-sheet` | admin | **10** (5 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/concierge-abuse` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/connection-logs` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/corrections` | admin | **10** (10 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/vendor-corrections.ts:fetchCorrectionRequestsMeasured (1) · 1 read in series (1) | start the 4 serial reads at once (one `Promise.all`) · N+1 at `app/admin/corrections/page.tsx:113` → one `.in()` read · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/data-privacy` | admin | **10** (5 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/data-privacy-controls.ts:fetchDataPrivacyControlsMeasured (1) · lib/periodic-job-health.ts:fetchPeriodicJobLedger (1) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/demand` | admin | **10** (1 · 10 admin) | lib/demand-radar.ts:getAdminDemandRadar (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/demo-vendors` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/demo-vendors/inquiries` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/demo-vendors/inquiries/[threadId]` | admin | **10** (6 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) · lib/chat.ts:fetchThreadById (1) | start the 5 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/directory` | admin | **20** (20 · 10 admin) | <ApplicationsSurface> (admin/verify) (18) · lib/admin/require-admin.ts:requireAdmin (2) | preload <ApplicationsSurface> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L | P12 |
| `/admin/discount-codes` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/discount-codes/[id]/edit` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/discount-codes/new` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/v2-catalog.ts:fetchV2CustomerCatalog (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/disputes` | admin | **12** (12 · 10 admin) | <DepositDisputesSection> (admin/disputes/_components/deposit-disputes-section) (3) · lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 7 serial reads at once (one `Promise.all`) · preload <DepositDisputesSection> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/editorial-review` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/editorial-review/[editorialId]` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/email-delivery` | admin | **10** (9 · 10 admin) | <NotificationsSurface> (admin/settings/_surfaces/notifications-surface) (6) · lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | preload <NotificationsSurface> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/event-deletions` | admin | **10** (4 · 10 admin) | 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 3 | S | P12 |
| `/admin/events` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/events/[eventId]` | admin | **16** (16 · 10 admin) | 5 reads in series (5) · 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 14 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | L | P12 |
| `/admin/force-majeure` | admin | **10** (7 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) · <MiniTour> (_components/mini-tour) (2) | start the 4 serial reads at once (one `Promise.all`) · preload <MiniTour> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/force-majeure/[flagId]` | admin | **10** (5 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/founder-seats` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/fraud` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/funnels` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/gifts` | admin | **19** (19 · 10 admin) | lib/badge-rewards.server.ts:fetchBadgeRewardLedger (3) · 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 16 serial reads at once (one `Promise.all`) · shared loader `fetchBadgeRewardLedger` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 3 | L | P13 |
| `/admin/growth` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/help` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P13 |
| `/admin/help/guides` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/help-asks.server.ts:readNoAnswerYet (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/hub-music` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/hub-music-server.ts:fetchHubMusicForAdmin (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/insights` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/integrations` | admin | **10** (6 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 5 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/integrity-watch` | admin | **10** (8 · 10 admin) | 6 reads in series (6) · lib/admin/require-admin.ts:requireAdmin (2) | start the 7 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/intelligence` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/journal-spotlights` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/launch-offer` | admin | **10** (5 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) · lib/launch-offer.server.ts:readLaunchOffer (1) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P13 |
| `/admin/live-studio-channels` | admin | **10** (6 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/panood-youtube.ts:getYoutubeOAuthConfig (1) · 1 read in series (1) | start the 5 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/menus` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/money` | admin | **10** (8 · 10 admin) | <TransactionsLedger> (admin/money/_components/transactions-ledger) (6) · lib/admin/require-admin.ts:requireAdmin (2) | preload <TransactionsLedger> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/moodboard-library` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/more` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/notifications` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/npc-readiness` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/offers` | admin | **27** (27 · 10 admin) | <BadgesView> (admin/offers/_surfaces/badges-view) (8) · lib/badge-rewards.server.ts:fetchBadgeRewardLedger (3) · 3 reads in series (3) | start the 16 serial reads at once (one `Promise.all`) · preload <BadgesView> with the page's batch (`preload…` + `cache()`) · shared loader `fetchBadgeRewardLedger` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L | P13 |
| `/admin/offline` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/onboarding` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/operations-hiring` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/pakanta` | admin | **10** (10 · 10 admin) | 4 reads in series (4) · fan-out .map() (4) · lib/admin/require-admin.ts:requireAdmin (2) | start the 6 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/papic-storage` | admin | **10** (10 · 10 admin) | lib/old-photo-copies.server.ts:listOldPhotos (4) · lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 6 serial reads at once (one `Promise.all`) · shared loader `listOldPhotos` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/patiktok` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/pax-changes` | admin | **10** (5 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/payment-options` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/payments` | admin | **44** (44 · 10 admin) | app/admin/payments/page.tsx:fetchDeskBills (20) · app/admin/payments/page.tsx:fetchRecordTarget (4) · lib/platform-settings.ts:getEffectiveVatRatePct (3) | start the 16 serial reads at once (one `Promise.all`) · N+1 at `app/admin/payments/page.tsx:552` → one `.in()` read · shared loader `getEffectiveVatRatePct`, `fetchPlatformSettings` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L | P4 |
| `/admin/payments/supplier-refunds` | admin | **10** (6 · 10 admin) | 4 reads in series (4) · lib/admin/require-admin.ts:requireAdmin (2) | start the 5 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P4 |
| `/admin/payouts` | admin | **10** (4 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) | start the 3 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P13 |
| `/admin/price-bands` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/pricing` | admin | **10** (2 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/queues` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/real-stories` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/recaps` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/receipts` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/referrals` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/repost-watch` | admin | **10** (8 · 10 admin) | 4 reads in series (4) · lib/admin/require-admin.ts:requireAdmin (2) · <SupplierPhotoReports> (admin/repost-watch/card-checks-admin) (2) | start the 5 serial reads at once (one `Promise.all`) · preload <SupplierPhotoReports> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/reveal-studio` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/reviews` | admin | **10** (10 · 10 admin) | 6 reads in series (6) · lib/admin/require-admin.ts:requireAdmin (2) · lib/guest-reviews.ts:readGuestReviewsForAdmin (2) | start the 8 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/search-memory` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/admin-search-memory.ts:loadSearchMemory (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/secrets` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/seo` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/settings` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/settings/demo-mode` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/settings/payment-methods` | admin | **10** (9 · 10 admin) | lib/platform-settings.ts:fetchPlatformSettingsMeasured (3) · 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 6 serial reads at once (one `Promise.all`) · shared loader `fetchPlatformSettingsMeasured` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/social-queue` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/songs` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/spotlight-awards` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/studio` | admin | **17** (17 · 10 admin) | <SocialQueueSurface> (admin/studio/_surfaces/social-queue-surface) (15) · lib/admin/require-admin.ts:requireAdmin (2) | preload <SocialQueueSurface> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L | P13 |
| `/admin/subscriptions` | admin | **10** (7 · 10 admin) | 4 reads in series (4) · lib/admin/require-admin.ts:requireAdmin (2) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/switches` | admin | **10** (7 · 10 admin) | <DemoModeSurface> (admin/settings/_surfaces/demo-mode-surface) (4) · lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | preload <DemoModeSurface> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P13 |
| `/admin/team` | admin | **10** (5 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/admin/can.server.ts:getAdminPowersFor (1) · 1 read in series (1) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/ugat` | admin | **10** (2 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/ugat/map` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/ugat/data.ts:getUgatCounts (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/user-reports` | admin | **10** (6 · 10 admin) | 4 reads in series (4) · lib/admin/require-admin.ts:requireAdmin (2) | start the 5 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/users` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/users/[userId]` | admin | **20** (20 · 10 admin) | 11 reads in series (11) · 5 reads in series (5) · lib/admin/require-admin.ts:requireAdmin (2) | start the 19 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | L | P12 |
| `/admin/vendor-partnerships` | admin | **10** (7 · 10 admin) | 5 reads in series (5) · lib/admin/require-admin.ts:requireAdmin (2) | start the 6 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/vendor-recommendations` | admin | **10** (5 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/vendors` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/vendors/[vendorProfileId]` | admin | **13** (13 · 10 admin) | 4 reads in series (4) · lib/one-registered-business.server.ts:verifiedElsewhere (3) · lib/admin/require-admin.ts:requireAdmin (2) | start the 10 serial reads at once (one `Promise.all`) · shared loader `verifiedElsewhere` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 4 | M | P12 |
| `/admin/vendors/[vendorProfileId]/edit` | admin | **10** (5 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | S | P12 |
| `/admin/vendors/[vendorProfileId]/plan` | admin | **10** (6 · 10 admin) | 3 reads in series (3) · lib/admin/require-admin.ts:requireAdmin (2) · lib/auth.ts:getCurrentUser (1) | start the 5 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/vendors/[vendorProfileId]/team` | admin | **10** (9 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 2 reads in series (2) · lib/vendor-team.ts:fetchOpenAdminMotions (2) | start the 7 serial reads at once (one `Promise.all`) · `cache()` on `requireAdmin` (read by layout and page) | 3 | M | P12 |
| `/admin/venues` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/venues/[id]` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · 1 read in series (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/venues/new` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/verification-docs` | admin | **10** (4 · 10 admin) | lib/verification-docs-server.ts:buildVerificationDocsReport (3) · lib/verification-doc-suppliers.server.ts:verificationDocSupplierNames (1) | shared loader `buildVerificationDocsReport` (its own batch) | 3 | S | P12 |
| `/admin/verify` | admin | **20** (20 · 10 admin) | <ApplicationsSurface> (admin/verify) (18) · lib/admin/require-admin.ts:requireAdmin (2) | preload <ApplicationsSurface> with the page's batch (`preload…` + `cache()`) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L | P12 |
| `/admin/website` | admin | **10** (0 · 10 admin) | – | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/website-media` | admin | **10** (3 · 10 admin) | lib/admin/require-admin.ts:requireAdmin (2) · lib/website-media-server.ts:loadWebsiteMedia (1) | page is fine; the wait is the layout (admin/layout) | 3 | – | – |
| `/admin/work` | admin | **16** (16 · 10 admin) | lib/admin/supplier-work.server.ts:loadSupplierWork (8) · fan-out .map() (3) · app/admin/work/page.tsx:readLightsWithVerdicts (2) | start the 4 serial reads at once (one `Promise.all`) · shared loader `loadSupplierWork` (its own batch) · `cache()` on `requireAdmin` (read by layout and page) | 4 | L | P13 |
| `/alaala` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/api/v1` | public | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/articles` | public | **10** (2 · 10 (shell)) | lib/articles.server.ts:listArticles (2) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/articles/[slug]` | public (session-aware) | **10** (3 · 10 (shell)) | lib/articles.server.ts:articleBySlug (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/articles/write` | public (session-aware) | **10** (3 · 10 (shell)) | lib/articles.server.ts:writerState (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/budget` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/claim/[token]` | signed-in | **1** (1 · 0) | 1 read in series (1) | nothing to fix | 1 | – | – |
| `/cookies` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/creators` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/dashboard` | host | **36** (36 · 10 (hub)) | <MemoriesSegment> (dashboard/(account)/library/_components/memories-segment) (31) · app/_components/account-switcher/get-switcher-data.ts:getSwitcherData (2) · lib/people-roster.ts:waitingRequestCount (2) | start the 3 serial reads at once (one `Promise.all`) · preload <MemoriesSegment> with the page's batch (`preload…` + `cache()`) | 9 | L | P9 |
| `/dashboard/[eventId]` | host | **31** (31 · 17 dashboard/[eventId]) | <EventDashboard> (dashboard/[eventId]/_components/event-dashboard) (12) · lib/entitlements.ts:eventOwnsSku (8) · fan-out .map() (4) | start the 6 serial reads at once (one `Promise.all`) · preload <EventDashboard> with the page's batch (`preload…` + `cache()`) · shared loader `eventOwnsSku`, `resolveSetnayanAiDisplayPricePhp` (its own batch) | 13 | L | P8 |
| `/dashboard/[eventId]/access-requests` | host | **17** (4 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) · lib/claim-access-asks.server.ts:readClaimAccessAsks (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P7 |
| `/dashboard/[eventId]/activity` | host | **17** (2 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/alaala` | host | **17** (6 · 17 dashboard/[eventId]) | lib/kwento-density.ts:getKwentoDensity (2) · lib/auth.ts:getCurrentUser (1) · lib/event-viewer.server.ts:fetchEventViewer (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | M | P6 |
| `/dashboard/[eventId]/alaala/assignments` | host | **17** (3 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · lib/event-viewer.server.ts:fetchEventViewer (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/apple-pro` | host | **17** (13 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventHubOwnership (10) · lib/event-entitlement-client.server.ts:eventEntitlementClient (3) | shared loader `eventEntitlementClient`, `eventHubOwnership` (its own batch) | 4 | M | P6 |
| `/dashboard/[eventId]/budget` | host | **17** (16 · 17 dashboard/[eventId]) | lib/budget-truth.ts:resolveEventMoneySettled (7) · lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/budget-visibility.ts:resolveBudgetVisibility (2) | start the 6 serial reads at once (one `Promise.all`) · preload <Spotlight> with the page's batch (`preload…` + `cache()`) · shared loader `resolveEventMoneySettled` (its own batch) | 4 | L | P8 |
| `/dashboard/[eventId]/checklist` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/clearance` | host | **17** (3 · 17 dashboard/[eventId]) | 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/contracts` | host | **17** (3 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · lib/contracts.ts:fetchEventContracts (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/contracts/[contractId]` | host | **17** (3 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · lib/contracts.ts:fetchContract (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/date-selection` | host | **17** (7 · 17 dashboard/[eventId]) | 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) · lib/demo-scope.ts:demoScopeFor (1) | start the 7 serial reads at once (one `Promise.all`) | 4 | M | P8 |
| `/dashboard/[eventId]/details` | host | **22** (22 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventHubOwnership (10) · <HubDraftDock> (dashboard/[eventId]/website/_components/hub-draft-dock) (7) · lib/budget-visibility.ts:resolveBudgetVisibility (2) | start the 5 serial reads at once (one `Promise.all`) · preload <HubDraftDock> with the page's batch (`preload…` + `cache()`) · shared loader `eventHubOwnership` (its own batch) | 5 | L | P8 |
| `/dashboard/[eventId]/details/change` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/details/field/[row]` (sheet) | host | **26** (26 · 17 dashboard/[eventId]) | <RecordFieldSlot> (dashboard/[eventId]/details/_components/record-field-slot) (26) | preload <RecordFieldSlot> with the page's batch (`preload…` + `cache()`) | 6 | L | P8 |
| `/dashboard/[eventId]/details/field/[row]` | host | **28** (28 · 17 dashboard/[eventId]) | <RecordFieldSlot> (dashboard/[eventId]/details/_components/record-field-slot) (24) · lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · preload <RecordFieldSlot> with the page's batch (`preload…` + `cache()`) | 6 | L | P8 |
| `/dashboard/[eventId]/disputes` | host | **17** (3 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · lib/force-majeure.ts:sweepEscalateStaleFlags (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/documents` | host | **17** (5 · 17 dashboard/[eventId]) | 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | S | P8 |
| `/dashboard/[eventId]/event-page` | host | **17** (2 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/event-qr` | host | **17** (4 · 17 dashboard/[eventId]) | lib/host-gate.ts:requireHostMembership (3) · 1 read in series (1) | shared loader `requireHostMembership` (its own batch) | 4 | S | P7 |
| `/dashboard/[eventId]/find-date` | host | **17** (5 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/auth.ts:getCurrentUser (1) · lib/vendors.ts:fetchEventVendors (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P8 |
| `/dashboard/[eventId]/galleries` | host | **17** (13 · 17 dashboard/[eventId]) | lib/papic-seats.ts:eventPapicActive (7) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) · <MiniTour> (_components/mini-tour) (2) | start the 4 serial reads at once (one `Promise.all`) · preload <MiniTour> with the page's batch (`preload…` + `cache()`) · shared loader `eventPapicActive` (its own batch) | 4 | M | P6 |
| `/dashboard/[eventId]/guests` | host | **31** (31 · 17 dashboard/[eventId]) | app/dashboard/[eventId]/guests/_components/guest-card-data.ts:loadGuestCard (7) · lib/guest-helper-card.server.ts:loadGuestHelperCard (4) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `loadGuestHelperCard` (its own batch) | 8 | L | P7 |
| `/dashboard/[eventId]/guests/[guestId]` | host | **17** (12 · 17 dashboard/[eventId]) | app/dashboard/[eventId]/guests/_components/guest-card-read.ts:readGuestCard (11) · lib/auth.ts:getCurrentUser (1) | start each read with its inputs (move `await`s to one wait) | 9 | S | P7 |
| `/dashboard/[eventId]/guests/checkin` | host | **17** (7 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveRoleSetForEvent (2) · lib/auth.ts:getCurrentUser (1) · lib/role-names.server.ts:loadRoleNames (1) | start the 6 serial reads at once (one `Promise.all`) | 4 | M | P7 |
| `/dashboard/[eventId]/guests/claims` | host | **17** (12 · 17 dashboard/[eventId]) | 4 reads in series (4) · lib/event-type-profile.ts:resolveRoleSetForEvent (2) · 2 reads in series (2) | start the 10 serial reads at once (one `Promise.all`) | 4 | M | P7 |
| `/dashboard/[eventId]/guests/import` | host | **17** (2 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveRoleSetForEvent (2) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/guests/invite` | host | **19** (19 · 17 dashboard/[eventId]) | <ShareLinkPanel> (dashboard/[eventId]/guests/invite/_components/share-link-panel) (17) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | preload <ShareLinkPanel> with the page's batch (`preload…` + `cache()`) | 4 | L | P7 |
| `/dashboard/[eventId]/guests/new` | host | **17** (7 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveRoleSetForEvent (2) · 2 reads in series (2) · lib/guests.ts:fetchSingletonRoleHolders (1) | start the 6 serial reads at once (one `Promise.all`) | 4 | M | P7 |
| `/dashboard/[eventId]/guests/quick` | host | **17** (1 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/guests/send` | host | **17** (17 · 17 dashboard/[eventId]) | app/dashboard/[eventId]/_components/guest-setup/one-link.server.ts:readOneLink (13) · app/dashboard/[eventId]/guests/_components/invite-message-setup.ts:loadInviteSetup (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | L | P7 |
| `/dashboard/[eventId]/guests/souvenirs` | host | **17** (6 · 17 dashboard/[eventId]) | lib/supplier-scan.server.ts:readCoupleScanClaims (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | M | P7 |
| `/dashboard/[eventId]/guests/tea-ceremony` | host | **17** (4 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · lib/role-names.server.ts:loadRoleNames (1) · 1 read in series (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P7 |
| `/dashboard/[eventId]/hosts` | host | **17** (3 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · lib/event-viewer.server.ts:fetchEventViewer (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/invitation` | host | **20** (20 · 17 dashboard/[eventId]) | lib/qr-look.server.ts:resolveEventQrLook (10) · app/dashboard/[eventId]/guests/_components/invite-message-setup.ts:loadInviteSetup (2) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 8 serial reads at once (one `Promise.all`) · shared loader `resolveEventQrLook` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/invitation/print` | host | **17** (16 · 17 dashboard/[eventId]) | lib/qr-look.server.ts:resolveEventQrLook (10) · lib/public-event-url.ts:resolveEventOwnerSlug (2) · lib/role-names.server.ts:loadRoleNames (1) | start the 6 serial reads at once (one `Promise.all`) · shared loader `resolveEventQrLook` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/launch` | host | **66** (66 · 17 dashboard/[eventId]) | <WebsiteEditorPage> (dashboard/[eventId]/website/editor) (47) · lib/couple-website-pro.ts:eventCoupleWebsiteProActive (10) · 2 reads in series (2) | start the 9 serial reads at once (one `Promise.all`) · preload <WebsiteEditorPage> with the page's batch (`preload…` + `cache()`) · shared loader `eventCoupleWebsiteProActive` (its own batch) | 8 | L | P6 |
| `/dashboard/[eventId]/live` | host | **17** (12 · 17 dashboard/[eventId]) | lib/entitlements.ts:eventSkuActive (3) · <KwentoQueue> (dashboard/[eventId]/studio/papic/moderation/_components/kwento-queue) (3) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 6 serial reads at once (one `Promise.all`) · preload <KwentoQueue> with the page's batch (`preload…` + `cache()`) · shared loader `eventSkuActive` (its own batch) | 4 | M | P7 |
| `/dashboard/[eventId]/manpower` | host | **17** (4 · 17 dashboard/[eventId]) | 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P7 |
| `/dashboard/[eventId]/memories` | host | **17** (3 · 17 dashboard/[eventId]) | lib/papic-gallery-scope.ts:viewerSeesCoupleScopedPapic (2) · lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/memories/download-all` | host | **17** (5 · 17 dashboard/[eventId]) | lib/papic-download-all.server.ts:readDownloadPlan (3) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `readDownloadPlan` (its own batch) | 4 | S | P6 |
| `/dashboard/[eventId]/memories/thank-you` | host | **17** (11 · 17 dashboard/[eventId]) | lib/entitlements.ts:eventSkuActive (3) · lib/platform-settings.ts:fetchPlatformSettings (3) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `eventSkuActive`, `fetchPlatformSettings` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/messages` | host | **17** (10 · 17 dashboard/[eventId]) | <EventGroups> (dashboard/[eventId]/messages/_components/event-groups) (3) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 7 serial reads at once (one `Promise.all`) · preload <EventGroups> with the page's batch (`preload…` + `cache()`) | 4 | M | P8 |
| `/dashboard/[eventId]/messages/[threadId]` | host | **20** (20 · 17 dashboard/[eventId]) | lib/vendor-payment-methods.server.ts:readPublishedMethodsForCouple (7) · lib/chat-pin-facts.server.ts:readChatPinFacts (4) · lib/booked-money-step.server.ts:readBookedMoney (2) | start the 8 serial reads at once (one `Promise.all`) · preload <ThreadInterestChips> with the page's batch (`preload…` + `cache()`) · shared loader `readPublishedMethodsForCouple`, `readChatPinFacts` (its own batch) | 10 | L | P8 |
| `/dashboard/[eventId]/messages/vendors/[vendorId]/workspace` (sheet) | host | **69** (69 · 17 dashboard/[eventId]) | <CoupleThreadBody> (dashboard/[eventId]/messages/[threadId]/_components/couple-thread-body) (19) · 8 reads in series (8) · lib/vendor-payment-methods.server.ts:readPublishedMethodsForCouple (7) | start the 33 serial reads at once (one `Promise.all`) · preload <CoupleThreadBody> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorBudgetSummary`, `readPublishedMethodsForCouple` (its own batch) | 12 | L | P8 |
| `/dashboard/[eventId]/monogram` | host | **25** (25 · 17 dashboard/[eventId]) | lib/animated-monogram.ts:eventOwnsAnimatedMonogram (11) · <AnimatedMonogramUpgrade> (dashboard/[eventId]/monogram/animated-monogram-upgrade) (7) · lib/event-type-profile.ts:resolveProfileByEvent (2) | start the 6 serial reads at once (one `Promise.all`) · preload <AnimatedMonogramUpgrade> with the page's batch (`preload…` + `cache()`) · shared loader `eventOwnsAnimatedMonogram` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/more` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/nikah` | host | **17** (8 · 17 dashboard/[eventId]) | app/dashboard/[eventId]/_components/nikah-imam.ts:readNikahImam (5) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | M | P7 |
| `/dashboard/[eventId]/orders` | host | **17** (5 · 17 dashboard/[eventId]) | lib/platform-settings.ts:getEffectiveVatRatePct (3) · lib/auth.ts:getCurrentUser (1) · lib/orders.ts:fetchOrdersForEvent (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `getEffectiveVatRatePct` (its own batch) | 4 | M | P8 |
| `/dashboard/[eventId]/orders/[orderId]` | host | **17** (5 · 17 dashboard/[eventId]) | lib/platform-settings.ts:fetchPlatformSettings (3) · lib/auth.ts:getCurrentUser (1) · lib/orders.ts:fetchOrderById (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `fetchPlatformSettings` (its own batch) | 4 | M | P8 |
| `/dashboard/[eventId]/orders/new` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/pabuya` | host | **17** (4 · 17 dashboard/[eventId]) | app/[slug]/_lib/event-words.ts:eventWordsForEvent (2) · 1 read in series (1) · lib/egift.ts:fetchEgiftMethods (1) | start the 3 serial reads at once (one `Promise.all`) | 4 | S | P8 |
| `/dashboard/[eventId]/paperwork` | host | **17** (3 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) · lib/wedding-traditions.ts:fetchTraditionItems (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/people` | host | **17** (2 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/plan3d` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/prints` | host | **66** (66 · 17 dashboard/[eventId]) | <LaunchHubPage> (dashboard/[eventId]/launch) (66) | preload <LaunchHubPage> with the page's batch (`preload…` + `cache()`) | 8 | L | P6 |
| `/dashboard/[eventId]/progress` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/refer` | host | **17** (8 · 17 dashboard/[eventId]) | lib/referral-actions.ts:getMyReferral (4) · lib/platform-settings.ts:isReferralProgramEnabled (3) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `isReferralProgramEnabled`, `getMyReferral` (its own batch) · `cache()` on `isReferralProgramEnabled` (read by layout and page) | 4 | M | P8 |
| `/dashboard/[eventId]/schedule` | host | **56** (56 · 17 dashboard/[eventId]) | lib/schedule-release.server.ts:readScheduleRelease (11) · app/dashboard/[eventId]/checklist-actions.ts:ensureChecklistSeeded (10) · lib/schedule-seed.server.ts:seedDefaultChapters (6) | start the 18 serial reads at once (one `Promise.all`) · preload <HostQuestions> with the page's batch (`preload…` + `cache()`) · shared loader `seedNonWeddingRunOfShow`, `seedDefaultChapters`, `readScheduleRelease` (its own batch) · `cache()` on `applyDelegateAccessWindow` (read by layout and page) | 6 | L | P8 |
| `/dashboard/[eventId]/seating` | host | **23** (23 · 17 dashboard/[eventId]) | <SeatingLabPage> (dashboard/[eventId]/seating/lab) (14) · lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/seating.ts:fetchBooths (2) | start the 6 serial reads at once (one `Promise.all`) · preload <SeatingLabPage> with the page's batch (`preload…` + `cache()`) | 4 | L | P7 |
| `/dashboard/[eventId]/seating/chart` | host | **17** (6 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | M | P7 |
| `/dashboard/[eventId]/seating/lab` | host | **17** (16 · 17 dashboard/[eventId]) | lib/animated-monogram.ts:eventAnimatedMonogramActive (5) · lib/vendor-services.ts:fetchBoothCardItems (3) · lib/seating.ts:fetchBooths (2) | start the 8 serial reads at once (one `Promise.all`) · shared loader `fetchBoothCardItems`, `eventAnimatedMonogramActive` (its own batch) | 4 | L | P7 |
| `/dashboard/[eventId]/seating/walkthrough` | host | **17** (6 · 17 dashboard/[eventId]) | app/dashboard/[eventId]/seating/walkthrough/actions.ts:canManageWalkthrough (4) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) | 4 | M | P7 |
| `/dashboard/[eventId]/sponsors` | host | **17** (4 · 17 dashboard/[eventId]) | 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P7 |
| `/dashboard/[eventId]/story` | host | **100** (100 · 17 dashboard/[eventId]) | app/[slug]/_components/editorial/data.ts:loadEditorialData (40) · app/dashboard/[eventId]/story/_lib/load-make-it-yours.ts:loadMakeItYours (17) · app/[slug]/_components/editorial/data.ts:loadEditorialChaptersForEditor (13) | start the 15 serial reads at once (one `Promise.all`) · shared loader `isEditorialProActive` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/studio/[addon]` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/studio/about/[addon]` | host | **17** (11 · 17 dashboard/[eventId]) | lib/event-entitlement-client.server.ts:eventEntitlementClient (3) · lib/entitlements.ts:eventSkuActive (3) · <AddOnDetailView> (dashboard/[eventId]/studio/_components/addon-detail-view) (3) | start the 3 serial reads at once (one `Promise.all`) · preload <AddOnDetailView> with the page's batch (`preload…` + `cache()`) · shared loader `eventEntitlementClient`, `eventSkuActive` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/studio/guest-columns` | host | **17** (6 · 17 dashboard/[eventId]) | 2 reads in series (2) · lib/guest-columns-gate.ts:guestColumnsActive (1) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/indoor-blueprint` | host | **17** (2 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveProfileByEvent (2) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/studio/live-studio-control` | host | **17** (9 · 17 dashboard/[eventId]) | lib/platform-settings.ts:fetchPlatformSettings (3) · 2 reads in series (2) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 6 serial reads at once (one `Promise.all`) · shared loader `fetchPlatformSettings` (its own batch) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/live-studio-control/setup` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/studio/mood-board` | host | **17** (8 · 17 dashboard/[eventId]) | <MoodBoardEditor> (dashboard/[eventId]/studio/mood-board/_components/mood-board-editor) (4) · lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · preload <MoodBoardEditor> with the page's batch (`preload…` + `cache()`) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/pakanta` | host | **23** (23 · 17 dashboard/[eventId]) | lib/retired-products.server.ts:redirectUnlessEventKeepsRetired (10) · lib/platform-settings.ts:fetchPlatformSettings (3) · 2 reads in series (2) | start the 10 serial reads at once (one `Promise.all`) · shared loader `redirectUnlessEventKeepsRetired`, `fetchPlatformSettings` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/studio/panood` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/studio/panood/broadcast` | host | **17** (16 · 17 dashboard/[eventId]) | lib/panood-camera-seats.ts:resolvePanoodTier (3) · lib/panood-control-room-access.ts:requirePanoodControlRoomMember (2) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 9 serial reads at once (one `Promise.all`) · shared loader `resolvePanoodTier` (its own batch) | 5 | L | P5 |
| `/dashboard/[eventId]/studio/panood/cameras` | host | **17** (12 · 17 dashboard/[eventId]) | lib/panood-camera-seats.ts:resolvePanoodTier (3) · lib/panood-control-room-access.ts:requirePanoodControlRoomMember (2) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 7 serial reads at once (one `Promise.all`) · shared loader `resolvePanoodTier` (its own batch) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/panood/cameras/print` | host | **17** (7 · 17 dashboard/[eventId]) | lib/panood-control-room-access.ts:isLiveStudioSetupHost (2) · lib/live-studio-channel-cameras.ts:fetchChannelCameras (2) · lib/auth.ts:getCurrentUser (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/panood/setup` | host | **17** (17 · 17 dashboard/[eventId]) | lib/animated-monogram.ts:eventAnimatedMonogramActive (5) · 2 reads in series (2) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 11 serial reads at once (one `Promise.all`) · shared loader `eventAnimatedMonogramActive` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/studio/panood/setup/venue-check` | host | **17** (3 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) · lib/venue-check-read.server.ts:readLatestVenueCheck (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/studio/papic/challenges` | host | **17** (12 · 17 dashboard/[eventId]) | <CoupleChallengesManager> (dashboard/[eventId]/studio/papic/couple-challenges-manager) (11) · lib/auth.ts:getCurrentUser (1) | preload <CoupleChallengesManager> with the page's batch (`preload…` + `cache()`) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/papic/crew` | host | **17** (4 · 17 dashboard/[eventId]) | 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P5 |
| `/dashboard/[eventId]/studio/papic/crew/poster` | host | **17** (4 · 17 dashboard/[eventId]) | 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P5 |
| `/dashboard/[eventId]/studio/papic/crew/print` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/studio/papic/moderation` | host | **17** (13 · 17 dashboard/[eventId]) | lib/papic-guest.ts:eventPapicGuestAccess (3) · <KwentoQueue> (dashboard/[eventId]/studio/papic/moderation/_components/kwento-queue) (3) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 7 serial reads at once (one `Promise.all`) · preload <KwentoQueue> with the page's batch (`preload…` + `cache()`) · shared loader `eventPapicGuestAccess` (its own batch) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/papic/recap` | host | **17** (9 · 17 dashboard/[eventId]) | 2 reads in series (2) · lib/auto-recap.ts:loadRecapCoupleSummary (2) · lib/papic-phone-uploads.server.ts:readWaitingPhoneUploads (2) | start the 7 serial reads at once (one `Promise.all`) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/papic/run-of-show` | host | **17** (5 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/auth.ts:getCurrentUser (1) · lib/papic-ceremony-sequence.ts:fetchRunOfShow (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P5 |
| `/dashboard/[eventId]/studio/patiktok` | host | **22** (22 · 17 dashboard/[eventId]) | lib/retired-products.server.ts:redirectUnlessEventKeepsRetired (10) · lib/platform-settings.ts:fetchPlatformSettings (3) · 2 reads in series (2) | start the 10 serial reads at once (one `Promise.all`) · shared loader `redirectUnlessEventKeepsRetired`, `fetchPlatformSettings` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/studio/patiktok/[templateId]` | host | **17** (13 · 17 dashboard/[eventId]) | lib/retired-products.server.ts:redirectUnlessEventKeepsRetired (10) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `redirectUnlessEventKeepsRetired` (its own batch) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/patiktok/booth` | host | **17** (17 · 17 dashboard/[eventId]) | lib/retired-products.server.ts:redirectUnlessEventKeepsRetired (10) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 8 serial reads at once (one `Promise.all`) · shared loader `redirectUnlessEventKeepsRetired` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/studio/photo-delivery` | host | **17** (5 · 17 dashboard/[eventId]) | 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) · lib/photo-delivery-drive.ts:getPhotoDeliveryOAuthConfig (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | M | P5 |
| `/dashboard/[eventId]/studio/playlist` | host | **17** (3 · 17 dashboard/[eventId]) | lib/vendor-sets.ts:fetchEventSetsForHost (2) · lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/studio/save-the-date` | host | **23** (23 · 17 dashboard/[eventId]) | lib/hero-monogram-data.ts:resolveEventMonogram (5) · app/[slug]/_lib/main-ground-picture.ts:mainGroundStillFor (3) · lib/platform-settings.ts:fetchPlatformSettings (3) | start the 12 serial reads at once (one `Promise.all`) · shared loader `resolveEventMonogram`, `fetchPlatformSettings` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/studio/save-the-date/stamp` | host | **17** (4 · 17 dashboard/[eventId]) | lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) | 4 | S | P5 |
| `/dashboard/[eventId]/studio/setnayan-ai` | host | **27** (27 · 17 dashboard/[eventId]) | lib/entitlements.ts:eventOwnsSku (8) · lib/iap/setnayan-ai-in-app.server.ts:setnayanAiTierInApp (4) · lib/setnayan-ai-activity.ts:loadAiActivity (3) | start the 11 serial reads at once (one `Promise.all`) · shared loader `loadAiActivity`, `eventOwnsSku`, `resolveSetnayanAiDisplayPricePhp`, `setnayanAiTierInApp` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/studio/website-pro` | host | **31** (31 · 17 dashboard/[eventId]) | lib/event-services.server.ts:readEventServices (30) · lib/auth.ts:getCurrentUser (1) | shared loader `readEventServices` (its own batch) | 4 | L | P5 |
| `/dashboard/[eventId]/vendors` | host | **36** (36 · 17 dashboard/[eventId]) | <BookedSlot> (dashboard/[eventId]/vendors/_components/booked-slot) (8) · app/dashboard/[eventId]/vendors/page.tsx:fetchVendorPhotoMaps (4) · lib/budget-allocation-data.ts:resolveAllocationInputs (4) | start the 15 serial reads at once (one `Promise.all`) · preload <BookedSlot> with the page's batch (`preload…` + `cache()`) · shared loader `resolveAllocationInputs`, `setnayanAiTierInApp`, `readCalendarTruth` (its own batch) | 6 | L | P8 |
| `/dashboard/[eventId]/vendors/[vendorId]` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/vendors/[vendorId]/review` | host | **17** (14 · 17 dashboard/[eventId]) | 8 reads in series (8) · lib/favorites.server.ts:offerHostFavorites (3) · lib/auth.ts:getCurrentUser (1) | start the 12 serial reads at once (one `Promise.all`) · shared loader `offerHostFavorites` (its own batch) | 4 | M | P8 |
| `/dashboard/[eventId]/vendors/[vendorId]/workspace` | host | **69** (69 · 17 dashboard/[eventId]) | <CoupleThreadBody> (dashboard/[eventId]/messages/[threadId]/_components/couple-thread-body) (19) · 8 reads in series (8) · lib/vendor-payment-methods.server.ts:readPublishedMethodsForCouple (7) | start the 33 serial reads at once (one `Promise.all`) · preload <CoupleThreadBody> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorBudgetSummary`, `readPublishedMethodsForCouple` (its own batch) | 12 | L | P8 |
| `/dashboard/[eventId]/vendors/categories` | host | **48** (48 · 17 dashboard/[eventId]) | app/dashboard/[eventId]/vendors/_actions/category-search.ts:searchCategoryVendors (42) · lib/event-type-profile.ts:resolveProfileByEvent (2) · lib/supplier-find-read.ts:readFindList (2) | start the 5 serial reads at once (one `Promise.all`) | 9 | L | P8 |
| `/dashboard/[eventId]/vendors/packages/[bookingId]` | host | **17** (5 · 17 dashboard/[eventId]) | 4 reads in series (4) · lib/auth.ts:getCurrentUser (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | S | P8 |
| `/dashboard/[eventId]/website` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/website/colors` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/website/editor` | host | **59** (59 · 17 dashboard/[eventId]) | lib/post-event-compile.server.ts:readPostEventForMaker (40) · closure (12) · <MakerHeroPanel> (dashboard/[eventId]/launch/_components/maker-made-once) (6) | start the 3 serial reads at once (one `Promise.all`) · preload <MakerHeroPanel> with the page's batch (`preload…` + `cache()`) · shared loader `readPostEventForMaker` (its own batch) | 6 | L | P6 |
| `/dashboard/[eventId]/website/editorial` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/website/hero-photo` | host | **17** (14 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventHubPartActive (10) · lib/event-entitlement-client.server.ts:eventEntitlementClient (3) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `eventEntitlementClient`, `eventHubPartActive` (its own batch) | 4 | M | P6 |
| `/dashboard/[eventId]/website/living-hero` | host | **17** (14 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventHubPartActive (10) · lib/event-entitlement-client.server.ts:eventEntitlementClient (3) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `eventEntitlementClient`, `eventHubPartActive` (its own batch) | 4 | M | P6 |
| `/dashboard/[eventId]/website/our-photos` | host | **17** (15 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventHubPartActive (10) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) · lib/auth.ts:getCurrentUser (1) | start the 5 serial reads at once (one `Promise.all`) · shared loader `eventHubPartActive` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/website/our-story` | host | **21** (21 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventHubPartActive (10) · app/[slug]/_lib/event-words.ts:eventWordsForEvent (2) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) | start the 8 serial reads at once (one `Promise.all`) · preload <MiniTour> with the page's batch (`preload…` + `cache()`) · shared loader `eventHubPartActive` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/website/photo-moments` | host | **17** (2 · 17 dashboard/[eventId]) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/website/privacy` | host | **17** (3 · 17 dashboard/[eventId]) | 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/website/site-chrome` | host | **17** (14 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventHubPartActive (10) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `eventHubPartActive` (its own batch) | 4 | L | P6 |
| `/dashboard/[eventId]/website/special-message` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/website/stories` | host | **17** (5 · 17 dashboard/[eventId]) | 4 reads in series (4) · lib/auth.ts:getCurrentUser (1) | start the 5 serial reads at once (one `Promise.all`) | 4 | S | P6 |
| `/dashboard/[eventId]/website/what-to-bring` | host | **17** (0 · 17 dashboard/[eventId]) | – | page is fine; the wait is the layout (dashboard/[eventId]/layout) | 4 | – | – |
| `/dashboard/[eventId]/website/widgets` | host | **17** (17 · 17 dashboard/[eventId]) | lib/couple-website-pro.ts:eventCoupleWebsiteProActive (10) · lib/event-entitlement-client.server.ts:eventEntitlementClient (2) · 2 reads in series (2) | start the 7 serial reads at once (one `Promise.all`) · shared loader `eventCoupleWebsiteProActive` (its own batch) | 4 | L | P6 |
| `/dashboard/api-keys` | host | **10** (2 · 10 dashboard/(account)) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | page is fine; the wait is the layout (dashboard/(account)/layout) | 4 | – | – |
| `/dashboard/billing` | host | **10** (6 · 10 dashboard/(account)) | lib/platform-settings.ts:getEffectiveVatRatePct (3) · lib/billing.ts:fetchMyPurchasesMeasured (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `getEffectiveVatRatePct` (its own batch) | 4 | M | P9 |
| `/dashboard/clusters` | host | **10** (4 · 10 dashboard/(account)) | lib/clusters.ts:fetchLinkableCelebrations (3) · lib/auth.ts:getCurrentUser (1) | shared loader `fetchLinkableCelebrations` (its own batch) | 4 | S | P9 |
| `/dashboard/clusters/[clusterId]` | host | **10** (6 · 10 dashboard/(account)) | lib/clusters.ts:fetchLinkableCelebrations (3) · lib/auth.ts:getCurrentUser (1) · lib/clusters.ts:fetchCluster (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `fetchLinkableCelebrations` (its own batch) · `generateMetadata` repeats `fetchCluster`: `cache()` it | 4 | S | P9 |
| `/dashboard/create-event` (sheet) | host | **19** (19 · 10 (hub)) | <CreateEventPage> (dashboard/(account)/create-event) (19) | preload <CreateEventPage> with the page's batch (`preload…` + `cache()`) | 4 | L | P9 |
| `/dashboard/create-event` | host | **19** (19 · 10 dashboard/(account)) | lib/plan-together.server.ts:readPlanTogether (3) · lib/communities.ts:fetchCommunity (2) · lib/communities.ts:fetchUserCommunities (2) | start the 14 serial reads at once (one `Promise.all`) · shared loader `readPlanTogether` (its own batch) | 4 | L | P9 |
| `/dashboard/creator` | host | **10** (7 · 10 dashboard/(account)) | <CreatorBody> (dashboard/(account)/creator) (5) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | preload <CreatorBody> with the page's batch (`preload…` + `cache()`) | 5 | S | P9 |
| `/dashboard/library` | host | **10** (0 · 10 dashboard/(account)) | – | page is fine; the wait is the layout (dashboard/(account)/layout) | 4 | – | – |
| `/dashboard/life-flash` | host | **10** (7 · 10 dashboard/(account)) | lib/life-story-moment-graph.ts:fetchMomentGraph (5) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `fetchMomentGraph` (its own batch) | 6 | S | P9 |
| `/dashboard/notifications` | host | **10** (4 · 10 dashboard/(account)) | app/_components/account-switcher/get-switcher-data.ts:getSwitcherData (2) · lib/auth.ts:getCurrentUser (1) · lib/notification-places.ts:fetchNotificationEventPlaces (1) | start the 3 serial reads at once (one `Promise.all`) | 4 | S | P9 |
| `/dashboard/people` | host | **10** (0 · 10 dashboard/(account)) | – | page is fine; the wait is the layout (dashboard/(account)/layout) | 4 | – | – |
| `/dashboard/people/[dependentId]` | host | **10** (6 · 10 dashboard/(account)) | 4 reads in series (4) · lib/data-privacy-controls.ts:isDataPrivacyControlActive (1) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) | 4 | M | P9 |
| `/dashboard/profile` | host | **15** (15 · 10 dashboard/(account)) | lib/public-profile.ts:resolvePublicProfile (5) · 4 reads in series (4) · lib/formal-name-from-guest-list.ts:formalNameFromGuestList (3) | start the 9 serial reads at once (one `Promise.all`) · shared loader `formalNameFromGuestList`, `resolvePublicProfile` (its own batch) | 6 | M | P9 |
| `/dashboard/profile/concierge` | host | **10** (4 · 10 dashboard/(account)) | 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) · lib/concierge.ts:sweepExpiredConcierge (1) | start the 4 serial reads at once (one `Promise.all`) | 4 | S | P9 |
| `/dashboard/samahan` | host | **10** (0 · 10 dashboard/(account)) | – | page is fine; the wait is the layout (dashboard/(account)/layout) | 4 | – | – |
| `/dashboard/samahan/[communityId]` | host | **10** (5 · 10 dashboard/(account)) | lib/communities.ts:fetchCommunity (2) · lib/communities.ts:fetchCommunityRoster (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 4 | S | P9 |
| `/dashboard/samahan/new` | host | **10** (0 · 10 dashboard/(account)) | – | page is fine; the wait is the layout (dashboard/(account)/layout) | 4 | – | – |
| `/dashboard/search` | host | **16** (16 · 10 dashboard/(account)) | app/_components/frontdoor/shell-search-context.ts:resolveShellSearchContext (9) · app/_components/frontdoor/command-data.ts:resolveCommandItems (3) · <FrontDoorResults> (_components/frontdoor/front-door-results) (3) | start the 3 serial reads at once (one `Promise.all`) · preload <FrontDoorResults> with the page's batch (`preload…` + `cache()`) · shared loader `resolveCommandItems`, `resolveShellSearchContext` (its own batch) | 8 | M | P9 |
| `/dashboard/year` | host | **10** (0 · 10 dashboard/(account)) | – | page is fine; the wait is the layout (dashboard/(account)/layout) | 4 | – | – |
| `/demo-capture/[slug]` | public | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/download` | public | **10** (1 · 10 (shell)) | lib/desktop-release-server.ts:resolveDesktopRelease (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/explore/compare` | public (session-aware) | **10** (8 · 10 (shell)) | 3 reads in series (3) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 8 serial reads at once (one `Promise.all`) | 3 | M | P14 |
| `/features` | public | **10** (3 · 10 (shell)) | lib/how-search.ts:runHowSearch (2) · <FeaturesPageBody> (features/_PageBody) (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/features/[slug]` | public | **10** (1 · 10 (shell)) | <FeaturePageView> (features/_feature-page) (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/for-coordinators` | public | **10** (1 · 10 (shell)) | lib/data-privacy-controls.ts:isDataPrivacyControlActive (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/for-suppliers` | public | **10** (2 · 10 (shell)) | lib/shop-gifts.server.ts:fetchShopGiftPacks (1) · lib/shop-gifts.server.ts:fetchShopGiftBundles (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/forgot-password` | public | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/guest-list` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/help` | public (session-aware) | **10** (7 · 10 (shell)) | lib/platform-settings.ts:isReferralProgramEnabled (3) · lib/how-search.ts:runHowSearch (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `isReferralProgramEnabled` (its own batch) | 3 | M | P14 |
| `/help/[slug]` (cached 3600 s) | public | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/help/guides/[key]` | public (session-aware) | **10** (1 · 10 (shell)) | lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/help/topics` | public (session-aware) | **10** (1 · 10 (shell)) | lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/help/topics/[key]` | public (session-aware) | **10** (1 · 10 (shell)) | lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/host/accept/[token]` | signed-in | **5** (5 · 0) | 2 reads in series (2) · app/[slug]/_lib/event-words.ts:eventWordsForEvent (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 3 | S | P9 |
| `/i/[slug]` | guest | **5** (5 · 0) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/supplier-invite.server.ts:readInviter (1) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 3 | S | P11 |
| `/join/[eventId]` | guest | **9** (9 · 0) | <JoinFlow> (join/[eventId]/_components/join-flow) (6) · app/[slug]/_lib/event-words.ts:eventWordsForEvent (2) · 1 read in series (1) | preload <JoinFlow> with the page's batch (`preload…` + `cache()`) | 4 | M | P11 |
| `/join/[eventId]/connect/confirm` | guest | **17** (17 · 0) | lib/event-account-link.ts:findSeatToConnect (9) · lib/guest-connects-hosts.server.ts:hostsToAsk (7) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `findSeatToConnect`, `hostsToAsk` (its own batch) | 6 | L | P11 |
| `/join/[eventId]/set-password` | guest | **1** (1 · 0) | lib/auth.ts:getCurrentUser (1) | nothing to fix | 1 | – | – |
| `/join/[eventId]/success` | guest | **3** (3 · 0) | lib/auth.ts:getCurrentUser (1) · lib/role-names.server.ts:loadRoleNames (1) · 1 read in series (1) | nothing to fix | 2 | – | – |
| `/join/crew/[token]` | guest | **9** (9 · 0) | lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) · 2 reads in series (2) · lib/supplier-part-lock.server.ts:readPartLocks (2) | start the 6 serial reads at once (one `Promise.all`) · shared loader `resolveEventFeeGate` (its own batch) | 3 | M | P11 |
| `/live` | guest | **8** (8 · 0) | lib/live-studio-window-server.ts:resolveBroadcastWindow (3) · 2 reads in series (2) · lib/logo-plays.server.ts:logoPlaysFor (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `resolveBroadcastWindow` (its own batch) | 3 | M | P11 |
| `/live/screen` | guest | **8** (8 · 0) | app/live/_lib/load-screen.ts:loadLiveScreen (8) | start each read with its inputs (move `await`s to one wait) | 3 | M | P11 |
| `/login` | public | **1** (1 · 0) | 1 read in series (1) | nothing to fix | 1 | – | – |
| `/marketplace` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/monogram` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/mood-board` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/onboarding/[type]` | public (session-aware) | **13** (13 · 0) | lib/onboarding/services-step-server.ts:readServicesStepView (6) · app/dashboard/(account)/create-event/life-event-guard.ts:getBlockingLifeEvent (2) · lib/event-types-db.ts:getCreatableEventTypes (1) | start the 7 serial reads at once (one `Promise.all`) · shared loader `readServicesStepView` (its own batch) | 3 | M | P9 |
| `/onboarding/simple` | public (session-aware) | **10** (10 · 0) | lib/onboarding/services-step-server.ts:readServicesStepView (7) · lib/auth.ts:getCurrentUser (1) · lib/event-types-db.ts:getCreatableEventTypes (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `readServicesStepView` (its own batch) | 2 | M | P9 |
| `/onboarding/wedding` | public (session-aware) | **16** (16 · 0) | lib/onboarding/services-step-server.ts:readServicesStepView (7) · lib/platform-settings.ts:fetchOnboardingBgMusicUrl (3) · lib/auth.ts:getCurrentUser (1) | start the 8 serial reads at once (one `Promise.all`) · shared loader `fetchOnboardingBgMusicUrl`, `readServicesStepView` (its own batch) | 2 | L | P9 |
| `/open-shop` | supplier | **22** (22 · 0) | lib/claim-door.server.ts:readClaimDoor (10) · lib/vendor-service-vocab.ts:fetchVendorServicePickerVocab (2) · lib/event-types-db.ts:getVendorServableEventTypes (2) | start the 10 serial reads at once (one `Promise.all`) · shared loader `readClaimDoor` (its own batch) | 5 | L | P4 |
| `/open-shop/invite` | supplier | **3** (3 · 0) | lib/auth.ts:getCurrentUser (1) · lib/active-shop.ts:resolveOwnedActiveShop (1) · 1 read in series (1) | nothing to fix | 3 | – | – |
| `/open-shop/logo` | supplier | **3** (3 · 0) | lib/auth.ts:getCurrentUser (1) · lib/active-shop.ts:resolveOwnedActiveShop (1) · 1 read in series (1) | nothing to fix | 3 | – | – |
| `/our-story` | public | **10** (2 · 10 (shell)) | lib/alaala-orb.ts:fetchAlaalaOrbClips (2) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/pa3d` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/pa3d/try` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/pakanta` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/palogo` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/panood` | guest | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/panood/cam/[token]` | guest | **2** (2 · 0) | lib/auth.ts:getCurrentUser (1) · lib/panood-camera-seats.ts:fetchClaimedCameraForUser (1) | nothing to fix | 2 | – | – |
| `/panood/control/[eventId]` | guest | **32** (32 · 0) | lib/live-studio-readiness-server.ts:fetchReadinessFacts (6) · lib/entitlements.ts:eventSkuActive (3) · lib/panood-control-room-access.ts:isLiveStudioSetupHost (2) | start the 21 serial reads at once (one `Promise.all`) · shared loader `eventSkuActive`, `fetchReadinessFacts` (its own batch) | 3 | L | P11 |
| `/panood/demo/[token]` | guest | **1** (1 · 0) | lib/demo-sessions.ts:resolveDemoToken (1) | nothing to fix | 1 | – | – |
| `/panood/program/[eventId]` | guest | **13** (13 · 0) | lib/live-studio-publish.ts:canPublishMultiCam (3) · app/panood/program/[eventId]/page.tsx:fetchProgramChannels (3) · lib/panood-control-room-access.ts:requirePanoodControlRoomMember (2) | start the 7 serial reads at once (one `Promise.all`) · shared loader `canPublishMultiCam` (its own batch) | 3 | M | P11 |
| `/papic` | guest/host | **10** (1 · 10 (shell)) | lib/v2-catalog.ts:fetchV2CustomerCatalog (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/papic/claim/[token]` | guest/host | **1** (1 · 0) | lib/auth.ts:getCurrentUser (1) | nothing to fix | 1 | – | – |
| `/papic/decorate` | guest/host | **7** (7 · 0) | lib/guest-session.ts:readGuestSession (3) · lib/papic-guest.ts:eventPapicGuestAccess (3) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `readGuestSession`, `eventPapicGuestAccess` (its own batch) | 5 | M | P11 |
| `/papic/demo/[token]` | guest/host | **1** (1 · 0) | lib/demo-sessions.ts:resolveDemoToken (1) | nothing to fix | 1 | – | – |
| `/papic/guest` | guest/host | **26** (26 · 0) | lib/guest-live-gallery.ts:getGuestOwnShots (7) · <CameraColumn> (papic/guest) (4) · lib/guest-session.ts:readGuestSession (3) | start the 8 serial reads at once (one `Promise.all`) · preload <CameraColumn> with the page's batch (`preload…` + `cache()`) · shared loader `readGuestSession`, `eventPapicGuestAccess`, `fetchGuestQuota`, `getGuestOwnShots` (its own batch) | 7 | L | P11 |
| `/papic/join/[token]` | guest/host | **6** (6 · 0) | N+1 loop ×2 (app/papic/join/[token]/page.tsx:91) (1) | N+1 at `app/papic/join/[token]/page.tsx:91` → one `.in()` read | 1 | M | P11 |
| `/papic/lightcheck` | guest/host | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/papic/me/[token]` | guest/host | **31** (31 · 0) | <GuestGallery> (papic/me/[token]) (14) · lib/papic-limited.ts:resolveGuestCamera (12) · lib/papic-guest.ts:eventPapicGuestAccess (3) | start the 4 serial reads at once (one `Promise.all`) · preload <GuestGallery> with the page's batch (`preload…` + `cache()`) · shared loader `resolveGuestCamera`, `eventPapicGuestAccess` (its own batch) | 5 | L | P11 |
| `/papic/order/[token]` | guest/host | **4** (4 · 0) | lib/platform-settings.ts:fetchPlatformSettings (3) · 1 read in series (1) | shared loader `fetchPlatformSettings` (its own batch) | 2 | S | P11 |
| `/papic/pool` | guest/host | **6** (6 · 0) | lib/guest-session.ts:readGuestSession (3) · lib/papic-pool-gate.ts:papicPoolGalleryActive (1) · 1 read in series (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `readGuestSession` (its own batch) | 4 | S | P11 |
| `/papic/seat/[token]` | guest/host | **19** (19 · 0) | lib/papic-photo-mark.server.ts:cameraProFor (10) · lib/papic-chapter.server.ts:papicCameraChapter (2) · <PapicGuestBuyPanel> (papic/_components/papic-guest-buy-panel) (2) | start the 7 serial reads at once (one `Promise.all`) · preload <PapicGuestBuyPanel> with the page's batch (`preload…` + `cache()`) · shared loader `cameraProFor` (its own batch) | 4 | L | P11 |
| `/papic/try` | guest/host | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/patiktok` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/pawebsite` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/pay/[reference]` | signed-in | **68** (68 · 0) | app/pay/[reference]/maya-return.ts:mayaPayState (47) · lib/payable-by-reference.ts:fetchPayableByReference (6) · lib/payable-by-reference.ts:fetchPayableByReference (6) | start the 10 serial reads at once (one `Promise.all`) · shared loader `fetchPayableByReference`, `fetchPayableByReference`, `fetchPlatformSettings` (its own batch) | 9 | L | P4 |
| `/pricing` | public | **10** (3 · 10 (shell)) | <PlanBuyCta> (_components/marketing/plan-buy-cta) (2) · app/(shell)/pricing/_pricing-reads.ts:readOurPrices (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/pricing/plan` | public | **10** (3 · 10 (shell)) | <PlanBuyCta> (_components/marketing/plan-buy-cta) (2) · app/(shell)/pricing/_pricing-reads.ts:readOurPrices (1) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/privacy` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/privacy/google-access` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/proposals/[publicId]` | signed-in | **17** (17 · 0) | lib/vendor-payment-methods.server.ts:fetchProposalPaymentMethods (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/setnayan-gift.server.ts:quoteSetnayanGift (2) | start the 12 serial reads at once (one `Promise.all`) · shared loader `fetchProposalPaymentMethods` (its own batch) | 3 | L | P4 |
| `/receipts/[receiptId]` | signed-in | **6** (6 · 0) | lib/platform-settings.ts:fetchPlatformSettings (3) · lib/auth.ts:getCurrentUser (1) · lib/orders.ts:fetchOrderById (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `fetchPlatformSettings` (its own batch) | 3 | S | P4 |
| `/receipts/order/[orderId]` | signed-in | **7** (7 · 0) | lib/platform-settings.ts:fetchPlatformSettings (3) · lib/auth.ts:getCurrentUser (1) · lib/orders.ts:fetchOrderById (1) | start the 5 serial reads at once (one `Promise.all`) · shared loader `fetchPlatformSettings` (its own batch) | 2 | M | P4 |
| `/receipts/payment/[paymentId]` | signed-in | **4** (4 · 0) | 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 3 | S | P4 |
| `/refunds` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/reset-password` | public (session-aware) | **1** (1 · 0) | lib/auth.ts:getCurrentUser (1) | nothing to fix | 1 | – | – |
| `/samahan` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/samahan/chat/[threadId]` | public (session-aware) | **5** (5 · 0) | lib/chat-actions.ts:markThreadRead (2) · lib/auth.ts:getCurrentUser (1) · lib/chat-groups.ts:readGroupHead (1) | start the 4 serial reads at once (one `Promise.all`) | 2 | S | P9 |
| `/samahan/chat/new` | public (session-aware) | **3** (3 · 0) | lib/auth.ts:getCurrentUser (1) · 1 read in series (1) · lib/chat-groups.ts:readGroupPeople (1) | nothing to fix | 1 | – | – |
| `/samahan/join/[token]` | public (session-aware) | **3** (3 · 0) | lib/communities.ts:fetchPendingCommunityInvite (2) · lib/auth.ts:getCurrentUser (1) | nothing to fix | 2 | – | – |
| `/sample` | public | **2** (2 · 2 sample) | lib/sample-event/switch.server.ts:loadSampleOrNotFound (2) | nothing to fix | 1 | – | – |
| `/sample/[...rest]` | public | **2** (0 · 2 sample) | – | nothing to fix | 1 | – | – |
| `/sample/hub/[guestKey]` | public | **2** (2 · 2 sample) | lib/sample-event/switch.server.ts:loadSampleGuestOrNotFound (2) | nothing to fix | 1 | – | – |
| `/schedule` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/seat-plan` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/setnayan-ai` | public | **10** (3 · 10 (shell)) | <DoorwayPage> (_components/marketing/_doorway) (3) | page is fine; the wait is the layout ((shell)/layout) | 3 | – | – |
| `/signup` | public (session-aware) | **4** (4 · 0) | lib/guest-session.ts:readGuestSession (3) · lib/auth.ts:getCurrentUser (1) | shared loader `readGuestSession` (its own batch) | 3 | S | P14 |
| `/signup/you` | public (session-aware) | **3** (3 · 0) | 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | nothing to fix | 2 | – | – |
| `/site-editor/[eventId]` | supplier | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/site-editor/[eventId]/editorial` | supplier | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/site-editor/[eventId]/event` | supplier | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/site-editor/[eventId]/rsvp` | supplier | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/start` | public (session-aware) | **10** (2 · 10 (shell)) | lib/auth.ts:getCurrentUser (1) · lib/event-types-db.ts:getCreatableEventTypes (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/suppliers` | public | **10** (2 · 10 (shell)) | lib/supplier-landing-data.ts:loadLandingCards (2) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/suppliers/[event]/[category]` | public | **10** (3 · 10 (shell)) | app/(shell)/suppliers/_landing.tsx:landingExists (2) · <SupplierLanding> ((shell)/suppliers/_landing) (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/suppliers/[event]/[category]/[city]` | public | **10** (3 · 10 (shell)) | app/(shell)/suppliers/_landing.tsx:landingExists (2) · <SupplierLanding> ((shell)/suppliers/_landing) (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/terms` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/tl/about` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/tl/features` | public | **10** (1 · 10 (shell)) | <FeaturesPageBody> (features/_PageBody) (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/tl/features/[slug]` | public | **10** (1 · 10 (shell)) | <FeaturePageView> (features/_feature-page) (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/tour` | public | **1** (1 · 0 tour) | 1 read in series (1) | nothing to fix | 1 | – | – |
| `/tour/budget` | public | **7** (7 · 0 tour) | lib/budget.ts:fetchBudgetSnapshot (6) · app/tour/_lib/sample-event.ts:getSampleEvent (1) | shared loader `fetchBudgetSnapshot` (its own batch) | 2 | M | P14 |
| `/tour/gallery` | public | **10** (10 · 0 tour) | lib/live-wall.ts:getWallSnapshot (8) · app/tour/_lib/sample-event.ts:getSampleEvent (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `getWallSnapshot` (its own batch) | 3 | M | P14 |
| `/tour/seating` | public | **3** (3 · 0 tour) | app/tour/_lib/sample-event.ts:getSampleEvent (1) · lib/seating.ts:fetchTables (1) · 1 read in series (1) | nothing to fix | 1 | – | – |
| `/tour/vendors` | public | **12** (12 · 0 tour) | fan-out .map() (10) · app/tour/_lib/sample-event.ts:getSampleEvent (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | M | P14 |
| `/u/[userSlug]` (cached 60 s) | public (session-aware) | **25** (25 · 0) | lib/chapter-picture.ts:loadChapterPictures (8) · lib/public-profile.ts:resolvePublicProfile (5) · lib/profile-viewer.ts:readProfileViewer (3) | start the 7 serial reads at once (one `Promise.all`) · shared loader `resolvePublicProfile`, `readProfileViewer`, `loadChapterPictures`, `fetchCreatorInquiriesDriven`, `readProfileViewer` (its own batch) | 8 | L | P9 |
| `/u/[userSlug]/c/[chapterId]` (cached 60 s) | public | **12** (12 · 0) | app/u/[userSlug]/c/[chapterId]/page.tsx:resolve (6) · lib/creator-public.ts:resolveShoppableVendors (3) · lib/articles.server.ts:articleSlugForChapter (1) | start the 5 serial reads at once (one `Promise.all`) · shared loader `resolveShoppableVendors` (its own batch) · `generateMetadata` repeats `resolve`: `cache()` it | 8 | M | P9 |
| `/v/[slug]` | public (session-aware) | **73** (73 · 0) | app/v/[slug]/page.tsx:fetchVendorAttributeDetails (7) · lib/guest-review-photos.server.ts:resolveGuestReviewPhotoUrls (7) · lib/slug-forwarding.ts:resolveRenamedPath (5) | start the 35 serial reads at once (one `Promise.all`) · N+1 at `app/v/[slug]/page.tsx:781` → one `.in()` read · shared loader `resolveRenamedPath`, `readThisMonthNotBookable`, `readShopWork`, `resolveGuestReviewPhotoUrls`, `fetchVendorPoolBookings`, `loadVendorFeaturedStories` (its own batch) | 6 | L | P10 |
| `/v/[slug]/booth` | public | **1** (1 · 0) | 1 read in series (1) | nothing to fix | 1 | – | – |
| `/v/[slug]/cached` (cached 60 s) | public (session-aware) | **72** (72 · 0) | app/v/[slug]/page.tsx:renderVendorBySlug (72) | start each read with its inputs (move `await`s to one wait) | 6 | L | P10 |
| `/v/[slug]/dates` | public | **1** (0 · 0) | – | nothing to fix | 1 | – | – |
| `/v/[slug]/guest-review` | public (session-aware) | **15** (15 · 0) | lib/guest-live-gallery.ts:getGuestOwnShots (7) · lib/guest-one-path.server.ts:readGuestSessionForEvent (6) · 1 read in series (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `readGuestSessionForEvent`, `getGuestOwnShots` (its own batch) | 5 | M | P10 |
| `/v/[slug]/story/[eventSlug]` | public | **10** (10 · 0) | lib/ultra-story-pages.server.ts:loadShopStoryPage (10) | shared loader `loadShopStoryPage` (its own batch) · `generateMetadata` repeats `loadShopStoryPage`: `cache()` it | 6 | M | P10 |
| `/vendor-dashboard` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard` | supplier | **33** (33 · 11 vendor-dashboard) | fan-out .map() (15) · lib/vendor-overview.ts:fetchVendorOverviewData (8) · lib/vendor-first-steps.server.ts:fetchVendorFirstStepsState (3) | start the 6 serial reads at once (one `Promise.all`) · preload <PapersRenewalLine> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorOverviewData`, `fetchVendorFirstStepsState` (its own batch) | 7 | L | P1 |
| `/vendor-dashboard/[...rest]` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/activities` | supplier | **11** (6 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 4 serial reads at once (one `Promise.all`) | 6 | S | P2 |
| `/vendor-dashboard/attributes` | supplier | **11** (8 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · fan-out .map() (2) · lib/vendor-service-attributes.ts:fetchSchemaWithSharedGroups (2) | start the 5 serial reads at once (one `Promise.all`) | 6 | M | P1 |
| `/vendor-dashboard/booking-fees` | supplier | **11** (9 · 11 vendor-dashboard) | lib/booking-fee-disclosure.server.ts:fetchWaivedFeeCharges (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) · shared loader `fetchWaivedFeeCharges` (its own batch) | 6 | M | P3 |
| `/vendor-dashboard/booking-fees/[orderId]` | supplier | **11** (8 · 11 vendor-dashboard) | lib/platform-settings.ts:fetchPlatformSettings (3) · 3 reads in series (3) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) · shared loader `fetchPlatformSettings` (its own batch) | 6 | M | P3 |
| `/vendor-dashboard/bookings` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/branches` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/calendar` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/calendar/[date]` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/clients` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/clients/[eventId]` | supplier | **83** (83 · 11 vendor-dashboard) | lib/agree-gifts.server.ts:fetchGiftNeeded (26) · <DetailsDecisions> (vendor-dashboard/clients/[eventId]/_components/details-decisions) (21) · fan-out .map() (6) | start the 19 serial reads at once (one `Promise.all`) · preload <DetailsDecisions> with the page's batch (`preload…` + `cache()`) · shared loader `resolveEventFeeGate`, `getEditorialEligibility`, `fetchGiftNeeded`, `fetchPlatformSettings`, `logoPlaysFor` (its own batch) | 12 | L | P2 |
| `/vendor-dashboard/clients/[eventId]/challenge-photos` | supplier | **11** (8 · 11 vendor-dashboard) | lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 5 serial reads at once (one `Promise.all`) · shared loader `resolveEventFeeGate` (its own batch) | 6 | M | P2 |
| `/vendor-dashboard/clients/[eventId]/cocktail` | supplier | **11** (7 · 11 vendor-dashboard) | lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `resolveEventFeeGate` (its own batch) | 6 | M | P2 |
| `/vendor-dashboard/clients/[eventId]/editorial-media` | supplier | **11** (10 · 11 vendor-dashboard) | lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) · lib/editorial-vendor-media.ts:getEditorialEligibility (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `resolveEventFeeGate`, `getEditorialEligibility` (its own batch) | 6 | M | P2 |
| `/vendor-dashboard/clients/[eventId]/mood-board` | supplier | **11** (10 · 11 vendor-dashboard) | lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · 2 reads in series (2) | start the 7 serial reads at once (one `Promise.all`) · shared loader `resolveEventFeeGate` (its own batch) | 6 | M | P2 |
| `/vendor-dashboard/clients/[eventId]/production-sheet` | supplier | **11** (8 · 11 vendor-dashboard) | lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · 2 reads in series (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `resolveEventFeeGate` (its own batch) | 6 | M | P2 |
| `/vendor-dashboard/clients/[eventId]/seat-plan` | supplier | **11** (7 · 11 vendor-dashboard) | lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `resolveEventFeeGate` (its own batch) | 6 | M | P2 |
| `/vendor-dashboard/clients/[eventId]/their-event/[part]` | supplier | **11** (7 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 6 serial reads at once (one `Promise.all`) | 6 | S | P2 |
| `/vendor-dashboard/collections` | supplier | **11** (9 · 11 vendor-dashboard) | app/vendor-dashboard/collections/collections-data.ts:loadCollectionsData (6) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 8 | M | P1 |
| `/vendor-dashboard/collections/albums` | supplier | **11** (10 · 11 vendor-dashboard) | lib/vendor-room-access.ts:fetchVendorRoomEventsDetailed (6) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `fetchVendorRoomEventsDetailed` (its own batch) | 6 | M | P1 |
| `/vendor-dashboard/contracts` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/contracts/[contractId]` | supplier | **11** (5 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/contracts.ts:readContract (1) | start the 4 serial reads at once (one `Promise.all`) | 6 | S | P2 |
| `/vendor-dashboard/contracts/new` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/chat.ts:fetchVendorThreadsDetailed (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P2 |
| `/vendor-dashboard/creators` | supplier | **11** (9 · 11 vendor-dashboard) | lib/creator-analytics.ts:fetchVendorCreatorRoi (6) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `fetchVendorCreatorRoi` (its own batch) | 7 | M | P3 |
| `/vendor-dashboard/customers` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/customers` | supplier | **33** (33 · 11 vendor-dashboard) | <CustomersPipeline> (vendor-dashboard/customers) (33) | preload <CustomersPipeline> with the page's batch (`preload…` + `cache()`) | 10 | L | P2 |
| `/vendor-dashboard/customers/clients/[eventId]` (sheet) | supplier | **83** (83 · 11 vendor-dashboard) | lib/agree-gifts.server.ts:fetchGiftNeeded (26) · <DetailsDecisions> (vendor-dashboard/clients/[eventId]/_components/details-decisions) (21) · fan-out .map() (6) | start the 19 serial reads at once (one `Promise.all`) · preload <DetailsDecisions> with the page's batch (`preload…` + `cache()`) · shared loader `resolveEventFeeGate`, `getEditorialEligibility`, `fetchGiftNeeded`, `fetchPlatformSettings`, `logoPlaysFor` (its own batch) | 12 | L | P2 |
| `/vendor-dashboard/deep-search` | supplier | **11** (7 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) | 6 | S | P3 |
| `/vendor-dashboard/demand` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/disputes` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/vendor-disputes-read.ts:readVendorDisputes (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P2 |
| `/vendor-dashboard/earnings` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/events` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/help` | supplier | **11** (1 · 11 vendor-dashboard) | lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/invite` | supplier | **18** (18 · 11 vendor-dashboard) | app/vendor-dashboard/invite/page.tsx:readCrewQr (9) · app/vendor-dashboard/shop/promote/_components/shop-gifts-data.ts:loadShopGiftsSection (4) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) | start the 6 serial reads at once (one `Promise.all`) | 6 | L | P1 |
| `/vendor-dashboard/lines` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P1 |
| `/vendor-dashboard/locked-qr` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/manpower` | supplier | **11** (5 · 11 vendor-dashboard) | <ManpowerSurface> (vendor-dashboard/manpower/surface) (5) | preload <ManpowerSurface> with the page's batch (`preload…` + `cache()`) | 6 | S | P2 |
| `/vendor-dashboard/messages` | supplier | **11** (7 · 11 vendor-dashboard) | app/vendor-dashboard/messages/page.tsx:readSupplierChats (4) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 7 | M | P2 |
| `/vendor-dashboard/messages/[threadId]` | supplier | **33** (33 · 11 vendor-dashboard) | lib/agree-gifts.server.ts:fetchAgreeGiftBasis (24) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · 2 reads in series (2) | start the 9 serial reads at once (one `Promise.all`) · shared loader `fetchAgreeGiftBasis` (its own batch) | 8 | L | P2 |
| `/vendor-dashboard/messages/clients/[eventId]` (sheet) | supplier | **83** (83 · 11 vendor-dashboard) | lib/agree-gifts.server.ts:fetchGiftNeeded (26) · <DetailsDecisions> (vendor-dashboard/clients/[eventId]/_components/details-decisions) (21) · fan-out .map() (6) | start the 19 serial reads at once (one `Promise.all`) · preload <DetailsDecisions> with the page's batch (`preload…` + `cache()`) · shared loader `resolveEventFeeGate`, `getEditorialEligibility`, `fetchGiftNeeded`, `fetchPlatformSettings`, `logoPlaysFor` (its own batch) | 12 | L | P2 |
| `/vendor-dashboard/moodboard-library` | supplier | **16** (16 · 11 vendor-dashboard) | app/vendor-dashboard/moodboard-library/actions.ts:listImportableEditorialMedia (12) · lib/moodboard-library-access.ts:resolveMoodboardLibraryAccess (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · N+1 at `app/vendor-dashboard/moodboard-library/actions.ts:621` → one `.in()` read | 6 | L | P1 |
| `/vendor-dashboard/more` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/notifications` | supplier | **11** (4 · 11 vendor-dashboard) | app/_components/account-switcher/get-switcher-data.ts:getSwitcherData (2) · lib/auth.ts:getCurrentUser (1) · lib/notification-places.ts:fetchNotificationEventPlaces (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P2 |
| `/vendor-dashboard/on-the-day` | supplier | **18** (18 · 11 vendor-dashboard) | lib/vendor-room-access.ts:fetchVendorRoomEvents (6) · app/vendor-dashboard/on-the-day/page.tsx:setupBody (4) · lib/vendor-event-fee-access.server.ts:resolveEventFeeGates (3) | start the 7 serial reads at once (one `Promise.all`) · shared loader `fetchVendorRoomEvents`, `resolveEventFeeGates` (its own batch) | 9 | L | P2 |
| `/vendor-dashboard/on-the-day/live/[eventId]` | supplier | **37** (37 · 11 vendor-dashboard) | lib/vendor-room-access.ts:fetchVendorRoomEvents (6) · lib/vendor-room-access.ts:fetchVendorRoomEvents (6) · 3 reads in series (3) | start the 17 serial reads at once (one `Promise.all`) · preload <HubToolPanels> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorRoomEvents`, `fetchVendorRoomEvents`, `resolveEventFeeGate`, `readEventScanServices` (its own batch) | 6 | L | P2 |
| `/vendor-dashboard/on-the-day/live/[eventId]/papic` | supplier | **26** (26 · 11 vendor-dashboard) | lib/vendor-room-access.ts:fetchVendorRoomEventsDetailed (6) · <PortfolioAlbumSection> (vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-album-section) (4) · lib/vendor-event-fee-access.server.ts:resolveEventFeeGate (3) | start the 9 serial reads at once (one `Promise.all`) · preload <PortfolioAlbumSection> with the page's batch (`preload…` + `cache()`) · shared loader `fetchVendorRoomEventsDetailed`, `resolveEventFeeGate`, `fetchPlatformSettings` (its own batch) | 7 | L | P2 |
| `/vendor-dashboard/packages` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · 1 read in series (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P1 |
| `/vendor-dashboard/packages/[packageId]` | supplier | **11** (9 · 11 vendor-dashboard) | lib/package-draft-loader.ts:loadPackageDraft (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/bundle-cards.server.ts:readBundleCards (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `loadPackageDraft` (its own batch) | 6 | M | P1 |
| `/vendor-dashboard/partnerships` | supplier | **11** (9 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · 2 reads in series (2) · lib/auth.ts:getCurrentUser (1) | start the 8 serial reads at once (one `Promise.all`) | 6 | M | P3 |
| `/vendor-dashboard/payday` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/payment-options` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/performance` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/profile` (sheet) | supplier | **11** (10 · 11 vendor-dashboard) | app/vendor-dashboard/profile/details-data.ts:loadDetailsData (4) · <PaymentOptionsSurface> (vendor-dashboard/payment-options/surface) (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) | start the 3 serial reads at once (one `Promise.all`) · preload <PaymentOptionsSurface> with the page's batch (`preload…` + `cache()`) | 7 | M | P3 |
| `/vendor-dashboard/profile` | supplier | **11** (10 · 11 vendor-dashboard) | app/vendor-dashboard/profile/details-data.ts:loadDetailsData (4) · <PaymentOptionsSurface> (vendor-dashboard/payment-options/surface) (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) | start the 3 serial reads at once (one `Promise.all`) · preload <PaymentOptionsSurface> with the page's batch (`preload…` + `cache()`) | 7 | M | P3 |
| `/vendor-dashboard/proposals` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/recaps` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/recommendations` | supplier | **11** (5 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/chat.ts:fetchVendorThreads (1) | start the 4 serial reads at once (one `Promise.all`) | 6 | S | P3 |
| `/vendor-dashboard/repertoire` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/paid-widget-open.server.ts:readShopSpecialToolOpen (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P1 |
| `/vendor-dashboard/reviews` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/services` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/services/[serviceId]` | supplier | **14** (14 · 11 vendor-dashboard) | lib/service-card-maker.server.ts:loadMakerContext (6) · lib/inspiration-tags.server.ts:readAlbumTags (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) | start the 5 serial reads at once (one `Promise.all`) · shared loader `loadMakerContext`, `readAlbumTags` (its own batch) | 7 | M | P1 |
| `/vendor-dashboard/services/new` | supplier | **11** (10 · 11 vendor-dashboard) | lib/service-card-maker.server.ts:loadMakerContext (6) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `loadMakerContext` (its own batch) | 6 | M | P1 |
| `/vendor-dashboard/services/new/[category]` | supplier | **23** (23 · 11 vendor-dashboard) | lib/service-card-maker.server.ts:loadMakerContext (6) · lib/vendor-card-copy.ts:buildCanvasInitialFromCard (5) · lib/vendor-invite-actions.ts:resolveClaimContextForService (3) | start the 10 serial reads at once (one `Promise.all`) · shared loader `resolveClaimContextForService`, `loadMakerContext`, `buildCanvasInitialFromCard` (its own batch) | 6 | L | P1 |
| `/vendor-dashboard/services/requests` | supplier | **11** (5 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/service-requests.server.ts:loadMyRequests (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | M | P1 |
| `/vendor-dashboard/services/requests/[requestId]` | supplier | **11** (8 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/service-requests.server.ts:loadMyRequest (2) · lib/service-requests.server.ts:markRequestSeen (2) | start the 5 serial reads at once (one `Promise.all`) | 6 | M | P1 |
| `/vendor-dashboard/services/requests/new` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/service-requests.server.ts:loadRequestTree (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P1 |
| `/vendor-dashboard/services/their-work` | supplier | **11** (10 · 11 vendor-dashboard) | lib/card-portfolio-albums.server.ts:readShopWork (4) · lib/inspiration-tags.server.ts:readAlbumTags (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) | start the 4 serial reads at once (one `Promise.all`) · shared loader `readShopWork`, `readAlbumTags` (its own batch) | 7 | M | P1 |
| `/vendor-dashboard/settings` (sheet) | supplier | **11** (5 · 11 vendor-dashboard) | lib/vendor-role.ts:resolveVendorRole (2) · lib/vendor-payment-methods.server.ts:readSupplierPayoutReadiness (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | M | P3 |
| `/vendor-dashboard/settings` | supplier | **11** (5 · 11 vendor-dashboard) | lib/vendor-role.ts:resolveVendorRole (2) · lib/vendor-payment-methods.server.ts:readSupplierPayoutReadiness (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | M | P3 |
| `/vendor-dashboard/shop` | supplier | **26** (26 · 11 vendor-dashboard) | <ShopHome> (vendor-dashboard/shop) (26) | preload <ShopHome> with the page's batch (`preload…` + `cache()`) | 12 | L | P1 |
| `/vendor-dashboard/shop/badges` | supplier | **11** (6 · 11 vendor-dashboard) | lib/supplier-store.server.ts:readStoreBadges (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `readStoreBadges` (its own batch) | 6 | M | P1 |
| `/vendor-dashboard/shop/promote` | supplier | **14** (14 · 11 vendor-dashboard) | <PromoteBody> (vendor-dashboard/shop/promote/_components/promote-body) (7) · app/vendor-dashboard/shop/promote/_components/shop-gifts-data.ts:loadShopGiftsSection (4) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) | start the 3 serial reads at once (one `Promise.all`) · preload <PromoteBody> with the page's batch (`preload…` + `cache()`) | 12 | M | P1 |
| `/vendor-dashboard/shop/qrs` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/supplier-store.server.ts:readStoreLayout (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P1 |
| `/vendor-dashboard/shop/qrs/[code]` | supplier | **11** (7 · 11 vendor-dashboard) | app/vendor-dashboard/shop/qrs/_components/my-qrs-data.ts:loadMyQrCode (4) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | M | P1 |
| `/vendor-dashboard/shop/store` | supplier | **11** (6 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/supplier-store.server.ts:readStoreToolFacts (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 6 | M | P1 |
| `/vendor-dashboard/shop/store/[shelf]` | supplier | **11** (6 · 11 vendor-dashboard) | app/vendor-dashboard/shop/store/_components/store-data.ts:loadStore (6) | start each read with its inputs (move `await`s to one wait) | 6 | S | P1 |
| `/vendor-dashboard/shop/store/[shelf]/[item]` | supplier | **11** (6 · 11 vendor-dashboard) | app/vendor-dashboard/shop/store/_components/store-data.ts:loadStore (6) | start each read with its inputs (move `await`s to one wait) | 6 | S | P1 |
| `/vendor-dashboard/spaces` | supplier | **11** (4 · 11 vendor-dashboard) | lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) · lib/spaces.server.ts:readSpaces (1) | start the 3 serial reads at once (one `Promise.all`) | 6 | S | P2 |
| `/vendor-dashboard/subscription` (sheet) | supplier | **30** (30 · 11 vendor-dashboard) | <PlanScreen> (vendor-dashboard/subscription/_components/plan-screen) (30) | preload <PlanScreen> with the page's batch (`preload…` + `cache()`) | 6 | L | P3 |
| `/vendor-dashboard/subscription` | supplier | **30** (30 · 11 vendor-dashboard) | <PlanScreen> (vendor-dashboard/subscription/_components/plan-screen) (30) | preload <PlanScreen> with the page's batch (`preload…` + `cache()`) | 6 | L | P3 |
| `/vendor-dashboard/team` (sheet) | supplier | **11** (8 · 11 vendor-dashboard) | <TeamScreen> (vendor-dashboard/team/_components/team-screen) (8) | preload <TeamScreen> with the page's batch (`preload…` + `cache()`) | 6 | M | P3 |
| `/vendor-dashboard/team` | supplier | **11** (8 · 11 vendor-dashboard) | <TeamScreen> (vendor-dashboard/team/_components/team-screen) (8) | preload <TeamScreen> with the page's batch (`preload…` + `cache()`) | 6 | M | P3 |
| `/vendor-dashboard/team/roles` | supplier | **11** (6 · 11 vendor-dashboard) | lib/vendor-role.ts:resolveVendorStanding (3) · lib/vendor-branches.ts:fetchVendorBranches (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) · shared loader `resolveVendorStanding` (its own batch) | 6 | M | P3 |
| `/vendor-dashboard/team/roles/inquiries` | supplier | **11** (9 · 11 vendor-dashboard) | lib/vendor-role.ts:resolveVendorStanding (3) · fan-out .map() (2) · lib/auth.ts:getCurrentUser (1) | start the 6 serial reads at once (one `Promise.all`) · shared loader `resolveVendorStanding` (its own batch) | 6 | M | P3 |
| `/vendor-dashboard/theft-watch` | supplier | **11** (8 · 11 vendor-dashboard) | lib/vendor-role.ts:resolveVendorStanding (3) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/vendor-role.ts:resolveVendorRole (2) | start the 4 serial reads at once (one `Promise.all`) · shared loader `resolveVendorStanding` (its own batch) | 6 | M | P3 |
| `/vendor-dashboard/track-record` | supplier | **11** (6 · 11 vendor-dashboard) | lib/vendor-role.ts:resolveVendorRole (2) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 4 serial reads at once (one `Promise.all`) | 6 | M | P3 |
| `/vendor-dashboard/verify` | supplier | **11** (0 · 11 vendor-dashboard) | – | page is fine; the wait is the layout (vendor-dashboard/layout) | 6 | – | – |
| `/vendor-dashboard/website` (sheet) | supplier | **11** (9 · 11 vendor-dashboard) | app/vendor-dashboard/website/page-data.ts:loadPageData (6) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 8 | M | P3 |
| `/vendor-dashboard/website` | supplier | **11** (9 · 11 vendor-dashboard) | app/vendor-dashboard/website/page-data.ts:loadPageData (6) · lib/vendor-profile.ts:fetchOwnVendorProfile (2) · lib/auth.ts:getCurrentUser (1) | start the 3 serial reads at once (one `Promise.all`) | 8 | M | P3 |
| `/vendor-invite/[slug]` | public (session-aware) | **5** (5 · 0) | lib/vendor-couple-invite.ts:listHostEvents (2) · 1 read in series (1) · lib/event-types-db.ts:getEventTypeVocab (1) | start the 4 serial reads at once (one `Promise.all`) | 2 | S | P4 |
| `/vendor/claim/[token]` | public | **11** (11 · 0) | lib/vendor-invites.ts:fetchClaimLandingByToken (7) · app/[slug]/_lib/event-words.ts:eventWordsForEvent (2) · lib/booking-fee-settings.server.ts:getBookingFeeSchedule (1) | start the 4 serial reads at once (one `Promise.all`) · shared loader `fetchClaimLandingByToken` (its own batch) | 5 | M | P4 |
| `/vendor/claim/[token]/finalize` | public (session-aware) | **34** (34 · 0) | lib/vendor-invite-actions.ts:applyClaimAutoLink (18) · lib/vendor-invites.ts:fetchClaimLandingByToken (7) · 2 reads in series (2) | start the 9 serial reads at once (one `Promise.all`) · shared loader `fetchClaimLandingByToken`, `applyClaimAutoLink` (its own batch) | 9 | L | P4 |
| `/vendor/fit/[ref]` | public (session-aware) | **17** (17 · 0) | lib/budget.ts:fetchBudgetSnapshot (6) · 3 reads in series (3) · lib/vendor-cards.ts:hydrateVendorCards (2) | start the 10 serial reads at once (one `Promise.all`) · shared loader `fetchBudgetSnapshot` (its own batch) | 4 | L | P4 |
| `/vendor/lock/[token]` | public (session-aware) | **9** (9 · 0) | <ClaimForm> (vendor/lock/[token]) (5) · 2 reads in series (2) · lib/event-types-db.ts:getEventTypeVocab (1) | start the 4 serial reads at once (one `Promise.all`) · preload <ClaimForm> with the page's batch (`preload…` + `cache()`) | 4 | M | P4 |
| `/waitlist` | public | **10** (0 · 10 (shell)) | – | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
| `/wall/[eventId]` | guest | **16** (16 · 0) | lib/live-wall.ts:getWallSnapshot (8) · lib/entitlements.ts:eventSkuActive (3) · lib/hero-monogram-data.ts:resolveEventMonogram (2) | start the 6 serial reads at once (one `Promise.all`) · shared loader `eventSkuActive`, `getWallSnapshot` (its own batch) | 3 | L | P11 |
| `/web-only` | public (session-aware) | **10** (1 · 10 (shell)) | lib/auth.ts:getCurrentUser (1) | page is fine; the wait is the layout ((shell)/layout) | 2 | – | – |
<!-- /gen:all -->

## 9 · Not verified

- **No signed-in page was measured live.** Sessions do not sign in, and the preview is signed out. Every signed-in number above is the static trace. #8278's post-deploy walk is the right way to confirm each batch.
- **The trace's "slower branch" rule** can overstate pages whose slow branch is rare. The event layout's `event_moderators` read runs only for co-hosts and helpers, and `deliverDueChatReminders` costs 1 read when nothing is due. The rows name the chain, so a builder can see which branch it is.
- **Not followed:** class methods, dynamic dispatch, and object-of-functions services (`deps.notify`, `REAL_DEPS`). They count 0, so a page that hides reads there is understated.
- **Client JS for signed-in pages** is not here: CI's route table was not available (main's builds were cancelled in the queue), and the live pages need a sign-in.
- **#8278 is not merged yet.** The Shop rows show main. The tracer's run on #8278's branch is in §2.
