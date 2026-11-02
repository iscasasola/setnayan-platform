## 2026-07-10 · feat(vendors): one-click build — Option 1/2/3 generation core (PR-4 · S6, core)

The verified core of the 1-click build: `lib/merkado-build-options.ts` · `selectBuildOptions(candidatesByGroup)` assembles THREE complete team options from the couple's candidate vendors per category. Internally good/better/best (cheapest · best-value · top-rated per group); **customer-facing "Option 1 · 2 · 3"** (never good/better/best — owner 2026-07-09), ordered cheapest→priciest so the ladder reads through the totals. Pure + framework-free, 5 unit tests.

Ships the reusable core only. The remaining wiring — a server action that gathers per-group candidates, runs this, and saves each option as a named `budget_builds` snapshot (`savePlanBuildNamed`), plus the "Build my team" trigger + the concierge path + the budget-flex note — is deliberately a follow-up: it MUTATES `budget_builds` and hinges on a candidate-source decision (shortlist-only → often identical options vs marketplace pool → real variety), so it wants a verification pass before it writes couples' data. The core is ready to plug in.

Files: `apps/web/lib/merkado-build-options.ts`, `apps/web/lib/merkado-build-options.test.ts`.

SPEC IMPACT: None — pure generation logic; no schema, pricing, SKU, or engine change.
