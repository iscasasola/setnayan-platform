## 2026-07-31 · feat(seo): re-run button, and a two-part guard for hardcoded public prices

Steps 3 + 4 of the SEO/GEO repair that began with the generated `llms.txt` (#3952).

**The re-run button.** `/admin/app-performance?tab=seo` had no control on it at all —
the audit only fired from `after()` in the admin layout, claim-gated to ~once a
day, and because `after()` runs post-response the surface always rendered the
*previous* snapshot. Reloading could not help. `SeoRerunButton` +
`rerunSeoAudit()` call `runSeoHealthAudit()` / `runSeoGscPull()` directly,
bypassing `claimPeriodicJob`, then `revalidatePath` — so a price edit is
confirmable in seconds. The action carries **its own admin check**: the /admin
layout gates the page, not the action, and a server action is independently
invocable. It also reports the Search Console half honestly ("skipped — not
configured") rather than claiming success it did not achieve.

**Two genuinely stale customer-facing prices, fixed.** The app-store demo
advertised the Animated Monogram at **₱2,499** when the catalog says **₱1,000**
(2.5× — the retired pre-2026-07-10 price) and Pakanta at **₱3,499**, which
matches no active SKU at all.

**The guard, deliberately split in two.** A hand-typed allow-list checked against
hand-typed source is two humans agreeing with each other — the exact failure that
let `llms.txt` drift for three weeks. So each half checks only what it can see:

- `lib/public-price-literals.ts` declares every peso figure on a public surface,
  each naming the SKU it mirrors *or* why it is not a price (illustrative budget,
  free marker, commission threshold).
- `lib/public-price-literals.test.ts` (CI, no DB) scans public source with
  comments stripped and fails on any **undeclared** figure. Catches new
  hardcoding; cannot judge correctness.
- `runSeoHealthChecks` Check 5 (runtime, reads prod) asserts every SKU-backed
  literal still equals its live catalog price. Catches **drift** — the half CI
  structurally cannot do.

**Scoping correction worth recording.** The earlier "~60 public files carry a
hardcoded price" figure was wrong: it counted peso figures inside comments.
Stripping comments, it is **10 files**, and most are legitimate — homepage pillar
mocks are an illustrative couple's budget, `₱100,000` is the commission-tapering
threshold, and `onboarding-pricing.ts` (the worst-looking offender at 12 figures)
is already fully catalog-driven, all 12 being history comments.

Verified: the drift check was watched **failing** before it was trusted — a
repriced `ANIMATED_MONOGRAM` produces
`studio-card-demo.tsx says ₱1,000 but ANIMATED_MONOGRAM is ₱1,750`. Audit
simulation with live prod rows: `ok 3 · warn 3 · fail 0`. 5,667 lib unit tests
pass; typecheck + lint clean.

SPEC IMPACT: None. No price or product decision changed — two stale figures now
match the catalog they always should have.
