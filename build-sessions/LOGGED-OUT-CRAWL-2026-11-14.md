# Logged-out crawl: what a visitor meets (2026-11-14)

**Target:** https://setnayan-platform-web.vercel.app · **Measured:** 2026-11-13 16:38–17:30 UTC (2026-11-14 PH time)
**Method:** GET only, no sign-in, no form submits, ≤ 2 requests/s (the browser too, throttled per request), cap 600 pages.
**Seeds:** `/` · `/robots.txt` · `/sitemap.xml` and its 7 child sitemaps (278 URLs) · the 159 static `page.tsx` routes in
`apps/web/app` (plus 7 private ones to confirm the login redirect) · every same-host link in the server HTML.
Dynamic slugs come **only** from links and sitemaps, and none were guessed.
**Result:** 480 URLs (the whole reachable set; the queue emptied before the cap) · 394 × 200 · 86 × 404, of which 83 are `/dev/*`
labs that are switched off in production by design (`if (NODE_ENV === 'production') notFound()`) · 756 + 128 GETs in all ·
~380 same-host images and og:images checked, all 200 · no 5xx anywhere · no soft 404s · no "STNYN" anywhere ·
no horizontal scroll on any of the 15 phone-checked pages.

**Not verifiable from here (said, not guessed):** every canonical URL, sitemap `<loc>` and og:image points at
`https://www.setnayan.com`, which this checker's network does not allow. Its og:image paths were re-checked on the vercel host,
where all return 200, but whether `www.setnayan.com` itself serves this site was **not measured**. The R2 presigned image URLs
(`*.r2.cloudflarestorage.com`, `pub-*.r2.dev`) were also out of reach, so they are listed as leaks where relevant but were
not loaded.

Screenshots: `build-sessions/shots-logged-out-crawl/NN-<page>.png` (390 × 844, first screen, @2x).

---

## Top 10 (most important first)

1. **L-01 · leak (confirm intent)**: the owner's **real** wedding Hub `cale-ice` (Indalecio & Claire, 18 Dec 2026, love-story photos, the parish) is linked from the logged-out Discover home `/`, is `index, follow`, and serves its private-bucket photos as presigned URLs in the first HTML.
2. **L-02 · leak (confirm intent)**: `/u/iscasasolaii` gives a stranger the owner's full name, follower and view counts, and both events. It is linked from `/`.
3. **L-03 · broken**: `/for-coordinators` links to the sample shop `/v/setnayan-weddings`, which returns **404**. The code comment says it was never created in prod.
4. **L-04 · broken**: the server-rendered "Sign in" link on `/open-shop` is malformed (`/login?next=%2Fopen-shop&as=vendor?next=%2Fopen-shop`, two `?`).
5. **L-05 · broken**: signed-out deep links into the couple dashboard and admin lose their path. `/dashboard/people` goes to `/login?next=/dashboard`, and `/admin/users` goes to `next=/admin`. The supplier dashboard keeps its path.
6. **L-06 · SEO / wrong words**: the test shop **"Testnayan W1 Lights"** is live, shows **VERIFIED**, is `index, follow`, and is listed in `sitemap-vendors.xml`.
7. **L-07 · wrong words**: "vendor" is still what visitors read in **19 blog articles** (CTA "Browse the vendor marketplace") and in 2 article titles. It is also in public URLs (`/help/sign-up-as-vendor`, `/help?role=vendor`, `/blog?category=vendors`, `/tour/vendors` …).
8. **L-08 · wrong words (locked decision)**: `/api/v1` is a public, indexable API reference page saying *"vendor browse is public… `/api/v1/vendors` is already public"*. CLAUDE.md lock: *No public API endpoints in V1*.
9. **L-09 · speed**: supplier shop pages and Hubs take **2.2–3.9 s to first byte**, against a site median of 0.95 s. Of 394 HTML pages, 208 were cache `MISS`.
10. **L-10 · SEO**: the sign-in, sign-up and forgot-password pages are `index, follow`. `/papic/guest` and `/papic/decorate` ("Open your invitation first") are also indexable and share one generic title.

---

## Findings

