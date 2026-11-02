## 2026-07-10 · feat(vendors): Merkado premium-tier crest when Setnayan AI is active (PR-4 · S5)

The Merkado now signals its premium tier when Setnayan AI is active for the event: a gold-accented "Setnayan AI" crest strip atop the takeover ("Your Merkado is on the premium tier — smart matching, fit scoring, and the watch guard are on"). Off (AI inactive) it's absent — the surface stays the clean free experience.

Presentational only: a new `premium` prop on `ServicesTakeover`, passed `premium={aiActive}` from the page (the same `isSetnayanAiActiveForUser` gate that governs the AI features it names). Uses the confirmed `warn` (champagne-gold) + `ink` design tokens — no phantom classes. Behind `BUDGET_BUILD_ENABLED`.

Deliberately a minimal, safe elevation (a crest) rather than a full re-skin, since the surface can't be browser-verified from CI — a fuller premium treatment can fix-forward once seen on deploy.

Files: `apps/web/app/dashboard/[eventId]/vendors/_components/services-takeover.tsx`, `apps/web/app/dashboard/[eventId]/vendors/page.tsx`.

SPEC IMPACT: None — presentational premium signal gated on the existing AI subscription; no schema, pricing, SKU, or engine change.
