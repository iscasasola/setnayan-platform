## 2026-06-24 · feat(onboarding): wire the generic flow into the picker + a taxonomy-driven starter plan — iteration 0053 Phase 3 (PR3 of 4)

Makes the `/onboarding/[type]` flow reachable and gives the experience-quiz reveal a real, data-driven plan. **Wedding picker routing byte-identical** (the change is purely additive — wedding still hits its existing `onboardingHref` branch); the flow stays dark in prod (the route + the picker branch both gate on `experienceQuizEnabled()`).

- **`event-type-picker.tsx`** (live create-event surface) — adds ONE `else-if` *after* the unchanged wedding `onboardingHref` branch: non-wedding types route to `/onboarding/${type.key}` **only when `experienceQuizEnabled()`**; with the flag off (prod default) the branch short-circuits and non-weddings fall to the inline name-form exactly as before. Wedding never reaches the new branch.
- **`lib/onboarding/generic-plan.ts`** (pure) — `deriveGenericPlan(chips, effort)` → the top-N applicable taxonomy categories (effort axis: simple=4 / balanced=6 / all-out=9), returning category ids (`picks`) + labels. + `generic-plan.test.ts` (5 tests). No hand-authored per-type lists — the taxonomy is the data.
- **`app/onboarding/[type]/page.tsx`** — fetches `getOnboardingTiles(type)` (tier-2 categories scoped to the type) and passes them to the shell.
- **`generic-onboarding.tsx`** — derives the plan from the tiles + the `effort` answer; the persona reveal now lists the lined-up team as chips (graceful empty fallback); `payload.picks` carries the category ids → `events.style_preferences.interested_categories` (was empty in PR2). `OnboardingPickChip` is a **type-only** import (erased — no server module in the client bundle).

Per-type `event_type_profiles` seeds (per-type terminology) are deferred to PR4's admin surface; the flow runs on `GENERIC_PROFILE` + the real vocab labels meanwhile.

**Verify:** typecheck + lint clean · plan test **5/5** · full unit **421/421** · 2-lens adversarial review (wedding-routing byte-identity + flag-off safety · plan wiring + client-bundle safety) → **ship**. Picker diff confirmed additive (9 insertions, 0 deletions); flag-off path byte-identical for all types.

SPEC IMPACT: Iteration 0053 Phase 3, PR3 of 4. Logged in `DECISION_LOG.md`. [[project_setnayan_onboarding_engine]]
