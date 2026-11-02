## 2026-08-01 · sec(rpc): close seven functions any holder of the publishable key could call — two of them destructive

**Anyone with the public key that ships in the browser bundle could delete chat threads and mint vendor tokens.** No account, no session.

### How this was missed

The security work has been auditing **row-level security policies**. It emerged today that the guest-facing surface largely does not go through RLS at all: guests read their seat through SECURITY DEFINER functions while the underlying tables grant `anon` nothing. A policy audit therefore *cannot* see this class — it concludes "anon cannot read this table", which is true about the table and false about the product.

**297 functions in `public` are SECURITY DEFINER; 211 were anon-callable.** The 33 touching sensitive data with no identity check were read in full and adversarially re-tested — 12 findings were knocked down, 8 survived. Seven are fixed by a grant and are in this PR.

### The two that mattered most

**`purge_expired_chat`** — I read the body: its only check is `p_years >= 1`. One call with `{"p_years": 1}` hard-deletes every chat thread on events older than a year with no orders, cascading into eight child tables. It returns a row count, so it doubles as a free "how much data do you have" probe.

**`redeem_vendor_token_voucher`** — the uniqueness key is per-**vendor**, not per-code, so one leaked code credits tokens again for every vendor id supplied. The live code (50 tokens, unlimited uses) is expired but still `is_active`. **It had no caller at all** — reachable and useful to nobody but an attacker.

Also closed: `claim_unlock_vendor_event` (no authorization in the body; its two siblings both check ownership), `subscriptions_due_for_renewal_reminder` (200 soonest-expiring subscriptions with buyer email), `papic_event_pool_status` and `papic_event_owns_service` (both treat an **event id** as a credential — event ids sit in guest-facing URLs), and `detect_self_review_signal` (answers "do these two people share a household?" — keeps `authenticated`, loses `anon`).

### Revoking is safe — verified per function, not assumed

Every caller was located by its actual `.rpc(...)` call site. Six of seven are invoked **only with the service-role client**, which bypasses grants entirely. Two have no caller at all. The seventh runs on the user's own session and keeps `authenticated`.

### What I deliberately did NOT do

The audit also called `vendor_completed_events` an anonymous bulk-read of the vendor–client list. **Revoking it would have broken a real public feature:** `fetchVendorCompletedEvents` always filters to one vendor and renders that vendor's dated track record on their public page — social proof, public by design. The real issue is that it exposes `event_id`, and three functions treated an event id as a secret. **Event ids are not secret.** So the fix belongs at those functions, which is what §1 does. Left alone on purpose.

`papic_grant_camera_points` is not fixed here either. A signed-in buyer can write the grant row the admin approval hook would have written, before paying, because the Papic ownership check counts `draft` / `submitted` / `awaiting_payment` as owned. That is a **paywall logic change under apply-then-pay** — its own PR, its own tests.

### Why a one-off revoke was not enough

Several of these functions **already had a REVOKE in their defining migration.** It did not last: a later `CREATE OR REPLACE` in a different migration re-applied Supabase's default privileges, and nothing re-asserted it. A REVOKE is a point-in-time act.

So this ships with `tests/db/anon-rpc-surface.db.test.ts` — the surface is **derived from the live catalog** and every member must appear in a baseline with a written reason. Same shape as the Ugat concept baseline: you may allow a function, but only on purpose.

⚠ **Anon-callable is not automatically a bug** and the guard does not pretend otherwise. This product deliberately gates guests on secret tokens rather than sessions; `public_seat_lookup` *should* be anon-callable. The baseline records which are deliberate.

The seeded state is honest: **190 of 195 are marked `unreviewed`** — filtered out as lower-risk by a heuristic, not cleared by a human. That is a debt figure, like `map-backlog`, and it should shrink.

The guard also names the seven closed today individually, so a regression reads as *"this specific hole reopened"* rather than *"the surface grew"*.

Verified: migration guard green (1014) · **full DB suite 698/698** · signatures checked against `pg_get_function_identity_arguments` first — the initial draft had one wrong signature and omitted the voucher function entirely, and a wrong signature fails the whole migration.

SPEC IMPACT: None — access hardening. No product behaviour changes; every real caller uses a client that ignores these grants.
