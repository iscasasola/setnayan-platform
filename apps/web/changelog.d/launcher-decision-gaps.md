## 2026-07-10 · fix(launcher): close the gaps in the "needs a decision now" cards

Follow-up sweep after an owner gap-audit of the decision-line feature.

- **Accuracy** — the unread signal counts *threads*, not individual messages, so
  the label is now "N unread chat(s)" instead of "messages" (a thread with 5
  unread replies is one chat).
- **Vendor shop unread replies** — shop cards surfaced only NEW inquiries, so an
  unread reply in an already-accepted conversation showed nothing. New migration
  `20270712457616_unread_threads_by_vendor.sql` adds
  `unread_message_threads_by_vendor()` (the vendor-side twin of the per-event
  RPC, grouped by vendor_profile_id) + `fetchVendorUnreadCounts()`. Shop
  attention now = new inquiries first, else unread chats; the "N more shops" tile
  and the shop ranking both account for either.
- **Finished events** — a past/finished event now still surfaces pay / approve /
  message decisions (an unpaid balance on a wrapped wedding no longer hides),
  with overdue-task counts suppressed for past events (everything would read
  "overdue" otherwise).
- **Admin HQ count** — "N awaiting review" now excludes the `support` lane (help
  desk, review appeals) so ongoing support volume doesn't inflate it next to real
  gating decisions (payments, verification, disputes, approvals).
- **Broken shop logo** — new `ShopLogo` client component falls back to the store
  glyph on image load error instead of showing the browser's broken-image icon.
- **Tests** — `lib/event-decisions.test.ts` locks the summarizer's priority
  order + labels (7 cases, all passing).

Consciously NOT added: a guest/RSVP signal. The guests schema has only
guest-driven state (rsvp_status, plus-one naming) — there is no couple-facing
"must decide" guest event to count, and fabricating one was the wrong call.

⚠ OWNER ACTION: `supabase db push` to apply the vendor-unread function (until
then the shop unread-chat line reads 0 — safe, graceful-degrades).

SPEC IMPACT: None (UI + a read-only helper RPC; no schema table, SKU, or locked
decision changed).
