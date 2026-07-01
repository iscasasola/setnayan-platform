## 2026-07-01 · feat(home): reorganize the "For vendors" pop-up by account type

Owner: "I thought you'd organize it depending on the type of account, from free
to enterprise." The homepage "For vendors" overlay was organized by THEME
(Discovery, Booking, Money, …) with a small tier chip on each benefit. Restructured
it into tier sections — Free → Solo → Pro → Enterprise → Custom — each showing what
it ADDS on top of the tier below, matching the /for-vendors ladder.

- `app/_components/home/vendor-benefits.ts` — replaced the thematic `VENDOR_GROUPS`
  + `VENDOR_HERO_CARDS` with `VENDOR_TIER_SECTIONS` + `VENDOR_CUSTOM_TIER`. Free is
  sub-grouped by theme (Get found / Look credible / Run every booking / Get paid /
  …) so its ~45 items stay scannable; Solo, Pro, Enterprise are flat "what you add"
  lists. Tier assignments are unchanged from the hybrid decision — this is a re-org,
  not a re-tag.
- `app/_components/home/HomeOverlays.tsx` — the vendor overlay renders coloured tier
  section bands (name + price + "what it's for" tagline + benefits) instead of the
  hero grid + thematic groups; per-benefit tier chips retired (the section header
  carries the tier now). Legend + stat lead-in updated to "each tier includes
  everything in the one before it."
- `app/_components/home/home-reskin.css` — new `hr-vt-*` tier-section styles (Free
  grey / Solo sage / Pro gold / Enterprise violet / Custom dark), reusing the
  existing `hr-vb-grid`/`hr-vb-item` benefit rows and tier palette.

SPEC IMPACT: In-repo SSOT `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §5 updated
(supersedes the tier-chip overlay note in §7). Corpus decision-log row added. No
DB/schema/SKU/price change — presentation only.
