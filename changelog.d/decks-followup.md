## 2026-08-12 · fix(decks): the README that explained the unpublish was never committed

Follow-up to #4372. An adversarial audit of that change produced 14 candidates →
**5 confirmed → 4 distinct defects**, two of them mine.

### 1 · 🚨 The README existed on one laptop's disk and nowhere else · HIGH

`internal-decks/README.md` — the only record of *why* the decks came down, what is
wrong inside them, and the instruction "fix the prices first" before republishing —
**was silently swallowed by `.gitignore` and never entered the repo.**

The root `.gitignore` is an **allowlist** (`/*`, negated per path). `internal-decks/`
is a brand-new top-level folder and was never added to it. The 255 deck files
survived only because `git mv` re-stages already-**tracked** blobs; the new file next
to them did not.

🔑 **The `.gitignore` warns about this exact trap in its own header** — *"a genuinely
NEW top-level project file must be added to the allowlist below, or git will silently
ignore it"* — and I walked straight into it. `git status` said nothing. `git commit`
succeeded. Three shipped artifacts pointed at a file that was not there: the commit
message, the changelog fragment, and `no-published-decks.test.ts:12` ("see its README").

Worse, the folder was a **black hole**: anything added to it later would vanish the
same way, so a future correction to those decks could be written, committed and lost.

Fixed by allowlisting `!/internal-decks/`, verified both ways — the README is now
tracked, and a probe file created inside the folder shows up in `git status`.

### 2 · The decks are still readable on every pre-change Vercel deployment · HIGH · flagged, not fixed

Vercel keeps past deployment URLs alive, deployment protection is off, and this repo
is public — so GitHub's deployments API hands anyone the URLs. Verified with three
unauthenticated commands: a pre-change host still serves `keynote-vendors.jsx` (200,
41,773 bytes) containing the exact sentence this whole effort was about — *"you keep
the markup, we deliver the service"* — plus the retired token packs and stale prices.

The canonical site is correct (`www.setnayan.com/keynote*` → **404**, verified). But
**taking files out of `public/` does not reach history.** Closing this is an
infrastructure action — Vercel deployment protection, or expiring old deployments —
not a code change, so it is **surfaced to the owner** and recorded in the README
rather than done unilaterally.

### 3 · My README got a price wrong, in the document about wrong prices · MEDIUM

It called ₱2,499 "the Grand Bundle price". ₱2,499 is the **LED backdrop's own line
item** (against a ₱20,000 "outside" comparison); the bundle is four items totalling
₱9,996. Corrected, and the correction says so out loud.

Also tightened an overstatement: the guard knows the two names `keynote` and `proto`
and nothing else — publishing the same material under a different folder name sails
straight through. The README now says that instead of implying blanket protection.

### 4 · The CSP carve-out outlived the decks it was made for · MEDIUM

The report-only CSP excluded `/keynote` + `/proto`, because those decks executed
inline Babel-standalone and would have buried the signal. The decks are gone; the
exclusion was not. 🔑 **A carve-out that outlives its reason silently exempts whatever
lands at those paths next** — nobody would be choosing that and nobody would see it.
Now `source: '/(.*)'`, and `csp-report.test.ts` asserts the **absence** of the
exclusion so it cannot return unnoticed. Mutation-tested: re-adding it goes red.

### Checks

`tsc` clean · **7649/7649** unit · all 22 lint scripts · `csp-report.test.ts` 17/17.
The new CSP assertion was sabotaged and confirmed to fire, then green on restore; the
gitignore fix was verified by probe, not by reading the rule.

SPEC IMPACT: None. `DECISION_LOG.md` row added 2026-08-12.
