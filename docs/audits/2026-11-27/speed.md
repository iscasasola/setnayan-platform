# Speed audit: every page (27 Nov 2026)

> Read-only audit. No app code changed. Live site measured at `068460f` (`/api/health`, 27 Nov 2026, 14:25 UTC).
> House budget: a page loads in under 0.7 s with one batched read.
> Skipped on purpose (lane L6 owns them): `/vendor-dashboard` home, `/vendor-dashboard/messages/**`, `/dashboard/billing`. They appear in the table marked "L6 owns", with no fix.

## The short version

- **665 of 677 built routes render on every request** (`ƒ` in the build table). Only 3 pages a person reads are prerendered: `/help/[slug]`, `/[slug]/cached/[key]` and `/v/[slug]/cached`.
- **Every marketing page is `no-store`.** `/pricing`, `/terms`, `/privacy`, `/features`, `/articles/*` and the rest send `cache-control: private, no-cache, no-store` and `x-vercel-cache: MISS`. The cause is one line: `export const dynamic = 'force-dynamic'` in `app/(shell)/layout.tsx`, because the shell reads the session on the server. The cached help pages answer in about 160 ms. The same kind of page behind the shell answers in 450 to 700 ms.
- **Every page blocks first paint on 845 KB of CSS, and uses 3 to 5% of it.** Measured with Chrome CSS coverage on `/terms`, `/` and `/maria-and-jose`. One stylesheet is 686 KB raw (115 KB compressed), built mostly from `app/globals.css` (650 KB of source, about 290 KB of rules after comments). On a throttled phone, even the edge-cached help page takes 2.2 s to first paint.
- **A mistyped URL takes about 2.2 s to answer 404.** It falls into `/[slug]`, which looks up an event, then a supplier, then a renamed slug, before it gives up. Every bot hit on a junk path pays these reads on the free Supabase plan.
- **246 of 489 pages wait on 3 or more database reads in a row** in `page.tsx`. 125 of them wait on 5 or more. The worst: `/v/[slug]` (37 steps), the couple's supplier workspace (33), `/panood/control/[eventId]` (22), the supplier client view (21).
- **The heaviest JavaScript:** the couple's Suppliers page (`/dashboard/[eventId]/vendors`, 667 KB gzipped first load) and the guest Event Hub (`/[slug]`, 650 KB). The shared floor for every page is 107 KB.
- **"Add expense" takes about 1.5 s to open** because its sheet's code is fetched only on the first tap (`dynamic(... { ssr: false })` in `budget-screen.tsx`) and nothing loads it ahead.
- **The browser makes no Supabase calls on any public page measured.** Good for the free plan.

## Method

