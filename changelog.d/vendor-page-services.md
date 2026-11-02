## 2026-07-01 · feat(vendor-dashboard): reskin My Services to the finalized prototype (editorial palette, live data)

Ported `/vendor-dashboard/services` to the finalized vendor-dashboard prototype
in the editorial `--m-*` palette, wired every value to a LIVE source (nothing
from the mockup is hardcoded). Heading is now "My Services" · "What you sell,
your coverage, and specialist tools." Five prototype sections:

- **1 · Amber tier banner** — "Your tier (Tier) — categories N · team seats N ·
  branches Yes/No · boost N km · answering unlimited\* · bookings/day …" formatted
  entirely from `TIER_CAPS`/`tierCaps()` (`lib/vendor-tier-caps.ts`) for the
  vendor's soft-probed `tier_state`; `TIER_LABEL` for the tier name. No hardcoded
  caps.
- **2 · Explore service-card preview** — a new `ExploreCardPreview` server
  component that renders the vendor's ACTUAL Explore card (the shipped
  `app/explore/_components/vendor-card.tsx` contract: cover photo · Verified/New
  badges · "<Service> by <name> ✓" · ★ rating (n) · "from ₱price" · coverage
  line · recommended-by-N-couples · a review quote · [View Vendor] [Add to Plan])
  in the editorial palette. Name-masking follows tier via
  `resolveVendorDisplayName` + `isTrueNameTier` + `isVendorNameRevealed` — a
  Free/Verified store pre-first-reply shows the anonymized "<Category> · <City>"
  label; the "by <name>" line only appears once revealed. Data: rating +
  review-count from `fetchReviewStats`; the review quote from
  `fetchReviewsForVendorWithCouple`; recommended-couples from
  `countVendorRecommendingCouples`; the cover from the vendor's own
  `vendor_services.primary_photo_r2_key` (→ `r2PublicUrl`) → logo
  (`displayLogoUrl`) → bundled placeholder; "from ₱price" = the lowest ACTIVE
  service starting price. The [View Vendor]/[Add to Plan] buttons are inert
  preview mirrors (this is a preview surface, not a live marketplace card).
  Badges are limited to the two the vendor genuinely holds without a peer pool —
  `verified` (verification_state / public_visibility) + `new` (joined ≤90 days);
  peer-relative Top-Pick/Most-Booked are NOT computed on a single-vendor page.
- **3 · Service coverage** — chips per distinct `vendor_services.category` (the
  vendor's real leaf categories, with a count when a category holds multiple
  listings) + an "Add coverage" affordance that jumps to the category chooser.
- **4 · Your services** — one row per `vendor_service`: category icon + name +
  "from ₱X · flat|+₱Y/guest · assigned to <branch|You>" (flat vs per-pax derived
  from `added_pax_price_php`; branch label from `vendor_branches` when assigned,
  else "You") + an is_active on/off toggle (`toggleVendorServiceActive`). Each
  row keeps a collapsible "Edit details" that preserves EVERY prior control
  (price · crew · added-pax · daily capacity · last-minute window · branch ·
  discount · Setnayan Exclusive perk · comes-with links · Enterprise time slots ·
  payment schedule · delete) — no capability lost. "Add a service" + the empty
  state open the same category chooser, which routes to the guided wizard
  (`/services/new/[category]`) or the inline `?add=` fallback when the wizard
  kill-switch is off.
- **5 · Specialist tools** — category-conditional cards (new
  `lib/vendor-service-tools.ts`) shown only for the vendor's own categories:
  Moodboard designer (photo/video/florist/planner/MUA/hair/gown/decor),
  Song bank & setlist (band/quartet/choir), On-the-day console, Event recaps
  (photo/video). Each links to its already-shipped route.

Server actions in `services/actions.ts` are unchanged. New:
`lib/vendor-service-tools.ts` (category→icon + specialist-tool catalog) and
`services/_components/explore-card-preview.tsx`. All Lucide glyphs used are in
the curated nav-icon allowlist.

Verification: `pnpm run typecheck` clean · `next lint` on the changed files 0
errors · `lint:navicon` + `lint:retired` pass · `next build` compiles the route
and generates all static pages (the terminal failure is the pre-existing
sitemap "Missing SUPABASE env vars" local-build artifact, unrelated).

SPEC IMPACT: None
