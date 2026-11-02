## 2026-06-24 · feat(onboarding): generic `/onboarding/[type]` flow UI — iteration 0053 Phase 3 (PR2 of 4)

The lean, brand-consistent onboarding flow for non-wedding event types — a NEW route + a fresh client shell (NOT a fork of the 4,700-line wedding wizard), built on the PR1 spine. **Dark in prod** (the route 404s unless `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` is on — the owner's go-live switch); the create-event picker keeps its inline form until PR3 wires it. Wedding wizard byte-untouched.

- **`app/onboarding/[type]/page.tsx`** (server) — 404s unless the experience-quiz flag is on; validates `[type]` against the live `event_type_vocab` (active + enabled, via `getCreatableEventTypes`) and refuses `wedding` (FK-safe before commit); resolves the profile + flow and renders the shell.
- **`app/onboarding/[type]/_components/generic-onboarding.tsx`** (`use client`) — screens: welcome → name → date → pax → region → the 5 event-agnostic experience-quiz axes → persona reveal → create. localStorage draft (30-day TTL) with a `?resume=1` round-trip after sign-in; the single lazy commit calls `commitOnboardingEvent` and routes to the dashboard. On-brand (paper/ink/mulberry palette).
- **`lib/onboarding/generic-content.ts`** — `GENERIC_EXP_AXES` (event-neutral copy, **identical option keys** to the wedding axes so `resolvePersona` works unchanged) + `GENERIC_PERSONA_REVEAL` + `GENERIC_AXIS_IDS`. + `generic-content.test.ts` (5 tests, incl. the key-parity invariant + a no-wedding-wording guard).

PR2-empty by design: the derived plan's `picks`/`services`/`refinements` are empty here — per-type persona packs that fill them land in PR3.

**Verify:** typecheck + lint clean · content test **5/5** · full unit **416/416** · 2-lens adversarial review (route/commit correctness · client-server boundary + prod-build safety + wedding-isolation) → **ship**. Client/server boundary confirmed clean (no server-only import in the client bundle); sign-in→resume round-trip verified end-to-end.

SPEC IMPACT: Iteration 0053 Phase 3, PR2 of 4. Logged in `DECISION_LOG.md`. [[project_setnayan_onboarding_engine]]