| What | How | Limits |
|---|---|---|
| Reads before paint (all 489 pages) | A static tracer built on the TypeScript compiler (scratch script, not committed). For each `page.tsx`, its layout chain and the async server components it renders outside `<Suspense>`, it follows each `await` into the `lib/` function it calls and counts Supabase calls (`.from('…')`, `.rpc(`, `auth.getUser`). An `if`/`else` counts its heavier branch. `Promise.all` counts as one step. `cache()`-wrapped readers are flagged so a repeat is not counted twice. | An estimate from code, not a trace. It cannot see which branch runs for a real user, and it does not follow calls through objects. Spot-checked by hand on `budget/page.tsx` (7 steps, matches), `/[slug]` and `/v/[slug]`. |
| JS weight (all pages) | `next build` of `origin/main` @ `068460f` in this container (Next 15.5.29, placeholder Supabase env). First-load JS = the page's chunks + its layout chain's chunks + `rootMainFiles`, each gzipped from disk. | The same build, but not the Vercel artifact byte for byte. |
| Live timing (57 public URLs) | Playwright Chromium, a fresh context per load. 375 × 812 with an iPhone user agent, and 1366 × 900 desktop. TTFB = `responseStart`, LCP = `largest-contentful-paint`, JS = the sum of script `transferSize`. A second pass on the phone used 150 ms latency, 1.6 Mbps and 4× CPU slowdown (Lighthouse's "slow 4G" profile). TTFB was also sampled three times with `curl` (median kept). | The container sits in the US. Requests enter Vercel at `iad1` and run in `sin1`, so every TTFB carries about 0.4 s of distance. `/api/health`, which does no work, takes **462 ms** from here. The table's "server" figure is the page's TTFB minus that, which is the time the page itself costs. A phone in Manila pays far less distance. |
| Signed-in pages | Not measured live: this session has no account. They have code numbers only. | See NOT COVERED. |

**Assumption used for "expected gain":** one Supabase round-trip from `sin1` costs about 30 to 50 ms (network plus query). An `auth.getUser` call costs more. Removing one step from a chain saves about that much.

## How to read the table

- **reads before paint:** `N in H · L h`. The page makes about N database calls in H steps one after another, counting async components it renders outside `<Suspense>`. `L h` is the longest layout in its chain, in steps. "(+n streamed)" counts async components inside `<Suspense>`, which do not block the first paint.
- **waterfall?:** "yes (H)" when the page itself has 3 or more steps in a row, **bold** at 5 or more. "layout (h)" when only the layout chain is long.
- **JS weight:** first-load JavaScript in KB gzipped, from the build. ⚠ names a heavy library loaded without `next/dynamic`.
- **measured:** `TTFB/server ms · M <phone LCP ms> · D <desktop LCP ms> · <phone JS KB transferred>`, then the cache status. "not measured" is a public page with no live URL in the sitemaps. "—" is a signed-in page.
- **ⓛ** after a route: no `loading.tsx` on the route or any parent, so a tap shows nothing until the server answers.
- A fix that starts with **A1, B1 …** points to a fix group below.

## Top 15 fixes, grouped so one builder takes each group

Each group's files do not overlap with any other group's.

### Group A: public pages become cacheable (files: `app/(shell)/layout.tsx`, `app/(hub)/layout.tsx`, `app/_components/frontdoor/app-rail-shell.tsx`, `app/_components/frontdoor/signed-in-cluster.tsx`)

1. **A1. Move the shell's session read to the client, then drop `force-dynamic`.**
   - **Today:** `app/(shell)/layout.tsx` sets `dynamic = 'force-dynamic'`, because `AppRailShell` reads `account` on the server. So every page under `(shell)` is `no-store`: about 40 marketing, feature, legal and article pages, plus `/` through `(hub)`. The layout's own comment explains why it can't simply be removed: under `forceStatic`, `cookies()` comes back empty and the page would stay signed out.
   - **Fix:** render the signed-out shell on the server, and let a small client island fill in the account (`SignedInCluster`, the rail's account row) after hydration. Then give the marketing pages `revalidate`, the way `/help/[slug]` already works.
   - **Measured:** cached help pages answer in 147 to 444 ms on the phone pass. `/pricing`, `/terms` and `/features` answer in 400 to 800 ms. Their server time is 0 to 330 ms over the `/api/health` floor, and on a phone in Manila that is most of the wait.
   - **Gain:** about 150 to 300 ms TTFB, and no function run or database read for an anonymous visit.
   - **Needs the owner's OK:** the signed-in chrome would appear a moment after the page.
2. **A2. Stop the shell's nested waterfall on every signed-in page.**
   - **Today:** `AppRailShell` awaits its `Promise.all`, and only then renders `<SignedInCluster />`, which awaits `getCurrentUser` and a second `Promise.all`. That is 2 extra steps in a row on every couple, supplier and admin page.
   - **Fix:** start `SignedInCluster`'s reads inside `AppRailShell`'s `Promise.all` and pass them down. Use the "started, not awaited" pattern `app/dashboard/[eventId]/layout.tsx` already uses.
   - **Gain:** about 30 to 100 ms on every signed-in page.

### Group B: unknown URLs and dead doors (files: `middleware.ts`, `app/[slug]/page.tsx` `generateMetadata` and its not-found path only, `app/onboarding/page.tsx` (new))

3. **B1. A mistyped URL answers 404 in about 2.2 s.**
   - **Measured:** four junk paths gave a 404 in 1.92 to 2.19 s. A real 404 page does no work.
   - **Why:** the anonymous `/{slug}` goes through the cached-copy step in `middleware.ts`, then `app/[slug]/page.tsx`. The page runs `loadEventShell`, then `resolveRenamedPath`. `generateMetadata` runs `loadEventShell` and then `vendorMetadataBySlug`.
   - **Fix:**
     - One "what is this slug?" read (event, supplier or renamed, in a single RPC or one `Promise.all`), shared by the metadata and the page through `cache()`.
     - Refuse impossible slug shapes in `middleware.ts` before any read.
     - Trace where the remaining time goes before cutting.
   - **Gain:** 404 in under 0.5 s, and 3 to 6 fewer database reads for every bot hit.
4. **B2. `/onboarding` has no page.**
   - **Measured:** it answers 404 in 0.9 to 1.6 s, then downloads 825 to 903 KB of JavaScript. LCP is 3.1 s on the phone and 7.9 s throttled.
   - **Fix:** a redirect to the default flow (`/onboarding/wedding` or the chooser), or a real index page.
   - **Gain:** a dead door becomes a working one, and about 800 KB of JavaScript is no longer wasted.

### Group C: the stylesheet (files: `app/globals.css`, `app/layout.tsx` CSS imports, `tailwind.config.ts`, plus the route layouts that take the moved CSS: `app/[slug]/layout.tsx`, `app/dashboard/[eventId]/website/**/layout.tsx`)

5. **C1. Cut the render-blocking CSS from 845 KB to what a page uses.**
   - **Today:** the root layout imports `globals.css` (650 KB of source), `service-icons.css`, `signature-moments.css`, `chat-tools.css` and the pinned-row and fold CSS on every page. The compiled sheet holds 713 `.hub-*` selectors (Event Hub canvas, about 32 KB raw) and the editor/inspector rules (about 20 KB raw). It also holds 3,070 arbitrary-value classes (the legacy `text-[Npx]` / `rounded-[..]` forms the ratchets already count).
   - **Fix:** move Event Hub canvas, editor and signature-moment rules into the layouts of the routes that use them, and keep `globals.css` for tokens and shared pieces.
   - **Measured:** a page uses 28 to 43 KB of the 845 KB. On a throttled phone, first paint never comes before 2.2 s, even on edge-cached pages.
   - **Gain:** about 0.5 to 1 s earlier first paint on slow 4G, on every page.

### Group D: the guest Event Hub (files: `app/[slug]/page.tsx` body after the not-found path, `app/[slug]/_components/**`)

6. **D1. Flush the loading screen sooner.**
   - **Today:** before the `<Suspense>` fallback can stream, `publicInvitationPage` awaits `loadEventShell` → `resolveProfile` → (`headers`/person read) → `skeletonDesign` → `skeletonHeroArriving` → `skeletonStdLead` → `skeletonOpening`, one after another. The tracer counts 10 steps in a row.
   - **Fix:** start the four skeleton reads together right after `loadEventShell`.
   - **Gain:** about 150 to 250 ms to the first byte a guest sees on an uncached hit. Signed-in guests always miss the cache.
7. **D2. Shrink the Event Hub's JavaScript.**
   - **Measured:** 650 KB gzipped first load (the largest in the app after Suppliers). The live sample event `/maria-and-jose` downloads 791 KB in 67 scripts. LCP is 4.1 s on the phone and 9.0 s throttled.
   - **Fix:** one 108 KB chunk (`16853-*`) and three 50 KB chunks load before anything shows. Load the sheets, the Papic panels and the day-of pieces with `next/dynamic` when they open.
   - **Gain:** about 200 to 300 KB less before the first tap, and roughly 1 to 2 s less LCP on a slow phone.

### Group E: the supplier shop page (file: `app/v/[slug]/page.tsx`)

8. **E1. Fold the shop page's 37 steps.**
   - **Today:** the 5,195-line page awaits, one after another: `fetchVendorRead` → `resolveRenamedPath` → `Promise.all([isAdminInDemoMode, areBookingsOpen])` → `readOverdueTopUpEventIds` → `readPageRefsFromEvents` → `logoDisplayRead` → the nine-way `Promise.all` → `readShopSeals` → `count_saves_for_vendor` → `fetchTrustedByVendors` → `verifiedMedianP` → `favoritesCountP` → … → `getTaxonomy` (twice) → `readTagEventLines` → the last `Promise.all`.
   - **Fix:** most of these only need `vendor_profile_id`. Start them all right after `fetchVendorRead`, and await them once.
   - **Measured:** `/setnaprod` TTFB 3.2 s on the phone (a stale copy being rebuilt) and 1.0 to 1.07 s by `curl`. LCP 3.9 s.
   - **Gain:** about 0.5 to 1 s on every uncached and signed-in visit to a shop.

### Group F: the couple's Suppliers area (files: `app/dashboard/[eventId]/vendors/**`)

9. **F1. Cut the Suppliers page's JavaScript.**
   - **Measured:** 667 KB gzipped first load (the largest page in the app), of which 562 KB is its own. The page chunk alone is 170 KB gzipped.
   - **Why:** `_components/shortlist-categories.tsx` is a 297 KB source client component. It pulls `lib/taxonomy.ts` (90 KB), `lib/budget-truth.ts` (80 KB), `lib/vendor-tier-caps.ts` (61 KB), `lib/schedule.ts` (58 KB) and `lib/shortlist-taxonomy.ts` (54 KB) into the browser.
   - **Fix:** split it so the closed accordion rows render on the server, and the open-row editor and its `lib/` math load on tap.
   - **Gain:** about 200 KB less JavaScript before the first tap.
10. **F2. Fold the supplier workspace's 33 steps.**
    - **Today:** `vendors/[vendorId]/workspace/page.tsx` (also served at `messages/@supplier/(..)vendors/[vendorId]/workspace`) waits on 33 steps in a row, and its first load is 603 KB.
    - **Fix:** one `Promise.all` after the access check. `vendors/page.tsx` itself has 15 steps; fold those the same way.
    - **Gain:** about 0.5 to 1 s.

### Group G: Budget (files: `app/dashboard/[eventId]/budget/**`)

11. **G1. Make "Add expense" open at once (today about 1.5 s).**
    - **Today:** `BudgetSheets` is `dynamic(() => import('./budget-sheets'), { ssr: false })` and is first fetched when the button is pressed. `budget-sheets.tsx` also pulls `PickMenu` from `website/editor/_components/pick-menu` and `ContactShortlistVendorButton` into that chunk.
    - **Fix:** warm the chunk when the screen is idle (`import('./budget-sheets')` in a `requestIdleCallback`), or on `pointerenter`/`focus` of the button. Then check that `pick-menu` does not drag editor code in.
    - **Gain:** "Add expense" opens in under 0.2 s.
12. **G2. Start the Budget page's reads together.**
    - **Today:** `getCurrentUser` → `resolveProfileByEvent` → `resolveBudgetVisibility` → `Promise.all([event, snapshot, paidOrders, moneyRead])` → (fallback) → `fetchEventViewer`. That is 7 steps.
    - **Fix:** the profile and the visibility check need only `eventId` and `user.id`, so start them with the four-way `Promise.all`.
    - **Gain:** about 60 to 150 ms.

### Group H: supplier pages L6 does not own (files: `app/vendor-dashboard/clients/[eventId]/**` and its `customers/@client` and `messages/@client` mounts, `app/vendor-dashboard/on-the-day/live/[eventId]/**`)

13. **H1. Fold the supplier's client view (21 steps, 532 KB) and on-the-day live (18 steps).**
    - **Today:** `clients/[eventId]/page.tsx` (also mounted as `customers/@client/(..)clients/[eventId]` and `messages/@client/(..)clients/[eventId]`) awaits 21 times in a row. `on-the-day/live/[eventId]/page.tsx` awaits 18 times.
    - **Fix:** the same pattern: the access check, then one `Promise.all`.
    - **Gain:** about 0.4 to 0.8 s each.

### Group I: heavy libraries loaded up front (files: `app/_components/marketing/_premium.tsx`, `app/open-shop/_components/city-pin.tsx`, `app/[slug]/find-seat/**`, `app/v/[slug]/booth/**`, `app/tour/**`)

14. **I1. Load `gsap`, `leaflet` and `three` only where they run.**
    - **Today:**
      - `gsap` + `@gsap/react` load statically on 19 marketing pages through `_premium.tsx`.
      - `leaflet` loads statically on `/open-shop` and 8 supplier routes through `city-pin.tsx`. This includes `/vendor-dashboard` home: tell L6, and do not touch L6's page.
      - `three` + `@react-three/drei` load statically on `/[slug]/find-seat` (a guest page, 299 KB first load) and `/v/[slug]/booth`.
    - **Fix:** `next/dynamic` each of them.
    - **`/tour` too:** it downloads **1.9 MB** of JavaScript on a 375 px phone (71 scripts), against 842 KB on desktop. Find what the phone path starts (the 3D plan or the preloader) and hold it until asked.
    - **Gain:** about 30 to 60 KB less per marketing page, and about 1 MB less on `/tour` on a phone.

### Group J: honest waiting screens (new `loading.tsx` files only, each in its own route folder)

15. **J1. Add `loading.tsx` (the shared `Sk`/`Ghost` skeleton) where a tap shows nothing until the server answers.**
    - **Routes:** `/pay/[reference]`, `/receipts/order/[orderId]`, `/receipts/payment/[paymentId]`, `/proposals/[publicId]`, `/samahan/chat/[threadId]`, `/samahan/chat/new`, `/panood/control/[eventId]`, `/panood/program/[eventId]`, `/claim/[token]`, `/join/crew/[token]`, `/open-shop`, `/onboarding/[type]`, `/onboarding/simple`, `/vendor/fit/[ref]`.
    - **Not here:** `/[slug]` and `/v/[slug]` are left out; their pages already stream a fallback, and Groups D and E own them.
    - **Gain:** a skeleton at once instead of a frozen screen.
    - **Needs the owner's OK:** each skeleton draws only what its page draws (house rule).

### Also seen, not in the top 15

- **81 pages run a read in a `useEffect` on mount**, outside the shared bell and preloader. The most widespread are `inline-checkout-drawer.tsx` (8 pages), `part-edit-gate.tsx` / `use-part-editor-lock.ts` (7), `hub-draft-bar.tsx` (7), `canvas-maker.tsx` (7) and `use-app-store-prices.ts` (15). Each is one more round-trip after paint. The per-route table names them.
- **Supplier shop pages served stale took 3.2 s TTFB** on the first phone hit (`/setnaprod`, `/testw2walkcakes`, `/testnayanw1lights`), and 0.16 s once fresh. Worth checking whether a stale hit on Vercel waits on the rebuild.
- **Event layout (`app/dashboard/[eventId]/layout.tsx`)** is already well folded: about 3 steps for a couple, plus the shell's 2 (A2). Leave it.

## NOT COVERED

- **Signed-in pages were not timed live.** There was no account in this session. Couple, supplier and admin pages have code estimates and build JS only.
- **Read counts are code estimates, not traces.** No database was attached to the build, so no real request was counted. Branches that depend on data (a co-host, an empty event) may read more or less than shown.
- **The live numbers are from a US container.** They are not from a phone in the Philippines. Server time (TTFB minus the `/api/health` floor) is the comparable figure.
- **Not looked at:** API routes (`app/api/**`), server actions, `generateMetadata` beyond `/[slug]` and `/v/[slug]`, images, fonts and INP.
- **L6's pages were skipped on purpose:** `/vendor-dashboard` home, `/vendor-dashboard/messages/**`, `/dashboard/billing`. One cross-note for L6: `leaflet` loads statically on `/vendor-dashboard` through `city-pin.tsx` (Group I).
- **`/vendors/[slug]` and other public pages with no sitemap entry** have no live row.

## Per-route table

Numbers come from the method above. Paths are the URL shape: route groups like `(shell)` are dropped, and parallel-route slots like `@supplier` are dropped.

### Public and marketing (81 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/` ⓛ | 27 in 7 · L4 | no | 230 | 562/100 · M 2024 · D 1700 · 363 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/3d_plan/demo/[token]` ⓛ | 1 in 1 · L1 | no | 148 | not measured | — | — |
| `/about` | 0 in 0 · L2 | no | 228 ⚠gsap | 463/1 · M 1448 · D 1016 · 341 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/acceptable-use` | 0 in 0 · L2 | no | 195 | 691/229 · M 1240 · D 1032 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/alaala` | 0 in 0 · L2 | no | 229 ⚠gsap | 461/0 · M 1036 · D 1356 · 342 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/api/v1` ⓛ | 0 in 0 · L1 | no | 146 | not measured | — | — |
| `/articles` | 1 in 1 · L2 | no | 195 | 453/0 · M 952 · D 1056 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/articles/[slug]` ⓛ | 2 in 1 · L2 | no | 271 | 711/249 · M 1220 · D 1056 · 385 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/articles/write` | 1 in 1 · L2 | no | 209 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/budget` | 1 in 1 · L2 | no | 236 ⚠gsap | 485/23 · M 932 · D 1108 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/cookies` | 0 in 0 · L2 | no | 195 | 471/9 · M 1240 · D 948 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/creators` | 0 in 0 · L2 | no | 233 ⚠gsap | 544/82 · M 1236 · D 1080 · 346 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/download` | 1 in 2 · L2 | no | 230 ⚠gsap | 473/11 · M 1000 · D 1288 · 344 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/explore/compare` | 9 in 8 · L2 | **yes (8)** | 198 | — | start the 8 sequential reads together (one Promise.all) | up to ~180 ms |
| `/features` | 3 in 2 · L2 | no | 220 | 652/189 · M 1596 · D 1404 · 332 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/features/[slug]` ⓛ | 1 in 1 · L2 | no | 200 | 619/157 · M 1084 · D 1128 · 311 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/for-coordinators` | 3 in 1 · L2 | no | 208 | 452/0 · M 1372 · D 1172 · 320 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/for-suppliers` | 7 in 2 · L2 | no | 211 | 501/39 · M 1168 · D 1016 · 323 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/guest-list` | 1 in 1 · L2 | no | 236 ⚠gsap | 464/2 · M 1008 · D 1120 · 311 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/help` | 4 in 4 · L2 | yes (4) | 218 | 563/101 · M 1320 · D 1000 · 330 KB · no-store | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/help/[slug]` ⓛ | 0 in 0 · L1 | no | 146 | 167/0 · M 924 · D 648 · 306 KB · HIT | — | — |
| `/help/guides/[key]` ⓛ | 1 in 1 · L2 | no | 210 | — | A1: cacheable once the shell reads the session on the client; add loading.tsx (Sk skeleton) | ~150–300 ms TTFB, 0 server reads per anon visit; instant skeleton |
| `/help/topics` | 1 in 1 · L2 | no | 196 | — | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/help/topics/[key]` ⓛ | 1 in 1 · L2 | no | 197 | — | A1: cacheable once the shell reads the session on the client; add loading.tsx (Sk skeleton) | ~150–300 ms TTFB, 0 server reads per anon visit; instant skeleton |
| `/marketplace` | 1 in 1 · L2 | no | 236 ⚠gsap | 612/150 · M 1532 · D 1016 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/monogram` | 0 in 0 · L2 | no | 290 ⚠gsap | 496/34 · M 936 · D 972 · 407 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/mood-board` | 1 in 1 · L2 | no | 236 ⚠gsap | 487/25 · M 1208 · D 940 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/our-story` | 1 in 1 · L2 | no | 229 ⚠gsap | 461/0 · M 1012 · D 1192 · 342 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/pa3d` | 0 in 0 · L2 | no | 205 | 472/10 · M 1184 · D 1032 · 316 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/pa3d/try` | 0 in 0 · L2 | no | 198 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/pakanta` ⓛ | 0 in 0 · L2 | no | 196 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/palogo` | 1 in 1 · L2 | no | 236 ⚠gsap | 476/14 · M 1136 · D 1108 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/patiktok` ⓛ | 0 in 0 · L2 | no | 196 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/pawebsite` | 1 in 1 · L2 | no | 236 ⚠gsap | 469/7 · M 1040 · D 880 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/pricing` | 4 in 2 · L2 | no | 204 | 474/12 · M 1556 · D 1116 · 323 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/pricing/plan` | 2 in 2 · L2 | no | 203 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/privacy` | 0 in 0 · L2 | no | 195 | 531/68 · M 912 · D 1140 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/privacy/google-access` | 0 in 0 · L2 | no | 195 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/proposals/[publicId]` ⓛ | 12 in 12 · L1 | **yes (12)** | 276 | — | start the 12 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~300 ms; instant skeleton |
| `/refunds` | 0 in 0 · L2 | no | 195 | 448/0 · M 1228 · D 940 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/samahan` | 1 in 1 · L2 | no | 236 ⚠gsap | 517/55 · M 1024 · D 896 · 352 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/samahan/chat/[threadId]` ⓛ | 8 in 4 · L1 | yes (4) | 443 | — | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: chat-message-stream.tsx, chat-offered-service-card.tsx +1; add loading.tsx (Sk skeleton); split route JS (338 KB gz own) | up to ~60 ms; one fewer client round-trip; instant skeleton; −113 KB |
| `/samahan/chat/new` ⓛ | 3 in 3 · L1 | yes (3) | 162 | — | start the 3 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~30 ms; instant skeleton |
| `/samahan/join/[token]` | 2 in 2 · L1 | no | 147 | — | — | — |
| `/sample` ⓛ | 1 in 1 · L1 | no | 147 | 474/12 · M 1280 · D 1368 · 253 KB · no-store | — | — |
| `/sample/[...rest]` ⓛ | 0 in 0 · L1 | no | 147 | not measured | — | — |
| `/sample/hub/[guestKey]` ⓛ | 1 in 1 · L1 | no | 246 | not measured | — | — |
| `/schedule` | 1 in 1 · L2 | no | 236 ⚠gsap | 438/0 · M 892 · D 1180 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/seat-plan` | 1 in 1 · L2 | no | 236 ⚠gsap | 479/17 · M 924 · D 860 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/setnayan-ai` | 1 in 1 · L2 | no | 236 ⚠gsap | 432/0 · M 860 · D 852 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/site-editor/[eventId]` ⓛ | 0 in 0 · L1 | no | 146 | not measured | — | — |
| `/site-editor/[eventId]/editorial` ⓛ | 0 in 0 · L1 | no | 146 | not measured | — | — |
| `/site-editor/[eventId]/event` ⓛ | 0 in 0 · L1 | no | 146 | not measured | — | — |
| `/site-editor/[eventId]/rsvp` ⓛ | 0 in 0 · L1 | no | 146 | not measured | — | — |
| `/start` | 2 in 2 · L2 | no | 204 | — | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/suppliers` | 1 in 1 · L2 | no | 195 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/suppliers/[event]/[category]` ⓛ | 3 in 3 · L2 | no | 204 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/suppliers/[event]/[category]/[city]` ⓛ | 3 in 3 · L2 | no | 204 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/terms` | 0 in 0 · L2 | no | 195 | 474/12 · M 1000 · D 888 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/tl/about` | 0 in 0 · L2 | no | 195 | 482/20 · M 880 · D 808 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/tl/features` | 2 in 1 · L2 | no | 205 | 689/227 · M 1560 · D 1164 · 316 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/tl/features/[slug]` ⓛ | 1 in 1 · L2 | no | 200 | 520/57 · M 864 · D 1080 · 311 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/tour` ⓛ | 1 in 1 · L1 | no | 146 | 496/34 · M 1076 · D 912 · 1902 KB · no-store | — | — |
| `/tour/budget` ⓛ | 4 in 3 · L1 | yes (3) | 160 | not measured | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/tour/gallery` ⓛ | 4 in 4 · L1 | yes (4) | 149 | not measured | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/tour/seating` ⓛ | 5 in 4 · L1 | yes (4) | 163 | not measured | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/tour/vendors` ⓛ | 3 in 3 · L1 | yes (3) | 152 | not measured | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/v/[slug]` ⓛ | 65 in 37 · L1 (+1 streamed) | **yes (37)** | 284 | 1023/561 · M 3872 · D 4732 · 402 KB · STALE | start the 37 sequential reads together (one Promise.all) | up to ~1050 ms |
| `/v/[slug]/booth` ⓛ | 1 in 1 · L1 | no | 247 ⚠three | not measured | next/dynamic for three (scene-lighting.tsx) | less JS before first tap |
| `/v/[slug]/cached` ⓛ | 65 in 37 · L1 | **yes (37)** | 284 | not measured | start the 37 sequential reads together (one Promise.all) | up to ~1050 ms |
| `/v/[slug]/dates` ⓛ | 0 in 0 · L1 | no | 146 | not measured | — | — |
| `/v/[slug]/guest-review` ⓛ | 10 in 5 · L1 | **yes (5)** | 156 | not measured | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/v/[slug]/story/[eventSlug]` ⓛ | 1 in 1 · L1 | no | 146 | not measured | — | — |
| `/vendor-invite/[slug]` | 4 in 4 · L1 | yes (4) | 153 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor/claim/[token]` | 4 in 4 · L1 | yes (4) | 146 | not measured | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor/claim/[token]/finalize` | 9 in 9 · L1 | **yes (9)** | 146 | — | start the 9 sequential reads together (one Promise.all) | up to ~210 ms |
| `/vendor/fit/[ref]` ⓛ | 11 in 9 · L1 | **yes (9)** | 158 | — | start the 9 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~210 ms; instant skeleton |
| `/vendor/lock/[token]` | 6 in 6 · L1 | yes (4) | 153 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/waitlist` | 0 in 0 · L2 | no | 195 | 465/3 · M 884 · D 840 · 306 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/wall/[eventId]` ⓛ | 7 in 7 · L1 | **yes (7)** | 243 | not measured | start the 7 sequential reads together (one Promise.all) | up to ~150 ms |
| `/web-only` | 1 in 1 · L2 | no | 195 | — | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |

### Sign-in, onboarding, pay (22 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/claim/[token]` ⓛ | 2 in 2 · L1 | no | 147 | — | add loading.tsx (Sk skeleton) | instant skeleton |
| `/forgot-password` ⓛ | 0 in 0 · L1 | no | 150 | not measured | — | — |
| `/host/accept/[token]` | 5 in 4 · L1 | yes (4) | 147 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/join/[eventId]` | 11 in 11 · L1 | no | 155 | not measured | — | — |
| `/join/[eventId]/connect/confirm` | 7 in 4 · L1 | yes (4) | 147 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/join/[eventId]/set-password` | 1 in 1 · L1 | no | 150 | — | — | — |
| `/join/[eventId]/success` | 4 in 3 · L1 | yes (3) | 146 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/join/crew/[token]` ⓛ | 10 in 6 · L1 | **yes (6)** | 254 | — | start the 6 sequential reads together (one Promise.all); read in page.tsx, pass as props: crew-waiting-refresh.tsx; add loading.tsx (Sk skeleton) | up to ~120 ms; one fewer client round-trip; instant skeleton |
| `/login` ⓛ | 2 in 2 · L1 | no | 162 | 476/14 · M 1304 · D 1212 · 275 KB · no-store | add loading.tsx (Sk skeleton) | instant skeleton |
| `/onboarding/[type]` ⓛ | 9 in 7 · L1 | **yes (7)** | 220 | — | start the 7 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~150 ms; instant skeleton |
| `/onboarding/simple` ⓛ | 5 in 5 · L1 | **yes (5)** | 179 | — | start the 5 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~90 ms; instant skeleton |
| `/onboarding/wedding` | 19 in 10 · L1 | **yes (10)** | 278 | — | start the 10 sequential reads together (one Promise.all); read in page.tsx, pass as props: google-address-door.tsx, song-bank-step.tsx | up to ~240 ms; one fewer client round-trip |
| `/open-shop` ⓛ | 11 in 10 · L1 | **yes (10)** | 298 ⚠leaflet | 1029/567 · M 1452 · D 1440 · 499 KB · no-store | start the 10 sequential reads together (one Promise.all); next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: taken-sign-in.tsx; add loading.tsx (Sk skeleton) | up to ~240 ms; less JS before first tap; one fewer client round-trip; instant skeleton |
| `/open-shop/invite` ⓛ | 3 in 3 · L1 | yes (3) | 176 | — | start the 3 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~30 ms; instant skeleton |
| `/open-shop/logo` ⓛ | 3 in 3 · L1 | yes (3) | 182 | — | start the 3 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~30 ms; instant skeleton |
| `/pay/[reference]` ⓛ | 10 in 10 · L1 | **yes (10)** | 192 | — | start the 10 sequential reads together (one Promise.all); read in page.tsx, pass as props: maya-checking.tsx; add loading.tsx (Sk skeleton) | up to ~240 ms; one fewer client round-trip; instant skeleton |
| `/receipts/[receiptId]` | 6 in 4 · L1 | yes (4) | 146 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/receipts/order/[orderId]` ⓛ | 5 in 5 · L1 | **yes (5)** | 146 | — | start the 5 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~90 ms; instant skeleton |
| `/receipts/payment/[paymentId]` ⓛ | 7 in 4 · L1 | yes (4) | 146 | — | start the 4 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~60 ms; instant skeleton |
| `/reset-password` ⓛ | 1 in 1 · L1 | no | 154 | — | add loading.tsx (Sk skeleton) | instant skeleton |
| `/signup` | 2 in 2 · L1 | no | 159 | 427/0 · M 1296 · D 1216 · 320 KB · no-store | read in page.tsx, pass as props: google-address-door.tsx | one fewer client round-trip |
| `/signup/you` | 3 in 3 · L1 | yes (3) | 179 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |

### Guest (Event Hub, Papic, Panood, live) (41 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/[slug]` ⓛ | 12 in 10 · L1 (+1 streamed) | **yes (10)** | 650 | 167/0 · M 4056 · D 3304 · 791 KB · HIT | start the 10 sequential reads together (one Promise.all); read in page.tsx, pass as props: view-beacon.tsx, adopt-seat-session.tsx +4; split route JS (545 KB gz own) | up to ~240 ms; one fewer client round-trip; −182 KB |
| `/[slug]/avatar` ⓛ | 4 in 4 · L1 | yes (4) | 162 | not measured | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~60 ms; one fewer client round-trip |
| `/[slug]/cached/[key]` ⓛ | 2 in 2 · L1 | no | 650 | not measured | read in page.tsx, pass as props: view-beacon.tsx, adopt-seat-session.tsx +4; split route JS (545 KB gz own) | one fewer client round-trip; −182 KB |
| `/[slug]/everyone` ⓛ | 11 in 11 · L1 | **yes (11)** | 161 | — | start the 11 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx; add loading.tsx (Sk skeleton) | up to ~270 ms; one fewer client round-trip; instant skeleton |
| `/[slug]/find-my-table` ⓛ | 11 in 11 · L1 | **yes (10)** | 179 | not measured | start the 10 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~240 ms; one fewer client round-trip |
| `/[slug]/find-seat` ⓛ | 23 in 19 · L1 | **yes (19)** | 311 ⚠three | not measured | start the 19 sequential reads together (one Promise.all); next/dynamic for three (scene-lighting.tsx); read in page.tsx, pass as props: refresh-on-return.tsx, day-of-announcement.tsx | up to ~510 ms; less JS before first tap; one fewer client round-trip |
| `/[slug]/hub` ⓛ | 5 in 5 · L1 | **yes (5)** | 162 | not measured | start the 5 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~90 ms; one fewer client round-trip |
| `/[slug]/invite` ⓛ | 19 in 13 · L1 | yes (4) | 228 | not measured | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~60 ms; one fewer client round-trip |
| `/[slug]/invite/enter` ⓛ | 13 in 13 · L1 | **yes (11)** | 265 | — | start the 11 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx; add loading.tsx (Sk skeleton) | up to ~270 ms; one fewer client round-trip; instant skeleton |
| `/[slug]/invite/reply` ⓛ | 13 in 13 · L1 | **yes (13)** | 207 | — | start the 13 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx; add loading.tsx (Sk skeleton) | up to ~330 ms; one fewer client round-trip; instant skeleton |
| `/[slug]/pabuya` ⓛ | 6 in 6 · L1 | **yes (6)** | 182 | not measured | start the 6 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~120 ms; one fewer client round-trip |
| `/[slug]/print` ⓛ | 14 in 14 · L1 | **yes (14)** | 194 | — | start the 14 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx; add loading.tsx (Sk skeleton) | up to ~360 ms; one fewer client round-trip; instant skeleton |
| `/[slug]/recap` ⓛ | 0 in 0 · L1 | no | 162 | not measured | read in page.tsx, pass as props: day-of-announcement.tsx | one fewer client round-trip |
| `/[slug]/request` ⓛ | 5 in 5 · L1 | **yes (5)** | 189 | not measured | start the 5 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~90 ms; one fewer client round-trip |
| `/[slug]/seat` ⓛ | 26 in 21 · L1 | **yes (15)** | 198 | not measured | start the 15 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~390 ms; one fewer client round-trip |
| `/[slug]/venue` ⓛ | 7 in 5 · L1 | **yes (5)** | 163 | not measured | start the 5 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx | up to ~90 ms; one fewer client round-trip |
| `/[slug]/welcome` ⓛ | 12 in 12 · L1 | **yes (10)** | 245 | — | start the 10 sequential reads together (one Promise.all); read in page.tsx, pass as props: day-of-announcement.tsx; add loading.tsx (Sk skeleton) | up to ~240 ms; one fewer client round-trip; instant skeleton |
| `/i/[slug]` ⓛ | 4 in 4 · L1 | yes (4) | 147 | — | start the 4 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~60 ms; instant skeleton |
| `/live` ⓛ | 1 in 1 · L1 | no | 147 | 462/0 · M 928 · D 972 · 255 KB · no-store | — | — |
| `/live/screen` ⓛ | 1 in 1 · L1 | no | 157 | not measured | read in page.tsx, pass as props: screen-stage.tsx | one fewer client round-trip |
| `/panood` | 1 in 1 · L2 | no | 236 ⚠gsap | 500/38 · M 864 · D 992 · 350 KB · no-store | A1: cacheable once the shell reads the session on the client; next/dynamic for gsap (_premium.tsx) | ~150–300 ms TTFB, 0 server reads per anon visit; less JS before first tap |
| `/panood/cam/[token]` | 3 in 3 · L1 | yes (3) | 219 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/panood/control/[eventId]` ⓛ | 22 in 22 · L1 | **yes (22)** | 242 | — | start the 22 sequential reads together (one Promise.all); read in page.tsx, pass as props: ingest-health-strip.tsx; add loading.tsx (Sk skeleton) | up to ~600 ms; one fewer client round-trip; instant skeleton |
| `/panood/demo/[token]` ⓛ | 1 in 1 · L1 | no | 217 | not measured | — | — |
| `/panood/program/[eventId]` ⓛ | 7 in 7 · L1 | **yes (7)** | 149 | — | start the 7 sequential reads together (one Promise.all); add loading.tsx (Sk skeleton) | up to ~150 ms; instant skeleton |
| `/papic` | 2 in 2 · L2 | no | 271 | 470/8 · M 1288 · D 1280 · 385 KB · no-store | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/papic/(.)decorate` ⓛ | 4 in 3 · L1 | yes (3) | 185 | not measured | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/papic/(.)pool` ⓛ | 4 in 4 · L1 | yes (4) | 171 | not measured | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/papic/[...rest]` ⓛ | 0 in 0 · L1 | no | 147 | not measured | — | — |
| `/papic/claim/[token]` | 2 in 2 · L1 | no | 149 | — | — | — |
| `/papic/decorate` ⓛ | 4 in 3 · L1 | yes (3) | 171 | not measured | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/papic/demo/[token]` ⓛ | 1 in 1 · L1 | no | 218 | not measured | — | — |
| `/papic/guest` | 31 in 15 · L1 | **yes (11)** | 224 | not measured | start the 11 sequential reads together (one Promise.all); read in page.tsx, pass as props: adopt-seat-session.tsx, add-from-phone-sheet.tsx +1 | up to ~270 ms; one fewer client round-trip |
| `/papic/join/[token]` ⓛ | 0 in 0 · L1 | no | 156 | not measured | — | — |
| `/papic/me/[token]` | 7 in 6 · L1 | yes (4) | 170 ⚠mp4-muxer | not measured | start the 4 sequential reads together (one Promise.all); next/dynamic for mp4-muxer (reel-render.ts) | up to ~60 ms; less JS before first tap |
| `/papic/order/[token]` ⓛ | 3 in 2 · L1 | no | 156 | not measured | — | — |
| `/papic/pool` ⓛ | 4 in 4 · L1 | yes (4) | 158 | not measured | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/papic/seat/[token]` | 13 in 9 · L1 | **yes (7)** | 226 | — | start the 7 sequential reads together (one Promise.all); read in page.tsx, pass as props: add-from-phone-sheet.tsx, papic-challenge-panel.tsx | up to ~150 ms; one fewer client round-trip |
| `/papic/try` | 0 in 0 · L2 | no | 263 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/u/[userSlug]` ⓛ | 9 in 8 · L1 | **yes (8)** | 220 | not measured | start the 8 sequential reads together (one Promise.all); read in page.tsx, pass as props: view-beacon.tsx | up to ~180 ms; one fewer client round-trip |
| `/u/[userSlug]/c/[chapterId]` ⓛ | 5 in 5 · L1 | **yes (5)** | 152 | not measured | start the 5 sequential reads together (one Promise.all); read in page.tsx, pass as props: view-beacon.tsx | up to ~90 ms; one fewer client round-trip |

### Couple · event (/dashboard/[eventId]) (113 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/dashboard/[eventId]` | 88 in 9 · L8 (+2 streamed) | yes (4) | 594 | — | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: app-store-transactions.tsx, hub-draft-bar.tsx +3; split route JS (489 KB gz own) | up to ~60 ms; one fewer client round-trip; −163 KB |
| `/dashboard/[eventId]/access-requests` | 5 in 4 · L8 | yes (4) | 288 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/activity` | 4 in 2 · L8 | layout (8) | 277 | — | — | — |
| `/dashboard/[eventId]/alaala` | 5 in 4 · L8 | yes (4) | 277 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/alaala/assignments` | 4 in 3 · L8 | yes (3) | 279 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/apple-pro` | 1 in 1 · L8 | layout (8) | 282 | — | read in page.tsx, pass as props: apple-pro-screen.tsx | one fewer client round-trip |
| `/dashboard/[eventId]/budget` | 11 in 8 · L8 | **yes (7)** | 324 | — | start the 7 sequential reads together (one Promise.all) | up to ~150 ms |
| `/dashboard/[eventId]/checklist` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/clearance` | 3 in 3 · L8 | yes (3) | 278 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/contracts` | 3 in 3 · L8 | yes (3) | 277 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/contracts/[contractId]` | 3 in 3 · L8 | yes (3) | 278 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/date-selection` | 13 in 10 · L8 | **yes (10)** | 299 | — | start the 10 sequential reads together (one Promise.all) | up to ~240 ms |
| `/dashboard/[eventId]/details` | 25 in 6 · L8 | yes (4) | 386 | — | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: part-edit-gate.tsx, use-part-editor-lock.ts +1 | up to ~60 ms; one fewer client round-trip |
| `/dashboard/[eventId]/details/(.)field/[row]` | 5 in 3 · L8 (+2 streamed) | layout (8) | 392 | — | — | — |
| `/dashboard/[eventId]/details/change` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/details/field/[row]` | 35 in 9 · L8 (+2 streamed) | **yes (5)** | 437 | — | start the 5 sequential reads together (one Promise.all); read in page.tsx, pass as props: part-edit-gate.tsx, use-part-editor-lock.ts +1; split route JS (333 KB gz own) | up to ~90 ms; one fewer client round-trip; −111 KB |
| `/dashboard/[eventId]/disputes` | 4 in 3 · L8 | yes (3) | 291 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/documents` | 8 in 5 · L8 | **yes (5)** | 277 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/dashboard/[eventId]/event-page` | 3 in 2 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/event-qr` | 2 in 2 · L8 | layout (8) | 277 | — | — | — |
| `/dashboard/[eventId]/find-date` | 6 in 4 · L8 | yes (4) | 280 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/galleries` | 9 in 6 · L8 | yes (4) | 310 ⚠gsap | — | start the 4 sequential reads together (one Promise.all); next/dynamic for gsap (_premium.tsx) | up to ~60 ms; less JS before first tap |
| `/dashboard/[eventId]/guests` | 27 in 4 · L8 (+6 streamed) | layout (8) | 548 | — | read in page.tsx, pass as props: send-invite.tsx, part-edit-gate.tsx +1; split route JS (443 KB gz own) | one fewer client round-trip; −148 KB |
| `/dashboard/[eventId]/guests/[guestId]` | 2 in 2 · L8 | layout (8) | 444 | — | read in page.tsx, pass as props: send-invite.tsx; split route JS (340 KB gz own) | one fewer client round-trip; −113 KB |
| `/dashboard/[eventId]/guests/checkin` | 17 in 6 · L8 | **yes (6)** | 405 | — | start the 6 sequential reads together (one Promise.all); split route JS (300 KB gz own) | up to ~120 ms; −100 KB |
| `/dashboard/[eventId]/guests/claims` | 12 in 10 · L8 | **yes (10)** | 387 | — | start the 10 sequential reads together (one Promise.all) | up to ~240 ms |
| `/dashboard/[eventId]/guests/import` | 1 in 1 · L8 | layout (8) | 388 | — | — | — |
| `/dashboard/[eventId]/guests/invite` | 12 in 8 · L8 | layout (8) | 395 | — | — | — |
| `/dashboard/[eventId]/guests/new` | 6 in 6 · L8 | **yes (6)** | 391 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/dashboard/[eventId]/guests/send` | 8 in 4 · L8 | yes (4) | 399 | — | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: send-invite.tsx | up to ~60 ms; one fewer client round-trip |
| `/dashboard/[eventId]/guests/souvenirs` | 9 in 5 · L8 | **yes (5)** | 283 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/dashboard/[eventId]/guests/tea-ceremony` | 4 in 4 · L8 | yes (4) | 278 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/hosts` | 5 in 3 · L8 | yes (3) | 277 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/invitation` | 9 in 8 · L8 | **yes (8)** | 296 | — | start the 8 sequential reads together (one Promise.all); read in page.tsx, pass as props: slug-field.tsx | up to ~180 ms; one fewer client round-trip |
| `/dashboard/[eventId]/invitation/print` | 6 in 6 · L8 | **yes (6)** | 277 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/dashboard/[eventId]/launch` | 48 in 25 · L8 (+9 streamed) | **yes (14)** | 499 | — | start the 14 sequential reads together (one Promise.all); read in page.tsx, pass as props: slug-field.tsx, maker-shell.tsx +5; split route JS (394 KB gz own) | up to ~360 ms; one fewer client round-trip; −131 KB |
| `/dashboard/[eventId]/live` | 16 in 9 · L8 | **yes (6)** | 282 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/dashboard/[eventId]/manpower` | 4 in 4 · L8 | yes (4) | 280 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/memories` | 40 in 13 · L8 (+12 streamed) | **yes (9)** | 586 | — | start the 9 sequential reads together (one Promise.all); read in page.tsx, pass as props: use-app-store-prices.ts, inline-checkout-drawer.tsx +1; split route JS (482 KB gz own) | up to ~210 ms; one fewer client round-trip; −161 KB |
| `/dashboard/[eventId]/memories/download-all` | 3 in 3 · L8 | yes (3) | 279 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/memories/thank-you` | 9 in 5 · L8 | **yes (5)** | 336 ⚠mp4-muxer | — | start the 5 sequential reads together (one Promise.all); next/dynamic for mp4-muxer (reel-render.ts); read in page.tsx, pass as props: inline-checkout-drawer.tsx, use-app-store-prices.ts | up to ~90 ms; less JS before first tap; one fewer client round-trip |
| `/dashboard/[eventId]/messages` | 14 in 9 · L8 | **yes (7)** | 327 | — | start the 7 sequential reads together (one Promise.all); read in page.tsx, pass as props: live-inbox-refresh.tsx | up to ~150 ms; one fewer client round-trip |
| `/dashboard/[eventId]/messages/(..)vendors/[vendorId]/workspace` | 45 in 33 · L8 | **yes (33)** | 603 | — | start the 33 sequential reads together (one Promise.all); read in page.tsx, pass as props: chat-message-stream.tsx, chat-offered-service-card.tsx +2; split route JS (498 KB gz own) | up to ~930 ms; one fewer client round-trip; −166 KB |
| `/dashboard/[eventId]/messages/[threadId]` | 34 in 6 · L8 | yes (4) | 574 | — | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: chat-message-stream.tsx, chat-offered-service-card.tsx +2; split route JS (469 KB gz own) | up to ~60 ms; one fewer client round-trip; −156 KB |
| `/dashboard/[eventId]/monogram` | 13 in 12 · L8 | **yes (6)** | 377 | — | start the 6 sequential reads together (one Promise.all); read in page.tsx, pass as props: inline-checkout-drawer.tsx | up to ~120 ms; one fewer client round-trip |
| `/dashboard/[eventId]/more` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/nikah` | 5 in 4 · L8 | yes (4) | 279 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/orders` | 3 in 3 · L8 | yes (3) | 278 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/orders/[orderId]` | 5 in 3 · L8 | yes (3) | 277 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/orders/new` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/pabuya` | 3 in 3 · L8 | yes (3) | 314 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/paperwork` | 5 in 3 · L8 | yes (3) | 291 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/people` | 3 in 2 · L8 | layout (8) | 277 | — | — | — |
| `/dashboard/[eventId]/plan3d` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/prints` | 48 in 14 · L8 (+9 streamed) | layout (8) | 499 | — | read in page.tsx, pass as props: slug-field.tsx, maker-shell.tsx +5; split route JS (394 KB gz own) | one fewer client round-trip; −131 KB |
| `/dashboard/[eventId]/progress` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/refer` | 3 in 3 · L8 | yes (3) | 278 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/schedule` | 45 in 20 · L8 | **yes (17)** | 295 | — | start the 17 sequential reads together (one Promise.all); read in page.tsx, pass as props: part-edit-gate.tsx, use-part-editor-lock.ts | up to ~450 ms; one fewer client round-trip |
| `/dashboard/[eventId]/seating` | 21 in 7 · L8 (+1 streamed) | **yes (6)** | 298 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/dashboard/[eventId]/seating/chart` | 8 in 5 · L8 | **yes (5)** | 280 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/dashboard/[eventId]/seating/lab` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/seating/walkthrough` | 4 in 3 · L8 | yes (3) | 295 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/sponsors` | 5 in 4 · L8 | yes (4) | 285 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/story` | 16 in 16 · L8 | **yes (16)** | 362 | — | start the 16 sequential reads together (one Promise.all) | up to ~420 ms |
| `/dashboard/[eventId]/studio/[addon]` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/studio/about/[addon]` | 9 in 7 · L8 | yes (3) | 293 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/studio/guest-columns` | 6 in 6 · L8 | **yes (6)** | 279 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/dashboard/[eventId]/studio/indoor-blueprint` | 1 in 1 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/studio/live-studio-control` | 13 in 6 · L8 | **yes (6)** | 328 | — | start the 6 sequential reads together (one Promise.all); read in page.tsx, pass as props: inline-checkout-drawer.tsx | up to ~120 ms; one fewer client round-trip |
| `/dashboard/[eventId]/studio/live-studio-control/setup` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/studio/mood-board` | 5 in 4 · L8 | yes (3) | 285 | — | start the 3 sequential reads together (one Promise.all); read in page.tsx, pass as props: part-edit-gate.tsx, use-part-editor-lock.ts | up to ~30 ms; one fewer client round-trip |
| `/dashboard/[eventId]/studio/pakanta` | 12 in 12 · L8 | **yes (11)** | 321 | — | start the 11 sequential reads together (one Promise.all); read in page.tsx, pass as props: inline-checkout-drawer.tsx, use-app-store-prices.ts | up to ~270 ms; one fewer client round-trip |
| `/dashboard/[eventId]/studio/panood` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/studio/panood/broadcast` | 11 in 9 · L8 | **yes (9)** | 351 | — | start the 9 sequential reads together (one Promise.all) | up to ~210 ms |
| `/dashboard/[eventId]/studio/panood/cameras` | 8 in 7 · L8 | **yes (7)** | 279 | — | start the 7 sequential reads together (one Promise.all) | up to ~150 ms |
| `/dashboard/[eventId]/studio/panood/cameras/print` | 5 in 5 · L8 | **yes (5)** | 277 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/dashboard/[eventId]/studio/panood/setup` | 13 in 11 · L8 | **yes (11)** | 286 | — | start the 11 sequential reads together (one Promise.all) | up to ~270 ms |
| `/dashboard/[eventId]/studio/panood/setup/venue-check` | 3 in 3 · L8 | yes (3) | 291 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/studio/papic/crew` | 4 in 4 · L8 | yes (4) | 278 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/studio/papic/crew/poster` | 4 in 4 · L8 | yes (4) | 278 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/studio/papic/crew/print` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/studio/papic/moderation` | 19 in 11 · L8 | **yes (8)** | 281 | — | start the 8 sequential reads together (one Promise.all) | up to ~180 ms |
| `/dashboard/[eventId]/studio/papic/recap` | 7 in 7 · L8 | **yes (7)** | 282 | — | start the 7 sequential reads together (one Promise.all) | up to ~150 ms |
| `/dashboard/[eventId]/studio/patiktok` | 13 in 13 · L8 | **yes (13)** | 340 ⚠mp4-muxer | — | start the 13 sequential reads together (one Promise.all); next/dynamic for mp4-muxer (reel-render.ts); read in page.tsx, pass as props: use-app-store-prices.ts, inline-checkout-drawer.tsx | up to ~330 ms; less JS before first tap; one fewer client round-trip |
| `/dashboard/[eventId]/studio/patiktok/[templateId]` | 4 in 4 · L8 | yes (4) | 280 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/studio/patiktok/booth` | 9 in 9 · L8 | **yes (9)** | 287 | — | start the 9 sequential reads together (one Promise.all) | up to ~210 ms |
| `/dashboard/[eventId]/studio/photo-delivery` | 5 in 5 · L8 | **yes (5)** | 280 | — | start the 5 sequential reads together (one Promise.all); read in page.tsx, pass as props: release-progress-poller.tsx | up to ~90 ms; one fewer client round-trip |
| `/dashboard/[eventId]/studio/playlist` | 8 in 2 · L8 | layout (8) | 284 | — | — | — |
| `/dashboard/[eventId]/studio/save-the-date` | 17 in 12 · L8 | **yes (12)** | 383 | — | start the 12 sequential reads together (one Promise.all); read in page.tsx, pass as props: inline-checkout-drawer.tsx | up to ~300 ms; one fewer client round-trip |
| `/dashboard/[eventId]/studio/save-the-date/stamp` | 3 in 3 · L8 | yes (3) | 290 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/studio/setnayan-ai` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/studio/website-pro` | 3 in 2 · L8 | layout (8) | 308 | — | read in page.tsx, pass as props: use-app-store-prices.ts | one fewer client round-trip |
| `/dashboard/[eventId]/vendors` | 53 in 17 · L8 (+1 streamed) | **yes (15)** | 667 | — | start the 15 sequential reads together (one Promise.all); read in page.tsx, pass as props: send-invite.tsx, services-covered-picker.tsx +1; split route JS (562 KB gz own) | up to ~390 ms; one fewer client round-trip; −187 KB |
| `/dashboard/[eventId]/vendors/[vendorId]` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/vendors/[vendorId]/review` | 13 in 13 · L8 | **yes (13)** | 284 | — | start the 13 sequential reads together (one Promise.all) | up to ~330 ms |
| `/dashboard/[eventId]/vendors/[vendorId]/workspace` | 71 in 39 · L8 (+2 streamed) | **yes (33)** | 603 | — | start the 33 sequential reads together (one Promise.all); read in page.tsx, pass as props: chat-message-stream.tsx, chat-offered-service-card.tsx +2; split route JS (498 KB gz own) | up to ~930 ms; one fewer client round-trip; −166 KB |
| `/dashboard/[eventId]/vendors/categories` | 6 in 6 · L8 | **yes (6)** | 280 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/dashboard/[eventId]/vendors/packages/[bookingId]` | 5 in 5 · L8 | **yes (5)** | 281 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/dashboard/[eventId]/website` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/website/colors` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/website/editor` | 23 in 14 · L8 | **yes (11)** | 436 | — | start the 11 sequential reads together (one Promise.all); read in page.tsx, pass as props: editor-shell.tsx, buffered-canvas-frame.tsx +1; split route JS (331 KB gz own) | up to ~270 ms; one fewer client round-trip; −110 KB |
| `/dashboard/[eventId]/website/editorial` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/website/hero-photo` | 2 in 2 · L8 | layout (8) | 294 | — | — | — |
| `/dashboard/[eventId]/website/living-hero` | 4 in 4 · L8 | yes (4) | 290 ⚠mp4-muxer | — | start the 4 sequential reads together (one Promise.all); next/dynamic for mp4-muxer (boomerang-encoder.ts) | up to ~60 ms; less JS before first tap |
| `/dashboard/[eventId]/website/our-photos` | 4 in 4 · L8 | yes (4) | 289 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/dashboard/[eventId]/website/our-story` | 16 in 10 · L8 | **yes (8)** | 357 | — | start the 8 sequential reads together (one Promise.all) | up to ~180 ms |
| `/dashboard/[eventId]/website/photo-moments` | 2 in 2 · L8 | layout (8) | 340 | — | — | — |
| `/dashboard/[eventId]/website/privacy` | 3 in 3 · L8 | yes (3) | 278 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/website/site-chrome` | 3 in 3 · L8 | yes (3) | 289 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/[eventId]/website/special-message` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/website/stories` | 5 in 5 · L8 | **yes (5)** | 278 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/dashboard/[eventId]/website/what-to-bring` | 0 in 0 · L8 | layout (8) | 278 | — | — | — |
| `/dashboard/[eventId]/website/widgets` | 5 in 5 · L8 | **yes (5)** | 278 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |

### Couple · account (/dashboard) (17 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/dashboard` | 79 in 7 · L4 | yes (3) | 324 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/(.)create-event` | 15 in 13 · L4 | no | 298 | not measured | A1: cacheable once the shell reads the session on the client | ~150–300 ms TTFB, 0 server reads per anon visit |
| `/dashboard/api-keys` | 0 in 0 · L4 | no | 212 | — | — | — |
| `/dashboard/billing` | 5 in 4 · L4 | yes (4) | 212 | — | L6 owns (skeletons): noted only | — |
| `/dashboard/create-event` | 15 in 13 · L4 | **yes (13)** | 301 | — | start the 13 sequential reads together (one Promise.all) | up to ~330 ms |
| `/dashboard/creator` | 5 in 4 · L4 | no | 233 ⚠mp4-muxer | — | next/dynamic for mp4-muxer (reel-render.ts) | less JS before first tap |
| `/dashboard/library` | 0 in 0 · L4 | no | 212 | — | — | — |
| `/dashboard/life-flash` | 3 in 3 · L4 | yes (3) | 246 ⚠gsap | — | start the 3 sequential reads together (one Promise.all); next/dynamic for gsap (use-flash-timeline.ts) | up to ~30 ms; less JS before first tap |
| `/dashboard/notifications` | 4 in 3 · L4 | yes (3) | 230 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/people` | 0 in 0 · L4 | no | 212 | — | — | — |
| `/dashboard/people/[dependentId]` | 6 in 6 · L4 | **yes (6)** | 211 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/dashboard/profile` | 10 in 9 · L4 | **yes (9)** | 242 | — | start the 9 sequential reads together (one Promise.all) | up to ~210 ms |
| `/dashboard/samahan` | 0 in 0 · L4 | no | 212 | — | — | — |
| `/dashboard/samahan/[communityId]` | 8 in 3 · L4 | yes (3) | 306 | — | start the 3 sequential reads together (one Promise.all); read in page.tsx, pass as props: mark-group-read.tsx | up to ~30 ms; one fewer client round-trip |
| `/dashboard/samahan/new` | 0 in 0 · L4 | no | 211 | — | — | — |
| `/dashboard/search` | 6 in 4 · L4 | yes (3) | 218 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/dashboard/year` | 0 in 0 · L4 | no | 212 | — | — | — |

### Supplier (/vendor-dashboard) (96 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/vendor-dashboard` <sub>vendor-dashboard/@rise</sub> | 0 in 0 · L5 | no | 585 | — | L6 owns (skeletons): noted only | — |
| `/vendor-dashboard` <sub>vendor-dashboard</sub> | 31 in 8 · L5 | **yes (7)** | 585 ⚠leaflet | — | L6 owns (skeletons): noted only | — |
| `/vendor-dashboard/(.)profile` | 5 in 3 · L5 | yes (3) | 379 ⚠leaflet | — | start the 3 sequential reads together (one Promise.all); next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: use-app-store-prices.ts | up to ~30 ms; less JS before first tap; one fewer client round-trip |
| `/vendor-dashboard/(.)services/[serviceId]` | 14 in 5 · L5 | no | 481 | — | read in page.tsx, pass as props: canvas-maker.tsx; split route JS (376 KB gz own) | one fewer client round-trip; −125 KB |
| `/vendor-dashboard/(.)services/new` | 7 in 4 · L5 | yes (4) | 486 | — | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: canvas-maker.tsx; split route JS (382 KB gz own) | up to ~60 ms; one fewer client round-trip; −127 KB |
| `/vendor-dashboard/(.)services/new/[category]` | 12 in 10 · L5 | **yes (10)** | 461 | — | start the 10 sequential reads together (one Promise.all); read in page.tsx, pass as props: canvas-maker.tsx; split route JS (357 KB gz own) | up to ~240 ms; one fewer client round-trip; −119 KB |
| `/vendor-dashboard/(.)settings` | 5 in 3 · L5 | yes (3) | 260 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/(.)subscription` | 0 in 0 · L5 | no | 276 | — | — | — |
| `/vendor-dashboard/(.)team` | 0 in 0 · L5 | no | 274 | — | — | — |
| `/vendor-dashboard/(.)theft-watch` | 6 in 6 · L5 | **yes (6)** | 259 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/vendor-dashboard/(.)track-record` | 5 in 5 · L5 | **yes (5)** | 251 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/vendor-dashboard/(.)website` | 4 in 3 · L5 | yes (3) | 372 ⚠leaflet | — | start the 3 sequential reads together (one Promise.all); next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: use-app-store-prices.ts | up to ~30 ms; less JS before first tap; one fewer client round-trip |
| `/vendor-dashboard/[...rest]` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/activities` | 4 in 4 · L5 | yes (3) | 284 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/attributes` | 5 in 4 · L5 | yes (4) | 277 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/booking-fees` | 6 in 4 · L5 | yes (4) | 249 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/booking-fees/[orderId]` | 7 in 5 · L5 | **yes (5)** | 259 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/vendor-dashboard/bookings` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/branches` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/calendar` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/calendar/[date]` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/clients` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/clients/[eventId]` | 67 in 22 · L5 (+2 streamed) | **yes (21)** | 532 | — | start the 21 sequential reads together (one Promise.all); read in page.tsx, pass as props: vendor-payment-live.tsx; split route JS (427 KB gz own) | up to ~570 ms; one fewer client round-trip; −142 KB |
| `/vendor-dashboard/clients/[eventId]/challenge-photos` | 6 in 5 · L5 | **yes (5)** | 249 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/vendor-dashboard/clients/[eventId]/cocktail` | 5 in 4 · L5 | yes (4) | 276 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/clients/[eventId]/editorial-media` | 6 in 5 · L5 | **yes (5)** | 263 ⚠mp4-muxer | — | start the 5 sequential reads together (one Promise.all); next/dynamic for mp4-muxer (boomerang-encoder.ts) | up to ~90 ms; less JS before first tap |
| `/vendor-dashboard/clients/[eventId]/mood-board` | 10 in 6 · L5 | **yes (6)** | 281 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/vendor-dashboard/clients/[eventId]/production-sheet` | 7 in 5 · L5 | **yes (5)** | 264 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/vendor-dashboard/clients/[eventId]/seat-plan` | 5 in 4 · L5 | yes (4) | 249 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/clients/[eventId]/their-event/[part]` | 6 in 6 · L5 | **yes (6)** | 249 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/vendor-dashboard/collections` | 4 in 3 · L5 | yes (3) | 335 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/collections/albums` | 5 in 4 · L5 | yes (4) | 339 ⚠leaflet | — | start the 4 sequential reads together (one Promise.all); next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: use-app-store-prices.ts | up to ~60 ms; less JS before first tap; one fewer client round-trip |
| `/vendor-dashboard/contracts` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/contracts/[contractId]` | 4 in 4 · L5 | yes (4) | 261 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/contracts/new` | 3 in 3 · L5 | yes (3) | 261 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/creators` | 6 in 3 · L5 | yes (3) | 281 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/customers` <sub>vendor-dashboard/customers/@client</sub> | 0 in 0 · L5 | no | 362 | — | — | — |
| `/vendor-dashboard/customers` <sub>vendor-dashboard/customers</sub> | 72 in 9 · L5 (+5 streamed) | no | 362 | — | — | — |
| `/vendor-dashboard/customers/(..)clients/[eventId]` | 46 in 21 · L5 | **yes (21)** | 533 | — | start the 21 sequential reads together (one Promise.all); read in page.tsx, pass as props: vendor-payment-live.tsx; split route JS (428 KB gz own) | up to ~570 ms; one fewer client round-trip; −143 KB |
| `/vendor-dashboard/deep-search` | 6 in 6 · L5 | **yes (6)** | 262 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/vendor-dashboard/demand` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/disputes` | 3 in 3 · L5 | yes (3) | 265 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/earnings` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/events` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/help` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/invite` | 15 in 11 · L5 | **yes (11)** | 327 | — | start the 11 sequential reads together (one Promise.all); read in page.tsx, pass as props: app-store-transactions.tsx, use-app-store-prices.ts | up to ~270 ms; one fewer client round-trip |
| `/vendor-dashboard/lines` | 4 in 3 · L5 | yes (3) | 271 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/locked-qr` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/manpower` | 6 in 5 · L5 | no | 259 | — | — | — |
| `/vendor-dashboard/messages` | 3 in 3 · L5 | yes (3) | 298 | — | L6 owns (skeletons): noted only | — |
| `/vendor-dashboard/messages/(..)clients/[eventId]` | 46 in 21 · L5 | **yes (21)** | 533 | — | L6 owns (skeletons): noted only | — |
| `/vendor-dashboard/messages/[threadId]` | 2 in 2 · L5 | no | 462 | — | L6 owns (skeletons): noted only | — |
| `/vendor-dashboard/moodboard-library` | 8 in 4 · L5 | yes (4) | 297 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/more` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/notifications` | 4 in 3 · L5 | yes (3) | 270 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/on-the-day` | 11 in 8 · L5 | **yes (8)** | 258 | — | start the 8 sequential reads together (one Promise.all) | up to ~180 ms |
| `/vendor-dashboard/on-the-day/live/[eventId]` | 28 in 19 · L5 | **yes (18)** | 435 | — | start the 18 sequential reads together (one Promise.all); read in page.tsx, pass as props: live-reviews.tsx, requests-inbox.tsx; split route JS (330 KB gz own) | up to ~480 ms; one fewer client round-trip; −110 KB |
| `/vendor-dashboard/on-the-day/live/[eventId]/papic` | 17 in 13 · L5 | **yes (9)** | 282 | — | start the 9 sequential reads together (one Promise.all) | up to ~210 ms |
| `/vendor-dashboard/packages` | 3 in 3 · L5 | yes (3) | 251 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/packages/[packageId]` | 8 in 6 · L5 | **yes (6)** | 306 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/vendor-dashboard/partnerships` | 9 in 8 · L5 | **yes (8)** | 270 | — | start the 8 sequential reads together (one Promise.all) | up to ~180 ms |
| `/vendor-dashboard/payday` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/payment-options` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/performance` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/profile` | 9 in 7 · L5 | yes (3) | 379 ⚠leaflet | — | start the 3 sequential reads together (one Promise.all); next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: use-app-store-prices.ts | up to ~30 ms; less JS before first tap; one fewer client round-trip |
| `/vendor-dashboard/proposals` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/recaps` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/recommendations` | 9 in 4 · L5 | yes (4) | 265 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/repertoire` | 7 in 3 · L5 | yes (3) | 280 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/reviews` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/services` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/services/[serviceId]` | 14 in 5 · L5 | **yes (5)** | 480 | — | start the 5 sequential reads together (one Promise.all); read in page.tsx, pass as props: canvas-maker.tsx; split route JS (375 KB gz own) | up to ~90 ms; one fewer client round-trip; −125 KB |
| `/vendor-dashboard/services/new` | 7 in 4 · L5 | yes (4) | 486 | — | start the 4 sequential reads together (one Promise.all); read in page.tsx, pass as props: canvas-maker.tsx; split route JS (382 KB gz own) | up to ~60 ms; one fewer client round-trip; −127 KB |
| `/vendor-dashboard/services/new/[category]` | 12 in 10 · L5 | **yes (10)** | 461 | — | start the 10 sequential reads together (one Promise.all); read in page.tsx, pass as props: canvas-maker.tsx; split route JS (356 KB gz own) | up to ~240 ms; one fewer client round-trip; −119 KB |
| `/vendor-dashboard/services/requests` | 4 in 3 · L5 | yes (3) | 251 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/services/requests/[requestId]` | 7 in 5 · L5 | **yes (5)** | 253 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/vendor-dashboard/services/requests/new` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/services/their-work` | 5 in 4 · L5 | yes (4) | 254 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/vendor-dashboard/settings` | 5 in 3 · L5 | yes (3) | 260 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/shop` | 7 in 4 · L5 (+4 streamed) | no | 561 ⚠leaflet | — | next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: app-store-transactions.tsx, use-app-store-prices.ts +1; split route JS (456 KB gz own) | less JS before first tap; one fewer client round-trip; −152 KB |
| `/vendor-dashboard/shop/badges` | 3 in 3 · L5 | yes (3) | 324 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/shop/promote` | 6 in 5 · L5 | no | 387 ⚠leaflet | — | next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: use-app-store-prices.ts, app-store-transactions.tsx | less JS before first tap; one fewer client round-trip |
| `/vendor-dashboard/shop/qrs` | 3 in 3 · L5 | yes (3) | 251 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/shop/qrs/[code]` | 3 in 3 · L5 | yes (3) | 318 | — | start the 3 sequential reads together (one Promise.all); read in page.tsx, pass as props: app-store-transactions.tsx, use-app-store-prices.ts | up to ~30 ms; one fewer client round-trip |
| `/vendor-dashboard/shop/store` | 1 in 1 · L5 | no | 339 | — | — | — |
| `/vendor-dashboard/shop/store/[shelf]` | 1 in 1 · L5 | no | 339 | — | — | — |
| `/vendor-dashboard/shop/store/[shelf]/[item]` | 1 in 1 · L5 | no | 339 | — | — | — |
| `/vendor-dashboard/spaces` | 5 in 3 · L5 | yes (3) | 318 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/vendor-dashboard/subscription` | 21 in 15 · L5 | no | 274 | — | — | — |
| `/vendor-dashboard/team` | 28 in 6 · L5 | no | 274 | — | — | — |
| `/vendor-dashboard/team/roles` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/team/roles/inquiries` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/theft-watch` | 6 in 6 · L5 | **yes (6)** | 259 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/vendor-dashboard/track-record` | 5 in 5 · L5 | **yes (5)** | 251 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/vendor-dashboard/verify` | 0 in 0 · L5 | no | 247 | — | — | — |
| `/vendor-dashboard/website` | 4 in 3 · L5 | yes (3) | 372 ⚠leaflet | — | start the 3 sequential reads together (one Promise.all); next/dynamic for leaflet (city-pin.tsx); read in page.tsx, pass as props: use-app-store-prices.ts | up to ~30 ms; less JS before first tap; one fewer client round-trip |

### Admin (/admin) (118 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/admin` | 5 in 4 · L7 | layout (7) | 355 | — | — | — |
| `/admin/account-deletions` | 4 in 4 · L7 | yes (4) | 328 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/accounts` | 30 in 6 · L7 | layout (7) | 342 | — | — | — |
| `/admin/addons` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/admin-log` | 4 in 3 · L7 | yes (3) | 327 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/app-performance` | 3 in 1 · L7 (+2 streamed) | layout (7) | 422 | — | read in page.tsx, pass as props: health-now.tsx; split route JS (318 KB gz own) | one fewer client round-trip; −106 KB |
| `/admin/approvals` | 9 in 6 · L7 | **yes (6)** | 327 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/admin/ask` | 1 in 1 · L7 | layout (7) | 327 | — | — | — |
| `/admin/background-videos` | 2 in 2 · L7 | layout (7) | 328 | — | — | — |
| `/admin/booking-fees` | 8 in 8 · L7 | **yes (8)** | 329 | — | start the 8 sequential reads together (one Promise.all) | up to ~180 ms |
| `/admin/brain` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/budget-planner` | 5 in 2 · L7 | layout (7) | 327 | — | — | — |
| `/admin/business` | 0 in 0 · L7 | layout (7) | 394 ⚠jsqr | — | next/dynamic for jsqr (qr-upload-form.tsx) | less JS before first tap |
| `/admin/catalogue` | 2 in 2 · L7 | layout (7) | 327 | — | — | — |
| `/admin/categories` | 18 in 9 · L7 | **yes (7)** | 393 | — | start the 7 sequential reads together (one Promise.all) | up to ~150 ms |
| `/admin/categories/requests` | 4 in 3 · L7 | yes (3) | 327 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/categories/requests/[requestId]` | 7 in 4 · L7 | yes (4) | 333 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/chat-flags` | 4 in 2 · L7 | layout (7) | 327 | — | — | — |
| `/admin/colours` | 2 in 2 · L7 | layout (7) | 339 | — | — | — |
| `/admin/completions` | 4 in 4 · L7 | yes (4) | 327 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/compliance` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/compliance/data-sheet` | 4 in 4 · L7 | yes (4) | 327 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/connection-logs` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/corrections` | 5 in 5 · L7 | **yes (5)** | 328 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/admin/data-privacy` | 4 in 4 · L7 | yes (3) | 334 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/demand` | 3 in 2 · L7 | layout (7) | 327 | — | — | — |
| `/admin/demo-vendors` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/demo-vendors/inquiries` | 3 in 3 · L7 | yes (3) | 327 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/demo-vendors/inquiries/[threadId]` | 5 in 5 · L7 | **yes (5)** | 329 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/admin/directory` | 1 in 1 · L7 | layout (7) | 344 | — | — | — |
| `/admin/discount-codes` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/discount-codes/[id]/edit` | 6 in 2 · L7 | layout (7) | 331 | — | — | — |
| `/admin/discount-codes/new` | 4 in 2 · L7 | layout (7) | 330 | — | — | — |
| `/admin/disputes` | 17 in 9 · L7 | **yes (6)** | 330 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/admin/editorial-review` | 2 in 2 · L7 | layout (7) | 327 | — | — | — |
| `/admin/editorial-review/[editorialId]` | 2 in 2 · L7 | layout (7) | 329 | — | — | — |
| `/admin/email-delivery` | 9 in 4 · L7 | layout (7) | 332 | — | — | — |
| `/admin/event-deletions` | 3 in 3 · L7 | yes (3) | 327 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/events` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/events/[eventId]` | 14 in 13 · L7 | **yes (13)** | 333 | — | start the 13 sequential reads together (one Promise.all) | up to ~330 ms |
| `/admin/force-majeure` | 7 in 5 · L7 | yes (3) | 327 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/force-majeure/[flagId]` | 7 in 4 · L7 | yes (4) | 335 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/founder-seats` | 2 in 2 · L7 | layout (7) | 327 | — | — | — |
| `/admin/fraud` | 5 in 3 · L7 | yes (3) | 328 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/funnels` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/gifts` | 22 in 16 · L7 | **yes (16)** | 329 | — | start the 16 sequential reads together (one Promise.all) | up to ~420 ms |
| `/admin/growth` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/help` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/help/guides` | 2 in 2 · L7 | layout (7) | 328 | — | — | — |
| `/admin/hub-music` | 2 in 2 · L7 | layout (7) | 334 | — | — | — |
| `/admin/insights` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/integrations` | 8 in 5 · L7 | **yes (5)** | 327 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/admin/integrity-watch` | 3 in 2 · L7 | layout (7) | 327 | — | — | — |
| `/admin/intelligence` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/journal-spotlights` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/launch-offer` | 4 in 4 · L7 | yes (4) | 328 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/live-studio-channels` | 5 in 5 · L7 | **yes (5)** | 329 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/admin/menus` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/money` | 0 in 0 · L7 | layout (7) | 330 | — | — | — |
| `/admin/moodboard-library` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/more` | 1 in 1 · L7 | layout (7) | 327 | — | — | — |
| `/admin/notifications` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/npc-readiness` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/offers` | 15 in 5 · L7 | layout (7) | 335 | — | — | — |
| `/admin/offline` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/onboarding` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/operations-hiring` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/pakanta` | 5 in 5 · L7 | **yes (5)** | 339 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/admin/papic-storage` | 8 in 6 · L7 | **yes (6)** | 329 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/admin/patiktok` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/pax-changes` | 4 in 4 · L7 | yes (4) | 327 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/payment-options` | 2 in 2 · L7 | layout (7) | 338 | — | — | — |
| `/admin/payments` | 0 in 0 · L7 | layout (7) | 352 | — | — | — |
| `/admin/payments/supplier-refunds` | 7 in 5 · L7 | **yes (5)** | 327 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/admin/payouts` | 3 in 2 · L7 | layout (7) | 331 | — | — | — |
| `/admin/price-bands` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/pricing` | 1 in 1 · L7 | layout (7) | 347 | — | — | — |
| `/admin/queues` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/real-stories` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/recaps` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/receipts` | 3 in 1 · L7 | layout (7) | 327 | — | — | — |
| `/admin/referrals` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/repost-watch` | 11 in 6 · L7 | yes (4) | 327 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/reveal-studio` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/reviews` | 10 in 7 · L7 | **yes (7)** | 327 | — | start the 7 sequential reads together (one Promise.all) | up to ~150 ms |
| `/admin/search-memory` | 2 in 2 · L7 | layout (7) | 331 | — | — | — |
| `/admin/secrets` | 4 in 2 · L7 | layout (7) | 334 | — | — | — |
| `/admin/seo` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/settings` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/settings/demo-mode` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/settings/payment-methods` | 6 in 6 · L7 | **yes (6)** | 375 ⚠jsqr | — | start the 6 sequential reads together (one Promise.all); next/dynamic for jsqr (actions.ts) | up to ~120 ms; less JS before first tap |
| `/admin/social-queue` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/songs` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/spotlight-awards` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/studio` | 0 in 0 · L7 | layout (7) | 375 | — | — | — |
| `/admin/subscriptions` | 7 in 6 · L7 | **yes (6)** | 327 | — | start the 6 sequential reads together (one Promise.all) | up to ~120 ms |
| `/admin/switches` | 0 in 0 · L7 | layout (7) | 347 ⚠jsqr | — | next/dynamic for jsqr (actions.ts) | less JS before first tap |
| `/admin/team` | 4 in 3 · L7 | yes (3) | 327 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |
| `/admin/ugat` | 0 in 0 · L7 | layout (7) | 347 | — | — | — |
| `/admin/ugat/map` | 2 in 2 · L7 | layout (7) | 389 | — | read in page.tsx, pass as props: ugat-console.tsx | one fewer client round-trip |
| `/admin/user-reports` | 9 in 4 · L7 | yes (4) | 327 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/users` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/users/[userId]` | 18 in 18 · L7 | **yes (18)** | 331 | — | start the 18 sequential reads together (one Promise.all) | up to ~480 ms |
| `/admin/vendor-partnerships` | 0 in 0 · L7 | layout (7) | 330 | — | — | — |
| `/admin/vendor-recommendations` | 7 in 4 · L7 | yes (4) | 330 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/vendors` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/vendors/[vendorProfileId]` | 11 in 10 · L7 | **yes (10)** | 331 | — | start the 10 sequential reads together (one Promise.all) | up to ~240 ms |
| `/admin/vendors/[vendorProfileId]/edit` | 4 in 4 · L7 | yes (4) | 327 | — | start the 4 sequential reads together (one Promise.all) | up to ~60 ms |
| `/admin/vendors/[vendorProfileId]/plan` | 5 in 5 · L7 | **yes (5)** | 327 | — | start the 5 sequential reads together (one Promise.all) | up to ~90 ms |
| `/admin/vendors/[vendorProfileId]/team` | 7 in 7 · L7 | **yes (7)** | 327 | — | start the 7 sequential reads together (one Promise.all) | up to ~150 ms |
| `/admin/venues` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/venues/[id]` | 2 in 2 · L7 | layout (7) | 331 | — | — | — |
| `/admin/venues/new` | 1 in 1 · L7 | layout (7) | 327 | — | — | — |
| `/admin/verification-docs` | 2 in 2 · L7 | layout (7) | 328 | — | — | — |
| `/admin/verify` | 19 in 16 · L7 | layout (7) | 334 | — | — | — |
| `/admin/website` | 0 in 0 · L7 | layout (7) | 327 | — | — | — |
| `/admin/website-media` | 2 in 2 · L7 | layout (7) | 331 | — | — | — |
| `/admin/work` | 3 in 3 · L7 | yes (3) | 347 | — | start the 3 sequential reads together (one Promise.all) | up to ~30 ms |

### Dev and labs (1 routes)

| route | reads before paint | waterfall? | JS weight (KB gz) | measured (if public) | fix in one line | expected gain |
|---|---|---|---|---|---|---|
| `/demo-capture/[slug]` ⓛ | 0 in 0 · L1 | no | 160 | not measured | dev/lab route: no fix | — |
