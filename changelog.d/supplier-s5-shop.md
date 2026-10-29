## 2026-10-30 · feat(supplier-shop): Shop › Details · Services · Page · Gallery · Analytics on the v13 frame — one ▾, each section's figures on its pinned row, a row per service with its tools

Supplier dashboard v13 (owner *"Approved."*, 2026-10-29), slice S5 — the Shop tab's sections, extended in place:

- **Shop ▾ is five sections, from ONE source** — `shop/_components/shop-sections.ts`: Details · Services · Page · Gallery ·
  Analytics, each with the prototype's one-line hint. The bar's page menu from 701 (`supplier-page-menu.tsx`) reads the
  same list. "How it is going" is now **Analytics** (the key `insights` stays — tour, rail and guards key on it).
  Details (`/profile`) and Portfolio (`/collections`, plus its Albums screen) light their own section instead of Page.
- **The pills became Shop's pinned row** (`ShopSegments`): the section ▾ (one dropdown — five pills do not fit 390 px),
  then the section's three figures, folded into one slim line on scroll by the shared `usePinFold` — the S4 Dates · Money
  pattern (#7066). From 701 the ▾ steps aside for the bar's menu; the figures stay. Figures, all read from stores that
  already exist, each a door:
  Details verified · documents in · details done · Services services · live · tools ready · Page opened (30 d) ·
  reviews · ★ rating · Portfolio photos · videos · credits left (the shop wallet) · Analytics opened · asked · booked with
  the change against the 30 days before (the funnel's own honest reader, started beside Batch A).
  HONEST: an unread figure is "—" over "couldn't load", never 0.
- **Services: one row per service** (`shop-service-rows.tsx`, `lib/shop-services-summary.ts`) above the cards — the
  service (a coverage row), its cards and from-price, **Live** (a card switched on) or **Ready**, and "Tools on every
  event" — the Hub's own day-of defaults for that service (`vendor-dayof-modules.ts`) with its scanner said apart. A row
  lands on its first card. "＋ Add a service" moved into the thumb row (the one card-maker door).
- New shared tile `_components/pin-figures.tsx` (+ `lib/pin-figure.ts`) — #7066's figure tile, lifted so Shop can use it;
  when #7066 lands, Customers' figures should draw this one (one shape, not two).
- Guards: `shop/the-shop-sections-are-v13.test.ts` (new), `lib/shop-services-summary.test.ts` (new),
  `lib/shop-section-figures.test.ts` (new); `how-it-is-going-is-a-shop-segment.test.ts` learns where Details draws its
  row; `each-supplier-page-has-its-tour.test.ts` — Shop stop 1 asks "pick Page" instead of `go` (a dropdown is not a
  doorway Next can click). Port baseline and Ugat screens regenerated.

NOT BUILT (needs the owner or another slice): per-service tool/scanner choices that SAVE (no store — #7006's `hub_tools`
is a do-not-merge PR), "Make this the live one" / one-live-until-verified (no live-service allowance exists in Admin),
the calling card + tarps sheet (15 designs — no supplier card designer exists), the Shop ⚙ (no shipped "couples can see
it" switch to mount), "Tools by trade" list, the Services/Page/Analytics two columns from 701 (the reading-column guard
holds them at 48 rem), and the prototype's "seen in Find" (Find records no impressions).

SPEC IMPACT: `DECISION_LOG.md` — new row "SHOP SECTIONS — AS BUILT (S5)" recording the build, the deviations and the open
owner calls above. No locked decision changed.