| ID | URL | What happens | What should happen | Severity | Evidence |
|---|---|---|---|---|---|
| L-01 | `/` → `/cale-ice?via=discover`, `/u/iscasasolaii/cale-ice` | Discover's home page links a logged-out visitor to the owner's real event `cale-ice`. The page shows "Indalecio & Claire · December 18, 2026" and is `index, follow` with canonical `www.setnayan.com/cale-ice`. The `/u/` form serves the **whole** invitation in its first HTML (8,579 chars, 523 KB): invitation text, dress code, the parish drawing `santuario-de-san-vicente-de-paul.webp`, and 20 presigned `setnayan-media…r2.cloudflarestorage.com/events/…/love-story/IMG_6668.jpeg…` URLs (36 h signatures, `X-Amz-Expires=129600`). The home page also embeds a cover photo whose filename is an original Facebook export (`…506207224_10237384887825941_…_n.jpg`). | Owner decides whether his real wedding should be discoverable and indexable by strangers. If not, keep it off Discover and mark it `noindex`. If yes, close this as intended. | leak | crawl rows `/`, `/cale-ice?via=discover`, `/u/iscasasolaii/cale-ice`, `/login?next=%2Fcale-ice` |
| L-02 | `/u/iscasasolaii` | A public profile, linked from `/`, shows "Ice Casasola · setnayan.com/u/iscasasolaii · 2 events · 10 followers · 14 views" and links both events. It is `noindex, follow`, the title is the double-branded "Ice Casasola · Setnayan · Setnayan", and there is no canonical. | Confirm this profile is meant to be public. Fix the title either way (see L-11). | leak | crawl row `/u/iscasasolaii` |
| L-03 | `/for-coordinators` → `/v/setnayan-weddings` | Every "see the sample shop" link on the coordinators landing page returns **404** (TTFB 1.9 s). | Create the sample shop, or point the links at a shop that exists. | broken | `apps/web/app/(shell)/for-coordinators/page.tsx` `SAMPLE_SHOP = { slug: 'setnayan-weddings' … }` with the comment "⚠ Not created in prod yet — an owner task" |
| L-04 | `/open-shop` | The server-rendered "Have an account? Sign in" link is `href="/login?next=%2Fopen-shop&as=vendor?next=%2Fopen-shop"`, so `as` parses as `vendor?next=/open-shop`. It is the no-JavaScript / pre-hydration fallback, so it is what a tap before hydration follows. | `SignInHereLink` should join `next` with `&` when `href` already has a query. | broken | `apps/web/app/_components/auth/sign-in-here-link.tsx` builds `` `${href}?next=${…}` ``; the caller passes `signInHref = '/login?next=%2Fopen-shop&as=vendor'` (`open-shop-wizard.tsx`) |
| L-05 | `/dashboard/people`, `/dashboard/billing`, `/dashboard/profile`, `/dashboard/api-keys`, `/dashboard/samahan/new`, `/admin/users`, `/admin/money` | A logged-out deep link becomes `/login?next=%2Fdashboard` (or `next=%2Fadmin`), dropping the rest of the path. `/vendor-dashboard/earnings` correctly keeps `next=%2Fvendor-dashboard%2Fearnings`. `/privacy` links to `/dashboard/profile` and `/samahan` to `/dashboard/samahan/new`, so real visitors hit this. | Keep the full path in `next`, as the supplier dashboard does, so sign-in lands where the person was going. | broken | URL list rows 154–160: `/dashboard/people` 307 → `/login?next=%2Fdashboard`; `/admin/users` 307 → `/login?next=%2Fadmin` |
| L-06 | `/testnayanw1lights`, `/v/testnayanw1lights` (+ `/dates`, `?service=`) | The owner's test shop "Testnayan W1 Lights" is public, badged "VERIFIED · Setnayan Verified", `index, follow`, and listed in `sitemap-vendors.xml`. Discover also lists the placeholder-named "Makati Florals #1" (`/flowerstoreph`, unverified, noindex) and "Quezon City Band / live music #1" (`/rondomusical`). | Hide test shops from Discover and the sitemap, or mark them `noindex` and drop the Verified badge on a test account. | SEO | sitemap `<loc>https://www.setnayan.com/testnayanw1lights</loc>`; crawl row title `Testnayan W1 Lights · Setnayan supplier · Setnayan` |
| L-07 | 19 `/blog/*` articles, `/blog`, `/`, `/start`, `/realstories/dela-cruz-family-cebu-reunion`, help + blog URLs | Visible "vendor" text: the article footer CTA **"Browse the vendor marketplace"** on 19 articles; the titles "What 0% commission means for couples and vendors" and "The holiday booking crunch: securing vendors in Q4" (also surfaced as cards on `/` and `/blog`); "No vendors, no marketplace." on `/start`; "vendor payments" in a real-stories sample. Public URLs also say vendor: `/help/sign-up-as-vendor`, `/help/track-vendor`, `/help/vendor-reply-only`, `/help/start-thread-with-vendor`, `/help/how-are-vendors-verified`, `/help/verified-filipino-wedding-vendors-no-commission`, `/help?role=vendor`, `/blog?category=vendors`, `/tour/vendors`. | "supplier" in visible copy. Renaming the URLs needs redirects, so treat them separately from the copy. | wrong words | `apps/web/lib/blog-batches/*.ts` `label: 'Browse the vendor marketplace'`; crawl `vendor_count` per page |
| L-08 | `/api/v1` | A public (`index, follow`) "Setnayan API v1 reference" page says *"vendor browse is public… `/api/v1/vendors` is already public"*, documents Bearer endpoints, and uses "vendor" 33 times. It is not linked from anywhere a visitor sees; it is only reachable as a repo route. | Owner call against the lock **"No public API endpoints in V1"**: at minimum `noindex`, and confirm whether `/api/v1/vendors` really answers unauthenticated. *Not tested: that endpoint was not called.* | wrong words | crawl row `/api/v1` (TTFB 1.86 s) |
| L-09 | supplier shops, Hubs, `/features/event-hub` | Slow first byte on the pages a shared link lands on: `/cale-ice?via=discover` 3.86 s · `/features/event-hub` 3.19 s · `/testnayanw1lights` 3.04 s · `/flowerstoreph` 3.04 s · `/v/testnayanw1lights` 2.69 s · `/setnaprod` 2.36 s · `/maria-and-jose` 2.28 s · `/v/setnaprod` 2.19 s. Site-wide: median 0.95 s, p90 1.41 s; 30 pages over 1.5 s; `x-vercel-cache` was MISS on 208/394 and REVALIDATED on 170. | Shops and Hubs, the pages shared on Facebook and Messenger, should come from cache. Ask why they render fresh every time. | speed | TTFB column of the URL list |
| L-10 | `/login`, `/signup`, `/forgot-password`, every `?next=` variant · `/papic/guest`, `/papic/decorate` | Auth pages are `index, follow`. `/papic/guest` and `/papic/decorate` are `index, follow` but only say "Open your invitation first", and both carry the generic title "Setnayan · Plan, share and relive every event" and the home page's description. | `noindex` on the auth and guest-only pages. | SEO | `robots_meta` per row |
| L-11 | supplier shops, `/u/iscasasolaii`, `/privacy/google-access` | Doubled brand in `<title>`: "SetnaProd · Setnayan supplier · Setnayan", "Makati Florals #1 · Setnayan supplier · Setnayan", "Quezon City Band / live music #1 · Setnayan supplier · Setnayan", "Ice Casasola · Setnayan · Setnayan", "What connecting Google does · Setnayan · Setnayan". | One "· Setnayan" (the layout's title template already adds it). | SEO | titles in the URL list |
| L-12 | `/u/ana-at-marco`, `/open-shop`, `/live`, `/live/screen`, `/papic/*`, `/web-only` | `/u/ana-at-marco` has the bare title "Setnayan". 13 pages reuse the home page's meta description (`/live`, `/open-shop`, `/papic/decorate`, `/papic/guest`, `/papic/lightcheck`, `/papic/pool` …). `/open-shop` is `index, follow` with **no canonical**. | A specific title and description per page, and a canonical on indexable pages. | SEO | crawl `desc` and `canonical` fields |
| L-13 | `/for-suppliers`, `/features`, `/about`, `/creators` … | Titles are too long for a results page: `/for-suppliers` 151 chars, `/creators` 86, `/features` 81, `/about` 80 (44 titles over 65 chars). 56 meta descriptions run over 160 chars, including `/for-suppliers` 354, `/mood-board` 349, `/creators` 305 and `/` 211. | Titles ≤ 60–65 chars, descriptions ≤ 155–160. | SEO | crawl `title` and `desc` lengths |
| L-14 | `/features`, `/for-suppliers`, `/u/iscasasolaii/cale-ice`, `/open-shop`, `/tour/budget` | Heavy first HTML: `/features` **1,077 KB**, `/for-suppliers` 553 KB, `/u/…/cale-ice` 523 KB, `/open-shop` 406 KB, `/tour/budget` 402 KB (site median 83 KB). On a phone on mobile data that is seconds before anything draws. | Trim the inline RSC payload; `/features` is the outlier. | speed | HTML KB column |
| L-15 | `/signup/you` | The first HTML holds only "Loading…" (8 characters of text). | Server-render the step, or redirect a logged-out visitor to `/signup`. | broken | crawl row `/signup/you` (`noindex, nofollow`) |
| L-16 | `/realstories` | On the cover card at 390 px, the "(DEMO ONLY)" chip sits over the title "The Maria & Juan Chronicle", and three chips (FEATURED · ▶ LIVE · 5S · DEMO ONLY) crowd the top-right corner. The search placeholder "Search by name, city, milestone, the…" is cut off. | The chips should wrap above the title, not on it. | layout | `shots-logged-out-crawl/14-realstories.png` |
| L-17 | `/v/setnaprod` | At 390 px the shop's logo tile is an empty white rounded square under the hero. The floating "Inquire" button covers the "· On Setnayan since Jul 2026" line on the first screen. The service line "Mobile bar by Setnaprod · from ₱110,000" is ellipsised at 152/233 px. | Show a monogram when no logo is set, and leave room under the floating button. | layout | `shots-logged-out-crawl/07-shop-setnaprod.png` |
| L-18 | `/features` | Two buttons in a demo card are clipped: "Ask for a change" and "Accept and book" (99 of 110 px), and "8:40 pm · running on time" (136/140 px). | Let the buttons wrap or shrink their padding at 390 px. | layout | DOM check in the 390 px run (scrollWidth > clientWidth) |
| L-19 | `/maria-and-jose`, `/maria-and-jose?via=discover` | The demo Hub's **server HTML** has no "(DEMO ONLY)" label (it appears only after JavaScript; the screenshot shows it). The page is `index, follow` with canonical `www.setnayan.com/maria-and-jose`, and it is linked from Discover and `/realstories`. Crawlers and link previews see a "real" wedding. `/u/iscasasolaii/maria-and-jose` does carry the label in its first HTML. | Render the demo label on the server, and `noindex` the demo Hub. | SEO | crawl `text_head` for `/maria-and-jose` vs `/u/iscasasolaii/maria-and-jose`; `08-hub-maria-and-jose.png` |
| L-20 | `/papic/lightcheck` | A page that calls itself a *"Throwaway diagnostic"* (opens the camera, measure FPS, toggle torch) is live in production. It is `noindex`, but anyone with the URL can open it. | Gate it like the `/dev/*` labs, or remove it. | wrong words | crawl row `/papic/lightcheck` |
| L-21 | `/sample`, `/samahan/chat/new` | Both repo routes return 404 in production. Neither is linked from any crawled page, so a visitor only meets them by typing them. | Owner call: retire the routes, or confirm the 404 is intended. | broken | crawl rows (seeded from `apps/web/app/**/page.tsx`) |
| L-22 | `/terms`, `/privacy`, `/cookies`, `/refunds`, `/acceptable-use` | No `og:image`, so a shared legal link previews bare. Every other page has one. | Add the default brand card. | SEO | crawl `og_image` |

**Counts by severity:** leak 2 · broken 5 · wrong words 3 · speed 2 · layout 3 · SEO 7 = **22**

### Checked and clean
- 0 email addresses or PH phone numbers leaked. The only address found anywhere is `dpo@setnayan.com`, in the footer and legal pages.
- 0 soft 404s, 0 "STNYN", 0 missing `<title>`, 0 missing meta descriptions.
- All 21 `/realstories/*` samples carry "(DEMO ONLY)" in the first HTML.
- Every private surface (`/admin`, `/dashboard`, `/vendor-dashboard`, `/onboarding/simple`, `/open-shop/logo`) ends at `/login`. None renders private data to a logged-out visitor.
- Robots: `/dashboard`, `/vendor-dashboard`, `/admin`, `/api`, `/receipts` and `/papic/me` are disallowed. 8 sitemaps answer 200, and every sitemap URL answered 200 without a redirect.
- og:image: 2 shops (`/api/og/v/flowerstoreph`, `/api/og/v/rondomusical`) 302 to the brand card. That is a fallback, not a break.
- 390 px: no horizontal scroll, no overlapping fixed bars, and no text running off-screen on all 15 pages.

### Phone look (390 px): pages captured
`01-home` · `02-pricing` · `03-open-shop` · `04-explore` (308 → `/`) · `05-download` · `06-help` · `07-shop-setnaprod` ·
`08-hub-maria-and-jose` (the demo Hub was chosen on purpose, rather than the owner's real event) · `09-login` · `10-signup` · `11-for-suppliers` ·
`12-features` · `13-blog` · `14-realstories` · `15-for-coordinators`.
Caveat: the browser was throttled to 2 requests/s, so lazy images below the first screen may not have loaded when captured
(e.g. the blank band on `02-pricing`). That band is **not** reported as a finding.

---

## Full URL list (480)

TTFB is the first hop's time to first byte in seconds. "Found via" is how the crawler reached the URL: seed, repo route,
sitemap, or the page that linked it.

| # | URL | Status (chain) | TTFB s | HTML KB | Title | Found via |
|---|---|---|---|---|---|---|
| 1 | `/` | 200 | 0.878 | 315 | Setnayan · Plan any event free. Every photo in one album. | seed |
| 2 | `/about` | 200 | 0.59 | 148 | About Setnayan — the Philippines-first wedding & life-events platform · Setnayan | repo-route |
| 3 | `/acceptable-use` | 200 | 0.35 | 65 | Acceptable use policy · Setnayan | repo-route |
| 4 | `/admin` | 307 → 200 → `/login?next=%2Fadmin` | 1.721 | 51 | Sign in · Setnayan | repo-route |
| 5 | `/alaala` | 200 | 0.402 | 91 | Memories — A New Way to Remember · Setnayan | repo-route |
| 6 | `/blog` | 200 | 0.417 | 334 | Setnayan Articles — Filipino event planning guides · Setnayan | repo-route |
| 7 | `/budget` | 200 | 0.418 | 107 | Budget — The Truth, in PHP · Setnayan | repo-route |
| 8 | `/cookies` | 200 | 0.58 | 82 | Cookie policy · Setnayan | repo-route |
| 9 | `/creators` | 200 | 0.407 | 115 | Setnayan for Storytellers · Publish your events as bookable Chapters — free · Setnayan | repo-route |
| 10 | `/dashboard` | 307 → 200 → `/login?next=%2Fdashboard` | 0.366 | 51 | Sign in · Setnayan | repo-route |
| 11 | `/dev/add-your-own-lab` | 404 | 1.382 |  |  | repo-route |
| 12 | `/dev/admin-shell-lab` | 404 | 1.383 |  |  | repo-route |
| 13 | `/dev/admin-supplier-lab` | 404 | 1.017 |  |  | repo-route |
| 14 | `/dev/art-kit-lab` | 404 | 1.173 |  |  | repo-route |
| 15 | `/dev/avatar-sheet-lab` | 404 | 1.204 |  |  | repo-route |
| 16 | `/dev/billing-lab` | 404 | 0.92 |  |  | repo-route |
| 17 | `/dev/booking-ask-lab` | 404 | 1.207 |  |  | repo-route |
| 18 | `/dev/booth-lab` | 404 | 1.05 |  |  | repo-route |
| 19 | `/dev/budget-lab` | 404 | 0.681 |  |  | repo-route |
| 20 | `/dev/bundle-maker-lab` | 404 | 1.188 |  |  | repo-route |
| 21 | `/dev/card-maker-lab` | 404 | 0.928 |  |  | repo-route |
| 22 | `/dev/card-moderation-lab` | 404 | 1.146 |  |  | repo-route |
| 23 | `/dev/categories-lab` | 404 | 0.449 |  |  | repo-route |
| 24 | `/dev/chapters-lab` | 404 | 0.973 |  |  | repo-route |
| 25 | `/dev/chat-cards-c-lab` | 404 | 1.136 |  |  | repo-route |
| 26 | `/dev/chat-cards-lab` | 404 | 0.949 |  |  | repo-route |
| 27 | `/dev/chat-lab` | 404 | 1.16 |  |  | repo-route |
| 28 | `/dev/clients-lab` | 404 | 1.198 |  |  | repo-route |
| 29 | `/dev/collapsing-top-lab` | 404 | 0.937 |  |  | repo-route |
| 30 | `/dev/create-for-lab` | 404 | 0.563 |  |  | repo-route |
| 31 | `/dev/customer-money-lab` | 404 | 1.16 |  |  | repo-route |
| 32 | `/dev/date-sheet-lab` | 404 | 1.136 |  |  | repo-route |
| 33 | `/dev/details-lab` | 404 | 1.149 |  |  | repo-route |
| 34 | `/dev/empty-looks-lab` | 404 | 0.546 |  |  | repo-route |
| 35 | `/dev/event-group-chat-lab` | 404 | 1.151 |  |  | repo-route |
| 36 | `/dev/favorites-lab` | 404 | 1.161 |  |  | repo-route |
| 37 | `/dev/files-lab` | 404 | 1.131 |  |  | repo-route |
| 38 | `/dev/find-lock-lab` | 404 | 1.122 |  |  | repo-route |
| 39 | `/dev/for-suppliers-lab` | 404 | 1.21 |  |  | repo-route |
| 40 | `/dev/forms-lab` | 404 | 1.185 |  |  | repo-route |
| 41 | `/dev/group-lab` | 404 | 1.033 |  |  | repo-route |
| 42 | `/dev/guests-lab` | 404 | 0.974 |  |  | repo-route |
| 43 | `/dev/hero-lab` | 404 | 0.95 |  |  | repo-route |
| 44 | `/dev/home-lab` | 404 | 1.043 |  |  | repo-route |
| 45 | `/dev/iap-doors-lab` | 404 | 1.122 |  |  | repo-route |
| 46 | `/dev/inquire-lab` | 404 | 1.129 |  |  | repo-route |
| 47 | `/dev/maker-lab` | 404 | 1.526 |  |  | repo-route |
| 48 | `/dev/maker-lab/guest` | 404 | 1.395 |  |  | repo-route |
| 49 | `/dev/maker-lab/guest/scrub` | 404 | 0.532 |  |  | repo-route |
| 50 | `/dev/me-lab` | 404 | 1.35 |  |  | repo-route |
| 51 | `/dev/memories-lab` | 404 | 1.124 |  |  | repo-route |
| 52 | `/dev/notifications-lab` | 404 | 0.597 |  |  | repo-route |
| 53 | `/dev/offer-card-lab` | 404 | 0.932 |  |  | repo-route |
| 54 | `/dev/offer-maker-lab` | 404 | 0.937 |  |  | repo-route |
| 55 | `/dev/onboarding-lab` | 404 | 0.599 |  |  | repo-route |
| 56 | `/dev/open-shop-lab` | 404 | 0.411 |  |  | repo-route |
| 57 | `/dev/papic-camera-lab` | 404 | 1.163 |  |  | repo-route |
| 58 | `/dev/people-lab` | 404 | 1.153 |  |  | repo-route |
| 59 | `/dev/personal-invite-lab` | 404 | 1.154 |  |  | repo-route |
| 60 | `/dev/photo-privacy-lab` | 404 | 1.173 |  |  | repo-route |
| 61 | `/dev/pro-parts-lab` | 404 | 1.149 |  |  | repo-route |
| 62 | `/dev/profile-photo-lab` | 404 | 0.756 |  |  | repo-route |
| 63 | `/dev/questions-lab` | 404 | 1.117 |  |  | repo-route |
| 64 | `/dev/receipt-lab` | 404 | 0.911 |  |  | repo-route |
| 65 | `/dev/review-lab` | 404 | 1.131 |  |  | repo-route |
| 66 | `/dev/schedule-lab` | 404 | 1.165 |  |  | repo-route |
| 67 | `/dev/search-lab` | 404 | 0.595 |  |  | repo-route |
| 68 | `/dev/selfie-lab` | 404 | 1.203 |  |  | repo-route |
| 69 | `/dev/service-card-row-lab` | 404 | 0.392 |  |  | repo-route |
| 70 | `/dev/service-requests-lab` | 404 | 1.194 |  |  | repo-route |
| 71 | `/dev/shop-back-lab` | 404 | 1.145 |  |  | repo-route |
| 72 | `/dev/shop-card-lab` | 404 | 0.399 |  |  | repo-route |
| 73 | `/dev/shop-layout-lab` | 404 | 1.167 |  |  | repo-route |
| 74 | `/dev/shop-page-lab` | 404 | 1.142 |  |  | repo-route |
| 75 | `/dev/shop-plan-lab` | 404 | 1.116 |  |  | repo-route |
| 76 | `/dev/shop-preview-lab` | 404 | 0.985 |  |  | repo-route |
| 77 | `/dev/supplier-chat-lab` | 404 | 1.154 |  |  | repo-route |
| 78 | `/dev/supplier-lab` | 404 | 0.847 |  |  | repo-route |
| 79 | `/dev/supplier-plan-lab` | 404 | 1.189 |  |  | repo-route |
| 80 | `/dev/supplier-print-lab` | 404 | 1.101 |  |  | repo-route |
| 81 | `/dev/suppliers-lab` | 404 | 1.397 |  |  | repo-route |
| 82 | `/dev/swipe-rows-lab/clients` | 404 | 1.115 |  |  | repo-route |
| 83 | `/dev/swipe-rows-lab/on-the-day` | 404 | 1.12 |  |  | repo-route |
| 84 | `/dev/swipe-rows-lab/proposals` | 404 | 0.885 |  |  | repo-route |
| 85 | `/dev/swipe-rows-lab/repertoire` | 404 | 1.137 |  |  | repo-route |
| 86 | `/dev/swipe-rows-lab/seating` | 404 | 1.376 |  |  | repo-route |
| 87 | `/dev/swipe-rows-lab/sponsors` | 404 | 1.132 |  |  | repo-route |
| 88 | `/dev/swipe-rows-lab/suppliers` | 404 | 1.183 |  |  | repo-route |
| 89 | `/dev/thumb-row-lab` | 404 | 0.904 |  |  | repo-route |
| 90 | `/dev/venue-check-lab` | 404 | 1.103 |  |  | repo-route |
| 91 | `/dev/verify-desk-lab` | 404 | 1.163 |  |  | repo-route |
| 92 | `/dev/visits-lab` | 404 | 1.358 |  |  | repo-route |
| 93 | `/dev/you-lab` | 404 | 0.575 |  |  | repo-route |
| 94 | `/download` | 200 | 0.429 | 86 | Download Setnayan for Mac or Windows · Setnayan | repo-route |
| 95 | `/explore/compare` | 307 → 200 → `/?browse=1` | 0.067 | 112 | Setnayan · Plan any event free. Every photo in one album. | repo-route |
| 96 | `/features` | 200 | 0.584 | 1078 | Every Feature in Setnayan · Wedding & Life-Events Platform Philippines · Setnayan | repo-route |
| 97 | `/for-coordinators` | 200 | 0.411 | 328 | For Coordinators — Your business’s new home · Setnayan | repo-route |
| 98 | `/for-suppliers` | 200 | 0.421 | 554 | Setnayan for Suppliers · Not just a place to sell. A place to stay. · Supplier Plus ₱990 · Supplier Pro ₱2,490 · Supplier Ultra ₱5,990 / 28d · Setnayan | repo-route |
| 99 | `/forgot-password` | 200 | 0.449 | 49 | Reset your password · Setnayan | repo-route |
| 100 | `/guest-list` | 200 | 0.372 | 108 | Guest List — Every Guest, Every Detail · Setnayan | repo-route |
| 101 | `/help` | 200 | 0.425 | 346 | Help & support · Setnayan | repo-route |
| 102 | `/live` | 200 | 0.393 | 46 | Connect a screen · Setnayan | repo-route |
| 103 | `/live/screen` | 307 → 200 → `/live` | 0.379 | 46 | Connect a screen · Setnayan | repo-route |
| 104 | `/login` | 200 | 0.383 | 51 | Sign in · Setnayan | repo-route |
| 105 | `/marketplace` | 200 | 0.585 | 106 | Marketplace — Find Your Suppliers, Side by Side · Setnayan | repo-route |
| 106 | `/monogram` | 200 | 0.408 | 68 | Free Monogram Maker · Setnayan | repo-route |
| 107 | `/mood-board` | 200 | 0.367 | 111 | Mood Board — Your Colors, Everywhere · Setnayan | repo-route |
| 108 | `/onboarding/simple` | 307 → 200 → `/login?next=/onboarding/simple` | 0.404 | 51 | Sign in · Setnayan | repo-route |
| 109 | `/onboarding/wedding` | 200 | 0.474 | 232 | Plan your wedding · Setnayan | repo-route |
| 110 | `/open-shop` | 200 | 0.95 | 407 | Open your shop · Setnayan | repo-route |
| 111 | `/open-shop/logo` | 307 → 200 → `/login?next=%2Fopen-shop%2Flogo&as=vendor` | 0.595 | 51 | Sign in · Setnayan | repo-route |
| 112 | `/our-story` | 200 | 0.601 | 102 | A new way to remember · Setnayan | repo-route |
| 113 | `/pa3d` | 200 | 0.382 | 95 | 3D Plan — Walk Your Reception in 3D Before the Day · Setnayan | repo-route |
| 114 | `/pa3d/try` | 200 | 0.532 | 58 | Walk a real reception in 3D — right now, no sign-up · Setnayan | repo-route |
| 115 | `/pakanta` | 200 | 0.367 | 104 | Music Maker — Your Wedding’s Own Song · Setnayan | repo-route |
| 116 | `/palogo` | 200 | 0.381 | 106 | Logo Maker — Your Animated Wedding Monogram · Setnayan | repo-route |
| 117 | `/panood` | 200 | 0.375 | 114 | Live Watch — Live-Stream Your Wedding · Setnayan | repo-route |
| 118 | `/papic` | 200 | 0.409 | 178 | Papic — Guest Photo Memories for Weddings · Setnayan | repo-route |
| 119 | `/papic/decorate` | 200 | 0.393 | 50 | Setnayan · Plan, share and relive every event | repo-route |
| 120 | `/papic/guest` | 200 | 0.421 | 61 | Setnayan · Plan, share and relive every event | repo-route |
| 121 | `/papic/lightcheck` | 200 | 1.442 | 45 | Papic light check · Setnayan | repo-route |
| 122 | `/papic/pool` | 200 | 0.376 | 50 | Everyone’s photos · Papic · Setnayan | repo-route |
| 123 | `/papic/try` | 200 | 0.403 | 59 | Try Papic with a friend — right now, no sign-up · Setnayan | repo-route |
| 124 | `/patiktok` | 200 | 0.377 | 105 | Patiktok — Short-Form Highlight Reels From Your Day · Setnayan | repo-route |
| 125 | `/pawebsite` | 200 | 0.37 | 108 | Event Hub — the free alternative to a wedding website · Setnayan | repo-route |
| 126 | `/pricing` | 200 | 0.401 | 137 | Pricing · Setnayan | repo-route |
| 127 | `/pricing/plan` | 200 | 0.445 | 56 | What Setnayan does for you · Setnayan | repo-route |
| 128 | `/privacy` | 200 | 0.39 | 229 | Privacy policy · Setnayan | repo-route |
| 129 | `/privacy/google-access` | 200 | 0.391 | 69 | What connecting Google does · Setnayan · Setnayan | repo-route |
| 130 | `/realstories` | 200 | 0.414 | 171 | Stories · Setnayan | repo-route |
| 131 | `/refunds` | 200 | 0.429 | 64 | Refund & cancellation policy · Setnayan | repo-route |
| 132 | `/reset-password` | 200 | 0.397 | 47 | Choose a new password · Setnayan | repo-route |
| 133 | `/samahan` | 200 | 0.402 | 108 | Groups — Your Barkada, Ninongs, Family · Setnayan | repo-route |
| 134 | `/samahan/chat/new` | 404 | 0.371 |  |  | repo-route |
| 135 | `/sample` | 404 | 0.66 |  |  | repo-route |
| 136 | `/schedule` | 200 | 0.363 | 107 | Schedule — The Day, Minute by Minute · Setnayan | repo-route |
| 137 | `/seat-plan` | 200 | 0.859 | 106 | Seat Plan — Drag, Drop, Done · Setnayan | repo-route |
| 138 | `/setnayan-ai` | 200 | 0.617 | 112 | Setnayan AI — the planner that watches your wedding for you · Setnayan | repo-route |
| 139 | `/signup` | 200 | 0.416 | 68 | Create account · Setnayan | repo-route |
| 140 | `/signup/you` | 200 | 0.385 | 47 | You · Setnayan | repo-route |
| 141 | `/start` | 200 | 0.477 | 113 | Start your event · Setnayan | repo-route |
| 142 | `/suppliers` | 200 | 0.422 | 56 | Filipino event suppliers by event, category and city · Setnayan | repo-route |
| 143 | `/terms` | 200 | 0.573 | 81 | Terms of service · Setnayan | repo-route |
| 144 | `/tl/about` | 200 | 0.414 | 84 | Tungkol sa Setnayan — ang Philippines-first wedding platform · Setnayan | repo-route |
| 145 | `/tl/features` | 200 | 0.399 | 191 | Lahat ng Feature sa Setnayan — Wedding & Life-Events Platform Philippines · Setnayan | repo-route |
| 146 | `/tour` | 200 | 0.502 | 56 | Walk through a real wedding · Setnayan | repo-route |
| 147 | `/tour/budget` | 200 | 0.715 | 403 | The budget · Maria & Jose · Setnayan | repo-route |
| 148 | `/tour/gallery` | 200 | 0.625 | 84 | Memories · Maria & Jose · Setnayan | repo-route |
| 149 | `/tour/seating` | 200 | 0.584 | 68 | The seating · A real wedding on Setnayan · Setnayan | repo-route |
| 150 | `/tour/vendors` | 200 | 0.582 | 65 | The suppliers · A real wedding on Setnayan · Setnayan | repo-route |
| 151 | `/vendor-dashboard` | 307 → 200 → `/login?next=%2Fvendor-dashboard` | 0.746 | 51 | Sign in · Setnayan | repo-route |
| 152 | `/waitlist` | 200 | 0.38 | 59 | Plan your wedding free · Setnayan | repo-route |
| 153 | `/web-only` | 200 | 0.367 | 55 | Not available in the app · Setnayan | repo-route |
| 154 | `/admin/users` | 307 → 200 → `/login?next=%2Fadmin` | 0.421 | 51 | Sign in · Setnayan | repo-route |
| 155 | `/admin/money` | 307 → 200 → `/login?next=%2Fadmin` | 0.467 | 51 | Sign in · Setnayan | repo-route |
| 156 | `/vendor-dashboard/earnings` | 307 → 200 → `/login?next=%2Fvendor-dashboard%2Fearnings` | 0.406 | 51 | Sign in · Setnayan | repo-route |
| 157 | `/vendor-dashboard/clients` | 307 → 200 → `/login?next=%2Fvendor-dashboard%2Fclients` | 0.543 | 51 | Sign in · Setnayan | repo-route |
| 158 | `/dashboard/people` | 307 → 200 → `/login?next=%2Fdashboard` | 0.45 | 51 | Sign in · Setnayan | repo-route |
| 159 | `/dashboard/billing` | 307 → 200 → `/login?next=%2Fdashboard` | 0.388 | 51 | Sign in · Setnayan | repo-route |
| 160 | `/api/v1` | 200 | 1.858 | 85 | Setnayan API v1 — Reference · Setnayan | repo-route |
| 161 | `/help/what-is-setnayan` | 200 | 1.368 | 63 | What is Setnayan? · Setnayan | sitemap |
| 162 | `/help/how-much-does-setnayan-cost` | 200 | 1.356 | 63 | How much does Setnayan cost? · Setnayan | sitemap |
| 163 | `/help/is-setnayan-free-for-couples` | 200 | 1.292 | 64 | Is Setnayan free for couples? · Setnayan | sitemap |
| 164 | `/help/does-setnayan-take-commission` | 200 | 1.117 | 62 | Does Setnayan take commission on supplier bookings? · Setnayan | sitemap |
| 165 | `/help/what-is-todays-focus` | 200 | 1.336 | 62 | What is Setnayan AI? · Setnayan | sitemap |
| 166 | `/help/does-setnayan-support-filipino-customs` | 200 | 1.322 | 63 | Does Setnayan support Filipino wedding customs? · Setnayan | sitemap |
| 167 | `/help/what-languages-does-setnayan-support` | 200 | 1.367 | 61 | What languages does Setnayan support? · Setnayan | sitemap |
| 168 | `/help/where-does-setnayan-operate` | 200 | 1.316 | 61 | Where does Setnayan operate? · Setnayan | sitemap |
| 169 | `/help/does-setnayan-have-mobile-app` | 200 | 1.292 | 62 | Does Setnayan have a mobile app? · Setnayan | sitemap |
| 170 | `/help/how-are-vendors-verified` | 200 | 1.327 | 61 | How are suppliers verified on Setnayan? · Setnayan | sitemap |
| 171 | `/help/what-is-pakanta` | 200 | 1.308 | 61 | What is Music Maker? · Setnayan | sitemap |
| 172 | `/help/what-is-papic` | 200 | 0.99 | 64 | What is Papic? · Setnayan | sitemap |
| 173 | `/help/what-is-panood` | 200 | 1.651 | 62 | What is Live Watch? · Setnayan | sitemap |
| 174 | `/help/what-is-pakulay` | 200 | 1.339 | 61 | What is Pakulay? · Setnayan | sitemap |
| 175 | `/help/how-does-setnayan-handle-privacy` | 200 | 1.413 | 62 | How does Setnayan handle my privacy? · Setnayan | sitemap |
| 176 | `/help/how-to-contact-support` | 200 | 0.94 | 61 | How do I contact Setnayan support? · Setnayan | sitemap |
| 177 | `/help/when-does-setnayan-launch` | 200 | 1.129 | 61 | Is Setnayan open now? · Setnayan | sitemap |
| 178 | `/help/best-free-filipino-wedding-planner-app` | 200 | 1.394 | 65 | What is the best free Filipino wedding planner app? · Setnayan | sitemap |
| 179 | `/help/guest-list-with-ninongs-and-ninangs` | 200 | 1.325 | 64 | How do I organize a wedding guest list with ninongs and ninangs? · Setnayan | sitemap |
| 180 | `/help/free-seating-plan-and-budget-in-pesos` | 200 | 1.381 | 63 | Is there a free digital seating plan and budget tracker in pesos? · Setnayan | sitemap |
| 181 | `/help/verified-filipino-wedding-vendors-no-commission` | 200 | 0.899 | 64 | Where can I find verified Filipino wedding suppliers with no commission? · Setnayan | sitemap |
| 182 | `/help/share-wedding-photos-with-guests-automatically` | 200 | 1.767 | 64 | How do I share wedding photos with guests automatically? · Setnayan | sitemap |
| 183 | `/help/free-alternative-to-wedding-website-builders` | 200 | 1.318 | 64 | What is a free alternative to paid wedding website builders in the Philippines? · Setnayan | sitemap |
| 184 | `/help/plan-a-debut-christening-or-other-event` | 200 | 0.887 | 63 | Can I use Setnayan for a debut, christening or other event? · Setnayan | sitemap |
| 185 | `/help/what-if-the-venue-has-no-signal` | 200 | 1.376 | 63 | What happens if the venue has no signal? · Setnayan | sitemap |
| 186 | `/help/guests-without-smartphones` | 200 | 1.519 | 63 | What if some guests, like a lola or ninong, don’t use smartphones? · Setnayan | sitemap |
| 187 | `/help/many-guests-uploading-photos-at-once` | 200 | 1.289 | 62 | Will Setnayan slow down when many guests upload photos at once? · Setnayan | sitemap |
| 188 | `/help/setnayan-vs-free-apps-and-google-sheets` | 200 | 1.317 | 65 | How is Setnayan different from free planner apps, Google Sheets or a shared Drive? · Setnayan | sitemap |
| 189 | `/help/sign-up-as-couple` | 200 | 1.337 | 60 | Sign up as a couple · Setnayan | sitemap |
| 190 | `/help/sign-up-as-vendor` | 200 | 1.294 | 62 | Sign up as a supplier · Setnayan | sitemap |
| 191 | `/help/create-an-event` | 200 | 1.351 | 60 | Create your event · Setnayan | sitemap |
| 192 | `/help/the-bar-at-the-bottom` | 200 | 1.361 | 63 | What are the tabs at the bottom of the screen? · Setnayan | sitemap |
| 193 | `/help/one-account-shop-and-events` | 200 | 1.361 | 61 | Can I plan my own events if I have a shop? · Setnayan | sitemap |
| 194 | `/help/switch-between-your-places` | 200 | 1.35 | 61 | How do I switch between my events and my shop? · Setnayan | sitemap |
| 195 | `/help/what-search-finds` | 200 | 1.335 | 61 | What does search find? · Setnayan | sitemap |
| 196 | `/help/supplier-dashboard-tabs` | 200 | 1.34 | 62 | Suppliers: where is everything in my dashboard? · Setnayan | sitemap |
| 197 | `/help/event-id-vs-slug` | 200 | 1.343 | 61 | Event ID vs slug · Setnayan | sitemap |
| 198 | `/help/people-page` | 200 | 1.321 | 59 | What is People? · Setnayan | sitemap |
| 199 | `/help/loved-ones` | 200 | 0.899 | 59 | What are loved ones? · Setnayan | sitemap |
| 200 | `/help/memories` | 200 | 1.323 | 58 | What is Memories? · Setnayan | sitemap |
| 201 | `/help/what-do-suppliers-pay-setnayan` | 200 | 1.341 | 59 | What does Setnayan charge suppliers? · Setnayan | sitemap |
| 202 | `/help/how-to-get-dti-sec-registration` | 200 | 1.291 | 66 | How to get your DTI or SEC registration · Setnayan | sitemap |
| 203 | `/help/how-to-get-bir-2303` | 200 | 0.918 | 65 | How to get your BIR Form 2303 · Setnayan | sitemap |
| 204 | `/help/how-to-get-mayors-permit` | 200 | 1.239 | 64 | How to get your Mayor's Permit · Setnayan | sitemap |
| 205 | `/help/how-to-prepare-bank-account-proof` | 200 | 1.088 | 65 | How to prepare your bank account proof · Setnayan | sitemap |
| 206 | `/help/build-your-online-presence` | 200 | 0.958 | 71 | Build your online presence: Instagram, YouTube & Vimeo · Setnayan | sitemap |
| 207 | `/help/add-guest-roles` | 200 | 1.574 | 60 | Filipino wedding roles · Setnayan | sitemap |
| 208 | `/help/plus-ones` | 200 | 1.341 | 60 | How plus-ones work · Setnayan | sitemap |
| 209 | `/help/import-csv` | 200 | 1.077 | 59 | Import guests from CSV · Setnayan | sitemap |
| 210 | `/help/share-invite-link` | 200 | 1.342 | 59 | Share an invite link · Setnayan | sitemap |
| 211 | `/help/invitation-site` | 200 | 1.324 | 60 | What is the Event Hub? · Setnayan | sitemap |
| 212 | `/help/event-hub-pro-parts` | 200 | 0.88 | 61 | Can I get only part of Event Hub Pro? · Setnayan | sitemap |
| 213 | `/help/monogram` | 200 | 1.428 | 60 | Customize the QR monogram · Setnayan | sitemap |
| 214 | `/help/print-qr-sheet` | 200 | 1.374 | 59 | Print the QR sheet · Setnayan | sitemap |
| 215 | `/help/reissue-qr` | 200 | 1.44 | 59 | Re-issue a guest's QR code · Setnayan | sitemap |
| 216 | `/help/track-vendor` | 200 | 1.369 | 59 | Track a supplier · Setnayan | sitemap |
| 217 | `/help/venue-pin` | 200 | 1.344 | 59 | How do I put my venue on the map? · Setnayan | sitemap |
| 218 | `/help/budget-line-items` | 200 | 1.166 | 60 | Budget line items · Setnayan | sitemap |
| 219 | `/help/export-calendar` | 200 | 1.305 | 59 | Export budget due dates to your calendar · Setnayan | sitemap |
| 220 | `/help/palette-tiers` | 200 | 1.321 | 60 | Palette tiers · Setnayan | sitemap |
| 221 | `/help/dress-code-by-role` | 200 | 1.222 | 60 | How does the dress code work? · Setnayan | sitemap |
| 222 | `/help/palette-chip-dot` | 200 | 1.327 | 58 | How the palette shows up for your guests · Setnayan | sitemap |
| 223 | `/help/start-thread-with-vendor` | 200 | 1.115 | 60 | Start a thread with a supplier · Setnayan | sitemap |
| 224 | `/help/identity-masking` | 200 | 2.271 | 58 | Suppliers don't see your email · Setnayan | sitemap |
| 225 | `/help/vendor-reply-only` | 200 | 1.362 | 59 | Suppliers: how the reply-only inbox works · Setnayan | sitemap |
| 226 | `/help/how-to-order` | 200 | 1.31 | 60 | How to order a Setnayan service · Setnayan | sitemap |
| 227 | `/help/payment-instructions` | 200 | 1.58 | 59 | How payments work · Setnayan | sitemap |
| 228 | `/help/reference-code` | 200 | 1.323 | 58 | Reference codes · Setnayan | sitemap |
| 229 | `/help/refunds` | 200 | 1.333 | 63 | Can I get a refund? · Setnayan | sitemap |
| 230 | `/help/theme` | 200 | 1.156 | 59 | Change your Event Hub’s theme · Setnayan | sitemap |
| 231 | `/help/cookies` | 200 | 1.457 | 59 | Does Setnayan use cookies? · Setnayan | sitemap |
| 232 | `/help/data-export` | 200 | 1.381 | 59 | Export your data · Setnayan | sitemap |
| 233 | `/help/delete-account` | 200 | 1.339 | 60 | Delete your account · Setnayan | sitemap |
| 234 | `/help/scan-qr-code` | 200 | 1.325 | 59 | How to open your Setnayan invite · Setnayan | sitemap |
| 235 | `/help/rsvp-from-link` | 200 | 1.622 | 59 | How to RSVP · Setnayan | sitemap |
| 236 | `/help/meal-preference` | 200 | 1.331 | 59 | Meal preferences and dietary notes · Setnayan | sitemap |
| 237 | `/help/lost-invite-link` | 200 | 1.931 | 58 | I lost my invite link · Setnayan | sitemap |
| 238 | `/help/what-to-wear` | 200 | 1.353 | 59 | What should I wear? · Setnayan | sitemap |
| 239 | `/help/find-your-table` | 200 | 0.884 | 59 | Find your seat · Setnayan | sitemap |
| 240 | `/help/live-schedule` | 200 | 1.339 | 59 | What's happening right now · Setnayan | sitemap |
| 241 | `/help/photo-wall` | 200 | 1.322 | 59 | Share photos with the couple · Setnayan | sitemap |
| 242 | `/help/how-papic-works` | 200 | 1.324 | 63 | How does Papic work at my event? · Setnayan | sitemap |
| 243 | `/help/turn-on-papic` | 200 | 1.086 | 64 | How do I turn on Papic and hand out cameras? · Setnayan | sitemap |
| 244 | `/help/how-papic-tagging-works` | 200 | 1.321 | 63 | How do my photos get matched to the right guests? · Setnayan | sitemap |
| 245 | `/help/find-download-papic-photos` | 200 | 1.118 | 62 | Where do I find and download all my Papic photos? · Setnayan | sitemap |
| 246 | `/help/papic-guest-camera` | 200 | 1.751 | 62 | Guest: how do I take candid photos for the couple? · Setnayan | sitemap |
| 247 | `/help/add-your-face` | 200 | 1.317 | 63 | Guest: how do I make sure I get my photos? (add your face) · Setnayan | sitemap |
| 248 | `/help/photos-of-you` | 200 | 1.295 | 62 | Guest: where do I find the photos I'm in? · Setnayan | sitemap |
| 249 | `/help/papic-crew-how-to-shoot` | 200 | 1.336 | 63 | Crew: I was asked to shoot — how does it work? · Setnayan | sitemap |
| 250 | `/help/papic-giving-a-camera-its-own-shots` | 200 | 1.319 | 64 | How do I make sure one person never runs out of shots? · Setnayan | sitemap |
| 251 | `/help/how-papic-shots-work` | 200 | 1.316 | 65 | How do shots work, and how do I add more? · Setnayan | sitemap |
| 252 | `/help/is-my-youtube-ready-to-live-stream` | 200 | 0.873 | 70 | Is my YouTube channel ready to live stream? (check this first) · Setnayan | sitemap |
| 253 | `/help/create-your-youtube-live-link` | 200 | 1.111 | 71 | How do I create the YouTube link for my live stream? · Setnayan | sitemap |
| 254 | `/help/live-stream-dry-run` | 200 | 1.35 | 65 | How do I make sure it will all work on the day? · Setnayan | sitemap |
| 255 | `/help/who-owns-the-live-stream-recording` | 200 | 1.33 | 63 | What happens to the recording afterwards? · Setnayan | sitemap |
| 256 | `/blog/new-year-wedding-planning-kickoff` | 200 | 1.406 | 89 | New year, newly engaged: how to start planning · Setnayan | sitemap |
| 257 | `/blog/mixed-faith-wedding-philippines` | 200 | 1.36 | 89 | Planning a mixed-faith wedding in the Philippines · Setnayan | sitemap |
| 258 | `/blog/filipino-wedding-gift-etiquette-cash` | 200 | 1.407 | 89 | Cash gifts and abuloy: Filipino wedding gift etiquette · Setnayan | sitemap |
| 259 | `/blog/intimate-wedding-vs-big-wedding-cost` | 200 | 1.156 | 88 | Intimate vs. big wedding: the real cost difference · Setnayan | sitemap |
| 260 | `/blog/how-to-ask-someone-to-be-ninong-ninang` | 200 | 1.367 | 88 | How to ask someone to be your ninong or ninang · Setnayan | sitemap |
| 261 | `/blog/wedding-lights-and-sounds-guide` | 200 | 1.337 | 90 | Lights, sound, and AV: getting your reception heard and seen · Setnayan | sitemap |
| 262 | `/blog/drone-coverage-wedding-philippines` | 200 | 1.355 | 90 | Drone coverage for weddings in the Philippines: what to know · Setnayan | sitemap |
| 263 | `/blog/what-zero-commission-means-for-couples` | 200 | 1.386 | 88 | What 0% commission means for couples and vendors · Setnayan | sitemap |
| 264 | `/blog/engaged-over-christmas-first-steps` | 200 | 1.35 | 87 | Engaged over Christmas? Your first five steps · Setnayan | sitemap |
| 265 | `/blog/aglipayan-wedding-overview` | 200 | 1.384 | 89 | The Aglipayan (Philippine Independent Church) wedding · Setnayan | sitemap |
| 266 | `/blog/filipino-wedding-superstitions-pamahiin` | 200 | 1.941 | 89 | Filipino wedding superstitions and pamahiin · Setnayan | sitemap |
| 267 | `/blog/hidden-wedding-costs-couples-forget` | 200 | 1.545 | 89 | The hidden wedding costs couples always forget · Setnayan | sitemap |
| 268 | `/blog/wedding-seating-plan-guide-philippines` | 200 | 1.387 | 88 | The wedding seating plan, made simple · Setnayan | sitemap |
| 269 | `/blog/wedding-florist-styling-guide-philippines` | 200 | 1.406 | 90 | How to choose a florist and stylist for your wedding · Setnayan | sitemap |
| 270 | `/blog/wedding-photo-deliverables-explained` | 200 | 0.945 | 90 | Albums, raw files, highlights: wedding photo deliverables explained · Setnayan | sitemap |
| 271 | `/blog/why-wedding-planning-should-be-free` | 200 | 1.569 | 87 | Why planning your wedding should be free · Setnayan | sitemap |
| 272 | `/blog/holiday-proposal-ideas-philippines` | 200 | 1.446 | 89 | Holiday proposal ideas for Filipino couples · Setnayan | sitemap |
| 273 | `/blog/born-again-christian-wedding-philippines` | 200 | 1.686 | 89 | The born-again Christian wedding in the Philippines · Setnayan | sitemap |
| 274 | `/blog/despedida-de-soltera-explained` | 200 | 1.409 | 88 | Despedida de soltera: the farewell-to-single-life dinner · Setnayan | sitemap |
| 275 | `/blog/name-change-after-marriage-philippines` | 200 | 1.153 | 90 | Changing your name after marriage in the Philippines · Setnayan | sitemap |
| 276 | `/blog/how-to-handle-wedding-rsvps` | 200 | 1.358 | 88 | How to handle RSVPs and chase the stragglers · Setnayan | sitemap |
| 277 | `/blog/wedding-cake-guide-philippines` | 200 | 1.406 | 89 | The wedding cake guide for Filipino couples · Setnayan | sitemap |
| 278 | `/blog/what-is-a-same-day-edit-sde-wedding` | 200 | 1.384 | 88 | What is a same-day edit (SDE), and is it worth it? · Setnayan | sitemap |
| 279 | `/blog/simbang-gabi-and-december-weddings` | 200 | 1.347 | 89 | Simbang Gabi and getting married in December · Setnayan | sitemap |
| 280 | `/blog/ber-months-wedding-season-book-early` | 200 | 1.363 | 90 | The ber-months wedding rush: why to book early · Setnayan | sitemap |
| 281 | `/blog/iglesia-ni-cristo-wedding-overview` | 200 | 1.364 | 89 | An overview of an Iglesia ni Cristo wedding · Setnayan | sitemap |
| 282 | `/blog/pamamanhikan-explained` | 200 | 1.487 | 88 | Pamamanhikan: meeting the families, explained · Setnayan | sitemap |
| 283 | `/blog/psa-marriage-certificate-how-to-get` | 200 | 1.996 | 89 | How to get your PSA marriage certificate after the wedding · Setnayan | sitemap |
| 284 | `/blog/digital-invitations-online-rsvp-wedding` | 200 | 1.388 | 88 | Digital invitations and online RSVP: a modern guide · Setnayan | sitemap |
| 285 | `/blog/food-carts-late-night-snacks-wedding` | 200 | 1.379 | 90 | Food carts and late-night snacks: feeding the after-party · Setnayan | sitemap |
| 286 | `/blog/wedding-videography-styles-philippines` | 200 | 1.407 | 90 | Cinematic vs. documentary: wedding videography styles explained · Setnayan | sitemap |
| 287 | `/blog/new-years-eve-wedding-philippines` | 200 | 1.375 | 88 | A New Year's Eve wedding: the ultimate countdown · Setnayan | sitemap |
| 288 | `/blog/best-months-to-get-married-philippines` | 200 | 0.93 | 90 | The best months to get married in the Philippines · Setnayan | sitemap |
| 289 | `/blog/chinese-filipino-wedding-tea-ceremony` | 200 | 1.119 | 88 | Chinese-Filipino weddings and the tea ceremony · Setnayan | sitemap |
| 290 | `/blog/unity-candle-ceremony-wedding` | 200 | 1.152 | 88 | The unity candle ceremony, explained · Setnayan | sitemap |
| 291 | `/blog/wedding-payment-schedule-deposits-explained` | 200 | 1.14 | 89 | Deposits and payment schedules, explained · Setnayan | sitemap |
| 292 | `/blog/wedding-invitation-wording-etiquette-philippines` | 200 | 1.346 | 91 | Wedding invitation wording and etiquette, Filipino-style · Setnayan | sitemap |
| 293 | `/blog/mobile-bar-wedding-philippines` | 200 | 1.393 | 89 | The mobile bar guide: drinks for your Filipino wedding · Setnayan | sitemap |
| 294 | `/blog/prenup-engagement-shoot-guide-philippines` | 200 | 1.348 | 89 | The prenup (engagement) shoot, explained for Filipino couples · Setnayan | sitemap |
| 295 | `/blog/holiday-season-vendor-booking-crunch` | 200 | 1.463 | 88 | The holiday booking crunch: securing vendors in Q4 · Setnayan | sitemap |
| 296 | `/blog/brownout-power-contingency-wedding` | 200 | 0.955 | 89 | Brownout-proofing your wedding day · Setnayan | sitemap |
| 297 | `/blog/muslim-moro-wedding-philippines` | 200 | 1.364 | 90 | The Muslim (Moro) wedding in the Philippines · Setnayan | sitemap |
| 298 | `/blog/release-of-doves-filipino-wedding` | 200 | 1.41 | 89 | The release of doves: a Filipino wedding tradition · Setnayan | sitemap |
| 299 | `/blog/how-to-save-money-on-your-wedding-philippines` | 200 | 1.33 | 93 | 30 honest ways to save money on a Filipino wedding · Setnayan | sitemap |
| 300 | `/blog/save-the-dates-when-and-how-philippines` | 200 | 1.411 | 88 | Save-the-dates: when to send them and what to include · Setnayan | sitemap |
| 301 | `/blog/wedding-food-tasting-what-to-ask` | 200 | 1.386 | 90 | Your wedding food tasting: what to taste and what to ask · Setnayan | sitemap |
| 302 | `/blog/questions-to-ask-your-wedding-photographer` | 200 | 1.371 | 91 | 15 questions to ask your wedding photographer before booking · Setnayan | sitemap |
| 303 | `/blog/christmas-themed-wedding-ideas-philippines` | 200 | 1.342 | 89 | Christmas-themed wedding ideas for Filipino couples · Setnayan | sitemap |
| 304 | `/blog/wedding-wet-weather-contingency-plan` | 200 | 1.361 | 91 | Your wet-weather wedding plan, step by step · Setnayan | sitemap |
| 305 | `/blog/ilocano-wedding-traditions` | 200 | 1.338 | 89 | Ilocano wedding traditions, explained · Setnayan | sitemap |
| 306 | `/blog/money-dance-filipino-wedding` | 200 | 1.127 | 89 | The money dance: where it came from and how it works · Setnayan | sitemap |
| 307 | `/blog/average-wedding-cost-philippines-2026` | 200 | 1.337 | 90 | The average cost of a wedding in the Philippines (2026) · Setnayan | sitemap |
| 308 | `/blog/how-to-trim-your-wedding-guest-list` | 200 | 1.116 | 90 | How to trim your guest list politely · Setnayan | sitemap |
| 309 | `/blog/buffet-vs-plated-vs-family-style-wedding` | 200 | 1.4 | 88 | Buffet, plated, or family-style: which reception meal is right? · Setnayan | sitemap |
| 310 | `/blog/wedding-photographer-vs-videographer-philippines` | 200 | 1.372 | 89 | Photographer vs. videographer: do you need both? · Setnayan | sitemap |
| 311 | `/blog/december-wedding-philippines-guide` | 200 | 0.973 | 90 | Planning a December wedding in the Philippines · Setnayan | sitemap |
| 312 | `/blog/rainy-season-wedding-philippines` | 200 | 1.397 | 93 | Planning a rainy-season wedding in the Philippines · Setnayan | sitemap |
| 313 | `/blog/visayan-cebuano-wedding-traditions` | 200 | 1.323 | 91 | Visayan and Cebuano wedding traditions · Setnayan | sitemap |
| 314 | `/blog/cord-veil-coins-wedding-meaning` | 200 | 1.347 | 91 | The cord, the veil, and the coins: what they really mean · Setnayan | sitemap |
| 315 | `/blog/how-to-set-a-wedding-budget-philippines` | 200 | 1.311 | 90 | How to set a wedding budget you can actually keep · Setnayan | sitemap |
| 316 | `/blog/how-to-make-a-wedding-guest-list-philippines` | 200 | 1.378 | 92 | How to make your wedding guest list (without the drama) · Setnayan | sitemap |
| 317 | `/blog/how-to-choose-a-wedding-caterer-philippines` | 200 | 0.882 | 89 | How to choose a wedding caterer in the Philippines · Setnayan | sitemap |
| 318 | `/blog/how-to-choose-a-wedding-photographer-philippines` | 200 | 1.145 | 92 | How to choose a wedding photographer in the Philippines · Setnayan | sitemap |
| 319 | `/blog/free-printable-wedding-checklist-philippines` | 200 | 1.401 | 98 | A free, printable wedding checklist for Filipino couples · Setnayan | sitemap |
| 320 | `/blog/filipino-wedding-traditions-explained` | 200 | 1.315 | 80 | Filipino wedding traditions, explained · Setnayan | sitemap |
| 321 | `/blog/catholic-wedding-requirements-philippines` | 200 | 1.405 | 79 | Catholic wedding requirements in the Philippines · Setnayan | sitemap |
| 322 | `/blog/how-to-choose-a-wedding-venue-philippines` | 200 | 1.43 | 78 | How to choose your wedding venue in the Philippines · Setnayan | sitemap |
| 323 | `/blog/filipino-wedding-entourage-guide-ninong-ninang-sponsors` | 200 | 1.366 | 84 | The Filipino wedding entourage, explained: ninong, ninang, and sponsors · Setnayan | sitemap |
| 324 | `/blog/marriage-license-requirements-philippines` | 200 | 1.369 | 80 | Marriage licence in the Philippines: a step-by-step guide · Setnayan | sitemap |
| 325 | `/blog/wedding-budget-breakdown-philippines` | 200 | 1.337 | 80 | Wedding budget breakdown: where the money actually goes · Setnayan | sitemap |
| 326 | `/blog/civil-vs-church-wedding-philippines` | 200 | 1.121 | 86 | Civil vs. church wedding in the Philippines: which is right for you? · Setnayan | sitemap |
| 327 | `/blog/how-much-do-wedding-suppliers-cost-philippines` | 200 | 1.378 | 88 | How much do wedding suppliers cost in the Philippines? · Setnayan | sitemap |
| 328 | `/blog/what-to-do-12-months-before-your-philippine-wedding` | 200 | 1.349 | 94 | What to do 12 months before your Philippine wedding · Setnayan | sitemap |
| 329 | `/features/budget` | 200 | 0.551 | 94 | Free Event Budget Tracker in Pesos · Setnayan | sitemap |
| 330 | `/tl/features/budget` | 200 | 0.422 | 96 | Libreng Budget Tracker sa Piso · Setnayan | sitemap |
| 331 | `/features/guest-list` | 200 | 0.39 | 94 | Free Guest List and RSVP Tracker · Setnayan | sitemap |
| 332 | `/tl/features/guest-list` | 200 | 0.548 | 97 | Libreng Guest List at RSVP Tracker · Setnayan | sitemap |
| 333 | `/features/seat-plan` | 200 | 0.402 | 91 | Free Seating Chart Maker · Setnayan | sitemap |
| 334 | `/tl/features/seat-plan` | 200 | 0.384 | 93 | Libreng Seating Chart Maker · Setnayan | sitemap |
| 335 | `/features/3d-plan` | 200 | 0.383 | 87 | 3D Venue Plan from Your Seat Plan · Setnayan | sitemap |
| 336 | `/tl/features/3d-plan` | 200 | 0.368 | 88 | 3D Venue Plan mula sa Seat Plan · Setnayan | sitemap |
| 337 | `/features/schedule` | 200 | 0.401 | 92 | Event Day Schedule and Run-of-Show · Setnayan | sitemap |
| 338 | `/tl/features/schedule` | 200 | 0.39 | 94 | Schedule at Run-of-Show ng Event · Setnayan | sitemap |
| 339 | `/features/date-picker` | 200 | 0.638 | 83 | Choose Your Event Date · Setnayan | sitemap |
| 340 | `/tl/features/date-picker` | 200 | 0.392 | 84 | Pumili ng Petsa ng Event · Setnayan | sitemap |
| 341 | `/features/mood-board` | 200 | 0.354 | 90 | Event Mood Board and Color Palette · Setnayan | sitemap |
| 342 | `/tl/features/mood-board` | 200 | 0.378 | 92 | Mood Board at Color Palette ng Event · Setnayan | sitemap |
| 343 | `/features/marketplace` | 200 | 0.591 | 90 | Find Verified Filipino Event Suppliers · Setnayan | sitemap |
| 344 | `/tl/features/marketplace` | 200 | 0.363 | 92 | Maghanap ng Verified na Pinoy Suppliers · Setnayan | sitemap |
| 345 | `/features/compare` | 200 | 0.38 | 83 | Compare Two Event Suppliers Side by Side · Setnayan | sitemap |
| 346 | `/tl/features/compare` | 200 | 0.407 | 84 | Ikumpara ang Dalawang Supplier · Setnayan | sitemap |
| 347 | `/features/suppliers` | 200 | 0.442 | 98 | Your Event’s Suppliers: Find, Build, Booked · Setnayan | sitemap |
| 348 | `/tl/features/suppliers` | 200 | 0.361 | 101 | Suppliers ng Event Mo: Find, Build, Booked · Setnayan | sitemap |
| 349 | `/features/setnayan-ai` | 200 | 0.405 | 89 | Setnayan AI Event Planner · Setnayan | sitemap |
| 350 | `/tl/features/setnayan-ai` | 200 | 0.363 | 91 | Setnayan AI: Event Planner na Nagbabantay · Setnayan | sitemap |
| 351 | `/features/event-hub` | 200 | 3.193 | 99 | Event Hub: One Link for Your Event · Setnayan | sitemap |
| 352 | `/tl/features/event-hub` | 200 | 0.5 | 102 | Event Hub: Isang Link para sa Event Mo · Setnayan | sitemap |
| 353 | `/features/dress-code` | 200 | 0.704 | 90 | Dress Code and Call Times for Each Role · Setnayan | sitemap |
| 354 | `/tl/features/dress-code` | 200 | 0.448 | 91 | Dress Code at Call Time ng Bawat Role · Setnayan | sitemap |
| 355 | `/features/wedding-march` | 200 | 0.423 | 88 | Wedding March and Entourage Order Maker · Setnayan | sitemap |
| 356 | `/tl/features/wedding-march` | 200 | 0.409 | 90 | Wedding March at Ayos ng Entourage · Setnayan | sitemap |
| 357 | `/features/e-gifts` | 200 | 0.394 | 87 | E-Gifts and Wish List for Your Event · Setnayan | sitemap |
| 358 | `/tl/features/e-gifts` | 200 | 0.401 | 89 | E-Gifts at Wish List para sa Event Mo · Setnayan | sitemap |
| 359 | `/features/prints` | 200 | 0.468 | 91 | Printable Invitations, Signs and Place Cards · Setnayan | sitemap |
| 360 | `/tl/features/prints` | 200 | 0.441 | 92 | Printable na Imbitasyon, Karatula at Place Cards · Setnayan | sitemap |
| 361 | `/features/logo-maker` | 200 | 0.4 | 86 | Wedding Monogram and Logo Maker · Setnayan | sitemap |
| 362 | `/tl/features/logo-maker` | 200 | 0.422 | 87 | Monogram at Logo Maker sa Kasal · Setnayan | sitemap |
| 363 | `/features/music-maker` | 200 | 0.441 | 84 | Custom Wedding Song from Your Love Story · Setnayan | sitemap |
| 364 | `/tl/features/music-maker` | 200 | 0.533 | 85 | Custom na Kanta mula sa Love Story Mo · Setnayan | sitemap |
| 365 | `/features/groups` | 200 | 0.405 | 82 | Groups for Barkada, Family and Clubs · Setnayan | sitemap |
| 366 | `/tl/features/groups` | 200 | 0.37 | 83 | Groups para sa Barkada, Pamilya at Klub · Setnayan | sitemap |
| 367 | `/features/papic` | 200 | 0.599 | 94 | Papic: Guest Photo Sharing for Events · Setnayan | sitemap |
| 368 | `/tl/features/papic` | 200 | 0.379 | 96 | Papic: Photo Sharing ng Bisita sa Event · Setnayan | sitemap |
| 369 | `/features/live-watch` | 200 | 0.397 | 85 | Live Watch: Livestream Your Event · Setnayan | sitemap |
| 370 | `/tl/features/live-watch` | 200 | 0.415 | 87 | Live Watch: I-livestream ang Event Mo · Setnayan | sitemap |
| 371 | `/features/patiktok` | 200 | 0.398 | 82 | Patiktok: Short Highlight Reels · Setnayan | sitemap |
| 372 | `/tl/features/patiktok` | 200 | 0.407 | 83 | Patiktok: Maikling Highlight Reels · Setnayan | sitemap |
| 373 | `/features/alaala` | 200 | 0.381 | 84 | Memories: Keep Your Event in One Place · Setnayan | sitemap |
| 374 | `/tl/features/alaala` | 200 | 0.368 | 85 | Memories: Itago ang Event sa Isang Lugar · Setnayan | sitemap |
| 375 | `/features/real-stories` | 200 | 0.376 | 86 | Real Event Stories from the Philippines · Setnayan | sitemap |
| 376 | `/tl/features/real-stories` | 200 | 0.388 | 87 | Totoong Kuwento ng mga Event sa Pilipinas · Setnayan | sitemap |
| 377 | `/testnayanw1lights` | 200 | 3.043 | 220 | Testnayan W1 Lights · Setnayan supplier · Setnayan | sitemap |
| 378 | `/setnaprod` | 200 | 2.357 | 278 | SetnaProd · Setnayan supplier · Setnayan | sitemap |
| 379 | `/realstories/andres-villanueva-lipa-paalam` | 200 | 0.423 | 69 | Andres Villanueva: a family home & parish wake in Lipa · Setnayan | sitemap |
| 380 | `/realstories/barkada-movie-night-quezon-city` | 200 | 0.353 | 67 | The Thursday Barkada: a living room hangout in Quezon City · Setnayan | sitemap |
| 381 | `/realstories/nica-and-paul-intramuros-date` | 200 | 0.392 | 64 | Nica & Paul: a old city date in Manila · Setnayan | sitemap |
| 382 | `/realstories/ramos-house-blessing-cavite` | 200 | 0.351 | 67 | The Ramos Household: a new home simple event in Cavite · Setnayan | sitemap |
| 383 | `/realstories/tahanan-foundation-pasig-gala` | 200 | 0.375 | 70 | Tahanan Foundation: a hotel ballroom gala night in Pasig · Setnayan | sitemap |
| 384 | `/realstories/barangay-liga-cebu-finals` | 200 | 0.392 | 69 | Barangay Liga Finals: a covered court tournament in Cebu · Setnayan | sitemap |
| 385 | `/realstories/bayanihan-tech-makati-year-end` | 200 | 0.36 | 70 | Bayanihan Tech: a function hall corporate in Makati · Setnayan | sitemap |
| 386 | `/realstories/the-ramos-family-el-nido-trip` | 200 | 0.341 | 69 | The Ramos Family: a island travel in El Nido · Setnayan | sitemap |
| 387 | `/realstories/aling-nena-marikina-tenth-year` | 200 | 0.375 | 69 | Aling Nena’s Store: a street corner celebration in Marikina · Setnayan | sitemap |
| 388 | `/realstories/the-lims-quezon-city-gender-reveal` | 200 | 0.355 | 69 | The Lim Family: a rooftop deck gender reveal in Quezon City · Setnayan | sitemap |
| 389 | `/realstories/lolo-tony-laguna-80th-birthday` | 200 | 0.361 | 70 | Lolo Tony: a backyard birthday in Laguna · Setnayan | sitemap |
| 390 | `/realstories/noah-santos-antipolo-christening` | 200 | 0.372 | 70 | Noah Santos: a parish church christening in Antipolo · Setnayan | sitemap |
| 391 | `/realstories/peter-and-mary-tagaytay-estate-wedding` | 200 | 0.447 | 181 | Peter & Mary: a catholic estate wedding in Tagaytay · Setnayan | sitemap |
| 392 | `/realstories/maria-and-juan-tagaytay-garden-wedding` | 200 | 0.458 | 258 | Maria & Juan: a catholic garden wedding in Tagaytay · Setnayan | sitemap |
| 393 | `/realstories/sofia-reyes-makati-debut` | 200 | 0.376 | 262 | Sofia Reyes: a hotel ballroom debut in Makati · Setnayan | sitemap |
| 394 | `/realstories/jack-and-rose-baguio-forest-wedding` | 200 | 0.445 | 181 | Jack & Rose: a christian pine forest wedding in Baguio · Setnayan | sitemap |
| 395 | `/realstories/john-and-jane-manila-rooftop-wedding` | 200 | 0.39 | 176 | John & Jane: a civil rooftop wedding in Manila · Setnayan | sitemap |
| 396 | `/realstories/romy-and-beth-pasig-golden-anniversary` | 200 | 0.368 | 66 | Romy & Beth Cruz: a banquet hall anniversary in Pasig · Setnayan | sitemap |
| 397 | `/realstories/jack-and-jill-cebu-beach-wedding` | 200 | 0.5 | 177 | Jack & Jill: a beach shoreline wedding in Cebu · Setnayan | sitemap |
| 398 | `/realstories/bea-aquino-quezon-city-graduation` | 200 | 0.383 | 65 | Bea Aquino: a garden graduation in Quezon City · Setnayan | sitemap |
| 399 | `/realstories/dela-cruz-family-cebu-reunion` | 200 | 0.355 | 65 | Dela Cruz Family: a beach resort reunion in Cebu · Setnayan | sitemap |
| 400 | `/cale-ice?via=discover` | 200 | 3.856 | 376 | Indalecio & Claire · Setnayan | link from `/` |
| 401 | `/flowerstoreph?src=discover` | 200 | 3.042 | 151 | Makati Florals #1 · Setnayan supplier · Setnayan | link from `/` |
| 402 | `/maria-and-jose?via=discover` | 200 | 2.278 | 210 | Maria & Jose · Setnayan | link from `/` |
| 403 | `/rondomusical?src=discover` | 200 | 1.387 | 144 | Quezon City Band / live music #1 · Setnayan supplier · Setnayan | link from `/` |
| 404 | `/testnayanw1lights?src=discover` | 200 | 1.684 | 220 | Testnayan W1 Lights · Setnayan supplier · Setnayan | link from `/` |
| 405 | `/setnaprod?src=discover` | 200 | 1.373 | 278 | SetnaProd · Setnayan supplier · Setnayan | link from `/` |
| 406 | `/u/iscasasolaii` | 200 | 0.58 | 134 | Ice Casasola · Setnayan · Setnayan | link from `/` |
| 407 | `/u/ana-at-marco` | 200 | 0.642 | 131 | Setnayan | link from `/` |
| 408 | `/?browse=1` | 200 | 1.326 | 112 | Setnayan · Plan any event free. Every photo in one album. | link from `/about` |
| 409 | `/signup?next=%2Fadmin` | 200 | 0.399 | 68 | Create account · Setnayan | link from `/admin` |
| 410 | `/onboarding/wedding?from=alaala` | 200 | 0.463 | 232 | Plan your wedding · Setnayan | link from `/alaala` |
| 411 | `/blog?category=planning` | 200 | 0.447 | 192 | Setnayan Articles — Filipino event planning guides · Setnayan | link from `/blog` |
| 412 | `/blog?category=vendors` | 200 | 0.359 | 160 | Setnayan Articles — Filipino event planning guides · Setnayan | link from `/blog` |
| 413 | `/blog?category=news` | 200 | 0.344 | 110 | Setnayan Articles — Filipino event planning guides · Setnayan | link from `/blog` |
| 414 | `/blog?category=culture` | 200 | 0.75 | 169 | Setnayan Articles — Filipino event planning guides · Setnayan | link from `/blog` |
| 415 | `/onboarding/wedding?from=budget` | 200 | 0.555 | 232 | Plan your wedding · Setnayan | link from `/budget` |
| 416 | `/signup?next=%2Fdashboard` | 200 | 0.564 | 68 | Create account · Setnayan | link from `/dashboard` |
| 417 | `/setnaprod?service=S89S-59BZ88PX4R` | 200 | 2.261 | 278 | SetnaProd · Setnayan supplier · Setnayan | link from `/explore/compare` |
| 418 | `/testnayanw1lights?service=S89S-RS7KERRF7D` | 200 | 2.426 | 220 | Testnayan W1 Lights · Setnayan supplier · Setnayan | link from `/explore/compare` |
| 419 | `/setnaprod?service=S89S-HMPNEQ1K3D` | 200 | 2.117 | 278 | SetnaProd · Setnayan supplier · Setnayan | link from `/explore/compare` |
| 420 | `/setnaprod?service=S89S-2KHH8T6JT5` | 200 | 1.634 | 278 | SetnaProd · Setnayan supplier · Setnayan | link from `/explore/compare` |
| 421 | `/v/setnayan-weddings` | 404 | 1.922 |  |  | link from `/for-coordinators` |
| 422 | `/onboarding/wedding?from=guest-list` | 200 | 0.415 | 232 | Plan your wedding · Setnayan | link from `/guest-list` |
| 423 | `/help?role=guest` | 200 | 0.642 | 248 | Help & support · Setnayan | link from `/help` |
| 424 | `/help?role=couple` | 200 | 0.398 | 315 | Help & support · Setnayan | link from `/help` |
| 425 | `/help?role=vendor` | 200 | 0.349 | 267 | Help & support · Setnayan | link from `/help` |
| 426 | `/onboarding/wedding?from=marketplace` | 200 | 0.39 | 232 | Plan your wedding · Setnayan | link from `/marketplace` |
| 427 | `/login?next=/monogram` | 200 | 0.603 | 51 | Sign in · Setnayan | link from `/monogram` |
| 428 | `/signup?next=/monogram` | 200 | 0.38 | 68 | Create account · Setnayan | link from `/monogram` |
| 429 | `/onboarding/wedding?from=monogram` | 200 | 0.603 | 232 | Plan your wedding · Setnayan | link from `/monogram` |
| 430 | `/onboarding/wedding?from=mood-board` | 200 | 0.363 | 232 | Plan your wedding · Setnayan | link from `/mood-board` |
| 431 | `/signup?next=%2Fonboarding%2Fsimple` | 200 | 0.348 | 68 | Create account · Setnayan | link from `/onboarding/simple` |
| 432 | `/login?next=%2Fonboarding%2Fwedding%3Fresume%3D1` | 200 | 0.402 | 51 | Sign in · Setnayan | link from `/onboarding/wedding` |
| 433 | `/login?next=%2Fopen-shop&as=vendor?next=%2Fopen-shop` | 200 | 0.325 | 51 | Sign in · Setnayan | link from `/open-shop` |
| 434 | `/signup?next=%2Fopen-shop%2Flogo&as=vendor` | 200 | 0.573 | 68 | Create account · Setnayan | link from `/open-shop/logo` |
| 435 | `/onboarding/wedding?from=pa3d-try` | 200 | 0.354 | 232 | Plan your wedding · Setnayan | link from `/pa3d/try` |
| 436 | `/onboarding/wedding?from=pakanta` | 200 | 0.348 | 232 | Plan your wedding · Setnayan | link from `/pakanta` |
| 437 | `/onboarding/wedding?from=palogo` | 200 | 0.364 | 232 | Plan your wedding · Setnayan | link from `/palogo` |
| 438 | `/onboarding/wedding?from=panood` | 200 | 0.37 | 232 | Plan your wedding · Setnayan | link from `/panood` |
| 439 | `/onboarding/wedding?from=patiktok` | 200 | 0.347 | 232 | Plan your wedding · Setnayan | link from `/patiktok` |
| 440 | `/onboarding/wedding?from=pawebsite` | 200 | 0.376 | 232 | Plan your wedding · Setnayan | link from `/pawebsite` |
| 441 | `/dashboard/profile` | 307 → 200 → `/login?next=%2Fdashboard` | 1.76 | 51 | Sign in · Setnayan | link from `/privacy` |
| 442 | `/maria-and-jose` | 200 | 0.895 | 210 | Maria & Jose · Setnayan | link from `/realstories` |
| 443 | `/dashboard/samahan/new` | 307 → 200 → `/login?next=%2Fdashboard` | 0.397 | 51 | Sign in · Setnayan | link from `/samahan` |
| 444 | `/onboarding/wedding?from=schedule` | 200 | 0.448 | 232 | Plan your wedding · Setnayan | link from `/schedule` |
| 445 | `/onboarding/wedding?from=seat-plan` | 200 | 0.336 | 232 | Plan your wedding · Setnayan | link from `/seat-plan` |
| 446 | `/onboarding/wedding?from=setnayan-ai` | 200 | 0.57 | 232 | Plan your wedding · Setnayan | link from `/setnayan-ai` |
| 447 | `/onboarding/wedding?from=tour` | 200 | 0.401 | 232 | Plan your wedding · Setnayan | link from `/tour` |
| 448 | `/signup?next=%2Fvendor-dashboard` | 200 | 0.355 | 68 | Create account · Setnayan | link from `/vendor-dashboard` |
| 449 | `/signup?next=%2Fvendor-dashboard%2Fearnings` | 200 | 0.595 | 68 | Create account · Setnayan | link from `/vendor-dashboard/earnings` |
| 450 | `/signup?next=%2Fvendor-dashboard%2Fclients` | 200 | 0.322 | 68 | Create account · Setnayan | link from `/vendor-dashboard/clients` |
| 451 | `/dashboard/api-keys` | 307 → 200 → `/login?next=%2Fdashboard` | 0.695 | 51 | Sign in · Setnayan | link from `/api/v1` |
| 452 | `/v/testnayanw1lights/dates` | 200 | 0.535 | 61 | Check a date · Testnayan W1 Lights · Setnayan | link from `/testnayanw1lights` |
| 453 | `/explore` | 308 → 200 → `/` | 0.082 | 315 | Setnayan · Plan any event free. Every photo in one album. | link from `/testnayanw1lights` |
| 454 | `/v/setnaprod/dates` | 200 | 0.642 | 62 | Check a date · SetnaProd · Setnayan | link from `/setnaprod` |
| 455 | `/v/testnayanw1lights/dates?src=discover` | 200 | 0.457 | 61 | Check a date · Testnayan W1 Lights · Setnayan | link from `/testnayanw1lights?src=discover` |
| 456 | `/v/setnaprod/dates?src=discover` | 200 | 0.417 | 62 | Check a date · SetnaProd · Setnayan | link from `/setnaprod?src=discover` |
| 457 | `/u/iscasasolaii/maria-and-jose` | 200 | 0.44 | 251 | Maria & Jose · Setnayan | link from `/u/iscasasolaii` |
| 458 | `/u/iscasasolaii/cale-ice` | 200 | 0.455 | 523 | Indalecio & Claire · Setnayan | link from `/u/iscasasolaii` |
| 459 | `/u/ana-at-marco/c/S89C-CK46HS1VSS` | 200 | 0.543 | 68 | Our Batanes wedding, told in full · Marco · Setnayan | link from `/u/ana-at-marco` |
| 460 | `/login?next=%2Fadmin` | 200 | 0.516 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fadmin` |
| 461 | `/login?next=%2Fdashboard` | 200 | 0.333 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fdashboard` |
| 462 | `/signup?next=%2Fmonogram` | 200 | 0.363 | 68 | Create account · Setnayan | link from `/login?next=/monogram` |
| 463 | `/login?next=%2Fmonogram` | 200 | 0.34 | 51 | Sign in · Setnayan | link from `/signup?next=/monogram` |
| 464 | `/login?next=%2Fonboarding%2Fsimple` | 200 | 0.351 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fonboarding%2Fsimple` |
| 465 | `/signup?next=%2Fonboarding%2Fwedding%3Fresume%3D1` | 200 | 0.37 | 68 | Create account · Setnayan | link from `/login?next=%2Fonboarding%2Fwedding%3Fresume%3D1` |
| 466 | `/signup?next=%2Fopen-shop` | 200 | 0.337 | 68 | Create account · Setnayan | link from `/login?next=%2Fopen-shop&as=vendor?next=%2Fopen-shop` |
| 467 | `/login?next=%2Fopen-shop%2Flogo` | 200 | 0.558 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fopen-shop%2Flogo&as=vendor` |
| 468 | `/login?next=%2Fvendor-dashboard` | 200 | 0.387 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fvendor-dashboard` |
| 469 | `/login?next=%2Fvendor-dashboard%2Fearnings` | 200 | 0.325 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fvendor-dashboard%2Fearnings` |
| 470 | `/login?next=%2Fvendor-dashboard%2Fclients` | 200 | 0.354 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fvendor-dashboard%2Fclients` |
| 471 | `/v/testnayanw1lights` | 200 | 2.694 | 173 | Testnayan W1 Lights · Setnayan supplier · Setnayan | link from `/v/testnayanw1lights/dates` |
| 472 | `/v/setnaprod` | 200 | 2.193 | 225 | SetnaProd · Setnayan supplier · Setnayan | link from `/v/setnaprod/dates` |
| 473 | `/v/testnayanw1lights?src=discover` | 200 | 1.434 | 171 | Testnayan W1 Lights · Setnayan supplier · Setnayan | link from `/v/testnayanw1lights/dates?src=discover` |
| 474 | `/v/setnaprod?src=discover` | 200 | 1.146 | 223 | SetnaProd · Setnayan supplier · Setnayan | link from `/v/setnaprod/dates?src=discover` |
| 475 | `/login?next=%2Fmaria-and-jose` | 200 | 0.365 | 51 | Sign in · Setnayan | link from `/u/iscasasolaii/maria-and-jose` |
| 476 | `/login?next=%2Fcale-ice` | 200 | 0.345 | 51 | Sign in · Setnayan | link from `/u/iscasasolaii/cale-ice` |
| 477 | `/login?next=%2Fopen-shop` | 200 | 0.342 | 51 | Sign in · Setnayan | link from `/signup?next=%2Fopen-shop` |
| 478 | `/signup?next=%2Fopen-shop%2Flogo` | 200 | 0.328 | 68 | Create account · Setnayan | link from `/login?next=%2Fopen-shop%2Flogo` |
| 479 | `/signup?next=%2Fmaria-and-jose` | 200 | 0.341 | 68 | Create account · Setnayan | link from `/login?next=%2Fmaria-and-jose` |
| 480 | `/signup?next=%2Fcale-ice` | 200 | 0.383 | 68 | Create account · Setnayan | link from `/login?next=%2Fcale-ice` |
