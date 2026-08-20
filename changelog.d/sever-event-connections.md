## 2026-08-20 · feat(events): deleting a celebration severs its connections

Owner, after deleting his own event and finding what stayed:
*"it should remove all connections to that event. Inquiries, payments, etc."*

His delete left order **S89O-GCR6BDC4Z6** — ₱499, unpaid — in the admin payment
queue with a null event and nothing to tie it to. Measured in prod: it was one of
**two** orphans that delete produced.

**Most children already cascade. TEN foreign keys are `ON DELETE SET NULL`** —
verified in production **by the object** (`pg_constraint.confdeltype`), not from a
migration file — so their rows survive with a null event. That was right while
only an admin could delete an event; it is wrong now that a couple can.

### Why a TRIGGER, not the server action

There are **six** event-delete call sites in app code, and a **seventh with no
server action at all**: RLS policy `couple_can_delete_event`. Measured in prod:
`has_table_privilege('authenticated','public.events','DELETE')` = **TRUE**.
Cleanup written in `deleteOwnEvent` would be skipped by a path that already
exists. `20271138150255` put the address hold in the database for exactly this
reason: *"the hold moves into the database, so no path present or future can miss
it, including one nobody has written yet."*

⚠ **BEFORE, not AFTER** — an FK `SET NULL` fires as an internal AFTER-delete
action, so only a BEFORE trigger can still see `orders.event_id`,
`vendor_date_waitlist.event_id` and `checked_out_event_id` populated.

### What it severs

| | what a person would otherwise still meet |
|---|---|
| **unpaid orders → cancelled** | the owner's exact defect: a live bill nobody can pay or cancel. **Cancelled, never deleted** — `DELETE ON orders` is already revoked, `order_refunds.order_id` is `ON DELETE RESTRICT`, and deleting cascades payments/receipts/ledger. The lost event's name is written to `admin_notes` so an operator can tell why |
| **waitlist → cancelled, `accepted_at` cleared** | 🚨 **the only leftover that reaches out and contacts a person** — when the date frees, the supplier's waitlist emails whoever is queued, for a celebration that no longer exists, and spends one of that supplier's tier-capped acceptances on a ghost |
| **Live Studio channel → released** | one of Setnayan's own YouTube channels stuck lent out to nobody; the automatic return searches by event id, so after the SET NULL it could never find the row again — a forward primitive with no inverse |
| **stranded inquiry notifications → deleted** | the supplier's bell keeps "New booking inquiry" with up to 200 characters of the couple's message, forever, and tapping it 404s. `notifications` has neither an event_id nor a thread_id column, so nothing could cascade it |
| **chapter gallery pointers → cleared** | a **published** chapter kept telling strangers "a Papic gallery sits behind this chapter" when every photo was gone — the proper column nulls, but `substrate` keeps a duplicate no FK can reach |
| **concierge questions → deleted** | the couple's own free text, no reader, no legal duty |

### What it deliberately does NOT touch

The **`event_closed` slug hold** (owner-locked — a printed save-the-date QR must
never land a guest on a stranger's wedding) · **`person_connections`** (deleting a
christening must not un-godparent anybody) · **`guest_saved_vendors`** and
**`vendor_profile_views`** (a *guest's* bookmark and a supplier's own metrics —
not the couple's to destroy) · the **`creator_chapters` row** itself (somebody
else's published writing) · anything carrying a payment or receipt (the gate
refuses those events outright, so they never reach the trigger).

🔒 **Revoked, not baselined.** `anon-rpc-surface.db.test.ts` fires on a new
anon-callable SECURITY DEFINER function and is right to — this one cancels orders
as the table owner. A trigger function needs no direct grant, so the door is
closed rather than a baseline line written to excuse it.

**Guards:** 6 db tests, every one deleting through **raw SQL** rather than the
server action, because the RLS lane is the path that actually exists. All 7
sabotages mutation-checked with occurrence counts printed before → after, all RED
— including one proving a guest's bookmark is NOT swept.

🪤 **Three sabotages did not land on the first run** and read as passes: replacing
`UPDATE public.vendor_date_waitlist` with `..._DISABLED` leaves the searched
string intact as a **substring**, and an insertion mutation was measured by its
anchor rather than by the injected text. Counts caught all three (`1→1`, `1→1`,
`0→0`). **The replacement must not contain the thing you are counting.**

SPEC IMPACT: `DECISION_LOG.md` — row added 2026-08-20 (severing connections, and
the owner's ruling that photos are deleted when a couple deletes their own event).
