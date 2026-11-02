## 2026-08-02 · fix(privacy): a coordinator can announce to your guests — the notice never said so

The follow-up the per-clause audit turned up (`Privacy_Per_Clause_Honesty_Audit_2026-08-02.md` §4).
Enumerating `CONTROL_COVERAGE` showed **six** controls with an empty `declaredIn`, not the three
already handled — the other three are **`coordinator_run_of_show`, `coordinator_day_of_broadcast`
and `coordinator_requests_inbox`**, all **active in production**.

**Why they were missed.** DPS-14 declares the coordinator's *consent scopes* and *prep-then-release*
— what a coordinator may **see** and stage. These three are where a coordinator **acts**, and two of
them act outward. Reading the shipped code and the migration rather than the spec:

- **Day-of announcements** (`coordinator_broadcasts`, migration `20270825364600`) are read by
  **everyone on the event under RLS Pattern B member read — the couple, the vendors, and the
  guests.** Body is capped at 500 characters, the row is immutable, and the sender is recorded. So a
  coordinator can push a message straight to the couple's guests, and `/privacy` described the
  coordinator's *read* access in detail while never mentioning this.
- **The requests desk** (`event_day_requests`) collects what people raise on the floor.
- **The filtered run-of-show** is the opposite of an exposure — a vendor sees only blocks they are
  tagged responsible on — so it needed declaring, not disclosing.

**Fixed:**
- `/privacy` §"Coordinators you invite (delegated access)" gains two paragraphs — announcements
  (who receives them, the 500-char cap, immutable and attributed, never leaves the event) and the
  requests desk (what it holds, event-scoped, deleted with the event).
- RoPA **DPS-19** declares all three as one activity, and says plainly why it is separate from
  DPS-14. It records the two properties worth keeping: the run-of-show filter is a genuine
  **minimisation**, and **no acknowledgment tracking was built**, so reading an announcement is not
  recorded against a guest.
- The three coverage notes now point at DPS-19. `declaredIn` stays **empty** on all three for the
  same reason as the others — it claims declaration in the shipped ROPA **PDF**, which is
  regenerated in January 2027.

Verification: `lib` unit suite **6038 pass / 0 fail**; both changed files parse clean via the
TypeScript compiler API. ⚠ Full `tsc --noEmit` still cannot run on this machine (heap exhaustion);
**no green typecheck is claimed** — CI is the authority.

SPEC IMPACT: RoPA gains DPS-19. No control status changed, no data-handling change — disclosure only.
