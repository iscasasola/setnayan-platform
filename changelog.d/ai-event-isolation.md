## 2026-07-22 · feat(taxonomy): event-isolation reach matrix + Tournament → ₱99

The vendor taxonomy had **56 of 73 leaves = `applicable_event_types` NULL (universal)**, so every event type "covered" 89–100% of the wedding category set — the reach differences the per-type AI pricing assumes were unenforced (a birthday effectively offered as much as a wedding). This writes the TRUE per-event-type reach the owner designed (2026-07-22 · study `Setnayan_AI_Event_Reach_Matrix_Study_2026-07-22.md`).

**Migration `20270832295038_setnayan_ai_event_reach_matrix.sql`:**
- Scopes 72 coarse `service_categories` **tiles** to their true event-type set (grouped into 30 UPDATEs). Fine canonicals inherit via `vendor-coverages.ts` (own override → tile scope), so all 270+ canonicals get isolated without touching each. New reach as % of Wedding: Wedding 100 · Debut 83 · Corporate 76 · Anniversary 68 · Birthday/Celebration 67 · Graduation 65 · Reunion 63 · Christening 62 · Gender-reveal 44 · Tournament 25 · Travel 16 · Dinner-Date 8.
- **Isolation (machine-checked):** a wedding can't be completed elsewhere (6 wedding-only leaves — marriage paperwork, bride/groom attire, bridal car, honeymoon, wedding singer — + 4 rite leaves shared only with christening); a debut can't be done as a birthday (12 exclusive leaves).
- **`livestream` → `marketplace_hidden`** — it's the in-app Live Studio (Panood); owner: *"we won't sell services similar to our in-app services."* (`led_wall`/`photo_booth` kept — physically distinct from Live Background/Papic.)
- **`accommodation` → Travel + Wedding** (canonical override; it already exists in the enum + canonical taxonomy, previously unscoped).

**Owner edits folded in:** booths reach christening + gender-reveal; christening carries no band-heavy program; dinner date += cake.

**Tournament AI price C → D (₱499 → ₱99):** at ~25% reach it's a few specialized vendors (referee/medic/insurance/trophies), not a standard-event spread. Travel stays C (₱499) — its low count buys the bespoke itinerary engine (owner call 2026-07-22). `lib/setnayan-ai-type-pricing.ts` + test updated.

INERT on live pricing until the owner flips the per-event-pricing flag (PR #3485). The taxonomy scoping takes effect on `supabase db push`; it only bounds which vendor categories surface per event type — no code path changes.

Typecheck + lint + build clean; full unit suite green (2548); migration-doctor 10/10 + timestamp + entitlement + retired-strings guards clean.

SPEC IMPACT: Applied — `Setnayan_AI_Event_Reach_Matrix_Study_2026-07-22.md` (the matrix), DECISION_LOG 2026-07-22, memory `project_setnayan_ai_per_type_pricing` (Tournament → D). Supersedes the 89–100% universal-flood coverage.
