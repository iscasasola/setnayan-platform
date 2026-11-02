# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(onboarding): restore the Love Story arc to capture richer Event Brief signals

Under Rule 1 the Event Brief IS the intelligence — output quality = brief richness × authored-rule richness — so the newly-free budget/faith/style matching only gets richer as onboarding captures more. This turns the taste-capture back on (owner "Both — quiz + Love Story", 2026-07-12).

**Love Story (this PR — code):** `onboarding-shell.tsx` un-removes the 7-screen love-story arc (`love_intro` + its 5 questions + `love_preview`) from `REMOVED_SCREENS` (they were removed 2026-06-22). The arc stays **opt-in** — `love_intro` is the "tell it / add it later" fork and its 5 questions are `LOVE_SKIPPABLE`, so it never forces a longer flow ("easier, not more complex"). The `love_story` column already exists and is already written at commit (`actions.ts`), so **no migration** is needed; the screens were simply not in the sequence. Feeds the Brief's Taste + Story layers, the website editorial, and the Pakanta song. The five pure no-input interstitials (welcome / alaala_promise / team_intro / team_payoff / exp_reveal) stay removed.

**Experience Quiz (owner activation — no code):** the 5-axis quiz needs zero code changes. Its migration **already exists** — `supabase/migrations/20270208703382_events_experience_persona.sql` (additive, nullable, `ADD COLUMN IF NOT EXISTS`, RLS-safe → safe to (re-)apply) — and the screens already show when the flag is on. To go live the owner does two infra steps the code can't: (1) confirm/apply the migration to prod (`supabase db push`), then (2) set `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED=true` in Vercel. Order matters — the flag must not go on before the columns exist, or the commit write breaks.

Verified: `tsc --noEmit` clean.

SPEC IMPACT: Onboarding UX — restores love-story capture (reverses the 2026-06-22 removal) and enriches the deterministic Event Brief that now drives the free budget/faith vendor matching (see PR "free the % match + score it on budget & faith"). No pricing/schema change here. Recommend a `DECISION_LOG.md` row. See memory `project_setnayan_ai_deterministic_free`.
