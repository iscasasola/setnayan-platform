## 2026-06-22 · feat(vendors): auto-invite the coordinator when their downpayment is marked

Owner: a coordinator's planning access should turn on automatically once the booking is locked (downpayment paid), not via a manual click. The Hosts page already offers a one-click "Promote your coordinator" once a `planner_coordinator` booking is `deposit_paid`+; this fires that same grant **automatically** on the downpayment milestone.

- **`lib/coordinator-grant.ts`** (new) — `autoInviteCoordinator(admin, …)` creates the same pending delegate the manual Promote does: role `wedding_planner_external` with `COORDINATOR_AREAS` (full planning edit · mood board view · **budget OFF**). The coordinator activates it via the existing `/host/accept` link, so access is **never granted without their acceptance**. **Idempotent** — skips if an active wedding-planner delegate for that email already exists (re-marking payment, or a couple who already clicked Promote, never spawns a duplicate).
- **`vendors/actions.ts` `updateVendorStatus`** — on the FIRST transition into a downpaid/booked state (`!wasConsuming && willConsume`) for a `planner_coordinator`, calls the helper. **Best-effort** (try/catch, after the status write) so a failed invite never rolls back the booking change. Snapshots `contact_email` for the invite.

No schema change (reuses `event_moderators` + the existing accept flow). No money exposure — `COORDINATOR_AREAS` keeps budget off, same as the manual path. SPEC IMPACT: iter 0048/0006 — coordinator access now auto-fires on the downpayment lock. Logged in corpus DECISION_LOG.
