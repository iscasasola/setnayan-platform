## 2026-07-30 · feat(security): a report-only CSP, so the origin allowlist is measured instead of guessed

`next.config.ts` has shipped `frame-ancestors`-only CSP with a documented deferral: a real `default-src`/`script-src` *"would have to enumerate every external origin we load (Supabase · Sentry ingest · PostHog · R2 · Maya · YouTube · Google Fonts · Vercel)"* and would break the inline Babel-standalone keynote decks.

**The deferral is right, and this doesn't overturn it.** That origin list is a **guess** until measured, and guessing wrong takes the site down — the same long-tail trap that made a fail-closed allowlist the wrong call for `/api/upload`'s media prefixes earlier today. So this ships the *measurement*, not the enforcement.

### What lands

- **`Content-Security-Policy-Report-Only`** naming the origins we believe we use, on its own `headers()` entry. **The enforced header is untouched** — a test asserts it's still `frame-ancestors`-only, because a same-PR flip to enforcement is the failure mode here.
- **`/api/csp-report`** — unauthenticated by necessity (browsers post with no session), so rate-limited per IP, size-capped at 8 KB, and it answers **204 to everything**: a report sink must never become a way to probe the server.
- **`lib/csp-report.ts`** — pure minimiser, unit-testable, mirroring the `r2-client-ref.ts` split.

### Two deliberate choices worth stating

**`'unsafe-inline'` and `'unsafe-eval'` stay in `script-src`.** Not an oversight. A strict `script-src` fires on **Next's own inline hydration bootstrap on every page load** and would drown the signal. The unknown worth measuring is the *origin* allowlist; removing inline needs a nonce in middleware and deserves its own measurement.

**`/keynote` and `/proto` are excluded** via negative lookahead. Those 47 files execute inline Babel-standalone from `public/`, so they'd emit a constant stream of known, uninteresting violations and bury the origins we're collecting. They're already `robots.ts`-disallowed internal pitch decks, not product surfaces.

### The privacy design, which is the part I'd review first

A browser CSP report carries `document-uri`, `referrer` and the full `blocked-uri`. On this product those strings routinely contain **event slugs, guest tokens in query strings, and signed R2 URLs** — exactly what iteration 0035's rule keeps out of logs (*"no PII in logs"*). **A security control must not become the thing that leaks.**

So the minimiser keeps **two fields only** — the directive and the blocked **origin** (scheme+host) — and drops path, query and fragment. That happens in the pure module rather than at the log call, so no future caller can re-widen it by forgetting. CSP keywords (`inline`, `eval`, `data`, `blob`) pass through verbatim because they're the most diagnostic values in the report; an unparseable value is labelled `unparseable` rather than echoed, since that's where a token would hide.

### Tests — 12 cases

Both report shapes (legacy `report-uri` and the Reporting-API array) · **the PII guard**, asserting a realistic report containing a signed R2 URL and a guest token yields neither · keywords preserved · unknown directives bucketed rather than echoed · garbage yields `null` rather than a fabricated summary · plus header guards for report-only-ness, the deck exclusion, the deliberate `unsafe-inline`, and the sink.

**All three probed:**

| mutation | result |
|---|---|
| flip report-only → enforcing | *"it is REPORT-ONLY"* fails |
| drop the keynote exclusion | *"the decks are excluded"* fails |
| log the raw `blocked-uri` | **3 tests fail, including the PII guard** |

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,607/5,607 pass**.

### ⏭ What the owner does next

Let it run, then read the reports. Every origin that appears is one the app genuinely uses and the policy didn't name. When the reports go quiet, enforcement becomes a small, boring change — **and it should be its own PR.** Violations log as `console.warn('[csp-report-only]', directive, origin)`, so they surface in Vercel logs (and Sentry when `SENTRY_DSN` is set) without paging anyone: a report-only violation is information, and paging on it while the allowlist is still being learned trains people to mute it.

SPEC IMPACT: None — blocks nothing, changes no price, SKU, schema, flag or RLS. Closes the "CSP `script-src` hardening — logged, not done" register line as *measurement shipped, enforcement pending review*.
