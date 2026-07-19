## 2026-07-01 · feat(vendor-dashboard): build the "My Shop" page to the finalized prototype

Replaced the `/vendor-dashboard/shop` stub with the full storefront page from the
6-menu vendor proto-shell, in the editorial palette (alabaster page, white cards,
obsidian ink, champagne-gold accents, sage-deep for verified/positive). Every
number is wired to a LIVE source (the prototype's figures are illustrative only):

- Hero card (champagne-tint): obsidian initials avatar · Verified line · tier ·
  primary service · city · `setnayan.com/v/<slug>` · a gold conic completeness
  ring (from `businessProfileChecklist`, the 8-item publish gate) · "View as
  couple" → the live `/v/<slug>` page.
- Stat row (4): Profile views this week (`vendor_profile_views` · `viewed_at`
  ≥ start-of-week) · Rating + review count (`fetchReviewStats`) · Saved by
  couples (`count_saves_for_vendor` RPC) · Stories tagged
  (`loadVendorFeaturedStories` ∩ own bookings).
- YOUR SHOP: Profile (completeness % + "1 doc to verify" from
  `fetchHasBusinessDocuments`) · Website (Live/Draft from `business_slug` +
  `isPubliclyVisible`) · Team (`fetchVendorTeam` count) · Branch (1 HQ + active
  `fetchVendorBranches`).
- GET DISCOVERED: Shortlist QR → `/invite` · Locked QR → `/clients`.
- PROOF & REPUTATION: Stories (`loadVendorFeaturedStories`) · Reviews
  (`fetchReviewStats`) · Recap (`loadVendorRecaps` ∩ own bookings).
- YOUR AUDIENCE: Saved by couples (`count_saves_for_vendor`) · Recommend
  (accepted, active `vendor_partnerships` where the vendor is the recommended
  party) → `/partnerships`.

Fail-soft throughout: every query is wrapped so a single error degrades to a
zero/empty state rather than crashing the tab; no-profile (team-member) view
renders a set-up prompt. No fabricated numbers — surfaces with no cheap source
show an honest empty state.

Verified: `pnpm run typecheck` clean · `next lint` on the page 0 errors ·
`lint:navicon` + `lint:retired` pass.

SPEC IMPACT: None
