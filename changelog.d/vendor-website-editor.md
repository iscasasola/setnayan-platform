## 2026-07-02 · feat(vendor-shop): My Shop → Website content editor (PR1 · free controls)

Reworked the My Shop "Website" tile from a passive "Live" status card into an
inline content editor for the public `/v/[slug]` microsite. The microsite was
previously auto-composed 100% from the profile with no editor; curation now
layers on top as OPTIONAL overrides — an un-curated page renders exactly as
before.

**Schema** (migration `20270430000000_vendor_microsite_customization.sql`)

- Additive `microsite_*` columns on `vendor_profiles`: `microsite_about` (text,
  ≤600 via CHECK), `microsite_sections` (jsonb visibility map),
  `microsite_featured_service_ids` (text[]), plus PRO-control columns landed now
  for schema stability but wired later — `microsite_hero_photo_key`,
  `microsite_accent`, `microsite_featured_editorial_ids`,
  `microsite_pinned_review_id`. All nullable/defaulted; RLS inherited from the
  existing `vendor_profiles` row policies (vendor-org write · public read).

**Free controls — wired end-to-end** (editor + save action + public render)

- **About** — a 2–3 sentence intro rendered under the hero.
- **Featured services** — pick up to 3 owned service leaves; floated to the
  front of the public Services list (`orderFeaturedFirst`, stable).
- **Sections** — show/hide Portfolio · Trusted by · Editorials. Reviews are
  deliberately NOT toggleable (event-bound zero-fakes trust pillar).
- **Awards** — read-only display of earned badges in the editor (public-page
  surfacing is a later PR).

**Pro controls — locked teaser** (paywall + free tastes)

- Custom address · hero photo · accent theme · featured editorials · pinned
  review render as an always-visible locked list gated on
  `tierCaps.customWebsiteName` (the same gate the custom slug already uses).
  Free vendors see the ceiling; Pro vendors see "coming soon". Wired in
  follow-up PRs.

**New/changed files** — `lib/vendor-microsite.ts` (defensive fetch, decoupled
from `FULL_VENDOR_PROFILE_SELECT` so a not-yet-applied migration can't blank the
profile) · `updateVendorWebsiteField` in `vendor-dashboard/actions.ts` (revalidates
`/vendor-dashboard/shop` + `/v/[slug]` + bare-root) · `shop/_components/website-editor.tsx`
(replaces the old `WebsitePanel`) · `shop/page.tsx` loader + panel swap ·
`v/[slug]/page.tsx` (About section, section toggles, featured ordering). tsc +
lint green locally.

SPEC IMPACT: New vendor microsite customization surface (My Shop → Website).
Adds `vendor_profiles.microsite_*` columns; introduces the "curated overrides on
top of the auto-composed page" model. Gating reuses `tierCaps.customWebsiteName`
(Pro/Enterprise). Reviews are intentionally non-hideable. Logged in corpus
`DECISION_LOG.md` (2026-07-02). PR1 of a stacked series (PR2+: wire the Pro
controls — slug/hero/accent — and the net-new editorials section + pinned review).
