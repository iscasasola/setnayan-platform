## 2026-08-04 · sec(bookings): a couple can no longer write "the vendor delivered this" onto their own booking

Three closures on `event_vendors`, plus two dead `anon` grants. Scoped by a 10-agent scope-then-attack run — the scope of what is **deliberately excluded** is the more important half.

**1 · The completion columns were couple-writable.** `service_marked_complete_at`, `completion_status`, `customer_confirmed_received_at` and `completion_disputed_at` record *which party did what* — the vendor marking a service delivered, the couple confirming receipt, the couple disputing it. Every legitimate writer runs as **service_role** (verified by reading all four call sites; a repo-wide grep for a session-client write of these columns returns nothing). But the couple holds a table-wide UPDATE grant plus a column-unrestricted RLS policy on their own event's rows — so they could simply write *"the vendor marked this delivered"* themselves. New non-DEFINER guard trigger refuses it from `authenticated`/`anon`, on both verbs.

**2 · The existing deposit-ack guard had an INSERT hole.** `event_vendors_guard_deposit_ack` was `BEFORE UPDATE` only, so `deposit_acknowledged_at` — the column that means *the vendor confirmed your payment* — could simply **arrive already set** on a couple-authored INSERT. The forgery it exists to prevent, through the one verb it did not watch. Widened to `BEFORE INSERT OR UPDATE`, with the INSERT branch testing the value rather than a diff against a NULL `OLD`.

**3 · Two dead `anon` EXECUTE grants**, both on SECURITY DEFINER functions that write a confirmed booking status. Neither is reachable by anon in practice (one gates on `current_couple_event_ids()`, empty for a NULL `auth.uid()`; the other refuses a NULL `auth.uid()` outright), so this removes dead surface rather than closing a breach — but *"the gate happens to save us"* is a weaker guarantee than *"anon cannot call it"* on the one surface where a bug mints a booking. **Anon-callable SECDEF register: 217 → 215.**

**⛔ What this deliberately does NOT do: guard `event_vendors.status`.** That was scoped and **rejected**, and the reasons are worth keeping:
- **Seven** legitimate couple-facing writers set a confirmed status while running as `authenticated` — a role-keyed guard there refuses every real lock.
- The package lock is a **multi-row INSERT**; a per-row RAISE rolls back and **deletes the booking**.
- With the payment-gated lock on, money reaches the vendor **before** the blocked write — a couple could pay and be left with no booking.
- And the owner's rule forbids repurposing `status` for handshake meaning, so it is **not** becoming the "vendor agreed" column. The premise was wrong.

That guard belongs in PR-H, keyed on the vendor's own `lock_agreed_at` stamp. Full reasoning: `Six_State_Mount_and_Forgery_Guard_SCOPE_2026-08-04.md`.

**Two traps this migration is shaped around:**
- **The guard functions are SECURITY INVOKER on purpose.** Inside a DEFINER function `current_user` becomes the owner, so the role test never matches and the guard is **permanently inert while looking correct**. Every sibling guard here is non-DEFINER for the same reason; a comment says so, because "hardening" it with DEFINER is the obvious wrong move.
- **`vendor_claim_locked_qr` is `(text, uuid)`, not `(uuid, text)`.** Signatures were read from prod via `pg_get_function_identity_arguments`. A REVOKE against a wrong signature does not error — it silently revokes nothing.

Both baselines regenerated **in this PR** (the exposure freeze fails on narrowings, not just widenings). The migration ends with a `DO` block asserting the objects — both triggers installed, both firing on INSERT, both grants gone — because every statement in it has a quiet failure mode.

SPEC IMPACT: None — no product behaviour changes. Logged in `DECISION_LOG.md` as a security closure.
