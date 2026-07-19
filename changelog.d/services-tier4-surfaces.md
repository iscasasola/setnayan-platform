## 2026-06-25 · fix(studio): in-app services consistency — Tier 4 (stop re-selling owners; live prices)

Fourth tier of the In-App Services Consistency Plan. The opened tool surface
should let an OWNER use the tool / see the outcome — not re-pitch them (selling
lives on the /studio/about learn-more page). Gated the owner-facing marketing
and removed hardcoded prices on 5 surfaces:

- **led** — the 8K-wall marketing header (hero + feature grid) now renders only
  in the not-owned state (bundle-aware `eventSkuActive`); an owner sees just the
  editor.
- **indoor-blueprint** — marketing hero moved into the not-owned branch; owner
  gets a neutral "Map your venue" header.
- **custom-qr-guest** — header copy is neutral for owners, pitch only for
  non-owners; hardcoded price → live admin read (`formatV2Sku`).
- **mood-board** — removed the "coming next / premium" teaser; the opened
  surface is the working board.
- **pakanta** — gated the "yours, forever" pitch subtitle to non-owners (kept
  the delivered-song player + AiDisclosure + in-production state untouched).

Every not-owned state keeps its buy affordance (UnownedView / InlineCheckoutDrawer
/ PakantaMusicForm); no hardcoded price remains as a primary source (live-read
via the admin V2 catalog; indoor-blueprint keeps a constant only as a graceful
fallback). Adversarially verified (tsc against a deps-complete checkout: zero new
errors). `setnayan-ai` (whole surface is marketing) is left for Tier 5.

SPEC IMPACT: none; In_App_Services_Consistency_Plan_2026-06-25.md.
