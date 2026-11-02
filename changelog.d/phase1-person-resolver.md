# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(db): unified person resolver + guest seeding (Phase 1)

Owner: "finish Phase 1 first / keep going" (2026-07-05). Unifies **self-claim + sign-up matching + guest seeding** into ONE email-keyed resolver so a person's history follows them across events. Adults-only, additive. Connections / life-stories / legacy (Phase 2/3) stay counsel-gated and are NOT here. Plan: `03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`.

- **`supabase/migrations/20270514555975_person_spine_unified_resolver_and_guest_seeding.sql`**:
  - **`public.resolve_or_claim_person(email, …, p_claimer, p_creator)`** — the single resolver: *find* a person by email → *claim* it for `p_claimer` if unclaimed (the "your history was waiting" moment) → else *create*. Race-safe (retry loop on `unique_violation`). **Name-only guests (no email, no claimer) return NULL** — a weak signal that waits for an explicit "is this you?" confirm; never auto-merged.
  - **Person-per-email guarantee** — a partial `UNIQUE` index on `lower(email)` (verified 0 dups in prod first; replaces slice-A's non-unique index). This is the dedup backbone.
  - **`ensure_person_for_user` refined** to route through the resolver (supersedes the naive always-insert from `20270513691781`): a new sign-up whose email was already seeded as a guest now **claims** that node instead of failing the unique index.
  - **`guests.person_id`** FK + index; **`set_guest_person`** `BEFORE INSERT OR UPDATE OF email` trigger auto-links email-having guests to their person node (name-only guests stay unlinked); **backfill** links existing email guests — deduping with each other and with account nodes.

**Verified exhaustively against prod in rolled-back transactions:** (1) full migration + backfill over real guests with assertions — the **claim path** (free a user → create unclaimed node → claim it: one node, correct owner), **dedup** (same email → same id), and **name-only skip** all passed; (2) the `guests` trigger DDL validated separately. Both `ROLLBACK`s left prod clean (19 people, no `person_id` column). Idempotent throughout; migration-timestamp guard green.

SPEC IMPACT: None new — Phase 1 of the locked person-spine plan; additive, adults-only, email-anchored (implied consent), name-only deferred to confirm.
