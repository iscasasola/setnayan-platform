## 2026-07-16 · feat(admin): NPC pre-filing readiness tracker

Adds `/admin/npc-readiness` — the completeness audit's Tier 0-3 checklist (15 deduped tasks) as a tracked worklist the owner + DPO work down before lodging with the National Privacy Commission. Council verdict `NPC_Filing_Readiness_Tracker_Council_Verdict_2026-07-16.md`.

- `npc_filing_tasks` table (admin-only RLS via `is_admin()`, seeded with the 15 tasks) — cloned structurally from the Data Privacy board but **NOT a gate**: nothing reads task status to flip a capability.
- `lib/npc-filing-tasks.ts` — the 15-task catalog (mirrors the seed) + `fetchNpcFilingTasks` (DB-over-catalog merge). Committing the catalog to code is the durability fix the audit flags (W6). No `isActive`-style gate function.
- `app/admin/npc-readiness/{page,actions}` — tier-grouped task cards with status (not_started / in_progress / blocked_on_counsel / resolved / n_a) + note + evidence.
- **Anti-false-assurance is structural, not cosmetic** (council §5): the header can only read "counsel review outstanding — NOT cleared to file" until `t0-1` resolves; counsel-gated tasks can't resolve without a written counsel reference in the note; the FILE-the-DPS task (`t3-13`) can't resolve until `t0-1` is resolved; a standing NOT-FILED banner + pinned blocker strip never disappear.
- Doorways (both, or it orphans): sidebar nav item beside Data Privacy + a card in the `/admin` overview "More queues" grid (new `list-checks` Tile icon).

Gates: tsc 0 · next lint clean.

SPEC IMPACT: logged in `DECISION_LOG.md` (2026-07-16) + the council verdict doc. Links the completeness audit `NPC_Submission_Completeness_Audit_2026-07-16.md`.
