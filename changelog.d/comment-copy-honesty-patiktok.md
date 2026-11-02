## 2026-07-01 · fix(honesty): purge stale Patiktok/render comments + a dead review fetch + a wrong vendor-benefit line

Fix-forward COMMENT/COPY-HONESTY cleanup — six stale strings that lied after
this session's changes (Patiktok un-retired as one flat SKU; patiktok-render
renamed; Date-open boost behavior). No behavior change except removing a dead DB
fetch:

- `lib/video-compress.ts` — module comment pointed at `patiktok-render`, which
  was renamed to `reel-render.ts`. Repointed to `reel-render`.
- `lib/patiktok-tiktok.ts` (header) — docstring described the RETIRED dual-tier
  per-day pricing (Personal ₱1,999/day, Setnayan ₱999/day, "master handle").
  Patiktok is now ONE admin-managed SKU (`PATIKTOK_COMPILER`); rewrote the header
  to state that and to describe only the per-event (path-A) OAuth grant this
  module actually implements (worker-side refresh token, if used, stays
  worker-side). Removed the dead `TIKTOK_SETNAYAN_REFRESH_TOKEN` env-var fiction
  from the header.
- `lib/patiktok-tiktok.ts` (`publishPatiktokCompilation` stub TODO) — the
  caller-less stub branches on `tier:'setnayan'|'personal'`. Added an inline note
  that `tier` here means only the auto-post TARGET ACCOUNT (couple's own TikTok
  via path-A vs a Setnayan master handle), NOT a pricing tier, and dropped the
  retired-tier framing from the TODO.
- `lib/sku-catalog.ts` — the comment above the retired `patiktok_*` codes said
  the "entire product" was retired 2026-06-29. Reworded: the PRODUCT was
  un-retired 2026-07-01 as the single live SKU `PATIKTOK_COMPILER`; the 6 codes
  listed are only the DEAD 2026-05-16 dual-tier/per-day/overage codes kept so
  legacy order rows resolve; `PATIKTOK_COMPILER` is intentionally NOT in the list.
- `app/dashboard/[eventId]/_components/vendor-marketplace-info.tsx` — this
  couple-facing panel SELECTed `booked_through_setnayan` + `via_vendor_import`
  but the `ReviewRow` renderer renders no provenance pill, so both columns were a
  DEAD FETCH. Dropped them from the SELECT string and the inline row type;
  introduced a local `MarketplaceReview = Omit<ReviewWithCouple, 'booked_through_setnayan' | 'via_vendor_import'>`
  so the panel's row type honestly reflects what it fetches (the panel-local
  `MarketplaceReviewsData.reviews` is the only consumer; no external importers).
- `app/_components/home/vendor-benefits.ts` — the Date-open tile said "a current
  calendar ranks you up", but the shipped boost only DEMOTES vendors blocked on
  the date (no-calendar vendors float up too). Reworded to "Couples filter for
  who's free; if you're open on their date you rank above vendors already booked
  then."

SPEC IMPACT: None — comment/copy-honesty + a dead-fetch removal; no schema, SKU, pricing, or flow change. Patiktok pricing is admin-managed (`PATIKTOK_COMPILER`), unchanged here.
