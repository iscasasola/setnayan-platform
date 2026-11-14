## 2026-11-13 · copy(public): truth sweep T4 — llms.txt, feature pages, SEO and docs say what ships today

Owner, 13 Nov 2026: every public page, doc and AI file carries no retired names and no typed prices.

- `/llms.txt`: "vendor" → "supplier" throughout; supplier plan names read from `TIER_LABEL` (the cost answer said
  "Solo" and "Pro"); "Free — Explore" → "Free"; the booking-fee sentence now says a couple the supplier brings
  (own invite, own booking QR, own link — `SUPPLIER_BROUGHT_SOURCES`) never carries the fee, and names the launch
  offer only while `launchOfferIsOpen` says it runs, with the admin-edited cap read by the route; the guest-avatar
  claim (flag-dependent) and the false "no avatar maker" line are both dropped; the fallback stub no longer links the
  retired `/explore` door.
  The supplier verification line no longer claims "a short video call" — the shipped flow
  (`verify-section.tsx`) is papers + email proof + a final confirmation the admin schedules.
- `/features` "For suppliers": the group was EMPTY (`suppliers-a.ts`/`suppliers-b.ts` held `[]` since 2026-10-01).
  Six pages written from shipped supplier code, each with `evidence`: Your supplier page · Chats and quotes ·
  Calendar and free dates · Supplier QR codes · Get Verified · Supplier plans (price from
  `vendor_billing_catalog`, `free-plus`). `FEATURES_LASTMOD` → 2026-11-13.
- Blog: the "What 0% commission means" article said "Vendors keep 100% of their booking fee" — rewritten to the
  shipped rule (fee only on Setnayan-introduced couples, first one on us, supplier-brought clients free, rate on
  /for-suppliers); reader-visible "vendor" → "supplier" and Setnayan's "wedding website" → "Event Hub" across
  every batch (slugs, category keys and hrefs untouched); each changed published article gets `updatedAt`
  2026-11-13 so its sitemap `<lastmod>` is honest.
- `sitemap-static.xml`: `/features` and `/tl/features` lastmod → 2026-11-13 (new supplier group on the hub).
- `/for-suppliers` metadata already read names + prices from code; two stale comments (typed "Solo ₱1,000",
  "Solo / Pro / Enterprise") corrected. README tagline no longer says "V1 weddings".
- `/features/supplier-plans` quotes plan prices, so it joins `STORE_SHELL_WEB_ONLY_FEATURE_SLUGS` (the A1 store-shell
  rule, found by `lib/store-shell.test.ts`). `public-copy-is-not-wedding-only.test.ts` no longer REQUIRES llms.txt to
  say "No avatar maker": C5's guest avatar picker exists behind `NEXT_PUBLIC_FIGURE_CHIBI`, so the line was false
  whenever that flag is on. The ban on CLAIMING an avatar maker stays. `lib/ugat/screens.generated.json` regenerated.
- Event Ultra (Controller, 13 Nov, after #7601): llms.txt names all three event plans wherever it lists them — "Event
  Plus, Event Pro and Event Ultra … Setnayan AI comes inside all three" (`AI_INCLUDED_PLAN_SKUS` names `EVENT_ULTRA`),
  an Event Ultra line priced `R('EVENT_ULTRA')` with only what `EVENT_ULTRA_GRANTS` + the row unlock today (Live Watch
  one day, originals kept 12 months; Patiktok stays unlisted, canvas prints are not built), and the storage answer
  says twelve months with Ultra. `EVENT_ULTRA` joins `REQUIRED_RETAIL`; the guard fixture mirrors the
  `20271344860040_event_ultra_plan` row. The AI-not-sold-alone guard is re-pointed to the three-plan sentence.

SPEC IMPACT: None — copy brought in line with shipped code; no decision changed.
