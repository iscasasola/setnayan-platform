## 2026-11-06 · fix(analytics): a new shop with no stats row is not "Couldn't load"

Shop › Analytics told a brand-new shop (SetnaProd, 0 rows in `vendor_activity_stats`) "How you are doing ·
Getting there · Couldn't load". The page read the stats row with `.then((r) => r.data)`, so a REFUSED read and a
MISSING row both arrived as `null`, and `ratingLine(null)` means "the read failed".

The read now binds `{ data, error }` and returns a `MeasuredStatsRow` (`lib/business-doing.ts`, the house
`measured` shape from `lib/guests.ts` / `vendor-dashboard/reads-are-honest.test.ts`): an error or a throw →
`measured: false`; no row → `measured: true, row: null`. Every consumer of the row now branches on it:

- What couples say (`ratingLine`) — refused "Couldn't load"; no row "No reviews yet".
- How fast you reply (`replyLine`) + the "What couples see about your replies" card — refused "Couldn't load" /
  "We couldn't load your reply time just now."; no row unchanged ("No inquiry yet" / "0 of 3").
- Health composite — refused `unmeasuredVendorHealthComposite()` ("Couldn't load"); no row unchanged ("NEW").
- Growth recs — unchanged: with no row they show the universal starter set, which states no figure.

Held by `apps/web/lib/business-doing.test.ts` (three-case unit tests + a source guard on the page's read).

SPEC IMPACT: None
