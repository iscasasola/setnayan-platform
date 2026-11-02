## 2026-09-26 · fix(geo): the pages answer engines quote now say what ships

A GEO audit checked what setnayan.com tells ChatGPT / Perplexity / Gemini / Claude
against shipped code. Our own pages disagreed with the product, and with each
other. An engine that finds two answers on one domain trusts neither.

- **Role count.** "20 Filipino role tiers" in `lib/help.ts`, `lib/llms-txt.ts` and
  `lib/blog.ts` is now "more than 30 Filipino ceremony roles". `GuestRole` has 35
  values, including four Nikah roles. No exact number is used because counts rot.
- **3D Plan is free.** `/pa3d`'s featureList still said "the 3D walk is the upgrade"
  three weeks after `SEATING_3D` joined `FREE_FOR_ALL_SKUS` (owner 2026-09-05). The
  docblock, the featureList, the FAQ and the shared `studio-apps` description now say
  it is free.
- **`/vendors` stopped promising "0% commission while we launch".** It was still in
  production four days after the booking fee went live (measured on the live page
  today). The metadata and the Solo Offer now use `supplierCommissionShort()` /
  `supplierCommissionPromise()`, the wording production already renders elsewhere
  ("bills you a booking fee of 5% of the first ₱100,000, then 1%, minimum ₱50…").
  `app/vendors/page.tsx` joins `SUPPLIER_SURFACES`.
- **`/llms.txt` names the booking fee to suppliers.** Five supplier-facing lines said
  "no per-lead fee, no listing fee, 0% commission" and never mentioned the fee. One
  sentence is now derived from `bookingFeeScheduleSummary()` + `FREE_BOOKING_LIMIT`
  and gated on `isBookingFeeEnabled()`. `lib/llms-txt.ts` joins `SUPPLIER_SURFACES`.
  Couple-facing lines keep the unqualified zero (owner ruling 2026-09-22).
- **Help "About Setnayan"** (the top of the site's main FAQPage JSON-LD) had three
  false answers. "What is Setnayan?" said event types would unlock later; all are
  live. "Is it free?" listed the Event Hub as paid; it is free, with unlimited RSVP.
  "Commission?" listed revenue sources without the booking fee, on a topic shown to
  suppliers. All three were rewritten, with no peso figures (help guard).
- **`/pawebsite` stops calling the Event Hub a website** (owner 2026-09-24). The FAQ,
  the steps, the spotlights and the JSON-LD `name` now say Event Hub. The title keeps
  the search phrase only as the category it replaces: "Event Hub — the free
  alternative to a wedding website". `keywords` are untouched.
- **Organization JSON-LD** (root layout) said "wedding platform" while the homepage
  said "life-events platform". It is aligned to the homepage wording, with no
  event-type count.

Added, from the same audit (owner: "apply the schema directly into the codebase"):
- **Homepage `SoftwareApplication.featureList`** refreshed against shipped code. It now
  lists no guest limit, 30+ ceremony roles, free RSVP with a QR per guest (the
  2026-06-13 "RSVP is a paid SKU" note is retired), free 3D Plan, the block-by-block
  schedule, the Event Hub (free, unlimited RSVP), Samahan, and how suppliers are
  verified. "No guest limit" was measured: nothing in the guest code caps a list,
  while the Philippine rivals' free tiers stop at 30–50 guests. Patiktok is left out
  on purpose.
- **Seven GEO answers as help articles** (`lib/help.ts`, About Setnayan). Each gets
  `/help/<slug>`, a sitemap entry and a place in `/help`'s FAQPage with no new
  mechanism. They cover: best free Filipino planner · ninong/ninang guest list · free
  seat plan + budget in pesos · verified suppliers with no commission · sharing photos
  with guests · a free alternative to paid wedding website builders · debuts,
  christenings and other events. The Papic answer says free credits come "on your
  first celebration", never per event.
- The stale `₱100,000` declaration for `app/vendors/page.tsx` is retired from
  `lib/public-price-literals.ts`. The figure is derived there now.

Guards, each sabotage-checked RED:
- `the-hub-never-says-website.test.ts` now reads `/pawebsite`, with exactly two
  carve-outs (the keywords and the "alternative to" phrase).
- `llms-txt.test.ts` asserts on the RENDERED file that the supplier section states the
  fee when it is on, and says "no fee" when it is off. Why this is needed: the
  source-level guard stayed green when every use of the fee sentence was deleted,
  because the helper call in the definition still matched.

Deliberately untouched: Patiktok copy (the owner must choose booth or reel) and every
face-matching claim.

SPEC IMPACT: None. Copy is aligned to existing rulings (2026-09-05 3D Plan free,
2026-09-22 booking-fee wording, 2026-09-24 Event Hub naming). No decision changed.
