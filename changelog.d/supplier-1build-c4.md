## 2026-11-08 · feat(supplier): THE ONE BUILD lane C4 — Shop + Portfolio

- `lib/portfolio-count.ts` `getPortfolioCount(vendorId)` — the one "N of 50 free photos" read (spec §9 #17), shared by
  Today's Portfolio stat (C1) and the Portfolio pinned row. Same cap as the uploader (`portfolioPhotoCap` + the
  allowance read); a refused read is `{ ok: false }`, never 0.

SPEC IMPACT: None yet (lane in progress; corpus rows are the controller's, on the merged tree).
