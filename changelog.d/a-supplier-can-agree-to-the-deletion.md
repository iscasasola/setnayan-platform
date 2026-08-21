## 2026-08-21 · feat(events): a supplier you have paid can agree to the deletion

Owner 2026-08-21: *"they can only delete it if the vendors with paid purchase
accepts that this deletion."* PR #4632 shipped the safe half — a paid, unreleased
supplier **blocks** the delete. This is the way through: the ask, and the answer.

🔑 **RULE 0 — THE OWNER SAID THE PLAN ALREADY EXISTED AND HE WAS RIGHT.** The lock
handshake is the shape, and this reproduces it rather than inventing a second one:
a TEXT state machine on `event_vendors`, SECURITY DEFINER RPCs the browser cannot
forge, and a **cancel path that ships beside the ask and is actually called** —
`cancel_vendor_lock_request` was granted, commented, db-tested and had ZERO CALLERS
for its whole life, so a couple could not un-ask.

⚠ **Separate columns from the lock ones.** A booking can be locked AND carry a
pending deletion ask; overloading `lock_request_state` would make "agreed" mean two
things. The lock machine is untouched.

🔑 **Ownership is narrowed the way `vendor_agree_to_lock` learned to be.** Its own
comment states the rule — *"when an RPC becomes the sole authority for a booking,
its ownership predicate may not key on a column the counterparty controls"* —
because `service_id` is writable by the COUPLE. Here the counterparty **is** the
person asking to delete, so the answer keys on `marketplace_vendor_id` alone.

**The gate now releases on an agreement**, ahead of every derived signal: a supplier
who has said yes has said yes, whether or not the day has passed. And the couple's
refusal screen grew a door — **"Ask them to agree"** — shown only when suppliers are
what is holding it, so it is never a button to nothing.

### 🪤 Four traps, all self-inflicted, all caught by measurement

1. **`REVOKE UPDATE (cols)` WAS COMPLETELY INERT.** `authenticated` holds
   TABLE-LEVEL UPDATE, and a column revoke cannot subtract from that —
   `has_column_privilege` kept returning TRUE. Replaced with a trigger, which is
   what this repo's own rule prescribes.
2. **THE FORGERY TEST RAN WITH NO IDENTITY.** Only `SET ROLE authenticated`, so
   `auth.uid()` was null, RLS matched nothing, the UPDATE hit zero rows and the test
   passed — **because RLS denied an anonymous caller, not because the guard worked.**
   Now seeds a real couple member and ASSERTS `auth.uid()` before trusting anything.
3. **AN EDIT DELETED THE FORGERY ATTEMPT ITSELF**, leaving a test that asserted an
   outcome nobody had tried to change. Caught by a mutation staying green, then a
   direct probe proving the forgery succeeds when the trigger is disabled.
   **A test that asserts an outcome must first perform the ACT.**
4. **ASSERTING A THROW WAS WRONG.** Under RLS the UPDATE resolves with zero rows —
   an RLS denial and a no-op are the same value — so `assert.rejects` failed while
   the data was perfectly safe. Asserts the OUTCOME now: the field did not move.

**Guards:** 4 db + 2 unit. Mutations: UPDATE-branch **RED**, agreement-releases
**RED**, pending-treated-as-agreed **RED**, state CHECK **RED**, withdraw removed
**RED**.

⚠ **THE INSERT BRANCH IS DEFENCE IN DEPTH AND IS NOT PROVEN.** Measured: a session
INSERT is refused by a PRE-EXISTING guard first, so disabling my branch leaves the
test green. Kept anyway — the lock guard carries the identical branch and says why:
`event_vendors_couple_write` is FOR ALL, so if that other guard is ever narrowed, a
row BORN 'agreed' manufactures consent without an ask. Documented rather than
deleted for a tidier mutation table.

📋 **Exposure baseline regenerated and reviewed line by line:** 6 columns inheriting
`event_vendors`' existing table grants (writes blocked by the new trigger, reads by
RLS) and 3 `authenticated`-only SECURITY DEFINER functions.

⏭ **NOT in this PR:** the vendor-side screen where a supplier SEES and answers the
ask. The RPC is callable and the state machine is live; nothing renders it yet.
**A granted RPC nothing calls is a gate with no handle** — this one has a couple-side
caller, and the supplier-side surface is the next slice.

SPEC IMPACT: `DECISION_LOG.md` — 2026-08-21 row (the handshake, and the owner's
"vendors get to keep it" ruling on shared records).
