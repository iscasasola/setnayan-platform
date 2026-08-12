## 2026-08-12 · fix(security): the draft CSP had no frame-src — enforcing it would grey-box every embed

Follow-up to the Turnstile pass (#4352). Chasing "has the report-only policy
actually caught anything?" turned up a second, larger instance of the same bug —
in the policy that exists to prevent it.

### `CSP_REPORT_ONLY` had NO `frame-src` directive at all

Frames therefore fell back to `default-src 'self'`. Two consequences, both silent:

- **Scheduled outage.** The day anyone enforces this draft, every YouTube, Vimeo,
  Instagram and TikTok player, the vendor OpenStreetMap panel (fixed 2026-08-08)
  and the Turnstile challenge (fixed yesterday) becomes an empty grey box. No
  error, no log — the exact failure mode this file's own docblock is about.
- **It poisoned the measurement.** Every legitimate embed reported a violation, so
  any real finding would have arrived buried in noise about origins we had already
  approved. The stated gate for enforcement is "once the reports are boring", and
  the policy was manufacturing its own noise.

Added, mirroring the enforced list. Guarded three ways, all mutation-tested:

- the draft must HAVE a `frame-src`;
- every host in the enforced list must appear in the draft (they are copies, and a
  copy is drift waiting to happen — this is not left to discipline);
- the two extractors must genuinely read DIFFERENT policies.

### The third guard is the interesting one

Adding a `frame-src` to the draft put a **second** `frame-src` in `next.config.ts`,
declared BEFORE the enforced one. The existing `/frame-src 'self'/` regex returns
whichever comes first — so every assertion in `csp-embeds-are-allowed.test.ts`
would have silently switched to measuring the header that **blocks nothing**, and
stayed green, because the two lists happen to agree today.

Asserting against the real file cannot catch that, *because* the lists agree. So
the extractors are now pure functions and the guard feeds them a synthetic config
where the two deliberately differ. It also asserts that the old un-anchored regex
really does return the wrong one — so the anchoring is provably load-bearing
rather than defensive tidying.

### Also measured, not fixed — needs an owner call

The report-only policy has been live since 2026-07-30. Its entire output is a
`console.warn` into Vercel's runtime log, and **that log is discarded after about
a day** on the current plan. Probed live: the sink works end-to-end (both report
shapes accepted, minimised, path anonymised, garbage dropped — verified by posting
synthetic reports and reading them back), and over the widest window Vercel will
return, the only CSP reports in existence are the two synthetic ones.

So "the reports are boring" is currently **unanswerable**, not "yes". Nothing
aggregates them and nobody can look back further than yesterday. Whoever enforces
this policy would be doing it on no evidence. Options are a persisted table, a
Sentry retention tier, or Observability Plus — a cost/design call, not a bug fix.

SPEC IMPACT: None — no product behaviour, pricing, SKU or schema change.
