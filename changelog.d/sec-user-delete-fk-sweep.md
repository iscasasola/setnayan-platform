## 2026-08-01 · sec(db): deleting a user was refused by 21 foreign keys, not one — the class fix, plus the guard that makes it stay a class

Earlier today, migration `20271028166046` fixed **one** of these: `vendor_ig_oauth_state.initiated_by` had no `ON DELETE` clause, defaulted to NO ACTION — *refuse* — and three abandoned Instagram handshakes were blocking the owner's own account from deletion.

**That fix was correct and incomplete.** It treated an instance as an instance. Nobody asked whether it was a class until a later sweep tripped over a second one, at which point the real query took ten seconds:

```sql
SELECT conrelid::regclass, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE contype='f' AND confrelid='auth.users'::regclass AND confdeltype='a';
```

**Twenty-one rows.** This is the general form of the already-known broken admin "Delete user" — see the open PR titled *"41 restrictive FKs"*, sitting since 21 July.

⚠ **Four were actively blocking:** `oauth_state` (**30 rows**), `event_moderators` (2), `slug_change_log` (1), `event_manual_vendors` (1).

### The split, which is not cosmetic

**14 columns are nullable → `ON DELETE SET NULL`.** These are *authorship stamps*: who recorded a budget decision, who invited a moderator, who scanned a QR. The row records something that happened and survives its author with the attribution removed. Cascading would delete an event's moderator list because the person who sent the invitations left — **the event record belongs to the event, not to whoever typed it.**

**3 are NOT NULL and are ephemeral OAuth handshake state → `ON DELETE CASCADE`.** Meaningless without the user who started it; same call as this morning's. **No rows are deleted** — they simply stop refusing.

**4 are deliberately left refusing**, because they are a product decision rather than a schema one: `kwento_assignments.assigned_by_user_id`, `patiktok_oauth_grants.granted_by`, `patiktok_render_jobs.requested_by`, `render_jobs.requested_by`. Each is NOT NULL, so the only options are making the column nullable — which retires the assertion *"this row always has an author"* — or CASCADE, which **deletes render-job history and TikTok grants** when a user leaves. Neither is a tidy-up. They're named in the baseline with the reason so nobody rediscovers them.

### It also closes a chunk of the erasure backlog

These same columns appear in `UNDECIDED_BACKLOG` under *"null the author stamp, keep the row"* — so this migration closes one whole group of the 59-table export/erasure gap as a side effect.

### The guard is the actual point

`tests/db/user-delete-fk-surface.db.test.ts` asserts every single-column FK onto `auth.users` either has a delete behaviour or is named in a baseline with a written reason.

**Refusing is a legitimate choice** — a record that must outlive its author is a real thing. Refusing **by default**, because nobody wrote an `ON DELETE` clause and Postgres fell back to NO ACTION, is not. The guard forbids only the second.

It also names the 17 individually, so a regression reads as *"this specific one reopened"* rather than *"the surface grew"*.

**Proven, not assumed:** with the migration removed the suite is 2/4; with it, 4/4.

Verified: migration guard green (1020) · **full DB suite 720/720**.

SPEC IMPACT: None — access/lifecycle correction. No product behaviour intentionally changes; account deletion stops being refused by keys nobody decided on.
