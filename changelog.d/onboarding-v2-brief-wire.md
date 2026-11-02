# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-13 · feat(onboarding): wire profile prefill into the generic per-type flow (flag-off)

Wires the PR-1 profile-prefill foundation into the live generic onboarding so it "reads what the profile already knows and only asks what's missing" (owner, 2026-07-13). Gated by `NEXT_PUBLIC_ONBOARDING_V2_BRIEF_ENABLED` — OFF (default) leaves the flow byte-identical; the generic route itself remains behind `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED`.

- **`app/onboarding/[type]/page.tsx`** — computes `deriveOnboardingPrefill(type, getSelfPersonalization())` when the flag is on (else `EMPTY_PREFILL`) and passes it to the shell. SELF facts only; RLS scopes the read.
- **`_components/generic-onboarding.tsx`** — splits the derived answers into the type's `tq_` questions vs specialty-catalog fields, then: seeds both bags into state (a saved draft still overrides per-key, so resume + user edits always win over the prefill), drops any `tq_` screen the profile fully answers (its answer stays in `details`, so the derived plan still counts its `adds`), and labels prefilled specialty fields. Nothing changes when the prefill is empty.
- **`_components/specialty-fields.tsx`** — optional `prefilledKeys` prop renders a "From your profile" badge on pre-answered fields; the value is seeded but fully editable.
- **`app/onboarding/wedding/page.tsx`** — the existing `religion → faith picker` prefill now reads via the shared `getSelfPersonalization()` instead of a duplicated inline `users` select. Behavior-identical (same religion value); pure consolidation, unflagged.

First real effect once enabled: a Catholic's **christening** opens with `rite_type = catholic_baptism` pre-selected and badged (Born-Again/INC → `infant_dedication`); everything else is unchanged. No migration — prefills from existing `users` columns.

SPEC IMPACT: None — implements behavior already described in `Event_Anchor_Minimalist_Setup_Design_2026-07-12.md` §3c ("read known facts, only ask what's missing") + `Event_Onboarding_Signals_All_Types_2026-07-12.md`. Flag-off, no new product surface/pricing/schema.
