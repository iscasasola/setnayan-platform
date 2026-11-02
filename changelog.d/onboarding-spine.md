## 2026-06-24 · feat(onboarding): generic onboarding spine — iteration 0053 Phase 3 (PR1 of 4)

The reusable, **inert** foundation for per-type (non-wedding) onboarding. Adds only new files — **zero edits to the wedding wizard** (`/onboarding/wedding/**` + `commitOnboardingWedding` byte-untouched, verified vs origin/main).

- **`lib/onboarding/types.ts`** — `GenericOnboardingPayload` (the lean non-wedding payload) + `GenericCommitResult`.
- **`lib/onboarding/flow-config.ts`** — pure `resolveOnboardingFlow(profile)` + `GENERIC_ONBOARDING_SCREENS` (the engine seam: the universal essentials + the 5 event-agnostic experience-quiz axes; persona pack keyed off `profile.onboardingFlowKey`).
- **`lib/onboarding/event-insert.ts`** — pure `buildGenericEventInsert(payload, opts)` → the `events` row. Every wedding-only CHECK column is NULL/false by construction (mirrors `createWeddingEvent`'s non-wedding branch), so `events_wedding_fields_consistency` + all sibling CHECKs pass for a non-wedding type. `experience_*` columns flag-guarded.
- **`app/onboarding/_shared/commit-event.ts`** — `commitOnboardingEvent` (`use server`): the generic commit, separate from the wedding one. Reuses the proven spine — anon-draft session mint → unique slug → single `events` INSERT → `event_members` ownership — and refuses `eventType === 'wedding'`. Inert until PR2's route calls it.
- **`lib/onboarding/{flow-config,event-insert}.test.ts`** — 10 tests locking the manifest + the NULL-wedding-fields invariant + the flag-guard + the anon held-inquiry stash.

**Verify:** typecheck + lint clean · new tests **10/10** · full unit **411/411** · 2-lens adversarial review (column-name correctness vs the events schema · CHECK-validity · wedding-isolation) → **ship**. All 40 written columns confirmed verbatim against working inserts (zero typos).

**Forward note (for PR2):** `events.event_type` is now TEXT + FK to `event_type_vocab`, so the `/onboarding/[type]` route must validate the type key against the vocab before calling `commitOnboardingEvent`.

SPEC IMPACT: Iteration 0053 Phase 3 (per-type onboarding engine), PR1 of 4. Logged in `DECISION_LOG.md`. [[project_setnayan_onboarding_engine]]
