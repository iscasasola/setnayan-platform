# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-13 · feat(onboarding): profile-prefill foundation for the per-type Event Brief (flag-off)

Foundation for "onboarding reads what the profile already knows and only asks what's missing" (owner, 2026-07-13). Purely additive — no live flow is wired to it yet, so every onboarding surface is byte-identical until the flag flips.

- **`lib/self-personalization.ts`** — new `getSelfPersonalization()` server reader (React-`cache`d, `server-only`): returns `{religion, civilStatus, birthdate, gender}` for the current user off `public.users`, RLS-self-scoped, anon-safe (all-null), guard-validated via `isReligion/isCivilStatus/isSex`. The single shared reader that replaces per-flow inline `users` selects (today only the wedding flow inlines a one-column `religion` read). SELF facts only — dependent-subject facts stay in the flag-gated People layer.
- **`lib/onboarding/prefill.ts`** — new pure `deriveOnboardingPrefill(eventType, self)` → `{answers, skip, provenance}`. Deterministic (Rule 1), zero-LLM. Encodes only verified, self-sourced mappings over real spec field keys: `religion → christening rite_type` (`catholic→catholic_baptism`, `christian/inc→infant_dedication`; `muslim/other`→unset). Debut 18F/21M, milestone age, anniversary silver/golden, and civil-status mappings are documented as intentionally NOT self-derivable (People-gated or event-sourced).
- **`lib/onboarding-v2-brief-flag.ts`** — new `onboardingV2BriefEnabled()` reading `NEXT_PUBLIC_ONBOARDING_V2_BRIEF_ENABLED === 'true'` (default OFF), modeled on `experienceQuizEnabled()`. Scoped to self-profile prefill; never unlocks the counsel-gated `NEXT_PUBLIC_DEPENDENT_PEOPLE` path.
- **`lib/onboarding/prefill.test.ts`** — 8 `node:test` cases covering the rite mapping, the muslim/none no-op, non-christening no-op, and the People-gated debut deferral.
- **`.env.example`** — documented blank stub (blank = OFF).

No migration — prefills from `users.religion / civil_status / birth_date / sex`, all already in prod. No schema, no route, no UI change.

SPEC IMPACT: None yet. Implements the onboarding half of `Event_Anchor_Minimalist_Setup_Design_2026-07-12.md` §3c ("read known facts, only ask what's missing") + `Event_Onboarding_Signals_All_Types_2026-07-12.md`; those docs already describe the behavior. A later PR that wires prefill into a live flow will carry the real spec-impact note.
