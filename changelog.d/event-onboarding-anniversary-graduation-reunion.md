# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(onboarding): author anniversary / graduation / reunion into the generic per-type flow

The generic `/onboarding/[type]` engine (iteration 0053) is data-driven: 8 non-wedding types (birthday, debut, gender_reveal, christening, corporate, tournament, travel, celebration) had authored content while **anniversary, graduation, and reunion had none** — they fell back to `GENERIC_PROFILE` (organizer_noun "host") + a taxonomy-top-N plan + no signature questions. This authors those three to parity, grounded in the 2026-07-12 per-event research dive (`Event_Onboarding_Signals_All_Types_2026-07-12.md`).

- **`lib/onboarding/type-questions.ts`** — added 4 signature "signature moment" questions per type (single-select tiles whose `adds` map to real taxonomy category ids): anniversary (ceremony · tribute/"then & now" · look · food), graduation (thanksgiving · feast · keepsake · vibe), reunion (who's-gathered · program · feast · matching-shirts). Every `adds` slug reuses ids already proven in the existing packs.
- **`lib/onboarding/persona-packs.ts`** — added a full persona pack per type (`essentials` + all 6 personas' `byPersona` extras + `servicesByPersona`), so each resolves a type-appropriate plan instead of the wedding-shaped taxonomy order. Service keys all in `VALID_SERVICE_KEYS`.
- **`supabase/migrations/20270731100000_seed_remaining_event_type_profiles.sql`** — seeds `event_type_profiles` for the three (per-type terminology + generic surface set + `onboarding_flow_key`), idempotent `ON CONFLICT DO NOTHING`, mirroring the Phase-3 non-wedding seed. `gala_night` is excluded (no vocab row).
- **Tests** (`type-questions.test.ts`, `persona-packs.test.ts`, `persona-packs.services.test.ts`) — extended `ENABLED_TYPES` 8→11 and moved the "unauthored type" example assertions from `anniversary` to `gala_night`.

No new UI, no renderer change, no taxonomy migration (applicability is fail-open → categories are universal by default). Live behind `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` (already on).

This is the LIGHT (within-template) authoring for these types. The RICH per-type onboarding (uncapped rosters — the debut "18s", reunion family-branches/awards, the anniversary retrospective/surprise-mode, milestone-year-as-data) is a separate framework track that supersedes/enriches this content later (needs multi-select/numeric/conditional/roster question kinds + raw-answer persistence — see PR #3144 "signature_details" foundation + the per-type culture-catalog design).

Verified: `tsc --noEmit` clean; onboarding unit suites (type-questions, persona-packs, persona-packs.services, onboarding-spec) green.

SPEC IMPACT: Completes onboarding coverage — all enabled non-wedding event types now have authored signature questions + persona packs (was 8/11). No pricing/schema-of-record change. See `Event_Onboarding_Signals_All_Types_2026-07-12.md` + memory `project_setnayan_event_onboarding_signals`.
