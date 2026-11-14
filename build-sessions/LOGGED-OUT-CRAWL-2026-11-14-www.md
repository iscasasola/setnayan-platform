# Logged-out crawl · www.setnayan.com · 2026-11-14

> **Companion to [iscasasola/setnayan-platform#7620](https://github.com/iscasasola/setnayan-platform/pull/7620)**, the same task run earlier
> by another session (`build-sessions/LOGGED-OUT-CRAWL-2026-11-14.md` on `claude/logged-out-crawl`). That run could
> only reach the Vercel host and checked 390 px on 15 pages. **This run measured `www.setnayan.com` itself, at
> 390 and 1280 px on every page, and opened the sheets and menus.** The file name differs so the two never conflict.
> See "Overlap with #7620" at the end of the findings.

**What this is:** every page a signed-out visitor can reach on the live site, opened at **390 px** (phone,
touch) and **1280 px** (desktop), and checked for broken pages, dead links, wrong copy, price mismatches,
overflow, small tap targets and slow first loads. This covers the gap the signed-in walkthrough (W1) leaves.
**Nothing was fixed here.** Findings feed the fixer queue.

**How it was done**
- Headless Chromium (Playwright) through the session proxy, live production, 2026-11-14 ~01:20–02:10 UTC.
- **No writes.** Every non-GET request (POST/PUT/PATCH/DELETE, i.e. every server action, form post and
  beacon) was **aborted at the network layer** before it left the browser. Nothing was typed, submitted,
  signed in or paid.
- **Page list.** The specs repo (`Setnayan-specs`) is outside this session's GitHub access, so
  `prototypes/design_template_full_audit_2026-11-14.md` could **not** be read. As the brief allows, the list
  was built from: `sitemap.xml` (283 URLs) + the public routes under `apps/web/app` + **every same-site link
  found on those pages** (breadth-first) + guest-facing event pages and shops (slugs taken read-only from
  prod `events` / `vendor_profiles`; a stranger reaches these from a shared link) + deliberate 404 probes.
- **479 paths · 998 page loads.** Full list at the bottom.
- **Inner screens:** a second pass at 390 px tapped every visible non-submit button, tab, `summary` and
  menu toggle on 22 main pages (front page, pricing, plan, marketplace, for-suppliers, for-coordinators,
  features, papic, patiktok, help, signup, login, start, budget, guest-list, seat-plan, open-shop, download,
  a shop, an event, compare, suppliers) and recorded each sheet or dialog that opened. Taps were limited to
  controls whose label is not sign-in/up, pay, buy, book, send, save, upload, claim, RSVP or reply.
- Screenshots are in `build-sessions/logged-out-crawl-2026-11-14/` (viewport-sized JPEGs).

**What could NOT be checked (blocked by this session's network, not by the site):** images and tiles from
`pub-…r2.dev` (shop and service photos), `tile.openstreetmap.org` (shop maps) and `images.unsplash.com`
(`/tour/gallery`), plus Sentry. They show as broken in this browser only. **This crawl cannot say whether
those images load for a real visitor.** External links (social, app stores) were not followed.

---

## Findings — worst first

| # | Severity | URL · width | What is wrong | Evidence |
|---|---|---|---|---|
| 1 | **High · dead link** | `/for-suppliers` (also `/vendors`, which redirects to it) · both | The **"SEE A REAL SHOP · Setnayan Productions"** card links to `https://www.setnayan.com/v/setnayan-production` → **404** "This page doesn't exist on Setnayan." This is the supplier landing page's main proof point. Source: `apps/web/app/for-suppliers/_components/supplier-front-data.ts` / `supplier-front-page.tsx`. | `390_v_setnayan-production.jpg` |
| 2 | **High · dead link** | `/for-coordinators` · both | The **"SEE THE SAMPLE SHOP · Setnayan Weddings"** card links to `/v/setnayan-weddings` → **404**. Source: `apps/web/app/(shell)/for-coordinators/page.tsx`. | `390_v_setnayan-weddings.jpg` |
| 3 | **High · price mismatch** | `/features/setnayan-ai` (+ `/tl/features`, `/tl/features/setnayan-ai`) · both | The card says **"PRICE From ₱265"**. `/about` and `/help` say Setnayan AI *"is not sold on its own: it comes with Event Plus, Event Pro and Event Ultra"*, and `/pricing` lists no ₱265 item. The cheapest way to get it per `/pricing` is Event Plus, **₱2,990**. | `390_features_setnayan-ai.jpg` |
| 4 | **High · price mismatch** | `/features/papic` (+ `/tl/features/papic`) vs `/pricing` · both | Papic: **"Free · upgrades from ₱499"** on the feature page, but **"Papic credits from ₱99"** on `/pricing`. One of the two is wrong. | `390_features_papic.jpg`, `390_pricing_list.jpg` |
| 5 | **High · test data in public** | `/` ("The first shops"), `/explore/compare`, `sitemap-static.xml` · both | The test shop **"Testnayan W1 Lights"** is shown to every visitor on the front page, with a placeholder **"W1 COVER"** image and **"W1 LOGO"**, a **VERIFIED** seal and a "6 YEARS" seal. It is also in the public sitemap as `/testnayanw1lights`. It is the first card in "The first shops". | `home_suppliers.jpg`, `390_testnayanw1lights.jpg` |
| 6 | **High · wrong name** | `/` → `/rondomusical`, `/` → `/flowerstoreph` · both | The front-page shop cards and the pages they open have **different names**: card **"Rondo Musical"** → page title/heading **"Quezon City Band / live music #1"**; card **"FlowerStore.ph"** → **"Makati Florals #1"**. The "#1" names read as seed data. Read-only check: both rows have `vendor_profiles.public_visibility = 'hidden'`, yet both are shown and linked on the signed-out front page. Also `/v/flowerstoreph` is 200 while `/v/flowerstoreph/dates` is **404**. | `home_suppliers.jpg`, `390_rondomusical.jpg`, `390_flowerstoreph.jpg` |
| 7 | **Medium · owner to decide** | `/` ("Upcoming on Setnayan", "People to follow") · both | Signed-out visitors see the owner's real wedding **"Indalecio & Claire"** and his name **"Ice Casasola"**, linking to `/cale-ice` (date 18 Dec 2026, church and hotel, run of show) and `/u/iscasasolaii`. `/cale-ice/everyone` lists the parents and entourage by full name and honorific. This may be intended (it is the Discover row), but it is the owner's real event, so it is flagged rather than assumed. | — |
| 8 | **Medium · tap blocked** | `/pricing` · 390 | A guided tour ("STEP 1 OF 3 · Why Setnayan") **opens on its own at page load**, dims the page and scrolls it. While it is open the header **☰ menu cannot be tapped** (the tap is intercepted; measured: click timed out after 4 s). The way out is a **"Skip"** link, 35×44 px. | `verify_pricing_top.jpg` |
| 9 | **Medium · internal copy shown** | `/features` · both | The plan-table card says **"Free · Event Plus · Event Pro, every cell read from the code."** That is a developer note. The info sheets on the same page read like a changelog, e.g. *"PROBLEM — The dashboard nagged for name, date and place the moment you arrived. SOLUTION — Every onboarding step uses one template…"*, with a **"LIVE"** status tag. | `verify_features_info.jpg` |
| 10 | **Medium · plan naming** | `/features` (+ `/tl/features`) · both | Event Ultra is left out where all three plans should be named: card title **"Event Plus and Event Pro"**, the plan-table card ("Free · Event Plus · Event Pro"), and *"Event Plus or Event Pro (Setnayan AI comes inside both)"*. `/about`, `/help` and `/pricing` say AI comes with **all three** (Plus, Pro, Ultra). | — |
| 11 | **Medium · price hidden** | `/features/event-hub`, `/features/logo-maker` (+ `/tl/…`) · both | The FAQ answers say the upgrade is **"priced in the live catalogue"** (internal wording) and give no price. The same pages' price strip already says "upgrades from ₱5,690". | — |
| 12 | **Medium · wrong 404** | `/this-page-does-not-exist-404`, `/faq`, `/contact`, `/supplies`, `/vendor` · both | Any unknown top-level path shows the event-link 404 **"This link can't be found."** with a **Sign in** button, and the tab title reads **"Setnayan supplier · Setnayan"** (or "Link not found"). Section 404s (`/blog/x`, `/help/x`, `/realstories/x`) show a different page, "This page doesn't exist on Setnayan.". `/features/x` 404 has the home page's title. `/faq` and `/contact` are common guesses with no page; `robots.txt` still lists `Allow: /supplies`, which is a 404. | `390_this-page-does-not-exist-404.jpg`, `1280_features_nope.jpg` |
| 13 | **Medium · /sample** | `/sample` · both | Returns **404** but the tab title is **"Maria and Jose — a sample event · Setnayan"**. Nothing links to it: the live sample is `/maria-and-jose`. Either the route or its metadata is stale. | — |
| 14 | **Medium · tap targets < 44 px** | every shell page · 390 | Header on every page: **☰ 40×40**, **Sign in 72×36**, **Search 58×42**, wordmark link 110×23. The **"i" info buttons are 16×16** (front page, `/pricing`, `/features`, `/for-suppliers`). In the ☰ menu, the secondary links (About, Pricing, Help, Articles, Download, Terms, Privacy, …) are **32 px** tall and the footer row is 20 px. On event pages, **"Read more" is 86×32**. On help and blog pages, breadcrumbs and "All help topics" / "Still stuck? Contact support →" are 18–20 px tall. On `/login`: "Forgot password?" is 102×19 and "Create one, free" is 92×17. In the shop service sheet, "Choose this service" is 358×40 and "Close" is 40×44. | `verify_home_menu.jpg` |
| 15 | **Medium · test data in public** | `sitemap-static.xml` | The public sitemap lists **`/testnayanw1lights`** (the test shop) and **`/setnaprod`** (the owner's shop). Search engines are being asked to index a test shop. | — |
| 16 | **Low · text overflow** | `/cale-ice` (and `/cale-ice/*`, `/u/iscasasolaii/cale-ice`) · 390 | Measured on the page: the venue line **"Santuario de San Vicente de Paul Parish · Seda Hotel Vertis…"** ends at x = 401 on a 390 px screen, so about 11 px is cut off. The date line "December 18, 2026" reaches x = 392–401. Not seen by eye: the page opens behind a "Tap or swipe up to unveil" cover, and the crawl did not swipe. | — |
| 17 | **Low · keyboard** | `/v/setnaprod` · 390 | After a service sheet opens ("View details for Mobile bar by Setnaprod"), **Escape does not close it**. The sheet stays open and blocks taps on the next service card (two in a row timed out). | — |
| 18 | **Low · console error** | `/tour/budget` · 1280 | React **error #418 (hydration mismatch, HTML)** once in 5 loads. Re-loaded 4 more times at both widths: clean. Probably content that depends on the time or locale. | — |
| 19 | **Low · private event shows title** | `/test-w1-get-together` (+ every sub-path) · both | A **private** test event shows its name **"TEST W1 get-together"** as the heading above "This event's page is private". The `/invite` sub-path is a **404**, but every other sub-path redirects to the private notice, so the same event answers in two different ways. | `390_test-w1-get-together.jpg` |
| 20 | **Low · titles** | `/u/iscasasolaii` ("Ice Casasola · Setnayan · Setnayan"), `/v/*/booth` ("Supplier booth · Setnayan · Setnayan"), shop pages ("SetnaProd · Setnayan supplier · Setnayan") | The tab title repeats **"· Setnayan"**. `/u/ana-at-marco`, `/wall/1`, `/papic/guest` and `/papic/decorate` have only the generic title. | — |
| 21 | **Low · "vendor" shown to visitors** | `/` and `/blog` (card), `/blog/what-zero-commission-means-for-couples`, `/blog/holiday-season-vendor-booking-crunch` + 19 other blog posts, `/realstories/dela-cruz-family-cebu-reunion`, `/start` | Visible text says "vendor": **"What 0% commission means for couples and vendors"** (an article card on the front page), **"Browse the vendor marketplace"** (a call to action at the end of 19 blog posts), "The holiday booking crunch: securing vendors in Q4", "Vendors keep 100% of their booking fee", and on `/start` the Get-together option says **"No vendors, no marketplace."**. Seven more blog posts use it in body text. No product page (pricing, features, for-suppliers, help) shows it. | — |
| 22 | **Low · empty-looking pages** | `/<event>/venue` (every event) · both | The page is black with only "The 3D room opens on the day" and a back button (113–148 characters of text). It is honest copy, but it is a full dark page linked from the invitation. | `390_ana-ben_venue.jpg` |

### Overlap with #7620

| This report | #7620 | Note |
|---|---|---|
| #2 `/v/setnayan-weddings` 404 | L-03 | same |
| #5, #15 test shop on `/` and in the sitemap | L-06 | same. #7620 cites `sitemap-vendors.xml`, this run `sitemap-static.xml`. Both list it. |
| #6 card name ≠ page name, hidden shops shown | L-06 (partly) | the **name mismatch** and the `public_visibility='hidden'` reading are new here |
| #7 owner's real event on `/` | L-01, L-02 | same; #7620 adds presigned private-bucket URLs and `index, follow` |
| #20 doubled "· Setnayan" titles | L-11, L-12 | same |
| #21 "vendor" in blog/start/realstories | L-07 | same |
| #13 `/sample` 404 | L-21 | adds the stale title "Maria and Jose — a sample event" |
| #9/#14/#16/#18 vs L-09/L-14/L-17/L-18 | — | different angles of `/features`, speed and layout |

**New in this report (not in #7620):** #1 the `/for-suppliers` "See a real shop" link to `/v/setnayan-production` is a 404 ·
#3 Setnayan AI "From ₱265" against "not sold on its own" · #4 Papic "from ₱499" against "from ₱99" · #8 the /pricing
tour blocks the ☰ menu · #9 developer copy on /features · #10 Event Ultra missing on /features · #11 "priced in the
live catalogue" · #12 the top-level 404 titled "Setnayan supplier" · #14 tap targets · #17 Escape does not close the
shop sheet · #19 the private test event answers two different ways · 1280 px coverage.

### Slow first load (> 3 s)

During the crawl (4 pages loading in parallel plus a second crawl running), 76 loads went over 3 s. **Most of
that was my own load on the site.** Re-measured afterwards, one page at a time, twice each (time to first
byte / first contentful paint, in ms):

| Page | 390 px | 1280 px | Verdict |
|---|---|---|---|
| `/testnayanw1lights/welcome` | 3038/3364 → 2634/2800 | 2529/2824 → 2924/3268 | **consistently ~3 s.** Slowest page found. |
| `/flowerstoreph`, `/rondomusical`, `/setnaprod` (top-level shop slugs) | 1.6–2.1 s / 1.9–2.4 s | 1.4–1.8 s / 1.7–2.1 s | slow first byte, under 3 s |
| `/ana-ben`, `/wanda-indigo`, `/maria-and-jose` (events) | 0.9–1.8 s cold → 0.1–0.4 s warm | similar | cold-start only. **During the crawl `/ana-ben` measured 4.2–6.0 s to first byte**, so a cold event page *can* go past 3 s. |
| `/`, `/pricing`, `/marketplace`, `/v/setnaprod`, `/explore` | ≤ 1.7 s | ≤ 1.8 s | fine |

During the crawl, the four `/testnayanw1lights/*` **404 pages** had first paint at 11–12 s while their first byte was
under 1 s. Not reproduced when measured alone (1.3 s). Recorded only.

### Checked and found fine
- **No 500s and no error text** ("Something went wrong", "undefined", "NaN", "[object …]") on any of the 479 paths.
- **No horizontal page scroll** at 390 px or 1280 px on any page. The only overflow measured is #16.
- **Every in-page anchor** on `/help`, `/features`, `/pricing`, `/about` and the legal pages points at an id that exists.
- **Couple plan names** are "Event Plus / Event Pro / Event Ultra" on `/`, `/pricing`, `/about` and `/help`, apart from #10. **Supplier plans** are "Supplier Plus / Pro / Ultra" on `/for-suppliers` and `/for-coordinators`.
- **Prices agree across pages:** Event Plus ₱2,990 · Event Pro ₱5,690 · Event Ultra ₱9,990 (`/`, `/features`, `/pricing`); Live Watch ₱1,990; Music Maker ₱2,990; Patiktok ₱2,490 a day; supplier plans ₱990 / ₱2,490 / ₱5,990 every 4 weeks and ₱9,900 / ₱24,900 / ₱59,900 a year; booking-fee example (₱300,000 → ₱7,000). The exceptions are #3 and #4.
- Gated routes signed out (`/proposals/…`, `/pay/…`, `/open-shop/logo`) redirect to `/login`. Expired demo links (`/papic/demo/x`, `/panood/demo/x`, `/3d_plan/demo/x`) say "This demo link expired."

---

## Every page visited

Status at 390 px · status at 1280 px (`→` = redirected to). Event sub-paths were probed for
`ana-ben`, `wanda-indigo`, `debut-18`, `rosa-ben`, `lola-turns-5`, `kessa-guia-juda`, `cale-ice` (the owner's
event: GET only, nothing pressed) and the private test event `test-w1-get-together`. `/blog/*`, `/help/*`,
`/features/*`, `/realstories/*` and `/tl/*` are every URL in the sitemap.

| Path | 390 | 1280 |
|---|---|---|
| `/` | 200 | 200 |
| `/3d_plan/demo/x` | 200 | 200 |
| `/about` | 200 | 200 |
| `/acceptable-use` | 200 | 200 |
| `/alaala` | 200 | 200 |
| `/ana-ben` | 200 | 200 |
| `/ana-ben/avatar` | 200 → /ana-ben | 200 → /ana-ben |
| `/ana-ben/everyone` | 200 | 200 |
| `/ana-ben/find-my-table` | 200 | 200 |
| `/ana-ben/find-seat` | 200 | 200 |
| `/ana-ben/hub` | 200 → /ana-ben | 200 → /ana-ben |
| `/ana-ben/invite` | 200 → /ana-ben | 200 → /ana-ben |
| `/ana-ben/invite/enter` | 200 → /ana-ben | 200 → /ana-ben |
| `/ana-ben/pabuya` | 200 | 200 |
| `/ana-ben/print` | 200 → /ana-ben | 200 → /ana-ben |
| `/ana-ben/recap` | 200 → /ana-ben?story=later | 200 → /ana-ben?story=later |
| `/ana-ben/request` | 200 → /ana-ben | 200 → /ana-ben |
| `/ana-ben/seat` | 200 | 200 |
| `/ana-ben/venue` | 200 | 200 |
| `/ana-ben/welcome` | 200 → /ana-ben | 200 → /ana-ben |
| `/blog` | 200 | 200 |
| `/blog/aglipayan-wedding-overview` | 200 | 200 |
| `/blog/average-wedding-cost-philippines-2026` | 200 | 200 |
| `/blog/ber-months-wedding-season-book-early` | 200 | 200 |
| `/blog/best-months-to-get-married-philippines` | 200 | 200 |
| `/blog/born-again-christian-wedding-philippines` | 200 | 200 |
| `/blog/brownout-power-contingency-wedding` | 200 | 200 |
| `/blog/buffet-vs-plated-vs-family-style-wedding` | 200 | 200 |
| `/blog/catholic-wedding-requirements-philippines` | 200 | 200 |
| `/blog/chinese-filipino-wedding-tea-ceremony` | 200 | 200 |
| `/blog/christmas-themed-wedding-ideas-philippines` | 200 | 200 |
| `/blog/civil-vs-church-wedding-philippines` | 200 | 200 |
| `/blog/cord-veil-coins-wedding-meaning` | 200 | 200 |
| `/blog/december-wedding-philippines-guide` | 200 | 200 |
| `/blog/despedida-de-soltera-explained` | 200 | 200 |
| `/blog/digital-invitations-online-rsvp-wedding` | 200 | 200 |
| `/blog/drone-coverage-wedding-philippines` | 200 | 200 |
| `/blog/engaged-over-christmas-first-steps` | 200 | 200 |
| `/blog/filipino-wedding-entourage-guide-ninong-ninang-sponsors` | 200 | 200 |
| `/blog/filipino-wedding-gift-etiquette-cash` | 200 | 200 |
| `/blog/filipino-wedding-superstitions-pamahiin` | 200 | 200 |
| `/blog/filipino-wedding-traditions-explained` | 200 | 200 |
| `/blog/food-carts-late-night-snacks-wedding` | 200 | 200 |
| `/blog/free-printable-wedding-checklist-philippines` | 200 | 200 |
| `/blog/hidden-wedding-costs-couples-forget` | 200 | 200 |
| `/blog/holiday-proposal-ideas-philippines` | 200 | 200 |
| `/blog/holiday-season-vendor-booking-crunch` | 200 | 200 |
| `/blog/how-much-do-wedding-suppliers-cost-philippines` | 200 | 200 |
| `/blog/how-to-ask-someone-to-be-ninong-ninang` | 200 | 200 |
| `/blog/how-to-choose-a-wedding-caterer-philippines` | 200 | 200 |
| `/blog/how-to-choose-a-wedding-photographer-philippines` | 200 | 200 |
| `/blog/how-to-choose-a-wedding-venue-philippines` | 200 | 200 |
| `/blog/how-to-handle-wedding-rsvps` | 200 | 200 |
| `/blog/how-to-make-a-wedding-guest-list-philippines` | 200 | 200 |
| `/blog/how-to-save-money-on-your-wedding-philippines` | 200 | 200 |
| `/blog/how-to-set-a-wedding-budget-philippines` | 200 | 200 |
| `/blog/how-to-trim-your-wedding-guest-list` | 200 | 200 |
| `/blog/iglesia-ni-cristo-wedding-overview` | 200 | 200 |
| `/blog/ilocano-wedding-traditions` | 200 | 200 |
| `/blog/intimate-wedding-vs-big-wedding-cost` | 200 | 200 |
| `/blog/marriage-license-requirements-philippines` | 200 | 200 |
| `/blog/mixed-faith-wedding-philippines` | 200 | 200 |
| `/blog/mobile-bar-wedding-philippines` | 200 | 200 |
| `/blog/money-dance-filipino-wedding` | 200 | 200 |
| `/blog/muslim-moro-wedding-philippines` | 200 | 200 |
| `/blog/name-change-after-marriage-philippines` | 200 | 200 |
| `/blog/new-year-wedding-planning-kickoff` | 200 | 200 |
| `/blog/new-years-eve-wedding-philippines` | 200 | 200 |
| `/blog/nope` | 404 | 404 |
| `/blog/pamamanhikan-explained` | 200 | 200 |
| `/blog/prenup-engagement-shoot-guide-philippines` | 200 | 200 |
| `/blog/psa-marriage-certificate-how-to-get` | 200 | 200 |
| `/blog/questions-to-ask-your-wedding-photographer` | 200 | 200 |
| `/blog/rainy-season-wedding-philippines` | 200 | 200 |
| `/blog/release-of-doves-filipino-wedding` | 200 | 200 |
| `/blog/save-the-dates-when-and-how-philippines` | 200 | 200 |
| `/blog/simbang-gabi-and-december-weddings` | 200 | 200 |
| `/blog/unity-candle-ceremony-wedding` | 200 | 200 |
| `/blog/visayan-cebuano-wedding-traditions` | 200 | 200 |
| `/blog/wedding-budget-breakdown-philippines` | 200 | 200 |
| `/blog/wedding-cake-guide-philippines` | 200 | 200 |
| `/blog/wedding-florist-styling-guide-philippines` | 200 | 200 |
| `/blog/wedding-food-tasting-what-to-ask` | 200 | 200 |
| `/blog/wedding-invitation-wording-etiquette-philippines` | 200 | 200 |
| `/blog/wedding-lights-and-sounds-guide` | 200 | 200 |
| `/blog/wedding-payment-schedule-deposits-explained` | 200 | 200 |
| `/blog/wedding-photo-deliverables-explained` | 200 | 200 |
| `/blog/wedding-photographer-vs-videographer-philippines` | 200 | 200 |
| `/blog/wedding-seating-plan-guide-philippines` | 200 | 200 |
| `/blog/wedding-videography-styles-philippines` | 200 | 200 |
| `/blog/wedding-wet-weather-contingency-plan` | 200 | 200 |
| `/blog/what-is-a-same-day-edit-sde-wedding` | 200 | 200 |
| `/blog/what-to-do-12-months-before-your-philippine-wedding` | 200 | 200 |
| `/blog/what-zero-commission-means-for-couples` | 200 | 200 |
| `/blog/why-wedding-planning-should-be-free` | 200 | 200 |
| `/budget` | 200 | 200 |
| `/cale-ice` | 200 | 200 |
| `/cale-ice/avatar` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/everyone` | 200 | 200 |
| `/cale-ice/find-my-table` | 200 | 200 |
| `/cale-ice/find-seat` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/hub` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/invite` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/invite/enter` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/pabuya` | 200 | 200 |
| `/cale-ice/print` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/recap` | 200 → /cale-ice?story=later | 200 → /cale-ice?story=later |
| `/cale-ice/request` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/seat` | 200 → /cale-ice | 200 → /cale-ice |
| `/cale-ice/venue` | 200 | 200 |
| `/cale-ice/welcome` | 200 → /cale-ice | 200 → /cale-ice |
| `/contact` | 404 | 404 |
| `/cookies` | 200 | 200 |
| `/creators` | 200 | 200 |
| `/debut-18` | 200 | 200 |
| `/debut-18/avatar` | 200 → /debut-18 | 200 → /debut-18 |
| `/debut-18/everyone` | 200 | 200 |
| `/debut-18/find-my-table` | 200 | 200 |
| `/debut-18/find-seat` | 200 | 200 |
| `/debut-18/hub` | 200 → /debut-18 | 200 → /debut-18 |
| `/debut-18/invite` | 200 | 200 |
| `/debut-18/invite/enter` | 200 → /debut-18 | 200 → /debut-18 |
| `/debut-18/pabuya` | 200 | 200 |
| `/debut-18/print` | 200 → /debut-18 | 200 → /debut-18 |
| `/debut-18/recap` | 200 → /debut-18?story=later | 200 → /debut-18?story=later |
| `/debut-18/request` | 200 → /debut-18 | 200 → /debut-18 |
| `/debut-18/seat` | 200 | 200 |
| `/debut-18/venue` | 200 | 200 |
| `/debut-18/welcome` | 200 → /debut-18 | 200 → /debut-18 |
| `/download` | 200 | 200 |
| `/explore` | 200 → / | 200 → / |
| `/explore/compare` | 200 → /?browse=1 | 200 → /?browse=1 |
| `/faq` | 404 | 404 |
| `/features` | 200 | 200 |
| `/features/3d-plan` | 200 | 200 |
| `/features/alaala` | 200 | 200 |
| `/features/budget` | 200 | 200 |
| `/features/compare` | 200 | 200 |
| `/features/date-picker` | 200 | 200 |
| `/features/dress-code` | 200 | 200 |
| `/features/e-gifts` | 200 | 200 |
| `/features/event-hub` | 200 | 200 |
| `/features/groups` | 200 | 200 |
| `/features/guest-list` | 200 | 200 |
| `/features/live-watch` | 200 | 200 |
| `/features/logo-maker` | 200 | 200 |
| `/features/marketplace` | 200 | 200 |
| `/features/mood-board` | 200 | 200 |
| `/features/music-maker` | 200 | 200 |
| `/features/nope` | 404 | 404 |
| `/features/papic` | 200 | 200 |
| `/features/patiktok` | 200 | 200 |
| `/features/prints` | 200 | 200 |
| `/features/real-stories` | 200 | 200 |
| `/features/schedule` | 200 | 200 |
| `/features/seat-plan` | 200 | 200 |
| `/features/setnayan-ai` | 200 | 200 |
| `/features/suppliers` | 200 | 200 |
| `/features/wedding-march` | 200 | 200 |
| `/flowerstoreph` | 200 | 200 |
| `/for-coordinators` | 200 | 200 |
| `/for-suppliers` | 200 | 200 |
| `/forgot-password` | 200 | 200 |
| `/guest-list` | 200 | 200 |
| `/help` | 200 | 200 |
| `/help/add-guest-roles` | 200 | 200 |
| `/help/add-your-face` | 200 | 200 |
| `/help/best-free-filipino-wedding-planner-app` | 200 | 200 |
| `/help/budget-line-items` | 200 | 200 |
| `/help/build-your-online-presence` | 200 | 200 |
| `/help/cookies` | 200 | 200 |
| `/help/create-an-event` | 200 | 200 |
| `/help/create-your-youtube-live-link` | 200 | 200 |
| `/help/data-export` | 200 | 200 |
| `/help/delete-account` | 200 | 200 |
| `/help/does-setnayan-have-mobile-app` | 200 | 200 |
| `/help/does-setnayan-support-filipino-customs` | 200 | 200 |
| `/help/does-setnayan-take-commission` | 200 | 200 |
| `/help/dress-code-by-role` | 200 | 200 |
| `/help/event-hub-pro-parts` | 200 | 200 |
| `/help/event-id-vs-slug` | 200 | 200 |
| `/help/event-plus-and-event-pro` | 200 | 200 |
| `/help/export-calendar` | 200 | 200 |
| `/help/find-download-papic-photos` | 200 | 200 |
| `/help/find-your-table` | 200 | 200 |
| `/help/free-alternative-to-wedding-website-builders` | 200 | 200 |
| `/help/free-seating-plan-and-budget-in-pesos` | 200 | 200 |
| `/help/guest-list-with-ninongs-and-ninangs` | 200 | 200 |
| `/help/guests-without-smartphones` | 200 | 200 |
| `/help/help-me-choose-a-date` | 200 | 200 |
| `/help/how-are-vendors-verified` | 200 | 200 |
| `/help/how-does-setnayan-handle-privacy` | 200 | 200 |
| `/help/how-much-does-setnayan-cost` | 200 | 200 |
| `/help/how-papic-shots-work` | 200 | 200 |
| `/help/how-papic-tagging-works` | 200 | 200 |
| `/help/how-papic-works` | 200 | 200 |
| `/help/how-to-contact-support` | 200 | 200 |
| `/help/how-to-get-bir-2303` | 200 | 200 |
| `/help/how-to-get-dti-sec-registration` | 200 | 200 |
| `/help/how-to-get-mayors-permit` | 200 | 200 |
| `/help/how-to-order` | 200 | 200 |
| `/help/how-to-prepare-bank-account-proof` | 200 | 200 |
| `/help/identity-masking` | 200 | 200 |
| `/help/import-csv` | 200 | 200 |
| `/help/invitation-site` | 200 | 200 |
| `/help/is-my-youtube-ready-to-live-stream` | 200 | 200 |
| `/help/is-setnayan-free-for-couples` | 200 | 200 |
| `/help/live-schedule` | 200 | 200 |
| `/help/live-stream-dry-run` | 200 | 200 |
| `/help/lost-invite-link` | 200 | 200 |
| `/help/loved-ones` | 200 | 200 |
| `/help/maker-event-date` | 200 | 200 |
| `/help/maker-locked-tab` | 200 | 200 |
| `/help/many-guests-uploading-photos-at-once` | 200 | 200 |
| `/help/meal-preference` | 200 | 200 |
| `/help/memories` | 200 | 200 |
| `/help/monogram` | 200 | 200 |
| `/help/nope` | 404 | 404 |
| `/help/one-account-shop-and-events` | 200 | 200 |
| `/help/palette-chip-dot` | 200 | 200 |
| `/help/palette-tiers` | 200 | 200 |
| `/help/papic-crew-how-to-shoot` | 200 | 200 |
| `/help/papic-giving-a-camera-its-own-shots` | 200 | 200 |
| `/help/papic-guest-camera` | 200 | 200 |
| `/help/payment-instructions` | 200 | 200 |
| `/help/people-page` | 200 | 200 |
| `/help/photo-wall` | 200 | 200 |
| `/help/photos-of-you` | 200 | 200 |
| `/help/plan-a-debut-christening-or-other-event` | 200 | 200 |
| `/help/plus-ones` | 200 | 200 |
| `/help/print-qr-sheet` | 200 | 200 |
| `/help/reference-code` | 200 | 200 |
| `/help/refunds` | 200 | 200 |
| `/help/reissue-qr` | 200 | 200 |
| `/help/rsvp-from-link` | 200 | 200 |
| `/help/scan-qr-code` | 200 | 200 |
| `/help/setnayan-vs-free-apps-and-google-sheets` | 200 | 200 |
| `/help/share-invite-link` | 200 | 200 |
| `/help/share-wedding-photos-with-guests-automatically` | 200 | 200 |
| `/help/sign-up-as-couple` | 200 | 200 |
| `/help/sign-up-as-vendor` | 200 | 200 |
| `/help/start-thread-with-vendor` | 200 | 200 |
| `/help/supplier-dashboard-tabs` | 200 | 200 |
| `/help/switch-between-your-places` | 200 | 200 |
| `/help/the-bar-at-the-bottom` | 200 | 200 |
| `/help/theme` | 200 | 200 |
| `/help/track-vendor` | 200 | 200 |
| `/help/turn-on-papic` | 200 | 200 |
| `/help/vendor-reply-only` | 200 | 200 |
| `/help/venue-pin` | 200 | 200 |
| `/help/verified-filipino-wedding-vendors-no-commission` | 200 | 200 |
| `/help/what-do-suppliers-pay-setnayan` | 200 | 200 |
| `/help/what-if-the-venue-has-no-signal` | 200 | 200 |
| `/help/what-is-pakanta` | 200 | 200 |
| `/help/what-is-pakulay` | 200 | 200 |
| `/help/what-is-panood` | 200 | 200 |
| `/help/what-is-papic` | 200 | 200 |
| `/help/what-is-setnayan` | 200 | 200 |
| `/help/what-is-todays-focus` | 200 | 200 |
| `/help/what-languages-does-setnayan-support` | 200 | 200 |
| `/help/what-search-finds` | 200 | 200 |
| `/help/what-to-wear` | 200 | 200 |
| `/help/when-does-setnayan-launch` | 200 | 200 |
| `/help/where-does-setnayan-operate` | 200 | 200 |
| `/help/who-owns-the-live-stream-recording` | 200 | 200 |
| `/help/your-ticket` | 200 | 200 |
| `/kessa-guia-juda` | 200 | 200 |
| `/kessa-guia-juda/avatar` | 200 → /kessa-guia-juda | 200 → /kessa-guia-juda |
| `/kessa-guia-juda/everyone` | 200 | 200 |
| `/kessa-guia-juda/find-my-table` | 200 | 200 |
| `/kessa-guia-juda/find-seat` | 200 | 200 |
| `/kessa-guia-juda/hub` | 200 → /kessa-guia-juda | 200 → /kessa-guia-juda |
| `/kessa-guia-juda/invite` | 200 → /kessa-guia-juda | 200 → /kessa-guia-juda |
| `/kessa-guia-juda/invite/enter` | 200 → /kessa-guia-juda | 200 → /kessa-guia-juda |
| `/kessa-guia-juda/pabuya` | 200 | 200 |
| `/kessa-guia-juda/print` | 200 → /kessa-guia-juda | 200 → /kessa-guia-juda |
| `/kessa-guia-juda/recap` | 200 → /kessa-guia-juda?story=later | 200 → /kessa-guia-juda?story=later |
| `/kessa-guia-juda/request` | 200 → /kessa-guia-juda | 200 → /kessa-guia-juda |
| `/kessa-guia-juda/seat` | 200 | 200 |
| `/kessa-guia-juda/venue` | 200 | 200 |
| `/kessa-guia-juda/welcome` | 200 → /kessa-guia-juda | 200 → /kessa-guia-juda |
| `/live` | 200 | 200 |
| `/live/screen` | 200 → /live | 200 → /live |
| `/login` | 200 | 200 |
| `/lola-turns-5` | 200 | 200 |
| `/lola-turns-5/avatar` | 200 → /lola-turns-5 | 200 → /lola-turns-5 |
| `/lola-turns-5/everyone` | 200 | 200 |
| `/lola-turns-5/find-my-table` | 200 | 200 |
| `/lola-turns-5/find-seat` | 200 | 200 |
| `/lola-turns-5/hub` | 200 → /lola-turns-5 | 200 → /lola-turns-5 |
| `/lola-turns-5/invite` | 200 | 200 |
| `/lola-turns-5/invite/enter` | 200 → /lola-turns-5 | 200 → /lola-turns-5 |
| `/lola-turns-5/pabuya` | 200 | 200 |
| `/lola-turns-5/print` | 200 → /lola-turns-5 | 200 → /lola-turns-5 |
| `/lola-turns-5/recap` | 200 → /lola-turns-5?story=later | 200 → /lola-turns-5?story=later |
| `/lola-turns-5/request` | 200 → /lola-turns-5 | 200 → /lola-turns-5 |
| `/lola-turns-5/seat` | 200 | 200 |
| `/lola-turns-5/venue` | 200 | 200 |
| `/lola-turns-5/welcome` | 200 → /lola-turns-5 | 200 → /lola-turns-5 |
| `/maria-and-jose` | 200 | 200 |
| `/marketplace` | 200 | 200 |
| `/monogram` | 200 | 200 |
| `/mood-board` | 200 | 200 |
| `/onboarding/wedding` | 200 | 200 |
| `/open-shop` | 200 | 200 |
| `/open-shop/logo` | 200 → /login?next=%2Fopen-shop%2Flogo&as=vendor | 200 → /login?next=%2Fopen-shop%2Flogo&as=vendor |
| `/our-story` | 200 | 200 |
| `/pa3d` | 200 | 200 |
| `/pa3d/try` | 200 | 200 |
| `/pakanta` | 200 | 200 |
| `/palogo` | 200 | 200 |
| `/panood` | 200 | 200 |
| `/panood/demo/x` | 200 | 200 |
| `/papic` | 200 | 200 |
| `/papic/decorate` | 200 | 200 |
| `/papic/demo/x` | 200 | 200 |
| `/papic/guest` | 200 | 200 |
| `/papic/lightcheck` | 200 | 200 |
| `/papic/pool` | 200 | 200 |
| `/papic/try` | 200 | 200 |
| `/patiktok` | 200 | 200 |
| `/pawebsite` | 200 | 200 |
| `/pay/TEST` | 200 → /login?next=%2Fpay%2FTEST | 200 → /login?next=%2Fpay%2FTEST |
| `/pricing` | 200 | 200 |
| `/pricing/plan` | 200 | 200 |
| `/privacy` | 200 | 200 |
| `/privacy/google-access` | 200 | 200 |
| `/proposals/S89X-0000000000` | 200 → /login | 200 → /login |
| `/realstories` | 200 | 200 |
| `/realstories/aling-nena-marikina-tenth-year` | 200 | 200 |
| `/realstories/andres-villanueva-lipa-paalam` | 200 | 200 |
| `/realstories/barangay-liga-cebu-finals` | 200 | 200 |
| `/realstories/barkada-movie-night-quezon-city` | 200 | 200 |
| `/realstories/bayanihan-tech-makati-year-end` | 200 | 200 |
| `/realstories/bea-aquino-quezon-city-graduation` | 200 | 200 |
| `/realstories/dela-cruz-family-cebu-reunion` | 200 | 200 |
| `/realstories/jack-and-jill-cebu-beach-wedding` | 200 | 200 |
| `/realstories/jack-and-rose-baguio-forest-wedding` | 200 | 200 |
| `/realstories/john-and-jane-manila-rooftop-wedding` | 200 | 200 |
| `/realstories/lolo-tony-laguna-80th-birthday` | 200 | 200 |
| `/realstories/maria-and-juan-tagaytay-garden-wedding` | 200 | 200 |
| `/realstories/nica-and-paul-intramuros-date` | 200 | 200 |
| `/realstories/noah-santos-antipolo-christening` | 200 | 200 |
| `/realstories/nope` | 404 | 404 |
| `/realstories/peter-and-mary-tagaytay-estate-wedding` | 200 | 200 |
| `/realstories/ramos-house-blessing-cavite` | 200 | 200 |
| `/realstories/romy-and-beth-pasig-golden-anniversary` | 200 | 200 |
| `/realstories/sofia-reyes-makati-debut` | 200 | 200 |
| `/realstories/tahanan-foundation-pasig-gala` | 200 | 200 |
| `/realstories/the-lims-quezon-city-gender-reveal` | 200 | 200 |
| `/realstories/the-ramos-family-el-nido-trip` | 200 | 200 |
| `/refunds` | 200 | 200 |
| `/reset-password` | 200 | 200 |
| `/rondomusical` | 200 | 200 |
| `/rosa-ben` | 200 | 200 |
| `/rosa-ben/avatar` | 200 → /rosa-ben | 200 → /rosa-ben |
| `/rosa-ben/everyone` | 200 | 200 |
| `/rosa-ben/find-my-table` | 200 | 200 |
| `/rosa-ben/find-seat` | 200 | 200 |
| `/rosa-ben/hub` | 200 | 200 |
| `/rosa-ben/invite` | 200 → /rosa-ben | 200 → /rosa-ben |
| `/rosa-ben/invite/enter` | 200 → /rosa-ben | 200 → /rosa-ben |
| `/rosa-ben/pabuya` | 200 | 200 |
| `/rosa-ben/print` | 200 → /rosa-ben | 200 → /rosa-ben |
| `/rosa-ben/recap` | 200 → /rosa-ben?story=later | 200 → /rosa-ben?story=later |
| `/rosa-ben/request` | 200 → /rosa-ben | 200 → /rosa-ben |
| `/rosa-ben/seat` | 200 | 200 |
| `/rosa-ben/venue` | 200 | 200 |
| `/rosa-ben/welcome` | 200 → /rosa-ben | 200 → /rosa-ben |
| `/samahan` | 200 | 200 |
| `/sample` | 404 | 404 |
| `/schedule` | 200 | 200 |
| `/seat-plan` | 200 | 200 |
| `/setnaprod` | 200 | 200 |
| `/setnaprod/hub` | 404 | 404 |
| `/setnaprod/invite` | 404 | 404 |
| `/setnaprod/venue` | 404 | 404 |
| `/setnayan-ai` | 200 | 200 |
| `/signup` | 200 | 200 |
| `/signup/you` | 200 | 200 |
| `/start` | 200 | 200 |
| `/suppliers` | 200 | 200 |
| `/supplies` | 404 | 404 |
| `/terms` | 200 | 200 |
| `/test-w1-get-together` | 200 | 200 |
| `/test-w1-get-together/avatar` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/everyone` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/find-my-table` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/find-seat` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/hub` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/invite` | 404 | 404 |
| `/test-w1-get-together/invite/enter` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/pabuya` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/print` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/recap` | 200 → /test-w1-get-together?story=later | 200 → /test-w1-get-together?story=later |
| `/test-w1-get-together/request` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/seat` | 200 | 200 |
| `/test-w1-get-together/venue` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/test-w1-get-together/welcome` | 200 → /test-w1-get-together | 200 → /test-w1-get-together |
| `/testnayanw1lights` | 200 | 200 |
| `/testnayanw1lights/everyone` | 404 | 404 |
| `/testnayanw1lights/find-my-table` | 404 | 404 |
| `/testnayanw1lights/hub` | 404 | 404 |
| `/testnayanw1lights/invite` | 404 | 404 |
| `/testnayanw1lights/recap` | 200 → /testnayanw1lights?story=later | 200 → /testnayanw1lights?story=later |
| `/testnayanw1lights/venue` | 404 | 404 |
| `/testnayanw1lights/welcome` | 200 → /testnayanw1lights | 200 → /testnayanw1lights |
| `/this-page-does-not-exist-404` | 404 | 404 |
| `/tl/about` | 200 | 200 |
| `/tl/features` | 200 | 200 |
| `/tl/features/3d-plan` | 200 | 200 |
| `/tl/features/alaala` | 200 | 200 |
| `/tl/features/budget` | 200 | 200 |
| `/tl/features/compare` | 200 | 200 |
| `/tl/features/date-picker` | 200 | 200 |
| `/tl/features/dress-code` | 200 | 200 |
| `/tl/features/e-gifts` | 200 | 200 |
| `/tl/features/event-hub` | 200 | 200 |
| `/tl/features/groups` | 200 | 200 |
| `/tl/features/guest-list` | 200 | 200 |
| `/tl/features/live-watch` | 200 | 200 |
| `/tl/features/logo-maker` | 200 | 200 |
| `/tl/features/marketplace` | 200 | 200 |
| `/tl/features/mood-board` | 200 | 200 |
| `/tl/features/music-maker` | 200 | 200 |
| `/tl/features/papic` | 200 | 200 |
| `/tl/features/patiktok` | 200 | 200 |
| `/tl/features/prints` | 200 | 200 |
| `/tl/features/real-stories` | 200 | 200 |
| `/tl/features/schedule` | 200 | 200 |
| `/tl/features/seat-plan` | 200 | 200 |
| `/tl/features/setnayan-ai` | 200 | 200 |
| `/tl/features/suppliers` | 200 | 200 |
| `/tl/features/wedding-march` | 200 | 200 |
| `/tour` | 200 | 200 |
| `/tour/budget` | 200 | 200 |
| `/tour/gallery` | 200 | 200 |
| `/tour/seating` | 200 | 200 |
| `/tour/vendors` | 200 | 200 |
| `/u/ana-at-marco` | 200 | 200 |
| `/u/ana-at-marco/c/S89C-CK46HS1VSS` | 200 | 200 |
| `/u/iscasasolaii` | 200 | 200 |
| `/u/iscasasolaii/cale-ice` | 200 | 200 |
| `/u/iscasasolaii/maria-and-jose` | 200 | 200 |
| `/u/nobody` | 404 | 404 |
| `/v/flowerstoreph` | 200 | 200 |
| `/v/flowerstoreph/booth` | 404 | 404 |
| `/v/flowerstoreph/dates` | 404 | 404 |
| `/v/flowerstoreph/guest-review` | 200 | 200 |
| `/v/setnaprod` | 200 | 200 |
| `/v/setnaprod/booth` | 404 | 404 |
| `/v/setnaprod/dates` | 200 | 200 |
| `/v/setnaprod/guest-review` | 200 | 200 |
| `/v/setnayan-production` | 404 | 404 |
| `/v/setnayan-weddings` | 404 | 404 |
| `/v/testnayanw1lights` | 200 | 200 |
| `/v/testnayanw1lights/booth` | 404 | 404 |
| `/v/testnayanw1lights/dates` | 200 | 200 |
| `/v/testnayanw1lights/guest-review` | 200 | 200 |
| `/vendor` | 404 | 404 |
| `/vendors` | 200 → /for-suppliers | 200 → /for-suppliers |
| `/waitlist` | 200 | 200 |
| `/wall/1` | 200 | 200 |
| `/wanda-indigo` | 200 | 200 |
| `/wanda-indigo/avatar` | 200 → /wanda-indigo | 200 → /wanda-indigo |
| `/wanda-indigo/everyone` | 200 | 200 |
| `/wanda-indigo/find-my-table` | 200 | 200 |
| `/wanda-indigo/find-seat` | 200 | 200 |
| `/wanda-indigo/hub` | 200 → /wanda-indigo | 200 → /wanda-indigo |
| `/wanda-indigo/invite` | 200 → /wanda-indigo | 200 → /wanda-indigo |
| `/wanda-indigo/invite/enter` | 200 → /wanda-indigo | 200 → /wanda-indigo |
| `/wanda-indigo/pabuya` | 200 | 200 |
| `/wanda-indigo/print` | 200 → /wanda-indigo | 200 → /wanda-indigo |
| `/wanda-indigo/recap` | 200 → /wanda-indigo?story=later | 200 → /wanda-indigo?story=later |
| `/wanda-indigo/request` | 200 → /wanda-indigo | 200 → /wanda-indigo |
| `/wanda-indigo/seat` | 200 | 200 |
| `/wanda-indigo/venue` | 200 | 200 |
| `/wanda-indigo/welcome` | 200 → /wanda-indigo | 200 → /wanda-indigo |
| `/web-only` | 200 | 200 |
