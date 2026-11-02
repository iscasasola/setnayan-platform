## 2026-08-02 · sec(erasure): ten more tables settled — and the over-deletion guard was relying on luck

Ten more of the erasure backlog, settled one table per agent against the generated FK map and each attacked independently. **10 of 10 survived.** Backlog **67 → 57**.

### ⚠ The proposal would have revoked a working coordinator's access

`event_delegates` was proposed as a row-delete on **all three** of its user columns. But the row is about the **delegate** — deleting it because the subject merely *granted* the access destroys the coordinator's row, not the leaver's.

The schema settles it without argument:

```
event_delegates.delegate_user_id       CASCADE   NOT NULL   ← the row is ABOUT them
event_delegates.granted_by_user_id     SET NULL  nullable   ← an actor stamp
event_delegates.revoked_by_user_id     SET NULL  nullable   ← an actor stamp
person_stewardships.steward_user_id    CASCADE   NOT NULL   ← subject
person_stewardships.created_by_user_id SET NULL  nullable   ← stamp
```

Split accordingly: **2 subject-row deletes, 9 author-stamp nulls.**

### 🪤 The test for it did not work, and the reason is the interesting part

Test `2q` seeds two delegations — one where the subject is the delegate, one where they merely granted it — and asserts only the first is deleted. Reintroducing the over-broad delete **did not fail it.**

`purge.ts` runs the null loop *before* the delete loop, so a column in both lists is nulled first and the delete then matches nothing. **The third party's access survived only because of loop order.** Swap those two loops and the over-deletion is live again with every test still green.

So the protection was made structural — **G6**, four new assertions:

- no column may be in both lists (ordering must never be load-bearing)
- a row-delete column must be one the schema marks `CASCADE`
- a nulled column must not be `CASCADE`
- every exception must be real and argued

G6 immediately failed on `vendor_web_dossiers.requested_by`, shipped in [#4047](https://github.com/iscasasola/setnayan-platform/pull/4047) an hour earlier. The delete is right — the row is a snapshot of the subject's *own* profile — and its `SET NULL` is an unexamined default. Rather than bend the rule, non-CASCADE deletes now require a written argument in `DELETE_ON_NON_CASCADE`. `ON DELETE CASCADE` is only evidence that someone *applied* the actor-or-subject test, which is true of the 30 columns `20271032282809` classified and guaranteed of nothing older.

### Two deliberately excluded

- **`blocked_users`** — erasing a block would silently **un-block** someone, restoring contact the counterparty may have cut off for their own safety. Their safety outranks the tidiness of the subject's row.
- **`creator_applications`** — **does not exist in production.** Created by `20270813536704`, dropped by `20270815042234`. The parser sees it because it unions every `CREATE TABLE` ever written; prod has zero columns for it. A phantom entry that made the backlog look worse than it was.

All 12 columns exact-matched against `prod-schema.snapshot.txt`.

Verified: full DB suite **752/752**, erasure guards **31/31**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — ten more gaps closed in an existing RA 10173 obligation.
