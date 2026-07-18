## 2026-07-12 · feat(onboarding): pre-select the wedding faith from the user's profile religion

The payoff for the self-profile religion field (#3192): when a signed-in user starts a **Religious** wedding, the faith is pre-selected from their profile `religion` — saving a tap and reflecting the "reference-only, tailors your events" promise.

- **`onboarding/wedding/page.tsx`** — reads the user's `religion` and passes it as `religionDefault` ONLY when it maps to an ACTIVE ceremony faith (never pre-selects an inactive/coming-soon faith).
- **`onboarding-shell.tsx`** — new `religionDefault` prop; `selectKind` pre-fills `faith: [religionDefault]` when the kind is `religious` (Civil/Mixed reset to empty as before). They can still change it on the faith screen.

**Safety (deliberately narrow + additive):** with no religion set, `religionDefault` is null and `selectKind` behaves byte-identically to before. The localStorage draft-resume path is untouched — a resumed draft's faith always wins (hydration runs after and replaces state). No change to the flow, screen count, or validation.

SPEC IMPACT: implements the Phase-1 faith→ceremony pre-select (Faith_Aware_Person_Graph §1); the faith→rites suggestions stay a Phase-3 follow-up.
