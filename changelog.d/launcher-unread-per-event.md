## 2026-07-10 · feat(launcher): per-event unread-messages decision line + "N more shops" cap

Phase 2 of the launcher "needs a decision now" work (owner-approved sequencing),
plus the multi-shop display cap.

**Unread messages per event (the 4th signal).** The shipped
`count_unread_message_threads()` flattens to one total across the whole account,
so a per-event count needs a grouped variant. New migration
`20270712208395_unread_threads_by_event.sql` adds
`unread_message_threads_by_event()` — a read-only `SECURITY DEFINER` RPC that
mirrors the flat counter's exact unread rule (a thread with a message from
someone else, newer than the user's `last_read_at`) but returns
`TABLE(event_id, unread_count)` grouped by event, couple-side only. `message` is
now a `DecisionKind` in `lib/event-decisions.ts` (priority pay → approve →
message → overdue), fed by a new `fetchEventUnreadCounts()` helper. Fully
graceful-degrading: before the migration is applied the RPC errors and the line
just doesn't show (same pattern as `countUnreadMessages`) — the deploy is safe
ahead of the DB push.

**"N more shops" cap.** A vendor with many shops no longer floods "Your spaces":
tiles cap at 3, the rest collapse into one "N more shops" tile. Shops with
pending inquiries are ranked first so an inquiry is never hidden behind the cap,
and the "more" tile still surfaces the total inquiries among the shops it hides.

⚠ OWNER ACTION: apply the migration to prod (`supabase db push`) for the
unread-message line to populate — until then it reads 0 (no line), which is safe.

SPEC IMPACT: None (UI + a read-only helper RPC; no schema table, SKU, or locked
decision changed).
