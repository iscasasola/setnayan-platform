## 2026-11-13 · feat(shop-page): "Also in <city> · <city>" — the shop's other branches under the reach line

Owner 2026-11-13, verbatim: *"Show the branches as needed"*. The public shop page `/v/[slug]` now says, under the
reach/facts row, which other cities the shop also works from — read from its paid, live branches
(`fetchPublicVendorBranches`, `lib/vendor-branches.ts`; Pro and Ultra include branches, `TIER_CAPS[t].branchesIncluded`).
A shop with no branch (or none with a city) gets NO line — never an empty "Also in", never a teaser. A city equal to
the shop's own, or repeated, is said once / not at all. A failed branch read shows nothing and is now LOGGED (the page's
`.catch(() => [])` and the unread-orders `catch` in `fetchPublicVendorBranches` were both silent).

- Rule: `shopAlsoInLine` in `lib/shop-page-plan.ts`. Drawing: shared `app/v/[slug]/_components/shop-branches-line.tsx`,
  mounted by the shop page and by the dev lab `/dev/shop-plan-lab` (new `&branches=N`, clamped to the plan's
  allowance) so the plan-preview miniatures draw it the same way.
- Test: `app/v/[slug]/_components/the-shop-says-its-branches.test.ts` (render-level; 0 branches → nothing, 2 → "Also in A · B").

SPEC IMPACT: None — implements the owner's 2026-11-13 ruling; no schema, no price, no plan allowance changed.
