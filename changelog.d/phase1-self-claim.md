# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(db): self-claim — every account gets its own person node (Phase 1)

Owner: "finish Phase 1 first" (2026-07-05). Establishes the **account ↔ person** link: every account holder IS a person. Adults-only, additive, **no counsel gate**. This is the prerequisite the connections graph (Phase 2, counsel-gated) and match-on-signup build on. Plan: `03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md`.

- **`supabase/migrations/20270513691781_person_spine_self_claim_trigger.sql`** (new):
  - `public.ensure_person_for_user()` — `SECURITY DEFINER` (search_path pinned to `public`) trigger fn that, on `public.users` INSERT, mints the account holder's own **claimed** person node (`claimed_by_user_id = created_by_user_id = NEW.user_id`, seeded from their profile: display_name / email / phone / photo / birth_date). Idempotent via the `claimed_by_user_id` UNIQUE constraint (`ON CONFLICT DO NOTHING`).
  - `ensure_person_for_user` trigger — `AFTER INSERT ON public.users`.
  - **Backfill** — mints a claimed person node for every existing non-deleted account (idempotent).

**Verified against prod in a rolled-back transaction:** fn + trigger created, backfill ran over real users, a second backfill inserted 0 (idempotency proven), then `ROLLBACK` — `people` back to 0 rows (nothing persisted; the real backfill runs on merge). Now that the migration pipeline is unjammed (DECISION_LOG 2026-07-05), this applies cleanly.

SPEC IMPACT: None new — Phase 1 of the locked person-spine plan; additive, adults-only.
