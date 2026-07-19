# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(db): `people` table — Phase 1 foundation of the person-spine model

Owner greenlit Phase 1 ("build it until complete and live"). This lands the **foundational durable person node** — additive, adults-first, **no data seeded, no existing table altered, no connections.** Connections (family tree · ninong/ninang · friends), life stories, and legacy remain Phase 2/3 and **counsel-gated** (not in this migration). Plan: `03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`.

- **`supabase/migrations/20270513460125_person_spine_people_table.sql`** (new) — `public.people`:
  - `id BIGSERIAL` (hidden) · `person_id UUID` · `public_id TEXT DEFAULT public.generate_public_id('P')` (**S89P-**) · name/email/phone/photo · `birth_date` (the adults-only gate) · `claimed_by_user_id UUID UNIQUE → users(user_id)` (NULL = unclaimed; **1 account ↔ 1 person**) · `created_by_user_id → users(user_id)` · timestamps + `deleted_at`.
  - **RLS at CREATE-TABLE time, owner-only + admin, deny-by-default:** a node is visible only to its **claimer** (`claimed_by_user_id = auth.uid()`), its **creator** (`created_by_user_id = auth.uid()`), or `public.is_admin()`. The graph is private; who-can-see-whom is a Phase-2 connections concern with its own table.
  - `people_set_updated_at` trigger · `lower(email)` partial index (match-on-signup anchor) · `created_by` partial index.

**Verified against prod in a rolled-back transaction:** full migration applied cleanly (table + FKs + `generate_public_id('P')` + `is_admin()` policies + trigger + indexes), a row inserted with a generated `S89P-` id, then `ROLLBACK` — `to_regclass('public.people')` confirmed null (nothing persisted; the real apply happens on merge via `supabase-migrations.yml`). Migration is idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS`).

SPEC IMPACT: None new — Phase 1 foundation of the locked person-spine plan; additive schema only.
