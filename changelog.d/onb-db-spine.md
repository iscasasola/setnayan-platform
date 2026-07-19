## 2026-06-28 · feat(onboarding): DB-driven per-type onboarding content (foundation + wiring)

Step 1 of making each non-wedding event type's onboarding admin-editable + richer
(owner directive 2026-06-28, full authority). The generic (`/onboarding/[type]`)
flow's per-type content — signature questions, the persona starter-plan pack, the
reveal copy, the intro, and per-axis quiz copy — was hardcoded in TS and required
a redeploy to change. This lands the spine so it can come from the DB.

- **New table `event_type_onboarding`** (migration `20270312483013`, applied to
  prod via MCP + ledger): one row per event type, structured JSONB columns
  (`intro`, `questions`, `persona_pack`, `reveal_overrides`, `axis_overrides`),
  public-read + `is_admin()`-write — same RLS shape as `event_type_profiles`. A
  row is an OVERRIDE; a missing/NULL/malformed field falls back to the code default.
- **`lib/onboarding/onboarding-spec.ts`** — PURE `resolveOnboardingSpec(eventType,
  packKey, row)` merging an override row over the TS defaults (PER_TYPE_QUESTIONS /
  PERSONA_PACKS / GENERIC_PERSONA_REVEAL / GENERIC_EXP_AXES), with shape guards so
  a bad admin edit can never break the flow. Axis + option KEYS stay locked
  (resolvePersona depends on them) — `axis_overrides` changes copy only.
- **`lib/onboarding/onboarding-db.ts`** — cached Supabase reader `getOnboardingSpec`
  wrapping the pure resolver (degrade-to-defaults on error). Same SAFETY contract
  as `event-types-db.ts` / `taxonomy-db.ts`.
- **Wiring**: `app/onboarding/[type]/page.tsx` fetches the spec and threads it into
  the `GenericOnboarding` shell, which now consumes `questions` / `personaPack` /
  `revealByPersona` / `quizAxes` / `intro` props instead of importing the TS
  constants directly. `derivePackPlanFrom` / `derivePackServicesFrom` / `extraPicksFrom`
  added (take the data object; the by-key functions remain as wrappers).
- **Tests**: `onboarding-spec.test.ts` (8 cases — PARITY with no row, unknown key,
  valid/malformed overrides, per-persona reveal merge, locked axis keys). 639/639
  lib tests green; typecheck + lint clean.

Behavior is UNCHANGED: with no override rows (the state at ship), every type
resolves to its exact prior TS content. Wedding's bespoke wizard is untouched.
The admin editor + per-type content enrichment land in follow-up PRs.

SPEC IMPACT: None — additive engine plumbing; no schema break, SKU, pricing, or
user-facing flow change yet.
