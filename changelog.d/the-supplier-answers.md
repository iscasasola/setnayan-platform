## 2026-08-21 · feat(vendor): the supplier can see the deletion ask, and answer it

The handshake shipped with its database half live and **nothing rendering it** —
a supplier could be asked and could not reply, so the couple was blocked forever
by a question nobody knew had been asked. This is the answer.

**RULE 0:** `grep delete_request_state apps/web` returned three places, none of
them supplier-facing. Not a rebuild. The surface extended is the vendor
Overview's **"What's new"** decision feed, which already renders the identical
shape (couple asks → supplier agrees inline, or declines behind a `<details>`).

### What the supplier reads
Danger red, not amber — the lock card asks *"will you take this booking?"*, this
one asks *"may this celebration be erased?"*, and a mistaken tap is not
symmetric. It states the fact and the date, then the two things needed to decide:
**their record is kept either way**, and **nothing is removed until they answer**.

🔒 **NO AMOUNT** (owner D1) — the figure is the COUPLE's ledger entry and may not
match what the supplier banked; a wrong number starts a dispute.
⏳ **NO DEADLINE** (owner D3) — an unanswered ask stays open forever with one
reminder. There is no fuse to show because there is no fuse; anything that
auto-agreed would manufacture a consent nobody gave.

### 🔴 Corrections that changed the plan
1. **A TS-only notification type would have failed SILENTLY.** `notification_type`
   is a Postgres ENUM; a union member typechecks and then the INSERT fails at
   runtime, and `emitNotification` only `console.error`s it. Migration
   `20271152428061` adds the four values — **its own file, no transaction**,
   because Postgres forbids using a new enum value in the transaction that adds
   it.
2. **THE ASK TOLD NOBODY.** `askSuppliersToAgree` marked rows and spoke to no
   human. It now notifies every seat of every asked shop.
3. **`withdrawSupplierAsk` HAD ZERO CALLERS** while its own docblock read *"SHIPS
   BESIDE THE ASK, AND IS CALLED"* and cited `cancel_vendor_lock_request` — the
   granted, tested, uncallable RPC — as the thing not to repeat. Written in the
   same breath as the warning. The Withdraw button is now in the couple's menu
   and the docblock says what is true.
4. 🚨 **THE LOCK CARD NEVER SHOWED A DATE, AND STILL DOES NOT — FIXED HERE TOO.**
   `fetchLockAgreementRequests` ran in the SAME `Promise.all` as
   `fetchEventMeta`, so its event ids could never be in the meta set: every card
   asking a supplier to commit to a day rendered `eventDate: null`. Both request
   fetches now run first and feed the meta lookup.
5. **`no_pending_request` DOES NOT MEAN "WITHDRAWN"** — the RPC returns it for
   cancelled, agreed, declined AND never-asked. The state is read back and the
   four are told apart, rather than telling a double-tapping supplier a lie.
6. **The lock fetch's status floor is NOT copied.** It excludes
   contracted/deposit_paid/delivered/complete; the deletion ask goes *precisely*
   to paid suppliers, so copying it would exclude every row the feature exists
   for. The other two floors (covered cascade lines, archived rows) DO apply.

**Guards:** 6 assertions. All 7 sabotages mutation-checked, counts printed before
→ after, all RED.

🪤 **Two sabotages went green first and both were my measurement, not the guard.**
`agreeDeletion={agreeDeletion}` appears at TWO seams, so `assert.match` was
satisfied by either — now COUNTED, expecting 2. And a marketing-gate mutation
inserted into the wrong set because `new_chapter_from_followed` appears in both;
retargeted to the gated block. **Scope a mutation to the block you are testing.**

⏭ **NOT in this PR:** the one reminder for a supplier who never answers (owner D3
says exactly one), and Part B — vendor data surviving a deletion.

SPEC IMPACT: `BUILD_SPEC_Supplier_Answers_And_Vendor_Data_Survives_2026-08-21.md`
Part A is now built.
