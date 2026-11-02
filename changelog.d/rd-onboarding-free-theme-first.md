## 2026-10-01 · fix(onboarding): the pre-selected look is always a free theme

Onboarding's look card now pre-selects the first FREE look in the type's list (`defaultLookId`), never a Pro one — a new wedding no longer opens on Velvet ◆. Pro looks stay listed and pickable (◆, Apply asks). No migration; the seeded `look_set` and the ten themes are unchanged. Guard: `setup-engine.test.ts` asserts every seeded type's default is free (sabotage-checked).

SPEC IMPACT: None (implements DECISION_LOG 2026-10-01 "PRO THEMES OPEN TO EVERY EVENT TYPE (STILL PRO) · ONBOARDING PRE-SELECTS A FREE THEME").
