## 2026-09-17 · fix(admin): an admin who erases a celebration leaves a permanent record

`deleteEvent` hard-deletes a wedding — guests, members, seating, budget and schedule all
cascade, and the R2 objects are swept afterwards — and wrote **nothing, anywhere**, saying
it had happened or who did it.

**Measured in production before building, not inferred from the code:**

```sql
select action, count(*) from admin_audit_log group by action;   -- 23 actions, none a deletion
```

`admin_audit_log` has recorded admin actions since June, is append-only by database trigger
(`admin_audit_log_append_only`), and carries 23 distinct action values — SKU edits, taxonomy
remaps, a verification bypass grant, a forced vendor completion. The single most destructive
thing in the console was not one of them. Separately, `events` carries **nine BEFORE DELETE
triggers** and every one is about *preserving* somebody else's rows (supplier paperwork,
bookings, the reply clock, the address hold, arm's-length reviews) — substantial deliberate
machinery, none of which records that the deletion occurred.

With the project on the Supabase free plan and therefore **no database backup behind it**, a
celebration could vanish with no trace of who removed it, when, or what was in it.

**What now happens.** `requireAdmin()` already returned `adminUserId` and the call site was
throwing it away; it is now carried into an `event_hard_delete` row alongside a snapshot taken
*before* the row dies — public id, display name, date, type, slug, and the guest and vendor
counts — plus the outcome of the media sweep.

Three properties the tests hold, each of which can be got wrong silently:

- **Order.** The snapshot is taken BEFORE the delete (afterwards nothing can name what was
  destroyed) and the audit row is written AFTER it succeeds (so a refused delete can never
  record a wipe that did not happen). The guard asserts the byte positions, not the presence.
- **A record is never suppressed.** No input — missing actor, unreadable snapshot, failed
  sweep — makes the builder return null or throw. An incomplete record beats no record.
- **"Could not read" is never written as zero.** Counts come back `null` when the query fails,
  and a genuine zero still reads as zero. Absence is not emptiness.

The shape lives in a **pure** sibling (`lib/admin-event-delete-audit.ts` — no `server-only`,
no Supabase import) so the test can EXECUTE the decision instead of grepping for it; only the
insert stays in the action. Both sabotages were run and both went red: removing the builder
call, and moving the snapshot after the delete. Restored, 5/5 green.

⚠ **Scope is stated in the code rather than assumed.** This covers the ADMIN path only.
Production also carries an RLS policy (`couple_can_delete_event`) letting a couple delete their
own celebration straight through PostgREST with no server action involved — the same door
`actions.ts` already documents for the address hold ("Removing the button closes the button,
not the door"). A couple removing their own wedding is **not** an admin action and must not
appear in an admin audit log; if that path needs a trail it wants a different table and a
BEFORE DELETE trigger. Flagged for the owner, not silently folded in.

SPEC IMPACT: None. No schema change (`admin_audit_log` already has `before_json`, `reason` and
`metadata`), no new decision, no price. One new action value in an existing vocabulary.
