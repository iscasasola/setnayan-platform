## 2026-06-28 · feat(onboarding): tailored 3–4 question flows per event type

Step 3 — the per-type onboarding DESIGN (owner directive 2026-06-28, "Standard"
depth). Each of the 8 enabled non-wedding types went from ONE signature question
to a distinct, tailored 3–4 question flow, so a debut, a corporate event, and a
gender reveal each feel bespoke rather than running the same single prompt.

- `lib/onboarding/type-questions.ts` — `PER_TYPE_QUESTIONS` enriched: every type
  keeps its existing first question verbatim (stable answer keys) and gains 2–3
  more — a distinct opener plus shared beats (scale · keepsake · entertainment ·
  food). Examples: debut → centerpiece · court · styling · entertainment;
  corporate → format · headcount · production · catering; gender reveal → method ·
  guest list · keepsake · treats. Every option's `adds` maps to a REAL taxonomy id
  applicable to that type (`trophies_awards` only on corporate/tournament; no
  wedding-only or invented ids).
- These are the code DEFAULTS — admins can override any of it per type from
  /admin/event-types/[type]/onboarding (the editor shipped alongside). The flow
  reads them via `getOnboardingSpec` (DB override → these defaults).
- Tests: guard that every `adds` id is a real, type-applicable category (no
  dangling ids), and that each type has 3–4 questions. 641/641 lib tests green;
  typecheck + lint clean.

All questions are skippable; only answered options shape `interested_categories`.
Wedding (bespoke wizard) untouched.

SPEC IMPACT: None — onboarding content/UX; no schema/SKU/pricing change.
