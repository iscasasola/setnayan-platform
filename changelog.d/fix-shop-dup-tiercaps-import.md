## 2026-07-02 · fix(vendor-shop): remove duplicate tierCaps import on My Shop

Two parallel PRs (#2621 vendor website editor · the reach-map PR) each added
`import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps'` to
`shop/page.tsx` on different lines. Neither conflicted textually, so both landed
on `main` — producing a TS2300 "Duplicate identifier" that broke `main`'s
typecheck and blocked every in-flight PR. Dedupe to a single import.

SPEC IMPACT: None. Merge-collision hotfix, no behavior change.
