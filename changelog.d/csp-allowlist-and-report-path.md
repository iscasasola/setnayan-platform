## 2026-08-02 · fix(csp): the report-only policy would have killed PostHog and Sentry on the day it was enforced

The measurement step shipped 2026-07-30 has been collecting for a week —
**105 reports** at `/api/csp-report`. Read them. Every violation is **ours**, and
two of them are breakages waiting for the enforcing flip.

**1 · PostHog could send but not load.** `script-src-elem
https://us-assets.i.posthog.com`. PostHog was in `connect-src` but **not
`script-src`**, so the policy permitted its network calls and refused its client
script. Enforcing the old list kills product analytics outright.

**2 · A Sentry wildcard that never matched.** `connect-src
https://o4511393742782464.ingest.us.sentry.io`. The list said
`*.ingest.sentry.io`; the real host carries a **region segment** —
`*.ingest.**us**.sentry.io` — which the wildcard does not cover. Enforcing kills
error reporting. Both entries added; the header still blocks nothing.

**3 · A live bug the reports surfaced but could not locate:** `img-src
r2://setnayan-media`. `r2://` is the INTERNAL storage ref scheme — it must be
resolved server-side before it reaches a browser, so this is a **broken image for
a real user**, not a policy gap. Ruled out with evidence, not guesswork:
`guests.photo_url` (prod holds **0** raw refs across 28 photos) and
`publicUrlFor()` (cannot emit `r2://` on any path — it builds a URL or throws).
**Source still unpinned** — it is not a plain `src={ref}`; that grep is clean.

### Why the summary now carries a path — and why it is a SHAPE

Finding #3 was untraceable because `cspViolationSummary` kept the directive and
the origin and **dropped the document URL entirely**. One field short of
actionable.

⚠ **That drop was deliberate**, guarded by a test asserting the summary leaks
none of a signed-URL signature, a guest token, an event folder id, **or a
couple's public slug** (`maria-and-jose`). Both things are true at once: the
retention schedule commits to *"no PII in logs"* (class 9), and a violation you
cannot locate is one you will not fix.

So the path is a **route shape**, and the rule is **inverted** rather than
subtractive: a first segment survives only if it is a route the app actually
serves (`STATIC_ROUTE_ROOTS`, derived from `apps/web/app/*`); every other root
collapses to `/:slug`. A naive strip-the-UUIDs pass satisfies the signature, the
token and the folder id — and **fails on the slug**, because a slug is just a
short word. `/dashboard/:id/seating` locates the surface; `/maria-and-jose`
becomes `/:slug` and names no wedding. Unknown ⇒ anonymised is the safe
direction. Query and fragment are still dropped whole.

**Mutation-checked:** deleting the slug-anonymising line turns the original PII
guard red with the couple's slug in the failure output.

`lib` suite **6064 pass / 0 fail**; the three changed files parse clean via the
TypeScript compiler API. ⚠ Full `tsc --noEmit` still cannot run here (heap
exhaustion) — **no green typecheck claimed**; CI is the authority.

⏭ **Still do NOT flip to enforcing.** Not because the reports are quiet — because
they are informative. Let the corrected list run against real traffic first, and
find #3.

SPEC IMPACT: None. Report-only header, still blocking nothing.
