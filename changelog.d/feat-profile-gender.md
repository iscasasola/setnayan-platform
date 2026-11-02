## 2026-07-13 · feat(profile): self Gender field (date-anchor personalization)

Owner 2026-07-13 ("and gender") — completes the self-profile personalization
carve-out that already had religion + civil status. Adds an optional **Gender**
field (Female / Male / prefer-not-to-say) to the Profile page, saved on the user
row as `users.sex` with a per-field RA 10173 consent stamp (`sex_consent_at`),
exactly like religion/civil_status.

- Migration `20270804097729_…`: `users.sex` (CHECK female|male) + `sex_consent_at`.
- `SEXES`/`SEX_LABELS`/`isSex`/`normalizeSex` in `lib/profile-personalization.ts`.
- `updatePersonalInfo` reads existing sex + stamps consent on transition; Profile
  page renders the field in the personalization fieldset (after Religion).

Values mirror `dependents.sex` so the anchor model can derive the user's OWN debut
the same way (18th female / 21st male). Reference-only, optional, never required.

SPEC IMPACT: self-profile personalization now = religion + civil status + gender
→ DECISION_LOG + `Event_Anchor_Minimalist_Setup_Design_2026-07-12.md` §3c.
