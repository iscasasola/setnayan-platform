## 2026-07-22 · feat(events): register Date + Hangout event types; gala_night → ₱999

Closes the loop the reach study left open. The narrow "dinner_date" proposal became **two** casual-outing types the owner named (2026-07-22): **Date** (romantic — dinner/lunch/movie dates) and **Hangout** (casual — barkada dinners, coffee, movie nights). "Outing" was rejected (reads as travel).

**Migration `20270902999627`:**
- Registers `date` (💕) + `hangout` (🍿) in `event_type_vocab` (the table the `applicable_event_types` trigger validates against — this is why the earlier `dinner_date` reference was rejected). No profile rows — both fall back to `GENERIC_PROFILE`, same as `gala_night`; bespoke terminology/onboarding is later polish.
- Scopes their true reach (guarded, idempotent appends): **Date** → restaurant reservation · florist · cake · souvenir; **Hangout** → restaurant reservation · cake · souvenir · photo_video. Vocab is inserted before the scoping so the trigger passes.

**Pricing (`lib/setnayan-ai-type-pricing.ts`):**
- `gala_night` **C → B (₱999)** — owner-locked; its 84% reach is Debut-level.
- `date` / `hangout` → **D (₱99)** — short casual outings.
- Dropped the obsolete `dinner_date` map entry (superseded by date/hangout).

Both are Tier D, marketplace-enabled, ~4 categories each — the reservation-centred "short gathering with recommended vendors" shape from the composable model. Migration applies automatically on merge (`supabase-migrations.yml` runs `db push --include-all`).

Typecheck + lint + build clean; full unit suite green (2568); migration-doctor 10/10 + timestamp clean.

SPEC IMPACT: Applied — the reach-matrix study's open "dinner_date name" question is resolved (Date + Hangout); DECISION_LOG 2026-07-22; memory updated. `dinner_date` retired as a name.
