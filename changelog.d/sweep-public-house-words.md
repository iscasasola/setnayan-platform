## 2026-10-19 · fix(public-copy): "supplier", "Event Hub" and "event" on the public pages; Live Watch is Live on /pricing

Quality sweep 2026-10-19, batch 6 (rows B6, B7, B8, B9).

- **B9 — "vendor" → "supplier"** in what a stranger reads: /explore (hero, filters,
  folder previews, "View supplier", availability banner, empty states, compare),
  /about and /tl/about, /creators (×6 incl. "View supplier"), /pricing (×7, incl.
  "For suppliers"), /waitlist (×5), /realstories "Browse suppliers", and the blog
  category label "Suppliers" (the `vendors` category KEY and its URLs are unchanged).
- **B8 — "website"/"site" → "Event Hub"** (or, for a supplier's own public page,
  "Setnayan page" — the name the supplier dashboard already uses): /for-suppliers
  (×6 incl. its metadata and Pro plan offer), /monogram, /features "right on your
  Event Hub" (en + tl), /waitlist "Event Hub at setnayan.com/your-slug", and the Home
  overlays ("Free Event Hub", "Free Setnayan page for your business"). /waitlist also
  stopped promising a "free vendor subdomain at slug.setnayan.com" — subdomains
  resolve nowhere (EVENT_SUBDOMAIN was retired for exactly that).
- **B6 — `PAPIC_FREE_CREDIT_CONDITION` = "on your first event"** (was "on your first
  celebration"). Same meaning: `papic_claim_free_pool` arbitrates on
  `ON CONFLICT (user_id) DO NOTHING`, so the full pool comes once per ACCOUNT, on its
  first event. Reaches /papic, /help, /about and llms.txt through the constant; the
  pinned test and the help guard's old exemption follow. The Home Papic demo's
  closing line says "your first event" too.
- **B7 — Live Watch is chipped "Live" on /pricing.** `LIVE_STUDIO` was `'partial'`
  ("In build") in `BUILD_STATUS` with a "bump to 'live' at launch" note, while
  /features/live-watch sold it at the catalogue price. Launch has happened: the launch
  switch `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is on in production (that is the only
  way the row reaches /pricing), the row is active, and prod had 2 verified channels and
  2 aired streams (read 2026-10-19). `MOODBOARD_RENDER_PACK` (missing → "Coming soon")
  and the Papic ladder rungs (missing → schema.org `PreOrder` in /pricing's structured
  data) now resolve to `'live'` as well, through the new `customerSkuBuildStatus()`.
- **Catalogue copy** (migration `20271279041541_catalog_descriptions_say_event`): the
  LIVE_STUDIO and PAPIC_GUEST* descriptions said "Your celebration, streamed live…" and
  "the celebration's shared pot". Data-only `replace()` of the one word, so admin edits
  to those rows survive. No price moves.
- **Guards.** `app/public-copy-says-the-house-words.test.ts` reads the public copy
  modules with the TypeScript parser (`lib/public-copy-strings.ts`: JSX text and
  string literals, never imports, unread attributes, keys, types or machine tokens) and
  fails on "vendor", "website", or "your/our/event… site"; three phrase-exact
  allowances, each with its reason, and a stale allowance fails too.
  `app/features/a-sold-feature-is-not-in-build.test.ts`: every SKU a feature page
  prices is `'live'` in `BUILD_STATUS`. Both sabotaged red, restored green.

Not changed, deliberately: the legal pages (privacy, terms, refunds, cookies,
acceptable-use) still say "vendor" and "event website" — legal text with its own
review, the carve-out `product-pages-say-what-ships.test.ts` already makes. Blog article
bodies, llms.txt and the creator chapter pages also still say "vendor" (outside this
batch).

SPEC IMPACT: None — applies existing owner rulings (house words 2026-09-24 / 2026-10-04;
Live Watch rename d2 2026-10-02). The Live Watch "Live" chip states a fact read from
production, not a new ruling.
