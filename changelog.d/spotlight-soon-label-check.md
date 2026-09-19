## 2026-09-18 · fix(vendor-benefits): "Editorial & article spotlights" is live, not soon

`vendor-benefits.ts` still marked "Editorial & article spotlights" as
`soon: true`. It is live end-to-end: `lib/journal-spotlights.ts` (the Wave 5
vendor benefit) has a public `/blog/[slug]` credit block, a vendor-dashboard
"you're featured" list, and an admin curation queue at
`/admin/studio?tab=journal-spotlights`, and the two-admin approval gate for
sponsored placements that was broken now works (LAU-20, #5591). Cleared the
`soon` flag.

SPEC IMPACT: None.
