## 2026-08-01 · feat(ugat): the Person node — the first of the map-backlog closed, and two wrong assumptions caught on the way

Owner picked the person spine as the first backlog concept to map, as one node rather than four. `TYPE-PERSON` ships with three joints, and the map-backlog drops from **44 to 41**.

**The node.** `people` — the durable identity, distinct from a guest. A guest is event-scoped and may never have an account; a person is what a guest resolves *to*. The bond between them is a claim, and a claim sits `pending_review` until a host confirms it, so the guest is provisional until then. It is mapped while still counsel-gated and holding zero rows, because the map documents concepts and the count reads 0 honestly — the same reason an unprobed edge stays unlit rather than green.

**Three joints, each with claims the guard checks against the replayed schema:**
- **J21 · Person ↔ Person** — `person_connections`. `created_by_event_id` is *provenance, not scope*; filtering the graph by it turns a durable family tree back into a per-event guest list.
- **J22 · User ↔ Person (stewardship)** — `person_stewardships`. Stewarding a branch is not owning the people in it.
- **J23 · User → Dependent** — `dependents`.

### Two assumptions caught, which is the point of claim-checking a map

**`households` is not part of the person spine.** It was in the same backlog cluster and reads like it belongs. Its only foreign key is `event_id → events` — it is an **event-scoped guest grouping**. It goes back on the backlog re-filed under GUESTS, with the corrected reason written down. Only reading the live FKs surfaced this.

**J23's first draft asserted a defect that does not exist.** It claimed `dependents.owner_user_id` has **no** foreign key — because a constraint scan scoped to `table_schema='public'` returns *nothing* for this table and reads as "no integrity at all". The claim guard rejected it against the replayed schema, and the truth is worse than the invented finding: `owner_user_id → auth.users(id)` **ON DELETE CASCADE**. Deleting a guardian's account **deletes every dependent record they hold** — a destructive default for a record about a child or an elder, and invisible to any `public`-scoped audit. That is now the joint's recorded trap.

A map that is merely *described* would have shipped both errors. The claims are what made them fail loudly.

**Also fixed: a count of mine that was wrong from birth.** The probe registry comment and the interconnections surface both said the backlog held "47 subsystems". It held 44 — I generated that number with a `grep -c` that swallowed three comment lines, then copied it to a second place. Rather than correct 47 → 41 (stale again next cluster), **the number is gone from both**: the surface prints `PROBES.length` and `UGAT_JOINTS.length`, both derived, and points at the baseline file for the rest. A number in prose has no way to be wrong out loud.

Verified: `tsc --noEmit` clean · all six Ugat guards green (coverage self-greened for the three cleared rows, exactly as its header promises) · 68 `lib/ugat` unit tests green.

SPEC IMPACT: None — map coverage, no product behaviour changed.
