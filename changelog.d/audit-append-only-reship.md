## 2026-07-30 · fix(security): the admin audit trail becomes append-only — and the column list that would have rotted is gone

Closes the security audit's **top finding** (`Admin_Account_Access_Model_2026-06-22`): the admin audit trail was mutable by a privileged actor. RLS denies admin `UPDATE`/`DELETE`, but **the service-role client bypasses RLS**, so a rogue or compromised service path could rewrite or erase the record of its own actions. A trigger is the fix precisely because triggers are **not** RLS — they fire for every role, `service_role` included.

**⚠ Verified still open before writing:** prod has both tables, **zero triggers** on either, and no `enforce_audit_append_only`. Live since 2026-06-22.

### Why this is a re-ship, not a merge of #2048

#2048 wrote this in June and **still merges cleanly today**, so landing it was tempting. It would have shipped a guard with a hole. Its UPDATE carve-out enumerated the content columns *by name* — `action · target_table · target_id · before_json · after_json · reason · created_at · actor_user_id`.

`admin_audit_log` has since gained a **`metadata`** column. An UPDATE rewriting *only* `metadata` satisfies every clause in that list, so it would have been **permitted** — on a table whose entire purpose is that it cannot be rewritten. A hand-kept column list is exactly the shape that rots, and this one already had, in about four months.

So the check here **names no columns**: it compares the whole row as `jsonb` minus the FKs allowed to move. A column added tomorrow is protected the day it is added.

### The cascade carve-out (from #2048 — this part was right)

The actor/subject FKs are `ON DELETE SET NULL`, so deleting a user — including an **RA 10173 erasure** — cascades a SET-NULL *UPDATE* onto these rows. That update must still succeed; a naive append-only trigger blocks it and **breaks account deletion outright**, which is worse than the finding being open.

`DELETE` is refused unconditionally. `UPDATE` is refused unless it is exactly the anonymisation: every non-FK column identical, each FK either unchanged or newly NULL. An FK moving from one user to another is still refused — **clearing is erasure, reassigning is forgery.**

### Tests

New `tests/db/audit-append-only.db.test.ts` — 7, including an end-to-end `DELETE FROM auth.users` proving the cascade survives the trigger. Suites: **659 db**, **5637 unit**, lint + `migration:check` clean.

**Neutralisation, run not asserted:** re-introducing #2048's blind spot (excluding `metadata` from the comparison) turns **exactly one** test red — the `metadata` one. The hole is demonstrated, not argued.

⚠ A third table adopting this trigger without declaring its FK columns gets the **strictest** behaviour (nothing may change), never the loosest — fail-closed on the unknown case.

SPEC IMPACT: closes the 2026-06-22 audit's top finding. Recorded in `DECISION_LOG.md`.
